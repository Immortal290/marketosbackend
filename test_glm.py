import os
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# We can import get_glm from agents.llm.llm_provider
sys.path.append(os.path.dirname(__file__))
from agents.llm.llm_provider import get_glm

def test_glm():
    api_key = os.getenv("NVIDIA_API_KEY")
    if not api_key:
        print("❌ ERROR: NVIDIA_API_KEY is not set in your .env file!")
        print("Please add NVIDIA_API_KEY=your_key to your .env file and run this script again.")
        sys.exit(1)

    print(f"✅ NVIDIA_API_KEY found (starts with: {api_key[:10]}...)")
    print("Initializing GLM-5.2 via NVIDIA integrate API...")
    
    try:
        # get_glm uses NVIDIA_API_KEY automatically
        glm = get_glm(temperature=0.1)
        print("Sending test prompt: 'Hello GLM, are you online?'")
        
        # Invoke the model
        response = glm.invoke("Hello GLM, are you online? Respond with a short confirmation.")
        
        print("\n🟢 SUCCESS! Received response from GLM-5.2:")
        print("-" * 40)
        print(response.content)
        print("-" * 40)
        
    except Exception as e:
        print(f"\n❌ ERROR connecting to GLM-5.2: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    test_glm()
