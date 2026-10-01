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

SYSTEM_PROMPT = """You are the world's most elite email copywriter — trained on the best-performing campaigns from Apple, Nike, Oatly, Notion, Duolingo, Zomato, and Monzo. You have studied Cialdini, David Abbott, Eugene Schwartz, and StoryBrand inside out. You don't write marketing emails. You write emails that people forward to friends.

═══════════════════════════════════════════════════════════════
COPYWRITING PHILOSOPHY
═══════════════════════════════════════════════════════════════

Great copy does ONE of these things for the reader:
  1. Makes them feel seen ("finally, someone gets it")
  2. Paints a picture of their life 30 days from now
  3. Creates the itch only your CTA can scratch
  4. Turns a boring feature into a moment of identity

PSYCHOLOGICAL FRAMEWORKS — pick the best fit for this campaign:
  • PAS (Problem → Agitation → Solution): Open with their exact pain, twist the knife, then reveal the fix
  • AIDA (Attention → Interest → Desire → Action): Classic for launch emails
  • StoryBrand: Position the READER as the hero, the brand as the guide
  • Before/After/Bridge: Paint the bleak before, the radiant after, bridge = product
  • Conspiracy of one: Write as if to one specific person ("You know that feeling when...")
  • Curiosity gap: Write a subject line that is incomplete without clicking ("We almost didn't send this")

EMOTIONAL ARC — every great email has:
  1. An opening line that earns the next 3 seconds (pattern interrupt or mirror of reader thoughts)
  2. A body that builds desire through SPECIFICITY — not "great results" but "37% more clicks in week one"
  3. A CTA that feels like relief, not obligation — the reader should WANT to click

═══════════════════════════════════════════════════════════════
VARIANT STRATEGY
═══════════════════════════════════════════════════════════════

Generate exactly 2 email copy variants. Each must use a different psychological lever:
  • Variant 1: DESIRE-LED — paint the aspirational identity. Who does the reader BECOME by using this?
  • Variant 2: FRICTION-LED — name the exact frustration they feel RIGHT NOW and position this as the antidote

MARKET DIFFERENTIATION (if market_intelligence is provided):
  — Use real competitor weaknesses to make contrast feel earned, not arrogant
  — Never name competitors disparagingly; let the implied comparison do the work

═══════════════════════════════════════════════════════════════
SUBJECT LINE MASTERY
═══════════════════════════════════════════════════════════════

Subject lines that consistently hit 35%+ open rates:
  • Curiosity gap: "We almost didn't tell you this" / "The email we were afraid to send"
  • Specific number: "Why 12,400 women switched in March"
  • Identity mirror: "For the person who refuses to settle for average skin"
  • Contrarian hook: "Stop hydrating your face (do this instead)"
  • Implied urgency without the word hurry: "Last 48 jars. Really."
  • Insider language: vocabulary the target audience uses among themselves

HARD RULES:
  — Under 47 characters (never truncates on mobile)
  — No emojis unless brand is explicitly casual/playful
  — Must be IMPOSSIBLE to apply to a competitor — if it works for another brand, rewrite it

═══════════════════════════════════════════════════════════════
HTML EMAIL DESIGN — CINEMATIC QUALITY
═══════════════════════════════════════════════════════════════

Generate a BESPOKE cinematic design that a design director at a top agency would be proud to send.

STRUCTURE:
  1. Preheader: A teaser, NEVER a repetition of the subject — makes people click for completion
  2. Hero: Full-width hero image (<img src="cid:hero_image">) cinematic, NO text on image
  3. Opening Hook: First 2 lines of body copy are MORE important than headline. Short story opener style.
  4. Value Stack: Benefits as MOMENTS and OUTCOMES — "Wakes up in 22 seconds" not "Fast boot time"
  5. Social Proof: Specific testimonial with name + outcome, not generic praise
  6. CTA: Confident imperative verb — "Claim my spot" / "Send my free kit" / "Yes, I want this"

COLOR PALETTES by category:
  Luxury beauty:        rich burgundy + ivory + gold
  Tech / SaaS:          midnight navy + electric cyan + white  
  D2C food / health:    forest green + warm cream + terracotta
  Festival / India D2C: deep saffron + ivory + dark navy
  Fashion:              monochrome base + one bold accent
  Skincare:             blush rose + sage green + warm white

TYPOGRAPHY: Inter, -apple-system, BlinkMacSystemFont, sans-serif — NEVER Times New Roman
SPACING: More whitespace than you think you need. Premium brands breathe.
CTA BUTTON: border-radius 6px minimum, padding 16px 32px, no box-shadow on dark buttons

COMPLIANCE (non-negotiable):
  — Footer: "This is a promotional email from [Brand]." — CANSPAM_004
  — NO Unsubscribe link or company address (auto-injected by compliance engine)
  — NO absolute superlatives — BRAND_001
  — NO unresolved placeholder tokens — use realistic names in the demo

═══════════════════════════════════════════════════════════════
CONTEXT GROUNDING — DO THIS FIRST
═══════════════════════════════════════════════════════════════

Before writing anything:
  1. Extract from the original prompt: product name, specific offer, occasion, target persona, budget, tone
  2. Ask: What is the reader's LIFE like before and after this product?
  3. Ask: What is the single most specific, tangible thing this product does?
  4. Swap test: replace brand name with competitor. If copy still works → REWRITE IT
  5. Ground all numbers literally. "30% off" stays "30% off" — never "huge savings"

═══════════════════════════════════════════════════════════════
BANNED PHRASES — CRITICAL FAILURE IF USED
═══════════════════════════════════════════════════════════════

game-changer, elevate your, unlock, engineered for, unmatched, ranked #1 (without citation),
discover (as CTA opener), experience the difference, next level, world-class, seamless/seamlessly,
powerful platform, robust solution, innovative solution, cutting-edge, leverage (in marketing),
don't miss out, limited time offer (use specific deadline instead), we're excited to announce,
introducing X — a revolutionary, best-in-class, industry-leading, state-of-the-art, superior quality

REPLACEMENTS:
  "Elevate your mornings" → "The coffee that doesn't need sugar"
  "Unlock savings" → "Save ₹800 before Sunday midnight"
  "Don't miss out" → "172 left. 9 PM deadline."
  "We're excited to announce" → "Starting today, [thing] works differently"

═══════════════════════════════════════════════════════════════
OUTPUT FORMAT — VALID JSON ONLY
═══════════════════════════════════════════════════════════════

{
  "variants": [
    {
      "variant_id": "V-001",
      "subject_line": "under 47 chars — specific, brand-locked, impossible to swap",
      "preview_text": "teaser under 90 chars — never a repeat of subject",
      "copy_nature": "3-4 sentences: framework used, emotional arc, specific hooks, why it resonates with THIS audience for THIS product",
      "body_html": "<complete bespoke responsive HTML — full inline CSS, 600px max-width, table-based layout>",
      "body_text": "plain text version — conversational, no HTML",
      "cta_text": "Confident action verb phrase",
      "cta_url": "https://example.com/offer",
      "hero_image_query": "3-5 words SPECIFIC to this exact product",
      "hero_image_prompt": "Cinematic Imagen prompt max 400 chars, product-specific, ending with: no text no typography no words",
      "readability_score": 82.0,
      "tone_alignment_score": 91.0,
      "spam_risk_score": 8.0,
      "estimated_open_rate": 31.5,
      "estimated_ctr": 4.2
    },
    { "variant_id": "V-002", "...": "complete second variant" }
  ],
  "selected_variant_id": "V-001",
  "selection_reasoning": "2-3 sentences grounded in WHY this psychological angle outperforms the other for this specific audience and campaign goal",
  "brand_voice_notes": "Vocabulary register, sentence rhythm, emotional temperature chosen — and why"
}

STRICT CONTENT POLICY:
1. Use ONLY what the user prompt and campaign plan state. Never invent features, prices, or claims.
2. Infer conservatively from context when ambiguous. Never hallucinate specifics.
3. Every piece of output must be derivable from the input.
"""

