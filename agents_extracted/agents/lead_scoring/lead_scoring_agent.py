"""
MarketOS — Lead Scoring Agent
PRD: CRM API, engagement event stream, ML scorer. SLA < 2s/event.

Two operating modes:
1. PIPELINE mode — runs after ab_test in the LangGraph graph, scoring
                   all contacts who engaged with the current campaign batch.
2. DAEMON mode   — standalone Kafka consumer for real-time per-event scoring.
                   Run with: python -m agents.lead_scoring.lead_scoring_daemon

Score model: configurable weights per action type (per workspace).
CRM push: HubSpot/Pipedrive via REST webhook on score change or stage transition.
MQL/SQL escalation: publishes to agent.supervisor.tasks when threshold crossed.

Sub-skills (beyond PRD):
  ScoreDecaySkill     — halves score every N days of inactivity (recency bias)
  BehaviourPatternSkill — detects buying signals: 3+ clicks in 24h, pricing page visit
  CRMWebhookSkill     — normalised webhook push to HubSpot / Pipedrive / Salesforce
  StageMachineSkill   — subscriber → MQL → SQL → opportunity → customer lifecycle
"""

from __future__ import annotations

import os
import math
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

import urllib.request
import urllib.parse
import json

from langchain_core.messages import SystemMessage, HumanMessage

from agents.llm.llm_provider import get_llm
from utils.kafka_bus import publish_event, Topics
from utils.logger import agent_log, step_banner, kv, section, divider
from utils.json_utils import extract_json, safe_float, safe_int

try:
    import psycopg2, psycopg2.extras
    PG_AVAILABLE = True
except ImportError:
    PG_AVAILABLE = False

PG_DSN    = os.getenv("DATABASE_URL", "postgresql://marketos:marketos_dev@localhost:5433/marketos")
WORKSPACE = os.getenv("DEFAULT_WORKSPACE_ID", "default")

# Default scoring weights (per PRD — configurable per workspace in DB)
DEFAULT_WEIGHTS = {
    "email_open":     5.0,
    "email_click":    15.0,
    "page_visit":     3.0,
    "pricing_page":   25.0,
    "form_fill":      40.0,
    "purchase":       100.0,
    "unsubscribe":    -50.0,
    "spam_complaint": -100.0,
}
MQL_THRESHOLD   = 50.0
SQL_THRESHOLD   = 100.0
SCORE_DECAY_DAYS = 30


# ── Sub-skill: Score Decay ────────────────────────────────────────────────────

class ScoreDecaySkill:
    """
    Applies time-based decay: score halves every SCORE_DECAY_DAYS of inactivity.
    Formula: decayed = score * 0.5^(days_inactive / decay_days)
    """

    @staticmethod
    def apply(score: float, last_activity_days_ago: int, decay_days: int = SCORE_DECAY_DAYS) -> float:
        if last_activity_days_ago <= 0:
            return score
        decay_factor = 0.5 ** (last_activity_days_ago / decay_days)
        return round(score * decay_factor, 2)


# ── Sub-skill: Behaviour Pattern Detector ────────────────────────────────────

class BehaviourPatternSkill:
    """
    Detects high-intent buying signals from engagement history.
    These signals can override normal score thresholds for fast-tracking.
    """

    @staticmethod
    def detect(contact_history: list[dict]) -> list[str]:
        signals = []
        now     = datetime.now(timezone.utc)

        clicks_24h = sum(
            1 for e in contact_history
            if e.get("event_type") == "email_click"
            and (now - datetime.fromisoformat(e["timestamp"])).total_seconds() < 86400
        )
        if clicks_24h >= 3:
            signals.append(f"{clicks_24h} email clicks in last 24h — high intent")

        has_pricing = any("pricing" in (e.get("url") or "").lower() for e in contact_history)
        if has_pricing:
            signals.append("visited pricing page — strong buying signal")

        purchases = [e for e in contact_history if e.get("event_type") == "purchase"]
        if len(purchases) >= 2:
            signals.append(f"{len(purchases)} purchases — loyal customer")

        return signals


