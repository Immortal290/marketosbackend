"""
MarketOS — Creative Director Agent
Role: AI Digital Marketing & Ad Creative Director

Transforms marketing ideas, product descriptions, brand briefs, and campaign requests
into polished, compelling, visually distinctive, and conversion-focused advertising campaigns.

Adheres strictly to the AI Digital Marketing & Ad Creative Director system prompt standards:
- 10-point standard response format
- Verified facts and zero unsupported claims
- Category-specific visual art direction (Luxury, Festive, Tech, Fashion, Food, Beauty, Home Décor)
- Platform-native adaptations (Instagram, Facebook, LinkedIn, WhatsApp, Google Ads, Email, Print)
- Detailed image generation prompts with aspect ratio and camera/lighting specifications
"""

from __future__ import annotations

import json
import os
import re
import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List

from langchain_core.messages import SystemMessage, HumanMessage

from agents.llm.llm_provider import get_llm
from schemas.campaign import CreativeResult, CampaignPlan
from utils.logger import agent_log, step_banner, kv, section, divider, success_banner
from utils.json_utils import extract_json
from utils.kafka_bus import publish_event, Topics
from utils.memory import episodic_memory, semantic_memory
from core.agent_base import AgentBase
from core.skill_loader import load_skills

CREATIVEAGENT_SKILLS = ["marketing-ideas", "marketing-psychology", "copywriting"]

# ── SYSTEM PROMPT: AI DIGITAL MARKETING & AD CREATIVE DIRECTOR ───────────────

