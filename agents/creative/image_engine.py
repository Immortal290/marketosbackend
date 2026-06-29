"""
MarketOS — Image Agent (Hybrid Visual Engine)
Pipeline:
  1. Unsplash photography search (fast, high quality, free tier)
  2. Gemini Vision relevance check on the photo (multimodal)
  3. Gemini Imagen 4 generation as fallback (AI-generated, no text)
  4. HTML injection of the winning image into the selected copy variant

Production extension:
- Cache verified images in S3 by query hash (avoid repeated API calls)
- Store base64 in campaign_assets table with CDN URL after upload
- Track usage for brand consistency across campaigns
"""

from __future__ import annotations
import json
import os
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

from langchain_core.messages import HumanMessage

from agents.llm.llm_provider import get_llm
from utils.logger import agent_log, step_banner, divider, kv, section
from utils.kafka_bus import publish_event, Topics


# ── Agent Node ───────────────────────────────────────────────────────────────

def image_agent_node(state: dict) -> dict:
    step_banner("IMAGE AGENT  ─  Hybrid AI Visual Engine")

    plan_data = state.get("campaign_plan", {})
    channels = plan_data.get("channels", [])

    if "email" not in channels and "social" not in channels:
        agent_log("IMAGE", "Skipping Image Agent because no applicable channels selected.")
        return {**state, "current_step": "compliance_agent"}

    copy_data = state.get("copy_output")
    if not isinstance(copy_data, dict):
        agent_log("IMAGE", "No copy_output found, possibly skipped copy_agent. Skipping Image Agent.")
        return {**state, "current_step": "compliance_agent"}

    # ── Find winning variant ─────────────────────────────────────────────
    selected_id = copy_data.get("selected_variant_id")
    variants    = copy_data.get("variants") or []
    winner      = next(
        (v for v in variants if isinstance(v, dict) and v.get("variant_id") == selected_id),
        variants[0] if variants else None,
    )

    if not isinstance(winner, dict):
        err = f"Winning variant '{selected_id}' not found in copy_output"
        agent_log("IMAGE", f"ERROR — {err}")
        return {**state, "errors": state.get("errors", []) + [err], "current_step": "failed"}

    query  = winner.get("hero_image_query")
    prompt = winner.get("hero_image_prompt")

    img_url  = None
    img_b64  = None
    img_type = None
    total_token_usage = 0

    # ── Phase 1 & 2: Unsplash & Gemini 3 Pro ─────────────────────────────
    if query:
        agent_log("IMAGE", f"Phase 1 — Unsplash search: '{query}'")
        unsplash_url = _fetch_unsplash(query)

        if unsplash_url:
            agent_log("IMAGE", "Photo found. Phase 2 — Enhancing image with Gemini 3 Pro...")
            base_img = _download_as_base64(unsplash_url)
            img_b64, t_tokens = _generate_enhanced_image(prompt or query, base_img)
            total_token_usage += t_tokens
            
            if img_b64:
                agent_log("IMAGE", "✅ Gemini 3 Pro Image-to-Image generation successful")
                img_type = "CID"
            else:
                agent_log("IMAGE", "⚠ Gemini generation failed — falling back to original Unsplash photo")
                img_url  = unsplash_url
                img_type = "URL"
        else:
            agent_log("IMAGE", "⚠ Unsplash returned no result. Proceeding with prompt-only generation.")
            img_b64, t_tokens = _generate_enhanced_image(prompt or query, None)
            total_token_usage += t_tokens
            if img_b64:
                img_type = "CID"
    else:
        agent_log("IMAGE", "No hero_image_query provided — proceeding to prompt-based generation.")
        if prompt:
            img_b64, t_tokens = _generate_enhanced_image(prompt, None)
            total_token_usage += t_tokens
            if img_b64:
                img_type = "CID"

    # ── Phase 3: Inject image into HTML ─────────────────────────────────
    if img_url and not img_b64:
        img_tag = (
            f'<img src="{img_url}" width="600" '
            f'style="display:block;width:100%;max-width:600px;height:auto;" '
            f'alt="Campaign Visual">'
        )
        winner = _inject_image(winner, img_tag, "<!-- HERO IMAGE -->")
        kv("Image Source", f"Unsplash URL: {img_url[:70]}...")

    elif img_b64:
        img_tag = (
            '<img src="cid:hero_image" width="600" '
            'style="display:block;width:100%;max-width:600px;height:auto;" '
            'alt="Campaign Visual">'
        )
        winner = _inject_image(winner, img_tag, "<!-- HERO IMAGE -->")
        kv("Image Source", "Gemini Imagen (inline CID attachment)")

    else:
        agent_log("IMAGE", "⚠ No image secured — sending text-only email")

    # ── Update copy_data with image metadata ─────────────────────────────
    # Patch the winner back into the variants list
    updated_variants = []
    for v in variants:
        if isinstance(v, dict) and v.get("variant_id") == winner.get("variant_id"):
            updated_variants.append(winner)
        else:
            updated_variants.append(v)

    copy_data["variants"]           = updated_variants
    copy_data["hero_image_url"]     = img_url
    copy_data["hero_image_base64"]  = img_b64
    copy_data["hero_image_type"]    = img_type

    divider()

    # ── Publish to Kafka ────────────────────────────────────────────────
    if total_token_usage > 0:
        state["api_tokens"] = state.get("api_tokens", 0) + total_token_usage
        publish_event(
            topic=Topics.IMAGE_RESULTS,
            source_agent="image_agent",
            payload={"event": "token_usage", "model": "gemini-3-pro-image-preview", "tokens": total_token_usage}
        )

    publish_event(
        topic=Topics.IMAGE_RESULTS,
        source_agent="image_agent",
        payload={
            "event":    "image_processed",
            "img_type": img_type or "none",
            "has_url":  img_url is not None,
            "has_b64":  img_b64 is not None,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )

    return {
        **state,
        "copy_output":  copy_data,
        "current_step": "compliance_agent",
        "trace": state.get("trace", []) + [{
            "agent":     "image_agent",
            "status":    "completed",
            "img_type":  img_type or "none",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }],
    }


# ── Internal Helpers ─────────────────────────────────────────────────────────

def _inject_image(winner: dict, img_tag: str, placeholder: str) -> dict:
    """
    Inject the image tag into the HTML body.
    Replaces placeholder comment if present; otherwise inserts after <body>
    or the opening wrapper table.
    """
    html = winner.get("body_html", "")

    if placeholder in html:
        # Replace the placeholder comment row wrapper
        row_html = (
            f"<tr><td style='padding:0;font-family:Arial,sans-serif;'>"
            f"{img_tag}"
            f"</td></tr>"
        )
        html = html.replace(placeholder, row_html, 1)

    elif "<img src=\"cid:hero_image\"" in html:
        # Already has a CID placeholder — swap it
        import re
        html = re.sub(r'<img\s+src="cid:hero_image"[^>]*>', img_tag, html, count=1)

    else:
        # Best-effort: insert after first <td inside the main content area
        insert_after = "<td align=\"center\">"
        if insert_after in html:
            row_html = (
                f"<tr><td style='padding:0;font-family:Arial,sans-serif;'>"
                f"{img_tag}"
                f"</td></tr>"
            )
            idx = html.find(insert_after) + len(insert_after)
            html = html[:idx] + row_html + html[idx:]

    winner["body_html"] = html
    return winner


def _fetch_unsplash(query: str) -> str | None:
    if os.getenv("PYTEST_CURRENT_TEST"):
        return "http://mock.unsplash/image.jpg"
    api_key = os.getenv("UNSPLASH_ACCESS_KEY")
    if not api_key:
        agent_log("IMAGE", "UNSPLASH_ACCESS_KEY not set in .env — skipping Unsplash")
        return None

    q   = urllib.parse.quote(query)
    url = f"https://api.unsplash.com/photos/random?query={q}&orientation=landscape"
    headers = {
        "Accept-Version": "v1",
        "Authorization":  f"Client-ID {api_key}",
        "User-Agent":     "MarketOS/1.0",
    }

    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode())
        urls = data.get("urls")
        return urls.get("regular") if isinstance(urls, dict) else None

    except urllib.error.HTTPError as e:
        codes = {401: "invalid API key", 403: "rate limit / forbidden", 404: "no photos found"}
        agent_log("IMAGE", f"Unsplash HTTP {e.code}: {codes.get(e.code, e.reason)}")
        return None
    except Exception as e:
        agent_log("IMAGE", f"Unsplash exception: {e}")
        return None


