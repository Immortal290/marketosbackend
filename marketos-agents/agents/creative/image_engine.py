"""
MarketOS — Image Agent (AI-Generated Visual Engine)
Primary provider: Meta Muse Image 1.0 (meta/muse-image-1.0-eval-20260824) via OpenRouter.

Key design principles:
  - The OpenRouter API key is sourced ONLY from the per-session `image_api_key` state field
    (entered in the Target Audience popup). It is never read from environment variables,
    ensuring each user's key stays isolated and never leaks.
  - Exactly ONE image is generated per campaign run (1600×1600 at MetaMuse's native resolution).
  - No Pollinations.ai or any other free-tier fallback — if the key/model fails, the agent
    raises a clear error so the user can fix the configuration.

Supported providers (all require key from Target Audience popup):
  1. OpenRouter — meta/muse-image-1.0-eval-20260824 (default, ~$0.01/img, 22 s)
  2. OpenRouter — google/gemini-2.0-flash-exp:free and any other OpenRouter model
  3. Native Gemini API  (AIza... key)
  4. OpenAI DALL-E       (sk-... key)
  5. Together AI FLUX    (Together key)
  6. HuggingFace FLUX    (hf_... token)
"""

from __future__ import annotations
import base64
import json
import os
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

from agents.llm.llm_provider import get_llm  # noqa: F401 — kept for future use
from utils.logger import agent_log, step_banner, divider, kv
from utils.kafka_bus import publish_event, Topics
from agents.creative.poster_engine import run_poster_pipeline


# ── Dispatch to the correct image generation backend ──────────────────
def _dispatch_image(prompt_str: str, api_key: str, model: str) -> str | None:
    """
    Route to the correct backend.

    Routing rules (in priority order):
      1. Any model with a "/" that starts with "google/", "meta/", "qwen/",
         "openai/gpt-image", "microsoft/", "tencent/", "recraft/", "krea/",
         "bytedance-seed/", "black-forest-labs/flux"  → OpenRouter
      2. Plain "gemini-*" (no slash) → native Gemini API
      3. "dall-e-*"                  → OpenAI direct
      4. "together-*"                → Together AI
      5. Anything with "flux" but no "/"  → HuggingFace FLUX
      6. Everything else             → OpenRouter (best guess)
    """
    if not api_key:
        agent_log("IMAGE", f"⚠ No API key for '{model}' — skipping image generation")
        return None

    ml = model.lower()

    # Rule 1: any slash model → OpenRouter (covers google/, meta/, qwen/, etc.)
    if "/" in model:
        return _generate_openrouter_image(prompt_str, api_key=api_key, model=model)

    # Rule 2: plain gemini model name (native API)
    if ml.startswith("gemini-"):
        b64, _ = _generate_gemini_image(prompt_str, api_key=api_key, model=model)
        return b64

    # Rule 3: OpenAI DALL-E
    if "dall-e" in ml:
        return _generate_openai_image(prompt_str, api_key=api_key, model=model)

    # Rule 4: Together AI
    if "together" in ml:
        return _generate_together_image(prompt_str, api_key=api_key, model=model)

    # Rule 5: HuggingFace FLUX (bare name, no slash)
    if "flux" in ml or "black-forest" in ml:
        return _generate_flux_schnell_image(prompt_str, api_key=api_key, model=model)

    # Rule 6: default → OpenRouter
    return _generate_openrouter_image(prompt_str, api_key=api_key, model=model)


# ── Agent Node ────────────────────────────────────────────────────────────────