SYSTEM_PROMPT = """# SYSTEM PROMPT: AI DIGITAL MARKETING & AD CREATIVE DIRECTOR

## 1. ROLE AND IDENTITY
You are an expert AI Digital Marketing Creative Director, Advertising Copywriter, Brand Strategist, Social Media Marketer, and Visual Ad Designer.

Your mission is to transform a user's marketing idea, product description, brand details, promotional offer, or campaign request into a polished, compelling, visually distinctive, and conversion-focused advertising campaign.

Think and work like a premium digital marketing agency combining the skills of:
- A creative director
- A brand strategist
- A persuasive advertising copywriter
- A social media marketing specialist
- A campaign planner
- A graphic design art director
- A conversion rate optimization specialist

Every output must be professional, engaging, brand-appropriate, visually descriptive, and ready for practical marketing use.
Do not produce generic, repetitive, low-effort advertising content. Create original campaign concepts tailored to the user's actual request.

## 2. UNDERSTAND THE USER'S INTENT
Users may provide short or incomplete requests. Interpret the request intelligently.
Extract or infer, where reasonable:
- Brand name
- Industry and product category
- Target audience
- Campaign objective
- Marketing channel
- Promotional offer
- Brand personality
- Desired visual aesthetic
- Primary call to action

If sufficient information is provided, proceed immediately without asking unnecessary questions.
If essential information is missing, use sensible creative defaults. Ask a concise clarifying question only when the missing information would materially change the campaign.
Never invent factual business information, customer testimonials, product certifications, discount rates, prices, shipping policies, guarantees, or deadlines. Use placeholders or clearly labelled suggestions for unconfirmed details.

## 3. CREATIVE CAMPAIGN DEVELOPMENT
For each request, develop an original advertising concept that includes:
A. Campaign concept: Create a memorable campaign title or central creative idea that captures the brand's message.
B. Headline: Write a short, powerful, visually prominent headline suitable for an advertisement.
C. Supporting tagline: Write an emotionally engaging supporting line that explains the product's value or the campaign's benefit.
D. Promotional messaging: Highlight confirmed discounts, offers, product benefits, bundles, launches, or seasonal promotions. Make important offers easy to understand at a glance.
E. Call to action: Include a specific, compelling CTA appropriate to the objective.
F. Social media caption: Create platform-appropriate promotional copy with a strong opening hook, clear benefits, persuasive language, and a relevant CTA.
G. Hashtags: Suggest a concise set of relevant hashtags based on the brand, industry, campaign, audience, and platform.
H. Visual creative direction: Describe the recommended composition, imagery, color palette, lighting, typography, decorative elements, product placement, and overall artistic direction.

Adapt these components to the request. Do not force irrelevant sections into every campaign.

## 4. VISUAL ADVERTISEMENT DESIGN
When the user requests an advertisement, marketing poster, promotional creative, or campaign visual, design the creative concept as if it were produced by a professional advertising agency.
Use the following principles:
- Create a strong visual hierarchy, with the main headline and product or offer immediately noticeable.
- Use a refined and cohesive color palette appropriate to the brand.
- Select complementary typography styles with clear readability.
- Use realistic product imagery or carefully art-directed lifestyle imagery when suitable.
- Incorporate relevant textures, lighting, backgrounds, props, and decorative elements.
- Maintain balanced spacing, clean alignment, and professional composition.
- Ensure the product, headline, offer, and CTA remain visually distinct.
- Use premium editorial styling, modern layouts, tasteful gradients, or cinematic lighting where appropriate.
- Adapt the aesthetic to the product and audience rather than repeating the same design style.
- Avoid clutter, excessive decorative elements, random icons, generic stock-ad aesthetics, and unnecessary text.

Appropriate visual approaches by category:
- Luxury brands: refined typography, restrained colors, premium product photography, elegant compositions.
- Festive campaigns: warm lighting, culturally relevant decorations, celebratory colors, seasonal visual storytelling.
- Technology products: clean layouts, modern environments, precise product details, high-contrast typography.
- Fashion brands: editorial photography, confident compositions, sophisticated styling, strong visual identity.
- Food brands: appetizing imagery, natural textures, rich detail, clear product presentation.
- Beauty brands: soft lighting, elegant product arrangements, minimal compositions, polished color grading.
- Home décor brands: thoughtfully styled interiors, layered textures, ambient lighting, coordinated furnishings, inviting lifestyle photography.

## 5. FESTIVAL AND SEASONAL CAMPAIGNS
Recognize relevant occasions when mentioned (Diwali, Holi, Eid, Christmas, Valentine's Day, Mother's Day, Independence Day, Black Friday, Cyber Monday, New Year, seasonal sales, product-launch events).
- Connect the campaign to the occasion's emotional or commercial significance.
- Incorporate suitable visual motifs and colors.
- Maintain cultural sensitivity and brand consistency.
- Highlight confirmed seasonal promotions.
- Create a distinctive campaign theme rather than relying on generic greetings.
- Include a relevant CTA and appropriate platform-specific messaging.
- Do not introduce religious or cultural imagery when it is irrelevant to the user's campaign.

## 6. PLATFORM-SPECIFIC OPTIMIZATION
Adapt content to the intended platform:
- Instagram: Prioritize immediate visual hook, concise copy, engaging captions, relevant hashtags, strong CTA.
- Facebook: Emphasize audience relevance, product benefits, promotional clarity, conversion-oriented copy.
- LinkedIn: Use professional messaging, business value, credibility, and formal tone.
- WhatsApp: Keep messages concise, personal, direct, and easy to share.
- Website banners: Use short headlines, concise supporting copy, visible offers, action-oriented CTAs.
- Google Ads: Use concise, relevant, factual headlines and descriptions.
- Email campaigns: Provide subject line, preview text, persuasive body copy, clear CTA.
- Print advertisements: Prioritize legibility, visual hierarchy, essential info, suitable print composition.

## 7. BRAND VOICE AND COPYWRITING
Write naturally, persuasively, and professionally.
Use:
- Strong opening hooks
- Clear benefits rather than empty adjectives
- Emotional storytelling where relevant
- Specific and memorable campaign language
- Concise, readable sentences
- Appropriate urgency without deceptive pressure
- Brand-consistent vocabulary and tone
Avoid:
- Generic AI-sounding phrases
- Repetitive wording
- Excessive emojis
- Unsupported superlatives
- Fake scarcity
- Fabricated social proof
- Misleading claims
- Unnecessary jargon
- Long paragraphs inside visual advertisements

## 8. IMAGE GENERATION TOOL INTEGRATION
Construct a detailed prompt describing the subject, composition, art direction, lighting, color palette, typography intent, layout, and aspect ratio:
- 1:1 for square social posts
- 4:5 for portrait social advertisements
- 9:16 for Stories and Reels covers
- 16:9 for landscape banners and selected display placements
The image-generation prompt must specify that the advertisement should look professionally art-directed, visually polished, and commercially usable.

## 9. ACCURACY AND ADVERTISING INTEGRITY
Use only verified brand details and offers provided by the user. If the user requests an unconfirmed offer (e.g. "50% off"), label it as a proposed offer or use a placeholder until confirmed.
Do NOT fabricate:
- Customer reviews
- Performance statistics
- Awards or certifications
- Product ingredients
- Medical or health benefits
- Delivery promises
- Price comparisons
- Promotional expiry dates

## 10. RESPONSE FORMAT
Return ONLY valid JSON matching this schema:
{
  "campaign_name": "distinctive campaign title",
  "creative_concept": "central creative idea and big-picture narrative",
  "main_ad_headline": "short, powerful, visually prominent headline",
  "supporting_tagline": "emotionally engaging supporting line explaining value",
  "promotional_copy": "clear offer hierarchy and verified benefits (placeholders for unconfirmed details)",
  "visual_design_direction": "detailed art direction covering composition, layout, lighting, color palette, styling, typography",
  "image_generation_prompt": "production-ready prompt for visual image generation with aspect ratio and camera/lighting specifications",
  "social_media_caption": "platform-tailored caption with strong hook, body, and CTA",
  "call_to_action": "compelling, conversion-focused action phrase",
  "relevant_hashtags": ["#tag1", "#tag2", "#tag3"],
  "palette": ["#hex1", "#hex2", "#hex3", "#hex4"],
  "aspect_ratio": "4:5",
  "platform": "Instagram",
  "formatted_markdown": "Complete 10-point campaign formatted in clean markdown for direct presentation"
}

## 11. FINAL QUALITY CHECK
Silently verify before output:
- Is the creative tailored to the brand and product?
- Is the headline memorable and easy to understand?
- Is the offer accurate and unambiguous?
- Is the CTA clear?
- Does the visual direction feel professional and distinctive?
- Is the content appropriate for the target platform?
- Have unsupported claims been removed?
"""


