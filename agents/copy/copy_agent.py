"""
MarketOS — Copy Agent
Generates scored email copy variants based on the campaign plan.
Produces complete HTML email templates ready for sending.

Production responsibilities (full system):
- Reads brand voice DB from PostgreSQL workspace.brand_guidelines
- Stores variants in PostgreSQL copy_variants table
- Writes winner to agent.copy_agent.results Kafka topic
- Integrates with readability scoring microservice

Demo mode: in-memory generation with scoring via LLM.
"""

import json
import os
from datetime import datetime, timezone

from langchain_core.messages import SystemMessage, HumanMessage

from agents.llm.llm_provider import get_llm
from schemas.campaign import CampaignPlan, CopyVariant, CopyOutput
from utils.logger import agent_log, step_banner, kv, section, divider, check_line
from utils.kafka_bus import publish_event, Topics
from utils.memory import episodic_memory, semantic_memory
from utils.json_utils import extract_json

try:
    import redis as redis_lib
    _redis = redis_lib.from_url(os.getenv("REDIS_URL", "redis://localhost:6379/0"), decode_responses=True)
    REDIS_AVAILABLE = True
except Exception:
    REDIS_AVAILABLE = False
    _redis = None

try:
    import psycopg2
    PG_AVAILABLE = True
except ImportError:
    PG_AVAILABLE = False

PG_DSN = os.getenv("DATABASE_URL", "postgresql://marketos:marketos_dev@localhost:5433/marketos")

WORKSPACE = os.getenv("WORKSPACE_ID", "default")

# ── System Prompt ────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are the Copy Agent for MarketOS — an expert email copywriter trained on thousands of high-converting marketing campaigns.

EXPERTISE:
- Writing subject lines with 35%+ open rates
- Crafting persuasive email bodies with clear value propositions
- Designing CTAs that drive measurable conversions
- Adapting tone precisely to brand and audience
- Scoring copy against industry benchmarks

YOUR TASK:
Generate exactly 2 email copy variants based on the campaign plan provided.
Each variant must have a DIFFERENT angle/hook while targeting the same goal.

VARIANT ANGLES:
- Variant 1: Benefit-led (lead with what the customer GAINS)
- Variant 2: Competitive Edge (directly address or contrast against rival weaknesses found in research)

MARKET DIFFERENTIATION:
You will be provided with <market_intelligence>. Use this to:
- Contrast your offering against mentioned competitors.
- Use a tone that stands out from industry norms identified.
- Highlight features that rivals are lacking.

HTML EMAIL REQUIREMENTS:
- Use clean, responsive inline-CSS HTML (max-width: 600px) using table-based layouts.
- DYNAMIC DESIGN: You are generating bespoke templates. Adapt the color palette, typography, margins, and layout style to perfectly match the campaign's intent, brand identity, and audience (e.g., moody luxury, bright skincare, festive holiday).
- MUST include a strong hero image component: `<img src="cid:hero_image" ...>`
- One clear CTA button (styled inline, contrasting brand color)
- Footer MUST NOT contain an "Unsubscribe" link or company address, as these will be automatically injected by the MarketOS compliance engine.
- COMPLIANCE MUST HAVE: You MUST explicitly state in the body or footer text that this is a "promotional email" or "advertisement" from the brand. (e.g. "This is a promotional email from [Brand]"). This ensures CANSPAM_004 compliance.
- BRAND SAFETY: Do NOT make unverifiable absolute claims (e.g. "100% guaranteed results", "the BEST"). This ensures BRAND_001 compliance.
- Never leave placeholder tokens in final HTML. Use realistic filler where needed.

SCORING CRITERIA (score 0–100):
- readability_score: Flesch-Kincaid grade level converted to 0-100 (higher = more readable for general audience)
- tone_alignment_score: How well the copy matches the requested tone (0-100)
- spam_risk_score: Lower is better. Check for spam trigger words, excessive caps, misleading subject
- estimated_open_rate: Industry benchmark adjusted for subject line quality (as percentage, e.g. 28.5)
- estimated_ctr: Estimated click-through rate (as percentage, e.g. 3.2)

OUTPUT RULES:
- Respond ONLY with valid JSON — no prose, no markdown code blocks
- HTML must be properly escaped inside the JSON string
- Unsplash Search Query: Provide a short 2-3 word `hero_image_query` for the Unsplash photo API (e.g. "autumn skincare" or "winter jacket").
- Gemini Imagen Prompt: Provide a highly descriptive `hero_image_prompt` (max 400 chars) as a fallback (e.g. "Minimalist 3D render of a Vitamin C bottle on bright orange pedestal..."). MUST specify NO TEXT, typography, or words.
- All scores must be numbers (not strings)

