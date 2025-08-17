from __future__ import annotations
import os, json, re
from typing import Dict, List
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

# Updated prompt: contradictions now explicitly allow plausible counterpoints/angles to consider.
PROMPT = """You are an expert document analyst.
Return STRICT JSON with these exact keys:
- keyInsights: 5-8 bullets
- facts: 3-6 bullets
- contradictions: 2-4 bullets (mix any explicit contradictions in the text AND plausible counterpoints/assumptions/risks to consider; if none explicit, write 2–4 'Counterpoint:' bullets grounded in the topic)
- connections: 0-4 bullets
- questions: 3-5 bullets

Rules for ALL bullets:
- Be concise (≤18 words per bullet).
- No markdown, numbering, or quotes.
- Ground items in the provided text/topic; counterpoints can be reasonable inferences.
- If a bucket has nothing valid, use [].

Text:
\"\"\"{text}\"\"\""""

def _empty_payload() -> Dict[str, List[str]]:
    return {
        "keyInsights": [],
        "facts": [],
        "contradictions": [],
        "connections": [],
        "questions": [],
    }

def gemini_insights(page_text: str) -> Dict[str, List[str]]:
    if not GEMINI_API_KEY:
        payload = _empty_payload()
        payload["keyInsights"] = ["GEMINI_API_KEY not set on server."]
        return payload

    model = genai.GenerativeModel(GEMINI_MODEL)
    resp = model.generate_content(PROMPT.format(text=page_text[:4000]))
    txt = (resp.text or "").strip()

    # Try to extract a JSON object even if model wrapped it in prose
    try_text = txt
    m = re.search(r"\{[\s\S]*\}", txt)
    if m:
        try_text = m.group(0)

    try:
        data = json.loads(try_text)
    except Exception:
        # Fallback: put raw text as a single insight (never crash)
        payload = _empty_payload()
        if txt:
            payload["keyInsights"] = [txt]
        return payload

    # Normalize keys and ensure all present as lists of strings
    payload = _empty_payload()
    payload["keyInsights"]    = list(map(str, data.get("keyInsights", data.get("insights", []))))
    payload["facts"]          = list(map(str, data.get("facts", [])))
    # Keep using "contradictions" key; items may include explicit contradictions AND 'Counterpoint:' bullets
    payload["contradictions"] = list(map(str, data.get("contradictions", data.get("cautions", []))))
    payload["connections"]    = list(map(str, data.get("connections", [])))
    payload["questions"]      = list(map(str, data.get("questions", [])))

    return payload