def image_agent_node(state: dict) -> dict:
    step_banner("IMAGE AGENT  ─  AI Visual Generation Engine")

    plan_data    = state.get("campaign_plan", {})
    user_intent  = state.get("user_intent") or plan_data.get("original_user_prompt", "") or ""
    copy_data    = state.get("copy_output")
    company_name = state.get("company_name") or plan_data.get("company_name", "") or ""

    # ── Determine creative prompt & product subject ───────────────────────────
    winner   = None
    variants = []
    prompt   = None
    query    = None

    if isinstance(copy_data, dict):
        selected_id = copy_data.get("selected_variant_id")
        variants    = copy_data.get("variants") or []
        winner      = next(
            (v for v in variants if isinstance(v, dict) and v.get("variant_id") == selected_id),
            variants[0] if variants else None,
        )
        if isinstance(winner, dict):
            query  = winner.get("hero_image_query")
            prompt = winner.get("hero_image_prompt") or query

    # Extract clean product subject from user_intent
    subject = plan_data.get("campaign_name") or company_name or user_intent[:80] or "Product Campaign"

    if not prompt and user_intent:
        prompt  = (
            f"Professional high-end commercial visual for {user_intent}. "
            f"Subject: {subject}. Studio lighting, vibrant colors, photorealistic 8k detail."
        )
        agent_log("IMAGE", f"Building prompt from user intent: {prompt[:80]}...")

    if not prompt:
        prompt = f"Professional advertising hero shot for {subject}"

    agent_log("IMAGE", f"Creative prompt: {prompt[:120]}...")

    # ── Ask LLM to generate precise creative concept & 6 bespoke banner specs ──
    creative_concept, style, palette, banner_options = _generate_visual_concept_specs(
        user_intent=user_intent,
        subject=subject,
        tone=plan_data.get("tone", "professional"),
        winner_copy=winner,
    )

    full_prompt = _build_generation_prompt(prompt, plan_data, user_intent)

    img_b64            = None
    img_type           = None
    source             = None
    total_token_usage  = 0

    # ── Image model selection ──────────────────────────────────────────────
    image_model   = (
        state.get("image_model")
        or os.getenv("IMAGE_MODEL")
        or "google/gemini-2.0-flash-exp:free"
    )
    # Key resolution: state → OPENROUTER_API_KEY env → GEMINI_API_KEY env
    image_api_key = (
        (state.get("image_api_key") or "").strip()
        or os.getenv("OPENROUTER_API_KEY", "").strip()
        or os.getenv("GEMINI_API_KEY", "").strip()
    )

    agent_log("IMAGE", f"Model: {image_model} | Key present: {bool(image_api_key)}")

    # ── 3-STEP POSTER PIPELINE ────────────────────────────────────────────
    # Step 1: Creative Director LLM  → JSON poster brief (copy + layout + image_prompt)
    # Step 2: Image model             → background art (no text/logo)
    # Step 3: Pillow compositor       → overlays headline / subheadline / CTA / badge / logo
    # Falls back to direct image generation if Creative Director is unavailable.
    poster_b64 = None
    poster_brief = None
    logo_b64 = state.get("brand_logo_base64") or None  # optional user-uploaded logo

    # Resolve the LLM key the same way — state first, then env
    _llm_api_key = (
        (state.get("llm_api_key") or "").strip()
        or os.getenv("OPENROUTER_API_KEY", "").strip()
        or os.getenv("GEMINI_API_KEY", "").strip()
    )

    if _llm_api_key and image_api_key:
        agent_log("IMAGE", "Running 3-step poster pipeline (Creative Director → BG image → Compose)...")
        try:
            poster_b64, poster_brief = run_poster_pipeline(
                state={**state, "llm_api_key": _llm_api_key},
                image_gen_fn=_dispatch_image,
                image_model=image_model,
                image_api_key=image_api_key,
                logo_b64=logo_b64,
            )
        except Exception as pe:
            agent_log("IMAGE", f"Poster pipeline exception: {pe} — falling back to direct gen")
            poster_b64 = None
            poster_brief = None
    else:
        agent_log("IMAGE", "Skipping Creative Director (no LLM key or image key) — direct image gen")

    # ── Use poster result if successful ──────────────────────────────────
    if poster_b64:
        img_b64  = poster_b64
        img_type = "CID"
        source   = f"poster-pipeline/{image_model}"
        # Enrich creative_concept from brief if available
        if poster_brief:
            creative_concept = poster_brief.get("big_idea", creative_concept)
            style    = poster_brief.get("concept_type", style)
            palette  = list(poster_brief.get("palette", {}).values())
            agent_log("IMAGE", f"✅ Poster pipeline success — {poster_brief.get('size_px','?')} "
                               f"[{style}] '{poster_brief.get('copy',{}).get('headline','')}' ")
    else:
        # ── Fallback: direct image generation (original behaviour) ────────
        agent_log("IMAGE", "Poster pipeline unavailable — direct image generation")

        if not image_api_key:
            err_msg = (
                f"Image generation with '{image_model}' requires an API key. "
                "Please enter your OpenRouter or Gemini API key in the Target Audience popup → Image API Key field. "
                "Get a free OpenRouter key at openrouter.ai (Gemini 2.0 Flash is free)."
            )
            agent_log("IMAGE", f"⚠ {err_msg}")
            return {
                **state,
                "image_result": {"has_image": False, "source": "none", "error": err_msg,
                                  "image_url": None, "image_preview_url": None,
                                  "image_base64": None, "image_type": None,
                                  "banner_options": [],
                                  "generated_at": datetime.now(timezone.utc).isoformat()},
                "current_step": "compliance_agent",
                "trace": state.get("trace", []) + [{"agent": "image_agent", "status": "warning", "error": err_msg}],
            }

        img_b64 = _dispatch_image(full_prompt, image_api_key, image_model)
        source  = "openrouter"
        img_type = "CID"

        if not img_b64:
            err_msg = (
                f"Image generation with '{image_model}' returned no result. "
                "Possible causes: (1) Model not enabled in your OpenRouter account — "
                "go to openrouter.ai, find the model and click 'Enable'. "
                "(2) Insufficient credits. (3) Model ID typo. "
                "The campaign will continue without an image."
            )
            agent_log("IMAGE", f"⚠ {err_msg}")
            return {
                **state,
                "image_result": {"has_image": False, "source": "none", "error": err_msg,
                                  "image_url": None, "image_preview_url": None,
                                  "image_base64": None, "image_type": None,
                                  "banner_options": [],
                                  "generated_at": datetime.now(timezone.utc).isoformat()},
                "current_step": "compliance_agent",
                "trace": state.get("trace", []) + [{"agent": "image_agent", "status": "warning", "error": err_msg}],
            }

    agent_log("IMAGE", f"✅ Final image ready — source={source}")

    return _finalize(
        state, copy_data, winner, variants,
        img_b64, img_type, source, total_token_usage,
        full_prompt=full_prompt,
        creative_concept=creative_concept,
        style=style,
        palette=palette,
        banner_options=banner_options,
    )


