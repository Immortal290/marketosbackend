"""
MarketOS — Personalization Agent
PRD: Called synchronously by Email/SMS Agent before every send. SLA < 3s/contact.

This agent is NOT a LangGraph node in the main pipeline — it is called
directly by email_agent.py as a sub-call for each recipient.

Sub-skills (beyond PRD):
  ContactProfileSkill  — fetches profile from Segment/CRM/PostgreSQL
  LanguageDetectSkill  — detects contact language, localises copy
  SegmentFallbackSkill — degrades gracefully to segment-level if profile thin
  TokenInjectorSkill   — injects {first_name}, {city}, etc. without LLM call for simple cases

Architecture decision: fast-path (token injection, no LLM) for contacts
with thin profiles; full LLM rewrite only for contacts with rich behavioural data.
This keeps the <3s SLA even at volume.
"""

from __future__ import annotations

import os
import re
import time
from typing import Optional

from langchain_core.messages import SystemMessage, HumanMessage

from agents.llm.llm_provider import get_llm
from utils.logger import agent_log
from utils.json_utils import extract_json
from core.agent_base import AgentBase

PERSONALIZATIONAGENT_SKILLS = [
    "marketing-psychology","customer-research","copywriting"
]

class PersonalizationAgent(AgentBase):
    def __init__(self):
        super().__init__("Personalization Agent", PERSONALIZATIONAGENT_SKILLS)


try:
    import psycopg2, psycopg2.extras
    PG_AVAILABLE = True
except ImportError:
    PG_AVAILABLE = False

PG_DSN    = os.getenv("DATABASE_URL", "postgresql://marketos:marketos_dev@localhost:5433/marketos")
WORKSPACE = os.getenv("DEFAULT_WORKSPACE_ID", "default")


# ── Sub-skill: Contact Profile ────────────────────────────────────────────────

class ContactProfileSkill:
    """Fetches contact profile from PostgreSQL contacts table."""

    @staticmethod
    def fetch(contact_id: str) -> dict:
        if not PG_AVAILABLE:
            return {}
        try:
            conn = psycopg2.connect(PG_DSN)
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute("""
                    SELECT contact_id, email, first_name, last_name,
                           city, country, language, segment,
                           last_purchase_days_ago, total_orders,
                           avg_order_value, email_opens_30d,
                           email_clicks_30d, preferred_time, tags
                    FROM contacts
                    WHERE contact_id = %s AND workspace_id = %s
                """, (contact_id, WORKSPACE))
                row = cur.fetchone()
            conn.close()
            return dict(row) if row else {}
        except Exception:
            return {}


# ── Sub-skill: Language Detection ────────────────────────────────────────────

class LanguageDetectSkill:
    """
    Determines the language to use for personalisation.
    Priority: contact.language → infer from country → default to campaign language.
    """

    COUNTRY_LANG = {
        "IN": "hi",  "US": "en", "GB": "en", "DE": "de",
        "FR": "fr",  "AE": "ar", "SA": "ar", "JP": "ja",
    }

    @classmethod
    def resolve(cls, contact: dict, campaign_language: str = "en") -> str:
        if contact.get("language"):
            return contact["language"]
        country = (contact.get("country") or "").upper()
        return cls.COUNTRY_LANG.get(country, campaign_language)


# ── Sub-skill: Token Injector (fast-path, no LLM) ─────────────────────────────

class TokenInjectorSkill:
    """
    Replaces {{first_name}}, {{city}}, {{segment}} tokens without LLM.
    Used as fast-path for contacts with minimal profile data.
    Also used as a post-processing step after LLM personalisation.
    """

    @staticmethod
    def _token_values(contact: dict) -> dict:
        return {
            "first_name": contact.get("first_name") or "there",
            "last_name": contact.get("last_name") or "",
            "city": contact.get("city") or "your city",
            "country": contact.get("country") or "",
            "segment": contact.get("segment") or "valued customer",
        }

    @staticmethod
    def inject(text: str, contact: dict) -> str:
        if not isinstance(text, str):
            return text

        token_values = TokenInjectorSkill._token_values(contact)

        def _replace(match: re.Match[str]) -> str:
            token_name = match.group(1).strip().lower()
            return str(token_values.get(token_name, match.group(0)))

        return re.sub(r"\{\{\s*([a-zA-Z0-9_]+)\s*\}\}", _replace, text)

    @staticmethod
    def strip_unresolved(text: str) -> str:
        if not isinstance(text, str):
            return text

        text = re.sub(r"\{\{\s*[^}]+\s*\}\}", "", text)
        text = re.sub(r"[ \t]+", " ", text)
        text = re.sub(r" *\n *", "\n", text)
        text = re.sub(r"\n{3,}", "\n\n", text)
        text = re.sub(r"\s+([,.;:!?])", r"\1", text)
        return text.strip()

    @staticmethod
    def resolve(text: str, contact: dict) -> str:
        return TokenInjectorSkill.strip_unresolved(TokenInjectorSkill.inject(text, contact))

    @staticmethod
    def profile_richness(contact: dict) -> float:
        """
        Returns 0-1 score indicating how much behavioural data we have.
        Score >= 0.4 → use full LLM personalisation.
        Score <  0.4 → use fast-path token injection only.
        """
        signals = [
            contact.get("first_name"),
            contact.get("city"),
            contact.get("segment"),
            contact.get("last_purchase_days_ago") is not None,
            contact.get("total_orders", 0) > 0,
            contact.get("email_opens_30d", 0) > 0,
            contact.get("email_clicks_30d", 0) > 0,
            contact.get("preferred_time"),
        ]
        return sum(1 for s in signals if s) / len(signals)