REQUIRED JSON SCHEMA:
{
  "variants": [
    {
      "variant_id": "V-001",
      "subject_line": "compelling subject line under 50 characters",
      "preview_text": "preview text under 90 characters (shown after subject in inbox)",
      "body_html": "<complete responsive HTML email here>",
      "body_text": "plain text version of the email body",
      "cta_text": "CTA button text",
      "cta_url": "https://example.com/offer",
      "hero_image_query": "autumn skincare",
      "hero_image_prompt": "A professional flat lay of organic skincare products with autumn leaves and golden lighting, high resolution, soft bokeh.",
      "readability_score": 82.0,
      "tone_alignment_score": 91.0,
      "spam_risk_score": 8.0,
      "estimated_open_rate": 31.5,
      "estimated_ctr": 4.2
    },
    { ... variant 2 ... }
  ],
  "selected_variant_id": "V-001",
  "selection_reasoning": "2–3 sentence explanation of why V-001 is selected over V-002",
  "brand_voice_notes": "notes on tone, vocabulary, and style choices made"
}"""

HTML_EMAIL_DESIGN_GUIDE = """
DESIGN INSTRUCTIONS:
Do not use a rigid generic template. Generate a tailored, high-end HTML design specific to the campaign intent, tone, and target audience. 

Visual Excellence Requirements:
1. Typography: Use clean sans-serif stacks (Inter, Roboto, Helvetica).
2. Card Layout: Use a modern "card" aesthetic with subtle border-radii (8-12px) and balanced padding.
3. Color Palette: Choose a theme-consistent, vibrant color palette (e.g., sleek dark themes with electric accents, or airy minimalist skincare themes). 
4. Components:
   - Preheader (subtle)
   - Brand Header Area
   - Hero Section: High-impact image (`<img src="cid:hero_image" ...>`)
   - Headline: Bold, readable typography
   - Value Prop: Clear, well-spaced body copy
   - Primary CTA: A "premium" button (inline-styled with border-radius, distinct brand color, and enough padding)
   - Footer: Branded, compliant (Unsubscribe, Address, Privacy)
5. Stylistic Rules: Use inline CSS only. Ensure max-width is 600px for mobile responsiveness.
"""


def _fallback_copy_output(plan: CampaignPlan) -> CopyOutput:
    """Return a safe deterministic fallback when LLM structured output fails."""
    message = plan.key_messages[0] if plan.key_messages else "Limited-time offer"
    audience = plan.target_audience or "our community"

    v1 = CopyVariant(
        variant_id="V-001",
        subject_line=f"{plan.campaign_name}: {message[:35]}",
        preview_text=f"Built for {audience}. Offer ends soon.",
        body_html=(
            "<html><body><h1>" + plan.campaign_name + "</h1>"
            f"<p>{message}</p>"
            "<p><a href=\"https://example.com/offer\">Claim Offer</a></p>"
            "<p><small>This is a promotional email from VoltX Energy Pvt. Ltd.</small></p>"
            "</body></html>"
        ),
        body_text=f"{plan.campaign_name}\n\n{message}\n\nClaim Offer: https://example.com/offer\n\nThis is a promotional email from VoltX Energy Pvt. Ltd.",
        cta_text="Claim Offer",
        cta_url="https://example.com/offer",
        hero_image_query="product launch",
        hero_image_prompt="Clean product hero visual, no text, studio lighting",
        readability_score=80.0,
        tone_alignment_score=85.0,
        spam_risk_score=10.0,
        estimated_open_rate=28.0,
        estimated_ctr=3.0,
    )

    v2 = CopyVariant(
        variant_id="V-002",
        subject_line=f"Why {plan.campaign_name} wins today",
        preview_text="A sharper alternative with a stronger value proposition.",
        body_html=(
            "<html><body><h1>Choose Better Value</h1>"
            f"<p>{message}</p>"
            "<p><a href=\"https://example.com/offer\">See the Deal</a></p>"
            "<p><small>This is a promotional email from VoltX Energy Pvt. Ltd.</small></p>"
            "</body></html>"
        ),
        body_text=f"Choose Better Value\n\n{message}\n\nSee the Deal: https://example.com/offer\n\nThis is a promotional email from VoltX Energy Pvt. Ltd.",
        cta_text="See the Deal",
        cta_url="https://example.com/offer",
        hero_image_query="competitive product",
        hero_image_prompt="Lifestyle product image, no text, high contrast",
        readability_score=78.0,
        tone_alignment_score=83.0,
        spam_risk_score=12.0,
        estimated_open_rate=26.0,
        estimated_ctr=2.8,
    )

    return CopyOutput(
        variants=[v1, v2],
        selected_variant_id=v1.variant_id,
        selection_reasoning="Fallback selected V-001 for clearer direct value proposition.",
        brand_voice_notes="Deterministic fallback copy used due to structured output parsing failure.",
    )


def _ensure_campaign_exists(plan: CampaignPlan) -> None:
    if not PG_AVAILABLE:
        return
    try:
        conn = psycopg2.connect(PG_DSN)
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO campaigns (
                    campaign_id, workspace_id, campaign_name, goal, target_audience,
                    channels, budget, timeline, tone, key_messages, status
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'running')
                ON CONFLICT (campaign_id) DO NOTHING
                """,
                (
                    plan.campaign_id,
                    WORKSPACE,
                    plan.campaign_name,
                    plan.goal,
                    plan.target_audience,
                    plan.channels,
                    plan.budget,
                    plan.timeline,
                    plan.tone,
                    plan.key_messages,
                ),
            )
        conn.commit()
        conn.close()
    except Exception as exc:
        agent_log("COPY", f"Campaign upsert failed: {exc}")


