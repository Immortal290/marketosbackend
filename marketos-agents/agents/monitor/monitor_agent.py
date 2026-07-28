"""
MarketOS — Monitor Agent
PRD: "The heartbeat of the 24/7 promise."
PRD SLA: < 30s from breach detection to action.

This agent has two operating modes:
1. PIPELINE mode — called after analytics_agent in the LangGraph pipeline
                   to evaluate that campaign's anomalies immediately
2. DAEMON mode  — runs as an independent consumer of system.alerts Kafka topic
                   evaluating ALL campaigns continuously (run via: python -m agents.monitor_daemon)

Escalation tiers (PRD §5.1):
  Tier 1 (INFO)    → Slack/email notification, next report
  Tier 2 (WARNING) → Slack + email immediately, < 5 minutes
  Tier 3 (CRITICAL)→ Auto-remediation + PagerDuty + Supervisor, < 30 seconds

Auto-remediation playbooks (PRD §5.2):
  SPAM_RATE_HIGH   → Pause campaign domain, switch to backup, audit contacts
  SMS_FAILURE      → Failover provider (Twilio → Vonage → SNS)
  BUDGET_OVERPACE  → Cap spend via Ads API, notify user
"""

from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone
from typing import Optional

from langchain_core.messages import SystemMessage, HumanMessage

from agents.llm.llm_provider import get_llm
from utils.kafka_bus import publish_event, Topics
from utils.logger import agent_log, step_banner, kv, section, divider, check_line
from utils.json_utils import extract_json, safe_float
from core.agent_base import AgentBase

MONITORAGENT_SKILLS = [
    "analytics-tracking","revops"
]

class MonitorAgent(AgentBase):
    def __init__(self):
        super().__init__("Monitor Agent", MONITORAGENT_SKILLS)


try:
    import psycopg2
    import psycopg2.extras
    PG_AVAILABLE = True
except ImportError:
    PG_AVAILABLE = False

PG_DSN = os.getenv("DATABASE_URL", "postgresql://marketos:marketos_dev@localhost:5433/marketos")

# ── Alert Rule Engine ─────────────────────────────────────────────────────────

def _load_alert_rules() -> list[dict]:
    """Load active alert rules from PostgreSQL (seeded by init_postgres.sql)."""
    if not PG_AVAILABLE:
        return [
            {"rule_id": "SPAM_RATE_HIGH",   "metric": "spam_rate",      "condition": "gt", "threshold": 0.005, "severity": "CRITICAL", "tier": 3},
            {"rule_id": "BOUNCE_RATE_HIGH",  "metric": "bounce_rate",    "condition": "gt", "threshold": 0.020, "severity": "WARNING",  "tier": 2},
            {"rule_id": "OPEN_RATE_LOW",     "metric": "open_rate",      "condition": "lt", "threshold": 0.100, "severity": "INFO",     "tier": 1},
            {"rule_id": "DELIVERY_RATE_LOW", "metric": "delivery_rate",  "condition": "lt", "threshold": 0.950, "severity": "WARNING",  "tier": 2},
            {"rule_id": "BUDGET_OVERPACE",   "metric": "spend_vs_budget_pct", "condition": "gt", "threshold": 1.10, "severity": "CRITICAL", "tier": 3},
        ]
    try:
        conn = psycopg2.connect(PG_DSN)
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT * FROM alert_rules WHERE active = TRUE ORDER BY tier DESC")
            rules = [dict(r) for r in cur.fetchall()]
        conn.close()
        return rules
    except Exception as e:
        agent_log("MONITOR", f"DB unavailable ({e}) — using hardcoded rules")
        return [
            {"rule_id": "SPAM_RATE_HIGH",   "metric": "spam_rate",      "condition": "gt", "threshold": 0.005, "severity": "CRITICAL", "tier": 3},
            {"rule_id": "BOUNCE_RATE_HIGH",  "metric": "bounce_rate",    "condition": "gt", "threshold": 0.020, "severity": "WARNING",  "tier": 2},
            {"rule_id": "OPEN_RATE_LOW",     "metric": "open_rate",      "condition": "lt", "threshold": 0.100, "severity": "INFO",     "tier": 1},
            {"rule_id": "DELIVERY_RATE_LOW", "metric": "delivery_rate",  "condition": "lt", "threshold": 0.950, "severity": "WARNING",  "tier": 2},
            {"rule_id": "BUDGET_OVERPACE",   "metric": "spend_vs_budget_pct", "condition": "gt", "threshold": 1.10, "severity": "CRITICAL", "tier": 3},
        ]


def _evaluate_rules(metrics: dict, rules: list[dict]) -> list[dict]:
    """Evaluate all alert rules against current metrics. Return triggered rules."""
    triggered = []
    for rule in rules:
        metric = rule["metric"]
        value  = metrics.get(metric)
        if value is None:
            continue
        cond = rule["condition"]
        thr  = float(rule["threshold"])
        fired = (cond == "gt" and value > thr) or (cond == "lt" and value < thr and value > 0)
        if fired:
            triggered.append({**rule, "observed_value": value})
    return triggered


