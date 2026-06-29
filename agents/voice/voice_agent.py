"""
MarketOS — Voice Agent (LangGraph Node)
Orchestrates outbound Twilio calls utilizing bidirectional WebSocket streaming
to models/gemini-3.1-flash-live-preview via the Voice Daemon.

Architecture:
  1. LLM generates conversational persona + opening hook + talking points
  2. System instruction is stored in Redis (keyed by campaign_id)
  3. Twilio REST API initiates outbound call with <Connect><Stream> TwiML
  4. Twilio connects to voice_daemon's ngrok tunnel (auto-discovered from Redis)
  5. voice_daemon bridges Twilio ↔ Gemini 3.1 Live Preview in real-time
"""

from __future__ import annotations

import os
import re
import uuid
from datetime import datetime, timezone

from langchain_core.messages import SystemMessage, HumanMessage

from agents.llm.llm_provider import get_llm
from schemas.campaign import CampaignPlan
from utils.logger import agent_log, step_banner, kv, section, divider
from utils.json_utils import extract_json
from utils.kafka_bus import publish_event, Topics
from core.agent_base import AgentBase

try:
    import redis as redis_lib
    _redis = redis_lib.from_url(
        os.getenv("REDIS_URL", "redis://localhost:6379/0"),
        decode_responses=True,
    )
    REDIS_OK = True
except Exception:
    _redis = None
    REDIS_OK = False

VOICEAGENT_SKILLS = ["voice-marketing", "copywriting"]


class VoiceAgent(AgentBase):
    def __init__(self):
        super().__init__("Voice Agent", VOICEAGENT_SKILLS)


# ── System Prompt ─────────────────────────────────────────────────────────────

VOICE_PROMPT = """You are the Voice Agent for MarketOS.
Your task is to prepare the conversational persona and strategic outline for a
real-time voice AI that will dial customers over Twilio.

You must design a dynamic system prompt for the Gemini 3.1 Live flash model.
The AI should sound natural, concise (1-2 sentence replies max), and handle
objections smoothly.

VOICE PERSONA RULES:
- Always identify yourself by name and company within the first sentence.
- Keep every response ≤ 2 sentences. End with an open question.
- If the customer says they are busy, respect it immediately and offer to
  send an SMS summary instead.
- Never hard-sell. Focus on providing genuine value.
- Match the brand tone exactly (energetic for fitness, calm for wellness, etc.)

OUTPUT REQUIRED:
Respond ONLY with valid JSON — no prose, no markdown fences.
{
  "system_instruction": "You are Alex, an enthusiastic brand rep for VoltX...",
  "opening_hook": "Hi there, this is Alex from VoltX. Got 30 seconds?",
  "key_talking_points": ["Highlight BOGO deal", "Energy without the crash"],
  "objection_handlers": {
    "busy": "No worries at all! I'll text you the details so you can check when free.",
    "not_interested": "Totally understand. Just so you know, this deal expires Monday. Have a great day!"
  },
  "closing_goal": "Get them to acknowledge the deal and promise to check their email/SMS.",
  "voice_name": "Kore"
}
"""


def _get_tunnel_url() -> str | None:
    """Read the active voice daemon URL from env or Redis."""
    env_url = os.getenv("VOICE_DAEMON_WSS_URL") or os.getenv("VOICE_DAEMON_WS_URL")
    if env_url:
        return env_url
    if not REDIS_OK or not _redis:
        return None
    try:
        return _redis.get("voice_daemon:wss_url")
    except Exception:
        return None


def _normalize_phone(phone: str | None) -> str | None:
    if not phone:
        return None
    clean = re.sub(r"[^0-9+]", "", str(phone))
    return clean if clean else None


