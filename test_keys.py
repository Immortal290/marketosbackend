import requests
import json
import sys

payload = {
    "user_query": "Create an email campaign for a new luxury watch.",
    "channels": ["email"],
    "llm_model": "gemini-2.0-flash",
    "llm_api_key": "MOCK_LLM_KEY",
    "image_model": "black-forest-labs/FLUX.1-schnell",
    "image_api_key": "MOCK_IMAGE_KEY"
}

print("Testing API stream...")
try:
    with requests.post("http://localhost:8000/v1/query/stream", json=payload, stream=True) as r:
        if r.status_code != 200:
            print(f"Failed! Status code {r.status_code}")
            print(r.text)
            sys.exit(1)
        for line in r.iter_lines():
            if line:
                decoded = line.decode('utf-8')
                print(decoded)
                if "error" in decoded.lower():
                    print("Error found in stream!")
except Exception as e:
    print(f"Exception: {e}")

