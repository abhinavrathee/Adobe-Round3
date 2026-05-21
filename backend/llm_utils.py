# backend/llm_utils.py
import os, json, re
from pathlib import Path
from dotenv import load_dotenv

# Always load the .env next to this file
load_dotenv(dotenv_path=Path(__file__).parent / ".env")

import google.generativeai as genai

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

def _cfg():
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY not set in backend/.env")
    genai.configure(api_key=GEMINI_API_KEY)
    return genai

# ---------- Prompts (Insights) ----------

JSON_PROMPT = """You analyze a PDF page and return concise, grounded bullets.
Use ONLY the provided page text. Do not invent sources.

Return a compact JSON with EXACTLY these keys:

{
  "keyInsights": ["bullet", ... 2-6 items],
  "facts": ["bullet", ... 2-6 items],
  "contradictions": ["bullet", ... 0-4 items],
  "connections": ["bullet", ... 0-4 items],
  "questions": ["question", ... 2-6 items]   // inquisitive, answerable from the page; 'why/how/what' style
}

Rules:
- Each bullet ≤ 20 words.
- Each question ≤ 18 words; end with a question mark.
- No asterisks, dashes, or numbering at the start.
- No markdown. Only plain text strings in the arrays.

Page text:
\"\"\"{selection}\"\"\""""

FALLBACK_PROMPT = """You analyze a PDF page and produce concise bullets under five headings:
Key insights, Did you know?, Contradictions / counterpoints, Connections, Questions.

- Keep bullets short (≤20 words).
- Questions are inquisitive, answerable from the page, ≤18 words, end with '?'.
- Plain text only (no leading symbols/numbers).

Page text:
\"\"\"{selection}\"\"\""""

# ---------- Utilities ----------

def _clean_and_clip(items, max_words=20, max_len=220, ensure_qmark=False):
    out = []
    for it in items or []:
        if not isinstance(it, str):
            continue
        s = re.sub(r"^[\-\*\u2022\•\d\.\s]+", "", it).strip()
        words = s.split()
        if len(words) > max_words:
            s = " ".join(words[:max_words]) + "…"
        if len(s) > max_len:
            s = s[:max_len-1] + "…"
        if ensure_qmark and s and not s.endswith("?"):
            s = s.rstrip(".") + "?"
        if s:
            out.append(s)
    # de-dup
    seen, uniq = set(), []
    for s in out:
        if s not in seen:
            uniq.append(s); seen.add(s)
    return uniq[:6]

def _parse_freeform(text: str) -> dict:
    groups = {"keyInsights": [], "facts": [], "contradictions": [], "connections": [], "questions": []}
    if not text.strip():
        return groups
    current = None
    for line in text.splitlines():
        l = line.strip()
        if not l:
            continue
        low = l.lower()
        if "key insight" in low:
            current = "keyInsights"; continue
        if "did you know" in low:
            current = "facts"; continue
        if "contradiction" in low or "counterpoint" in low:
            current = "contradictions"; continue
        if "connection" in low:
            current = "connections"; continue
        if "question" in low and ("?" not in l):  # heading line like "Questions"
            current = "questions"; continue
        if current:
            groups[current].append(l)
    groups["keyInsights"]    = _clean_and_clip(groups["keyInsights"])
    groups["facts"]          = _clean_and_clip(groups["facts"])
    groups["contradictions"] = _clean_and_clip(groups["contradictions"])
    groups["connections"]    = _clean_and_clip(groups["connections"])
    groups["questions"]      = _clean_and_clip(groups["questions"], max_words=18, ensure_qmark=True)
    return groups

def _minimal_from_text(selection: str) -> dict:
    # Synthesize some bullets and questions if model returns little
    s = re.sub(r"\s+", " ", selection or "").strip()
    sentences = re.split(r"(?<=[\.!?])\s+", s)
    core = [p for p in sentences if 20 <= len(p) <= 220][:4] or sentences[:4]

    # naive topic terms
    words = [w for w in re.findall(r"[A-Za-z][A-Za-z0-9\-]{2,}", s) if w.lower() not in {
        "the","and","for","with","from","this","that","have","has","are","was","were",
        "into","over","under","into","their","your","users","use","using"
    }]
    key = " ".join(words[:6]) if words else "this page"
    questions = [
        f"What is the main goal of {key}?",
        f"How does the approach on this page improve results?",
        f"Why are these constraints or trade-offs important?",
    ]
    return {
        "keyInsights": _clean_and_clip(core or [s][:1]),
        "facts": [],
        "contradictions": [],
        "connections": [],
        "questions": _clean_and_clip(questions, max_words=18, ensure_qmark=True),
    }

