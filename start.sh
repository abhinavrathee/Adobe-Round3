#!/usr/bin/env bash
set -e

echo "[start] ADOBE_EMBED_API_KEY=${ADOBE_EMBED_API_KEY:+(set)}  LLM_PROVIDER=${LLM_PROVIDER:-unset}  TTS_PROVIDER=${TTS_PROVIDER:-unset}"
echo "[start] GOOGLE_APPLICATION_CREDENTIALS=${GOOGLE_APPLICATION_CREDENTIALS:-unset}  GEMINI_MODEL=${GEMINI_MODEL:-unset}"

# Launch backend (FastAPI / Uvicorn) on 127.0.0.1:8000
python -m uvicorn main:app --host 127.0.0.1 --port 8000 &
UVICORN_PID=$!

# Launch nginx on :8080
nginx -g "daemon off;" &
NGINX_PID=$!

# Wait on both; exit if either dies
wait -n $UVICORN_PID $NGINX_PID
EXIT_CODE=$?
echo "[start] one of the processes exited with code $EXIT_CODE"
exit $EXIT_CODE
