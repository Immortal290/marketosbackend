import os
import sys
import json
import traceback

# Set test environment flag for mock LLM
os.environ["PYTEST_CURRENT_TEST"] = "true"
os.environ["DEFAULT_WORKSPACE_ID"] = "test_workspace"
os.environ["DATABASE_URL"] = "postgresql://localhost/dummy"
os.environ["REDIS_URL"] = "redis://localhost/dummy"

# Add agents path to sys.path
agents_path = "/home/lenovo/marketosbackend/agents_extracted"
if agents_path not in sys.path:
    sys.path.insert(0, agents_path)

# Dictionary to collect results
test_results = {}

def run_agent_test(name, module_path, node_name, initial_state):
    print(f"\n--- Testing Agent: {name} ({node_name}) ---")
    try:
        # Dynamically import the module
        mod = __import__(module_path, fromlist=[node_name])
        node_func = getattr(mod, node_name)
        
        # Execute the agent node
        result_state = node_func(initial_state.copy())
        
        print(f"✅ {name} executed successfully.")
        test_results[name] = {"status": "SUCCESS", "error": None}
        return result_state
    except Exception as e:
        print(f"❌ {name} failed: {e}")
        traceback.print_exc()
        test_results[name] = {"status": "FAILED", "error": str(e)}
        return None

def main():
    print("==================================================")
    print("      Starting MarketOS AI Agent Fleet Test       ")
    print("==================================================")

    # 1. Supervisor Agent
    sup_state = run_agent_test(
        "Supervisor Agent", 
        "agents.supervisor.supervisor_agent", 
        "supervisor_node", 
        {"user_intent": "Launch a new protein shake called VoltX for gym-goers in India."}
    )
    
    if not sup_state:
        print("\nSupervisor Agent failed, cannot proceed with downstream dependent tests.")
        sys.exit(1)

    campaign_plan = sup_state.get("campaign_plan")
    
    # 2. Copy Agent
    copy_state = run_agent_test(
        "Copy Agent",
        "agents.copy.copy_agent",
        "copy_agent_node",
        {"campaign_plan": campaign_plan}
    )

    copy_output = copy_state.get("copy_output") if copy_state else None

    # 3. Image Agent
    img_state = run_agent_test(
        "Image Agent",
        "agents.creative.image_engine",
        "image_agent_node",
        {"campaign_plan": campaign_plan, "copy_output": copy_output}
    )
    
    copy_output_with_img = img_state.get("copy_output") if img_state else copy_output

    # 4. Compliance Agent
    comp_state = run_agent_test(
        "Compliance Agent",
        "agents.compliance.compliance_agent",
        "compliance_agent_node",
        {"campaign_plan": campaign_plan, "copy_output": copy_output_with_img}
    )
    
    compliance_result = comp_state.get("compliance_result") if comp_state else None

    # 5. Email Agent
    run_agent_test(
        "Email Agent",
        "agents.email.email_agent",
        "email_agent_node",
        {
            "campaign_plan": campaign_plan, 
            "copy_output": copy_output_with_img,
            "compliance_result": compliance_result,
            "recipient_email": "test@example.com"
        }
    )

    # 6. SMS Agent
    run_agent_test(
        "SMS Agent",
        "agents.sms.sms_agent",
        "sms_agent_node",
        {"campaign_plan": campaign_plan, "recipient_phone": "+919999999999"}
    )

    # 7. Voice Agent
    run_agent_test(
        "Voice Agent",
        "agents.voice.voice_agent",
        "voice_agent_node",
        {"campaign_plan": campaign_plan, "recipient_phone": "+919999999999"}
    )

    # 8. Social Media Agent
    run_agent_test(
        "Social Media Agent",
        "agents.social.social_media_agent",
        "social_media_agent_node",
        {"campaign_plan": campaign_plan}
    )

    # 9. AB Test Agent
    run_agent_test(
        "AB Test Agent",
        "agents.ab_test.ab_test_agent",
        "ab_test_agent_node",
        {"campaign_plan": campaign_plan}
    )

    # 10. Analytics Agent
    run_agent_test(
        "Analytics Agent",
        "agents.analytics.analytics_agent",
        "analytics_agent_node",
        {"campaign_plan": campaign_plan}
    )

    # 11. Competitor Agent
    run_agent_test(
        "Competitor Agent",
        "agents.competitor.competitor_agent",
        "competitor_agent_node",
        {"campaign_plan": campaign_plan}
    )

    # 12. Finance Agent
    run_agent_test(
        "Finance Agent",
        "agents.finance.finance_agent",
        "finance_agent_node",
        {"campaign_plan": campaign_plan}
    )

    # 13. Lead Scoring Agent
    run_agent_test(
        "Lead Scoring Agent",
        "agents.lead_scoring.lead_scoring_agent",
        "lead_scoring_agent_node",
        {"campaign_plan": campaign_plan}
    )

    # 14. Monitor Agent
    run_agent_test(
        "Monitor Agent",
        "agents.monitor.monitor_agent",
        "monitor_agent_node",
        {"campaign_plan": campaign_plan}
    )

    # 15. Onboarding Agent
    run_agent_test(
        "Onboarding Agent",
        "agents.onboarding.onboarding_agent",
        "onboarding_agent_node",
        {"campaign_plan": campaign_plan}
    )

    # 16. Reporting Agent
    run_agent_test(
        "Reporting Agent",
        "agents.reporting.reporting_agent",
        "reporting_agent_node",
        {"campaign_plan": campaign_plan}
    )

    # 17. SEO Agent
    run_agent_test(
        "SEO Agent",
        "agents.seo.seo_agent",
        "seo_agent_node",
        {"campaign_plan": campaign_plan}
    )

    # 18. Personalization Agent (direct function call test)
    print("\n--- Testing Personalization Agent (direct function call) ---")
    try:
        from agents.personalization.personalization_agent import personalize_for_contact
        p_res = personalize_for_contact(
            contact_id="C-TEST",
            variant=copy_output["variants"][0] if copy_output else {},
            campaign_plan=campaign_plan,
            contact_data={
                "first_name": "Kankana",
                "city": "Kolkata",
                "segment": "high_intent",
                "total_orders": 5,
                "email_opens_30d": 12,
                "email_clicks_30d": 4
            }
        )
        print("✅ Personalization Agent executed successfully.")
        test_results["Personalization Agent"] = {"status": "SUCCESS", "error": None}
    except Exception as e:
        print(f"❌ Personalization Agent failed: {e}")
        traceback.print_exc()
        test_results["Personalization Agent"] = {"status": "FAILED", "error": str(e)}

    # Summary report
    print("\n" + "=" * 50)
    print("              AI AGENT FLEET VALIDATION REPORT            ")
    print("=" * 50)
    
    passed_count = 0
    failed_count = 0
    
    for agent_name, status_dict in test_results.items():
        status = status_dict["status"]
        err = status_dict["error"]
        err_msg = f" (Error: {err})" if err else ""
        print(f"  {agent_name:<30} : {status}{err_msg}")
        if status == "SUCCESS":
            passed_count += 1
        else:
            failed_count += 1
            
    print("-" * 50)
    print(f"Total Agents Tested : {len(test_results)}")
    print(f"PASSED              : {passed_count}")
    print(f"FAILED              : {failed_count}")
    print("==================================================")
    
    if failed_count > 0:
        sys.exit(1)
    else:
        sys.exit(0)

if __name__ == "__main__":
    main()
