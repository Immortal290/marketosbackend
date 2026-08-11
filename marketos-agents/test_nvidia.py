import os
import sys

# Add path to import from marketos-agents
sys.path.insert(0, "/home/sam/marketosbackend-1/marketos-agents")

from agents.llm.llm_provider import get_glm
from langchain_core.messages import SystemMessage, HumanMessage

def test():
    try:
        glm = get_glm(temperature=0)
        clf_response = glm.invoke([
            SystemMessage(content="You are an intent classifier."),
            HumanMessage(content="Hello"),
        ])
        print("Success:")
        print(clf_response.content)
    except Exception as e:
        print("Exception:")
        print(e)

if __name__ == "__main__":
    test()
