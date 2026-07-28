from __future__ import annotations
import uuid
from datetime import datetime, timezone

from utils.agent_base import AgentBase
from utils.logger import agent_log, step_banner

class WhatsappAgent(AgentBase):
    agent_name = "whatsapp_agent"
    
    def execute(self, state: dict) -> dict:
        step_banner("WHATSAPP AGENT  ─  Processing")
        
        agent_log("WHATSAPP", "Executing whatsapp agent stub")
        
        result = {
            "campaign_id": state.get("campaign_plan", {}).get("campaign_id", ""),
            "messages_scheduled": 0,
            "template_used": "none",
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
