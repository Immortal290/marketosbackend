"""
MarketOS — Voice Daemon (Production-Grade)
FastAPI server bridging Twilio <Connect><Stream> ↔ Gemini 3.1 Flash Live Preview.

Architecture:
  Twilio call → μ-law 8kHz → [this daemon: transcode] → PCM 16kHz → Gemini Live API
  Gemini Live API → PCM 24kHz → [this daemon: transcode] → μ-law 8kHz → Twilio call

Uses:
  - google-genai official SDK (client.aio.live.connect) for production WebSocket management
  - pyngrok for automatic public tunnel creation (Twilio webhook reachability)
  - audioop-lts for μ-law ↔ PCM transcoding

Run:
  uvicorn agents.voice.voice_daemon:app --host 0.0.0.0 --port 8765
"""

from __future__ import annotations

import os
import json
import base64
import asyncio
import audioop
import struct
import logging
from contextlib import asynccontextmanager

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse

import redis.asyncio as aioredis

from google import genai
from google.genai import types

# ── Logging ───────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s — %(message)s",
)
logger = logging.getLogger("VoiceDaemon")

# ── Configuration ─────────────────────────────────────────────────────────────

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
REDIS_URL      = os.getenv("REDIS_URL", "redis://localhost:6379/0")
DAEMON_PORT    = int(os.getenv("VOICE_DAEMON_PORT", "8765"))
MODEL_ID       = "models/gemini-2.5-flash-native-audio-latest"

# Twilio sends audio as PCMU (μ-law) at 8 kHz mono
TWILIO_SAMPLE_RATE  = 8000
TWILIO_SAMPLE_WIDTH = 1  # μ-law = 1 byte per sample

# Gemini Live API expects/returns linear PCM16 at 16kHz mono
GEMINI_INPUT_RATE   = 16000
GEMINI_OUTPUT_RATE  = 24000  # Gemini outputs at 24kHz

# ── Redis Helper ──────────────────────────────────────────────────────────────

async def _redis_get(key: str) -> str | None:
    try:
        r = aioredis.from_url(REDIS_URL, decode_responses=True)
        val = await r.get(key)
        await r.aclose()
        return val
    except Exception as e:
        logger.warning(f"Redis read failed for {key}: {e}")
        return None


async def _redis_set(key: str, value: str, ex: int = 3600) -> None:
    try:
        r = aioredis.from_url(REDIS_URL, decode_responses=True)
        await r.set(key, value, ex=ex)
        await r.aclose()
    except Exception as e:
        logger.warning(f"Redis write failed for {key}: {e}")


async def get_system_prompt(campaign_id: str) -> str:
    default = (
        "You are a friendly, professional voice assistant for MarketOS. "
        "Keep responses short (1-2 sentences). Ask open-ended questions. "
        "Never mention you are an AI unless directly asked."
    )
    if not campaign_id:
        return default
    prompt = await _redis_get(f"voice_prompt:{campaign_id}")
    return prompt or default


# ── Audio Transcoding ─────────────────────────────────────────────────────────
# Production-grade μ-law ↔ linear PCM conversion with sample rate adaptation.

def ulaw_to_pcm16(ulaw_bytes: bytes) -> bytes:
    """Convert μ-law 8kHz mono → linear PCM16 16kHz mono."""
    # Step 1: μ-law → linear PCM16 (still 8kHz)
    pcm_8k = audioop.ulaw2lin(ulaw_bytes, 2)
    # Step 2: Upsample 8kHz → 16kHz (Gemini input requirement)
    pcm_16k, _ = audioop.ratecv(pcm_8k, 2, 1, TWILIO_SAMPLE_RATE, GEMINI_INPUT_RATE, None)
    return pcm_16k


def pcm16_to_ulaw(pcm_bytes: bytes, input_rate: int = GEMINI_OUTPUT_RATE) -> bytes:
    """Convert linear PCM16 at input_rate → μ-law 8kHz mono."""
    # Step 1: Downsample to 8kHz
    pcm_8k, _ = audioop.ratecv(pcm_bytes, 2, 1, input_rate, TWILIO_SAMPLE_RATE, None)
    # Step 2: linear PCM16 → μ-law
    ulaw = audioop.lin2ulaw(pcm_8k, 2)
    return ulaw


# ── Ngrok Tunnel ──────────────────────────────────────────────────────────────

_tunnel_url: str | None = None


def start_ngrok_tunnel(port: int) -> str:
    """Create a public ngrok tunnel and return the wss:// URL."""
    global _tunnel_url
    try:
        from pyngrok import ngrok, conf

        # Set auth token if available
        ngrok_token = os.getenv("NGROK_AUTH_TOKEN")
        if ngrok_token:
            conf.get_default().auth_token = ngrok_token

        tunnel = ngrok.connect(port, proto="http")
        public_url = tunnel.public_url  # e.g. https://abc123.ngrok-free.app
        # Convert https:// to wss:// for WebSocket
        wss_url = public_url.replace("https://", "wss://").replace("http://", "ws://")
        wss_url = f"{wss_url}/twilio/media"
        _tunnel_url = wss_url
        logger.info(f"🌐 Ngrok tunnel active: {public_url}")
        logger.info(f"🔗 Twilio WebSocket URL: {wss_url}")
        return wss_url
    except Exception as e:
        logger.error(f"Ngrok tunnel failed: {e}")
        logger.info("Falling back to localhost — Twilio won't be able to reach this server.")
        _tunnel_url = f"ws://localhost:{port}/twilio/media"
        return _tunnel_url