# ── Sub-skill: Segment Fallback ───────────────────────────────────────────────

class SegmentFallbackSkill:
    """
    When individual profile is too thin, fall back to segment-level
    personalisation using known segment characteristics.
    """

    SEGMENT_PERSONAS = {
        "high_intent": {
            "tone_hint":     "urgent and exclusive",
            "greeting":      "You're one step away",
            "pain_point":    "Don't miss this limited opportunity",
        },
        "lapsed": {
            "tone_hint":     "warm and re-engaging",
            "greeting":      "We've missed you",
            "pain_point":    "It's been a while — here's something special",
        },
        "loyal": {
            "tone_hint":     "appreciative and VIP",
            "greeting":      "Thank you for being with us",
            "pain_point":    "As one of our most valued customers",
        },
        "new": {
            "tone_hint":     "welcoming and educational",
            "greeting":      "Welcome to the family",
            "pain_point":    "Start your journey with us today",
        },
    }

    @classmethod
    def get_context(cls, segment: str) -> dict:
        return cls.SEGMENT_PERSONAS.get(segment, {
            "tone_hint":   "friendly",
            "greeting":    "Hello",
            "pain_point":  "Here's something we think you'll love",
        })


# ── System Prompt ─────────────────────────────────────────────────────────────

PERSONALIZATIONAGENT_EXPERTISE = """You are the Personalization Agent for MarketOS.

Your job: rewrite the provided email copy for one specific contact.
You must complete this in under 3 seconds — be efficient and focused.

WHAT YOU PERSONALISE:
1. Subject line — incorporate contact name, city, or behavioural signal if natural
2. Opening greeting — use first name + a relevant personal hook
3. Body — weave in 1-2 personalisation signals (recent purchase, engagement pattern, segment)
4. CTA — adjust urgency/tone to match contact's engagement level

RULES:
- Keep the core message and offer IDENTICAL — only personalise the framing
- Subject line must stay under 50 characters
- Do NOT add fake personalisation (do not invent facts about the contact)
- If a signal is absent, simply omit it — never use placeholder text
- Preserve all HTML structure — only change text content within tags

OUTPUT RULES: Respond ONLY with valid JSON.

SCHEMA:
{
  "subject_line": "personalised subject under 50 chars",
  "preview_text": "personalised preview under 90 chars",
  "body_html": "<complete personalised HTML — same structure as input>",
  "body_text": "personalised plain text",
  "cta_text": "personalised CTA",
  "personalization_signals": ["used first_name", "referenced last purchase 14 days ago"],
  "fallback_used": false
}"""


# ── Main Personalisation Function ─────────────────────────────────────────────

