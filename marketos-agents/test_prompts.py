import os
import json
from agents.orchestrator.glm_orchestrator import orchestrate_query_stream

test_cases = [
    {
        "name": "Strict Constraint Test (Email)",
        "prompt": "Send an email campaign for VoltX offering a 15% discount. Our budget is exactly $450 and it runs for 2 days. Do not add any other offers.",
        "channels": ["email"]
    },
    {
        "name": "Visual Assets Only",
        "prompt": "Generate some lifestyle ad banners for an upcoming organic green tea launch called ZenLeaf. No emails or sms, just the visuals.",
        "channels": ["social"]
    },
    {
        "name": "Analytics Query",
        "prompt": "Analyze the performance of our last social media campaign. Did we hit our CTR goals?",
        "channels": []
    }
]

print("\n" + "="*70)
print("MARKETOS MULTI-PROMPT VERIFICATION")
print("="*70)

for i, tc in enumerate(test_cases):
    print(f"\n[{i+1}] TEST CASE: {tc['name']}")
    print(f"    PROMPT: '{tc['prompt']}'")
    print("-" * 70)
    
    events = orchestrate_query_stream(
        user_query=tc['prompt'],
        recipient_email="test@example.com",
        company_name="MarketOS Test",
        channels=tc['channels']
    )
    
    intent = None
    plan = None
    
    for event in events:
        if "data:" not in event:
            continue
            
        try:
            data_str = event.split("data: ", 1)[1].strip()
            data = json.loads(data_str)
            
            # Capture intent
            if data.get("stage") == "GLM_REASONING" and data.get("data", {}).get("intent"):
                intent = data["data"]["intent"]
                print(f"    ✅ INTENT CLASSIFIED: {intent}")
                print(f"       REASONING: {data['data'].get('reasoning', '')}")
                
            # Capture campaign plan if available
            if data.get("stage") == "AGENT_COMPLETED" and data.get("data", {}).get("agent") == "supervisor":
                plan = data["data"].get("result", {}).get("campaign_plan", {})
                print(f"    ✅ SUPERVISOR PLAN GENERATED")
                print(f"       Campaign Name: {plan.get('campaign_name')}")
                print(f"       Budget: {plan.get('budget')}")
                print(f"       Key Messages: {plan.get('key_messages', [])}")
                
        except Exception as e:
            pass

    print("-" * 70)

print("\nVerification Complete.")
