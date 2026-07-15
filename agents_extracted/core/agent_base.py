class AgentBase:
    def __init__(self, name: str = "Generic Agent", skills: list[str] = None):
        self.name = name
        self.skills = skills or []

    def build_prompt(self, expertise: str) -> str:
        return f"{expertise}\n\nAgent Name: {self.name}\nSkills: {', '.join(self.skills)}"

    def get_llm(self, temperature: float = 0):
        from agents.llm.llm_provider import get_llm
        return get_llm(temperature)

    def execute(self, state: dict) -> dict:
        return state

    def __call__(self, state: dict) -> dict:
        return self.execute(state)
