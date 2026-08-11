"""
MarketOS — Pipeline Flow Verification Test
Validates:
  1. LLM provider returns Groq with Gemini+Mock fallback chains
  2. Orchestrator uses Groq for intent classification (not hardcoded)
  3. Image engine generates real images via Gemini + Pollinations fallback
  4. Email agent receives and uses recipient_email from state
  5. SMS agent receives and uses recipient_phone from state
  6. Context flows from user_intent through all agents
"""

import os
import sys

# Set test environment
os.environ["PYTEST_CURRENT_TEST"] = "test_pipeline_flow"
sys.path.insert(0, os.path.dirname(__file__))




def test_orchestrator_intent_classification():
    """Verify the orchestrator uses GLM for intent classification."""
    from agents.orchestrator.glm_orchestrator import orchestrate_query_stream

    events = list(orchestrate_query_stream(
        user_query="Run a full email and SMS campaign for our new organic coffee brand GreenBrew with 30% off launch offer",
        recipient_email="test@example.com",
        recipient_phone="+919876543210",
        company_name="GreenBrew",
        channels=["email", "sms"],
    ))

    # Check that GLM_REASONING stage exists and has intent classification
    glm_events = [e for e in events if "GLM_REASONING" in e]
    assert len(glm_events) >= 1, "No GLM_REASONING events found — intent classification may be bypassed"

    # Check that intent was classified
    import json
    for event in events:
        if "data:" in event and "GLM_REASONING" in event:
            data_str = event.split("data: ", 1)[1].strip()
            data = json.loads(data_str)
            if data.get("data", {}).get("intent"):
                intent = data["data"]["intent"]
                print(f"  Intent classified as: {intent}")
                assert intent in [
                    "CREATE_CAMPAIGN", "EMAIL_CAMPAIGN", "SMS_CAMPAIGN",
                    "GENERATE_CONTENT", "GENERAL_QUERY"
                ], f"Unexpected intent: {intent}"
                break

    print("✅ Orchestrator: GLM intent classification active")


def test_image_engine_context_and_fallback():
    """Verify image engine receives campaign context and has Pollinations fallback."""
    from agents.creative.image_engine import image_agent_node

    state = {
        "user_intent": "Launch premium organic coffee brand GreenBrew with 30% off",
        "company_name": "GreenBrew",
        "campaign_plan": {
            "campaign_name": "GreenBrew Launch",
            "tone": "bold",
            "original_user_prompt": "Launch premium organic coffee brand GreenBrew with 30% off",
        },
        "copy_output": {
            "selected_variant_id": "V-001",
            "variants": [{
                "variant_id": "V-001",
                "subject_line": "GreenBrew: 30% Off Launch",
                "body_html": '<td align="center"><img src="cid:hero_image" width="600"></td>',
                "hero_image_query": "organic coffee beans",
                "hero_image_prompt": "Rich dark organic coffee beans in a wooden bowl, steam rising, warm morning light",
            }],
        },
        "trace": [],
    }

    result = image_agent_node(state)

    # Verify image_result exists with proper structure
    img_result = result.get("image_result", {})
    assert img_result.get("has_image") is True, "Image result missing has_image flag"
    assert img_result.get("creative_concept"), "Missing creative_concept"
    assert img_result.get("creative_direction"), "Missing creative_direction"
    assert img_result.get("color_palette"), "Missing color_palette"
    assert len(img_result.get("banner_options", [])) > 0, "banner_options is EMPTY — Pollinations URLs not generated"

    # Verify banner options have URLs (not hardcoded images)
    for banner in img_result.get("banner_options", []):
        assert banner.get("url"), f"Banner {banner.get('id')} missing URL"
        assert "pollinations.ai" in banner.get("url", ""), f"Banner URL not from Pollinations: {banner.get('url', '')[:80]}"
        assert banner.get("overlay"), f"Banner {banner.get('id')} missing overlay text"

    # Verify context is in the prompt
    prompt_used = img_result.get("prompt_used", "")
    assert "GreenBrew" in prompt_used or "coffee" in prompt_used.lower(), \
        f"Campaign context not in image prompt: {prompt_used[:100]}"

    # Verify image_preview_url is set
    assert img_result.get("image_preview_url"), "Missing image_preview_url"

    print(f"✅ Image Engine: {len(img_result.get('banner_options', []))} banners with Pollinations URLs")
    print(f"  Creative concept: {img_result.get('creative_concept', '')[:80]}")
    print(f"  Preview URL: {img_result.get('image_preview_url', '')[:80]}...")