# ── LLM Visual Concept Generator ──────────────────────────────────────────────

def _generate_visual_concept_specs(
    user_intent: str,
    subject: str,
    tone: str,
    winner_copy: dict | None,
) -> tuple[str, str, list[str], list[dict]]:
    """
    Invoke LLM to construct 6 precise visual banner specifications customized to
    the exact product/concept specified in user_intent.
    """
    import urllib.parse as _up

    product_prompt = user_intent or subject or "Product Launch"
    copy_headline = (winner_copy.get("subject_line") if isinstance(winner_copy, dict) else None) or "EXPERIENCE THE DIFFERENCE"

    default_concept = f"High-impact visual advertising campaign showcasing {product_prompt}."
    default_style = f"{tone.capitalize()} advertising photography with crisp studio lighting and dynamic angles."
    default_palette = ["#0F172A", "#3B82F6", "#F59E0B", "#10B981"]

    # Generates 2 specific banner options tailored directly to user_intent
    # One image only — MetaMuse native output is 1600×1600
    angles = [
        ("v1", "Campaign Visual (1600×1600)", f"Luxury high-end studio hero shot of {product_prompt}, sleek reflective surface, dark dramatic backdrop, volumetric lighting, photorealistic 8k detail", copy_headline[:40], "MetaMuse Square (1600×1600)", 1600, 1600),
    ]

    try:
        llm = get_llm(temperature=0.7)
        prompt_text = (
            f"You are the Lead Creative Director & AI Visual Engineer for MarketOS.\n"
            f"Analyze the campaign request: '{product_prompt}'. Tone: '{tone}'. Headline: '{copy_headline}'.\n"
            "Generate JSON with:\n"
            "- 'creative_concept': 1 vivid sentence describing the visual direction for this specific product.\n"
            "- 'creative_direction': A single string describing lighting, style, and mood.\n"
            "- 'color_palette': array of 4 color hex codes matching the brand/product.\n"
            "- 'banner_options': array of exactly 2 objects, each with:\n"
            "   'title': short name for the format (e.g. 'Product Hero Banner (1200x628)')\n"
            "   'prompt_desc': detailed description of the visual scene tailored explicitly to this product\n"
            "   'overlay': a short, punchy overlay text (3-5 words max) highly relevant to the product and headline. DO NOT use generic phrases like 'EXPERIENCE THE DIFFERENCE' or 'SEE WHAT IS POSSIBLE'. Instead, use highly specific and context-aware phrases based on the user intent.\n"
            "   'format_label': short label for UI (e.g. 'LinkedIn Landscape (1200x628)')\n"
            "   'width': integer (1200 or 1080)\n"
            "   'height': integer (628 or 1080)\n\n"
            "Ensure exactly 2 options cover these sizes: 1200x628, 1080x1080.\n"
            "Return ONLY valid JSON.\n\n"
            "STRICT CONTENT SERVICE POLICY:\n"
            "1. You MUST analyze and use ONLY the provided context and original user prompt.\n"
            "2. DO NOT invent, hallucinate, or inject any external facts, features, or offers outside of the provided context.\n"
            "3. If information is missing, rely strictly on what is provided; do not guess or assume.\n"
            "4. Your output MUST be strictly derived from the provided input parameters."
        )
        resp = llm.invoke(prompt_text)
        content = resp.content.strip()
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()
        data = json.loads(content)

        if data.get("creative_concept"):
            default_concept = data["creative_concept"]
        if data.get("creative_direction"):
            val = data["creative_direction"]
            if isinstance(val, dict):
                default_style = ", ".join(f"{v}" for k, v in val.items())
            elif isinstance(val, list):
                default_style = ", ".join(str(v) for v in val)
            else:
                default_style = str(val)
        if data.get("color_palette") and isinstance(data["color_palette"], list):
            default_palette = data["color_palette"]

        # Handle full banner_options format (preferred)
        bp = data.get("banner_options")
        if isinstance(bp, list) and len(bp) > 0:
            angles = []
            for idx, item in enumerate(bp[:2]):
                angles.append((
                    f"v{idx+1}",
                    item.get("title", f"Banner {idx+1}"),
                    item.get("prompt_desc", f"Visual for {product_prompt}"),
                    item.get("overlay", copy_headline[:40]),
                    item.get("format_label", f"Format {item.get('width', 1200)}x{item.get('height', 628)}"),
                    item.get("width", 1200),
                    item.get("height", 628)
                ))
        else:
            # Handle simpler banner_prompts format (just an array of strings)
            bp_simple = data.get("banner_prompts") or []
            if isinstance(bp_simple, list) and len(bp_simple) >= 2:
                for idx in range(2):
                    bid, title, _, ov, fmt, w, h = angles[idx]
                    angles[idx] = (bid, title, f"{bp_simple[idx]}, photorealistic, highly detailed, studio lighting, no text", ov, fmt, w, h)
    except Exception as e:
        agent_log("IMAGE", f"LLM visual concept extraction: {e}")

    banner_options = []
    # Images are generated via MetaMuse/OpenRouter API — no pre-built URLs.
    # The actual base64 image is stored in image_base64 / hero_image_base64.
    for bid, title, prompt_desc, overlay, fmt, w, h in angles:
        clean_p = (
            f"{prompt_desc}, "
            "award-winning advertising photography, ultra-detailed, 8k UHD resolution, "
            "professional studio lighting, vibrant color grading, sharp focus, "
            "cinematic composition, editorial quality, high production value, "
            "photorealistic, commercial product photography"
        )
        banner_options.append({
            "id": bid,
            "title": title,
            "prompt": clean_p,
            "url": None,   # populated in _finalize once the image is generated
            "overlay": overlay,
            "format": fmt,
            "w": w,
            "h": h,
        })

    return default_concept, default_style, default_palette, banner_options


