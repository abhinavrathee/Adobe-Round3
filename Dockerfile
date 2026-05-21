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
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Ensure nginx doesn’t daemonize (we’ll supervise both processes)
RUN printf 'daemon off;\n' >> /etc/nginx/nginx.conf

# Uvicorn will listen on 127.0.0.1:8000 internally; nginx exposes 8080
ENV PORT=8080

# Start script: uvicorn (backend) + nginx (frontend proxy) in one container
COPY start.sh /start.sh
RUN chmod +x /start.sh

EXPOSE 8080
CMD ["/start.sh"]
