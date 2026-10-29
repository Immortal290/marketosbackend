"""
MarketOS — Marketing Poster Engine  (3-Step Pipeline)
======================================================

Step 1  [Creative Director LLM]
        User intent + campaign data  →  structured JSON brief
        Fields: copy (headline/subheadline/CTA/badge), layout zones,
                color palette, font_style, image_prompt (background art ONLY).

Step 2  [Image Model via OpenRouter]
        brief["image_prompt"]  →  background art (no text / no logo).
        Uses the existing _generate_openrouter_image() router.

Step 3  [Pillow Compositor]
        background + brief  →  final poster
        Draws: gradient scrim · headline · subheadline · CTA pill · badge · logo.

Why separate image from text:
  Image models produce beautiful art but are unreliable at spelling, logos, layout.
  The LLM does the marketing thinking; the image model only paints the background;
  Pillow places the exact text, logo, and CTA so they are always correct.
"""
from __future__ import annotations

import io, os, re, json, math, base64, textwrap, urllib.request
from pathlib import Path
from typing import Optional

from langchain_core.messages import SystemMessage, HumanMessage
from utils.logger import agent_log
from utils.json_utils import extract_json

try:
    from PIL import Image, ImageDraw, ImageFont
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False

# ── Font cache ──────────────────────────────────────────────────────────────
FONT_CACHE = Path("/tmp/marketos_fonts")
FONT_CACHE.mkdir(parents=True, exist_ok=True)

_FONT_URLS: dict[str, str] = {
    "anton":        "https://fonts.gstatic.com/s/anton/v25/1Ptgg87LROyAm0Kk8AA.ttf",
    "bebas":        "https://fonts.gstatic.com/s/bebasneuepro/v17/CNz9x_HfkUyngFxKMaXJJtnKEjdk.ttf",
    "poppins_b":    "https://fonts.gstatic.com/s/poppins/v21/pxiByp8kv8JHgFVrLCz7V1s.ttf",
    "poppins_r":    "https://fonts.gstatic.com/s/poppins/v21/pxiEyp8kv8JHgFVrFJDUc1NECPY.ttf",
    "montserrat_b": "https://fonts.gstatic.com/s/montserrat/v26/JTUSjIg1_i6t8kCHKm459WlhyyTh89Y.ttf",
    "playfair_b":   "https://fonts.gstatic.com/s/playfairdisplay/v36/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKdFvXDXbtM.ttf",
}

def _fetch_font(name: str, size: int):
    if not PIL_AVAILABLE:
        return None
    url  = _FONT_URLS.get(name)
    if not url:
        return ImageFont.load_default()
    path = FONT_CACHE / f"{name}.ttf"
    if not path.exists():
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "MarketOS/1.0"})
            with urllib.request.urlopen(req, timeout=15) as r:
                path.write_bytes(r.read())
        except Exception as exc:
            agent_log("POSTER", f"Font download failed ({name}): {exc}")
            return ImageFont.load_default()
    try:
        return ImageFont.truetype(str(path), size)
    except Exception:
        return ImageFont.load_default()


