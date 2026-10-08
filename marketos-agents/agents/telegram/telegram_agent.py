"""
MarketOS — Telegram Agent
Generates a short advertisement message (≤ 1024 chars) with an image prompt,
then posts it to a Telegram channel via:
  1. Composio TELEGRAM_SEND_MESSAGE action (primary)
  2. Direct Telegram Bot API (fallback if Composio not configured)

Environment variables required:
  COMPOSIO_API_KEY          — Composio platform API key
  TELEGRAM_BOT_TOKEN        — Your Telegram Bot token (BotFather)
  TELEGRAM_CHANNEL_ID       — e.g. @YourChannelUsername or -100xxxxxxxxxxxx

Image generation:
  The agent generates an image_prompt string. If FLUX image agent has already
  produced a hero_image_base64, it is sent as a photo caption post.
  Otherwise the message is sent as text only.
"""

from __future__ import annotations

import os
import base64
import uuid
from datetime import datetime, timezone
from typing import Optional

from langchain_core.messages import SystemMessage, HumanMessage

from agents.llm.llm_provider import get_llm
from utils.agent_base import AgentBase
from utils.kafka_bus import publish_event, Topics
from utils.memory import episodic_memory
from utils.logger import agent_log, step_banner, kv, section, divider

# ── Environment ──────────────────────────────────────────────────────────────

COMPOSIO_API_KEY    = os.getenv("COMPOSIO_API_KEY", "")
TELEGRAM_BOT_TOKEN  = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHANNEL_ID = os.getenv("TELEGRAM_CHANNEL_ID", "")

TELEGRAM_AGENT_SKILLS = ["copywriting", "social-content", "marketing-psychology"]

# ── System Prompt ─────────────────────────────────────────────────────────────

TELEGRAM_SYSTEM_PROMPT = """You are a Telegram channel advertising specialist.

Your task: Write ONE short Telegram advertisement message for a product/service.

STRICT RULES:
- Maximum 280 characters for the caption (shown under the image).
- Maximum 1024 characters for text-only posts.
- Start with a punchy ONE-LINE hook (emoji optional — max 2 emojis total).
- Include ONE clear call-to-action (CTA) with a URL placeholder if not given: [LINK]
- No invented discounts, prices, or facts not in the brief.
- End with relevant 2–4 hashtags.
- Write in the requested tone and language.

Also provide a short IMAGE PROMPT (max 50 words) for generating a product/lifestyle image.

Return ONLY valid JSON with this schema:
{
  "message": "<the telegram ad text>",
  "image_prompt": "<50-word DALL-E / FLUX prompt describing the visual>",
  "hashtags": ["#tag1", "#tag2"],
  "char_count": <integer>
}
"""


# ── Composio helper ───────────────────────────────────────────────────────────

def _send_via_composio(channel_id: str, text: str) -> dict:
    """
    Use Composio's TELEGRAM_SEND_MESSAGE action to post to a channel.
    Requires COMPOSIO_API_KEY and a connected Telegram integration in Composio.
    """
    try:
        from composio_langchain import ComposioToolSet, Action  # type: ignore
        toolset = ComposioToolSet(api_key=COMPOSIO_API_KEY)
        tools = toolset.get_tools(actions=[Action.TELEGRAM_SEND_MESSAGE])  # type: ignore

        # Execute the action directly
        result = toolset.execute_action(
            action=Action.TELEGRAM_SEND_MESSAGE,
            params={
                "chat_id": channel_id,
                "text": text,
                "parse_mode": "HTML",
            },
            connected_account_id="ca_WpoPDvF0cbTz"
        )
        return {"sent": True, "provider": "composio", "result": result}
    except Exception as exc:
        return {"sent": False, "provider": "composio", "error": str(exc)}