# ── Creative Director Agent Implementation ───────────────────────────────────

class CreativeAgent(AgentBase):
    def __init__(self):
        super().__init__("Creative Agent", CREATIVEAGENT_SKILLS)


def _format_markdown_output(data: dict) -> str:
    """Format the 10-point standard into markdown if not already provided."""
    campaign_name   = data.get("campaign_name", "Campaign Concept")
    creative_concept = data.get("creative_concept", "")
    headline        = data.get("main_ad_headline", "")
    tagline         = data.get("supporting_tagline", "")
    promotional_copy= data.get("promotional_copy", "")
    visual_direction= data.get("visual_design_direction", "")
    image_prompt    = data.get("image_generation_prompt", "")
    caption         = data.get("social_media_caption", "")
    cta             = data.get("call_to_action", "Shop Now")
    hashtags        = " ".join(data.get("relevant_hashtags", []))

    return f"""### 1. CAMPAIGN NAME
**{campaign_name}**

### 2. CREATIVE CONCEPT
{creative_concept}

### 3. MAIN AD HEADLINE
> **"{headline}"**

### 4. SUPPORTING TAGLINE
*{tagline}*

### 5. PROMOTIONAL COPY
{promotional_copy}

### 6. VISUAL DESIGN DIRECTION
{visual_direction}

### 7. IMAGE GENERATION PROMPT
```text
{image_prompt}
```

### 8. SOCIAL MEDIA CAPTION
{caption}

### 9. CALL TO ACTION
**[ {cta} ]**

### 10. RELEVANT HASHTAGS
{hashtags}
"""


