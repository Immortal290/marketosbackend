import glob

policy = """
<guardrails>
STRICT CONTENT SERVICE POLICY:
1. You MUST analyze and use ONLY the provided context and original user prompt.
2. DO NOT invent, hallucinate, or inject any external facts, features, or offers outside of the provided context.
3. If information is missing, rely strictly on what is provided; do not guess or assume.
4. Your output MUST be strictly derived from the provided input parameters.
</guardrails>"""

files = [
    "agents/social/social_media_agent.py",
    "agents/sms/sms_agent.py",
    "agents/onboarding/onboarding_agent.py",
    "agents/seo/seo_agent.py",
    "agents/reporting/reporting_agent.py",
    "agents/competitor/competitor_agent.py"
]

for fpath in files:
    try:
        with open(fpath, "r") as f:
            content = f.read()
        
        # Avoid double inserting
        if "<guardrails>" in content:
            print(f"Skipping {fpath}, already has guardrails")
            continue
            
        content = content.replace('</output_format>"""', '</output_format>' + policy + '"""')
        
        with open(fpath, "w") as f:
            f.write(content)
        print(f"Updated {fpath}")
    except Exception as e:
        print(f"Error on {fpath}: {e}")
