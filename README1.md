# AcroLens – Intelligent PDF Workbench

A document intelligence system built for the **Adobe India Hackathon 2025**.  
AcroLens helps users analyze PDFs in depth, connect insights across documents, and even generate podcast-style audio summaries.  

---

## 🚀 Features

- **Multi-PDF Upload** → Work with multiple documents in one session.  
- **AI-Powered Insights** → Extract summaries, contradictions, overlaps, and examples.  
- **Semantic Search** → Instantly find related context across your document library.  
- **Audio Summaries** → Listen to your documents in podcast-style audio.  
- **Clean 3-Column UI** → PDF viewer, insights, and related content side-by-side.  
- **Progressive Processing** → Start interacting instantly while background analysis continues.  

---

## 🛠️ Architecture

- **Frontend** → React (Vite) SPA, served on port `8080` in Docker.  
- **Backend** → FastAPI (Python 3.11) with semantic search, embeddings, and TTS/LLM integration.  
- **Processing** → Background pipeline for PDF parsing + embeddings + insight generation.  
- **Deployment** → Single Docker container (multi-stage build: Node for frontend, Python for backend).  

---

## ⚡ Quick Start

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop)  
- (Optional for local dev) Node.js 20+, Python 3.11+

---

### 🐳 Docker Deployment

1. **Build the image**
   ```bash
   docker build --platform linux/amd64 -t acrolens .
