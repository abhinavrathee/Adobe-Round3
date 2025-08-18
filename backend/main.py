from __future__ import annotations

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Optional, Set
from urllib.parse import unquote
from pathlib import Path
import shutil
import time
import threading
import re

from indexer import (
    LIB_DIR,
    search,
    get_page_text,
    ensure_index,
    mark_need_reindex,
    build_index,
    get_doc_pages,  # must exist in indexer.py
)
from llm_utils import gemini_insights, gemini_podcast_overview
from services.podcast_service import synthesize_podcast  # your TTS wrapper

APP_ROOT = Path(__file__).parent
STATIC_DIR = APP_ROOT / "static"
STATIC_DIR.mkdir(exist_ok=True)

app = FastAPI(title="Doc Insight Backend")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- Warm index on startup (non-blocking) ----------
def _warm():
    try:
        ensure_index(eager=True)
    except Exception as e:
        print("[startup] index warm failed:", e)

threading.Thread(target=_warm, daemon=True).start()

# ---------------- Health ----------------
@app.get("/api/health")
def health():
    return {"ok": True, "ts": time.time()}

# ---------------- Static (audio) ----------------
@app.get("/static/{filename}")
def get_static(filename: str):
    path = STATIC_DIR / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    # We generate mp3; keep a light fallback for wav/ogg if you add later
    mt = "audio/mpeg" if path.suffix.lower() == ".mp3" else "application/octet-stream"
    return FileResponse(path, media_type=mt)

# ---------------- Library ----------------
@app.get("/api/library")
def list_library():
    LIB_DIR.mkdir(parents=True, exist_ok=True)
    items = [{"name": p.name, "size": p.stat().st_size} for p in LIB_DIR.glob("*.pdf")]
    return {"count": len(items), "items": items}

# ---------------- Uploads ----------------
@app.post("/api/ingest")
async def ingest(files: List[UploadFile] = File(...)):
    LIB_DIR.mkdir(parents=True, exist_ok=True)
    saved = []
    for f in files:
        if not f.filename.lower().endswith(".pdf"):
            continue
        out = LIB_DIR / f.filename
        with out.open("wb") as w:
            shutil.copyfileobj(f.file, w)
        saved.append(f.filename)
    # Trigger rebuild (async)
    mark_need_reindex()
    threading.Thread(target=build_index, daemon=True).start()
    print("[ingest] saved:", saved)
    return {"saved": saved, "count": len(saved)}

@app.post("/api/upload")
async def upload(file: UploadFile = File(...)):
    LIB_DIR.mkdir(parents=True, exist_ok=True)
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files allowed")
    out = LIB_DIR / file.filename
    with out.open("wb") as w:
        shutil.copyfileobj(file.file, w)
    mark_need_reindex()
    threading.Thread(target=build_index, daemon=True).start()
    print("[upload] saved:", file.filename)
    return {"saved": [file.filename], "count": 1}

# --------------- Serve PDF ---------------
@app.get("/api/file/{filename}")
def get_file(filename: str):
    safe = unquote(filename)
    path = LIB_DIR / safe
    if not path.exists() or path.suffix.lower() != ".pdf":
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(
        path,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="{safe}"',
            "Cache-Control": "no-store",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Expose-Headers": "Accept-Ranges, Content-Encoding, Content-Length, Content-Range",
            "Cross-Origin-Resource-Policy": "cross-origin",
        },
    )

# ------------- Related (selection) ----------
class RelatedReq(BaseModel):
    selection_text: Optional[str] = None
    selected_text: Optional[str] = None
    doc_name: Optional[str] = None
    page: Optional[int] = None
    k: Optional[int] = 5

@app.post("/api/related")
def related(req: RelatedReq):
    text = (req.selection_text or req.selected_text or "").strip()
    if not text:
        return {"selection_text": req.selection_text, "results": []}
    res = search(text, top_k=max(1, min(20, req.k or 5)))
    print(f"[related] len={len(res)}")
    return {"selection_text": text, "results": res}

# ------------- Insights (selection -> bullets) -------
class InsightsReq(BaseModel):
    selection_text: str

@app.post("/api/insights")
def insights(req: InsightsReq):
    text = (req.selection_text or "").strip()
    if not text:
        return {"insights": None}
    try:
        ideas = gemini_insights(text)
    except Exception as e:
        print("[insights] error", e)
        ideas = {"keyInsights": [], "facts": [], "contradictions": [], "connections": [], "questions": []}
    print("[insights] ok")
    return {"insights": ideas}

# -------- Auto insights: by page OR by selection text --------
class InsightAutoReq(BaseModel):
    file: str
    page: int = 1
    text: Optional[str] = None  # if present, analyze this text instead of page

@app.post("/api/auto/insights")
def auto_insights(req: InsightAutoReq):
    if req.text and req.text.strip():
        content = req.text.strip()
        print(f"[auto_insights] selection text len={len(content)}")
    else:
        content = get_page_text(req.file, int(req.page)) or ""
        print(f"[auto_insights] file={req.file} page={req.page} chars={len(content)}")

    if not content.strip():
        return {"file": req.file, "page": req.page, "insights": None}
    try:
        return {"file": req.file, "page": req.page, "insights": gemini_insights(content)}
    except Exception as e:
        print("[auto_insights] error", e)
        return {"file": req.file, "page": req.page, "insights": None}