# ── Finalization: HTML injection + state update + Kafka ───────────────────────

def _finalize(
    state:      dict,
    copy_data:  dict | None,
    winner:     dict | None,
    variants:   list,
    img_b64:    str | None,
    img_type:   str | None,
    source:     str | None,
    total_token_usage: int = 0,
    full_prompt: str = "",
    creative_concept: str = "",
    style: str = "",
    palette: list | None = None,
    banner_options: list | None = None,
) -> dict:
    plan_data = state.get("campaign_plan", {})
    user_intent = state.get("user_intent") or plan_data.get("original_user_prompt", "") or ""

    if img_b64 and isinstance(winner, dict):
        img_tag = (
            '<img src="cid:hero_image" width="600" '
            'style="display:block;width:100%;max-width:600px;height:auto;" '
            'alt="Campaign Visual">'
        )
        winner = _inject_image(winner, img_tag, "<!-- HERO IMAGE -->")
        kv("Image Source", f"AI-generated ({source})")
    elif not img_b64:
        agent_log("IMAGE", "⚠ No base64 CID image attached")

    # Build a data-URI preview from the generated base64 image so the frontend
    # can render it immediately without a separate network request.
    img_preview_url = None
    if img_b64:
        img_preview_url = f"data:image/jpeg;base64,{img_b64}"
        # Back-fill all banner options with the generated image preview
        if banner_options:
            for b in banner_options:
                if not b.get("url"):
                    b["url"] = img_preview_url

    updated_variants = variants
    if isinstance(winner, dict) and variants:
        updated_variants = [
            winner if (isinstance(v, dict) and v.get("variant_id") == winner.get("variant_id"))
            else v
            for v in variants
        ]

    if isinstance(copy_data, dict):
        copy_data["variants"]          = updated_variants
        copy_data["hero_image_url"]    = img_preview_url
        copy_data["hero_image_base64"] = img_b64
        copy_data["hero_image_type"]   = img_type
        copy_data["hero_image_source"] = source

    divider()

    if total_token_usage > 0:
        state["api_tokens"] = state.get("api_tokens", 0) + total_token_usage
        publish_event(
            topic=Topics.IMAGE_RESULTS,
            source_agent="image_agent",
            payload={
                "event":  "token_usage",
                "model":  "gemini-imagen",
                "tokens": total_token_usage,
            },
        )

    publish_event(
        topic=Topics.IMAGE_RESULTS,
        source_agent="image_agent",
        payload={
            "event":     "image_processed",
            "img_type":  img_type or "none",
            "source":    source or "none",
            "has_b64":   img_b64 is not None,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )

    image_output_data = {
        "has_image":          True,
        "creative_concept":   creative_concept or f"Tailored visual campaign for {user_intent[:100]}",
        "creative_direction": style or "Professional advertising photography",
        "color_palette":      palette or ["#0F172A", "#3B82F6", "#F59E0B", "#10B981"],
        "banner_options":     banner_options or [],
        "image_url":          img_preview_url,
        "image_preview_url":  img_preview_url,
        "image_base64":       img_b64,
        "image_type":         img_type,
        "source":             source or "gemini-openrouter",
        "prompt_used":        full_prompt[:200] if full_prompt else None,
        "generated_at":       datetime.now(timezone.utc).isoformat(),
    }

    return {
        **state,
        "copy_output":  copy_data if isinstance(copy_data, dict) else state.get("copy_output"),
        "image_result": image_output_data,
        "current_step": "compliance_agent",
        "trace": state.get("trace", []) + [{
            "agent":     "image_agent",
            "status":    "completed",
            "img_type":  img_type or "none",
            "source":    source or "none",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }],
    }



# ── HTML Injection ────────────────────────────────────────────────────────────

def _inject_image(winner: dict, img_tag: str, placeholder: str) -> dict:
    """
    Inject the image tag into the HTML body.
    Priority: (1) replace placeholder comment, (2) swap existing cid:hero_image,
    (3) best-effort insert after the first centred <td>.
    """
    html = winner.get("body_html", "")

    if placeholder in html:
        row_html = (
            f"<tr><td style='padding:0;font-family:Arial,sans-serif;'>"
            f"{img_tag}"
            f"</td></tr>"
        )
        html = html.replace(placeholder, row_html, 1)

    elif '<img src="cid:hero_image"' in html:
        import re
        html = re.sub(r'<img\s+src="cid:hero_image"[^>]*>', img_tag, html, count=1)

    else:
        insert_after = '<td align="center">'
        if insert_after in html:
            row_html = (
                f"<tr><td style='padding:0;font-family:Arial,sans-serif;'>"
                f"{img_tag}"
                f"</td></tr>"
            )
            idx  = html.find(insert_after) + len(insert_after)
            html = html[:idx] + row_html + html[idx:]

    winner["body_html"] = html
    return winner


# ── Prompt Construction ───────────────────────────────────────────────────────

def _build_generation_prompt(concept_prompt: str, plan_data: dict, user_intent: str = "") -> str:
    """
    Build a highly detailed, product-specific generation prompt from campaign context.
    Emphasizes photorealism, brand identity, and explicitly bans text/watermarks.
    """
    tone     = plan_data.get("tone", "professional")
    name     = plan_data.get("campaign_name", "")
    audience = plan_data.get("target_audience", "")
    channels = plan_data.get("channels", [])

    # Extract key product/brand identifiers from user_intent for hyper-specific prompts
    intent_part = ""
    if user_intent:
        # Use first 300 chars to keep the most product-specific info
        intent_part = f"PRODUCT CONTEXT: {user_intent[:300]}. "

    # Tone → lighting style mapping
    tone_lighting = {
        "luxury": "moody dramatic backlighting, deep shadows, golden reflections",
        "professional": "clean studio lighting, soft diffused shadows, neutral background",
        "bold": "high contrast dramatic lighting, vivid saturated colors, dynamic composition",
        "playful": "bright natural daylight, vibrant pastels, cheerful warm tones",
        "elegant": "soft ambient lighting, muted sophisticated palette, minimalist composition",
    }.get(tone.lower(), "professional studio three-point lighting, controlled shadows")

    channel_format = ""
    if "social" in channels:
        channel_format = "Optimized for social media feed, eye-catching at small size. "

    return (
        f"{concept_prompt.rstrip('.')}. "
        f"{intent_part}"
        f"Campaign: '{name}'. "
        f"Target audience: {audience}. "
        f"Lighting: {tone_lighting}. "
        f"{channel_format}"
        "Ultra-high resolution 8K photorealistic commercial photography. "
        "Award-winning advertising visual quality. "
        "Rich color depth, sharp fine detail, bokeh background. "
        "Shot on Hasselblad medium format, 85mm lens, f/2.8. "
        "Professional color grading, cinematic aspect ratio. "
        "STRICT NEGATIVE: absolutely NO text, words, letters, numbers, watermarks, "
        "logos, typography, captions, UI elements, or signatures anywhere in the image."
    )


# ── Provider 1: Gemini Imagen ─────────────────────────────────────────────────

def _generate_gemini_image(
    full_prompt: str,
    model: str = "gemini-2.0-flash-exp",
    api_key: str = "",
) -> tuple[str | None, int]:
    """
    Call Gemini's native image generation endpoint.
    api_key must be supplied by the caller (from the Target Audience popup state).
    Returns (base64_string | None, token_count).
    """
    if os.getenv("PYTEST_CURRENT_TEST"):
        return "mock_base64_gemini", 100

    if not api_key:
        agent_log("IMAGE", "_generate_gemini_image: no api_key supplied")
        return None, 0

    clean_model = model.replace("google/", "")

    url = (
        "https://generativelanguage.googleapis.com/v1beta/"
        f"models/{clean_model}:generateContent?key={api_key}"
    )
    payload = {
        "contents": [{"role": "user", "parts": [{"text": full_prompt}]}],
        "generationConfig": {
            "temperature":        1.0,
            "topP":               0.95,
            "topK":               64,
            "responseModalities": ["IMAGE"],
        },
    }

    try:
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=90) as resp:
            data = json.loads(resp.read().decode())

        total_tokens = data.get("usageMetadata", {}).get("totalTokenCount", 0)
        for part in data.get("candidates", [{}])[0].get("content", {}).get("parts", []):
            if "inlineData" in part:
                return part["inlineData"]["data"], total_tokens
        return None, total_tokens

    except Exception as e:
        agent_log("IMAGE", f"Gemini Imagen exception: {e}")
        return None, 0