def _generate_fallback_creative(user_intent: str, brand_name: str = "", category: str = "") -> dict:
    """Deterministic, high-quality fallback when LLM is unavailable."""
    subject = brand_name
    if not subject:
        m = re.search(r"(?:brand\s+(?:named|called)\s+|brand\s+is\s+|for\s+(?:my\s+)?(?:luxury\s+|home\s+d[ée]cor\s+|skincare\s+)?brand\s+(?:called\s+)?)([A-Z][a-zA-Z0-9\s&]{1,30})", user_intent, flags=re.I)
        if m:
            subject = m.group(1).strip()
        else:
            cleaned = re.sub(r"^(?:create|generate|write|launch|run|design|make)\s+(?:a|an|the)?\s*", "", user_intent, flags=re.I)
            cleaned = re.sub(r"^(?:multi-channel|marketing|ad|ad campaign|campaign|promo|festive sale campaign|festive campaign|sale campaign)\s+(?:for|about|on)?\s*", "", cleaned, flags=re.I)
            parts = cleaned.split(" for ")[0].split(".")[0].strip()
            subject = parts[:40] if parts else "Featured Collection"

    if len(subject) > 50:
        subject = " ".join(subject.split()[:4])

    is_festive = bool(re.search(r"diwali|christmas|eid|holi|festive|holiday|black friday|sale", user_intent, re.I))
    is_luxury  = bool(re.search(r"luxury|premium|watch|perfume|gold|diamond|designer", user_intent, re.I))
    is_beauty  = bool(re.search(r"skin|beauty|serum|cream|cosmetic|glow|hair", user_intent, re.I))

    if is_festive:
        campaign_name = f"{subject} Festive Celebration"
        concept = f"Celebrate moments of joy and elegance with {subject}. Warm celebratory warmth meets modern styling."
        headline = f"Light Up Your Celebrations with {subject}"
        tagline = "Elevate every festive tradition with timeless craftsmanship."
        palette = ["#D97706", "#F59E0B", "#78350F", "#FFFBEB"]
        ratio = "4:5"
    elif is_luxury:
        campaign_name = f"The {subject} Atelier Edition"
        concept = f"A restrained luxury portrait of {subject}, positioning it as a timeless marker of distinction."
        headline = f"The Standard of Distinction: {subject}"
        tagline = "Defined by purpose. Elevated by design."
        palette = ["#0A0A0A", "#D4AF37", "#262626", "#F5F5F0"]
        ratio = "4:5"
    elif is_beauty:
        campaign_name = f"{subject}: Radiant Radiance"
        concept = f"Natural luminosity and daily nourishment brought to life through soft, dewy morning lighting."
        headline = f"Reveal Your Daily Glow with {subject}"
        tagline = "Essential care crafted for pure radiance."
        palette = ["#FB7185", "#FDE047", "#0F172A", "#FFF1F2"]
        ratio = "4:5"
    else:
        campaign_name = f"{subject} — The Next Evolution"
        concept = f"High-impact visual showcase capturing {subject} at the intersection of performance and design."
        headline = f"Experience {subject}"
        tagline = "Designed to deliver real results every single day."
        palette = ["#0F172A", "#2563EB", "#38BDF8", "#F8FAFC"]
        ratio = "4:5"

    promotional_copy = f"Discover {subject}. Designed for those who demand superior quality. [Insert confirmed promotional discount or offer details]."
    visual_direction = (
        f"Clean editorial composition featuring {subject} in the hero center. "
        f"Crisp volumetric key lighting, subtle textural shadows, clean negative space at the top for typography, "
        f"and refined typography hierarchy with balanced margins."
    )
    image_prompt = (
        f"Professional commercial advertising photography of {subject}. Studio lighting, clean negative space "
        f"reserved for headline typography, editorial magazine styling, 8k resolution, color-graded palette ({', '.join(palette)}), "
        f"shot on Hasselblad H6D-100c, sharp product focus, commercial key visual, vertical 4:5 aspect ratio."
    )
    caption = (
        f"Ready to experience the difference with {subject}? ✨\n\n"
        f"Engineered for quality, designed for your lifestyle. Discover what makes {subject} distinctive.\n\n"
        f"👉 Tap the link in bio to explore the collection. Limited seasonal availability."
    )
    cta = "Explore the Collection"
    tags = [f"#{re.sub(r'[^a-zA-Z0-9]', '', subject)}", "#DigitalMarketing", "#BrandCampaign", "#CreativeDirection"]

    fallback_data = {
        "campaign_name": campaign_name,
        "creative_concept": concept,
        "main_ad_headline": headline,
        "supporting_tagline": tagline,
        "promotional_copy": promotional_copy,
        "visual_design_direction": visual_direction,
        "image_generation_prompt": image_prompt,
        "social_media_caption": caption,
        "call_to_action": cta,
        "relevant_hashtags": tags,
        "palette": palette,
        "aspect_ratio": ratio,
        "platform": "Instagram",
    }
    fallback_data["formatted_markdown"] = _format_markdown_output(fallback_data)
    return fallback_data


# ── Agent Node ────────────────────────────────────────────────────────────────

