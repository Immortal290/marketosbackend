import urllib.request
import json
import base64

api_key = "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"
url = "https://integrate.api.nvidia.com/v1/images/generations"

payload = {
    "model": "Qwen/Qwen-Image",
    "prompt": "a beautiful landscape",
    "n": 1,
    "size": "1024x1024",
    "response_format": "b64_json"
}

req = urllib.request.Request(
    url,
    data=json.dumps(payload).encode("utf-8"),
    headers={
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
        "Accept": "application/json"
    }
)
try:
    with urllib.request.urlopen(req) as resp:
        print(resp.read().decode()[:100])
except Exception as e:
    print(e)
    if hasattr(e, 'read'):
        print(e.read().decode())
