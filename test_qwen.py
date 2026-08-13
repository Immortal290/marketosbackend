import os
import sys

# add parent directory to path so imports work
sys.path.append(os.path.join(os.getcwd(), 'marketos-agents'))
from agents.creative.image_engine import image_agent_node, _generate_qwen_image

os.environ["QWEN_API_KEY"] = "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"

print(_generate_qwen_image("test prompt"))
