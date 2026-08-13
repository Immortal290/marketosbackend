import urllib.request
import json

url = "https://integrate.api.nvidia.com/v1/chat/completions"
payload = {
    "model": "meta/llama-3.1-70b-instruct",
    "messages": [{"role": "user", "content": "hi"}],
    "max_tokens": 10
}

req = urllib.request.Request(
    url,
    data=json.dumps(payload).encode("utf-8"),
    headers={
        "Content-Type": "application/json",
        "Authorization": "Bearer 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"
    }
)
try:
    with urllib.request.urlopen(req) as resp:
        print(resp.read().decode()[:100])
except Exception as e:
    print(e)
    if hasattr(e, 'read'):
        print(e.read().decode())