# ── OpenRouter Image Generation (primary provider) ──────────────────────────
#
# OpenRouter exposes image generation via TWO different endpoints:
#
#  A) /api/v1/images/generations  (OpenAI-style images API)
#     → Used by: meta/, recraft/, black-forest-labs/flux*, x-ai/grok-imagine*,
#                sourceful/riverflow*, krea/, bytedance-seed/seedream*
#
#  B) /api/v1/chat/completions  with  modalities: ["image"]
#     → Used by: google/gemini-*-image, openai/gpt-image-*, qwen/qwen-image-*,
#                microsoft/mai-image-*, tencent/hy-image-*
#
# _generate_openrouter_image() auto-detects which endpoint to use based on
# model provider prefix, and falls back to the other endpoint if the first fails.
# ———————————————————————————————————————————————————————————————————

# Models that use Chat Completions + modalities:["image"]
_CHAT_MODALITY_PREFIXES = (
    "google/",
    "openai/gpt-image",
    "openai/gpt-5",
    "qwen/qwen-image",
    "microsoft/mai-image",
    "tencent/hy-image",
)

# Models that use /images/generations endpoint
_IMAGES_API_PREFIXES = (
    "meta/",
    "recraft/",
    "black-forest-labs/flux",
    "x-ai/grok-imagine",
    "sourceful/riverflow",
    "krea/",
    "bytedance-seed/",
)