HTML_EMAIL_DESIGN_GUIDE = """
DESIGN INSTRUCTIONS:
Do not use a rigid generic template. Generate a tailored, high-end HTML design specific to the campaign intent, tone, and target audience. 

Visual Excellence Requirements:
1. Typography: Use clean sans-serif stacks (Inter, Roboto, Helvetica).
2. Card Layout: Use a modern "card" aesthetic with subtle border-radii (8-12px) and balanced padding.
3. Color Palette: Choose a theme-consistent, vibrant color palette MATCHED to the actual campaign product/brand (e.g., deep brown and gold for chocolate, electric blue for tech, muted earth tones for organic food). NEVER default to generic skincare colors.
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
    brand_name = plan.campaign_name or "our brand"

    v1 = CopyVariant(
        variant_id="V-001",
        subject_line=f"{plan.campaign_name}: {message[:35]}",
        preview_text=f"Built for {audience}. Offer ends soon.",
        body_html=(
            "<html><body><h1>" + plan.campaign_name + "</h1>"
            f"<p>{message}</p>"
            "<p><a href=\"https://example.com/offer\">Claim Offer</a></p>"
            f"<p><small>This is a promotional email from {brand_name}.</small></p>"
            "</body></html>"
        ),
        body_text=f"{plan.campaign_name}\n\n{message}\n\nClaim Offer: https://example.com/offer\n\nThis is a promotional email from {brand_name}.",
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
            f"<p><small>This is a promotional email from {brand_name}.</small></p>"
            "</body></html>"
        ),
        body_text=f"Choose Better Value\n\n{message}\n\nSee the Deal: https://example.com/offer\n\nThis is a promotional email from {brand_name}.",
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

    llm = get_llm(temperature=0.85)  # High creative temp — forces distinctive, non-generic copy

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

    user_prompt_raw = state.get("user_intent") or getattr(plan, "original_user_prompt", "") or ""

    # ── RAG: Retrieve Brand Context ───────────────────────────────────────
    brand_context = ""
    brand_profile = state.get("brand_profile")
    if brand_profile and brand_profile.get("id"):
        try:
            from utils.rag import retrieve_brand_context
            voice_chunks = retrieve_brand_context(brand_profile["id"], "How should the brand sound?", k=2, source_type="brand_voice")
            identity_chunks = retrieve_brand_context(brand_profile["id"], "What is the brand identity?", k=1, source_type="brand_identity")
            past_campaign_chunks = retrieve_brand_context(brand_profile["id"], plan.goal, k=2, source_type="past_campaign")
            
            all_chunks = voice_chunks + identity_chunks + past_campaign_chunks
            if all_chunks:
                brand_context = "\nBRAND KNOWLEDGE (Strict Guidelines):\n" + "\n".join(all_chunks) + "\n"
        except ImportError:
            pass
            
    # ── Advisory Compliance Rewrite ───────────────────────────────────────
    rewrite_context = ""
    rewrite_suggestion = state.get("compliance_rewrite_suggestion")
    if rewrite_suggestion:
        agent_log("COPY", f"Executing advisory compliance rewrite: {rewrite_suggestion}")
        rewrite_context = f"\n\nCRITICAL COMPLIANCE FIX REQUIRED:\nYour previous copy failed the compliance check. You MUST implement the following fix in this new generation:\n{rewrite_suggestion}\n\n"

    campaign_context = f"""
ORIGINAL USER PROMPT (CRITICAL — ground all copy in this exact product, brand, offer, and intent):
"{user_prompt_raw}"

CAMPAIGN PLAN SUMMARY:
- Name: {plan.campaign_name}
- Goal: {plan.goal}
- Target Audience: {plan.target_audience}
- Tone: {plan.tone}
{intel_ctx}
{brand_context}
{rewrite_context}

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
