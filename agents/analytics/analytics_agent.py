"""
MarketOS — Analytics Agent
PRD SLA: 5-minute polling + anomaly threshold breach triggers.
PRD Tools: ClickHouse, GA4, ad platform APIs.

Responsibilities:
- Polls ClickHouse every 5 minutes for metric snapshots across all live campaigns
- Detects anomalies (open rate collapse, bounce spike, spam surge)
- Publishes metric snapshots to system.metrics Kafka topic
- Publishes anomaly alerts to system.alerts Kafka topic
- Feeds the Monitor Agent with structured metric payloads

In LangGraph pipeline: runs as a post-send node after email_agent.
In production: also runs as a standalone daemon (APScheduler every 5 min).
"""

from __future__ import annotations

import os
import time
import uuid
from datetime import datetime, timezone
from typing import Optional

from langchain_core.messages import SystemMessage, HumanMessage

from agents.llm.llm_provider import get_llm
from utils.kafka_bus import publish_event, Topics
from utils.logger import agent_log, step_banner, kv, section, divider
from utils.json_utils import extract_json, safe_float, safe_int
from core.agent_base import AgentBase

ANALYTICSAGENT_SKILLS = [
    "analytics-tracking","revops","ab-test-setup"
]

class AnalyticsAgent(AgentBase):
    def __init__(self):
        super().__init__("Analytics Agent", ANALYTICSAGENT_SKILLS)


# ── ClickHouse client (optional) ─────────────────────────────────────────────
try:
    from clickhouse_driver import Client as ClickHouseClient
    CH_AVAILABLE = True
except ImportError:
    CH_AVAILABLE = False
    agent_log("ANALYTICS", "clickhouse-driver not installed — using simulated metrics")

CH_HOST     = os.getenv("CLICKHOUSE_HOST",     "localhost")
CH_PORT     = int(os.getenv("CLICKHOUSE_PORT", "9000"))
CH_DB       = os.getenv("CLICKHOUSE_DB",       "marketos_analytics")
CH_USER     = os.getenv("CLICKHOUSE_USER",     "marketos")
CH_PASSWORD = os.getenv("CLICKHOUSE_PASSWORD", "marketos_dev")


# ── ClickHouse Queries ───────────────────────────────────────────────────────

def _get_ch_client() -> Optional[object]:
    if not CH_AVAILABLE:
        return None
    try:
        return ClickHouseClient(
            host=CH_HOST, port=CH_PORT,
            database=CH_DB, user=CH_USER, password=CH_PASSWORD,
            connect_timeout=5,
        )
    except Exception as e:
        agent_log("ANALYTICS", f"ClickHouse connection failed: {e}")
        return None


def _query_campaign_metrics(client, campaign_id: str) -> dict:
    """Pull real-time event counts from ClickHouse for a given campaign."""
    try:
        query = """
        SELECT
            countIf(event_type = 'send')           AS total_sent,
            countIf(event_type = 'deliver')        AS delivered,
            countIf(event_type = 'open')           AS opens,
            countIf(event_type = 'click')          AS clicks,
            countIf(event_type = 'bounce_soft')    AS bounces_soft,
            countIf(event_type = 'bounce_hard')    AS bounces_hard,
            countIf(event_type = 'unsubscribe')    AS unsubscribes,
            countIf(event_type = 'spam_complaint') AS spam_complaints
        FROM email_events_local
        WHERE campaign_id = %(campaign_id)s
        """
        rows = client.execute(query, {"campaign_id": campaign_id})
        if not rows:
            return {}

        r = rows[0]
        total_sent   = r[0] or 1
        delivered    = r[1] or 0
        opens        = r[2] or 0
        clicks       = r[3] or 0
        spam         = r[7] or 0

        return {
            "total_sent":       total_sent,
            "delivered":        delivered,
            "opens":            opens,
            "clicks":           clicks,
            "bounces_soft":     r[4] or 0,
            "bounces_hard":     r[5] or 0,
            "unsubscribes":     r[6] or 0,
            "spam_complaints":  spam,
            "open_rate":        round(opens / max(delivered, 1), 4),
            "ctr":              round(clicks / max(delivered, 1), 4),
            "bounce_rate":      round((r[5] or 0) / max(total_sent, 1), 4),
            "spam_rate":        round(spam / max(delivered, 1), 4),
            "delivery_rate":    round(delivered / max(total_sent, 1), 4),
        }
    except Exception as e:
        agent_log("ANALYTICS", f"ClickHouse query failed: {e}")
        return {}


