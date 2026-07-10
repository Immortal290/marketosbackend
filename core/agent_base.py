from typing import List
from core.skill_loader import load_skills

class AgentBase:
    def __init__(self, name: str, skills: List[str]):
        self.name = name
        self.skills = skills
        self.skill_context = load_skills(skills)

    def build_prompt(self, task_input: str) -> str:
        return f"""You are {self.name}.

SKILLS:
{self.skill_context}

TASK:
{task_input}"""
