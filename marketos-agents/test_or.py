import os
from openai import OpenAI
import requests

key = os.getenv("OPENROUTER_API_KEY")
if not key:
    print("NO KEY")
    exit()

try:
    client = OpenAI(base_url="https://openrouter.ai/api/v1", api_key=key)
    response = client.chat.completions.create(
        model="sourceful/riverflow-v2.5-fast:free",
        messages=[{"role": "user", "content": "A cute cat"}],
    )
    print("CHAT RESPONSE:", response.choices[0].message.content)
except Exception as e:
    print("CHAT ERROR:", e)

try:
    client = OpenAI(base_url="https://openrouter.ai/api/v1", api_key=key)
    response = client.images.generate(
        model="sourceful/riverflow-v2.5-fast:free",
        prompt="A cute cat",
        n=1,
        response_format="url"
    )
    print("IMAGE RESPONSE:", response.data[0].url)
except Exception as e:
    print("IMAGE ERROR:", e)