# ── Anomaly Detection ────────────────────────────────────────────────────────

ANOMALY_THRESHOLDS = {
    "spam_rate":     ("gt", 0.005, "CRITICAL"),   # > 0.5% → pause campaign immediately
    "bounce_rate":   ("gt", 0.020, "WARNING"),    # > 2% hard bounce
    "open_rate":     ("lt", 0.100, "INFO"),        # < 10% open rate
    "delivery_rate": ("lt", 0.950, "WARNING"),    # < 95% delivery
}


def _detect_anomalies(metrics: dict, campaign_id: str) -> list[dict]:
    anomalies = []
    for metric, (condition, threshold, severity) in ANOMALY_THRESHOLDS.items():
        value = metrics.get(metric)
        if value is None:
            continue
        triggered = (
            (condition == "gt" and value > threshold) or
            (condition == "lt" and value < threshold and value > 0)
        )
        if triggered:
            anomalies.append({
                "anomaly_id":   f"ANO-{str(uuid.uuid4())[:8].upper()}",
                "campaign_id":  campaign_id,
                "metric":       metric,
                "value":        value,
                "threshold":    threshold,
                "condition":    condition,
                "severity":     severity,
                "detected_at":  datetime.now(timezone.utc).isoformat(),
            })
    return anomalies


ZERO_METRICS = {
    "total_sent": 0, "delivered": 0, "opens": 0, "clicks": 0,
    "bounces_soft": 0, "bounces_hard": 0, "unsubscribes": 0,
    "spam_complaints": 0, "open_rate": 0.0, "ctr": 0.0,
    "bounce_rate": 0.0, "spam_rate": 0.0, "delivery_rate": 0.0,
}


# ── LLM Prompt (for insight generation) ─────────────────────────────────────

ANALYTICSAGENT_EXPERTISE = """You are the Analytics Agent for MarketOS.

You receive real-time campaign metrics and produce a structured analysis.

Your job:
1. Interpret the metrics vs industry benchmarks
2. Identify the most important insight (positive or negative)
3. Flag any anomalies with their likely cause
4. Recommend ONE specific action the Email Agent or Supervisor should take

Email industry benchmarks (India D2C):
- Open rate: 20-35% is good, >35% is excellent, <15% is poor
- CTR: 2-5% is good, >5% is excellent, <1% is poor
- Hard bounce: <2% is acceptable, >5% is alarming
- Spam complaint: <0.1% is safe, >0.5% triggers blacklisting

OUTPUT RULES:
- Respond ONLY with valid JSON
- No markdown, no prose

REQUIRED JSON SCHEMA:
{
  "overall_health": "excellent|good|warning|critical",
  "top_insight": "single sentence — the most important thing to know right now",
  "anomalies_detected": true,
  "recommended_action": "specific action: e.g. pause campaign, resend to non-openers, etc.",
  "benchmark_comparison": {
    "open_rate_vs_benchmark": "above|at|below",
    "ctr_vs_benchmark": "above|at|below",
    "spam_vs_benchmark": "safe|warning|critical"
  }
}"""


# ── Agent Node ────────────────────────────────────────────────────────────────

