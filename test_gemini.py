import os
import urllib.request
import json
api_key = os.getenv("GEMINI_API_KEY")
url = f"https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key={api_key}"
payload = {
    "instances": [
        {"prompt": "A beautiful sunset over the ocean"}
    ],
    "parameters": {
        "sampleCount": 1
    }
}
req = urllib.request.Request(
    url,
    data=json.dumps(payload).encode("utf-8"),
    headers={"Content-Type": "application/json"},
)
try:
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = json.loads(resp.read().decode())
        print("Success! Keys in response:", data.keys())
        if 'predictions' in data:
            print("Base64 length:", len(data['predictions'][0]['bytesBase64Encoded']))
except Exception as e:
    print(f"Exception: {e}")
    if hasattr(e, 'read'):
        print(e.read().decode())