# -------- Auto related --------
class PageReq(BaseModel):
    file: str
    page: int

@app.post("/api/auto/related")
def auto_related(req: PageReq):
    page_text = get_page_text(req.file, int(req.page)) or ""
    print(f"[auto_related] file={req.file} page={req.page} chars={len(page_text)}")
    if not page_text.strip():
        return {"file": req.file, "page": req.page, "results": []}
    return {"file": req.file, "page": req.page, "results": search(page_text, top_k=5)}

# ---------- Index status / rebuild ----------
@app.get("/api/index/status")
def index_status():
    idx = ensure_index()
    files: Set[str] = set(c.pdf_name for c in (idx.chunks or []))
    return {"files": sorted(files), "chunk_count": len(idx.chunks) if idx and idx.chunks else 0}

@app.post("/api/index/rebuild")
def index_rebuild():
    try:
        build_index()
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)}

# ================== PODCAST MODE ==================
class RelatedChunk(BaseModel):
    title: Optional[str] = None
    page: Optional[int] = None
    text: str

class PodcastReq(BaseModel):
    file: str
    current_page: Optional[int] = None
    current_section_title: Optional[str] = None
    current_section_text: Optional[str] = None
    related: List[RelatedChunk] = []
    insights: List[str] = []
    # TTS options (we will force single-voice for clarity and speed)
    tts_provider: Optional[str] = None   # "local" | "gcp" | "azure"
    voice: Optional[str] = None          # single-voice mode
    speakers: Optional[int] = 1          # ignored; we force 1
    voices: Optional[List[str]] = None   # ignored
    rate: Optional[int] = 150            # local/espeak speed
    volume: Optional[float] = 1.0
    target_words: Optional[int] = 450    # ~2–5 min: 320–700 words

def _clean_text(t: str) -> str:
    return re.sub(r"\s+", " ", (t or "").strip())

def _sample_doc_context(pdf_name: str, current_page: Optional[int] = None, max_chars: int = 7000) -> str:
    """
    Take representative slices from across the document (first/last/current±1 and midpoints)
    to give the LLM enough signal without sending the whole file. Keeps under max_chars.
    """
    chunks = get_doc_pages(pdf_name) or []
    pages_all: list[tuple[int, str]] = [
        (c.page, _clean_text(c.text or "")) for c in chunks if (c.text or "").strip()
    ]
    pages_all.sort(key=lambda x: x[0])

    if not pages_all:
        return ""

    picks: list[tuple[int, str]] = []

    # first + last
    picks.append(pages_all[0])
    if len(pages_all) > 1:
        picks.append(pages_all[-1])

    # current page neighborhood
    if current_page:
        for pr in [p for p in pages_all if abs(p[0] - int(current_page)) <= 1]:
            if pr not in picks:
                picks.append(pr)

    # mid/quarter points
    for frac in (0.25, 0.50, 0.75):
        idx = int(frac * (len(pages_all) - 1))
        cand = pages_all[max(0, min(idx, len(pages_all) - 1))]
        if cand not in picks:
            picks.append(cand)

    # join & clip
    text = "\n\n".join(t for _, t in picks)
    if len(text) > max_chars:
        text = text[:max_chars]
    return text

def _build_podcast_script(req: PodcastReq) -> str:
    """
    Build a true spoken overview using Gemini — not a verbatim reading.
    Keeps length around 2–5 minutes (default ~450 words).
    """
    context = _sample_doc_context(req.file, req.current_page, max_chars=7000)

    # Include up to a handful of related snippets; they are optional
    related_bits = [(_clean_text(ch.text)) for ch in (req.related or [])][:6]

    # Use insights bullets (can be from entire pdf in your UI); optional
    insights_bits = req.insights or []

    target = max(320, min(700, int(req.target_words or 450)))

    script = gemini_podcast_overview(
        doc_text=context,
        insights=insights_bits,
        related=related_bits,
        target_words=target,
    )
    return script.strip()

@app.post("/api/podcast/generate")
def podcast_generate(req: PodcastReq):
    """
    Compose a concise narration and synthesize with single voice for clarity.
    """
    script = _build_podcast_script(req)

    if not script or len(script.split()) < 60:
        raise HTTPException(status_code=500, detail="Could not build podcast script.")

    # Force single voice to avoid merge overhead / errors
    try:
        name = synthesize_podcast(
            script_text=script,
            voice=req.voice,
            provider=req.tts_provider,
            rate=req.rate,
            volume=req.volume,
            speakers=1,          # ← force single-voice
            voices=None,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {
        "script_preview": " ".join(script.split()[:60]) + ("…" if len(script.split()) > 60 else ""),
        "url": f"/static/{name}",
        "words": len(script.split()),
    }
