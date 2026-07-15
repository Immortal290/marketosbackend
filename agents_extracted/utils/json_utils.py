import json
import re

def extract_json(text: str) -> dict | list:
    match = re.search(r'```json\s*(.*?)\s*```', text, re.DOTALL)
    if match:
        text = match.group(1)
    else:
        start = text.find('{')
        if start == -1:
            start = text.find('[')
        end = text.rfind('}')
        if end == -1:
            end = text.rfind(']')
        if start != -1 and end != -1:
            text = text[start:end+1]
    return json.loads(text)

def safe_float(val, default=0.0):
    try:
        return float(val)
    except (ValueError, TypeError):
        return default

def safe_int(val, default=0):
    try:
        return int(val)
    except (ValueError, TypeError):
        return default