def analytics_agent_node(state: dict) -> dict:
    step_banner("ANALYTICS AGENT  ─  Campaign Performance Analysis")

    plan_data    = state.get("campaign_plan") or {}
    send_data    = state.get("send_result") or {}
    campaign_id  = plan_data.get("campaign_id", "UNKNOWN")
    campaign_name = plan_data.get("campaign_name", "Unknown Campaign")

    agent_log("ANALYTICS", f"Campaign: {campaign_id} — {campaign_name}")
    agent_log("ANALYTICS", "Pulling metrics from ClickHouse...")

    # ── Pull real metrics from ClickHouse ──────────────────────────────────
    ch_client = _get_ch_client()
    if ch_client:
        metrics = _query_campaign_metrics(ch_client, campaign_id)
        if metrics:
            agent_log("ANALYTICS", "Real ClickHouse data retrieved")
        else:
            metrics = dict(ZERO_METRICS)
            agent_log("ANALYTICS", "No ClickHouse data for this campaign — using zero baseline")
    else:
        metrics = dict(ZERO_METRICS)
        agent_log("ANALYTICS", "ClickHouse not available — using zero baseline")

    # ── Anomaly detection ─────────────────────────────────────────────────
    anomalies = _detect_anomalies(metrics, campaign_id)

    # ── LLM insight ──────────────────────────────────────────────────────
    llm = get_llm(temperature=0)
    metrics_context = f"""
CAMPAIGN: {campaign_name} ({campaign_id})
REAL-TIME METRICS:
- Total Sent:        {metrics.get('total_sent', 0):,}
- Delivered:         {metrics.get('delivered', 0):,} ({metrics.get('delivery_rate', 0)*100:.1f}%)
- Opens:             {metrics.get('opens', 0):,} ({metrics.get('open_rate', 0)*100:.1f}%)
- Clicks:            {metrics.get('clicks', 0):,} ({metrics.get('ctr', 0)*100:.2f}% CTR)
- Hard Bounces:      {metrics.get('bounces_hard', 0):,} ({metrics.get('bounce_rate', 0)*100:.2f}%)
- Spam Complaints:   {metrics.get('spam_complaints', 0):,} ({metrics.get('spam_rate', 0)*100:.4f}%)
- Unsubscribes:      {metrics.get('unsubscribes', 0):,}
ANOMALIES DETECTED: {len(anomalies)} ({', '.join(a['metric'] for a in anomalies) or 'none'})
"""
    agent = AnalyticsAgent()

    messages = [SystemMessage(content=agent.build_prompt(ANALYTICSAGENT_EXPERTISE)), HumanMessage(content=metrics_context)]
    response = llm.invoke(messages)

    try:
        insight = extract_json(response.content.strip())
    except ValueError:
        insight = {
            "overall_health": "good",
            "top_insight": "Metrics within normal range",
            "anomalies_detected": len(anomalies) > 0,
            "recommended_action": "Continue monitoring",
        }

    # ── Publish to Kafka ─────────────────────────────────────────────────
    snapshot_id = f"SNAP-{str(uuid.uuid4())[:8].upper()}"

    publish_event(
        topic=Topics.SYSTEM_METRICS,
        source_agent="analytics_agent",
        payload={
            "snapshot_id": snapshot_id,
            "campaign_id": campaign_id,
            "metrics":     metrics,
            "insight":     insight,
            "timestamp":   datetime.now(timezone.utc).isoformat(),
        },
    )

    if anomalies:
        for anomaly in anomalies:
            publish_event(
                topic=Topics.SYSTEM_ALERTS,
                source_agent="analytics_agent",
                payload=anomaly,
                priority="HIGH" if anomaly["severity"] == "CRITICAL" else "NORMAL",
            )
        agent_log("ANALYTICS", f"Published {len(anomalies)} anomaly alert(s) to system.alerts")

    # ── Terminal output ───────────────────────────────────────────────────
    agent_log("ANALYTICS", f"Snapshot: {snapshot_id}")
    divider()

    section("REAL-TIME METRICS")
    kv("Total Sent",       f"{metrics.get('total_sent', 0):,}")
    kv("Delivered",        f"{metrics.get('delivered', 0):,}  ({metrics.get('delivery_rate', 0)*100:.1f}%)")
    kv("Opens",            f"{metrics.get('opens', 0):,}  ({metrics.get('open_rate', 0)*100:.1f}%)")
    kv("Clicks",           f"{metrics.get('clicks', 0):,}  ({metrics.get('ctr', 0)*100:.2f}% CTR)")
    kv("Spam Complaints",  f"{metrics.get('spam_complaints', 0):,}  ({metrics.get('spam_rate', 0)*100:.4f}%)")

    section("AI INSIGHT")
    kv("Overall Health",   insight.get("overall_health", "unknown").upper())
    print(f"\n  {insight.get('top_insight', '')}")
    print(f"\n  Recommended: {insight.get('recommended_action', '')}")

    if anomalies:
        section("ANOMALIES DETECTED")
        for a in anomalies:
            print(f"  [{a['severity']}]  {a['metric']} = {a['value']:.4f}  (threshold: {a['threshold']:.4f})")

    divider()

    return {
        **state,
        "analytics_result": {
            "snapshot_id": snapshot_id,
            "metrics":     metrics,
            "anomalies":   anomalies,
            "insight":     insight,
            "timestamp":   datetime.now(timezone.utc).isoformat(),
        },
        "current_step": "complete",
        "trace": state.get("trace", []) + [{
            "agent":       "analytics_agent",
            "status":      "completed",
            "snapshot_id": snapshot_id,
            "anomalies":   len(anomalies),
            "timestamp":   datetime.now(timezone.utc).isoformat(),
        }],
    }
