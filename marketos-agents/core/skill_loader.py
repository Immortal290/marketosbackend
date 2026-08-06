import os
from typing import List, Dict

# Cache to store loaded skills in memory
_SKILL_CACHE: Dict[str, str] = {}

# Locate the skills repo at .agents/marketingskills/skills relative to project root
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKILLS_DIR = os.path.join(BASE_DIR, ".agents", "marketingskills", "skills")

def load_skills(skill_names: List[str]) -> str:
    """
    Load SKILL.md files for the provided skill names and concatenate them.
    Results are cached in-memory for performance, ensuring no heavy IO on every execution.
    Missing or unreadable skill files are silently skipped — they must NOT inject
    error strings into the LLM prompt, which would pollute every agent's context.
    """
    context_parts = []

    for skill_name in skill_names:
        if skill_name in _SKILL_CACHE:
            context_parts.append(f"--- SKILL: {skill_name.upper()} ---\n{_SKILL_CACHE[skill_name]}")
            continue

        skill_path = os.path.join(SKILLS_DIR, skill_name, "SKILL.md")
        if os.path.exists(skill_path):
            try:
                with open(skill_path, "r", encoding="utf-8") as f:
                    content = f.read().strip()
                    _SKILL_CACHE[skill_name] = content
                    context_parts.append(f"--- SKILL: {skill_name.upper()} ---\n{content}")
            except Exception:
                pass  # Silently skip unreadable skill — do NOT pollute the prompt
        # else: silently skip — do NOT inject "[Skill file not found]" into the prompt

    return "\n\n".join(context_parts)
