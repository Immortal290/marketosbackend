import os
import sys
from dotenv import load_dotenv

# Load env before importing our module
load_dotenv("/home/sam/marketosbackend-1/.env")

# Ensure marketos-agents is in path
sys.path.append("/home/sam/marketosbackend-1/marketos-agents")

from agents.creative.image_engine import _generate_flux_schnell_image

if not os.getenv("HF_API_KEY") and not os.getenv("HUGGINGFACE_API_KEY") and not os.getenv("HF_TOKEN"):
    print("No HF_API_KEY found in .env. Skipping real test.")
    sys.exit(0)

print("Testing FLUX.1-schnell generation...")
try:
    img_b64 = _generate_flux_schnell_image("A highly detailed digital illustration of an astronaut riding a futuristic horse on Mars, neon lighting", 1024, 576)
    if img_b64 and len(img_b64) > 100:
        print(f"SUCCESS: Generated image of {len(img_b64)} bytes (base64)")
    else:
        print("FAILED: No image data returned")
except Exception as e:
    print(f"ERROR: {e}")
