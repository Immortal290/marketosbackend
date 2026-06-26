"""
MarketOS — Email Agent
Executes the compliance-approved campaign.
Sends a real email via SMTP (Gmail App Password) when credentials are present.
Falls back gracefully if SMTP is not configured.

Production responsibilities (full system):
- Sends via SendGrid primary, falls back to AWS SES on bounce spike
- Calls Personalization Agent per-contact before each send (< 3s SLA)
- Publishes delivery events to Kafka contact.events topic
- Triggers A/B Test Agent when 100+ opens threshold reached
- Schedules drip sequence via campaign drip_scheduler
"""

from __future__ import annotations

import asyncio
import os
import uuid
from datetime import datetime, timezone

from langchain_core.messages import SystemMessage, HumanMessage

from agents.llm.llm_provider import get_llm
from agents.personalization.personalization_agent import personalize_for_contact
from schemas.campaign import CampaignPlan, CopyOutput, CopyVariant, SendResult
from utils.logger import agent_log, step_banner, kv, section, divider, success_banner
from utils.json_utils import extract_json
from utils.kafka_bus import publish_event, Topics
from utils.memory import episodic_memory
from utils.sendgrid_mailer import send_email
from core.agent_base import AgentBase

EMAILAGENT_SKILLS = [
    "email-sequence","copy-editing"
]

class EmailAgent(AgentBase):
    def __init__(self):
        super().__init__("Email Agent", EMAILAGENT_SKILLS)


try:
    import psycopg2
    PG_AVAILABLE = True
except ImportError:
    PG_AVAILABLE = False

PG_DSN = os.getenv("DATABASE_URL", "postgresql://marketos:marketos_dev@localhost:5433/marketos")
WORKSPACE = os.getenv("DEFAULT_WORKSPACE_ID", "default")


# ── System Prompt ────────────────────────────────────────────────────────────

EMAILAGENT_EXPERTISE = """You are the Email Agent for MarketOS — responsible for campaign execution and delivery strategy.

ROLE:
Given a compliance-approved campaign, determine the optimal send strategy and structure a 3-email drip sequence for non-converters.

OPTIMAL SEND TIME:
- India B2C (general): Tuesday–Thursday, 10:00 AM IST or 8:00 PM IST
- India B2C (young adults 18–30): Tuesday–Thursday, 8:00–10:00 PM IST
- Professional / SaaS: Tuesday–Wednesday, 10:00–11:00 AM IST

DRIP SEQUENCE:
Design 3 follow-up emails with increasing urgency for non-converters.
Each must have a distinct angle (re-engagement, social proof, final urgency).

OUTPUT RULES:
- Respond ONLY with valid JSON — no prose, no markdown

REQUIRED JSON SCHEMA:
{
  "status": "SENT",
  "optimal_send_time": "Tuesday 10:00 AM IST",
  "next_drip_trigger": "72 hours post-send to non-openers",
  "drip_sequence_preview": [
    "Day 3 — Re-engagement: '<subject>' — Resend to non-openers with tweaked subject",
    "Day 7 — Social proof: '<subject>' — Testimonials email to openers who didn't click",
    "Day 14 — Final urgency: '<subject>' — Offer expiry email to all non-converters"
  ]
}"""

DEFAULT_DRIP_SEQUENCE = [
    "Day 3 — Re-engagement: resend to non-openers with a refreshed subject line.",
    "Day 7 — Social proof: send testimonials to openers who did not click.",
    "Day 14 — Final urgency: send offer-expiry email to remaining non-converters.",
]


# Delivery function replaced by utils.sendgrid_mailer.send_email


async def _personalize_batch(contacts: list[dict], selected: CopyVariant, campaign_plan: dict) -> list[dict]:
    semaphore = asyncio.Semaphore(10)

    async def _personalize(contact: dict) -> dict:
        async with semaphore:
            return await asyncio.to_thread(
                personalize_for_contact,
                contact_id=contact.get("contact_id") or contact.get("email") or "default",
                variant=selected.model_dump(),
                campaign_plan=campaign_plan,
                contact_data=contact or None,
            )

    return await asyncio.gather(*[_personalize(contact) for contact in contacts])


def _seed_ab_variant_stats(
    campaign_id: str,
    workspace_id: str,
    variants: list[CopyVariant],
    total_sends: int,
) -> None:
    if not PG_AVAILABLE or not variants:
        return

    split = max(total_sends, 0)
    base_sends, remainder = divmod(split, len(variants))
    rows = []
    for index, variant in enumerate(variants):
        sends = base_sends + (1 if index < remainder else 0)
        rows.append((campaign_id, workspace_id, variant.variant_id, sends))

    try:
        conn = psycopg2.connect(PG_DSN)
        with conn.cursor() as cur:
            cur.executemany(
                """
                INSERT INTO ab_variant_stats
                    (campaign_id, workspace_id, variant_id, sends, opens, clicks, conversions)
                VALUES (%s, %s, %s, %s, 0, 0, 0)
                ON CONFLICT (campaign_id, variant_id) DO UPDATE
                SET sends = ab_variant_stats.sends + EXCLUDED.sends,
                    updated_at = NOW()
                """,
                rows,
            )
        conn.commit()
        conn.close()
    except Exception as exc:
        agent_log("EMAIL", f"A/B stats seed failed: {exc}")


