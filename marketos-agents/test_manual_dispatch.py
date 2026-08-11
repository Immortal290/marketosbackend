import os
import requests
import base64
from agents.creative.image_engine import _generate_pollinations_image
from utils.sendgrid_mailer import send_email

print("\n" + "="*70)
print("MARKETOS MANUAL DISPATCH TEST")
print("="*70)

recipient = "samriddharoy0804@gmail.com"
print(f"Generating Image Engine outputs for ZenLeaf Organic Green Tea...")

# 1. Generate Image Engine outputs via Pollinations (no API key needed)
hero_base64 = _generate_pollinations_image(
    full_prompt="A beautiful, calming lifestyle ad banner for ZenLeaf organic green tea, featuring a serene natural landscape with a steaming cup of green tea at its center.",
    width=1200,
    height=628
)

print("\n[🖼️  IMAGE ENGINE OUTPUTS]")
print(f"Image Source: AI-generated (pollinations-flux)")
print(f"Image Base64 Length: {len(hero_base64) if hero_base64 else 0} bytes")

# 2. Send Real Email
print("\n[✉️  EMAIL ENGINE OUTPUTS]")
print(f"Sending real email to {recipient}...")

html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); margin-top: 20px; margin-bottom: 20px;">
        <!-- Banner Image -->
        <tr>
            <td align="center" style="padding: 0;">
                <img src="cid:hero_image" alt="ZenLeaf Organic Green Tea" style="display: block; width: 100%; max-width: 600px; height: auto;" />
            </td>
        </tr>
        <!-- Content -->
        <tr>
            <td style="padding: 40px 30px;">
                <h2 style="color: #2c5e3b; text-align: center; margin-top: 0; font-size: 24px;">Find Your Calm in Chaos with ZenLeaf</h2>
                <p style="color: #555555; line-height: 1.6; font-size: 16px; margin-bottom: 20px;">
                    Unlock the power of mindful moments and elevate your wellbeing with ZenLeaf organic green tea.
                </p>
                <p style="color: #555555; line-height: 1.6; font-size: 16px; margin-bottom: 30px;">
                    Experience nature's harmony in every cup, sustainably sourced and carefully crafted to nourish your body and soul.
                </p>
                <!-- CTA Button -->
                <table border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                        <td align="center">
                            <a href="https://marketos.ai" style="display: inline-block; background-color: #4CAF50; color: #ffffff; padding: 14px 30px; text-decoration: none; border-radius: 4px; font-weight: bold; font-size: 16px;">Redeem Your 15% Welcome Discount</a>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
        <!-- Footer -->
        <tr>
            <td style="background-color: #f8f9fa; padding: 20px 30px; text-align: center; border-top: 1px solid #eeeeee;">
                <p style="font-size: 12px; color: #888888; margin: 0; line-height: 1.5;">
                    <strong>MarketOS Inc</strong><br>
                    123 Innovation Drive, Tech City.<br><br>
                    You received this because you are an exclusive VIP tester.
                </p>
            </td>
        </tr>
    </table>
</body>
</html>
"""

email_res = send_email(
    to_email=recipient,
    subject="Your Exclusive Invite: ZenLeaf Organic Green Tea",
    html_content=html_content,
    sender_name="ZenLeaf via MarketOS",
    hero_image_base64=hero_base64,
    campaign_id="TEST-ZENLEAF-01"
)

print(f"Real Email Sent: {email_res.get('sent')}")
print(f"Provider Used: {email_res.get('provider')}")
if email_res.get('error'):
    print(f"Error: {email_res.get('error')}")

print("\nDispatch complete.")