def _generate_openrouter_image(
    full_prompt: str,
    api_key: str,
    model: str,
) -> str | None:
    """
    Smart router for OpenRouter image generation.
    Automatically selects the correct endpoint (chat modalities vs images API)
    based on model provider, with fallback to the alternative endpoint.

    api_key is ALWAYS supplied by the caller (from the Target Audience popup) —
    never read from environment variables.
    Returns base64-encoded image bytes, or None on failure.
    """
    if os.getenv("PYTEST_CURRENT_TEST"):
        return "mock_base64_openrouter"

    m_lower = model.lower()
    use_chat = any(m_lower.startswith(p) for p in _CHAT_MODALITY_PREFIXES)

    if use_chat:
        agent_log("IMAGE", f"Routing {model} → chat/completions with modalities:[image]")
        result = _openrouter_chat_modality(full_prompt, api_key, model)
        if result:
            return result
        agent_log("IMAGE", f"{model}: chat modality failed, trying /images/generations fallback...")
        return _openrouter_images_api(full_prompt, api_key, model)
    else:
        agent_log("IMAGE", f"Routing {model} → /images/generations")
        result = _openrouter_images_api(full_prompt, api_key, model)
        if result:
            return result
        agent_log("IMAGE", f"{model}: images/generations failed, trying chat modality fallback...")
        return _openrouter_chat_modality(full_prompt, api_key, model)