def _record_email_send_cost(campaign_id: str, workspace_id: str, sends: int) -> None:
    if not PG_AVAILABLE:
        return

    cost = sends * 0.50
    try:
        conn = psycopg2.connect(PG_DSN)
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO campaign_spend (campaign_id, workspace_id, channel, amount_inr, conversions)
                VALUES (%s, %s, 'email', %s, 0)
                """,
                (campaign_id, workspace_id, cost),
            )
        conn.commit()
        conn.close()
    except Exception as exc:
        agent_log("EMAIL", f"Spend record failed (non-fatal): {exc}")


# ── Agent Node ───────────────────────────────────────────────────────────────

def email_agent_node(state: dict) -> dict:
    step_banner("EMAIL AGENT  ─  Campaign Execution & Real Send")

    plan_data  = state.get("campaign_plan", {})
    copy_data  = state.get("copy_output")
    comp_data  = state.get("compliance_result", {})

    if not copy_data:
        err = "Email Agent: missing copy_output in state"
        return {**state, "errors": state.get("errors", []) + [err], "current_step": "failed"}

    plan       = CampaignPlan(**plan_data)
    copy_out   = CopyOutput(**copy_data)
    compliance_score = comp_data.get("compliance_score", 100.0)

    # Resolve selected variant
    selected_id = copy_out.selected_variant_id
    selected: CopyVariant = next(
        (v for v in copy_out.variants if v.variant_id == selected_id),
        copy_out.variants[0],
    )
    contact_list = state.get("contact_list") or []
    bulk_mode = len(contact_list) > 1

    agent_log("EMAIL", f"Campaign   : {plan.campaign_name}")
    agent_log("EMAIL", f"Variant    : {selected.variant_id}  —  \"{selected.subject_line}\"")
    agent_log("EMAIL", f"Compliance : {compliance_score:.1f}/100  ✅ cleared")

    # ── LLM for send strategy ────────────────────────────────────────────
    llm = get_llm(temperature=0)

    agent = EmailAgent()


    messages = [
        SystemMessage(content=agent.build_prompt(EMAILAGENT_EXPERTISE)),
        HumanMessage(content=(
            f"Campaign: {plan.campaign_name}\n"
            f"Goal: {plan.goal}\n"
            f"Audience: {plan.target_audience}\n"
            f"Timeline: {plan.timeline}\n"
            f"Subject: \"{selected.subject_line}\"\n"
            f"CTA: \"{selected.cta_text}\"\n\n"
            f"Generate optimal send time and 3-email drip sequence."
        )),
    ]

    agent_log("EMAIL", "Generating send strategy...")
    response = llm.invoke(messages)

    try:
        data = extract_json(response.content.strip())
    except ValueError as e:
        err = f"Email Agent JSON parse failed: {e}"
        agent_log("EMAIL", f"ERROR — {err}")
        return {**state, "errors": state.get("errors", []) + [err], "current_step": "failed"}

    message_id = f"MSG-{str(uuid.uuid4())[:12].upper()}"

    # ── Build SendResult (no delivery simulation — that's Analytics Agent's job) ──
    send_result = SendResult(
        campaign_id=plan.campaign_id,
        status=data.get("status", "SENT"),
        provider="SMTP / SendGrid",
        message_id=message_id,
        optimal_send_time=data.get("optimal_send_time", "Tuesday 10:00 AM IST"),
        next_drip_trigger=data.get("next_drip_trigger"),
        drip_sequence_preview=data.get("drip_sequence_preview") or DEFAULT_DRIP_SEQUENCE,
    )

    # ── Terminal: strategy output ────────────────────────────────────────
    agent_log("EMAIL", f"✓ Message ID: {message_id}")
    divider()

    section("SEND CONFIRMATION")
    kv("Campaign ID",       send_result.campaign_id)
    kv("Message ID",        send_result.message_id)
    kv("Status",            f"🚀 {send_result.status}")
    kv("Optimal Send Time", send_result.optimal_send_time)

    section("DRIP SEQUENCE QUEUED")
    kv("Next Trigger", send_result.next_drip_trigger or "72h post-send")
    for i, drip in enumerate(send_result.drip_sequence_preview, 1):
        print(f"\n  {i}.  {drip}")

    # ── Real email send ──────────────────────────────────────────────────
    real_result = {"sent": False, "error": "no recipient configured"}
    recipient   = state.get("recipient_email")
    workspace_id = state.get("workspace_id") or WORKSPACE
    contact_id = state.get("contact_id") or recipient or "default"
    personalized = {
        "subject_line": selected.subject_line,
        "body_html": selected.body_html,
        "personalization_signals": ["not_applied"],
    }

    if bulk_mode:
        try:
            personalized_batch = asyncio.run(_personalize_batch(contact_list, selected, plan_data))
            personalized = next(
                (
                    item for item, contact in zip(personalized_batch, contact_list)
                    if (contact.get("contact_id") or contact.get("email")) == contact_id
                ),
                personalized_batch[0],
            )
            kv("Personalization", f"batch mode ({len(personalized_batch)} contacts): {', '.join(personalized.get('personalization_signals', [])) or 'none'}")
        except Exception as exc:
            agent_log("EMAIL", f"Batch personalization failed: {exc}")
    else:
        personalized = personalize_for_contact(
            contact_id=contact_id,
            variant=selected.model_dump(),
            campaign_plan=plan_data,
            contact_data=None,
        )
        kv("Personalization", ", ".join(personalized.get("personalization_signals", [])) or "none")

    if recipient:
        divider()
        section("REAL EMAIL DELIVERY")
        agent_log("EMAIL", f"Sending to {recipient}...")

        real_result = send_email(
            to_email           = recipient,
            subject            = personalized.get("subject_line", selected.subject_line),
            html_content       = personalized.get("body_html", selected.body_html),
            sender_name        = state.get("sender_name", "MarketOS"),
            campaign_id        = plan.campaign_id,
            hero_image_base64  = copy_out.hero_image_base64,
        )

        if real_result.get("sent"):
            provider = real_result.get("provider", "Unknown")
            kv("Real Email", f"✅ SENT ({provider}) → {recipient}")
        else:
            kv("Real Email", f"❌ {real_result.get('error', 'unknown error')}")

        agent_log("EMAIL", "Skipped writing local email_preview.html to prevent LiveServer refresh.")

    divider()
    success_banner(send_result.campaign_id, plan.campaign_name)

    # Merge real-send status into result dict
    result_dict = send_result.model_dump()
    result_dict["real_email_sent"]   = real_result.get("sent", False)
    result_dict["real_email_status"] = "sent" if real_result.get("sent") else real_result.get("error", "not_attempted")
    result_dict["recipient_count"] = max(int(data.get("recipient_count", 1) or 1), 1)
    result_dict["simulated_recipients"] = result_dict["recipient_count"]
    result_dict["personalization_signals"] = personalized.get("personalization_signals", [])

    if real_result.get("sent"):
        _record_email_send_cost(
            campaign_id=plan.campaign_id,
            workspace_id=workspace_id,
            sends=result_dict["recipient_count"],
        )

    _seed_ab_variant_stats(
        campaign_id=plan.campaign_id,
        workspace_id=workspace_id,
        variants=copy_out.variants,
        total_sends=result_dict["recipient_count"],
    )

    # ── Publish to Kafka ────────────────────────────────────────────────
    publish_event(
        topic=Topics.CONTACT_EVENTS,
        source_agent="email_agent",
        payload={
            "event":        "email_sent",
            "event_type":   "email_sent",
            "campaign_id":  plan.campaign_id,
            "workspace_id": workspace_id,
            "contact_id":   contact_id,
            "message_id":   message_id,
            "recipient":    recipient or "none",
            "real_sent":    real_result.get("sent", False),
            "subject":      selected.subject_line,
            "provider":     real_result.get("provider", send_result.provider),
            "timestamp":    datetime.now(timezone.utc).isoformat(),
        },
    )

    publish_event(
        topic=Topics.SEND_STATS,
        source_agent="email_agent",
        payload={
            "campaign_id": plan.campaign_id,
            "channel":     "email",
            "provider":    "smtp",
            "real_sent":   real_result.get("sent", False),
            "timestamp":   datetime.now(timezone.utc).isoformat(),
        },
    )

    # ── Store to episodic memory ──────────────────────────────────────────
    episodic_memory.store(
        agent_name="email_agent",
        event_type="email_sent",
        summary=(
            f"Email campaign '{plan.campaign_name}' sent. "
            f"Subject: '{selected.subject_line}'. "
            f"Strategy: {data.get('optimal_send_time', 'N/A')}. "
            f"Real delivery: {'YES' if real_result.get('sent') else 'NO'}."
        ),
        metadata={
            "campaign_id": plan.campaign_id,
            "message_id": message_id,
            "real_sent": real_result.get("sent", False),
        },
    )

    return {
        **state,
        "send_result":  result_dict,
        "current_step": "complete",
        "trace": state.get("trace", []) + [{
            "agent":           "email_agent",
            "status":          "sent",
            "message_id":      message_id,
            "campaign_id":     plan.campaign_id,
            "real_email_sent": real_result.get("sent", False),
            "real_email_to":   recipient,
            "timestamp":       datetime.now(timezone.utc).isoformat(),
        }],
    }