# ── Sub-skill: Stage Machine ──────────────────────────────────────────────────

class StageMachineSkill:
    """
    Lifecycle stage transitions based on score thresholds.
    subscriber → mql → sql → opportunity → customer
    """

    STAGES = ["subscriber", "mql", "sql", "opportunity", "customer"]

    @classmethod
    def resolve_stage(cls, score: float, has_purchase: bool = False) -> str:
        if has_purchase or score >= 200:
            return "customer"
        if score >= 150:
            return "opportunity"
        if score >= SQL_THRESHOLD:
            return "sql"
        if score >= MQL_THRESHOLD:
            return "mql"
        return "subscriber"

    @classmethod
    def stage_changed(cls, old_stage: str, new_stage: str) -> bool:
        old_idx = cls.STAGES.index(old_stage) if old_stage in cls.STAGES else 0
        new_idx = cls.STAGES.index(new_stage) if new_stage in cls.STAGES else 0
        return new_idx > old_idx


# ── Sub-skill: CRM Webhook ────────────────────────────────────────────────────

class CRMWebhookSkill:
    """
    Pushes lead score and stage updates to CRM via REST webhook.
    Supports HubSpot, Pipedrive, Salesforce via env-configured URL.
    """

    @staticmethod
    def push(contact_id: str, score: float, stage: str, signals: list[str]) -> dict:
        webhook_url = os.getenv("CRM_WEBHOOK_URL")
        if not webhook_url:
            agent_log("LEAD_SCORING", "No CRM_WEBHOOK_URL set — skipping CRM push")
            return {"pushed": False, "reason": "no CRM webhook configured"}

        payload = json.dumps({
            "contact_id":      contact_id,
            "workspace_id":    WORKSPACE,
            "lead_score":      score,
            "lifecycle_stage": stage,
            "top_signals":     signals[:3],
            "updated_at":      datetime.now(timezone.utc).isoformat(),
        }).encode("utf-8")

        try:
            req = urllib.request.Request(
                webhook_url,
                data=payload,
                headers={
                    "Content-Type":  "application/json",
                    "Authorization": f"Bearer {os.getenv('CRM_API_KEY', '')}",
                },
            )
            with urllib.request.urlopen(req, timeout=5) as resp:
                status = resp.getcode()
            return {"pushed": True, "status": status}
        except Exception as e:
            agent_log("LEAD_SCORING", f"CRM webhook failed: {e}")
            return {"pushed": False, "error": str(e)}


# ── DB Helpers ────────────────────────────────────────────────────────────────

def _load_contact_score(contact_id: str) -> dict:
    if not PG_AVAILABLE:
        return {"score": 0.0, "stage": "subscriber", "last_activity_days": 0}
    try:
        conn = psycopg2.connect(PG_DSN)
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT score, lifecycle_stage,
                       EXTRACT(DAY FROM NOW() - last_activity_at)::int AS last_activity_days
                FROM contact_scores
                WHERE contact_id = %s AND workspace_id = %s
            """, (contact_id, WORKSPACE))
            row = cur.fetchone()
        conn.close()
        return dict(row) if row else {"score": 0.0, "stage": "subscriber", "last_activity_days": 0}
    except Exception as e:
        agent_log("LEAD_SCORING", f"Score load failed: {e}")
        return {"score": 0.0, "stage": "subscriber", "last_activity_days": 0}


def _save_contact_score(contact_id: str, score: float, stage: str) -> None:
    if not PG_AVAILABLE:
        return
    try:
        conn = psycopg2.connect(PG_DSN)
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO contact_scores (contact_id, workspace_id, score, lifecycle_stage, last_activity_at)
                VALUES (%s, %s, %s, %s, NOW())
                ON CONFLICT (contact_id, workspace_id) DO UPDATE
                SET score = EXCLUDED.score,
                    lifecycle_stage = EXCLUDED.stage,
                    last_activity_at = NOW()
            """, (contact_id, WORKSPACE, score, stage))
        conn.commit()
        conn.close()
    except Exception as e:
        agent_log("LEAD_SCORING", f"Score save failed: {e}")


