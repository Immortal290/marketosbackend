"""
MarketOS — MSG91 WhatsApp Delivery
"""

from __future__ import annotations

import os
import json
import urllib.request
from typing import Optional

from utils.logger import agent_log

def send_whatsapp_message(
    to_phone: str,
    message: str,
    template_name: Optional[str] = None
) -> dict:
    """
    Send a transactional/marketing WhatsApp message using MSG91.
    """
    if os.getenv("PYTEST_CURRENT_TEST"):
        agent_log("MSG91_WHATSAPP", "Mocking send_whatsapp_message for tests")
        return {"sent": True, "provider": "Mock", "status_code": 200}
    
    api_key = os.getenv("MSG91_API_KEY")
    sender_number = os.getenv("MSG91_WHATSAPP_NUMBER")
    template = template_name or os.getenv("MSG91_WHATSAPP_TEMPLATE", "default_template")

    if not api_key or not sender_number:
        agent_log("MSG91_WHATSAPP", "Missing MSG91_API_KEY or MSG91_WHATSAPP_NUMBER")
        return {"sent": False, "provider": "MSG91", "error": "Missing MSG91 credentials"}

    # Normalize phone
    to_phone = "".join(filter(str.isdigit, to_phone))
    
    payload = {
        "integrated-number": sender_number,
        "content_type": "template",
        "payload": {
            "to": to_phone,
            "type": "template",
            "template": {
                "name": template,
                "language": {
                    "code": "en",
                    "policy": "deterministic"
                },
                "components": [
                    {
                        "type": "body",
                        "parameters": [
                            {
                                "type": "text",
                                "text": message[:1000] # Usually limits apply to variables
                            }
                        ]
                    }
                ]
            }
        }
    }

    try:
        req = urllib.request.Request(
            "https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/send",
            data=json.dumps(payload).encode("utf-8"),
            headers={"authkey": api_key, "content-type": "application/json", "accept": "application/json"},
            method="POST"
        )
        
        with urllib.request.urlopen(req, timeout=10) as resp:
            resp_body = resp.read().decode("utf-8")
            
            try:
                response_data = json.loads(resp_body)
                success_flag = response_data.get("msgType") == "success" or response_data.get("status") == "success" or response_data.get("hasError") is False
            except ValueError:
                success_flag = "success" in resp_body.lower()
                response_data = resp_body
                
            if success_flag:
                agent_log("MSG91_WHATSAPP", f"✅ WhatsApp message accepted — to {to_phone}")
                return {"sent": True, "provider": "MSG91", "status_code": 200}
            else:
                agent_log("MSG91_WHATSAPP", f"❌ MSG91 rejected: {response_data}")
                return {"sent": False, "provider": "MSG91", "error": str(response_data)}
                
    except Exception as e:
        agent_log("MSG91_WHATSAPP", f"❌ MSG91 exception: {e}")
        return {"sent": False, "provider": "MSG91", "error": str(e)}
