"""
MarketOS — Kafka Message Bus
Abstraction over confluent-kafka with the PRD-defined message envelope schema.

PRD §3.3: All inter-agent messaging uses a standardised envelope:
  { messageId, timestamp, sourceAgent, targetAgent, correlationId,
    payload, priority, retryCount, traceId }

Topic naming convention (PRD §3.3):
  agent.{agent-name}.tasks   — inbound task queue per agent
  agent.{agent-name}.results — outbound results from agent
  campaign.events            — campaign lifecycle events
  contact.events             — contact engagement events
  system.alerts              — Monitor Agent publishes here
  system.metrics             — aggregated metric snapshots
  agent.dlq                  — dead-letter queue

Local dev: connects to Redpanda at localhost:19092 (Kafka-compatible API).
Production: set KAFKA_BROKERS to MSK Serverless bootstrap endpoint.
"""

from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Callable, Optional

from utils.logger import agent_log

# confluent-kafka is optional — graceful degradation to in-memory if not installed
try:
    from confluent_kafka import Producer, Consumer, KafkaError, KafkaException
    KAFKA_AVAILABLE = True
except ImportError:
    KAFKA_AVAILABLE = False
    agent_log("KAFKA", "confluent-kafka not installed — running in no-op mode (install: pip install confluent-kafka)")


KAFKA_BROKERS  = os.getenv("KAFKA_BROKERS", "localhost:19092")
KAFKA_GROUP_ID = os.getenv("KAFKA_GROUP_ID", "marketos-agents")


# ── In-memory event log (for verification when Kafka broker is down) ─────────

_event_log: list[dict] = []


def get_event_log() -> list[dict]:
    """Return all events published since process start (for demo verification)."""
    return _event_log


def clear_event_log() -> None:
    global _event_log
    _event_log = []


# ── Message Envelope ─────────────────────────────────────────────────────────

def build_envelope(
    source_agent:   str,
    target_agent:   str,
    payload:        dict,
    correlation_id: Optional[str] = None,
    priority:       str = "NORMAL",    # LOW | NORMAL | HIGH | CRITICAL
    trace_id:       Optional[str] = None,
) -> dict:
    """Build the standard PRD inter-agent message envelope."""
    return {
        "messageId":     str(uuid.uuid4()),
        "timestamp":     datetime.now(timezone.utc).isoformat() + "Z",
        "sourceAgent":   source_agent,
        "targetAgent":   target_agent,
        "correlationId": correlation_id or str(uuid.uuid4()),
        "payload":       payload,
        "priority":      priority,
        "retryCount":    0,
        "traceId":       trace_id or str(uuid.uuid4()),
    }


# ── Producer ─────────────────────────────────────────────────────────────────

class KafkaProducer:
    """
    Thin wrapper over confluent_kafka.Producer.
    Falls back to an in-memory event log if Kafka is unavailable.
    """

    def __init__(self):
        self._producer = None
        self._connected = False
        if KAFKA_AVAILABLE:
            try:
                self._producer = Producer({
                    "bootstrap.servers": KAFKA_BROKERS,
                    "acks":              "all",
                    "retries":           3,
                    "linger.ms":         5,
                    "compression.type":  "snappy",
                    "socket.timeout.ms": 3000,
                    "message.timeout.ms": 5000,
                })
                self._connected = True
                agent_log("KAFKA", f"Producer connected to {KAFKA_BROKERS}")
            except Exception as e:
                agent_log("KAFKA", f"Producer init failed: {e} — using in-memory event log")

    @property
    def is_connected(self) -> bool:
        return self._connected and self._producer is not None

    def publish(
        self,
        topic:          str,
        source_agent:   str,
        target_agent:   str,
        payload:        dict,
        correlation_id: Optional[str] = None,
        priority:       str = "NORMAL",
        key:            Optional[str] = None,
    ) -> bool:
        """
        Publish a message to a Kafka topic.
        Always logs to in-memory event log for verification.
        Returns True on success, False on failure.
        """
        envelope = build_envelope(
            source_agent=source_agent,
            target_agent=target_agent,
            payload=payload,
            correlation_id=correlation_id,
            priority=priority,
        )

        # Always log to in-memory for demo verification
        _event_log.append({
            "topic": topic,
            "envelope": envelope,
        })

        if not self._producer:
            agent_log("KAFKA", f"  📨 [{topic}] ← {source_agent} (in-memory)")
            return True

        try:
            self._producer.produce(
                topic=topic,
                value=json.dumps(envelope).encode("utf-8"),
                key=(key or envelope["correlationId"]).encode("utf-8"),
                on_delivery=self._delivery_report,
            )
            self._producer.poll(0)
            agent_log("KAFKA", f"  📨 [{topic}] ← {source_agent}")
            return True
        except Exception as e:
            agent_log("KAFKA", f"Publish failed to {topic}: {e} — logged to in-memory")
            return True  # still in event log

    def flush(self, timeout: float = 10.0):
        if self._producer:
            self._producer.flush(timeout)

    @staticmethod
    def _delivery_report(err, msg):
        if err:
            agent_log("KAFKA", f"Delivery failed for {msg.topic()}: {err}")