# ── Auto-Remediation Playbooks ────────────────────────────────────────────────

def _execute_remediation(rule_id: str, campaign_id: str, context: dict) -> dict:
    """
    Execute the auto-remediation playbook for a CRITICAL alert.
    PRD §5.2 playbooks.
    """
    playbooks = {
        "SPAM_RATE_HIGH": {
            "actions": [
                "Pause all sends from the affected campaign",
                "Switch remaining sends to backup sending domain/IP pool",
                "Notify Compliance Agent to audit recent send list",
                "Page on-call engineer via PagerDuty",
                "Generate incident report via Reporting Agent",
            ],
            "kafka_topic":  Topics.CAMPAIGN_EVENTS,
            "event_type":   "campaign_paused",
            "notify_slack": True,
            "notify_pagerduty": True,
        },
        "BUDGET_OVERPACE": {
            "actions": [
                "Fire budget cap signal to ad platform API",
                "Hold pending ad creative submissions (notify Supervisor)",
                "Notify user with budget status and approval option",
                "Reinstate budget automatically at midnight",
            ],
            "kafka_topic":  Topics.CAMPAIGN_EVENTS,
            "event_type":   "budget_capped",
            "notify_slack": True,
            "notify_pagerduty": False,
        },
        "SMS_DELIVERY_LOW": {
            "actions": [
                "Failover to secondary SMS provider (Twilio → Vonage → AWS SNS)",
                "Re-queue undelivered messages on new provider",
                "Finance Agent updates cost attribution",
                "Send alert with failover confirmation",
            ],
            "kafka_topic":  Topics.SYSTEM_ALERTS,
            "event_type":   "sms_provider_failover",
            "notify_slack": True,
            "notify_pagerduty": True,
        },
    }

    playbook = playbooks.get(rule_id)
    if not playbook:
        return {"executed": False, "reason": f"No playbook for rule {rule_id}"}

    # Publish remediation event to Kafka
    publish_event(
        topic=playbook["kafka_topic"],
        source_agent="monitor_agent",
        payload={
            "campaign_id":  campaign_id,
            "event_type":   playbook["event_type"],
            "rule_id":      rule_id,
            "actions":      playbook["actions"],
            "timestamp":    datetime.now(timezone.utc).isoformat(),
        },
        priority="CRITICAL",
    )

    return {
        "executed":   True,
        "rule_id":    rule_id,
        "playbook":   playbook["event_type"],
        "actions":    playbook["actions"],
        "notified": {
            "slack":      playbook.get("notify_slack", False),
            "pagerduty":  playbook.get("notify_pagerduty", False),
        },
    }


# ── System Prompt ─────────────────────────────────────────────────────────────

MONITORAGENT_EXPERTISE = """You are the Monitor Agent for MarketOS — the 24/7 system health watchdog.

ROLE:
You receive triggered alert rules and produce a prioritised incident response plan.

ESCALATION TIERS (PRD §5.1):
- INFO    (tier 1): Highlight on dashboard + include in next daily digest
- WARNING (tier 2): Slack + email notification immediately (< 5 min SLA)
- CRITICAL (tier 3): Auto-remediation + PagerDuty page + Supervisor escalation (< 30s SLA)

YOUR OUTPUT:
For each triggered rule, assess:
1. Root cause hypothesis (most likely explanation)
2. Immediate risk to campaign and brand reputation
3. Whether auto-remediation is sufficient or human judgment is required
4. Recommended next monitoring check (what to watch next)

OUTPUT RULES:
- Respond ONLY with valid JSON
- No prose, no markdown

REQUIRED JSON SCHEMA:
{
  "system_health": "green|yellow|red",
  "incidents": [
    {
      "rule_id": "SPAM_RATE_HIGH",
      "severity": "CRITICAL",
      "root_cause_hypothesis": "recent list included cold contacts without opt-in",
      "immediate_risk": "domain blacklisting within 24 hours if unchecked",
      "requires_human": true,
      "auto_remediation_sufficient": false,
      "next_check": "monitor spam rate every 60 seconds for next 2 hours"
    }
  ],
  "executive_summary": "one sentence summary of overall system state",
  "escalation_message": "message to send to Slack/PagerDuty"
}"""


# ── Agent Node ────────────────────────────────────────────────────────────────

