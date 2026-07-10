"""
MarketOS — ClickHouse Kafka Sink
Consumes contact.events and writes email engagement events to ClickHouse in batches.
"""

from __future__ import annotations

import json
import os
import time
import uuid
from datetime import datetime, timezone

from utils.logger import agent_log

try:
    from confluent_kafka import Consumer, KafkaError
    KAFKA_AVAILABLE = True
except ImportError:
    KAFKA_AVAILABLE = False

try:
    from clickhouse_driver import Client
    CLICKHOUSE_AVAILABLE = True
except ImportError:
    CLICKHOUSE_AVAILABLE = False

KAFKA_BROKERS = os.getenv("KAFKA_BROKERS", "localhost:19092")
CH_HOST = os.getenv("CLICKHOUSE_HOST", "localhost")
CH_PORT = int(os.getenv("CLICKHOUSE_PORT", "9000"))
CH_DB = os.getenv("CLICKHOUSE_DB", "marketos_analytics")
CH_USER = os.getenv("CLICKHOUSE_USER", "marketos")
CH_PASSWORD = os.getenv("CLICKHOUSE_PASSWORD", "marketos_dev")

# Kafka payload -> ClickHouse event_type mapping
# email_sent      -> send
# email_open      -> open
# email_click     -> click
# bounce          -> bounce_hard
# spam_complaint  -> spam_complaint
EVENT_TYPE_MAP = {
    "email_sent": "send",
    "email_open": "open",
    "email_click": "click",
    "bounce": "bounce_hard",
    "spam_complaint": "spam_complaint",
}


def _parse_timestamp(value: str | None) -> datetime:
    if not value:
        return datetime.now(timezone.utc)
    normalized = value.replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(normalized)
    except ValueError:
        return datetime.now(timezone.utc)


class ClickHouseSink:
    def __init__(self, batch_size: int = 100, flush_interval: float = 5.0):
        self.batch_size = batch_size
        self.flush_interval = flush_interval
        self._last_flush = time.monotonic()
        self._rows: list[tuple] = []
        self._messages = []

        self.consumer = None
        if KAFKA_AVAILABLE:
            self.consumer = Consumer(
                {
                    "bootstrap.servers": KAFKA_BROKERS,
                    "group.id": "marketos-clickhouse-sink",
                    "auto.offset.reset": "earliest",
                    "enable.auto.commit": False,
                }
            )
            self.consumer.subscribe(["contact.events"])

        self.clickhouse = self._get_clickhouse_client()

    def _get_clickhouse_client(self):
        if not CLICKHOUSE_AVAILABLE:
            return None
        try:
            return Client(
                host=CH_HOST,
                port=CH_PORT,
                database=CH_DB,
                user=CH_USER,
                password=CH_PASSWORD,
                connect_timeout=5,
            )
        except Exception as exc:
            agent_log("CH_SINK", f"ClickHouse unavailable: {exc}")
            return None

    def _extract_row(self, raw_message) -> tuple | None:
        try:
            envelope = json.loads(raw_message.value().decode("utf-8"))
        except Exception as exc:
            agent_log("CH_SINK", f"Skipping malformed message: {exc}")
            return None

        payload = envelope.get("payload", envelope)
        input_event_type = payload.get("event_type") or payload.get("event")
        event_type = EVENT_TYPE_MAP.get(input_event_type)
        if not event_type:
            return None

        event_id = payload.get("event_id") or payload.get("message_id") or envelope.get("messageId") or str(uuid.uuid4())
        campaign_id = payload.get("campaign_id") or "unknown"
        workspace_id = payload.get("workspace_id") or "default"
        contact_id = payload.get("contact_id") or payload.get("recipient") or "unknown"
        provider = payload.get("provider") or "unknown"
        timestamp = _parse_timestamp(payload.get("timestamp") or envelope.get("timestamp"))

        return (
            event_id,
            campaign_id,
            workspace_id,
            contact_id,
            event_type,
            provider,
            timestamp,
        )

    def _flush(self) -> None:
        if not self._rows:
            return

        if self.clickhouse is None:
            self.clickhouse = self._get_clickhouse_client()

        if self.clickhouse is not None:
            try:
                self.clickhouse.execute(
                    """
                    INSERT INTO email_events_local
                        (event_id, campaign_id, workspace_id, contact_id, event_type, provider, timestamp)
                    VALUES
                    """,
                    self._rows,
                )
                agent_log("CH_SINK", f"Inserted {len(self._rows)} event(s) into ClickHouse")
            except Exception as exc:
                agent_log("CH_SINK", f"ClickHouse insert failed, skipping batch: {exc}")
                self.clickhouse = None
        else:
            agent_log("CH_SINK", f"ClickHouse unavailable, skipping batch of {len(self._rows)} event(s)")

        for message in self._messages:
            try:
                self.consumer.commit(message=message)
            except Exception as exc:
                agent_log("CH_SINK", f"Commit failed: {exc}")

        self._rows.clear()
        self._messages.clear()
        self._last_flush = time.monotonic()

    def run(self) -> None:
        if not self.consumer:
            agent_log("CH_SINK", "Kafka consumer unavailable")
            return

        agent_log("CH_SINK", "Listening on contact.events")
        try:
            while True:
                message = self.consumer.poll(1.0)
                now = time.monotonic()

                if message is None:
                    if self._rows and now - self._last_flush >= self.flush_interval:
                        self._flush()
                    continue

                if message.error():
                    if message.error().code() != KafkaError._PARTITION_EOF:
                        agent_log("CH_SINK", f"Kafka consumer error: {message.error()}")
                    continue

                row = self._extract_row(message)
                if row is not None:
                    self._rows.append(row)
                    self._messages.append(message)
                    if len(self._rows) >= self.batch_size:
                        self._flush()
                else:
                    try:
                        self.consumer.commit(message=message)
                    except Exception as exc:
                        agent_log("CH_SINK", f"Commit failed for skipped message: {exc}")

                if self._rows and now - self._last_flush >= self.flush_interval:
                    self._flush()
        except KeyboardInterrupt:
            agent_log("CH_SINK", "Shutdown requested")
        finally:
            self._flush()
            self.consumer.close()


def main() -> None:
    ClickHouseSink().run()


if __name__ == "__main__":
    main()
