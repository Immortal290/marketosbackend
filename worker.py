"""
MarketOS — Background Worker
Consumes campaign intents from Kafka and executes the full LangGraph pipeline.

Architecture (PRD §3.3):
  API → Kafka topic [agent.supervisor.tasks] → Worker → LangGraph pipeline
  Worker publishes completion event to [campaign.events]

Run: python worker.py
"""

from __future__ import annotations

import os
import sys
import signal
import time
from datetime import datetime, timezone

from dotenv import load_dotenv
load_dotenv()

from utils.logger import agent_log, divider
from utils.kafka_bus import KafkaConsumer, publish_event, Topics, get_producer

# ── Graceful shutdown ─────────────────────────────────────────────────────────

_running = True


def _shutdown_handler(signum, frame):
    global _running
    agent_log("WORKER", "Shutdown signal received — finishing current task...")
    _running = False


signal.signal(signal.SIGINT, _shutdown_handler)
signal.signal(signal.SIGTERM, _shutdown_handler)


# ── Campaign Status Tracking ─────────────────────────────────────────────────

try:
    from core.database import SessionLocal
    from models.campaign import Campaign
    PG_AVAILABLE = True
except Exception:
    PG_AVAILABLE = False


def _update_campaign_status(campaign_id: str, status: str, result: dict = None) -> None:
    """Update campaign status in PostgreSQL."""
    if not PG_AVAILABLE:
        return
    db = None
    try:
        db = SessionLocal()
        campaign = db.query(Campaign).filter(Campaign.campaign_id == campaign_id).first()
        if campaign:
            campaign.status = status
            campaign.result_data = result if result else None
            campaign.updated_at = datetime.now(timezone.utc)
        else:
            db.add(
                Campaign(
                    campaign_id=campaign_id,
                    workspace_id=os.getenv("DEFAULT_WORKSPACE_ID", "default"),
                    campaign_name=f"Auto Campaign {campaign_id}",
                    status=status,
                    result_data=result if result else None,
                )
            )
        db.commit()
    except Exception as e:
        agent_log("WORKER", f"Campaign status update failed: {e}")
    finally:
        if db is not None:
            db.close()


# ── Pipeline Execution ───────────────────────────────────────────────────────

def execute_campaign(intent: dict) -> dict:
    """
    Execute the full campaign pipeline via LangGraph.
    This is called when a message is consumed from agent.supervisor.tasks.
    """
    from graph.campaign_graph import campaign_graph

    user_intent     = intent.get("user_intent", "")
    recipient_email = intent.get("recipient_email", "")
    recipient_phone = intent.get("recipient_phone", "")
    campaign_id     = intent.get("campaign_id", f"CAMP-{int(time.time())}")

    agent_log("WORKER", f"Executing campaign: {campaign_id}")
    agent_log("WORKER", f"Intent: {user_intent[:100]}...")

    _update_campaign_status(campaign_id, "running")

    initial_state = {
        "user_intent":       user_intent,
        "pipeline":          "campaign",
        "workspace_id":      intent.get("workspace_id", "default"),
        "recipient_email":   recipient_email,
        "recipient_phone":   recipient_phone,
        "sender_name":       intent.get("sender_name", "VoltX Energy"),
        "company_name":      intent.get("company_name", "VoltX Energy Pvt. Ltd."),
        "company_address":   intent.get("company_address", "Bengaluru, Karnataka, India"),
        "unsubscribe_url":   intent.get("unsubscribe_url", "https://voltx.in/unsubscribe"),
        "current_step":      "supervisor",
        "errors":            [],
        "trace":             [],
    }

    try:
        result = campaign_graph.invoke(initial_state)
        _update_campaign_status(campaign_id, "completed", {
            "trace_count": len(result.get("trace", [])),
            "errors": result.get("errors", []),
        })

        # Publish completion event
        publish_event(
            topic=Topics.CAMPAIGN_EVENTS,
            source_agent="worker",
            payload={
                "event":       "campaign_completed",
                "campaign_id": campaign_id,
                "agents_run":  len(result.get("trace", [])),
                "errors":      result.get("errors", []),
                "timestamp":   datetime.now(timezone.utc).isoformat(),
            },
            priority="HIGH",
        )

        return result

    except Exception as e:
        agent_log("WORKER", f"Pipeline failed: {e}")
        _update_campaign_status(campaign_id, "failed", {"error": str(e)})

        publish_event(
            topic=Topics.DEAD_LETTER,
            source_agent="worker",
            payload={
                "event":       "campaign_failed",
                "campaign_id": campaign_id,
                "error":       str(e),
                "timestamp":   datetime.now(timezone.utc).isoformat(),
            },
            priority="CRITICAL",
        )
        raise


# ── Main Consumer Loop ───────────────────────────────────────────────────────

def main():
    """
    Main worker loop — consumes from agent.supervisor.tasks
    and executes the full pipeline for each message.
    """
    divider()
    agent_log("WORKER", "╔═══════════════════════════════════════════╗")
    agent_log("WORKER", "║   MarketOS Worker — Kafka Consumer        ║")
    agent_log("WORKER", "║   Listening: agent.supervisor.tasks       ║")
    agent_log("WORKER", "╚═══════════════════════════════════════════╝")
    divider()

    consumer = KafkaConsumer(
        topics=[Topics.SUPERVISOR_TASKS],
        group_id="marketos-worker",
    )

    if not consumer._consumer:
        agent_log("WORKER", "Kafka consumer not available — exiting.")
        agent_log("WORKER", "To run without Kafka, use: python demo_full_pipeline.py")
        sys.exit(1)

    agent_log("WORKER", "Waiting for campaign intents on Kafka...")

    while _running:
        envelope = consumer.poll(timeout=2.0)
        if envelope is None:
            continue

        payload = envelope.get("payload", {})
        agent_log("WORKER", f"Received campaign intent: {payload.get('campaign_id', 'unknown')}")

        try:
            result = execute_campaign(payload)
            agent_log("WORKER", f"Campaign completed with {len(result.get('trace', []))} agents")
        except Exception as e:
            agent_log("WORKER", f"Campaign execution failed: {e}")

    consumer.close()
    get_producer().flush()
    agent_log("WORKER", "Worker shut down cleanly.")


if __name__ == "__main__":
    main()
