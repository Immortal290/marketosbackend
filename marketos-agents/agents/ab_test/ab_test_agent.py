"""
MarketOS — A/B Test Agent
PRD: Bayesian A/B tests (not naive open-rate comparison). Event-driven.
     Listens on campaign.send.stats. Triggers when 100+ opens reached.
     Writes winner to episodic memory so Copy Agent learns.

Sub-skills (beyond PRD):
  BayesianStatsSkill     — Beta-distribution Bayesian test (no scipy needed)
  MultivariateScheduler  — Tracks factorial tests: subject × CTA × send_time
  SampleSizeCalculator   — Determines minimum sample size before declaring winner
  EarlyStoppingRule      — Declares winner early if P(best) > 0.95 before threshold
"""

from __future__ import annotations

import math
import os
import random
import uuid
from datetime import datetime, timezone
from typing import Optional

from langchain_core.messages import SystemMessage, HumanMessage

from agents.llm.llm_provider import get_llm
from utils.kafka_bus import publish_event, Topics
from utils.memory import episodic_memory
from utils.logger import agent_log, step_banner, kv, section, divider
from utils.json_utils import extract_json, safe_float, safe_int
from core.agent_base import AgentBase

ABTESTAGENT_SKILLS = [
    "ab-test-setup","analytics-tracking","page-cro"
]

class AbTestAgent(AgentBase):
    def __init__(self):
        super().__init__("AbTest Agent", ABTESTAGENT_SKILLS)


try:
    import psycopg2, psycopg2.extras
    PG_AVAILABLE = True
except ImportError:
    PG_AVAILABLE = False

PG_DSN    = os.getenv("DATABASE_URL", "postgresql://marketos:marketos_dev@localhost:5433/marketos")
WORKSPACE = os.getenv("DEFAULT_WORKSPACE_ID", "default")


# ── Sub-skill: Bayesian Stats ─────────────────────────────────────────────────

class BayesianStatsSkill:
    """
    Beta-Binomial Bayesian A/B test.
    No scipy — pure Python Monte Carlo sampling (n=10,000 draws).

    For each variant, maintains a Beta(alpha, beta) posterior where:
      alpha = successes + 1  (opens/clicks + prior)
      beta  = failures  + 1  (non-opens + prior)

    P(variant_i is best) = fraction of MC draws where variant_i wins.
    Expected improvement = (mean_winner - mean_baseline) / mean_baseline
    """

    N_SAMPLES = 10_000

    @classmethod
    def run(cls, variants: list[dict], metric: str = "open_rate") -> list[dict]:
        """
        variants: list of dicts with keys: variant_id, sends, successes (opens/clicks)
        Returns variants with prob_best and expected_improvement added.
        """
        if len(variants) < 2:
            return variants

        # Build Beta posteriors
        posteriors = []
        for v in variants:
            sends     = max(v.get("sends", 1), 1)
            successes = v.get("successes", 0)
            failures  = sends - successes
            posteriors.append({
                "variant_id": v["variant_id"],
                "alpha": successes + 1,   # Beta prior α=1
                "beta":  failures  + 1,   # Beta prior β=1
                "mean":  (successes + 1) / (sends + 2),  # posterior mean
            })

        # Monte Carlo: draw N_SAMPLES from each Beta, count wins
        win_counts = {p["variant_id"]: 0 for p in posteriors}

        for _ in range(cls.N_SAMPLES):
            draws = {
                p["variant_id"]: cls._beta_sample(p["alpha"], p["beta"])
                for p in posteriors
            }
            winner_id = max(draws, key=draws.get)
            win_counts[winner_id] += 1

        # Attach results
        baseline_mean = posteriors[0]["mean"]
        results = []
        for v, p in zip(variants, posteriors):
            prob_best = win_counts[p["variant_id"]] / cls.N_SAMPLES
            exp_imp   = (p["mean"] - baseline_mean) / max(baseline_mean, 0.001)
            results.append({
                **v,
                "beta_alpha":           p["alpha"],
                "beta_beta":            p["beta"],
                "posterior_mean":       round(p["mean"], 4),
                "prob_best":            round(prob_best, 4),
                "expected_improvement": round(exp_imp, 4),
            })

        return results

    @staticmethod
    def _beta_sample(alpha: float, beta: float) -> float:
        """Sample from Beta(alpha, beta) via the stdlib C implementation."""
        return random.betavariate(alpha, beta)


# ── Sub-skill: Sample Size Calculator ────────────────────────────────────────