# ---------- Main entry (Insights) ----------

def gemini_insights(selection: str) -> dict:
    if not selection:
        return {"error": "empty_selection"}

    _cfg()
    model = genai.GenerativeModel(GEMINI_MODEL)

    # 1) Try strict JSON first
    try:
        resp = model.generate_content(
            JSON_PROMPT.format(selection=selection),
            generation_config={"response_mime_type": "application/json"},
        )
        raw = (getattr(resp, "text", "") or "").strip()
        data = json.loads(raw)
        result = {
            "keyInsights":    _clean_and_clip(data.get("keyInsights")),
            "facts":          _clean_and_clip(data.get("facts")),
            "contradictions": _clean_and_clip(data.get("contradictions")),
            "connections":    _clean_and_clip(data.get("connections")),
            "questions":      _clean_and_clip(data.get("questions"), max_words=18, ensure_qmark=True),
        }
        if any(result.values()):
            return result
    except Exception:
        pass

    # 2) Fallback: free-form then parse
    try:
        resp2 = model.generate_content(FALLBACK_PROMPT.format(selection=selection))
        text = (getattr(resp2, "text", "") or "").strip()
        parsed = _parse_freeform(text)
        if any(parsed.values()):
            return parsed
    except Exception as e:
        return {"error": f"gemini_error: {type(e).__name__}: {e}"}

    # 3) Last resort
    return _minimal_from_text(selection)

# =======================================================================
# NEW: Podcast overview generator (single voice, 2–5 minutes target)
# =======================================================================

PODCAST_PROMPT = """You are a friendly narrator. Create a SPOKEN OVERVIEW of a PDF for a listener.
Goal: in about {target_words} words (roughly 2–5 minutes), explain WHAT this PDF is about,
what it covers, and the most important ideas. Use only the provided material.

STYLE RULES (important):
- Do NOT mention page numbers, tables, or figure labels.
- Do NOT read raw lists or serial numbers. Prefer natural sentences.
- Be concise, engaging, and scannable by ear—short sentences are good.
- Keep a neutral, informative tone. No markdown, no headings, no bullets.
- Use names/terms from the doc only when helpful; avoid filler.
- Structure like: quick hook → what the document covers → 3–6 core ideas/themes →
  notable contrasts or cautions → quick closing with who benefits / next step.

DOCUMENT EXCERPTS:
\"\"\"{doc_text}\"\"\"

OPTIONAL INSIGHTS (bullets from the app):
{insights_text}

OPTIONAL RELATED EXCERPTS:
{related_text}

Now produce a single-paragraph narration (multiple sentences), around {target_words} words, plain text only.
"""

def _clip(s: str, limit: int) -> str:
    s = (s or "").strip()
    if len(s) <= limit:
        return s
    return s[:limit]

def gemini_podcast_overview(doc_text: str,
                            insights: list[str] | None = None,
                            related: list[str] | None = None,
                            target_words: int = 450) -> str:
    """
    Returns a natural-sounding narration (no lists, no page refs),
    ~target_words long (2–5 min).
    """
    _cfg()
    model = genai.GenerativeModel(GEMINI_MODEL)

    insights_text = ""
    if insights:
        insights_text = "\n".join(f"- {re.sub(r'\s+', ' ', x).strip()}" for x in insights[:8])

    related_text = ""
    if related:
        related_text = "\n".join(re.sub(r"\s+", " ", x).strip() for x in related[:6])

    prompt = PODCAST_PROMPT.format(
        target_words=max(320, min(700, int(target_words or 450))),
        doc_text=_clip(doc_text, 7000),
        insights_text=_clip(insights_text, 1500),
        related_text=_clip(related_text, 2000),
    )

    try:
        resp = model.generate_content(prompt)
        text = (getattr(resp, "text", "") or "").strip()
        # Safety: remove stray bullets/markdown and squeeze spaces
        text = re.sub(r"^[\-\*\d\.\)\s]+", "", text)
        text = re.sub(r"\s+", " ", text).strip()
        return text
    except Exception as e:
        # Fallback: if model fails, at least compress the text naively
        base = re.sub(r"\s+", " ", (doc_text or ""))[:2000]
        return f"This document provides an overview based on selected sections. Key ideas include: {base}"