def _pick_fonts(font_style: str, img_w: int):
    """Map brief's font_style to (headline_font, sub_font, cta_font)."""
    s        = font_style.lower()
    hl_size  = max(52, img_w // 11)
    sub_size = max(26, img_w // 26)
    cta_size = max(22, img_w // 30)

    if any(k in s for k in ("heavy", "condensed", "bold", "loud", "energetic", "impact")):
        return (_fetch_font("anton",        hl_size),
                _fetch_font("poppins_b",    sub_size),
                _fetch_font("poppins_b",    cta_size))
    elif any(k in s for k in ("serif", "elegant", "luxury", "playfair", "classic")):
        return (_fetch_font("playfair_b",   hl_size),
                _fetch_font("poppins_r",    sub_size),
                _fetch_font("montserrat_b", cta_size))
    elif any(k in s for k in ("rounded", "playful", "friendly", "soft")):
        return (_fetch_font("poppins_b",    hl_size),
                _fetch_font("poppins_r",    sub_size),
                _fetch_font("poppins_b",    cta_size))
    else:
        return (_fetch_font("montserrat_b", hl_size),
                _fetch_font("poppins_r",    sub_size),
                _fetch_font("montserrat_b", cta_size))


# ── Color helpers ──────────────────────────────────────────────────────────
def _hex_rgba(h: str, a: int = 255) -> tuple:
    h = h.lstrip("#")
    if len(h) == 3: h = "".join(c*2 for c in h)
    return (int(h[0:2],16), int(h[2:4],16), int(h[4:6],16), a)

def _brightness(h: str) -> float:
    r,g,b,_ = _hex_rgba(h)
    return (r*0.299 + g*0.587 + b*0.114) / 255

def _contrasting(bg: str) -> str:
    return "#FFFFFF" if _brightness(bg) < 0.55 else "#111111"


# ── Zone parser ────────────────────────────────────────────────────────────
def _parse_zone(desc: str, ih: int, iw: int) -> tuple[int,int,int,int]:
    """Parse 'top 25%, centered' → (x, y, w, h) pixels."""
    d    = desc.lower()
    pcts = [int(m)/100 for m in re.findall(r"(\d+)%", d)]
    mg   = int(iw * 0.06)
    if "top" in d:
        y0 = 0
        y1 = int(ih * (pcts[0] if pcts else 0.30))
    elif "bottom" in d:
        f  = pcts[0] if pcts else 0.15
        y0 = int(ih * (1 - f))
        y1 = ih
    elif "upper" in d:
        y0 = int(ih * (pcts[0] if pcts else 0.14))
        y1 = int(ih * (pcts[1] if len(pcts)>1 else 0.40))
    elif "lower" in d:
        y0 = int(ih * (pcts[0] if pcts else 0.60))
        y1 = int(ih * (pcts[1] if len(pcts)>1 else 0.85))
    else:
        cy = ih // 2
        f  = pcts[0] if pcts else 0.30
        y0 = cy - int(ih*f/2)
        y1 = cy + int(ih*f/2)
    return mg, y0, iw - 2*mg, max(y1-y0, 1)


# ── Pillow draw helpers ────────────────────────────────────────────────────
def _draw_scrim(ov: "Image.Image", x, y, w, h, dark=True, alpha=145):
    if not PIL_AVAILABLE: return
    sc = Image.new("RGBA", (max(w,1), max(h,1)), (0,0,0,0))
    sd = ImageDraw.Draw(sc)
    for i in range(max(h,1)):
        t = math.sin(math.pi * i / max(h-1, 1))
        a = int(alpha * t)
        c = (0,0,0,a) if dark else (255,255,255,a)
        sd.line([(0,i),(w,i)], fill=c)
    ov.alpha_composite(sc, (max(x,0), max(y,0)))


def _draw_text_block(draw, text, font, x, y, max_w, fill, line_sp=1.3):
    if not text or font is None: return y
    try:    acw = draw.textlength("W", font=font)
    except: acw = 12
    cpl   = max(6, int(max_w / max(acw,1)))
    lines = textwrap.wrap(text, width=cpl, break_long_words=False) or [text]
    try:
        bb  = draw.textbbox((0,0),"Hg",font=font)
        lh  = int((bb[3]-bb[1]) * line_sp)
    except:
        lh = int(getattr(font,"size",20) * line_sp)
    cur = y
    for ln in lines:
        try:    lw = draw.textlength(ln, font=font)
        except: lw = len(ln)*11
        lx = x + (max_w - lw)//2
        draw.text((lx+2, cur+2), ln, font=font, fill=(0,0,0,100))
        draw.text((lx,   cur),   ln, font=font, fill=fill)
        cur += lh
    return cur


def _draw_pill(ov, text, cx, y, bg_hex, txt_hex, font, px=52, py=20):
    if not PIL_AVAILABLE or not text or font is None: return
    d  = ImageDraw.Draw(ov)
    try:    tw = int(d.textlength(text, font=font))
    except: tw = len(text)*14
    try:
        bb = d.textbbox((0,0),text,font=font)
        th = bb[3]-bb[1]
    except: th = 28
    bw = tw + px*2; bh = th + py*2; bx = cx - bw//2; r = bh//2
    d.rounded_rectangle([bx, y, bx+bw, y+bh], radius=r, fill=_hex_rgba(bg_hex, 235))
    d.text((bx+(bw-tw)//2+1, y+(bh-th)//2+1), text, font=font, fill=(0,0,0,90))
    d.text((bx+(bw-tw)//2,   y+(bh-th)//2),   text, font=font, fill=_hex_rgba(txt_hex))


def _draw_badge(ov, text, bx, by, bg_hex, txt_hex, font):
    if not PIL_AVAILABLE or not text or font is None: return
    d  = ImageDraw.Draw(ov)
    try:    tw = int(d.textlength(text, font=font))
    except: tw = len(text)*11
    pad=18; bw=tw+pad*2; bh=bw
    d.ellipse([bx, by, bx+bw, by+bh], fill=_hex_rgba(bg_hex, 235))
    d.text((bx+(bw-tw)//2, by+(bh-26)//2), text, font=font, fill=_hex_rgba(txt_hex))


# ── Step 3 — Pillow Compositor ─────────────────────────────────────────────
def compose_poster(bg_b64: str, brief: dict, logo_b64: Optional[str]=None) -> str:
    """
    Compose the final poster: overlay copy + logo on AI-generated background.
    Returns base64-encoded JPEG.
    """
    if not PIL_AVAILABLE:
        agent_log("POSTER","Pillow unavailable — returning raw background")
        return bg_b64

    # Decode background
    try:
        bg = Image.open(io.BytesIO(base64.b64decode(bg_b64))).convert("RGBA")
    except Exception as e:
        agent_log("POSTER", f"BG decode error: {e}"); return bg_b64

    # Resize to target
    sz = brief.get("size_px","1080x1350")
    try:    tw, th = map(int, sz.lower().split("x"))
    except: tw, th = 1080, 1350
    bg = bg.resize((tw, th), Image.LANCZOS)

    palette    = brief.get("palette", {})
    accent_hex = palette.get("accent",  "#FF9F1C")
    layout     = brief.get("layout",   {})
    text_hex   = layout.get("text_color",  "#FFFFFF")
    font_style = layout.get("font_style",  "heavy condensed sans")
    copy       = brief.get("copy", {})
    headline   = copy.get("headline",    "")
    subhead    = copy.get("subheadline", "")
    cta_text   = copy.get("cta",         "")
    badge_text = copy.get("badge",       "")
    hl_zone    = layout.get("headline_zone", "top 30%, centered")
    cta_zone   = layout.get("cta_zone",     "bottom 14%, centered")
    logo_zone  = layout.get("logo_zone",    "bottom-left corner")

    hl_font, sub_font, cta_font = _pick_fonts(font_style, tw)
    badge_font = _fetch_font("poppins_b", max(16, tw//52))

    overlay = Image.new("RGBA", (tw, th), (0,0,0,0))
    draw    = ImageDraw.Draw(overlay)

    # Headline + subheadline
    hx, hy, hw, hh = _parse_zone(hl_zone, th, tw)
    if headline:
        scrim_pad = 36
        _draw_scrim(overlay, hx-scrim_pad, max(0,hy-scrim_pad),
                    hw+scrim_pad*2, hh+scrim_pad*2,
                    dark=(_brightness(text_hex)>0.5), alpha=135)
        cur = hy + hh//8
        cur = _draw_text_block(draw, headline, hl_font, hx, cur, hw,
                               fill=_hex_rgba(text_hex, 255))
        if subhead and cur < hy+hh:
            _draw_text_block(draw, subhead, sub_font,
                             hx+int(hw*0.05), cur+10, int(hw*0.9),
                             fill=_hex_rgba(text_hex, 200))

    # CTA pill
    if cta_text:
        _, cy0, _, ch = _parse_zone(cta_zone, th, tw)
        _draw_pill(overlay, cta_text, tw//2, cy0+ch//8,
                   accent_hex, _contrasting(accent_hex), cta_font)

    # Badge
    if badge_text:
        mg = int(tw*0.06)
        _draw_badge(overlay, badge_text, tw-mg-90, mg,
                    accent_hex, _contrasting(accent_hex), badge_font)

    # Composite
    result = Image.alpha_composite(bg, overlay)

    # Logo
    if logo_b64:
        try:
            logo = Image.open(io.BytesIO(base64.b64decode(logo_b64))).convert("RGBA")
            lmax = int(tw*0.15)
            ratio = lmax / logo.width
            logo  = logo.resize((lmax, int(logo.height*ratio)), Image.LANCZOS)
            # apply 85% opacity
            r_c,g_c,b_c,a_c = logo.split()
            a_c = a_c.point(lambda x: int(x*0.85))
            logo = Image.merge("RGBA",(r_c,g_c,b_c,a_c))
            mg  = int(tw*0.05)
            lz  = logo_zone.lower()
            if   "bottom-left"  in lz or "bottom left"  in lz: lx,ly = mg, th-logo.height-mg
            elif "bottom-right" in lz or "bottom right" in lz: lx,ly = tw-logo.width-mg, th-logo.height-mg
            elif "top-left"     in lz or "top left"     in lz: lx,ly = mg, mg
            elif "top-right"    in lz or "top right"    in lz: lx,ly = tw-logo.width-mg, mg
            elif "center" in lz and "bottom" in lz: lx,ly = (tw-logo.width)//2, th-logo.height-mg
            else: lx,ly = mg, th-logo.height-mg
            result.alpha_composite(logo, (lx, ly))
        except Exception as e:
            agent_log("POSTER", f"Logo overlay error: {e}")

    # Export JPEG
    buf = io.BytesIO()
    result.convert("RGB").save(buf, format="JPEG", quality=95, optimize=True)
    out_b64 = base64.b64encode(buf.getvalue()).decode()
    agent_log("POSTER", f"✅ Composed poster {tw}x{th}px — {len(out_b64)//1024}KB")
    return out_b64


# ── Step 1 — Creative Director System Prompt ──────────────────────────────
_CREATIVE_DIRECTOR_PROMPT = """# SYSTEM PROMPT: AI DIGITAL MARKETING & AD CREATIVE DIRECTOR (Poster Engine)

You are an expert AI Digital Marketing Creative Director, Advertising Copywriter, Brand Strategist, and Visual Ad Designer.
Your mission is to transform a user's marketing idea, product description, brand details, promotional offer, or campaign request into a polished, compelling, visually distinctive, and conversion-focused advertising poster brief and background art prompt.

CORE PRINCIPLE:
You are designing an AD POSTER, not a generic photograph. A poster has: one big idea, one hero subject, a bold headline, a short supporting line, a clear call to action, brand-aligned colors, and a deliberate visual hierarchy. Never output a plain portrait, stock-style photo, or generic lifestyle shot.

CREATIVE DIRECTION PRINCIPLES:
- Strong visual hierarchy with the product and offer immediately noticeable.
- Refined, cohesive color palette matching the brand and category aesthetic.
- Category-appropriate art direction:
  * Luxury: refined typography, restrained colors, premium product lighting, elegant composition.
  * Festive / Seasonal: warm lighting, culturally relevant decorations (Diwali, Christmas, Eid, etc.), celebratory colors, distinctive occasion theme.
  * Technology: clean layouts, sleek modern environments, high-contrast typography.
  * Fashion & Beauty: editorial photography, confident compositions, soft polished lighting, rich detail.
  * Food & Beverage: appetizing textures, natural detail, and mouthwatering presentation.

CONCEPT TYPES (pick the best fit):
  HERO_PRODUCT — product large, dramatic lighting, dynamic elements (splash, floating parts, light trails)
  TRANSFORMATION — show the result/feeling (no medical/financial claims)
  BOLD_TYPOGRAPHIC — giant headline is hero, simple shapes + product
  SURREAL_CONCEPTUAL — product merged with a surprising metaphor (e.g. sneaker made of clouds)
  FLAT_LAY_EXPLOSION — product surrounded by key ingredients/components
  OFFER_SALE — price/discount as visual anchor with energetic shapes
  FESTIVE_SEASONAL — occasion-driven color and motifs (culturally sensitive, vibrant)
  ILLUSTRATED_RETRO — stylised graphic look for playful brands

COPY RULES (Brand Voice & Advertising Integrity):
- Headline: 2–7 words. Punchy, benefit- or emotion-led, memorable.
- Subheadline: max 12 words. Adds proof, detail, or the verified offer.
- CTA: 1–3 words (Shop Now, Explore Collection, Book Today, Claim Offer, Order Now).
- Badge: short optional label (NEW, -30%, Limited Edition, Free Delivery). Leave "" if none.
- Never invent factual business information, customer reviews, awards, stats, prices, or certifications. Use placeholders or clearly labelled suggestions for unconfirmed details.
- No medical/cure claims, no misleading before/after health promises, no competitor disparagement.

LAYOUT RULES:
- Reserve clear text-safe zones: headline zone top 20–30%, CTA zone bottom 14%.
- Keep content inside 8% safe margin from every edge.
- Logo zone must be EMPTY — never ask the image model to draw a logo.

IMAGE PROMPT RULES (Image Generation Tool Integration):
- Describes background art ONLY (text_in_image is always false).
- Must include: format, concept, hero subject, composition + text-safe zones, setting, lighting, palette (hex codes), style, quality words.
- Describe empty areas explicitly: "large clean negative space in the top third for headline text".
- Style keywords: "premium product advertisement", "campaign key visual", "commercial studio lighting", "bold composition", "high contrast".
- Negatives list: "no text, no letters, no watermarks, no logos, no distorted hands, no blurry product, no cluttered background, no stock-photo look".

PLATFORM DEFAULT: Instagram feed (4:5, 1080x1350). Only change if platform is specified.

OUTPUT: Return ONLY valid JSON, nothing else. Use this exact schema:
{
  "brand": "",
  "industry": "",
  "audience": "",
  "tone": "",
  "big_idea": "one sentence describing the single concept of this ad",
  "concept_type": "",
  "platform": "Instagram feed",
  "aspect_ratio": "4:5",
  "size_px": "1080x1350",
  "palette": {"primary": "#hex", "accent": "#hex", "neutral": "#hex"},
  "copy": {"headline": "", "subheadline": "", "cta": "", "badge": ""},
  "layout": {
    "headline_zone": "top 25%, centered",
    "hero_zone": "center, 50% of height",
    "cta_zone": "bottom 13%, centered pill button",
    "logo_zone": "bottom-left corner",
    "text_color": "#FFFFFF",
    "font_style": "heavy condensed sans"
  },
  "text_in_image": false,
  "image_prompt": "",
  "negative_prompt": "no text, no letters, no watermarks, no logos, no distorted hands, no blurry product, no cluttered background, no stock-photo look",
  "variations": [
    {"angle": "alternative concept in one sentence", "image_prompt": ""}
  ]
}

FEW-SHOT EXAMPLE (Skincare):
Input: brand=Glowa, product=vitamin C serum, audience=women 25-40, platform=Instagram feed
Output:
{
  "brand": "Glowa", "industry": "skincare", "audience": "women 25-40", "tone": "fresh, radiant, premium",
  "big_idea": "The serum bottle as a burst of sunshine that wakes up your morning",
  "concept_type": "HERO_PRODUCT", "platform": "Instagram feed", "aspect_ratio": "4:5", "size_px": "1080x1350",
  "palette": {"primary": "#FF9F1C", "accent": "#FFE8B0", "neutral": "#FFF8EE"},
  "copy": {"headline": "Wake Up Your Glow", "subheadline": "Vitamin C serum for brighter-looking skin", "cta": "Shop Now", "badge": "NEW"},
  "layout": {"headline_zone": "top 25%, centered", "hero_zone": "center, 50% height", "cta_zone": "bottom 12%, centered pill button", "logo_zone": "bottom-left", "text_color": "#3A2A00", "font_style": "elegant rounded serif headline"},
  "text_in_image": false,
  "image_prompt": "Premium skincare campaign key visual, vertical 4:5, 1080x1350. A sleek amber glass dropper serum bottle floating in the center, surrounded by a halo of golden light, fresh orange slices, glowing citrus droplets and sparkling serum splashes frozen mid-air. Warm sunrise gradient background from peach (#FF9F1C) to soft cream (#FFF8EE), soft glossy highlights and reflections on the glass, shallow depth of field, commercial studio lighting. Large clean empty space in the top quarter for a headline and a clear empty strip at the bottom for a button. Ultra-detailed, 8k, high-end beauty advertisement.",
  "negative_prompt": "no text, no letters, no logos, no watermarks, no people, no plain portrait, no clutter, no blurry product, no distorted bottle, no stock photo look",
  "variations": [{"angle": "Flat-lay of serum surrounded by citrus slices on marble", "image_prompt": "..."}]
}"""

_IMG_PREFIX = "Professional advertising poster key visual, campaign-quality graphic design, "
_IMG_SUFFIX = (", designed with intentional negative space for typography, "
               "bold composition, high contrast, commercial photography meets graphic design, "
               "sharp focus on the hero subject, 8k, no text, no watermark, no logo.")


# ── Step 1 ─────────────────────────────────────────────────────────────────
def run_creative_director(campaign_info: dict, llm_model: str, llm_api_key: str) -> dict | None:
    """Call the Creative Director LLM → return parsed JSON brief or None."""
    try:
        from agents.llm.llm_provider import get_llm, active_llm_api_key, active_llm_model
        active_llm_api_key.set(llm_api_key)
        active_llm_model.set(llm_model)
        llm = get_llm(temperature=0.7)
    except Exception as e:
        agent_log("POSTER", f"LLM init failed: {e}"); return None

    lines = [f"{k}: {v}" for k,v in campaign_info.items() if v]
    user_msg = "\n".join(lines) or "Generic product campaign"

    agent_log("POSTER", "Creative Director generating poster brief...")
    try:
        resp  = llm.invoke([SystemMessage(content=_CREATIVE_DIRECTOR_PROMPT),
                            HumanMessage(content=user_msg)])
        raw   = resp.content if hasattr(resp,"content") else str(resp)
        brief = extract_json(raw)
        if not isinstance(brief, dict):
            agent_log("POSTER", f"Creative Director non-dict response: {raw[:200]}")
            return None
        agent_log("POSTER",
                  f"Brief ready: [{brief.get('concept_type','')}] "
                  f"'{brief.get('copy',{}).get('headline','')}'")
        return brief
    except Exception as e:
        agent_log("POSTER", f"Creative Director error: {e}"); return None


def build_image_prompt(brief: dict) -> str:
    """Wrap the brief's image_prompt with prefix/suffix."""
    return f"{_IMG_PREFIX}{brief.get('image_prompt','')}{_IMG_SUFFIX}"


# ── Full 3-step pipeline ───────────────────────────────────────────────────
def run_poster_pipeline(
    state:        dict,
    image_gen_fn,          # callable(prompt, api_key, model) -> b64|None
    image_model:  str,
    image_api_key:str,
    logo_b64:     Optional[str] = None,
) -> tuple[str | None, dict | None]:
    """
    Run the complete 3-step poster pipeline.

    Returns (poster_b64, brief_dict) — poster_b64 is None on failure.
    """
    plan     = state.get("campaign_plan", {})
    copy_out = state.get("copy_output", {})
    winner   = None
    if isinstance(copy_out, dict):
        sel = copy_out.get("selected_variant_id")
        vs  = copy_out.get("variants") or []
        winner = next((v for v in vs if isinstance(v,dict) and v.get("variant_id")==sel),
                      vs[0] if vs else None)

    campaign_info = {
        "brand":         state.get("company_name") or plan.get("campaign_name",""),
        "product":       (state.get("user_intent") or "")[:300],
        "audience":      state.get("target_audience") or plan.get("target_audience",""),
        "tone":          plan.get("tone","professional"),
        "offer":         "",
        "headline_hint": (winner or {}).get("subject_line","") if winner else "",
        "platform":      "Instagram feed",
        "colors":        "",
        "language":      "English",
    }

    # Step 1
    brief = run_creative_director(
        campaign_info,
        state.get("llm_model", ""),
        (state.get("llm_api_key") or "").strip()
        or os.getenv("OPENROUTER_API_KEY", "").strip()
        or os.getenv("GEMINI_API_KEY", "").strip(),
    )
    if not brief:
        agent_log("POSTER","Creative Director failed — falling back to direct image gen")
        return None, None

    # Step 2
    prompt = build_image_prompt(brief)
    agent_log("POSTER", f"BG image prompt (120): {prompt[:120]}...")
    bg_b64 = image_gen_fn(prompt, image_api_key, image_model)
    if not bg_b64:
        agent_log("POSTER","Background generation failed")
        return None, brief

    # Step 3
    poster_b64 = compose_poster(bg_b64, brief, logo_b64=logo_b64)
    return poster_b64, brief