class SampleSizeCalculator:
    """
    Minimum detectable effect (MDE) based sample size.
    Simplified formula for 80% power, 95% confidence.
    """

    @staticmethod
    def minimum_for_mde(baseline_rate: float, mde: float = 0.05) -> int:
        """
        baseline_rate: expected conversion rate (e.g. 0.25 for 25%)
        mde: minimum relative lift to detect (e.g. 0.05 = 5% relative lift)
        """
        p1 = baseline_rate
        p2 = baseline_rate * (1 + mde)
        p_bar = (p1 + p2) / 2

        # n = 2 * p_bar*(1-p_bar) * (1.96 + 0.84)^2 / (p2-p1)^2
        numerator   = 2 * p_bar * (1 - p_bar) * (1.96 + 0.84) ** 2
        denominator = (p2 - p1) ** 2
        n = math.ceil(numerator / max(denominator, 1e-10))
        return max(n, 100)   # never below 100 per PRD


# ── Sub-skill: Early Stopping Rule ───────────────────────────────────────────

class EarlyStoppingRule:
    """
    Declare winner early if P(best) > 0.95 before sample threshold is reached.
    Prevents prolonged A/B tests with obvious winners from wasting budget.
    """

    EARLY_STOP_THRESHOLD = 0.95

    @classmethod
    def check(cls, variants: list[dict]) -> Optional[str]:
        """Returns variant_id of early winner, or None."""
        for v in variants:
            if v.get("prob_best", 0) >= cls.EARLY_STOP_THRESHOLD:
                return v["variant_id"]
        return None


# ── DB Helpers ────────────────────────────────────────────────────────────────

def _load_variant_stats(campaign_id: str) -> list[dict]:
    """Load live variant performance from ClickHouse or PostgreSQL."""
    if not PG_AVAILABLE:
        return []
    try:
        conn = psycopg2.connect(PG_DSN)
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT variant_id,
                       sends, opens, clicks, conversions,
                       CASE WHEN sends > 0 THEN opens::float/sends ELSE 0 END AS open_rate,
                       CASE WHEN sends > 0 THEN clicks::float/sends ELSE 0 END AS ctr
                FROM ab_variant_stats
                WHERE campaign_id = %s AND workspace_id = %s
                ORDER BY variant_id
            """, (campaign_id, WORKSPACE))
            rows = cur.fetchall()
        conn.close()
        return [dict(r) for r in rows]
    except Exception as e:
        agent_log("AB_TEST", f"Variant stats load failed: {e}")
        return []


def _suppress_loser(campaign_id: str, variant_id: str) -> None:
    if not PG_AVAILABLE:
        return
    try:
        conn = psycopg2.connect(PG_DSN)
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE copy_variants
                SET is_winner = FALSE, suppressed = TRUE
                WHERE campaign_id = %s AND variant_id = %s
            """, (campaign_id, variant_id))
        conn.commit()
        conn.close()
    except Exception as e:
        agent_log("AB_TEST", f"Loser suppression DB write failed: {e}")


def _promote_winner(campaign_id: str, variant_id: str) -> None:
    if not PG_AVAILABLE:
        return
    try:
        conn = psycopg2.connect(PG_DSN)
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE copy_variants SET is_winner = TRUE
                WHERE campaign_id = %s AND variant_id = %s
            """, (campaign_id, variant_id))
        conn.commit()
        conn.close()
    except Exception as e:
        agent_log("AB_TEST", f"Winner promotion DB write failed: {e}")


# ── System Prompt ─────────────────────────────────────────────────────────────

ABTESTAGENT_EXPERTISE = """You are the A/B Test Agent for MarketOS.

You receive Bayesian test results and produce a final decision with learnings.

YOUR JOB:
1. Confirm the winner or declare inconclusive
2. Extract the KEY learning — what specifically made the winner better
3. Generate a reusable insight for the Copy Agent's future campaigns
4. Recommend whether to scale the winner or run a follow-up test

DECISION RULES:
- P(best) >= 0.95: Declare winner confidently
- P(best) 0.80-0.95: Declare winner with caution note
- P(best) < 0.80: Declare inconclusive, recommend larger sample

OUTPUT RULES: Valid JSON only.

