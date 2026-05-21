<p align="center">
  <img src="frontend/public/acrolens.svg" width="100" alt="AcroLens Logo" />
</p>

<h1 align="center">AcroLens — Intelligent PDF Workbench</h1>

<p align="center">
  <strong>Upload PDFs · Get AI-Powered Insights · Discover Cross-Document Connections · Listen to Podcast Summaries</strong>
</p>

<p align="center">
  Built for the <strong>Adobe India Hackathon 2025 — Round 3 (Finale)</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Frontend-React%20+%20Vite-61DAFB?style=flat-square&logo=react" />
  <img src="https://img.shields.io/badge/Backend-FastAPI%20+%20Python-009688?style=flat-square&logo=fastapi" />
  <img src="https://img.shields.io/badge/PDF-Adobe%20Embed%20SDK-FF0000?style=flat-square&logo=adobe" />
  <img src="https://img.shields.io/badge/AI-Gemini%202.5%20Flash-4285F4?style=flat-square&logo=google" />
  <img src="https://img.shields.io/badge/Deploy-Docker-2496ED?style=flat-square&logo=docker" />
</p>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [System Architecture](#-system-architecture)
- [Project Structure](#-project-structure)
- [Quick Start](#-quick-start)
  - [Prerequisites](#prerequisites)
  - [Local Development](#local-development)
  - [Docker Deployment](#-docker-deployment)
- [Environment Variables](#-environment-variables)
- [API Reference](#-api-reference)
- [User Journey](#-user-journey)
- [Technology Stack](#-technology-stack)
- [Design Decisions](#-design-decisions)

---

## 🔍 Overview

**AcroLens** is a document intelligence system that transforms how users interact with their PDF libraries. Instead of passively reading documents, users can:

1. **Select any text** in a PDF and instantly discover related passages across their entire document library
2. **Generate AI-powered insights** — key takeaways, surprising facts, contradictions, and deeper questions
3. **Listen to podcast-style audio summaries** generated from the document content
4. **Navigate seamlessly** between related sections across multiple PDFs

All results are **grounded exclusively in the user's own documents** — no generic web data, no hallucinated external content. This ensures trust and accuracy for researchers, students, and professionals who work with large volumes of documents daily.

---

## ✨ Key Features

### 1. 📄 PDF Viewing with Adobe Embed SDK
- Full-fidelity PDF rendering using the **Adobe PDF Embed API**
- Text selection events trigger automatic cross-document search
- Page-level navigation with programmatic `goToPage` for snippet jumps
- Supports upload of multiple PDFs into a persistent library

### 2. 🧠 AI-Powered Insights (Gemini 2.5 Flash)
- **Key Insights** — Core takeaways from the current page/selection
- **Did You Know?** — Surprising or non-obvious facts buried in the text
- **Contradictions & Counterpoints** — Opposing viewpoints or conflicting claims
- **Connections** — How the current content links to broader themes
- **Questions** — Thought-provoking questions to deepen understanding
- Insights are generated per-page and also for specific text selections

### 3. 🔗 Cross-Document Related Sections
- **Automatic mode** — When viewing a page, the system finds related content from other PDFs
- **Selection mode** — Select text → instantly see matching passages from your entire library
- **4-tier search cascade:**
  1. Strict threshold (cosine ≥ 0.58)
  2. Relaxed threshold (cosine ≥ 0.42)
  3. Page-based fallback
  4. Keyword sweep (last resort)
- Clicking a related snippet **navigates to that PDF at the exact page** while preserving the results panel

### 4. 🎙️ Podcast-Style Audio Summaries
- Gemini generates a natural, conversational script from the document content
- Text-to-Speech converts the script into a playable MP3
- Supports multiple TTS providers:
  - **Local** (gTTS — free, no API key needed)
  - **GCP** (Google Cloud Text-to-Speech — high-quality Neural2 voices)
  - **Azure** (Azure OpenAI TTS — enterprise-grade)
- Target: ~400 words / 2-5 minute audio per podcast

### 5. 📚 Document Library Management
- Drag-and-drop PDF upload
- Persistent library stored on the backend (`backend/data/library/`)
- Real-time library panel showing all uploaded PDFs with file sizes
- Background indexing triggers automatically after each upload

---

## 🏗️ System Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         BROWSER                                  │
│                                                                  │
│   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐    │
│   │  Adobe   │   │ Insights │   │ Related  │   │ Podcast  │    │
│   │  PDF     │   │  Panel   │   │  Panel   │   │  Bar     │    │
│   │  Viewer  │   │ (Gemini) │   │ (Search) │   │ (TTS)    │    │
│   └────┬─────┘   └────┬─────┘   └────┬─────┘   └────┬─────┘    │
│        │              │              │              │            │
│        └──────────────┴──────────────┴──────────────┘            │
│                              │ HTTP (REST)                       │
└──────────────────────────────┼───────────────────────────────────┘
                               │
┌──────────────────────────────┼───────────────────────────────────┐
│                     FASTAPI BACKEND (:5001 / :8080)              │
│                              │                                   │
│   ┌──────────────────────────┼──────────────────────────┐        │
│   │              API Router (main.py)                   │        │
│   │  /api/ingest  /api/insights  /api/related           │        │
│   │  /api/library /api/podcast   /api/file              │        │
│   └───────┬──────────┬───────────┬──────────────────────┘        │
│           │          │           │                                │
│   ┌───────▼──┐  ┌────▼───┐  ┌───▼──────────┐                    │
│   │ indexer  │  │  llm_  │  │ services/    │                    │
│   │  .py     │  │ utils  │  │ tts.py       │                    │
│   │ (TF-IDF  │  │ .py    │  │ podcast_     │                    │
│   │ + cosine)│  │(Gemini)│  │ service.py   │                    │
│   └───────┬──┘  └────┬───┘  └───┬──────────┘                    │
│           │          │          │                                 │
│   ┌───────▼──┐  ┌────▼───┐  ┌───▼──────────┐                    │
│   │ data/    │  │ Google │  │ gTTS / GCP / │                    │
│   │ library/ │  │ Gemini │  │ Azure TTS    │                    │
│   │ + .pkl   │  │  API   │  │              │                    │
│   └──────────┘  └────────┘  └──────────────┘                    │
└──────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Upload** → PDF saved to `backend/data/library/` → background indexing creates TF-IDF vectors → stored in `tfidf_index.pkl`
2. **View** → Adobe Embed SDK renders the PDF → page change triggers auto-insights via Gemini
3. **Select text** → Frontend captures selection → searches TF-IDF index for related chunks across all PDFs → displays ranked results
4. **Insights** → Page text sent to Gemini → structured JSON response with 5 insight categories
5. **Podcast** → Gemini generates conversational script → TTS provider converts to MP3 → streamed to browser audio player

---

## 📁 Project Structure

```
Adobe-Round3/
├── Dockerfile                     # Multi-stage: Node (build) + Python+Nginx (runtime)
├── README.md                      # This file
├── .gitignore                     # Protects .env, node_modules, __pycache__, etc.
│
├── backend/
│   ├── .env.example               # Template for backend environment variables
│   ├── .gitignore                 # Backend-specific exclusions
│   ├── requirements.txt           # Python dependencies (55 packages)
│   ├── main.py                    # FastAPI app — all REST endpoints
│   ├── indexer.py                 # TF-IDF indexing, cosine search, chunk management
│   ├── llm_utils.py               # Gemini API integration (insights, podcast scripts)
│   ├── services/
│   │   ├── __init__.py
│   │   ├── tts.py                 # TTS providers: gTTS, GCP Cloud TTS, Azure TTS
│   │   └── podcast_service.py     # Podcast orchestration (script → TTS → MP3)
│   ├── data/
│   │   ├── library/               # Uploaded PDFs stored here
│   │   └── tfidf_index.pkl        # Serialized TF-IDF search index
│   └── static/                    # Generated podcast MP3 files
│
├── frontend/
│   ├── .env.example               # Template for frontend environment variables
│   ├── index.html                 # Entry point — loads Adobe Embed SDK
│   ├── vite.config.js             # Vite dev server configuration
│   ├── package.json               # Node dependencies
│   ├── public/
│   │   └── acrolens.svg           # Custom favicon
│   └── src/
│       ├── main.jsx               # React entry point
│       ├── App.jsx                # Main app — state management, API orchestration
│       ├── App.css                # Global styles (dark theme, glassmorphism)
│       ├── index.css              # Tailwind v4 base import
│       ├── Landing.jsx            # Landing page (hero section)
│       ├── components/
│       │   ├── PdfViewer.jsx      # Adobe Embed SDK wrapper (selection, navigation)
│       │   ├── InsightsBulb.jsx   # Renders 5-category Gemini insights
│       │   ├── RelatedPanel.jsx   # Cross-document related sections with active highlight
│       │   ├── PodcastBar.jsx     # Podcast generation trigger + audio player
│       │   ├── UploadPanel.jsx    # Drag-and-drop PDF upload
│       │   ├── LibraryPanel.jsx   # Document library listing
│       │   └── SelectionPreview.jsx # Text selection preview
│       └── utils/
│           └── api.js             # Shared API helper functions
```

---

## 🚀 Quick Start

### Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| **Python** | 3.11+ | Backend runtime |
| **Node.js** | 20+ | Frontend build toolchain |
| **Docker** | 24+ | Production deployment |

### Local Development

**1. Clone the repository**

```bash
git clone https://github.com/abhinavrathee/Adobe-Round3.git
cd Adobe-Round3
```

**2. Set up the backend**

```bash
cd backend

# Create your .env from the template
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY (get from https://aistudio.google.com/apikey)

# Install Python dependencies
pip install -r requirements.txt

# Start the backend server
python -m uvicorn main:app --host 0.0.0.0 --port 5001 --reload
```

**3. Set up the frontend** (in a new terminal)

```bash
cd frontend

# Create your .env from the template
cp .env.example .env
# Edit .env and add your VITE_ADOBE_EMBED_KEY

# Install Node dependencies
npm install

# Start the dev server
npm run dev
```

**4. Open** → [http://localhost:5173](http://localhost:5173)

---

### 🐳 Docker Deployment

This is how Adobe will evaluate the project. A single Docker container runs both frontend (Nginx) and backend (Uvicorn) on port **8080**.

**1. Build the image**

```bash
docker build --platform linux/amd64 -t acrolens .
```

**2. Run the container**

```bash
docker run \
  -v /path/to/credentials:/credentials \
  -e ADOBE_EMBED_API_KEY=<YOUR_ADOBE_EMBED_API_KEY> \
  -e LLM_PROVIDER=gemini \
  -e GOOGLE_APPLICATION_CREDENTIALS=/credentials/adbe-gcp.json \
  -e GEMINI_MODEL=gemini-2.5-flash \
  -e TTS_PROVIDER=azure \
  -e AZURE_TTS_KEY=<TTS_KEY> \
  -e AZURE_TTS_ENDPOINT=<TTS_ENDPOINT> \
  -p 8080:8080 \
  acrolens
```

**3. Open** → [http://localhost:8080](http://localhost:8080)

#### Docker Architecture

```
Container (:8080)
├── Nginx (reverse proxy)
│   ├── /              → serves built React SPA (static files)
│   ├── /api/*         → proxies to Uvicorn backend (:8000)
│   ├── /config.js     → runtime config (API keys from env vars)
│   └── /static/*      → serves generated podcast MP3s
└── Uvicorn (FastAPI backend on :8000)
    ├── PDF ingestion & library management
    ├── TF-IDF indexing & semantic search
    ├── Gemini API calls (insights, podcast scripts)
    └── TTS audio generation
```

---

## 🔐 Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GEMINI_API_KEY` | Yes* | — | Google AI Studio API key for Gemini |
| `GOOGLE_API_KEY` | Yes* | — | Alternative key name (same as above) |
| `GOOGLE_APPLICATION_CREDENTIALS` | Yes* | — | Path to GCP service account JSON (Docker eval) |
| `GEMINI_MODEL` | No | `gemini-2.5-flash` | Gemini model to use |
| `TTS_PROVIDER` | No | `local` | TTS engine: `local` \| `gcp` \| `azure` |
| `GCP_TTS_VOICE` | No | `en-US-Neural2-F` | GCP Cloud TTS voice name |
| `GCP_TTS_LANGUAGE` | No | `en-US` | GCP TTS language code |
| `GCP_TTS_RATE` | No | `1.08` | GCP TTS speaking rate |
| `AZURE_TTS_KEY` | No** | — | Azure OpenAI TTS API key |
| `AZURE_TTS_ENDPOINT` | No** | — | Azure TTS endpoint URL |
| `TTS_CLOUD_MAX_CHARS` | No | `3000` | Max chars per TTS chunk (for chunked synthesis) |
| `TTS_TARGET_WORDS` | No | `700` | Target word count for podcast scripts |

> \* At least one of `GEMINI_API_KEY`, `GOOGLE_API_KEY`, or `GOOGLE_APPLICATION_CREDENTIALS` must be set.  
> \*\* Required only if `TTS_PROVIDER=azure`.

### Frontend (`frontend/.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_ADOBE_EMBED_KEY` | Yes | — | Adobe PDF Embed API key |
| `VITE_API_BASE` | No | `http://localhost:5001` | Backend API URL |

### Docker Runtime (`-e` flags)

In Docker mode, the backend serves a `/config.js` endpoint that injects `ADOBE_EMBED_API_KEY` into the frontend at runtime — no need for frontend `.env` in Docker.

---

## 📡 API Reference

All endpoints are prefixed with `/api` and served on port `5001` (local) or `8080` (Docker via Nginx proxy).

### Health & Configuration

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Returns `{ "status": "ok" }` |
| `GET` | `/config.js` | Runtime config (API keys from env vars for Docker) |

### Document Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/library` | List all uploaded PDFs with file sizes |
| `POST` | `/api/ingest` | Upload one or more PDFs (multipart/form-data) |
| `POST` | `/api/upload` | Alias for `/api/ingest` |
| `GET` | `/api/file/{filename}` | Serve a specific PDF file |

### AI Insights

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| `POST` | `/api/insights` | `{ selection_text, doc_id? }` | Generate insights for selected text |
| `POST` | `/api/auto/insights` | `{ file, page, text? }` | Auto-generate insights for a page or selection |

**Response format:**
```json
{
  "file": "paper.pdf",
  "page": 1,
  "insights": {
    "keyInsights": ["..."],
    "facts": ["..."],
    "contradictions": ["..."],
    "connections": ["..."],
    "questions": ["..."]
  }
}
```

### Semantic Search & Related Sections

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| `POST` | `/api/related` | `{ selection_text, doc_name?, page?, k?, min_score? }` | Find related chunks by text selection |
| `POST` | `/api/auto/related` | `{ file, page }` | Auto-find related sections for current page |

### Search Index

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/index/status` | Index stats: file count, chunk count, file list |
| `POST` | `/api/index/rebuild` | Force rebuild the TF-IDF search index |

### Podcast Generation

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| `POST` | `/api/podcast/generate` | `{ file, current_page?, insights?, related? }` | Generate podcast MP3 |

**Response:**
```json
{
  "script_preview": "Welcome to an overview of...",
  "url": "/static/podcast_abc123.mp3",
  "words": 408
}
```

---

## 🧭 User Journey

### Step 1 — Reading & Selection
1. User uploads PDFs or selects from the library
2. Adobe Embed SDK renders the document with full fidelity
3. User selects a portion of text (e.g., a scientific method, a business strategy)

### Step 2 — Instant Related Sections
4. The system **instantly surfaces related passages** from other PDFs in the library
5. Uses TF-IDF cosine similarity with a 4-tier cascade (strict → relaxed → page-based → keyword)
6. Results show the source PDF, page number, section title, and a text snippet
7. Clicking a result **navigates to that exact page** in the viewer

### Step 3 — AI Insight Generation
8. User clicks "Generate Insights" or the system auto-generates on page load
9. Gemini 2.5 Flash analyzes the page content and returns structured insights
10. Five categories: Key Insights, Did You Know?, Contradictions, Connections, Questions

### Step 4 — Rich Media Experience (Podcast)
11. User clicks the **🎧 Podcast** button
12. Gemini generates a natural, conversational script (~400 words)
13. TTS engine converts the script to an MP3 audio file
14. User listens directly in the browser with playback controls

---

## 🛠️ Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend Framework** | React 19 + Vite 7 | Fast SPA with HMR |
| **PDF Rendering** | Adobe PDF Embed API | Full-fidelity PDF viewer with text selection events |
| **Styling** | Vanilla CSS + CSS Variables | Dark theme, glassmorphism, micro-animations |
| **Backend Framework** | FastAPI (Python 3.11) | Async REST API with automatic OpenAPI docs |
| **LLM** | Google Gemini 2.5 Flash | Insights generation, podcast script writing |
| **Search Engine** | TF-IDF + Cosine Similarity | Fast cross-document semantic matching |
| **Text-to-Speech** | gTTS / GCP Cloud TTS / Azure TTS | Multi-provider audio synthesis |
| **Audio Processing** | pydub + ffmpeg | Audio merging for multi-voice podcasts |
| **Deployment** | Docker (multi-stage) + Nginx | Single container with reverse proxy |

---

## 💡 Design Decisions

### Why TF-IDF instead of vector embeddings?
- **Zero external dependencies** — no embedding API calls needed for search
- **Sub-100ms latency** — TF-IDF search is nearly instant even with hundreds of chunks
- **Fully offline** — search works without any API key or network connection
- **Sufficient quality** — for document-level matching within a personal library, TF-IDF with cosine similarity provides excellent results

### Why multiple TTS providers?
- **Local (gTTS)** — works everywhere, no API key needed, good for development
- **GCP Cloud TTS** — high-quality Neural2 voices for production deployments
- **Azure OpenAI TTS** — required for Adobe evaluation environment
- The system gracefully falls back: `Azure → GCP → gTTS → espeak-ng`

### Why single Docker container?
- Adobe's evaluation requirement: one `docker run` command
- Nginx serves the built frontend and proxies `/api/*` to Uvicorn
- Runtime environment variables injected via `/config.js` endpoint
- No docker-compose complexity — just one container

### Why grounded-only insights?
- Adobe's problem statement explicitly requires: *"without introducing unrelated or ungrounded external knowledge"*
- All insights, summaries, and podcast scripts are derived exclusively from the user's uploaded documents
- This builds trust and ensures accuracy for professional use cases

---

## 👥 Team

Built by team for the **Adobe India Hackathon 2025 — Round 3 (Finale)**.

---

<p align="center">
  <sub>Made with ❤️ for Adobe Hackathon 2025</sub>
</p>
