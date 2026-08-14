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

VOICE_PROMPT = """You are the Voice Agent for MarketOS — the conversational architect for real-time outbound voice AI (via Twilio + Gemini Live).

Your task is to prepare a deeply nuanced conversational persona, strict behavioral guardrails, and a strategic script outline for the AI to follow. Do NOT provide generic 1-liners.

VOICE PERSONA & SCRIPT RULES:
- The `system_instruction` MUST be a comprehensive paragraph detailing the AI's identity, tone, pacing, and strict instructions on what it can/cannot say.
- Always instruct the AI to identify itself by name and company within the first sentence and ask a polite check-in question (e.g., "Did I catch you at a bad time?").
- The AI must keep every response concise (under 15 seconds speaking time) and end with an open-ended question to maintain conversational momentum.
- Objection handling must be specific. Provide at least 3 distinct, multi-sentence objection handling tactics (e.g., "busy", "too expensive", "already use a competitor").
- The closing goal must explicitly define what constitutes a successful call (e.g., verbal agreement to a meeting, explicit permission to send an SMS).

OUTPUT REQUIRED:
Respond ONLY with valid JSON — no prose, no markdown fences.
{
  "system_instruction": "You are Kore, a consultative and energetic sales development representative for [Company]. Your tone is warm, professional, and entirely unscripted-sounding. You are calling to [Campaign Goal]. Rule 1: Never talk for more than 15 seconds at a time. Rule 2: If asked a question you don't know, say 'That's a great question, I'll have an account executive text you the exact answer.' Rule 3: Never use hard-sell tactics; act as a helpful advisor.",
  "opening_hook": "Hi [Name], this is Kore calling from [Company]. I know I'm calling out of the blue — did I catch you in the middle of something?",
  "key_talking_points": [
    "Acknowledge their recent engagement (e.g., downloaded the pricing guide).",
    "Highlight the primary value proposition specific to their segment.",
    "Ask an open-ended discovery question about their current process."
  ],
  "objection_handlers": {
    "busy": "I completely understand, I'll let you go. I'll shoot you a quick SMS with my direct number so you can reach out when things calm down. Fair enough?",
    "not_interested": "No problem at all. Just out of curiosity, is it because you already have a solution in place, or is it just not a priority right now?",
    "price_concern": "I hear you, budget is always top of mind. What if I could show you how this actually reduces your current tooling spend by 20%? Would it be worth a 5-minute look?"
  },
  "closing_goal": "Get the prospect to verbally confirm a date and time for a 15-minute follow-up demo, and confirm their email address for the calendar invite.",
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
    llm = get_llm(temperature=0.85)  # High creative temp — natural, human-sounding voice scripts

    agent_log("VOICE", f"Campaign: {plan.campaign_name}")

    # ── Generate voice persona via LLM ────────────────────────────────────
    market_intel = state.get("competitor_result", {})
    intel_summary = ""
    if market_intel:
        rivals = market_intel.get("competitors", [])
        if rivals:
            intel_summary = f"\nCompetitor context: {', '.join(r.get('name','') for r in rivals[:3])}"

    user_prompt_raw = state.get("user_intent") or getattr(plan, "original_user_prompt", "") or ""

    context = (
        f"ORIGINAL USER PROMPT (CRITICAL — Voice script must be grounded in this exact product/offer):\n"
        f"\"{user_prompt_raw}\"\n\n"
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