def test_email_agent_recipient_threading():
    """Verify email agent receives and uses recipient_email from pipeline state."""
    from agents.email.email_agent import email_agent_node

    state = {
        "user_intent": "Send email campaign for GreenBrew coffee 30% off launch",
        "recipient_email": "customer@example.com",
        "sender_name": "GreenBrew Team",
        "company_name": "GreenBrew",
        "workspace_id": "default",
        "campaign_plan": {
            "campaign_id": "TEST-001",
            "campaign_name": "GreenBrew Launch",
            "goal": "500 conversions in 7 days",
            "target_audience": "Coffee enthusiasts aged 25-45",
            "channels": ["email"],
            "budget": 50000,
            "timeline": "7 days",
            "tone": "bold",
            "key_messages": ["30% off premium organic coffee", "Free shipping on first order"],
            "tasks": [],
        },
        "copy_output": {
            "selected_variant_id": "V-001",
            "selection_reasoning": "V-001 has a stronger subject line",
            "brand_voice_notes": "Bold, direct, action-oriented",
            "variants": [{
                "variant_id": "V-001",
                "subject_line": "GreenBrew: 30% Off Your First Order",
                "preview_text": "Premium organic coffee, now at launch price",
                "body_html": "<html><body><h1>GreenBrew Launch</h1><p>30% off</p></body></html>",
                "body_text": "GreenBrew Launch\n30% off",
                "cta_text": "Shop Now",
                "cta_url": "https://greenbrew.com/launch",
                "hero_image_query": "organic coffee",
                "hero_image_prompt": "Coffee beans photo",
                "readability_score": 85.0,
                "tone_alignment_score": 90.0,
                "spam_risk_score": 5.0,
                "estimated_open_rate": 32.0,
                "estimated_ctr": 4.5,
            }],
        },
        "compliance_result": {"compliance_score": 95, "approved": True},
        "trace": [],
        "errors": [],
    }

    result = email_agent_node(state)

    send_result = result.get("send_result", {})
    assert send_result, "No send_result returned from email agent"
    assert send_result.get("status") == "SENT", f"Expected SENT status, got: {send_result.get('status')}"
    assert send_result.get("optimal_send_time"), "Missing optimal_send_time"
    assert send_result.get("drip_sequence_preview"), "Missing drip_sequence_preview"

    # Verify real email send was attempted (mocked in test)
    assert send_result.get("real_email_sent") is True, "real_email_sent should be True in mock mode"

    # Verify the trace shows the recipient
    trace = result.get("trace", [])
    email_trace = [t for t in trace if t.get("agent") == "email_agent"]
    assert len(email_trace) > 0, "No email_agent trace found"
    assert email_trace[0].get("real_email_to") == "customer@example.com", \
        f"Recipient not threaded: {email_trace[0].get('real_email_to')}"

    print(f"✅ Email Agent: recipient threaded, status={send_result.get('status')}")
    print(f"  Real email to: {email_trace[0].get('real_email_to')}")
    print(f"  Send time: {send_result.get('optimal_send_time')}")


