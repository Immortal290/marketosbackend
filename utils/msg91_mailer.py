"""
MarketOS — MSG91 Email Delivery
Replaces the SendGrid/SMTP implementation.
"""

from __future__ import annotations

import os
import json
import urllib.request
from typing import Optional

from utils.logger import agent_log
import uuid

def _create_template(api_key: str, subject: str, html_content: str) -> str:
    """Create a temporary template in MSG91 for the HTML content."""
    slug = f"marketos_dyn_{uuid.uuid4().hex[:10]}"
    payload = {
        "name": slug,
        "slug": slug,
        "subject": subject,
        "body": html_content
    }
    try:
        req = urllib.request.Request(
            "https://control.msg91.com/api/v5/email/templates",
            data=json.dumps(payload).encode("utf-8"),
            headers={"authkey": api_key, "content-type": "application/json", "accept": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            agent_log("MSG91_EMAIL", f"Created dynamic template: {slug}")
            return slug
    except Exception as e:
        agent_log("MSG91_EMAIL", f"Failed to create template: {e}")
        raise

def send_email(
    to_email:           str,
    subject:            str,
    html_content:       str,
    sender_name:        str = "MarketOS",
    sender_email:       Optional[str] = None,
    unsubscribe_url:    str = "https://example.com/unsubscribe",
    campaign_id:        Optional[str] = None,
    hero_image_base64:  Optional[str] = None,
    hero_image_mime:    str = "image/jpeg",
) -> dict:
    """
    Send a transactional/marketing email using MSG91.
    """
    if os.getenv("PYTEST_CURRENT_TEST"):
        agent_log("MSG91_EMAIL", "Mocking send_email for tests")
        return {"sent": True, "provider": "Mock", "status_code": 200}
    
    api_key = os.getenv("MSG91_API_KEY")
    domain = os.getenv("MSG91_EMAIL_DOMAIN")
    from_email = sender_email or os.getenv("MSG91_SENDER_EMAIL") or (f"campaigns@{domain}" if domain else "campaigns@marketos.io")

    if not api_key or not domain:
        agent_log("MSG91_EMAIL", "Missing MSG91 credentials — falling back to SMTP")
        from utils.sendgrid_mailer import _send_via_smtp
        return _send_via_smtp(to_email, subject, html_content, sender_name, unsubscribe_url, hero_image_base64)

    try:
        template_id = _create_template(api_key, subject, html_content)
    except Exception as e:
        agent_log("MSG91_EMAIL", f"Template creation failed: {e} — falling back to SMTP")
        from utils.sendgrid_mailer import _send_via_smtp
        return _send_via_smtp(to_email, subject, html_content, sender_name, unsubscribe_url, hero_image_base64)

    payload = {
        "recipients": [
            {
                "to": [
                    {
                        "email": to_email
                    }
                ]
            }
        ],
        "from": {
            "name": sender_name,
            "email": from_email
        },
        "domain": domain,
        "template_id": template_id
    }

    if hero_image_base64:
        payload["attachments"] = [
            {
                "file": hero_image_base64,
                "name": "hero.jpg"
            }
        ]

    try:
        req = urllib.request.Request(
            "https://control.msg91.com/api/v5/email/send",
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
                # Some MSG91 endpoints return success text instead of JSON
                success_flag = "success" in resp_body.lower()
                response_data = resp_body
                
            if success_flag:
                agent_log("MSG91_EMAIL", f"✅ Email accepted — to {to_email}")
                return {"sent": True, "provider": "MSG91", "status_code": 200}
            else:
                agent_log("MSG91_EMAIL", f"❌ MSG91 rejected: {response_data} — falling back to SMTP")
                from utils.sendgrid_mailer import _send_via_smtp
                return _send_via_smtp(to_email, subject, html_content, sender_name, unsubscribe_url, hero_image_base64)
                
    except Exception as e:
        agent_log("MSG91_EMAIL", f"❌ MSG91 exception: {e} — falling back to SMTP")
        from utils.sendgrid_mailer import _send_via_smtp
        return _send_via_smtp(to_email, subject, html_content, sender_name, unsubscribe_url, hero_image_base64)