# ── Core Scoring Function (used by both pipeline + daemon) ────────────────────

def score_engagement_event(
    contact_id:   str,
    event_type:   str,
    url:          Optional[str] = None,
    weights:      Optional[dict] = None,
) -> dict:
    """
    Score a single engagement event and update the contact's cumulative score.
    Returns the updated LeadScore result dict.
    """
    weights = weights or DEFAULT_WEIGHTS

    # Resolve event weight
    effective_type = event_type
    if event_type == "page_visit" and url and "pricing" in url.lower():
        effective_type = "pricing_page"

    delta = weights.get(effective_type, weights.get(event_type, 0.0))

    # Load existing score + apply decay
    existing     = _load_contact_score(contact_id)
    base_score   = safe_float(existing.get("score"), 0.0)
    old_stage    = existing.get("stage", "subscriber")
    days_inactive = safe_int(existing.get("last_activity_days"), 0)

    decayed_base = ScoreDecaySkill.apply(base_score, days_inactive)
    new_score    = max(0.0, decayed_base + delta)

    new_stage      = StageMachineSkill.resolve_stage(new_score)
    stage_changed  = StageMachineSkill.stage_changed(old_stage, new_stage)

    _save_contact_score(contact_id, new_score, new_stage)

    # CRM push
    crm_result = CRMWebhookSkill.push(
        contact_id, new_score, new_stage,
        [f"{event_type} event scored +{delta:.0f} pts"],
    )

    # Escalate to Supervisor if MQL/SQL threshold just crossed
    escalate = stage_changed and new_stage in ("mql", "sql")
    if escalate:
        publish_event(
            topic=Topics.SUPERVISOR_TASKS,
            source_agent="lead_scoring_agent",
            payload={
                "event_type":  "stage_transition",
                "contact_id":  contact_id,
                "from_stage":  old_stage,
                "to_stage":    new_stage,
                "score":       new_score,
                "action":      "evaluate_nurture_sequence",
            },
            priority="HIGH",
        )

    return {
        "contact_id":       contact_id,
        "event_type":       event_type,
        "score_delta":      delta,
        "previous_score":   decayed_base,
        "new_score":        new_score,
        "previous_stage":   old_stage,
        "lifecycle_stage":  new_stage,
        "stage_changed":    stage_changed,
        "crm_updated":      crm_result.get("pushed", False),
        "escalate":         escalate,
        "scored_at":        datetime.now(timezone.utc).isoformat(),
    }


# ── System Prompt ─────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are the Lead Scoring Agent for MarketOS.

You receive a batch of engagement scores from one campaign send and produce:
1. A summary of the lead quality distribution across the contact list
2. The top behavioural signals observed
3. Recommended next action for each lifecycle segment

OUTPUT RULES: Valid JSON only.