def _send_via_bot_api(
    bot_token: str, channel_id: str, text: str, photo_b64: Optional[str] = None
) -> dict:
    """
    Direct Telegram Bot API send.
    Sends photo with caption if photo_b64 provided, else plain text message.
    """
    import urllib.request, json as _json

    base_url = f"https://api.telegram.org/bot{bot_token}"

    try:
        if photo_b64:
            # Send as photo + caption
            photo_bytes = base64.b64decode(photo_b64)

            import io, urllib.parse
            boundary = "----TelegramBoundary"
            body_parts = []
            # chat_id field
            body_parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"chat_id\"\r\n\r\n{channel_id}".encode())
            # caption field
            caption = text[:1024]
            body_parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"caption\"\r\n\r\n{caption}".encode())
            # photo field
            body_parts.append(
                f"--{boundary}\r\nContent-Disposition: form-data; name=\"photo\"; filename=\"ad.jpg\"\r\nContent-Type: image/jpeg\r\n\r\n".encode()
                + photo_bytes
            )
            body_parts.append(f"--{boundary}--\r\n".encode())
            body = b"\r\n".join(body_parts)

            req = urllib.request.Request(
                f"{base_url}/sendPhoto",
                data=body,
                headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
                method="POST",
            )
        else:
            payload = _json.dumps({
                "chat_id": channel_id,
                "text": text[:4096],
                "parse_mode": "HTML",
            }).encode("utf-8")
            req = urllib.request.Request(
                f"{base_url}/sendMessage",
                data=payload,
                headers={"Content-Type": "application/json"},
                method="POST",
            )

        with urllib.request.urlopen(req, timeout=15) as resp:
            resp_data = _json.loads(resp.read())
            if resp_data.get("ok"):
                return {
                    "sent": True,
                    "provider": "telegram_bot_api",
                    "message_id": resp_data.get("result", {}).get("message_id"),
                }
            return {
                "sent": False,
                "provider": "telegram_bot_api",
                "error": resp_data.get("description", "Unknown Telegram error"),
            }

    except Exception as exc:
        return {"sent": False, "provider": "telegram_bot_api", "error": str(exc)}


# ── Agent ─────────────────────────────────────────────────────────────────────

