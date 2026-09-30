#!/bin/sh
# MarketOS Agent Service — startup script
# Runs uvicorn in the background and the Kafka worker in the foreground.
# Using a shell script (not CMD [...]) ensures ${PORT} is always expanded.

set -e

APP_PORT="${PORT:-8000}"
echo "[start.sh] Starting uvicorn on port ${APP_PORT}..."

# Start uvicorn in the background
python -m uvicorn api:app --host 0.0.0.0 --port "${APP_PORT}" &
UVICORN_PID=$!
echo "[start.sh] uvicorn PID=${UVICORN_PID} started."

# Start the Kafka worker in the foreground.
# If worker exits (standby mode or normal shutdown), also stop uvicorn.
echo "[start.sh] Starting Kafka worker..."
python worker.py
WORKER_EXIT=$?
echo "[start.sh] Worker exited with code ${WORKER_EXIT}. Stopping uvicorn..."
kill "${UVICORN_PID}" 2>/dev/null || true
exit "${WORKER_EXIT}"