SCHEMA:
{
  "total_contacts_scored": 450,
  "stage_distribution": {"subscriber": 320, "mql": 110, "sql": 20},
  "new_mqls": 15,
  "new_sqls": 3,
  "top_signals": ["pricing page visits", "3+ clicks in 24h"],
  "recommended_actions": {
    "mql": "Trigger 3-email nurture sequence via Email Agent",
    "sql": "Escalate to sales team CRM immediately",
    "subscriber": "Continue drip sequence — no action needed"
  },
  "revenue_potential_estimate": "₹45,000 (assuming ₹15,000 avg deal size for 3 SQLs)"
}"""


# ── Agent Node ────────────────────────────────────────────────────────────────

def lead_scoring_agent_node(state: dict) -> dict:
    step_banner("LEAD SCORING AGENT  ─  Engagement Scoring & CRM Attribution")

    plan_data    = state.get("campaign_plan") or {}
    analytics    = state.get("analytics_result") or {}
    campaign_id  = plan_data.get("campaign_id", "UNKNOWN")
    metrics      = analytics.get("metrics", {})

    agent_log("LEAD_SCORING", f"Campaign: {campaign_id}")

    # ── Score contacts from real analytics events ──────────────────────────
    total_opens  = safe_int(metrics.get("opens"), 0)
    total_clicks = safe_int(metrics.get("clicks"), 0)
    scored_contacts = []
    stage_counts    = {"subscriber": 0, "mql": 0, "sql": 0, "opportunity": 0, "customer": 0}
    new_mqls = 0
    new_sqls = 0

    # In pipeline mode: score engagement events from send_result contact list
    contact_list = state.get("contact_list") or []

    if not contact_list and (total_opens > 0 or total_clicks > 0):
        # No explicit contact list but analytics has events — score based on metrics
        agent_log("LEAD_SCORING", "No contact list — scoring aggregate metrics via LLM only")
    elif contact_list:
        for contact in contact_list[:200]:  # cap at 200 for pipeline latency
            cid = contact.get("contact_id", contact.get("email", "unknown"))
            et  = contact.get("event_type", "email_open")
            result = score_engagement_event(cid, et)
            stage  = result["lifecycle_stage"]
            stage_counts[stage] = stage_counts.get(stage, 0) + 1
            if result["stage_changed"] and stage == "mql":
                new_mqls += 1
            if result["stage_changed"] and stage == "sql":
                new_sqls += 1
            scored_contacts.append(result)
    else:
        agent_log("LEAD_SCORING", "No contact events to score — returning zero baseline")

    agent_log("LEAD_SCORING", f"Scored {len(scored_contacts)} contacts")
    agent_log("LEAD_SCORING", f"New MQLs: {new_mqls}  |  New SQLs: {new_sqls}")

    # ── LLM batch summary ─────────────────────────────────────────────────
    llm = get_llm(temperature=0)
    messages = [
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=f"""
CAMPAIGN: {plan_data.get('campaign_name', 'Unknown')}
CONTACTS SCORED: {len(scored_contacts)}
STAGE DISTRIBUTION: {stage_counts}
NEW MQLS: {new_mqls}  |  NEW SQLS: {new_sqls}
CAMPAIGN METRICS: opens={total_opens}, clicks={total_clicks}
"""),
    ]
    response = llm.invoke(messages)
    try:
        summary = extract_json(response.content.strip())
    except ValueError:
        summary = {
            "total_contacts_scored": len(scored_contacts),
            "stage_distribution":    stage_counts,
            "new_mqls":              new_mqls,
            "new_sqls":              new_sqls,
        }

    # ── Terminal output ───────────────────────────────────────────────────
    divider()
    section("SCORING SUMMARY")
    kv("Contacts Scored",  f"{len(scored_contacts):,}")
    kv("Stage Distribution", "  ".join(f"{k}: {v}" for k, v in stage_counts.items() if v > 0))
    kv("New MQLs",         str(new_mqls))
    kv("New SQLs",         str(new_sqls))

    if summary.get("top_signals"):
        section("TOP BEHAVIOUR SIGNALS")
        for sig in summary["top_signals"]:
            print(f"  →  {sig}")

    if summary.get("recommended_actions"):
        section("RECOMMENDED ACTIONS")
        for stage, action in summary["recommended_actions"].items():
            print(f"  [{stage.upper():>12}]  {action}")

    if summary.get("revenue_potential_estimate"):
        kv("\n  Revenue Potential", summary["revenue_potential_estimate"])

    divider()

    return {
        **state,
        "lead_scoring_result": {
            "campaign_id":        campaign_id,
            "contacts_scored":    len(scored_contacts),
            "stage_distribution": stage_counts,
            "new_mqls":           new_mqls,
            "new_sqls":           new_sqls,
            "summary":            summary,
            "scored_at":          datetime.now(timezone.utc).isoformat(),
        },
        "current_step": "complete",
        "trace": state.get("trace", []) + [{
            "agent":           "lead_scoring_agent",
            "status":          "completed",
            "contacts_scored": len(scored_contacts),
            "new_mqls":        new_mqls,
            "new_sqls":        new_sqls,
            "timestamp":       datetime.now(timezone.utc).isoformat(),
        }],
    }