SCHEMA:
{
  "decision": "winner_declared | inconclusive | early_stop",
  "winner_id": "V-001",
  "confidence_label": "high | medium | low",
  "key_learning": "Urgency-led subject lines with specific % discount outperform benefit-led by X%",
  "copy_agent_insight": "For this audience segment, include specific discount % in subject line. Urgency framing increases open rate.",
  "scale_recommendation": "Scale winner to remaining 80% of list immediately",
  "follow_up_test": null
}"""


# ── Agent Node ────────────────────────────────────────────────────────────────

def ab_test_agent_node(state: dict) -> dict:
    step_banner("A/B TEST AGENT  ─  Bayesian Statistical Analysis")

    plan_data   = state.get("campaign_plan") or {}
    copy_data   = state.get("copy_output") or {}
    campaign_id = plan_data.get("campaign_id", "UNKNOWN")

    agent_log("AB_TEST", f"Campaign: {campaign_id}")

    # ── Load variant stats (real DB or derive from copy scores) ──────────
    db_stats = _load_variant_stats(campaign_id)

    if db_stats:
        variants_raw = db_stats
        agent_log("AB_TEST", f"Loaded {len(variants_raw)} variants from DB")
    else:
        # Derive from copy variant scores (deterministic — no randomness)
        raw_variants = copy_data.get("variants", [])
        total_sends = safe_int((state.get("send_result") or {}).get("recipient_count"), 1000)
        per_variant = max(total_sends // max(len(raw_variants), 1), 100)
        variants_raw = []
        for v in raw_variants:
            if not isinstance(v, dict):
                continue
            open_rate = safe_float(v.get("estimated_open_rate"), 28.0) / 100
            ctr_rate  = safe_float(v.get("estimated_ctr"), 3.0) / 100
            opens     = int(per_variant * open_rate)
            clicks    = int(opens * ctr_rate)
            variants_raw.append({
                "variant_id":  v.get("variant_id", "V-001"),
                "sends":       per_variant,
                "successes":   opens,
                "opens":       opens,
                "clicks":      clicks,
                "open_rate":   round(open_rate, 4),
                "ctr":         round(ctr_rate, 4),
            })
        agent_log("AB_TEST", "Derived variant stats from copy scores (no DB data)")

    if len(variants_raw) < 2:
        agent_log("AB_TEST", "Only 1 variant — A/B test not applicable")
        return {
            **state,
            "ab_test_result": {"decision": "skipped", "reason": "single_variant"},
            "current_step": "lead_scoring",
            "trace": state.get("trace", []) + [{
                "agent": "ab_test_agent", "status": "skipped", "timestamp": datetime.now(timezone.utc).isoformat()
            }],
        }

    # ── Sample size check ─────────────────────────────────────────────────
    total_opens = sum(v.get("opens", v.get("successes", 0)) for v in variants_raw)
    min_sample  = SampleSizeCalculator.minimum_for_mde(
        baseline_rate=variants_raw[0].get("open_rate", 0.25),
    )
    sample_reached = total_opens >= min_sample
    agent_log("AB_TEST", f"Opens: {total_opens}  |  Min sample: {min_sample}  |  Threshold met: {sample_reached}")

    # ── Bayesian test ─────────────────────────────────────────────────────
    agent_log("AB_TEST", f"Running Bayesian test ({BayesianStatsSkill.N_SAMPLES:,} MC samples)...")
    tested_variants = BayesianStatsSkill.run(variants_raw, metric="open_rate")

    # ── Early stopping check ──────────────────────────────────────────────
    early_winner_id = EarlyStoppingRule.check(tested_variants)
    if early_winner_id and not sample_reached:
        agent_log("AB_TEST", f"Early stop triggered: {early_winner_id} has P(best) ≥ 0.95")

    best_variant = max(tested_variants, key=lambda v: v.get("prob_best", 0))
    winner_id    = best_variant["variant_id"] if (sample_reached or early_winner_id) else None
    loser_ids    = [v["variant_id"] for v in tested_variants if v["variant_id"] != winner_id] if winner_id else []

    # ── LLM decision + learnings ──────────────────────────────────────────
    stats_summary = "\n".join([
        f"  {v['variant_id']}: opens={v.get('opens',0)}, "
        f"open_rate={v.get('open_rate',0)*100:.1f}%, "
        f"P(best)={v.get('prob_best',0)*100:.1f}%"
        for v in tested_variants
    ])

    copy_variants = copy_data.get("variants", [])
    variant_descriptions = "\n".join([
        f"  {v.get('variant_id')}: subject=\"{v.get('subject_line','')}\" cta=\"{v.get('cta_text','')}\""
        for v in copy_variants if isinstance(v, dict)
    ])

    llm = get_llm(temperature=0)
    agent = AbTestAgent()

    messages = [
        SystemMessage(content=agent.build_prompt(ABTESTAGENT_EXPERTISE)),
        HumanMessage(content=f"""
