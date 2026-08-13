import os
import sys

# add parent directory to path so imports work
sys.path.append(os.path.join(os.getcwd(), 'marketos-agents'))
from agents.llm.llm_provider import get_glm
from langchain_core.messages import SystemMessage, HumanMessage

try:
    print("Testing get_glm...")
    glm = get_glm(temperature=0)
    print("Invoking...")
    resp = glm.invoke([
        SystemMessage(content="You are a helpful assistant."),
        HumanMessage(content="Say hi")
    ])
    print(resp.content)
except Exception as e:
    print("ERROR:", e)
