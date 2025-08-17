from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Optional
from urllib.parse import unquote
from pathlib import Path
import shutil, time, threading

from indexer import LIB_DIR, search, get_page_text, ensure_index, mark_need_reindex, build_index
from llm_utils import gemini_insights

APP_ROOT = Path(__file__).parent
app = FastAPI(title="Doc Insight Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Build index at startup (non-blocking)
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

# ---------------- Library ----------------
@app.get("/api/library")
def list_library():
    LIB_DIR.mkdir(parents=True, exist_ok=True)
    items = [{"name": p.name, "size": p.stat().st_size} for p in LIB_DIR.glob("*.pdf")]
    return {"count": len(items), "items": items}

# ---------------- Upload (fast) ----------
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
    # Flag for rebuild and kick off in background
    mark_need_reindex()
    threading.Thread(target=build_index, daemon=True).start()
    print("[ingest] saved:", saved)
    return {"saved": saved, "count": len(saved)}

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

# ------------- Manual selection ----------
class RelatedReq(BaseModel):
    selection_text: str
    doc_name: Optional[str] = None
    page: Optional[int] = None

@app.post("/api/related")
def related(req: RelatedReq):
    text = (req.selection_text or "").strip()
    if not text:
        return {"selection_text": req.selection_text, "results": []}
    res = search(text, top_k=5)
    print(f"[related] len={len(res)}")
    return {"selection_text": req.selection_text, "results": res}

class InsightsReq(BaseModel):
    selection_text: str

@app.post("/api/insights")
def insights(req: InsightsReq):
    text = (req.selection_text or "").strip()
    if not text:
        return {"insights": None}
    ideas = gemini_insights(text)
    print("[insights] ok")
    return {"insights": ideas}

# -------- Auto by file+page (no selection) --------
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

@app.post("/api/auto/insights")
def auto_insights(req: PageReq):
    page_text = get_page_text(req.file, int(req.page)) or ""
    print(f"[auto_insights] file={req.file} page={req.page} chars={len(page_text)}")
    if not page_text.strip():
        return {"file": req.file, "page": req.page, "insights": None}
    return {"file": req.file, "page": req.page, "insights": gemini_insights(page_text)}