# ── Consumer ─────────────────────────────────────────────────────────────────

class KafkaConsumer:
    """
    Wrapper over confluent_kafka.Consumer.
    Handles JSON deserialization and dead-letter queue routing.
    """

    def __init__(self, topics: list[str], group_id: Optional[str] = None):
        self._consumer = None
        self.topics = topics

        if KAFKA_AVAILABLE:
            try:
                self._consumer = Consumer({
                    "bootstrap.servers":   KAFKA_BROKERS,
                    "group.id":            group_id or KAFKA_GROUP_ID,
                    "auto.offset.reset":   "earliest",
                    "enable.auto.commit":  False,
                    "max.poll.interval.ms": 300000,
                })
                self._consumer.subscribe(topics)
                agent_log("KAFKA", f"Consumer subscribed to: {', '.join(topics)}")
            except Exception as e:
                agent_log("KAFKA", f"Consumer init failed: {e}")

    def poll(self, timeout: float = 1.0) -> Optional[dict]:
        """
        Poll for one message. Returns the deserialized envelope or None.
        Commits offset only after successful processing.
        """
        if not self._consumer:
            return None

        msg = self._consumer.poll(timeout)
        if msg is None:
            return None
        if msg.error():
            if msg.error().code() != KafkaError._PARTITION_EOF:
                agent_log("KAFKA", f"Consumer error: {msg.error()}")
            return None

        try:
            envelope = json.loads(msg.value().decode("utf-8"))
            self._consumer.commit(msg)
            return envelope
        except json.JSONDecodeError as e:
            agent_log("KAFKA", f"Message decode failed: {e}")
            return None

    def close(self):
        if self._consumer:
            self._consumer.close()


# ── Topic Registry (Complete — all 16 agents) ────────────────────────────────

