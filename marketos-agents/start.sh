#!/bin/sh
# MarketOS Agent Service — startup script
# Runs uvicorn in the foreground (PID 1 for signal handling).
# Kafka worker runs in the background — it is fully optional.
# Using a shell script (not CMD [...]) ensures ${PORT} is always expanded.

# NOTE: Do NOT use `set -e` here — if the Kafka worker background process
# fails (e.g. broker unreachable), we must NOT exit, or Railway's healthcheck
# will fail because uvicorn is gone too.

APP_PORT="${PORT:-8000}"
echo "[start.sh] Starting Kafka worker in background (non-fatal if Kafka unavailable)..."

# Start Kafka worker in the BACKGROUND — it is fully optional.
# Kafka connection errors must NOT kill uvicorn or the healthcheck.
python worker.py &
WORKER_PID=$!
echo "[start.sh] Kafka worker PID=${WORKER_PID} started in background."

# Start uvicorn in the FOREGROUND so it becomes the process Railway monitors.
# This is the process that must stay alive for /v1/health to respond.
echo "[start.sh] Starting uvicorn on port ${APP_PORT} (foreground)..."
exec python -m uvicorn api:app --host 0.0.0.0 --port "${APP_PORT}"