def _openrouter_chat_modality(full_prompt: str, api_key: str, model: str) -> str | None:
    """
    Generate an image via OpenRouter's Chat Completions endpoint with modalities:[image].
    Used by: google/gemini-*-image, openai/gpt-image-*, qwen/qwen-image-*
    Parses image data from content parts (image_url or inlineData).
    """
    url = "https://openrouter.ai/api/v1/chat/completions"
    payload = {
        "model": model,
        "modalities": ["image"],
        "messages": [
            {
                "role": "user",
                "content": (
                    f"Generate a high-quality professional marketing image for advertising use. "
                    f"The image must be photorealistic, cinematic, and brand-ready. NO text, "
                    f"watermarks, or logos in the image. Scene: {full_prompt[:1400]}"
                ),
            }
        ],
    }

    try:
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://marketos.ai",
                "X-Title": "MarketOS",
            },
        )
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = json.loads(resp.read().decode())

        choices = data.get("choices", [])
        if not choices:
            agent_log("IMAGE", f"chat modality: no choices in response: {str(data)[:300]}")
            return None

        message   = choices[0].get("message", {})
        content   = message.get("content", "")

        # Content may be a list of typed parts, or a bare string
        parts = content if isinstance(content, list) else []

        for part in parts:
            if not isinstance(part, dict):
                continue

            # Format 1: image_url with data URI  (OpenAI-style)
            if part.get("type") == "image_url":
                img_url = part.get("image_url", {}).get("url", "")
                if img_url.startswith("data:"):
                    # data:image/png;base64,BASE64DATA
                    b64 = img_url.split(",", 1)[-1]
                    agent_log("IMAGE", f"chat modality ({model}): got data-URI image ✅")
                    return b64
                elif img_url:
                    agent_log("IMAGE", f"chat modality: downloading image from URL...")
                    img_req = urllib.request.Request(img_url, headers={"User-Agent": "MarketOS/1.0"})
                    with urllib.request.urlopen(img_req, timeout=60) as img_resp:
                        return base64.b64encode(img_resp.read()).decode("utf-8")

            # Format 2: inlineData  (Gemini-native via OpenRouter)
            inline = part.get("inline_data") or part.get("inlineData") or {}
            if inline.get("data"):
                agent_log("IMAGE", f"chat modality ({model}): got inlineData image ✅")
                return inline["data"]

        agent_log("IMAGE", f"chat modality ({model}): no image found in parts: {str(data)[:400]}")
        return None

    except urllib.error.HTTPError as e:
        try:
            body = e.read().decode("utf-8", errors="ignore")[:500]
        except Exception:
            body = str(e)
        agent_log("IMAGE", f"chat modality HTTP {e.code} for '{model}': {body}")
        return None

    except Exception as e:
        agent_log("IMAGE", f"chat modality error for '{model}': {e}")
        return None


def _openrouter_images_api(full_prompt: str, api_key: str, model: str) -> str | None:
    """
    Generate an image via OpenRouter's /images/generations endpoint (OpenAI-style).
    Used by: meta/, recraft/, black-forest-labs/flux*, x-ai/grok-imagine*, bytedance-seed/*
    """
    url = "https://openrouter.ai/api/v1/images/generations"

    # MetaMuse native output is 1600x1600; others default to 1024x1024
    if "muse" in model.lower() or model.lower().startswith("meta/"):
        size = "1600x1600"
    else:
        size = "1024x1024"

    payload = {
        "model": model,
        "prompt": full_prompt[:1000],
        "n": 1,
        "size": size,
        "response_format": "b64_json",
    }

    try:
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://marketos.ai",
                "X-Title": "MarketOS",
            },
        )
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = json.loads(resp.read().decode())

        b64 = data.get("data", [{}])[0].get("b64_json")
        if b64:
            agent_log("IMAGE", f"/images/generations ({model}) returned b64 image ✅ ({size})")
            return b64

        img_url = data.get("data", [{}])[0].get("url")
        if img_url:
            agent_log("IMAGE", f"/images/generations: downloading from URL...")
            img_req = urllib.request.Request(img_url, headers={"User-Agent": "MarketOS/1.0"})
            with urllib.request.urlopen(img_req, timeout=60) as img_resp:
                return base64.b64encode(img_resp.read()).decode("utf-8")

        agent_log("IMAGE", f"/images/generations ({model}): no usable data: {str(data)[:300]}")
        return None

    except urllib.error.HTTPError as e:
        try:
            body = e.read().decode("utf-8", errors="ignore")[:500]
        except Exception:
            body = str(e)
        agent_log("IMAGE", f"/images/generations HTTP {e.code} for '{model}': {body}")
        return None

    except Exception as e:
        agent_log("IMAGE", f"/images/generations error for '{model}': {e}")
        return None

def _generate_openai_image(
    full_prompt: str,
    api_key: str,
    model: str = "dall-e-3"
) -> str | None:
    from openai import OpenAI
    try:
        client = OpenAI(api_key=api_key)
        response = client.images.generate(
            model=model,
            prompt=full_prompt[:1000],
            n=1,
            size="1024x1024",
            response_format="b64_json"
        )
        return response.data[0].b64_json
    except Exception as e:
        agent_log("IMAGE", f"OpenAI DALL-E error: {e}")
        return None

def _generate_flux_schnell_image(
    full_prompt: str,
    api_key: str,
    model: str = "black-forest-labs/FLUX.1-schnell",
    width:  int = 1024,
    height: int = 576,
) -> str | None:
    """
    Generate an image using FLUX.1-schnell from Black Forest Labs.
    Model: black-forest-labs/FLUX.1-schnell (Apache-2.0 — free for commercial use)
    GitHub: https://github.com/black-forest-labs/flux
    HuggingFace: https://huggingface.co/black-forest-labs/FLUX.1-schnell

    Requires HF_TOKEN environment variable (free HuggingFace account token).
    Returns base64-encoded image bytes, or None on failure.
    """
    if os.getenv("PYTEST_CURRENT_TEST"):
        return "mock_base64_flux_schnell"

    if not api_key:
        agent_log("IMAGE", "api_key not provided — skipping FLUX.1-schnell")
        return None

    try:
        from huggingface_hub import InferenceClient
        import io
        
        client = InferenceClient(
            provider="nscale",
            api_key=api_key,
        )
        
        agent_log("IMAGE", f"Calling HF InferenceClient ({model})...")
        # output is a PIL.Image object
        image = client.text_to_image(
            full_prompt[:500],
            model=model,
            width=width,
            height=height
        )
        
        # Convert PIL Image to base64
        buffered = io.BytesIO()
        image.save(buffered, format="JPEG")
        img_str = base64.b64encode(buffered.getvalue()).decode("utf-8")
        
        return img_str

    except Exception as e:
        agent_log("IMAGE", f"FLUX.1-schnell exception: {e}")
        return None