# ── FastAPI Lifecycle ─────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: create ngrok tunnel and store URL in Redis."""
    wss_url = start_ngrok_tunnel(DAEMON_PORT)
    await _redis_set("voice_daemon:wss_url", wss_url, ex=86400)
    logger.info("Voice Daemon ready.")
    yield
    # Shutdown
    try:
        from pyngrok import ngrok
        ngrok.kill()
    except Exception:
        pass
    logger.info("Voice Daemon shutting down.")


app = FastAPI(
    title="MarketOS Voice Daemon",
    description="Bridges Twilio <Stream> ↔ Gemini 3.1 Flash Live Preview",
    lifespan=lifespan,
)


# ── Health Check ──────────────────────────────────────────────────────────────

@app.get("/")
async def health():
    return JSONResponse({
        "service": "marketos-voice-daemon",
        "status": "healthy",
        "model": MODEL_ID,
        "tunnel": _tunnel_url,
    })


# ── Twilio ↔ Gemini Bridge ───────────────────────────────────────────────────

@app.websocket("/twilio/media")
async def twilio_media_stream(websocket: WebSocket):
    await websocket.accept()
    logger.info("📞 Twilio Media Stream connected.")

    campaign_id = None
    stream_sid  = None
    opening_hook = "Hello! How can I help you today?"

    # ── 1. Wait for Twilio 'start' event ──────────────────────────────────
    try:
        raw = await asyncio.wait_for(websocket.receive_text(), timeout=10.0)
        msg = json.loads(raw)
        if msg.get("event") == "start":
            stream_sid  = msg["start"]["streamSid"]
            params      = msg["start"].get("customParameters", {})
            campaign_id = params.get("campaign_id")
            opening_hook = params.get("opening_hook", opening_hook)
            logger.info(f"Stream {stream_sid} | Campaign {campaign_id}")
    except asyncio.TimeoutError:
        logger.error("Timeout waiting for Twilio 'start' event.")
        await websocket.close()
        return

    system_instruction = await get_system_prompt(campaign_id)

    # ── 2. Connect to Gemini 3.1 Live Preview via official SDK ────────────
    client = genai.Client(api_key=GEMINI_API_KEY)

    config = types.LiveConnectConfig(
        response_modalities=[types.Modality.AUDIO],
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(
                    voice_name="Puck",  # Natural-sounding voice
                ),
            ),
        ),
        system_instruction=types.Content(
            parts=[types.Part(text=system_instruction)],
        ),
    )

    try:
        async with client.aio.live.connect(model=MODEL_ID, config=config) as session:
            logger.info("✅ Connected to Gemini 3.1 Flash Live Preview (Official SDK).")

            # Send opening hook as initial text to synthesize the first greeting
            await session.send_client_content(
                turns=types.Content(
                    role="user",
                    parts=[types.Part(text=f"Say this to start: '{opening_hook}'")],
                ),
                turn_complete=True,
            )

            # ── Concurrent bridge tasks ───────────────────────────────────
            stop_event = asyncio.Event()

            async def twilio_to_gemini():
                """Read μ-law audio from Twilio → transcode → send to Gemini."""
                try:
                    while not stop_event.is_set():
                        raw = await websocket.receive_text()
                        msg = json.loads(raw)

                        if msg["event"] == "media":
                            ulaw_b64 = msg["media"]["payload"]
                            ulaw_bytes = base64.b64decode(ulaw_b64)
                            pcm_bytes = ulaw_to_pcm16(ulaw_bytes)

                            await session.send_realtime_input(
                                media=types.Blob(
                                    mime_type="audio/pcm;rate=16000",
                                    data=pcm_bytes,
                                ),
                            )
                        elif msg["event"] == "stop":
                            logger.info("Twilio stream 'stop' received.")
                            stop_event.set()
                            break
                except WebSocketDisconnect:
                    logger.info("Twilio disconnected (caller hung up).")
                    stop_event.set()
                except Exception as e:
                    logger.error(f"twilio_to_gemini error: {e}")
                    stop_event.set()

            async def gemini_to_twilio():
                """Read audio from Gemini → transcode → send μ-law to Twilio."""
                try:
                    async for response in session.receive():
                        if stop_event.is_set():
                            break

                        server_content = response.server_content
                        if server_content and server_content.model_turn:
                            for part in server_content.model_turn.parts:
                                if part.inline_data and part.inline_data.data:
                                    pcm_data = part.inline_data.data
                                    if isinstance(pcm_data, str):
                                        pcm_data = base64.b64decode(pcm_data)

                                    ulaw_data = pcm16_to_ulaw(pcm_data, GEMINI_OUTPUT_RATE)
                                    ulaw_b64 = base64.b64encode(ulaw_data).decode("ascii")

                                    media_msg = {
                                        "event": "media",
                                        "streamSid": stream_sid,
                                        "media": {"payload": ulaw_b64},
                                    }
                                    await websocket.send_text(json.dumps(media_msg))
                except Exception as e:
                    if not stop_event.is_set():
                        logger.error(f"gemini_to_twilio error: {e}")
                    stop_event.set()

            # Run both directions concurrently
            await asyncio.gather(
                asyncio.create_task(twilio_to_gemini()),
                asyncio.create_task(gemini_to_twilio()),
            )

    except Exception as e:
        logger.error(f"Gemini session error: {e}")
    finally:
        logger.info(f"🔚 Stream {stream_sid} closed.")


# ── Entrypoint ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "agents.voice.voice_daemon:app",
        host="0.0.0.0",
        port=DAEMON_PORT,
        log_level="info",
    )