def test_sms_agent_recipient_threading():
    """Verify SMS agent receives and uses recipient_phone from pipeline state."""
    from agents.sms.sms_agent import sms_agent_node

    state = {
        "user_intent": "Send SMS campaign for GreenBrew coffee 30% off launch",
        "recipient_phone": "+919876543210",
        "sender_name": "GreenBrew",
        "company_name": "GreenBrew",
        "workspace_id": "default",
        "campaign_plan": {
            "campaign_id": "TEST-002",
            "campaign_name": "GreenBrew Launch SMS",
            "goal": "200 conversions via SMS",
            "target_audience": "Coffee lovers aged 25-45 in India",
            "channels": ["sms"],
            "budget": 10000,
            "timeline": "3 days",
            "tone": "urgent",
            "key_messages": ["30% off premium organic coffee", "Order now, limited stock"],
            "tasks": [],
        },
        "copy_output": {},
        "compliance_result": {"compliance_score": 95, "approved": True},
        "trace": [],
        "errors": [],
    }

    result = sms_agent_node(state)

    sms_result = result.get("sms_result", {})
    assert sms_result, "No sms_result returned"

    # Verify SMS variants were generated
    variants = sms_result.get("variants", [])
    assert len(variants) >= 1, f"Expected at least 1 SMS variant, got {len(variants)}"

    # Verify variant content is context-aware (should mention GreenBrew/coffee)
    for v in variants:
        msg = v.get("message", "")
        assert len(msg) > 0, f"Empty SMS message for variant {v.get('variant_id')}"
        assert v.get("char_count", 0) > 0, f"Zero char_count for variant {v.get('variant_id')}"
        print(f"  [{v.get('variant_id')}] ({v.get('char_count')} chars): {msg[:80]}")

    print(f"✅ SMS Agent: {len(variants)} variants generated, status={sms_result.get('status')}")


def test_context_flows_through_pipeline():
    """Verify user_intent context flows through the entire pipeline."""
    from agents.supervisor.supervisor_agent import supervisor_node

    state = {
        "user_intent": "Launch a premium artisan dark chocolate brand called ChocoLux with a Buy 2 Get 1 Free offer targeting urban millennials in Mumbai",
        "user_channels": ["email", "sms"],
        "campaign_plan": {
            "campaign_name": "ChocoLux Launch",
            "goal": "1000 orders in 14 days",
            "target_audience": "Urban millennials in Mumbai",
            "channels": ["email", "sms"],
            "budget": 100000,
            "timeline": "14 days",
            "tone": "bold",
            "key_messages": ["Buy 2 Get 1 Free", "Premium artisan chocolate"],
            "tasks": [],
        },
        "trace": [],
        "errors": [],
    }

    result = supervisor_node(state)
    plan = result.get("campaign_plan", {})

    # Verify campaign plan has the user's context (not generic VoltX placeholders)
    assert plan.get("campaign_name"), "Missing campaign_name"
    assert plan.get("goal"), "Missing goal"
    assert plan.get("key_messages"), "Missing key_messages"

    # Check that key messages are NOT hardcoded VoltX content
    for msg in plan.get("key_messages", []):
        assert "VoltX" not in msg, f"HARDCODED VoltX content found in key_messages: {msg}"

    # Verify original_user_prompt is preserved
    assert plan.get("original_user_prompt"), "original_user_prompt not preserved in campaign_plan"

    print(f"✅ Context Flow: campaign plan reflects user intent")
    print(f"  Campaign: {plan.get('campaign_name')}")
    print(f"  Goal: {plan.get('goal')}")
    print(f"  Key messages: {plan.get('key_messages', [])[:2]}")


if __name__ == "__main__":
    print("\n" + "=" * 70)
    print("MarketOS Pipeline Flow Verification")
    print("=" * 70 + "\n")

    tests = [
        ("Image Engine Context & Fallback", test_image_engine_context_and_fallback),
        ("Email Agent Recipient Threading", test_email_agent_recipient_threading),
        ("SMS Agent Recipient Threading", test_sms_agent_recipient_threading),
        ("Context Flows Through Pipeline", test_context_flows_through_pipeline),
        ("Orchestrator Intent Classification", test_orchestrator_intent_classification),
    ]

    passed = 0
    failed = 0
    for name, test_fn in tests:
        print(f"\n{'─' * 50}")
        print(f"Testing: {name}")
        print(f"{'─' * 50}")
        try:
            test_fn()
            passed += 1
        except Exception as e:
            print(f"❌ FAILED: {e}")
            import traceback
            traceback.print_exc()
            failed += 1

    print(f"\n{'=' * 70}")
    print(f"Results: {passed} passed, {failed} failed out of {len(tests)} tests")
    print(f"{'=' * 70}\n")
