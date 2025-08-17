from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Optional
from urllib.parse import unquote
from pathlib import Path
import shutil
import time

from indexer import LIB_DIR, build_index, ensure_index, search  # NEW

APP_ROOT = Path(__file__).parent

app = FastAPI(title="Doc Insight Backend")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Health ---
@app.get("/api/health")
def health():
    return {"ok": True, "ts": time.time()}

# --- Library listing ---
@app.get("/api/library")
def list_library():
    items = []
    for p in LIB_DIR.glob("*.pdf"):
        items.append({"name": p.name, "size": p.stat().st_size})
    return {"count": len(items), "items": items}

# --- Ingest (bulk upload) ---
@app.post("/api/ingest")
async def ingest(files: List[UploadFile] = File(...)):
    saved = []
    for f in files:
        out = LIB_DIR / f.filename
        with out.open("wb") as w:
            shutil.copyfileobj(f.file, w)
        saved.append(f.filename)
    # rebuild index after new files
    build_index()
    return {"saved": saved, "count": len(saved)}

# --- Serve a PDF from the library ---
@app.get("/api/file/{filename}")
def get_file(filename: str):
    safe_name = unquote(filename)
    path = LIB_DIR / safe_name
    if not path.exists() or path.suffix.lower() != ".pdf":
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path, media_type="application/pdf", filename=safe_name)

# --- Related (REAL: TF-IDF search over pages) ---
class RelatedRequest(BaseModel):
    selection_text: str
    doc_name: Optional[str] = None
    page: Optional[int] = None

@app.post("/api/related")
def related(req: RelatedRequest):
    text = (req.selection_text or "").strip()
    if not text:
        return {"selection_text": req.selection_text, "results": []}
    results = search(text, top_k=5)
    return {"selection_text": req.selection_text, "results": results}

# --- Optional: manual reindex ---
@app.post("/api/reindex")
def reindex():
    idx = build_index()
    return {"ok": True, "chunks": len(idx.chunks)}