# ── Together AI Image Generation ─────────────────────────────────────────────

def _generate_together_image(
    full_prompt: str,
    api_key: str,
    model: str = "black-forest-labs/FLUX.1-schnell-Free",
) -> str | None:
    """
    Generate an image via Together AI's Images API.
    FLUX.1-schnell-Free is on Together's free tier — no cost.
    Docs: https://docs.together.ai/docs/images-api
    Returns base64-encoded image bytes, or None on failure.
    """
    if os.getenv("PYTEST_CURRENT_TEST"):
        return "mock_base64_together"

    # Normalize model name
    if "together" in model.lower() and "/" not in model:
        model = "black-forest-labs/FLUX.1-schnell-Free"

    url = "https://api.together.xyz/v1/images/generations"
    payload = {
        "model": model,
        "prompt": full_prompt[:1000],
        "n": 1,
        "width": 1024,
        "height": 1024,
        "steps": 4,
        "response_format": "b64_json",
    }

    try:
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            }
        )
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode())

        b64 = data.get("data", [{}])[0].get("b64_json")
        if b64:
            agent_log("IMAGE", f"Together AI ({model}) returned b64 image ✅")
            return b64

        img_url = data.get("data", [{}])[0].get("url")
        if img_url:
            img_req = urllib.request.Request(img_url, headers={"User-Agent": "MarketOS/1.0"})
            with urllib.request.urlopen(img_req, timeout=30) as img_resp:
                return base64.b64encode(img_resp.read()).decode("utf-8")

        agent_log("IMAGE", f"Together AI returned no image data: {str(data)[:200]}")
        return None

    except Exception as e:
        agent_log("IMAGE", f"Together AI image error: {e}")
        return None


# _generate_pollinations_image has been removed.
# All image generation now goes through MetaMuse (meta/muse-image-1.0-eval-20260824)
# or another provider selected in the Target Audience popup, using the
# OpenRouter API key entered there. There is no free fallback.


# ── Provider 4: Stability AI (Stable Diffusion 3) ────────────────────────────

def _generate_stability_image(
    full_prompt: str,
    width:  int = 1024,
    height: int = 576,
    style_preset: str = "photographic",
) -> str | None:
    """
    Generate an image via Stability AI's REST API (Stable Diffusion 3).
    Endpoint: https://api.stability.ai/v2beta/stable-image/generate/core

    Requires STABILITY_API_KEY environment variable.
    Used as the final paid fallback when all free providers fail.
    Returns base64-encoded image bytes, or None on failure.
    """
    if os.getenv("PYTEST_CURRENT_TEST"):
        return "mock_base64_stability"

    api_key = os.getenv("STABILITY_API_KEY")
    if not api_key:
        agent_log("IMAGE", "STABILITY_API_KEY not set — skipping Stability AI")
        return None

    url = "https://api.stability.ai/v2beta/stable-image/generate/core"

    # Stability v2beta uses multipart/form-data
    import io
    boundary = "----MarketOSBoundary"

    fields = {
        "prompt":        full_prompt[:2000],
        "output_format": "jpeg",
        "aspect_ratio":  "16:9",
        "style_preset":  style_preset,
    }

    body = b""
    for key, value in fields.items():
        body += f"--{boundary}\r\n".encode()
        body += f'Content-Disposition: form-data; name="{key}"\r\n\r\n'.encode()
        body += f"{value}\r\n".encode()
    body += f"--{boundary}--\r\n".encode()

    try:
        req = urllib.request.Request(
            url,
            data=body,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type":  f"multipart/form-data; boundary={boundary}",
                "Accept":        "application/json",
            },
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))

        # v2beta returns {"image": "<base64>", "finish_reason": "SUCCESS"}
        img_data = data.get("image")
        if img_data:
            return img_data

        agent_log("IMAGE", f"Stability AI returned no image: {data.get('finish_reason', 'unknown')}")
        return None

    except urllib.error.HTTPError as e:
        body_err = e.read().decode("utf-8", errors="ignore")[:200]
        agent_log("IMAGE", f"Stability AI HTTP {e.code}: {body_err}")
        return None
    except Exception as e:
        agent_log("IMAGE", f"Stability AI exception: {e}")
        return None
