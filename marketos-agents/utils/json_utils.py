"""
MarketOS — JSON Extraction Utility
LLMs (especially Gemini) often wrap JSON in markdown code blocks
even when instructed not to. This handles all cases robustly.
"""

import json
import re
from typing import Any


def extract_json(text: str) -> Any:
    """
    Attempt to extract a valid JSON object or array from an LLM response.
    Handles: pure JSON, ```json blocks, ``` blocks, JSON embedded in prose.
    Raises ValueError if nothing parseable is found.
    """
    text = text.strip()

    # 1. Direct parse — fastest path (clean LLM response)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # 2. Markdown code block with language tag: ```json ... ```
    match = re.search(r"```json\s*([\s\S]*?)\s*```", text)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass

    # 3. Generic code block: ``` ... ```
    match = re.search(r"```\s*([\s\S]*?)\s*```", text)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass

    # 4. Find the largest JSON object in the text
    brace_match = re.search(r"\{[\s\S]*\}", text)
    if brace_match:
        try:
            return json.loads(brace_match.group(0))
        except json.JSONDecodeError:
            pass

    # 5. Find a JSON array
    bracket_match = re.search(r"\[[\s\S]*\]", text)
    if bracket_match:
        try:
            return json.loads(bracket_match.group(0))
        except json.JSONDecodeError:
            pass

    raise ValueError(
        f"Could not extract JSON from LLM response.\n"
        f"First 400 chars of response:\n{text[:400]}"
    )


def safe_float(value: Any, default: float = 0.0) -> float:
    """Safely coerce a value to float."""
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def safe_int(value: Any, default: int = 0) -> int:
    """Safely coerce a value to int."""
    try:
        return int(value)
    except (TypeError, ValueError):
        return default