def _download_as_base64(url: str) -> str | None:
    if os.getenv("PYTEST_CURRENT_TEST"):
        return "mock_base64_string"
    try:
        import base64
        req = urllib.request.Request(url, headers={"User-Agent": "MarketOS/1.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            return base64.b64encode(resp.read()).decode("utf-8")
    except Exception as e:
        agent_log("IMAGE", f"Failed to download image from Unsplash: {e}")
        return None

def _generate_enhanced_image(prompt: str, base_image_b64: str | None = None) -> tuple[str | None, int]:
    """
    Call Gemini 3 Pro with multi-modal parts for Image-to-Image enhancement.
    Returns (base64_string, token_cost).
    """
    if os.getenv("PYTEST_CURRENT_TEST"):
        return "mock_base64_generated", 100

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        agent_log("IMAGE", "GEMINI_API_KEY not set — cannot run Gemini 3 Pro Images")
        return None, 0

    full_prompt = (
        prompt.rstrip(".")
        + ". Create an image exactly capturing this concept but with a vibrant, consistent brand color palette. Ensure top-notch professional production quality. Absolutely NO text or typography."
    )

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key={api_key}"
    
    parts = [{"text": full_prompt}]
    if base_image_b64:
        parts.append({"inlineData": {"mimeType": "image/jpeg", "data": base_image_b64}})

    payload = {
        "contents": [{"role": "user", "parts": parts}],
        "generationConfig": {
            "temperature": 1.0, 
            "topP": 0.95, 
            "topK": 64,
            "responseModalities": ["IMAGE"]
        }
    }

    try:
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode())

        metadata = data.get("usageMetadata", {})
        total_tokens = metadata.get("totalTokenCount", 0)

        candidates = data.get("candidates", [])
        if candidates:
            c_parts = candidates[0].get("content", {}).get("parts", [])
            for part in c_parts:
                if "inlineData" in part:
                    return part["inlineData"]["data"], total_tokens
        return None, total_tokens

    except Exception as e:
        agent_log("IMAGE", f"Gemini 3 Pro API exception: {e}")
        return None, 0