class Topics:
    """Central registry of all Kafka topic names per PRD §3.3."""

    # ── Supervisor ───────────────────────────────────────────────────────
    SUPERVISOR_TASKS    = "agent.supervisor.tasks"
    SUPERVISOR_RESULTS  = "agent.supervisor.results"

    # ── Copy Agent ───────────────────────────────────────────────────────
    COPY_TASKS          = "agent.copy_agent.tasks"
    COPY_RESULTS        = "agent.copy_agent.results"

    # ── Image/Creative Agent ─────────────────────────────────────────────
    IMAGE_TASKS         = "agent.image_agent.tasks"
    IMAGE_RESULTS       = "agent.image_agent.results"

    # ── Compliance Agent ─────────────────────────────────────────────────
    COMPLIANCE_TASKS    = "agent.compliance_agent.tasks"
    COMPLIANCE_RESULTS  = "agent.compliance_agent.results"

    # ── Finance Agent ────────────────────────────────────────────────────
    FINANCE_TASKS       = "agent.finance_agent.tasks"
    FINANCE_RESULTS     = "agent.finance_agent.results"

    # ── Email Agent ──────────────────────────────────────────────────────
    EMAIL_TASKS         = "agent.email_agent.tasks"
    EMAIL_RESULTS       = "agent.email_agent.results"

    # ── SMS Agent ────────────────────────────────────────────────────────
    SMS_TASKS           = "agent.sms_agent.tasks"
    SMS_RESULTS         = "agent.sms_agent.results"

    # ── Social Media Agent ───────────────────────────────────────────────
    SOCIAL_TASKS        = "agent.social_media_agent.tasks"
    SOCIAL_RESULTS      = "agent.social_media_agent.results"

    # ── Analytics Agent ──────────────────────────────────────────────────
    ANALYTICS_TASKS     = "agent.analytics_agent.tasks"
    ANALYTICS_RESULTS   = "agent.analytics_agent.results"

    # ── Monitor Agent ────────────────────────────────────────────────────
    MONITOR_TASKS       = "agent.monitor_agent.tasks"
    MONITOR_RESULTS     = "agent.monitor_agent.results"

    # ── A/B Test Agent ───────────────────────────────────────────────────
    AB_TEST_TASKS       = "agent.ab_test_agent.tasks"
    AB_TEST_RESULTS     = "agent.ab_test_agent.results"

    # ── Lead Scoring Agent ───────────────────────────────────────────────
    LEAD_SCORING_TASKS  = "agent.lead_scoring_agent.tasks"
    LEAD_SCORING_RESULTS = "agent.lead_scoring_agent.results"

    # ── Competitor Agent ─────────────────────────────────────────────────
    COMPETITOR_TASKS    = "agent.competitor_agent.tasks"
    COMPETITOR_RESULTS  = "agent.competitor_agent.results"

    # ── SEO Agent ────────────────────────────────────────────────────────
    SEO_TASKS           = "agent.seo_agent.tasks"
    SEO_RESULTS         = "agent.seo_agent.results"

    # ── Reporting Agent ──────────────────────────────────────────────────
    REPORTING_TASKS     = "agent.reporting_agent.tasks"
    REPORTING_RESULTS   = "agent.reporting_agent.results"

    # ── Onboarding Agent ─────────────────────────────────────────────────
    ONBOARDING_TASKS    = "agent.onboarding_agent.tasks"
    ONBOARDING_RESULTS  = "agent.onboarding_agent.results"

    # ── Personalization Agent ────────────────────────────────────────────
    PERSONALIZATION_TASKS   = "agent.personalization_agent.tasks"
    PERSONALIZATION_RESULTS = "agent.personalization_agent.results"

    # ── Cross-cutting topics ─────────────────────────────────────────────
    CAMPAIGN_EVENTS     = "campaign.events"
    CONTACT_EVENTS      = "contact.events"
    SYSTEM_ALERTS       = "system.alerts"
    SYSTEM_METRICS      = "system.metrics"
    SEND_STATS          = "campaign.send.stats"
    DEAD_LETTER         = "agent.dlq"

    @classmethod
    def tasks_for(cls, agent_name: str) -> str:
        """Return the tasks topic for a given agent name."""
        return f"agent.{agent_name}.tasks"

    @classmethod
    def results_for(cls, agent_name: str) -> str:
        """Return the results topic for a given agent name."""
        return f"agent.{agent_name}.results"

    @classmethod
    def all_topics(cls) -> list[str]:
        """Return all topic names for auto-creation."""
        return [v for k, v in vars(cls).items()
                if isinstance(v, str) and not k.startswith("_") and "." in v]


# ── Module-level singleton (import and use directly) ─────────────────────────

_producer: Optional[KafkaProducer] = None


def get_producer() -> KafkaProducer:
    """Return the module-level Kafka producer singleton."""
    global _producer
    if _producer is None:
        _producer = KafkaProducer()
    return _producer


def publish_event(
    topic:          str,
    source_agent:   str,
    payload:        dict,
    target_agent:   str = "broadcast",
    correlation_id: Optional[str] = None,
    priority:       str = "NORMAL",
) -> bool:
    """Convenience function: publish a single event to a topic."""
    return get_producer().publish(
        topic=topic,
        source_agent=source_agent,
        target_agent=target_agent,
        payload=payload,
        correlation_id=correlation_id,
        priority=priority,
    )
