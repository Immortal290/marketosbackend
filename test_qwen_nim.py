import urllib.request, json

api_key = "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"

# Try the hosted NVIDIA API catalog
for model_id in ["qwen/qwen-image", "Qwen/Qwen-Image"]:
    url = "https://ai.api.nvidia.com/v1/images/generations"
    payload = {"model": model_id, "prompt": "A red apple", "response_format": "b64_json", "n": 1}
    req = urllib.request.Request(url, data=json.dumps(payload).encode(), headers={"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            print(f"SUCCESS with {model_id} at {url}:", r.read().decode()[:200])
    except Exception as e:
        err_body = e.read().decode() if hasattr(e, 'read') else str(e)
        print(f"FAIL [{model_id}] {url}: {err_body[:200]}")

