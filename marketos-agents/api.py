"""
MarketOS — API Layer (v1)
Versioned REST API with individual agent access, consistent response envelope,
and full pipeline execution.

Endpoints:
  GET  /v1/health                     → Infrastructure health
  GET  /v1/agents                     → List all agents with metadata
  POST /v1/agents/{name}/run          → Run a single agent
  POST /v1/pipeline/campaign          → Full pipeline (sync)
  POST /v1/pipeline/campaign/async    → Kafka-backed async (202)
  GET  /v1/pipeline/{id}/status       → Poll campaign status
"""

from __future__ import annotations

import importlib
import json
import os
import time
import uuid
from datetime import datetime, timezone
from typing import Optional

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse, HTMLResponse
from pydantic import BaseModel, Field
from sqlalchemy import text

from utils.kafka_bus import publish_event, Topics, get_producer
from utils.logger import agent_log
from core.database import SessionLocal, engine
from models.campaign import Campaign


from fastapi.middleware.cors import CORSMiddleware

# ── App ──────────────────────────────────────────────────────────────────────

app = FastAPI(title="MarketOS API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Auto-create all Kafka topics on startup ──────────────────────────────────

@app.on_event("startup")
async def _create_kafka_topics():
    """Pre-create all PRD-defined Kafka topics in Redpanda so agents can
    immediately publish/consume without relying on auto-topic-creation."""
    from utils.kafka_bus import KAFKA_BROKERS, KAFKA_AVAILABLE, Topics
    if not KAFKA_AVAILABLE:
        agent_log("KAFKA", "confluent-kafka not installed — skipping topic creation")
        return
    try:
        from confluent_kafka.admin import AdminClient, NewTopic
        admin  = AdminClient({"bootstrap.servers": KAFKA_BROKERS, "socket.timeout.ms": 5000})
        meta   = admin.list_topics(timeout=5)
        existing = set(meta.topics.keys())
        needed   = [t for t in Topics.all_topics() if t not in existing]
        if not needed:
            agent_log("KAFKA", f"All {len(Topics.all_topics())} topics already exist ✓")
            return
        new_topics = [NewTopic(t, num_partitions=1, replication_factor=1) for t in needed]
        futures = admin.create_topics(new_topics)
        for topic, future in futures.items():
            try:
                future.result()
                agent_log("KAFKA", f"  ✓ Created topic: {topic}")
            except Exception as e:
                if "TopicExistsError" not in str(type(e).__name__):
                    agent_log("KAFKA", f"  ✗ Failed to create {topic}: {e}")
        agent_log("KAFKA", f"Topic creation complete — {len(needed)} new topics")
    except Exception as e:
        agent_log("KAFKA", f"Topic auto-creation failed: {e}")


# ── Agent Registry ──────────────────────────────────────────────────────────

AGENT_REGISTRY: dict[str, dict] = {
    "supervisor":       {"module": "agents.supervisor.supervisor_agent",       "func": "supervisor_node",          "skills": ["product-marketing-context","launch-strategy","marketing-ideas","marketing-psychology"], "temperature": 0.0, "sla": "<500ms"},
    "competitor":       {"module": "agents.competitor.competitor_agent",       "func": "competitor_agent_node",    "skills": ["competitor-alternatives","customer-research","pricing-strategy"],                      "temperature": 0.1, "sla": "daily"},
    "seo":              {"module": "agents.seo.seo_agent",                    "func": "seo_agent_node",           "skills": ["seo-audit","ai-seo","programmatic-seo","schema-markup","site-architecture"],              "temperature": 0.0, "sla": "weekly"},
    "copy":             {"module": "agents.copy.copy_agent",                  "func": "copy_agent_node",          "skills": ["copywriting","copy-editing","email-sequence","cold-email","content-strategy","marketing-psychology"], "temperature": 0.7, "sla": "<8s"},
    "image":            {"module": "agents.creative.image_engine",            "func": "image_agent_node",         "skills": [],                                                                                         "temperature": None, "sla": "<30s"},
    "compliance":       {"module": "agents.compliance.compliance_agent",      "func": "compliance_agent_node",    "skills": ["copy-editing","product-marketing-context"],                                               "temperature": 0.0, "sla": "<500ms"},
    "finance":          {"module": "agents.finance.finance_agent",            "func": "finance_agent_node",       "skills": ["pricing-strategy","revops","paid-ads"],                                                   "temperature": 0.0, "sla": "hourly"},
    "email":            {"module": "agents.email.email_agent",                "func": "email_agent_node",         "skills": ["email-sequence","copy-editing"],                                                          "temperature": 0.0, "sla": "real-time"},
    "sms":              {"module": "agents.sms.sms_agent",                    "func": "sms_agent_node",           "skills": ["copywriting","marketing-psychology"],                                                     "temperature": 0.5, "sla": "real-time"},
    "voice":            {"module": "agents.voice.voice_agent",                "func": "voice_agent_node",         "skills": ["voice-marketing","copywriting"],                                                          "temperature": 0.4, "sla": "real-time"},
    "whatsapp":         {"module": "agents.whatsapp.whatsapp_agent",          "func": "whatsapp_agent_node",      "skills": ["copywriting","marketing-psychology"],                                                     "temperature": 0.0, "sla": "real-time"},
    "social_media":     {"module": "agents.social.social_media_agent",        "func": "social_media_agent_node",  "skills": ["social-content","community-marketing","content-strategy","marketing-psychology"],          "temperature": 0.6, "sla": "scheduled"},
    "analytics":        {"module": "agents.analytics.analytics_agent",        "func": "analytics_agent_node",     "skills": ["analytics-tracking","revops","ab-test-setup"],                                            "temperature": 0.0, "sla": "5min"},
    "monitor":          {"module": "agents.monitor.monitor_agent",            "func": "monitor_agent_node",       "skills": ["analytics-tracking","revops"],                                                            "temperature": 0.0, "sla": "<30s"},
    "ab_test":          {"module": "agents.ab_test.ab_test_agent",            "func": "ab_test_agent_node",       "skills": ["ab-test-setup","analytics-tracking","page-cro"],                                          "temperature": 0.0, "sla": "event-driven"},
    "lead_scoring":     {"module": "agents.lead_scoring.lead_scoring_agent",  "func": "lead_scoring_agent_node",  "skills": ["revops","sales-enablement","customer-research"],                                          "temperature": 0.0, "sla": "<2s"},
    "reporting":        {"module": "agents.reporting.reporting_agent",        "func": "reporting_agent_node",     "skills": ["analytics-tracking","revops","copy-editing"],                                             "temperature": 0.3, "sla": "<60s"},
    "onboarding":       {"module": "agents.onboarding.onboarding_agent",     "func": "onboarding_agent_node",    "skills": ["onboarding-cro","churn-prevention","lead-magnets","email-sequence"],                      "temperature": 0.5, "sla": "event-driven"},
}


def _load_agent_func(name: str):
    """Dynamically import and return an agent's node function."""
    normalized_name = name
    if name.endswith("_agent"):
        normalized_name = name[:-6]
    
    entry = AGENT_REGISTRY.get(normalized_name)
    if not entry:
        raise HTTPException(status_code=404, detail=f"Agent '{name}' (nor '{normalized_name}') not found")
    mod = importlib.import_module(entry["module"])
    return getattr(mod, entry["func"])


# ── Response Envelope ────────────────────────────────────────────────────────

def _envelope(data: dict, agent: str, elapsed_ms: float, trace_id: str, ok: bool = True, error: str | None = None):
    return {
        "ok": ok,
        "data": data,
        "error": error,
        "meta": {
            "agent": agent,
            "elapsed_ms": round(elapsed_ms, 1),
            "trace_id": trace_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    }


# ── Request Models ───────────────────────────────────────────────────────────

class AgentRunRequest(BaseModel):
    state: dict = Field(..., description="LangGraph state dict to pass to the agent")

class CampaignRequest(BaseModel):
    user_intent:     str = Field(..., description="Natural language campaign intent")
    channels:        Optional[list[str]] = Field(None, description="Explicit channels chosen by the user (email, sms, whatsapp, social)")
    recipient_email: Optional[str] = None
    recipient_phone: Optional[str] = None
    sender_name:     str = "MarketOS"
    company_name:    str = "MarketOS"
    company_address: str = "Bengaluru, Karnataka, India"
    unsubscribe_url: str = "https://example.com/unsubscribe"
    workspace_id:    str = "default"


# ── GET / — Serve Dashboard ──────────────────────────────────────────────────

@app.get("/")
async def serve_dashboard():
    """Serve the single-page MarketOS agency dashboard."""
    try:
        with open("index.html", "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    except FileNotFoundError:
        return HTMLResponse(content="<h1>Dashboard index.html not found</h1>", status_code=404)

# ── GET /v1/agents — List all agents ─────────────────────────────────────────

@app.get("/v1/agents")
async def list_agents():
    """Return metadata for all registered agents."""
    agents = []
    for name, meta in AGENT_REGISTRY.items():
        agents.append({
            "name": name,
            "module": meta["module"],
            "skills": meta["skills"],
            "temperature": meta["temperature"],
            "sla": meta["sla"],
        })
    return {"ok": True, "data": {"agents": agents, "total": len(agents)}}


# ── POST /v1/agents/{name}/run — Run single agent ───────────────────────────

@app.post("/v1/agents/{agent_name}/run")
async def run_agent(agent_name: str, request: AgentRunRequest):
    """Run a single agent with the provided state and return its output."""
    fn = _load_agent_func(agent_name)
    trace_id = str(uuid.uuid4())[:8]

    # Ensure required state keys exist
    state = {
        "current_step": agent_name,
        "errors": [],
        "trace": [],
        **request.state,
    }

    start = time.monotonic()
    try:
        result = fn(state)
        elapsed = (time.monotonic() - start) * 1000
        return _envelope(result, agent_name, elapsed, trace_id)
    except Exception as e:
        elapsed = (time.monotonic() - start) * 1000
        raise HTTPException(
            status_code=500,
            detail=_envelope({}, agent_name, elapsed, trace_id, ok=False, error=str(e)),
        )


# ── POST /v1/pipeline/campaign — Full sync pipeline ─────────────────────────

@app.post("/v1/pipeline/campaign/stream")
async def run_pipeline_stream(request: CampaignRequest):
    """Run the campaign pipeline synchronously and stream events via SSE."""
    from graph.campaign_graph import campaign_graph
    
    campaign_id = f"CAMP-{int(time.time())}-{str(uuid.uuid4())[:4].upper()}"

    state = {
        "user_intent":     request.user_intent,
        "user_channels":   request.channels,
        "pipeline":        "campaign",
        "workspace_id":    request.workspace_id,
        "recipient_email": request.recipient_email,
        "recipient_phone": request.recipient_phone,
        "sender_name":     request.sender_name,
        "company_name":    request.company_name,
        "company_address": request.company_address,
        "unsubscribe_url": request.unsubscribe_url,
        "current_step":    "supervisor",
        "errors":          [],
        "trace":           [],
    }

    def event_generator():
        try:
            for event in campaign_graph.stream(state):
                for node, update_state in event.items():
                    data = {
                        "node": node, 
                        "trace": [{"agent": t["agent"], "status": t.get("status"), "ok": t.get("ok", True)} for t in update_state.get("trace", [])],
                        "errors": update_state.get("errors", [])
                    }
                    yield f"data: {json.dumps(data)}\n\n"
            yield f"event: end\ndata: {json.dumps({'status': 'completed'})}\n\n"
        except Exception as e:
            yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


# ── POST /v1/query/stream — GLM-Orchestrated Query Pipeline ─────────────────

class QueryRequest(BaseModel):
    query:        str = Field(..., description="Natural language user query")
    workspace_id: str = "default"

@app.post("/v1/query/stream")
async def run_query_stream(request: QueryRequest):
    """
    Full automated agent workflow powered by GLM-5.2 as the reasoning head.

    Flow:
      1. GLM-5.2 classifies intent & builds routing plan
      2. A/B Test Agent runs as mandatory first gate
      3. Relevant specialist agents execute in sequence
      4. GLM-5.2 synthesises outputs into structured documentation

    Returns SSE stream of stage-by-stage events for the frontend terminal.
    """
    from agents.orchestrator.glm_orchestrator import orchestrate_query_stream

    def event_generator():
        try:
            for event in orchestrate_query_stream(
                user_query=request.query,
                workspace_id=request.workspace_id,
            ):
                yield event
        except Exception as e:
            import json
            yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/v1/pipeline/campaign")
async def run_pipeline_sync(request: CampaignRequest):
    """Run the full campaign pipeline synchronously. Returns complete result."""
    from graph.campaign_graph import campaign_graph

    campaign_id = f"CAMP-{int(time.time())}-{str(uuid.uuid4())[:4].upper()}"
    trace_id = str(uuid.uuid4())[:8]

    state = {
        "user_intent":     request.user_intent,
        "user_channels":   request.channels,
        "pipeline":        "campaign",
        "workspace_id":    request.workspace_id,
        "recipient_email": request.recipient_email,
        "recipient_phone": request.recipient_phone,
        "sender_name":     request.sender_name,
        "company_name":    request.company_name,
        "company_address": request.company_address,
        "unsubscribe_url": request.unsubscribe_url,
        "current_step":    "supervisor",
        "errors":          [],
        "trace":           [],
    }

    start = time.monotonic()
    try:
        result = campaign_graph.invoke(state)
        elapsed = (time.monotonic() - start) * 1000
        return _envelope(
            {"campaign_id": campaign_id, "agents_run": len(result.get("trace", [])), "result": result},
            "pipeline",
            elapsed,
            trace_id,
        )
    except Exception as e:
        elapsed = (time.monotonic() - start) * 1000
        raise HTTPException(
            status_code=500,
            detail=_envelope({}, "pipeline", elapsed, trace_id, ok=False, error=str(e)),
        )


# ── POST /v1/pipeline/campaign/async — Kafka-backed ─────────────────────────

@app.post("/v1/pipeline/campaign/async", status_code=202)
async def run_pipeline_async(request: CampaignRequest):
    """Accept campaign intent, publish to Kafka, return 202."""
    campaign_id = f"CAMP-{int(time.time())}-{str(uuid.uuid4())[:4].upper()}"

    payload = {
        "campaign_id":     campaign_id,
        "user_intent":     request.user_intent,
        "user_channels":   request.channels,
        "recipient_email": request.recipient_email,
        "recipient_phone": request.recipient_phone,
        "sender_name":     request.sender_name,
        "company_name":    request.company_name,
        "company_address": request.company_address,
        "unsubscribe_url": request.unsubscribe_url,
        "workspace_id":    request.workspace_id,
    }

    publish_event(topic=Topics.SUPERVISOR_TASKS, source_agent="api", payload=payload, priority="HIGH")
    _store_campaign(campaign_id, request.workspace_id, request.user_intent)

    return {
        "ok": True,
        "data": {"campaign_id": campaign_id, "status": "accepted"},
        "meta": {"poll_url": f"/v1/pipeline/{campaign_id}/status"},
    }


# ── GET /v1/pipeline/{id}/status ─────────────────────────────────────────────

@app.get("/v1/pipeline/{campaign_id}/status")
async def get_pipeline_status(campaign_id: str):
    """Poll campaign status from PostgreSQL."""
    db = None
    try:
        db = SessionLocal()
        campaign = db.query(Campaign).filter(Campaign.campaign_id == campaign_id).first()
        if not campaign:
            raise HTTPException(status_code=404, detail=f"Campaign {campaign_id} not found")
        return {
            "ok": True,
            "data": {
                "campaign_id": campaign.campaign_id,
                "status": campaign.status,
                "result_data": campaign.result_data,
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        return {"ok": False, "data": None, "error": f"DB unavailable: {e}"}
    finally:
        if db is not None:
            db.close()


# ── GET /v1/health ───────────────────────────────────────────────────────────

@app.get("/v1/health")
async def health_check():
    """Check infrastructure health."""
    checks = {"kafka": "disconnected", "postgres": "disconnected", "redis": "disconnected", "clickhouse": "disconnected"}

    checks["kafka"] = "connected" if get_producer().is_connected else "in-memory"

    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        checks["postgres"] = "connected"
    except Exception:
        pass

    try:
        import redis
        redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379/0")).ping()
        checks["redis"] = "connected"
    except Exception:
        pass

    try:
        from clickhouse_driver import Client
        Client(host=os.getenv("CLICKHOUSE_HOST", "localhost"), port=int(os.getenv("CLICKHOUSE_PORT", "9000"))).execute("SELECT 1")
        checks["clickhouse"] = "connected"
    except Exception:
        pass

    is_healthy = all(v == "connected" for v in checks.values())
    return {
        "ok": True,
        "data": {"status": "healthy" if is_healthy else "degraded", **checks},
        "meta": {"timestamp": datetime.now(timezone.utc).isoformat()},
    }


# ── GET /v1/health/agents ───────────────────────────────────────────────────

@app.get("/v1/health/agents")
async def agent_health():
    """Import-test every agent module."""
    results = {}
    for name, meta in AGENT_REGISTRY.items():
        try:
            importlib.import_module(meta["module"])
            results[name] = "ok"
        except Exception as e:
            results[name] = str(e)
    is_healthy = all(v == "ok" for v in results.values())
    return {"ok": is_healthy, "data": results}


# ── GET /v1/kafka/health — Broker + topic connectivity check ─────────────────

@app.get("/v1/kafka/health")
async def kafka_health():
    """
    Deep Kafka diagnostic:
      - Broker reachability (Redpanda at KAFKA_BROKERS)
      - Which PRD-defined topics exist vs missing
      - In-memory event log stats (messages published this session per topic)
      - Last 5 inter-agent events for quick visual confirmation
    """
    from utils.kafka_bus import Topics, get_event_log, KAFKA_BROKERS, KAFKA_AVAILABLE

    broker_ok    = False
    topic_list: list[str] = []
    missing:    list[str] = []
    topic_status: dict[str, str] = {}

    # ── 1. Broker ping ────────────────────────────────────────────────────
    if KAFKA_AVAILABLE:
        try:
            from confluent_kafka.admin import AdminClient
            admin      = AdminClient({"bootstrap.servers": KAFKA_BROKERS, "socket.timeout.ms": 3000})
            meta       = admin.list_topics(timeout=4)
            topic_list = [t for t in meta.topics.keys() if not t.startswith("_")]
            broker_ok  = True
            for t in Topics.all_topics():
                topic_status[t] = "exists" if t in topic_list else "MISSING"
                if t not in topic_list:
                    missing.append(t)
        except Exception as e:
            broker_ok = False
            topic_status["error"] = str(e)

    # ── 2. In-memory event log ────────────────────────────────────────────
    event_log = get_event_log()

    topic_event_counts: dict[str, int] = {}
    for e in event_log:
        topic_event_counts[e["topic"]] = topic_event_counts.get(e["topic"], 0) + 1

    last_events = [
        {
            "topic":   e["topic"],
            "from":    e["envelope"]["sourceAgent"],
            "to":      e["envelope"]["targetAgent"],
            "msg_id":  e["envelope"]["messageId"][:8],
            "ts":      e["envelope"]["timestamp"],
        }
        for e in event_log[-5:]
    ]

    return {
        "ok": True,
        "data": {
            "broker":                 KAFKA_BROKERS,
            "broker_ok":              broker_ok,
            "kafka_available":        KAFKA_AVAILABLE,
            "topics_found":           len(topic_list),
            "topics_expected":        len(Topics.all_topics()),
            "missing_topics":         missing,
            "topic_status":           topic_status,
            "in_memory_events_total": len(event_log),
            "in_memory_by_topic":     topic_event_counts,
            "last_5_events":          last_events,
        },
        "meta": {"timestamp": datetime.now(timezone.utc).isoformat()},
    }


# ── GET /v1/kafka/events — In-memory inter-agent event log ───────────────────

@app.get("/v1/kafka/events")
async def kafka_events(limit: int = 50, topic: str = ""):
    """
    Return the in-memory inter-agent event log.
    Every agent publish_event() call is captured here regardless of broker state.
    Query params:
      ?topic=agent.supervisor.tasks  — filter by topic
      ?limit=100                     — max events returned (cap 200)
    """
    from utils.kafka_bus import get_event_log
    events = get_event_log()
    if topic:
        events = [e for e in events if e["topic"] == topic]
    limit  = min(limit, 200)
    sliced = events[-limit:]

    formatted = []
    for e in sliced:
        env = e["envelope"]
        formatted.append({
            "topic":           e["topic"],
            "message_id":      env["messageId"],
            "source_agent":    env["sourceAgent"],
            "target_agent":    env["targetAgent"],
            "priority":        env["priority"],
            "correlation_id":  env["correlationId"],
            "timestamp":       env["timestamp"],
            "payload_keys":    list(env["payload"].keys()) if isinstance(env.get("payload"), dict) else [],
            "payload_preview": str(env.get("payload", {}))[:300],
        })

    return {
        "ok":   True,
        "data": {"events": formatted, "total": len(events), "returned": len(formatted)},
        "meta": {"timestamp": datetime.now(timezone.utc).isoformat()},
    }


# ── POST /v1/kafka/probe — Fire one test message to every agent topic ─────────

@app.post("/v1/kafka/probe")
async def kafka_probe():
    """
    Publishes one probe message to every PRD-defined Kafka topic.
    Returns per-topic delivery results and the in-memory event log delta.
    Use this to verify end-to-end broker connectivity for all 18 agents.
    """
    from utils.kafka_bus import Topics, publish_event, get_event_log

    trace_id   = str(uuid.uuid4())[:8].upper()
    all_topics = Topics.all_topics()
    results: dict[str, str] = {}

    before = len(get_event_log())

    for topic in all_topics:
        agent_name = topic.split(".")[1] if "." in topic else "probe"
        ok = publish_event(
            topic=topic,
            source_agent="kafka_probe",
            target_agent=agent_name,
            payload={"probe": True, "trace_id": trace_id, "topic": topic},
            priority="LOW",
        )
        results[topic] = "published" if ok else "failed"

    new_msgs = len(get_event_log()) - before

    return {
        "ok":   True,
        "data": {
            "probe_trace_id":  trace_id,
            "topics_probed":   len(all_topics),
            "messages_logged": new_msgs,
            "results":         results,
        },
        "meta": {"timestamp": datetime.now(timezone.utc).isoformat()},
    }


# ── DB Helper ────────────────────────────────────────────────────────────────

def _store_campaign(campaign_id: str, workspace_id: str, intent: str):
    db = None
    try:
        db = SessionLocal()
        existing = db.query(Campaign).filter(Campaign.campaign_id == campaign_id).first()
        if not existing:
            db.add(
                Campaign(
                    campaign_id=campaign_id,
                    workspace_id=workspace_id or "default",
                    campaign_name=(intent or "Campaign")[:200],
                    status="accepted",
                )
            )
            db.commit()
    except Exception as e:
        agent_log("API", f"Campaign store failed: {e}")
    finally:
        if db is not None:
            db.close()


# ── Run ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
