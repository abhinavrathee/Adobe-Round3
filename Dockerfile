# -------------------------------
# Stage 1: Build frontend (Vite)
# -------------------------------
FROM node:20-alpine AS webbuild

WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# Build output is at /frontend/dist


# -------------------------------
# Stage 2: App runtime (Python + Nginx)
# -------------------------------
FROM python:3.11-slim

# System deps (ffmpeg for pydub merge support; nginx for static + reverse proxy)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg nginx ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Python deps
WORKDIR /app
COPY backend/requirements.txt ./requirements.txt
ENV PYTHONDONTWRITEBYTECODE=1
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ /app/

# Copy built frontend to web root
COPY --from=webbuild /frontend/dist /web

# Nginx config (serve SPA at /, proxy /api, /static, /config.js to uvicorn)
# We inline a minimal config via here-doc to keep this single-file, no extra repo files needed.
RUN bash -lc 'cat > /etc/nginx/conf.d/default.conf <<\"NGINX\" \
server {\n\
    listen 8080;\n\
    server_name _;\n\
    # Serve built SPA\n\
    root /web;\n\
    index index.html;\n\
\n\
    # Try file, else SPA fallback for client-side routes\n\
    location / {\n\
        try_files $uri /index.html;\n\
    }\n\
\n\
    # Proxy API & backend static to uvicorn\n\
    location /api/ { proxy_pass http://127.0.0.1:8000; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade"; proxy_set_header Host $host; }\n\
    location /static/ { proxy_pass http://127.0.0.1:8000; proxy_set_header Host $host; }\n\
    location = /config.js { proxy_pass http://127.0.0.1:8000/config.js; proxy_set_header Host $host; }\n\
\n\
    # Gzip for assets\n\
    gzip on; gzip_types text/plain text/css application/javascript application/json image/svg+xml;\n\
}\n\
NGINX'

# Ensure nginx doesn’t daemonize (we’ll supervise both processes)
RUN printf 'daemon off;\n' >> /etc/nginx/nginx.conf

# Uvicorn will listen on 127.0.0.1:8000 internally; nginx exposes 8080
ENV PORT=8080

# Start script: uvicorn (backend) + nginx (frontend proxy) in one container
# Using tini-like approach with bash job control; simple and reliable for hackathon.
RUN bash -lc 'cat > /start.sh <<\"START\" \n\
#!/usr/bin/env bash\n\
set -e\n\
# Print runtime config summary\n\
echo \"[start] ADOBE_EMBED_API_KEY=\${ADOBE_EMBED_API_KEY:+(set)}  LLM_PROVIDER=\${LLM_PROVIDER:-unset}  TTS_PROVIDER=\${TTS_PROVIDER:-unset}\"\n\
echo \"[start] GOOGLE_APPLICATION_CREDENTIALS=\${GOOGLE_APPLICATION_CREDENTIALS:-unset}  GEMINI_MODEL=\${GEMINI_MODEL:-unset}\"\n\
\n\
# Launch backend (FastAPI / Uvicorn) on 127.0.0.1:8000\n\
python -m uvicorn main:app --host 127.0.0.1 --port 8000 &\n\
UVICORN_PID=$!\n\
\n\
# Launch nginx on :8080\n\
nginx -g \"daemon off;\" &\n\
NGINX_PID=$!\n\
\n\
# Wait on both; exit if either dies\n\
wait -n $UVICORN_PID $NGINX_PID\n\
EXIT_CODE=$?\n\
echo \"[start] one of the processes exited with code $EXIT_CODE\"\n\
exit $EXIT_CODE\n\
START\n\
&& chmod +x /start.sh'

EXPOSE 8080
CMD ["/start.sh"]
