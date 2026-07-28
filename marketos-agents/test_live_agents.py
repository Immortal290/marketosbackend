import os
import sys
import json
import traceback
from dotenv import load_dotenv

# Ensure root dir is in sys.path
root_dir = "/home/sam/marketosbackend-1"
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

# Load real environment variables from .env
load_dotenv(os.path.join(root_dir, ".env"))

# Make sure PYTEST_CURRENT_TEST is unset so real APIs are called
if "PYTEST_CURRENT_TEST" in os.environ:
    del os.environ["PYTEST_CURRENT_TEST"]

test_results = {}

def run_live_test(name, module_path, node_name, state):
    print(f"\n==================================================")
    print(f"  ⚡ Testing Live Agent: {name}")
    print(f"==================================================")
    try:
        mod = __import__(module_path, fromlist=[node_name])
        node_func = getattr(mod, node_name)
        result_state = node_func(state.copy())
        print(f"✅ {name}: SUCCESS")
        test_results[name] = {"status": "SUCCESS", "error": None}
        return result_state
    except Exception as e:
        print(f"❌ {name}: FAILED - {e}")
        traceback.print_exc()
        test_results[name] = {"status": "FAILED", "error": str(e)}
        return None

def main():
    print("🚀 Running Live Agent Fleet Verification...")
    
    initial_plan = {
        "campaign_id": "VOLTX-01",
        "campaign_name": "VoltX Fast Protein",
        "goal": "Promote new energy protein shake to fitness enthusiasts",
        "target_audience": "Gym-goers in India 18-35",
        "channels": ["email", "sms", "voice", "social"],
        "budget": 50000.0,
        "timeline": "7 days",
        "tone": "energetic",
        "key_messages": ["Fuel your workout with VoltX", "Zero sugar 25g protein"],
        "tasks": [
            {"agent": "copy_agent", "task": "Generate email copy variants", "priority": "HIGH", "depends_on": []},
            {"agent": "creative_agent", "task": "Create visual assets", "priority": "HIGH", "depends_on": ["copy_agent"]},
            {"agent": "email_agent", "task": "Send test email campaign", "priority": "HIGH", "depends_on": ["creative_agent"]}
        ]
    }
    
    # 1. Supervisor Agent
    sup_state = run_live_test(
        "Supervisor Agent",
        "agents.supervisor.supervisor_agent",
        "supervisor_node",
        {"user_intent": "Launch VoltX campaign for fitness fans in India"}
    )
    plan = sup_state.get("campaign_plan", initial_plan) if sup_state else initial_plan

    # 2. Copy Agent (Uses Gemini / Groq LLM)
    copy_state = run_live_test(
        "Copy Agent",
        "agents.copy.copy_agent",
        "copy_agent_node",
        {"campaign_plan": plan}
    )
    copy_output = copy_state.get("copy_output") if copy_state else None

    # 3. Creative / Image Engine (Uses Unsplash & Gemini)
    img_state = run_live_test(
        "Creative Image Agent",
        "agents.creative.image_engine",
        "image_agent_node",
        {"campaign_plan": plan, "copy_output": copy_output}
    )

    # 4. Compliance Agent (Uses Gemini / LLM)
    comp_state = run_live_test(
        "Compliance Agent",
        "agents.compliance.compliance_agent",
        "compliance_agent_node",
        {"campaign_plan": plan, "copy_output": copy_output}
    )

    # 5. Competitor Agent (Uses Live Serper Google Search)
    run_live_test(
        "Competitor Agent",
        "agents.competitor.competitor_agent",
        "competitor_agent_node",
        {"campaign_plan": plan}
    )

    # 6. Email Agent (Sends via SendGrid API / SMTP)
    run_live_test(
        "Email Agent",
        "agents.email.email_agent",
        "email_agent_node",
        {
            "campaign_plan": plan,
            "copy_output": copy_output,
            "recipient_email": "deepansadhukhan@gmail.com"
        }
    )

    # 7. SMS Agent (Twilio SMS API)
    run_live_test(
        "SMS Agent",
        "agents.sms.sms_agent",
        "sms_agent_node",
        {"campaign_plan": plan, "recipient_phone": "+919876543210"}
    )

    # 8. SEO Agent (Uses Live Serper Google Search)
    run_live_test(
        "SEO Agent",
        "agents.seo.seo_agent",
        "seo_agent_node",
        {"campaign_plan": plan}
    )

    # 9. Social Media Agent (Uses LLM content generation)
    run_live_test(
        "Social Media Agent",
        "agents.social.social_media_agent",
        "social_media_agent_node",
        {"campaign_plan": plan}
    )

    # 10. Finance Agent (Postgres & Budget Gate)
    run_live_test(
        "Finance Agent",
        "agents.finance.finance_agent",
        "finance_agent_node",
        {"campaign_plan": plan}
    )

    # Print Full Verification Summary
    print("\n" + "=" * 60)
    print("          LIVE AGENT FLEET VERIFICATION SUMMARY          ")
    print("=" * 60)
    passed = 0
    failed = 0
    for agent, info in test_results.items():
        status = info["status"]
        if status == "SUCCESS":
            print(f"  ✅ {agent:<28} : SUCCESS")
            passed += 1
        else:
            print(f"  ❌ {agent:<28} : FAILED ({info['error']})")
            failed += 1
    print("-" * 60)
    print(f"Total Agents Tested Live : {len(test_results)}")
    print(f"Passed                   : {passed}")
    print(f"Failed                   : {failed}")
    print("=" * 60)

if __name__ == "__main__":
    main()
