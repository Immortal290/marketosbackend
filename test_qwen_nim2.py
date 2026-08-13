import urllib.request, json

api_key = "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"

# Try different base URLs including the NIM-specific one
endpoints = [
    "https://integrate.api.nvidia.com/v1/images/generations",
    "https://ai.api.nvidia.com/v1/generate",
    "https://api.nvcf.nvidia.com/v2/nvcf/pexec/functions",
]

for url in endpoints:
    payload = {"model": "qwen/qwen-image", "prompt": "A red apple", "response_format": "b64_json", "n": 1}
    req = urllib.request.Request(url, data=json.dumps(payload).encode(), headers={"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            print(f"SUCCESS {url}:", r.read().decode()[:200])
    except Exception as e:
        err_body = e.read().decode() if hasattr(e, 'read') else str(e)
        print(f"FAIL {url}: {err_body[:150]}")

