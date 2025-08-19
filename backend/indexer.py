from __future__ import annotations
from dataclasses import dataclass
from pathlib import Path
from typing import List, Tuple, Dict, Any
import re
import os
import pickle
import threading

from pypdf import PdfReader
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from rapidfuzz import fuzz

APP_ROOT = Path(__file__).parent
LIB_DIR = APP_ROOT / "data" / "library"
IDX_PATH = APP_ROOT / "data" / "tfidf_index.pkl"

SENT_SPLIT = re.compile(r"(?<=[\.!?])\s+")

@dataclass
class Chunk:
    pdf_name: str
    page: int       # 1-based
    text: str

@dataclass
class Index:
    vectorizer: TfidfVectorizer
    matrix: Any
    chunks: List[Chunk]

_build_lock = threading.Lock()
_need_reindex = False

def mark_need_reindex():
    global _need_reindex
    _need_reindex = True

def _extract_pdf_text_per_page(pdf_path: Path) -> List[str]:
    pages = []
    try:
        reader = PdfReader(str(pdf_path))
        for page in reader.pages:
            try:
                t = page.extract_text() or ""
            except Exception:
                t = ""
            t = re.sub(r"\s+", " ", t).strip()
            pages.append(t)
    except Exception:
        pass
    return pages

def build_index() -> Index:
    print("[indexer] building index…")
    LIB_DIR.mkdir(parents=True, exist_ok=True)
    chunks: List[Chunk] = []
    for p in sorted(LIB_DIR.glob("*.pdf")):
        page_texts = _extract_pdf_text_per_page(p)
        for i, t in enumerate(page_texts, start=1):
            if t:
                chunks.append(Chunk(pdf_name=p.name, page=i, text=t))

    texts = [c.text for c in chunks] or [""]
    vectorizer = TfidfVectorizer(stop_words="english", max_features=50000, ngram_range=(1, 2))
    matrix = vectorizer.fit_transform(texts)
    idx = Index(vectorizer=vectorizer, matrix=matrix, chunks=chunks)
    IDX_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(IDX_PATH, "wb") as f:
        pickle.dump(idx, f)
    print(f"[indexer] done. chunks={len(chunks)}")
    return idx

def _load() -> Index | None:
    if IDX_PATH.exists():
        with open(IDX_PATH, "rb") as f:
            return pickle.load(f)
    return None

def ensure_index(eager: bool = False) -> Index:
    global _need_reindex
    with _build_lock:
        idx = _load()
        if idx is None or _need_reindex or eager:
            idx = build_index()
            _need_reindex = False
        return idx

def _best_snippet(page_text: str, query: str) -> str:
    """
    Return ~2–4 sentences most related to the query (<= ~400 chars).
    """
    sentences = SENT_SPLIT.split(page_text) if page_text else []
    if not sentences:
        return (page_text or "")[:360]
    scored = [(i, fuzz.partial_ratio(query, s)) for i, s in enumerate(sentences)]
    scored.sort(key=lambda x: x[1], reverse=True)
    picks = sorted([i for i, _ in scored[:3]])
    snippet = " ".join(sentences[i].strip() for i in picks).strip()
    if len(snippet) < 160 and len(scored) > 3:
        i = scored[3][0]
        if i not in picks:
            snippet = (snippet + " " + sentences[i].strip()).strip()
    return snippet[:400]

def search(query: str, top_k: int = 5, min_score: float = 0.0) -> List[Dict[str, Any]]:
    """
    Hybrid TF-IDF (cosine) + RapidFuzz re-rank with thresholding.
    min_score is on 0..1 for the final hybrid score.
    """
    idx = ensure_index()
    if not idx.chunks:
        print("[search] index has 0 chunks — nothing to match.")
        return []

    qv = idx.vectorizer.transform([query])
    cos_all = cosine_similarity(qv, idx.matrix)[0]

    # Pre-filter by cosine to keep fuzzy fast
    prelim = sorted(enumerate(cos_all), key=lambda x: x[1], reverse=True)[:60]

    W_COS = float(os.getenv("SEARCH_W_COS", "0.65"))
    W_FUZ = 1.0 - W_COS

    # ✅ FIX: honor caller's min_score (even 0.0). If env var is set, it overrides.
    if "SEARCH_MIN_SCORE" in os.environ:
        THRESH = float(os.getenv("SEARCH_MIN_SCORE", "0.58"))
    else:
        # clamp to [0,1]
        try:
            THRESH = max(0.0, min(1.0, float(min_score)))
        except Exception:
            THRESH = 0.58

    scored: List[Dict[str, Any]] = []
    for pos, cos in prelim:
        ch = idx.chunks[pos]
        f1 = fuzz.token_set_ratio(query, ch.text) / 100.0
        f2 = fuzz.partial_ratio(query, ch.text) / 100.0
        fuzzy = max(f1, f2)

        hybrid = W_COS * float(cos) + W_FUZ * float(fuzzy)
        if hybrid < THRESH:
            continue

        snip = _best_snippet(ch.text, query)
        scored.append({
            "pdf_name": ch.pdf_name,
            "page": ch.page,
            "score": round(float(hybrid), 4),
            "cosine": round(float(cos), 4),
            "fuzzy": round(float(fuzzy), 4),
            "snippet": snip,
            "section_title": f"Page {ch.page}",
        })

    scored.sort(key=lambda x: x["score"], reverse=True)
    out = scored[:max(1, min(20, top_k))]
    print(f"[search] query_len={len(query)} thresh={THRESH} hits={len(out)} (from {len(idx.chunks)} chunks)")
    return out

def get_page_text(pdf_name: str, page: int) -> str:
    idx = ensure_index()
    for ch in idx.chunks:
        if ch.pdf_name == pdf_name and ch.page == page:
            return ch.text or ""
    return ""

# ---------- fetch all pages of a given PDF ----------
def get_doc_pages(pdf_name: str) -> List[Chunk]:
    idx = ensure_index()
    return [c for c in idx.chunks if c.pdf_name == pdf_name]