def voice_agent_node(state: dict) -> dict:
    step_banner("VOICE AGENT  ─  Realtime AI Call Dispatcher (Gemini 3.1 Live)")

    plan_data = state.get("campaign_plan") or {}
    plan = CampaignPlan(**plan_data)
    campaign_id = plan.campaign_id

    agent = VoiceAgent()
    llm = get_llm(temperature=0.4)

    agent_log("VOICE", f"Campaign: {plan.campaign_name}")

    # ── Generate voice persona via LLM ────────────────────────────────────
    market_intel = state.get("competitor_result", {})
    intel_summary = ""
    if market_intel:
        rivals = market_intel.get("competitors", [])
        if rivals:
            intel_summary = f"\nCompetitor context: {', '.join(r.get('name','') for r in rivals[:3])}"

    context = (
        f"Campaign: {plan.campaign_name}\n"
        f"Goal: {plan.goal}\n"
        f"Audience: {plan.target_audience}\n"
        f"Tone: {plan.tone}\n"
        f"Key messages: {'; '.join(plan.key_messages[:3])}"
        f"{intel_summary}"
    )

    response = llm.invoke([
        SystemMessage(content=agent.build_prompt(VOICE_PROMPT)),
        HumanMessage(content=context),
    ])

    try:
        data = extract_json(response.content.strip())
    except ValueError as e:
        agent_log("VOICE", f"JSON parse error: {e} — using fallback persona")
        data = {
            "system_instruction": (
                f"You are a friendly representative for {plan.campaign_name}. "
                "Keep responses short (1-2 sentences). Be helpful and natural."
            ),
            "opening_hook": f"Hi, this is a quick call from {plan.campaign_name}. Got a moment?",
            "key_talking_points": plan.key_messages[:3],
            "objection_handlers": {},
            "closing_goal": "Encourage checking email for details.",
            "voice_name": "Puck",
        }

    # ── Store persona in Redis for voice_daemon ───────────────────────────
    if REDIS_OK and _redis:
        try:
            _redis.set(
                f"voice_prompt:{campaign_id}",
                data.get("system_instruction", ""),
                ex=3600,
            )
            agent_log("VOICE", "System instruction stored in Redis.")
        except Exception as e:
            agent_log("VOICE", f"Redis write failed: {e}")

    # ── Resolve WebSocket URL (auto-discovered from daemon) ───────────────
    ws_url = _get_tunnel_url()
    daemon_available = ws_url is not None

    if daemon_available:
        agent_log("VOICE", f"Voice Daemon detected at: {ws_url}")
    else:
        agent_log("VOICE", "⚠ Voice Daemon not running — call will be skipped.")

    # ── Dispatch Call via Twilio ──────────────────────────────────────────
    sid   = os.getenv("TWILIO_ACCOUNT_SID")
    token = os.getenv("TWILIO_AUTH_TOKEN")
    from_ = os.getenv("TWILIO_FROM_NUMBER", "+16414018449")

    recipient = _normalize_phone(state.get("recipient_phone"))
    call_sid = None
    status = "skipped"
    reason_code = None

    if not recipient:
        agent_log("VOICE", "No recipient phone — skipping call.")
        status = "skipped"
        reason_code = "no_phone"
        call_sid = f"V-SKIP-{uuid.uuid4().hex[:8].upper()}"

    elif not sid or not token:
        agent_log("VOICE", "Twilio credentials missing — skipping call.")
        status = "skipped"
        reason_code = "no_twilio_creds"
        call_sid = f"V-SKIP-{uuid.uuid4().hex[:8].upper()}"

    elif not daemon_available:
        agent_log("VOICE", "Voice daemon offline — skipping call.")
        status = "skipped"
        reason_code = "daemon_offline"
        call_sid = f"V-SKIP-{uuid.uuid4().hex[:8].upper()}"

    else:
        # Real call: construct TwiML with <Connect><Stream>
        hook_escaped = (
            data.get("opening_hook", "Hello!")
            .replace("&", "&amp;")
            .replace('"', "&quot;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
        )

        twiml_payload = (
            '<?xml version="1.0" encoding="UTF-8"?>'
            "<Response>"
            "<Connect>"
            f'<Stream url="{ws_url}">'
            f'<Parameter name="campaign_id" value="{campaign_id}" />'
            f'<Parameter name="opening_hook" value="{hook_escaped}" />'
            "</Stream>"
            "</Connect>"
            "</Response>"
        )

        try:
            from twilio.rest import Client
            client = Client(sid, token)
            call = client.calls.create(
                to=recipient,
                from_=from_,
                twiml=twiml_payload,
            )
            status = call.status
            call_sid = call.sid
            agent_log("VOICE", f"✅ Call dispatched → {recipient} | SID: {call_sid}")
        except Exception as e:
            agent_log("VOICE", f"❌ Twilio Call Error: {e}")
            status = "failed"
            err_text = str(e)
            if "21219" in err_text:
                reason_code = "unverified_trial_number"
            elif "unverified" in err_text.lower():
                reason_code = "unverified_number"
            else:
                reason_code = "twilio_call_error"
            call_sid = f"V-FAIL-{uuid.uuid4().hex[:8].upper()}"

    # ── Terminal output ───────────────────────────────────────────────────
    divider()
    section("VOICE STRATEGY (Gemini 3.1 Live Preview — Bidirectional)")
    kv("Persona", data.get("system_instruction", "")[:80] + "...")
    kv("Opening Hook", data.get("opening_hook", "N/A"))
    kv("Voice", data.get("voice_name", "Puck"))

    section("TALKING POINTS")
    for pt in data.get("key_talking_points", []):
        print(f"  →  {pt}")

    if data.get("objection_handlers"):
        section("OBJECTION HANDLERS")
        for trigger, handler in data.get("objection_handlers", {}).items():
            print(f"  [{trigger}]  {handler}")

    section("CALL STATUS")
    kv("Provider", "Twilio Programmable Voice")
    kv("Daemon", ws_url or "offline")
    kv("Status", status)
    kv("Call SID", call_sid or "N/A")
    divider()

    # ── Publish to Kafka ──────────────────────────────────────────────────
    publish_event(
        topic=Topics.CONTACT_EVENTS,
        source_agent="voice_agent",
        payload={
            "event_type": "voice_call_dispatched",
            "campaign_id": campaign_id,
            "recipient": recipient or "none",
            "call_sid": call_sid,
            "status": status,
            "reason_code": reason_code,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )

    # ── Build result ──────────────────────────────────────────────────────
    v_result = {
        "provider": "twilio",
        "model": "gemini-2.5-flash-native-audio-latest",
        "status": status,
        "reason_code": reason_code,
        "call_sid": call_sid,
        "daemon_url": ws_url,
        "system_instruction": data.get("system_instruction"),
        "opening_hook": data.get("opening_hook"),
        "talking_points": data.get("key_talking_points", []),
        "voice_name": data.get("voice_name", "Puck"),
        "dispatched_at": datetime.now(timezone.utc).isoformat(),
    }

    trace_entry = {
        "agent": "voice_agent",
        "status": status,
        "call_sid": call_sid,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    return {
        **state,
        "voice_result": v_result,
        "current_step": "social_media_agent",
        "trace": state.get("trace", []) + [trace_entry],
    }