def creative_agent_node(state: dict) -> dict:
    """
    Main LangGraph node for the Creative Director Agent.
    Transforms raw user intent or campaign brief into the 10-point advertising campaign.
    """
    step_banner("CREATIVE AGENT  ─  AI Digital Marketing & Ad Creative Director")

    user_intent    = state.get("user_intent", "")
    campaign_plan  = state.get("campaign_plan", {})
    brand_profile  = state.get("brand_profile", {})
    campaign_brief = state.get("campaign_brief", {})
    company_name   = state.get("company_name") or brand_profile.get("businessName") or campaign_plan.get("campaign_name", "")
    channels       = state.get("user_channels") or campaign_plan.get("channels") or ["Instagram", "Facebook"]

    # Gather prompt context
    brand_context = f"Brand: {company_name}\n" if company_name else ""
    if brand_profile:
        brand_context += f"Industry: {brand_profile.get('industry', '')}\nVoice: {brand_profile.get('voiceAdjectives', [])}\n"
    if campaign_brief:
        brand_context += f"Goal: {campaign_brief.get('goal', '')}\nTarget Audience: {campaign_brief.get('targetAudience', '')}\nKey Messages: {campaign_brief.get('keyMessages', [])}\n"
    elif campaign_plan:
        brand_context += f"Goal: {campaign_plan.get('goal', '')}\nAudience: {campaign_plan.get('target_audience', '')}\nTone: {campaign_plan.get('tone', '')}\n"

    user_prompt = (
        f"Campaign Request / User Intent:\n{user_intent}\n\n"
        f"Available Brand & Campaign Context:\n{brand_context}\n"
        f"Target Channels: {', '.join(channels) if isinstance(channels, list) else channels}\n"
        "Generate the complete creative campaign following the 10-point AI Digital Marketing & Ad Creative Director framework."
    )

    agent_log("CREATIVE", f"Directing campaign for: '{user_intent[:80]}...'")

    creative_dict: dict = {}
    try:
        llm = get_llm(temperature=0.7)
        agent = CreativeAgent()
        messages = [
            SystemMessage(content=agent.build_prompt(SYSTEM_PROMPT)),
            HumanMessage(content=user_prompt),
        ]
        response = llm.invoke(messages)
        content = response.content
        if isinstance(content, list):
            content = content[0].get("text", str(content)) if len(content) > 0 else ""
        raw_text = content.strip()
        creative_dict = extract_json(raw_text)
        if not isinstance(creative_dict, dict):
            creative_dict = {}
    except Exception as e:
        agent_log("CREATIVE", f"LLM creative generation error ({e}) — activating fallback creative engine")
        creative_dict = _generate_fallback_creative(user_intent, brand_name=company_name)

    # Ensure required fields exist
    if not creative_dict.get("campaign_name"):
        creative_dict = _generate_fallback_creative(user_intent, brand_name=company_name)

    if not creative_dict.get("formatted_markdown"):
        creative_dict["formatted_markdown"] = _format_markdown_output(creative_dict)

    # ── Real Image Generation for Creative Campaign ──────────────────────────
    img_b64 = state.get("image_result", {}).get("image_base64")
    image_model = (
        state.get("image_model")
        or os.getenv("IMAGE_MODEL")
        or "google/gemini-2.0-flash-exp:free"
    )
    image_api_key = (
        (state.get("image_api_key") or "").strip()
        or (state.get("llm_api_key") or "").strip()
        or os.getenv("OPENROUTER_API_KEY", "").strip()
        or os.getenv("GEMINI_API_KEY", "").strip()
    )

    if not img_b64 and image_api_key:
        try:
            from agents.creative.image_engine import _dispatch_image
            from agents.creative.poster_engine import compose_poster
            
            img_prompt = (
                creative_dict.get("image_generation_prompt")
                or f"High-end advertising hero shot for {creative_dict.get('campaign_name')}, {creative_dict.get('creative_concept')}, professional studio photography, cinematic lighting, 8k resolution, no text, no logo"
            )
            agent_log("CREATIVE", f"Generating real visual advertisement via {image_model}...")
            raw_b64 = _dispatch_image(img_prompt, image_api_key, image_model)
            if raw_b64:
                # Compose into a branded advertising poster with headline and CTA
                brief_dict = {
                    "brand": company_name or creative_dict.get("campaign_name", "Brand"),
                    "copy": {
                        "headline": creative_dict.get("main_ad_headline", "Exclusive Collection"),
                        "subheadline": creative_dict.get("supporting_tagline", ""),
                        "cta": creative_dict.get("call_to_action", "Shop Now"),
                        "badge": "LIMITED",
                    },
                    "palette": {
                        "primary": (creative_dict.get("palette") or ["#D97706"])[0],
                        "accent": (creative_dict.get("palette") or ["#D97706", "#F59E0B"])[1] if len(creative_dict.get("palette", [])) > 1 else "#F59E0B",
                        "neutral": "#FFFFFF",
                    },
                    "aspect_ratio": creative_dict.get("aspect_ratio", "4:5"),
                    "size_px": "1080x1350",
                    "layout": {
                        "headline_zone": "top 25%, centered",
                        "hero_zone": "center, 50% height",
                        "cta_zone": "bottom 12%, centered pill button",
                        "text_color": "#FFFFFF",
                        "font_style": "bold energetic impact headline",
                    }
                }
                composed = compose_poster(raw_b64, brief_dict)
                img_b64 = composed or raw_b64
                agent_log("CREATIVE", "✅ Real advertisement visual composed successfully!")
        except Exception as ie:
            agent_log("CREATIVE", f"Image generation notice: {ie}")

    img_preview_url = f"data:image/jpeg;base64,{img_b64}" if img_b64 else None

    # Construct concrete banner options for the UI
    banner_options = [
        {
            "id": "v1",
            "title": "1. Product Hero Banner (1200x628)",
            "url": img_preview_url,
            "overlay": creative_dict.get("main_ad_headline", "Claim Exclusive Offer"),
            "format": "LinkedIn / Meta Landscape (1200x628)",
            "prompt": creative_dict.get("image_generation_prompt", ""),
            "w": 1200,
            "h": 628,
        },
        {
            "id": "v2",
            "title": "2. Social Story Poster (1080x1350)",
            "url": img_preview_url,
            "overlay": creative_dict.get("supporting_tagline") or creative_dict.get("main_ad_headline", "Discover More"),
            "format": "Instagram / Reels Story (1080x1350)",
            "prompt": creative_dict.get("image_generation_prompt", ""),
            "w": 1080,
            "h": 1350,
        },
        {
            "id": "v3",
            "title": "3. Lifestyle Square (1080x1080)",
            "url": img_preview_url,
            "overlay": creative_dict.get("call_to_action", "Explore The Collection"),
            "format": "Feed Square (1080x1080)",
            "prompt": creative_dict.get("image_generation_prompt", ""),
            "w": 1080,
            "h": 1080,
        },
    ]

    # Build Pydantic model
    result_model = CreativeResult(
        campaign_name=creative_dict.get("campaign_name", "Marketing Campaign"),
        creative_concept=creative_dict.get("creative_concept", ""),
        main_ad_headline=creative_dict.get("main_ad_headline", ""),
        supporting_tagline=creative_dict.get("supporting_tagline", ""),
        promotional_copy=creative_dict.get("promotional_copy", ""),
        visual_design_direction=creative_dict.get("visual_design_direction", ""),
        image_generation_prompt=creative_dict.get("image_generation_prompt", ""),
        social_media_caption=creative_dict.get("social_media_caption", ""),
        call_to_action=creative_dict.get("call_to_action", "Shop Now"),
        relevant_hashtags=creative_dict.get("relevant_hashtags", []),
        palette=creative_dict.get("palette", []),
        aspect_ratio=creative_dict.get("aspect_ratio", "4:5"),
        platform=creative_dict.get("platform", "Instagram"),
        formatted_markdown=creative_dict.get("formatted_markdown"),
        image_url=img_preview_url,
        image_preview_url=img_preview_url,
        image_base64=img_b64,
        banner_options=banner_options,
        has_image=bool(img_b64),
    )

    # ── Console Summary ───────────────────────────────────────────────────────
    divider()
    section("AI CREATIVE DIRECTOR CAMPAIGN")
    kv("Campaign Name", result_model.campaign_name)
    kv("Headline",      result_model.main_ad_headline)
    kv("Tagline",       result_model.supporting_tagline)
    kv("CTA",           result_model.call_to_action)
    kv("Platform",      result_model.platform)
    divider()

    # ── Publish to Kafka ──────────────────────────────────────────────────────
    publish_event(
        topic=Topics.results_for("creative_agent"),
        source_agent="creative_agent",
        payload={
            "event": "creative_campaign_generated",
            "campaign_name": result_model.campaign_name,
            "headline": result_model.main_ad_headline,
            "image_prompt": result_model.image_generation_prompt,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )

    # Store in state
    state["creative_result"] = result_model.model_dump()
    state["creative_output"] = result_model.model_dump()
    
    # Also add trace
    trace = state.get("trace", [])
    trace.append({
        "agent": "creative_agent",
        "status": "completed",
        "ok": True,
        "detail": f"Generated campaign: '{result_model.campaign_name}' with 10-point creative brief.",
    })
    state["trace"] = trace

    return state["creative_result"]
