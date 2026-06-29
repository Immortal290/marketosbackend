"""
MarketOS — Finance Agent
PRD: Meta/Google/TikTok Ads API, Stripe, budget DB. Hourly + overspend trigger.

Two roles in the pipeline:
1. PRE-SEND GATE  — runs before email_agent, checks budget isn't exhausted/overpacing.
                    Blocks send if spend_pct > 1.10 (110% of daily budget).
2. ROI ATTRIBUTION — runs after analytics, calculates ROAS, CPA, channel breakdown.

Hourly daemon (separate process): python -m agents.finance.finance_daemon
Kafka topics consumed: campaign.events (overspend trigger)
Kafka topics published: campaign.events (budget_capped event)

Sub-skills (not in PRD — added for completeness):
  - BudgetPacingSkill:    Projects end-of-day spend from current burn rate
  - ROASCalculatorSkill:  Calculates ROAS with multi-touch attribution model
  - CurrencyNormSkill:    Normalises INR / USD / GBP across ad platforms
"""

from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone
from typing import Optional

from langchain_core.messages import SystemMessage, HumanMessage

from agents.llm.llm_provider import get_llm
from schemas.campaign import CampaignPlan
from utils.kafka_bus import publish_event, Topics
from utils.logger import agent_log, step_banner, kv, section, divider, check_line
from utils.json_utils import extract_json, safe_float, safe_int
from core.agent_base import AgentBase

FINANCEAGENT_SKILLS = [
    "pricing-strategy","revops","paid-ads"
]

class FinanceAgent(AgentBase):
    def __init__(self):
        super().__init__("Finance Agent", FINANCEAGENT_SKILLS)


try:
    import psycopg2, psycopg2.extras
    PG_AVAILABLE = True
except ImportError:
    PG_AVAILABLE = False

PG_DSN    = os.getenv("DATABASE_URL", "postgresql://marketos:marketos_dev@localhost:5433/marketos")
WORKSPACE = os.getenv("DEFAULT_WORKSPACE_ID", "default")


# ── Sub-skill: Budget Pacing ──────────────────────────────────────────────────

class BudgetPacingSkill:
    """
    Projects end-of-day spend from current burn rate.
    If projected_spend > daily_budget * 1.10, flag as overpacing.
    """

    @staticmethod
    def calculate(spent: float, budget: float, hour_of_day: int) -> dict:
        if budget <= 0 or hour_of_day == 0:
            return {"pacing_ok": True, "projected_spend": spent, "pacing_pct": 0.0}

        # Linear extrapolation: if we spent X in H hours, we'll spend X*(24/H) by EOD
        hours_remaining  = max(24 - hour_of_day, 1)
        burn_rate_per_hr = spent / hour_of_day
        projected_eod    = spent + (burn_rate_per_hr * hours_remaining)
        pacing_pct       = projected_eod / budget

        return {
            "pacing_ok":       pacing_pct <= 1.10,
            "projected_spend": round(projected_eod, 2),
            "pacing_pct":      round(pacing_pct, 4),
            "burn_rate_hr":    round(burn_rate_per_hr, 2),
        }

# ── Sub-skill: Token Cost Calculator ─────────────────────────────────────────

class TokenCostSkill:
    """
    Calculates API token cost.
    Gemini 3 Pro reference: ~$1.25 per 1M input tokens. ~$5.00 per 1M output tokens.
    For simplicity, treating as $2.50 per 1M combined tokens baseline.
    """
    RATE_PER_MILLION = 2.50  # USD

    @staticmethod
    def calculate(total_tokens: int) -> float:
        return (total_tokens / 1_000_000) * TokenCostSkill.RATE_PER_MILLION



# ── Sub-skill: ROAS Calculator ────────────────────────────────────────────────

class ROASCalculatorSkill:
    """
    Multi-touch attribution: last-click primary, linear as fallback.
    ROAS = attributed_revenue / total_spend
    CPA  = total_spend / conversions
    """

    @staticmethod
    def calculate(spend: float, conversions: int, avg_order_value: float = 999.0) -> dict:
        if spend <= 0:
            return {"roas": 0.0, "cpa": 0.0, "attributed_revenue": 0.0}

        attributed_revenue = conversions * avg_order_value
        roas = attributed_revenue / spend
        cpa  = spend / max(conversions, 1)

        return {
            "attributed_revenue": round(attributed_revenue, 2),
            "roas":               round(roas, 2),
            "cpa":                round(cpa, 2),
            "profitable":         roas >= 2.0,   # 2x ROAS = break even for most D2C
        }


# ── Sub-skill: Currency Normalisation ────────────────────────────────────────

class CurrencyNormSkill:
    """
    Normalises spend figures across currencies to workspace base currency.
    Rates are hardcoded for demo; production would call an FX API.
    """

    RATES_TO_INR = {"USD": 83.5, "GBP": 105.0, "EUR": 90.0, "INR": 1.0}

    @classmethod
    def to_inr(cls, amount: float, currency: str = "INR") -> float:
        rate = cls.RATES_TO_INR.get(currency.upper(), 1.0)
        return round(amount * rate, 2)


