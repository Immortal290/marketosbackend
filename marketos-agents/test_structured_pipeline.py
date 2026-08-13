import asyncio
import os
import sys

# Add path so imports work
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from graph.campaign_graph import campaign_graph
from schemas.campaign import CampaignPlan

def main():
    print("Testing Structured Pipeline...")
    
    # 1. Setup mock structured input
    brand_profile = {
        "id": "BRAND-TEST-123",
        "businessName": "VoltX Energy",
        "industry": "Beverages",
        "voiceAdjectives": ["Bold", "Energetic"],
        "complianceRegion": "GDPR", # To trigger compliance rules
        "competitors": [{"name": "Red Bull", "url": "https://redbull.com"}]
    }
    
    campaign_brief = {
        "id": "BRIEF-TEST-123",
        "name": "VoltX Summer Promo",
        "goal": "Drive sales",
        "targetAudience": "Students",
        "keyMessages": ["Stay awake", "Study hard"],
        "budget": 5000
    }
    
    # We'll invoke the graph starting from supervisor
    initial_state = {
        "brand_profile": brand_profile,
        "campaign_brief": campaign_brief,
        "pipeline": "campaign",
        "trace": [],
        "errors": []
    }
    
    print("Running campaign graph...")
    # Run graph
    try:
        final_state = campaign_graph.invoke(initial_state)
    except Exception as e:
        print(f"Graph execution failed: {e}")
        return
        
    print("\n--- TEST RESULTS ---")
    
    # Verify RAG recall in copy agent (we mocked the LLM so it might not do it perfectly, but we can check if it ran without errors)
    copy_output = final_state.get("copy_output", {})
    if copy_output:
        print("✅ Copy agent generated variants.")
    else:
        print("❌ Copy agent failed or didn't run.")
        
    # Verify compliance retry loop
    retry_count = final_state.get("compliance_retry_count", 0)
    print(f"Compliance retry count: {retry_count}")
    if retry_count > 0:
        print("✅ Compliance agent correctly triggered advisory retries.")
    else:
        print("ℹ️ Compliance agent approved on first try, or mock didn't fail it.")
        
    # Verify reporting agent
    reporting = final_state.get("reporting_result", {})
    if reporting:
        print("✅ Reporting agent completed.")
    else:
        print("❌ Reporting agent skipped/failed.")

    print("State keys:", final_state.keys())
    print("\nTrace:")
    for t in final_state.get("trace", []):
        print(f"- {t.get('agent')} -> {t.get('status')}")

if __name__ == "__main__":
    main()