CAMPAIGN: {plan_data.get('campaign_name', 'Unknown')} | Tone: {plan_data.get('tone', 'unknown')}
VARIANTS:
{variant_descriptions}

BAYESIAN RESULTS:
{stats_summary}

SAMPLE THRESHOLD MET: {sample_reached}
EARLY STOP TRIGGERED: {bool(early_winner_id)}
"""),
    ]
    response = llm.invoke(messages)
    try:
        decision_data = extract_json(response.content.strip())
    except ValueError:
        decision_data = {
            "decision":           "winner_declared" if winner_id else "inconclusive",
            "winner_id":          winner_id,
            "confidence_label":   "high" if best_variant.get("prob_best", 0) > 0.95 else "medium",
            "key_learning":       "Winning variant showed stronger open rate signal",
            "copy_agent_insight": "Maintain current copy direction for this audience segment",
            "scale_recommendation": "Scale winner to remaining list",
        }

    # ── Execute winner/loser actions ──────────────────────────────────────
    if winner_id:
        _promote_winner(campaign_id, winner_id)
        for lid in loser_ids:
            _suppress_loser(campaign_id, lid)
        agent_log("AB_TEST", f"Winner promoted: {winner_id}  |  Losers suppressed: {loser_ids}")

        # Write learning to episodic memory (Copy Agent reads this on next campaign)
        insight = decision_data.get("copy_agent_insight", "")
        if insight:
            episodic_memory.store(
                agent_name="copy_agent",
                event_type="ab_test_winner",
                summary=f"Campaign: {plan_data.get('campaign_name')} | Winner: {winner_id} | {insight}",
                metadata={
                    "campaign_id": campaign_id,
                    "winner_id":   winner_id,
                    "prob_best":   best_variant.get("prob_best", 0),
                    "metric":      "open_rate",
                    "tone":        plan_data.get("tone"),
                    "audience":    plan_data.get("target_audience"),
                },
            )
            agent_log("AB_TEST", "Learning stored to episodic memory ✓")

        # Publish winner event to Kafka
        publish_event(
            topic=Topics.CAMPAIGN_EVENTS,
            source_agent="ab_test_agent",
            payload={
                "campaign_id": campaign_id,
                "event_type":  "ab_test_winner_declared",
                "winner_id":   winner_id,
                "loser_ids":   loser_ids,
                "confidence":  best_variant.get("prob_best", 0),
            },
        )

    # ── Terminal output ───────────────────────────────────────────────────
    divider()
    section("VARIANT STATISTICS")
    for v in tested_variants:
        print(f"  {v['variant_id']:>8}  "
              f"sends={v.get('sends',0):>5,}  "
              f"opens={v.get('opens', v.get('successes',0)):>5,}  "
              f"open_rate={v.get('open_rate',0)*100:>5.1f}%  "
              f"P(best)={v.get('prob_best',0)*100:>5.1f}%")

    section("DECISION")
    kv("Result",      decision_data.get("decision", "unknown").upper())
    kv("Winner",      winner_id or "None — inconclusive")
    kv("Confidence",  decision_data.get("confidence_label", "unknown"))
    kv("Key learning",decision_data.get("key_learning", ""))
    if decision_data.get("scale_recommendation"):
        kv("Scale",   decision_data["scale_recommendation"])

    divider()

    test_id = f"ABT-{str(uuid.uuid4())[:8].upper()}"
    return {
        **state,
        "ab_test_result": {
            "test_id":       test_id,
            "campaign_id":   campaign_id,
            "variants":      tested_variants,
            "winner_id":     winner_id,
            "loser_ids":     loser_ids,
            "decision":      decision_data.get("decision", "inconclusive"),
            "confidence":    best_variant.get("prob_best", 0),
            "key_learning":  decision_data.get("key_learning", ""),
            "copy_insight":  decision_data.get("copy_agent_insight", ""),
            "learning_stored": bool(winner_id),
            "concluded_at":  datetime.now(timezone.utc).isoformat(),
        },
        "current_step": "lead_scoring",
        "trace": state.get("trace", []) + [{
            "agent":      "ab_test_agent",
            "status":     "completed",
            "test_id":    test_id,
            "winner":     winner_id,
            "timestamp":  datetime.now(timezone.utc).isoformat(),
        }],
    }