def monitor_agent_node(state: dict) -> dict:
    step_banner("MONITOR AGENT  ─  System Health & Auto-Remediation")

    analytics = state.get("analytics_result") or {}
    plan_data  = state.get("campaign_plan") or {}
    campaign_id = plan_data.get("campaign_id", "UNKNOWN")

    metrics    = analytics.get("metrics", {})
    anomalies  = analytics.get("anomalies", [])

    agent_log("MONITOR", f"Campaign: {campaign_id}")
    agent_log("MONITOR", f"Incoming anomalies: {len(anomalies)}")

    # ── Load alert rules and evaluate ────────────────────────────────────
    rules    = _load_alert_rules()
    triggered = _evaluate_rules(metrics, rules)

    agent_log("MONITOR", f"Alert rules checked: {len(rules)}  |  Triggered: {len(triggered)}")

    # ── LLM incident analysis ─────────────────────────────────────────────
    has_incidents = len(triggered) > 0

    if has_incidents:
        alert_context = "\n".join([
            f"- [{r['severity']}] {r['rule_id']}: {r['metric']} = {r['observed_value']:.4f} (threshold: {r['threshold']})"
            for r in triggered
        ])
        agent = MonitorAgent()

        messages = [
            SystemMessage(content=agent.build_prompt(MONITORAGENT_EXPERTISE)),
            HumanMessage(content=f"TRIGGERED ALERTS for campaign {campaign_id}:\n{alert_context}"),
        ]
        llm = get_llm(temperature=0)
        response = llm.invoke(messages)
        try:
            analysis = extract_json(response.content.strip())
        except ValueError:
            analysis = {
                "system_health": "yellow",
                "incidents": [],
                "executive_summary": f"{len(triggered)} alert(s) triggered, manual review recommended",
                "escalation_message": f"MarketOS ALERT: {len(triggered)} rule(s) triggered for campaign {campaign_id}",
            }
    else:
        analysis = {
            "system_health": "green",
            "incidents": [],
            "executive_summary": "All metrics within normal thresholds. No action required.",
            "escalation_message": None,
        }

    # ── Execute auto-remediation for CRITICAL rules ────────────────────
    remediations = []
    for rule in triggered:
        if rule.get("severity") == "CRITICAL" and rule.get("tier", 0) >= 3:
            result = _execute_remediation(rule["rule_id"], campaign_id, metrics)
            if result.get("executed"):
                remediations.append(result)
                agent_log("MONITOR", f"Auto-remediation executed: {rule['rule_id']}")

    # ── Store incident in PostgreSQL ──────────────────────────────────────
    incident_id = f"INC-{str(uuid.uuid4())[:8].upper()}"
    if PG_AVAILABLE:
        try:
            conn = psycopg2.connect(PG_DSN)
            with conn.cursor() as cur:
                for rule in triggered:
                    cur.execute("""
                        INSERT INTO monitor_incidents
                            (incident_id, campaign_id, rule_id, severity, metric,
                             observed_value, threshold, status, remediation)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """, (
                        f"{incident_id}-{rule['rule_id']}", campaign_id,
                        rule["rule_id"], rule["severity"], rule["metric"],
                        rule["observed_value"], rule["threshold"],
                        "auto_remediated" if any(r["rule_id"] == rule["rule_id"] for r in remediations) else "open",
                        analysis.get("executive_summary"),
                    ))
            conn.commit()
            conn.close()
        except Exception as e:
            agent_log("MONITOR", f"Incident DB write failed: {e}")

    # ── Terminal output ───────────────────────────────────────────────────
    health = analysis.get("system_health", "unknown")
    health_icon = {"green": "✅", "yellow": "⚠", "red": "🔴"}.get(health, "?")
    agent_log("MONITOR", f"{health_icon} System health: {health.upper()}")
    divider()

    section("ALERT RULE EVALUATION")
    for rule in rules:
        triggered_rule = next((t for t in triggered if t["rule_id"] == rule["rule_id"]), None)
        check_line(
            f"{rule['rule_id']:<25} [{rule['severity']}]",
            triggered_rule is None,
            f"observed: {triggered_rule['observed_value']:.4f}  threshold: {rule['threshold']}" if triggered_rule else "within threshold",
        )

    section("EXECUTIVE SUMMARY")
    print(f"\n  {analysis.get('executive_summary', '')}")

    if analysis.get("incidents"):
        section("INCIDENT ANALYSIS")
        for inc in analysis["incidents"]:
            print(f"\n  [{inc.get('severity')}] {inc.get('rule_id')}")
            print(f"    Root cause: {inc.get('root_cause_hypothesis', '')}")
            print(f"    Risk: {inc.get('immediate_risk', '')}")
            print(f"    Requires human: {inc.get('requires_human', False)}")

    if remediations:
        section("AUTO-REMEDIATION EXECUTED")
        for r in remediations:
            print(f"\n  Playbook: {r['playbook']}")
            for action in r.get("actions", [])[:3]:
                print(f"    → {action}")

    if analysis.get("escalation_message"):
        section("ESCALATION")
        kv("Slack/PagerDuty", analysis["escalation_message"])

    divider()

    return {
        **state,
        "monitor_result": {
            "incident_id":   incident_id,
            "system_health": health,
            "triggered":     triggered,
            "analysis":      analysis,
            "remediations":  remediations,
            "timestamp":     datetime.now(timezone.utc).isoformat(),
        },
        "current_step": "complete",
        "trace": state.get("trace", []) + [{
            "agent":        "monitor_agent",
            "status":       "completed",
            "health":       health,
            "alerts_fired": len(triggered),
            "remediations": len(remediations),
            "timestamp":    datetime.now(timezone.utc).isoformat(),
        }],
    }
