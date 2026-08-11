import os
import json
from agents.orchestrator.glm_orchestrator import orchestrate_query_stream

print("\n" + "="*70)
print("MARKETOS REAL EMAIL DISPATCH TEST")
print("="*70)

# The user explicitly asked for email AND image engine outputs
prompt = "Send an email campaign about our new organic green tea launch called ZenLeaf. Generate a beautiful lifestyle ad banner for it."

print(f"PROMPT: '{prompt}'")
print(f"RECIPIENT: samriddharoy0804@gmail.com")
print("-" * 70)

events = orchestrate_query_stream(
    user_query=prompt,
    recipient_email="samriddharoy0804@gmail.com",
    company_name="ZenLeaf Organics",
    channels=["email"]
)

for event in events:
    if "data:" not in event:
        continue
        
    try:
        data_str = event.split("data: ", 1)[1].strip()
        data = json.loads(data_str)
        
        # We just want to capture and print the live trace of the agents, especially image and email.
        if data.get("stage") == "AGENT_COMPLETED":
            agent = data["data"].get("agent")
            result = data["data"].get("result", {})
            
            if agent == "image_agent":
                print("\n[🖼️  IMAGE ENGINE OUTPUTS]")
                print(f"Creative Concept: {result.get('creative_concept', 'N/A')}")
                print(f"Direction: {result.get('creative_direction', 'N/A')}")
                print("Generated Banner Options (Pollinations URLs):")
                angles = result.get("angles", [])
                for angle in angles:
                    print(f"  - [{angle.get('title')}] {angle.get('pollinations_url')}")
                    
            elif agent == "email_agent":
                print("\n[✉️  EMAIL ENGINE OUTPUTS]")
                real_status = result.get("real_email_status")
                real_sent = result.get("real_email_sent")
                print(f"Real Email Sent: {real_sent}")
                print(f"Status: {real_status}")
                variant = result.get("selected_variant", {})
                print(f"Subject Line: {variant.get('subject_line')}")
                
    except Exception as e:
        pass

print("\nDispatch complete.")
