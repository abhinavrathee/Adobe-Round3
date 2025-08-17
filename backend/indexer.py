from __future__ import annotations
from dataclasses import dataclass
from pathlib import Path
from typing import List, Tuple, Dict, Any
import re
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
    sentences = SENT_SPLIT.split(page_text) if page_text else []
    if not sentences:
        return page_text[:260]
    scores: List[Tuple[int, float]] = []
    for i, s in enumerate(sentences):
        sc = fuzz.partial_ratio(query, s)
        scores.append((i, sc))
    scores.sort(key=lambda x: x[1], reverse=True)
    best_idxs = sorted([i for i, _ in scores[:3]])
    snippet = " ".join(sentences[i] for i in best_idxs)
    return (snippet or page_text)[:400]

def search(query: str, top_k: int = 5) -> List[Dict[str, Any]]:
    idx = ensure_index()
    if not idx.chunks:
        return []
    qv = idx.vectorizer.transform([query])
    sims = cosine_similarity(qv, idx.matrix)[0]
    ranked = sorted(enumerate(sims), key=lambda x: x[1], reverse=True)[:top_k]
    results = []
    for pos, score in ranked:
        ch = idx.chunks[pos]
        snip = _best_snippet(ch.text, query)
        results.append({
            "pdf_name": ch.pdf_name,
            "page": ch.page,
            "score": float(score),
            "snippet": snip,
            "section_title": f"Page {ch.page}",
        })
    return results

def get_page_text(pdf_name: str, page: int) -> str:
    idx = ensure_index()
    for ch in idx.chunks:
        if ch.pdf_name == pdf_name and ch.page == page:
            return ch.text or ""
    return ""