def _save_variants_to_db(campaign_id: str, variants: list[CopyVariant], selected_variant_id: str) -> None:
    if not PG_AVAILABLE or not variants:
        return

    rows = [
        (
            campaign_id,
            variant.variant_id,
            variant.subject_line,
            variant.preview_text,
            variant.body_html,
            variant.body_text,
            variant.cta_text,
            variant.readability_score,
            variant.tone_alignment_score,
            variant.spam_risk_score,
            variant.estimated_open_rate,
            variant.estimated_ctr,
            variant.variant_id == selected_variant_id,
        )
        for variant in variants
    ]

    try:
        conn = psycopg2.connect(PG_DSN)
        with conn.cursor() as cur:
            cur.executemany(
                """
                INSERT INTO copy_variants (
                    campaign_id, variant_id, subject_line, preview_text, body_html, body_text,
                    cta_text, readability_score, tone_alignment_score, spam_risk_score,
                    estimated_open_rate, estimated_ctr, is_winner
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (campaign_id, variant_id) DO NOTHING
                """,
                rows,
            )
        conn.commit()
        conn.close()
    except Exception as exc:
        agent_log("COPY", f"Variant DB write failed: {exc}")


# ── Agent Node ───────────────────────────────────────────────────────────────

def copy_agent_node(state: dict) -> dict:
    step_banner("COPY AGENT  ─  Email Copy Generation & Variant Scoring")

    plan_data = state.get("campaign_plan", {})
    plan = CampaignPlan(**plan_data)

    if "email" not in plan.channels:
        agent_log("COPY", "Skipping email copy generation because 'email' is not in channels.")
        return {
            **state,
            "current_step": "image_agent"
        }

    agent_log("COPY", f"Campaign: {plan.campaign_name}")
    agent_log("COPY", f"Tone requested: {plan.tone.upper()}")
    agent_log("COPY", f"Generating 2 copy variants (benefit-led + urgency-led)...")

    llm = get_llm(temperature=0.7)   # Slightly higher temp for creative copy

    # ── Fetch Market Intelligence ─────────────────────────────────────────
    intel = state.get("competitor_result", {}).get("intel", {})
    if not intel and REDIS_AVAILABLE and _redis:
        try:
            intel_key = f"market_intel:{WORKSPACE}:{plan.campaign_id}"
            raw = _redis.get(intel_key)
            if raw:
                intel = json.loads(raw)
                agent_log("COPY", "Fetched market intelligence from Redis pool")
        except Exception:
            pass

    intel_ctx = ""
    if intel:
        intel_ctx = f"""
MARKET INTELLIGENCE & COMPETITIVE LANDSCAPE:
Executive Summary: {intel.get('executive_summary', 'Neutral market state.')}
Key Competitors: {', '.join([c.get('name', 'Unknown') for c in intel.get('competitors', [])])}
Differentiation Strategy: Ensure the copy highlights why {plan.campaign_name} is superior to these specific rivals.
"""

    campaign_context = f"""
CAMPAIGN BRIEF:
- Name: {plan.campaign_name}
- Goal: {plan.goal}
- Target Audience: {plan.target_audience}
- Tone: {plan.tone}
{intel_ctx}

KEY MESSAGES TO INCORPORATE:
{chr(10).join(f'  {i+1}. {msg}' for i, msg in enumerate(plan.key_messages))}
"""

    messages = [
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=campaign_context),
    ]

    agent_log("COPY", "Calling LLM for copy generation...")
    # Using robust JSON extraction for maximum compatibility across Gemini versions
    response = llm.invoke(messages)

    try:
        data = extract_json(response.content.strip())
        variants = [CopyVariant(**v) for v in data.get("variants", [])]
        copy_output = CopyOutput(
            variants=variants,
            selected_variant_id=data.get("selected_variant_id", variants[0].variant_id if variants else "V-001"),
            selection_reasoning=data.get("selection_reasoning", ""),
            brand_voice_notes=data.get("brand_voice_notes", ""),
        )
    except Exception as e:
        error_msg = f"Copy Agent generation failed: {e}"
        agent_log("COPY", f"ERROR — {error_msg} — USING FALLBACK")
        copy_output = _fallback_copy_output(plan)

    variants = copy_output.variants
    if not variants:
        error_msg = "Copy Agent produced zero variants"
        return {**state, "errors": state.get("errors", []) + [error_msg], "current_step": "failed"}

    # Determine the selected variant
    selected = next(
        (v for v in variants if v.variant_id == copy_output.selected_variant_id),
        variants[0]
    )
    _ensure_campaign_exists(plan)
    _save_variants_to_db(plan.campaign_id, variants, copy_output.selected_variant_id)

    # ── Terminal Output ──────────────────────────────────────────────────────
    agent_log("COPY", f"✓ Generated {len(variants)} variant(s)")
    divider()

    for v in variants:
        is_winner = v.variant_id == selected.variant_id
        marker = f" ◀ SELECTED" if is_winner else ""
        section(f"VARIANT {v.variant_id}{marker}")
        kv("Subject Line",        f'"{v.subject_line}"')
        kv("Preview Text",        f'"{v.preview_text}"')
        kv("Image Query",         f'"{v.hero_image_query}"', "CYAN")
        kv("CTA",                 f'[{v.cta_text}]  →  {v.cta_url}')
        kv("Readability Score",   f"{v.readability_score:.1f} / 100")
        kv("Tone Alignment",      f"{v.tone_alignment_score:.1f} / 100")
        kv("Spam Risk",           f"{v.spam_risk_score:.1f} / 100  (lower = safer)")
        kv("Est. Open Rate",      f"{v.estimated_open_rate:.1f}%")
        kv("Est. CTR",            f"{v.estimated_ctr:.1f}%")
        print()

    section("SELECTION DECISION")
    print(f"  Winner: {selected.variant_id}  |  {copy_output.selection_reasoning}")
    if copy_output.brand_voice_notes:
        print(f"\n  Voice notes: {copy_output.brand_voice_notes}")

    divider()

    # ── Publish copy results to Kafka ─────────────────────────────────────
    publish_event(
        topic=Topics.COPY_RESULTS,
        source_agent="copy_agent",
        payload={
            "event":           "copy_generated",
            "campaign_id":     plan.campaign_id,
            "variants_count":  len(variants),
            "selected":        selected.variant_id,
            "subject_line":    selected.subject_line,
            "timestamp":       datetime.now(timezone.utc).isoformat(),
        },
    )

    # ── Store to episodic memory ──────────────────────────────────────────
    episodic_memory.store(
        agent_name="copy_agent",
        event_type="copy_generated",
        summary=(
            f"Generated {len(variants)} copy variants for '{plan.campaign_name}'. "
            f"Winner: {selected.variant_id} with subject '{selected.subject_line}'. "
            f"Open rate est: {selected.estimated_open_rate}%."
        ),
        metadata={
            "campaign_id": plan.campaign_id,
            "selected_variant": selected.variant_id,
            "subject_line": selected.subject_line,
        },
    )

    return {
        **state,
        "copy_output":  copy_output.model_dump(),
        "current_step": "compliance_agent",
        "trace": state.get("trace", []) + [{
            "agent":              "copy_agent",
            "status":             "completed",
            "variants_generated": len(variants),
            "selected_variant":   selected.variant_id,
            "timestamp":          datetime.now(timezone.utc).isoformat(),
        }],
    }
