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

# ---------- Prompts ----------

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

# ---------- Main entry ----------

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