# ── DB Helpers ────────────────────────────────────────────────────────────────

def _load_campaign_spend(campaign_id: str) -> dict:
    """Load current spend from budget tracking table."""
    if not PG_AVAILABLE:
        return {"spent": 0.0, "conversions": 0}
    try:
        conn = psycopg2.connect(PG_DSN)
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT COALESCE(SUM(amount_inr), 0) AS spent,
                       COALESCE(SUM(conversions), 0) AS conversions
                FROM campaign_spend
                WHERE campaign_id = %s AND workspace_id = %s
            """, (campaign_id, WORKSPACE))
            row = cur.fetchone()
        conn.close()
        return dict(row) if row else {"spent": 0.0, "conversions": 0}
    except Exception as e:
        agent_log("FINANCE", f"DB spend lookup failed: {e}")
        return {"spent": 0.0, "conversions": 0}


def _write_roi_attribution(campaign_id: str, roi: dict) -> None:
    if not PG_AVAILABLE:
        return
    try:
        conn = psycopg2.connect(PG_DSN)
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO roi_attributions
                    (campaign_id, workspace_id, total_spend, attributed_revenue,
                     conversions, roas, cpa, attributed_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
                ON CONFLICT (campaign_id) DO UPDATE
                SET attributed_revenue = EXCLUDED.attributed_revenue,
                    roas               = EXCLUDED.roas,
                    cpa                = EXCLUDED.cpa,
                    attributed_at      = NOW()
            """, (
                campaign_id, WORKSPACE,
                roi.get("total_spend", 0),
                roi.get("attributed_revenue", 0),
                roi.get("conversions", 0),
                roi.get("roas", 0),
                roi.get("cpa", 0),
            ))
        conn.commit()
        conn.close()
    except Exception as e:
        agent_log("FINANCE", f"ROI write failed: {e}")


# ── System Prompt ─────────────────────────────────────────────────────────────

FINANCEAGENT_EXPERTISE = """You are the Finance Agent for MarketOS — responsible for budget governance and ROI attribution.

PRE-SEND MODE: Evaluate whether this campaign has budget headroom to proceed.
ROI MODE: Calculate return on ad spend and cost per acquisition.

BUDGET THRESHOLDS (PRD §5.2):
- spend_pct < 0.80: GREEN — full send approved
- spend_pct 0.80-1.10: YELLOW — approved with warning
- spend_pct > 1.10: RED — block send, fire budget_capped event

ROAS BENCHMARKS (India D2C):
- < 1.0x: Loss-making — recommend pausing
- 1.0-2.0x: Break-even zone — monitor closely
- 2.0-4.0x: Profitable — continue
- > 4.0x: Strong — scale up

OUTPUT RULES: Respond ONLY with valid JSON.

PRE-SEND schema:
{
  "approved": true,
  "spend_pct": 0.45,
  "cpm_estimate": 85.0,
  "projected_cost_this_send": 2125.0,
  "block_reason": null,
  "recommendations": ["Consider increasing budget — pacing at 45% with 60% of day remaining"]
}

ROI schema:
{
  "roas": 3.2,
  "cpa": 312.5,
  "attributed_revenue": 125000.0,
  "channel_breakdown": {"email": 0.70, "sms": 0.20, "social": 0.10},
  "profitable": true,
  "scale_recommendation": "Increase budget by 30% — ROAS well above 2x threshold"
}"""


# ── Agent Node (Pre-send budget gate) ─────────────────────────────────────────