class TelegramAgent(AgentBase):
    agent_name          = "telegram_agent"
    reflection_enabled  = False
    temperature         = 0.8

    def execute(self, state: dict) -> dict:
        step_banner("TELEGRAM AGENT  ─  Ad Generation & Channel Post")

        plan_data   = state.get("campaign_plan", {})
        copy_data   = state.get("copy_output") or {}
        image_b64   = (state.get("copy_output") or {}).get("hero_image_base64")

        channel_id  = state.get("telegram_channel_id") or TELEGRAM_CHANNEL_ID
        bot_token   = state.get("telegram_bot_token") or TELEGRAM_BOT_TOKEN
        language    = state.get("language", "English")
        tone        = plan_data.get("tone", "Friendly")

        campaign_name = plan_data.get("campaign_name", "Campaign")
        goal          = plan_data.get("goal", "awareness")
        audience      = plan_data.get("target_audience", "general audience")
        product       = plan_data.get("product_name") or state.get("company_name", "")
        cta_url       = state.get("cta_url", "[LINK]")

        # ── Build brief for LLM ──────────────────────────────────────────────
        brief = (
            f"Campaign: {campaign_name}\n"
            f"Goal: {goal}\n"
            f"Product/Service: {product}\n"
            f"Target Audience: {audience}\n"
            f"Tone: {tone}\n"
            f"Language: {language}\n"
            f"CTA URL: {cta_url}\n"
        )

        if copy_data.get("variants"):
            variant = copy_data["variants"][0]
            brief += f"Copy hook: {variant.get('subject_line', '')}\n"
            brief += f"Body (excerpt): {str(variant.get('body_html', ''))[:300]}\n"

        agent_log("TELEGRAM", f"Brief:\n{brief}")

        # ── LLM call ─────────────────────────────────────────────────────────
        llm = get_llm(temperature=self.temperature)

        messages = [
            SystemMessage(content=TELEGRAM_SYSTEM_PROMPT),
            HumanMessage(content=f"Brief:\n{brief}\n\nWrite the Telegram ad now."),
        ]

        agent_log("TELEGRAM", "Generating ad message...")
        response = llm.invoke(messages)

        # ── Parse JSON ───────────────────────────────────────────────────────
        from utils.json_utils import extract_json
        try:
            data = extract_json(response.content.strip())
            tg_message   = data.get("message", "").strip()
            image_prompt = data.get("image_prompt", "")
            hashtags     = data.get("hashtags", [])
        except Exception as e:
            agent_log("TELEGRAM", f"JSON parse failed: {e} — using raw text")
            tg_message   = response.content.strip()[:1024]
            image_prompt = ""
            hashtags     = []

        if not tg_message:
            tg_message = f"🚀 {campaign_name}\n\n{goal}\n\n{cta_url}"

        section("TELEGRAM AD CONTENT")
        kv("Message", tg_message[:120] + ("..." if len(tg_message) > 120 else ""))
        kv("Image Prompt", image_prompt[:80] + "..." if len(image_prompt) > 80 else image_prompt)
        kv("Hashtags", " ".join(hashtags))
        kv("Channel", channel_id or "(not configured)")

        # ── Send to channel ──────────────────────────────────────────────────
        send_result = {"sent": False, "provider": "none", "error": "no channel configured"}

        if channel_id:
            if COMPOSIO_API_KEY:
                agent_log("TELEGRAM", "Sending via Composio...")
                send_result = _send_via_composio(channel_id, tg_message)
                if not send_result.get("sent") and bot_token:
                    agent_log("TELEGRAM", f"Composio failed ({send_result.get('error')}) — falling back to Bot API")
                    send_result = _send_via_bot_api(bot_token, channel_id, tg_message, image_b64)
            elif bot_token:
                agent_log("TELEGRAM", "Sending via Telegram Bot API...")
                send_result = _send_via_bot_api(bot_token, channel_id, tg_message, image_b64)
            else:
                agent_log("TELEGRAM", "⚠️  No COMPOSIO_API_KEY or TELEGRAM_BOT_TOKEN — skipping real send")
        else:
            agent_log("TELEGRAM", "⚠️  No TELEGRAM_CHANNEL_ID — skipping real send")

        if send_result.get("sent"):
            kv("Send Status", f"✅ SENT via {send_result.get('provider')}")
        else:
            kv("Send Status", f"⚠️  {send_result.get('error', 'not sent')}")

        divider()

        result = {
            "telegram_message": tg_message,
            "telegram_image_prompt": image_prompt,
            "telegram_hashtags": hashtags,
            "telegram_channel_id": channel_id,
            "telegram_sent": send_result.get("sent", False),
            "telegram_provider": send_result.get("provider", "none"),
            "telegram_message_id": send_result.get("message_id"),
            "telegram_error": send_result.get("error"),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        # ── Kafka event ──────────────────────────────────────────────────────
        publish_event(
            topic=Topics.CONTACT_EVENTS,
            source_agent="telegram_agent",
            payload={
                "event":        "telegram_sent",
                "event_type":   "telegram_sent",
                "campaign_id":  plan_data.get("campaign_id", ""),
                "channel_id":   channel_id,
                "sent":         send_result.get("sent", False),
                "provider":     send_result.get("provider", "none"),
                "timestamp":    datetime.now(timezone.utc).isoformat(),
            },
        )

        # ── Episodic memory ──────────────────────────────────────────────────
        episodic_memory.store(
            agent_name="telegram_agent",
            event_type="telegram_sent",
            summary=(
                f"Telegram ad for '{campaign_name}' generated. "
                f"Sent: {send_result.get('sent', False)}. "
                f"Provider: {send_result.get('provider', 'none')}."
            ),
            metadata={"campaign_id": plan_data.get("campaign_id", "")},
        )

        return {
            **state,
            "telegram_result": result,
            "current_step": "complete",
            "trace": state.get("trace", []) + [{
                "agent":       "telegram_agent",
                "status":      "sent" if send_result.get("sent") else "generated",
                "sent":        send_result.get("sent", False),
                "provider":    send_result.get("provider", "none"),
                "timestamp":   datetime.now(timezone.utc).isoformat(),
            }],
        }


telegram_agent = TelegramAgent()


def telegram_agent_node(state: dict) -> dict:
    return telegram_agent.execute(state)