def personalize_for_contact(
    contact_id:      str,
    variant:         dict,
    campaign_plan:   dict,
    contact_data:    Optional[dict] = None,
) -> dict:
    """
    Personalise a copy variant for one contact.
    Called directly by email_agent — not a LangGraph node.

    Returns a personalised variant dict or the original on failure.
    SLA: < 3 seconds.
    """
    t0 = time.time()

    # Fetch profile if not provided
    if not contact_data:
        contact_data = ContactProfileSkill.fetch(contact_id)

    if not contact_data:
        contact_data = {"contact_id": contact_id}

    richness = TokenInjectorSkill.profile_richness(contact_data)
    language = LanguageDetectSkill.resolve(contact_data)

    agent_log("PERSONALIZATION", f"Contact {contact_id} | richness={richness:.2f} | lang={language}")

    # ── Fast path: token injection only ──────────────────────────────────
    if richness < 0.4:
        agent_log("PERSONALIZATION", "Fast-path: token injection (thin profile)")
        result = {
            **variant,
            "subject_line": TokenInjectorSkill.resolve(variant.get("subject_line", ""), contact_data),
            "preview_text":  TokenInjectorSkill.resolve(variant.get("preview_text", ""), contact_data),
            "body_html":     TokenInjectorSkill.resolve(variant.get("body_html", ""), contact_data),
            "body_text":     TokenInjectorSkill.resolve(variant.get("body_text", ""), contact_data),
            "cta_text":      TokenInjectorSkill.resolve(variant.get("cta_text", ""), contact_data),
            "personalization_signals": ["token_injection_only"],
            "fallback_used": True,
        }
        agent_log("PERSONALIZATION", f"Fast-path done in {(time.time()-t0)*1000:.0f}ms")
        return result

    # ── Full LLM personalisation ──────────────────────────────────────────
    segment_ctx = SegmentFallbackSkill.get_context(contact_data.get("segment", ""))

    contact_context = f"""
CONTACT PROFILE:
- Name: {contact_data.get('first_name', 'Unknown')} {contact_data.get('last_name', '')}
- City: {contact_data.get('city', 'unknown')}
- Segment: {contact_data.get('segment', 'general')}
- Last purchase: {contact_data.get('last_purchase_days_ago', 'unknown')} days ago
- Total orders: {contact_data.get('total_orders', 0)}
- Opens last 30d: {contact_data.get('email_opens_30d', 0)}
- Clicks last 30d: {contact_data.get('email_clicks_30d', 0)}
- Preferred time: {contact_data.get('preferred_time', 'unknown')}
- Segment persona tone: {segment_ctx.get('tone_hint', 'friendly')}
- Language: {language}

ORIGINAL COPY TO PERSONALISE:
Subject: {variant.get('subject_line', '')}
Preview: {variant.get('preview_text', '')}
CTA: {variant.get('cta_text', '')}

HTML BODY (personalise text within tags only):
{variant.get('body_html', '')[:3000]}
"""
    llm = get_llm(temperature=0.3)
    agent = PersonalizationAgent()

    messages = [
        SystemMessage(content=agent.build_prompt(PERSONALIZATIONAGENT_EXPERTISE)),
        HumanMessage(content=contact_context),
    ]

    try:
        response = llm.invoke(messages)
        data     = extract_json(response.content.strip())

        # Post-process: token injection as safety net
        data["subject_line"] = TokenInjectorSkill.resolve(data.get("subject_line", variant["subject_line"]), contact_data)
        data["preview_text"] = TokenInjectorSkill.resolve(data.get("preview_text", variant["preview_text"]), contact_data)
        data["body_html"] = TokenInjectorSkill.resolve(data.get("body_html", variant["body_html"]), contact_data)
        data["body_text"] = TokenInjectorSkill.resolve(data.get("body_text", variant["body_text"]), contact_data)
        data["cta_text"] = TokenInjectorSkill.resolve(data.get("cta_text", variant["cta_text"]), contact_data)

        elapsed = (time.time() - t0) * 1000
        agent_log("PERSONALIZATION", f"LLM personalisation done in {elapsed:.0f}ms")

        if elapsed > 3000:
            agent_log("PERSONALIZATION", f"⚠ SLA breach: {elapsed:.0f}ms > 3000ms target")

        return {
            **variant,
            "subject_line":           data.get("subject_line", variant["subject_line"]),
            "preview_text":           data.get("preview_text", variant["preview_text"]),
            "body_html":              data.get("body_html", variant["body_html"]),
            "body_text":              data.get("body_text", variant["body_text"]),
            "cta_text":               data.get("cta_text", variant["cta_text"]),
            "personalization_signals": data.get("personalization_signals", []),
            "fallback_used":          data.get("fallback_used", False),
        }

    except Exception as e:
        agent_log("PERSONALIZATION", f"LLM failed ({e}) — returning token-injected fallback")
        return {
            **variant,
            "subject_line": TokenInjectorSkill.resolve(variant.get("subject_line", ""), contact_data),
            "preview_text": TokenInjectorSkill.resolve(variant.get("preview_text", ""), contact_data),
            "body_html":    TokenInjectorSkill.resolve(variant.get("body_html", ""), contact_data),
            "body_text":    TokenInjectorSkill.resolve(variant.get("body_text", ""), contact_data),
            "cta_text":     TokenInjectorSkill.resolve(variant.get("cta_text", ""), contact_data),
            "personalization_signals": ["fallback_token_injection"],
            "fallback_used": True,
        }
