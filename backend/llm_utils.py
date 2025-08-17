from __future__ import annotations
import os, json
from typing import Dict, List
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
if not GEMINI_API_KEY:
    # we won't crash the server — insights endpoint will just return a friendly message
    pass
else:
    genai.configure(api_key=GEMINI_API_KEY)

PROMPT = """You analyze a PDF page and produce concise bullets as JSON:
Return EXACT keys: keyInsights (3-5), facts (2-4), contradictions (0-4), connections (0-4).
Rules: ≤20 words per bullet. No markdown/numbering. If none, use [].
Text:
\"\"\"{text}\"\"\""""

def gemini_insights(page_text: str) -> Dict[str, List[str]]:
    if not GEMINI_API_KEY:
        return {
            "keyInsights": ["GEMINI_API_KEY not set on server."],
            "facts": [],
            "contradictions": [],
            "connections": [],
        }
    model = genai.GenerativeModel(GEMINI_MODEL)
    resp = model.generate_content(PROMPT.format(text=page_text[:4000]))
    txt = (resp.text or "").strip()
    try:
        data = json.loads(txt)
        return {
            "keyInsights": list(map(str, data.get("keyInsights", []))),
            "facts": list(map(str, data.get("facts", []))),
            "contradictions": list(map(str, data.get("contradictions", []))),
            "connections": list(map(str, data.get("connections", []))),
        }
    except Exception:
        # fallback: put raw text as a single insight
        return {
            "keyInsights": [txt] if txt else [],
            "facts": [],
            "contradictions": [],
            "connections": [],
        }
