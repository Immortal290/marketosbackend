"""
MarketOS — WhatsApp Agent
Generates a short, creative advertisement message with an image prompt for a poster highlighting the sale.
"""

from __future__ import annotations
import json
from datetime import datetime, timezone

from langchain_core.messages import SystemMessage, HumanMessage

from agents.llm.llm_provider import get_llm
from utils.agent_base import AgentBase
from utils.logger import agent_log, step_banner, kv, section, divider

WHATSAPP_SYSTEM_PROMPT = """You are a WhatsApp marketing specialist.

Your task: Write ONE short, creative WhatsApp advertisement message for a product/service, focusing on highlighting a sale.

STRICT RULES:
- Maximum 800 characters.
- Use emojis effectively but do not overdo it.
- Include a clear call-to-action (CTA) with a URL placeholder: [LINK]
- End with a sense of urgency.
- Write in the requested tone and language.

Also provide a short IMAGE PROMPT (max 50 words) for generating a promotional poster highlighting the sale.

Return ONLY valid JSON with this schema:
{
  "message": "<the whatsapp ad text>",
  "image_prompt": "<50-word DALL-E / FLUX prompt describing the sale poster>",
  "hashtags": ["#tag1", "#tag2"]
}
"""

class WhatsappAgent(AgentBase):
    agent_name = "whatsapp_agent"
    
    def execute(self, state: dict) -> dict:
        step_banner("WHATSAPP AGENT  ─  Generating Campaign")
        
        plan = state.get("campaign_plan", {})
        goal = plan.get("goal", "Drive sales")
        audience = plan.get("target_audience", "General audience")
        tone = plan.get("tone", "conversational")
        
        user_prompt = f"""
Goal: {goal}
Audience: {audience}
Tone: {tone}

Please generate the WhatsApp message and the poster image prompt.
"""
        
        agent_log("WHATSAPP", "Calling LLM for WhatsApp ad generation...")
        llm = get_llm("creative", temperature=0.7)
        
        messages = [
            SystemMessage(content=WHATSAPP_SYSTEM_PROMPT),
            HumanMessage(content=user_prompt),
        ]
        
        try:
            resp = llm.invoke(messages)
            content = resp.content.replace("```json", "").replace("```", "").strip()
            parsed = json.loads(content)
            wa_message = parsed.get("message", "")
            image_prompt = parsed.get("image_prompt", "")
            hashtags = parsed.get("hashtags", [])
            agent_log("WHATSAPP", "LLM Generation successful.")
        except Exception as e:
            agent_log("WHATSAPP", f"LLM parsing error: {e}")
            wa_message = f"Don't miss our latest sale! Check it out here: [LINK]\n\nReply STOP to opt out."
            image_prompt = "A vibrant promotional poster highlighting a massive sale, bright colors, bold text."
            hashtags = ["#sale"]

        section("WhatsApp Ad Generated")
        kv("Message Length", len(wa_message))
        kv("Image Prompt", image_prompt)
        divider()
        
        result = {
            "whatsapp_message": wa_message,
            "whatsapp_image_prompt": image_prompt,
            "whatsapp_hashtags": hashtags,
            "campaign_id": plan.get("campaign_id", ""),
            "messages_scheduled": 1,
            "template_used": "generated",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        
        return {
            **state,
            "whatsapp_result": result,
            "current_step": "complete",
            "trace": state.get("trace", []) + [{
                "agent": "whatsapp_agent",
                "status": "completed",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }],
        }

whatsapp_agent = WhatsappAgent()
def whatsapp_agent_node(state: dict) -> dict:
    return whatsapp_agent.execute(state)
