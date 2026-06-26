"""
MarketOS — LLM Provider Abstraction
Switch providers by changing ONE line in .env:

    LLM_PROVIDER=gemini       →  Google Gemini 2.0 Flash  (default, dev)
    LLM_PROVIDER=anthropic    →  Anthropic Claude Sonnet 4
    LLM_PROVIDER=openrouter   →  OpenRouter (production)

All agents call get_llm() — no agent touches API keys directly.
"""

import os
from dotenv import load_dotenv

load_dotenv()


def get_llm(temperature: float = 0):
    """
    Return a LangChain chat model for the configured provider.

    temperature=0   → deterministic (supervisor, compliance)
    temperature=0.7 → creative      (copy agent)
    """
    if os.getenv("PYTEST_CURRENT_TEST"):
        class MockLLMResponse:
            def __init__(self, content: str):
                self.content = content

        class MockLLM:
            def invoke(self, messages, *args, **kwargs):
                import json
                text = str(messages).lower()
                if "supervisor" in text:
                    ans = {"campaign_name": "VoltX Fast Mock Campaign", "goal": "500 conversions in 3 days", "target_audience": "Men 18-30 India", "channels": ["email", "sms", "voice", "social"], "budget": 75000, "timeline": "3 days", "tone": "bold", "key_messages": ["Buy 2 Get 1 Free", "Limited stock", "Order now"], "tasks": []}
                elif "copy agent" in text:
                    ans = {"variants": [{"variant_id": "V-MOCK1", "subject_line": "VoltX!", "preview_text": "Grab it", "body_html": "<a href='http://x.com'>X</a>", "body_text": "X", "cta_text": "Buy", "cta_url": "http://x", "hero_image_query": "can", "hero_image_prompt": "can", "readability_score": 85.0, "tone_alignment_score": 90.0, "spam_risk_score": 5.0, "estimated_open_rate": 30.0, "estimated_ctr": 4.0}, {"variant_id": "V-MOCK2", "subject_line": "VoltX Free", "preview_text": "Buy", "body_html": "<a href='http://x.com'>Y</a>", "body_text": "Y", "cta_text": "Buy Now", "cta_url": "http://x", "hero_image_query": "gym", "hero_image_prompt": "gym", "readability_score": 82.0, "tone_alignment_score": 88.0, "spam_risk_score": 6.0, "estimated_open_rate": 32.0, "estimated_ctr": 5.0}], "selected_variant_id": "V-MOCK1", "selection_reasoning": "Mock logic", "brand_voice_notes": "bold mock"}
                elif "image agent" in text:
                    ans = {"status": "SUCCESS", "images": [{"variant_id": "V-MOCK1", "image_url": "http://mock.png"}]}
                elif "compliance" in text:
                    ans = {"approved": True, "compliance_score": 95, "checks": [{"rule": "X", "passed": True}], "reason_code": "APPROVED", "blocked_reason": None, "suggestions": []}
                elif "finance" in text:
                    ans = {"approved": True, "spend_pct": 0.5, "cpm_estimate": 80.0, "projected_cost_this_send": 1000.0, "block_reason": None, "recommendations": [], "roas": 3.0, "cpa": 200, "attributed_revenue": 50000, "channel_breakdown": {"email": 1.0}, "profitable": True, "scale_recommendation": "scale mock"}
                elif "sms" in text:
                    ans = {
                        "variants": [
                            {
                                "variant_id": "SMS-001",
                                "message": "VoltX offer live. Buy 2 Get 1 Free today. STOP to 9999",
                                "char_count": 57,
                                "segments": 1,
                                "personalization_tokens": [],
                                "estimated_ctr": 3.2,
                                "angle": "urgency",
                            },
                            {
                                "variant_id": "SMS-002",
                                "message": "VoltX flash sale: stock up now and save. STOP to 9999",
                                "char_count": 56,
                                "segments": 1,
                                "personalization_tokens": [],
                                "estimated_ctr": 2.9,
                                "angle": "value",
                            },
                        ],
                        "selected_variant_id": "SMS-001",
                        "optimal_send_time": "Now",
                        "drip_sequence": ["Day 3 reminder", "Day 7 last chance"],
                        "selection_reasoning": "Mock logic",
                    }
                elif "optimal send time" in text and "drip" in text:
                    ans = {"status": "SENT", "optimal_send_time": "Now", "next_drip_trigger": "never", "drip_sequence_preview": ["Drip 1", "Drip 2"], "recipient_count": 1}
                elif "social media" in text:
                    ans = {"publish_status": "SCHEDULED", "platforms_targeted": ["x", "linkedin", "instagram"], "posts": {"x": {"text": "Mock X", "cta": "Buy", "best_time": "Now"}, "linkedin": {"text": "Mock LinkedIn", "cta": "Buy", "best_time": "Now"}, "instagram": {"text": "Mock Insta", "cta": "Buy", "best_time": "Now"}}, "campaign_hashtags": [], "content_calendar_suggestion": "mock"}
                elif "voice" in text:
                    ans = {"system_instruction": "Mock Voice", "opening_hook": "Mock Hook", "key_talking_points": ["Point 1"], "objection_handlers": {}, "closing_goal": "End", "voice_name": "Kore"}
                elif "analytics" in text:
                    ans = {"metrics": {"open_rate": 0.3}, "anomalies": [], "next_action": "continue", "confidence": "high"}
                elif "monitor" in text:
                    ans = {"status": "healthy", "issues": [], "action": "none"}
                elif "ab test" in text:
                    ans = {"decision": "inconclusive", "confidence": 0, "winner_id": None, "reason": "mock logic"}
                elif "lead scoring" in text:
                    ans = {"total_scored": 1, "high_intent_count": 0, "summary": "Mock summary"}
                elif "competitor" in text:
                    ans = {"competitors": [{"name": "Mock Rival", "url": "mock.com", "pricing": "Free", "messaging": "Good"}], "threat_level": "LOW", "counter_strategy": "Be chill"}
                elif "seo" in text:
                    ans = {"primary_keywords": ["mock", "test"], "search_intent": "informational", "competitor_overlap": [], "content_gaps": ["lack of mocks"], "quick_wins": [{"page": "/home", "reason": "optimize title"}], "content_briefs": [{"priority": "high", "target_keyword": "mock", "title": "Mock Title", "word_count": 500}]}
                elif "reporting" in text:
                    ans = {"executive_summary": "Mock reporting", "key_highlights": ["We mocked"], "recommendation": "do real"}
                elif "onboarding" in text:
                    ans = {"workspace_type": "ecommerce", "drip_sequence": ["Email 1"], "task_list": ["Task 1"]}
                else:
                    ans = {"status": "mocked"}
                return MockLLMResponse(json.dumps(ans))
        return MockLLM()

    provider = os.getenv("LLM_PROVIDER", "gemini").lower()

    if provider == "anthropic":
        from langchain_anthropic import ChatAnthropic
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise EnvironmentError(
                "ANTHROPIC_API_KEY is not set in your .env file. "
                "Add it or switch LLM_PROVIDER=gemini."
            )
        return ChatAnthropic(
            model="claude-sonnet-4-20250514",
            anthropic_api_key=api_key,
            temperature=temperature,
            max_tokens=4096,
        )

    elif provider == "openrouter":
        from langchain_openai import ChatOpenAI
        api_key = os.getenv("OPENROUTER_API_KEY")
        if not api_key:
            raise EnvironmentError(
                "OPENROUTER_API_KEY is not set in your .env file. "
                "Add it or switch LLM_PROVIDER=gemini."
            )
        model = os.getenv("OPENROUTER_MODEL", "google/gemma-4-31b-it:free")
        return ChatOpenAI(
            model=model,
            openai_api_key=api_key,
            openai_api_base="https://openrouter.ai/api/v1",
            temperature=temperature,
            max_tokens=4096,
            default_headers={
                "HTTP-Referer": "https://marketos.ai",
                "X-Title": "MarketOS",
            },
        )

    elif provider == "gemini":
        from langchain_google_genai import ChatGoogleGenerativeAI
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise EnvironmentError(
                "GEMINI_API_KEY is not set in your .env file. "
                "Add it or switch LLM_PROVIDER=anthropic."
            )
        return ChatGoogleGenerativeAI(
            model="gemini-2.0-flash",
            google_api_key=api_key,
            temperature=temperature,
            max_output_tokens=4096,
        )

    else:
        raise ValueError(
            f"Unknown LLM_PROVIDER='{provider}'. "
            "Valid values: gemini | anthropic | openrouter"
        )