def finance_agent_node(state: dict) -> dict:
    step_banner("FINANCE AGENT  ─  Budget Gate & ROI Attribution")

    plan_data    = state.get("campaign_plan") or {}
    analytics    = state.get("analytics_result") or {}
    plan         = CampaignPlan(**plan_data)
    campaign_id  = plan.campaign_id
    budget       = plan.budget or 0.0

    agent_log("FINANCE", f"Campaign: {campaign_id}  |  Budget: ₹{budget:,.0f}")

    # ── Load current spend ────────────────────────────────────────────────
    spend_data   = _load_campaign_spend(campaign_id)
    spent        = safe_float(spend_data.get("spent"), 0.0)
    conversions  = safe_int(spend_data.get("conversions"), 0)
    spend_pct    = (spent / budget) if budget > 0 else 0.0
    hour         = datetime.now(timezone.utc).hour

    # ── Sub-skills ────────────────────────────────────────────────────────
    pacing   = BudgetPacingSkill.calculate(spent, budget, hour)
    roi_calc = ROASCalculatorSkill.calculate(spent, conversions)
    currency = CurrencyNormSkill()
    
    # Check Token Usage from upstream pipeline steps
    api_tokens_used = state.get("api_tokens", 0)
    token_cost_usd  = TokenCostSkill.calculate(api_tokens_used)

    agent_log("FINANCE", f"Spend: ₹{spent:,.0f} / ₹{budget:,.0f}  ({spend_pct*100:.1f}%)")
    agent_log("FINANCE", f"Pacing: {pacing['pacing_pct']*100:.1f}% projected EOD")
    if api_tokens_used > 0:
        agent_log("FINANCE", f"Pipeline API Cost: {api_tokens_used:,} tokens (~${token_cost_usd:.4f})")

    # ── LLM for recommendations ───────────────────────────────────────────
    mode = "ROI" if analytics else "PRE_SEND"
    metrics = analytics.get("metrics", {})

    context = f"""
MODE: {mode}
CAMPAIGN: {plan.campaign_name} ({campaign_id})
BUDGET: ₹{budget:,.0f}
SPENT:  ₹{spent:,.0f}  ({spend_pct*100:.1f}% of budget)
HOUR OF DAY: {hour}:00 UTC
PACING: projected ₹{pacing['projected_spend']:,.0f} EOD ({pacing['pacing_pct']*100:.1f}%)

{"ANALYTICS METRICS:" + str({k: round(v*100,2) for k,v in metrics.items() if k.endswith('rate')}) if metrics else ""}
CONVERSIONS: {conversions}
ESTIMATED ROAS: {roi_calc.get('roas', 0):.2f}x
"""
    llm = get_llm(temperature=0)
    schema = "PRE-SEND schema" if mode == "PRE_SEND" else "ROI schema"
    agent = FinanceAgent()

    messages = [
        SystemMessage(content=agent.build_prompt(FINANCEAGENT_EXPERTISE)),
        HumanMessage(content=f"{context}\n\nReturn the {schema}."),
    ]
    response = llm.invoke(messages)
    try:
        data = extract_json(response.content.strip())
    except ValueError:
        data = {"approved": True, "spend_pct": spend_pct, "block_reason": None}

    # ── Deterministic budget gate (overrides LLM) ─────────────────────────
    approved = spend_pct <= 1.10 and pacing["pacing_ok"]
    if not approved and mode == "PRE_SEND":
        block_reason = (
            f"Budget overpace: at ₹{spent:,.0f} / ₹{budget:,.0f} "
            f"({spend_pct*100:.1f}%). Projected EOD: ₹{pacing['projected_spend']:,.0f}."
        )
        # Publish budget_capped event
        publish_event(
            topic=Topics.CAMPAIGN_EVENTS,
            source_agent="finance_agent",
            payload={"campaign_id": campaign_id, "event_type": "budget_capped",
                     "spend_pct": spend_pct, "block_reason": block_reason},
            priority="CRITICAL",
        )
        agent_log("FINANCE", f"🚫 BUDGET GATE BLOCKED — {block_reason}")
    else:
        approved     = True
        block_reason = None

    # ── ROI attribution write ─────────────────────────────────────────────
    if mode == "ROI":
        _write_roi_attribution(campaign_id, {
            "total_spend":          spent,
            "attributed_revenue":   roi_calc.get("attributed_revenue", 0),
            "conversions":          conversions,
            "roas":                 roi_calc.get("roas", 0),
            "cpa":                  roi_calc.get("cpa", 0),
        })

    # ── Terminal output ───────────────────────────────────────────────────
    divider()
    section("BUDGET STATUS")
    kv("Spent",          f"₹{spent:,.0f} / ₹{budget:,.0f}  ({spend_pct*100:.1f}%)")
    kv("EOD Projection", f"₹{pacing['projected_spend']:,.0f}  ({pacing['pacing_pct']*100:.1f}%)")
    kv("Gate",           "✅ APPROVED" if approved else "🚫 BLOCKED")
    if block_reason:
        kv("Reason", block_reason)

    section("ROI ATTRIBUTION")
    kv("ROAS",               f"{roi_calc.get('roas', 0):.2f}x")
    kv("CPA",                f"₹{roi_calc.get('cpa', 0):,.2f}")
    kv("Attributed Revenue", f"₹{roi_calc.get('attributed_revenue', 0):,.2f}")
    kv("Profitable",         "Yes" if roi_calc.get("profitable") else "No — below 2x ROAS")

    if data.get("recommendations"):
        section("RECOMMENDATIONS")
        for r in data["recommendations"]:
            print(f"  →  {r}")

    if data.get("scale_recommendation"):
        print(f"\n  Scale: {data['scale_recommendation']}")

    divider()

    next_step = "email_agent" if approved else "blocked"

    return {
        **state,
        "finance_result": {
            "approved":             approved,
            "campaign_id":          campaign_id,
            "budget_total":         budget,
            "budget_spent":         spent,
            "spend_pct":            spend_pct,
            "pacing":               pacing,
            "roi":                  roi_calc,
            "block_reason":         block_reason,
            "recommendations":      data.get("recommendations", []),
            "checked_at":           datetime.now(timezone.utc).isoformat(),
        },
        "current_step": next_step,
        "trace": state.get("trace", []) + [{
            "agent":     "finance_agent",
            "status":    "approved" if approved else "blocked",
            "spend_pct": round(spend_pct, 4),
            "roas":      roi_calc.get("roas", 0),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }],
    }


# ── Conditional Router ────────────────────────────────────────────────────────

def finance_router(state: dict) -> str:
    result = state.get("finance_result", {})
    if result.get("approved", True):
        return "email_agent"
    agent_log("FINANCE", "Pipeline halted — budget gate blocked send.")
    return "end"
