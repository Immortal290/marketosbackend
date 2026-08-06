import os
import sys
import json
import urllib.request
import urllib.error
import smtplib
import socket
from dotenv import load_dotenv

load_dotenv()

try:
    import psycopg2
except ImportError:
    psycopg2 = None

try:
    from redis import Redis
except ImportError:
    Redis = None

GEMINI_KEY = os.getenv("GEMINI_API_KEY", "")
GROQ_KEY = os.getenv("GROQ_API_KEY", "")
NVIDIA_KEY = os.getenv("NVIDIA_API_KEY", "")
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
MSG91_API_KEY = os.getenv("MSG91_API_KEY", "")
SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY", "")
SERPER_API_KEY = os.getenv("SERPER_API_KEY", "")
SMTP_EMAIL = os.getenv("SMTP_EMAIL", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))

results = {}

def test_gemini(key, label):
    url = f"https://generativelanguage.googleapis.com/v1beta/models?key={key}"
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
            results[f"Gemini ({label})"] = {"status": "SUCCESS", "info": f"Found {len(data.get('models', []))} models"}
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        results[f"Gemini ({label})"] = {"status": "FAILED", "code": e.code, "error": body}
    except Exception as e:
        results[f"Gemini ({label})"] = {"status": "FAILED", "error": str(e)}

def test_groq(key):
    url = "https://api.groq.com/openai/v1/models"
    try:
        req = urllib.request.Request(url, headers={
            "Authorization": f"Bearer {key}",
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64)"
        })
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
            results["Groq API"] = {"status": "SUCCESS", "info": f"Found {len(data.get('data', []))} models"}
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        results["Groq API"] = {"status": "FAILED", "code": e.code, "error": body}
    except Exception as e:
        results["Groq API"] = {"status": "FAILED", "error": str(e)}

def test_nvidia(key):
    url = "https://integrate.api.nvidia.com/v1/models"
    try:
        req = urllib.request.Request(url, headers={"Authorization": f"Bearer {key}"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
            results["NVIDIA API"] = {"status": "SUCCESS", "info": f"Found {len(data.get('data', []))} models"}
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        results["NVIDIA API"] = {"status": "FAILED", "code": e.code, "error": body}
    except Exception as e:
        results["NVIDIA API"] = {"status": "FAILED", "error": str(e)}
def test_serper(key):
    url = "https://google.serper.dev/search"
    headers = {
        "X-API-KEY": key,
        "Content-Type": "application/json"
    }
    data = json.dumps({"q": "test query"}).encode('utf-8')
    try:
        req = urllib.request.Request(url, data=data, headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=10) as resp:
            res = json.loads(resp.read().decode())
            results["Serper API"] = {"status": "SUCCESS", "info": "Search query succeeded"}
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        results["Serper API"] = {"status": "FAILED", "code": e.code, "error": body}
    except Exception as e:
        results["Serper API"] = {"status": "FAILED", "error": str(e)}

def test_sendgrid(key):
    url = "https://api.sendgrid.com/v3/scopes"
    headers = {"Authorization": f"Bearer {key}", "User-Agent": "Mozilla/5.0"}
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as resp:
            res = json.loads(resp.read().decode())
            results["SendGrid API"] = {"status": "SUCCESS", "info": f"Valid API Key, scopes retrieved"}
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        results["SendGrid API"] = {"status": "FAILED", "code": e.code, "error": body}
    except Exception as e:
        results["SendGrid API"] = {"status": "FAILED", "error": str(e)}

def test_msg91(key):
    # Checking the SMS Balance endpoint instead of Email to avoid subscription errors
    url = "https://control.msg91.com/api/v5/balance.php?type=4"
    headers = {"authkey": key, "User-Agent": "Mozilla/5.0"}
    try:
        req = urllib.request.Request(url, headers=headers, method="GET")
        with urllib.request.urlopen(req, timeout=10) as resp:
            # Note: The MSG91 balance API may return a simple string or JSON depending on the route
            res = resp.read().decode()
            results["MSG91 API"] = {"status": "SUCCESS", "info": f"Authenticated, SMS Route Balance: {res}"}
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        results["MSG91 API"] = {"status": "FAILED", "code": e.code, "error": body}
    except Exception as e:
        results["MSG91 API"] = {"status": "FAILED", "error": str(e)}

def test_twilio(sid, auth):
    import base64
    url = f"https://api.twilio.com/2010-04-01/Accounts/{sid}.json"
    auth_str = base64.b64encode(f"{sid}:{auth}".encode()).decode()
    headers = {"Authorization": f"Basic {auth_str}"}
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as resp:
            res = json.loads(resp.read().decode())
            results["Twilio API"] = {"status": "SUCCESS", "info": f"Account status: {res.get('status')}"}
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        results["Twilio API"] = {"status": "FAILED", "code": e.code, "error": body}
    except Exception as e:
        results["Twilio API"] = {"status": "FAILED", "error": str(e)}

def test_smtp():
    pwd_clean = SMTP_PASSWORD.replace(" ", "")
    try:
        server = smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10)
        server.starttls()
        server.login(SMTP_EMAIL, pwd_clean)
        server.quit()
        results["SMTP Gmail"] = {"status": "SUCCESS", "info": f"Logged in successfully as {SMTP_EMAIL}"}
    except Exception as e:
        results["SMTP Gmail"] = {"status": "FAILED", "error": str(e)}

if __name__ == "__main__":
    print("Running key verification tests with updated .env settings...\n")
    test_gemini(GEMINI_KEY, "Gemini Key")
    test_groq(GROQ_KEY)
    test_nvidia(NVIDIA_KEY)
    test_serper(SERPER_API_KEY)
    test_sendgrid(SENDGRID_API_KEY)
    test_msg91(MSG91_API_KEY)
    test_twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
    test_smtp()

    print(json.dumps(results, indent=2))
