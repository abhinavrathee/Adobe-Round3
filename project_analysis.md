# AcroLens — Complete Project Analysis

> Full audit of the Adobe-Round3 (AcroLens) project codebase.

---

## 🏗️ Project Summary

This is a **document intelligence web app** for the Adobe India Hackathon 2025. It features:
- Multi-PDF upload, AI-generated insights (Gemini), semantic search (TF-IDF + fuzzy), and podcast-style audio summaries (TTS).
- **Backend:** Python/FastAPI  |  **Frontend:** React 19 + Vite 7 + Tailwind CSS v4
- **Deployment:** Single Docker container (Nginx + Uvicorn)

---

## 🔴 Critical Errors (Will Break the App)

### 1. **`main.py` — First 310 lines are dead commented-out code**
- [main.py:1-310](file:///d:/Adobe-Round3/backend/main.py#L1-L310)
- The entire first half of `main.py` is commented out (lines 1–310). The active code starts at line 312. This is not a bug per se, but it's **311 lines of dead code** that make the file bloated and confusing. It should be removed.

### 2. **`backend/.env` — Exposed API Key (CRITICAL SECURITY)**
- [backend/.env:1](file:///d:/Adobe-Round3/backend/.env#L1)
- `GEMINI_API_KEY=AIzaSyDQ7a-8vs2i7uzSsl72jCz30-u6ZtS_ABo` — this is a **real API key committed to the repo**. This should be in `.gitignore` or use a placeholder.
- Similarly, the root `.env` exposes `VITE_ADOBE_EMBED_API_KEY`.

### 3. **`.gitignore` does NOT exclude `.env` files at root level**
- [backend/.gitignore](file:///d:/Adobe-Round3/backend/.gitignore) — The backend `.gitignore` exists but the **root `.env`** is not covered by any gitignore. API keys are being committed.

### 4. **`tts_utils.py` — Imported but never used; will crash if called directly**
- [tts_utils.py](file:///d:/Adobe-Round3/backend/tts_utils.py) — This file imports `google.cloud.texttospeech` at the top level (line 3). If `google-cloud-texttospeech` is **not installed** (and it's NOT in `requirements.txt`!), importing this module will **crash**. 
- The file is a legacy module and not imported anywhere in the active codebase, so it won't cause startup crashes — but it's dead code.

### 5. **Missing `google-cloud-texttospeech` in `requirements.txt`**
- [requirements.txt](file:///d:/Adobe-Round3/backend/requirements.txt)
- The TTS service (`services/tts.py`) calls `from google.cloud import texttospeech` inside `_gcp_tts()`. But **`google-cloud-texttospeech` is not listed in `requirements.txt`**.
- If TTS_PROVIDER=gcp (the default), podcast generation will **crash at runtime** with `ModuleNotFoundError`.

### 6. **Missing `pydub` in `requirements.txt`**
- `podcast_service.py` and `services/tts.py` both `try: from pydub import AudioSegment`. While they gracefully fallback, pydub is a **core feature dependency** for multi-voice podcasts and chunk merging — and it's not in requirements.txt.

### 7. **`pdf_utils.py` is completely empty**
- [pdf_utils.py](file:///d:/Adobe-Round3/backend/pdf_utils.py) — 0 bytes, no content. Listed in the project description as "PDF parsing utilities" but contains nothing. Dead file.

### 8. **`postcss.config.js` is completely commented out**
- [postcss.config.js](file:///d:/Adobe-Round3/frontend/postcss.config.js) — All content is commented out. The active config is in `postcss.config.cjs`. Having both files can cause confusion for PostCSS resolution, though the `.cjs` file takes priority with the current `"type": "module"` in package.json.

---

## 🟡 Moderate Issues (Bugs, Logic Errors, Inconsistencies)

### 9. **API_BASE mismatch between components**
| File | Default API_BASE |
|---|---|
| [App.jsx:10](file:///d:/Adobe-Round3/frontend/src/App.jsx#L10) | `http://localhost:5001` |
| [PodcastBar.jsx:3](file:///d:/Adobe-Round3/frontend/src/components/PodcastBar.jsx#L3) | `http://localhost:5001` |
| [PodcastButton.jsx:2](file:///d:/Adobe-Round3/frontend/src/components/PodcastButton.jsx#L2) | `http://localhost:5001` |
| [UploadPanel.jsx:2](file:///d:/Adobe-Round3/frontend/src/components/UploadPanel.jsx#L2) | `http://localhost:5001` |
| [LibraryPanel.jsx:2](file:///d:/Adobe-Round3/frontend/src/components/LibraryPanel.jsx#L2) | `http://localhost:5001` |
| [api.js:1](file:///d:/Adobe-Round3/frontend/src/utils/api.js#L1) | `http://localhost:5001` |
| [frontend/.env:4](file:///d:/Adobe-Round3/frontend/.env#L4) | `http://localhost:8080` |
| Backend (README) | Port `5001` (local dev) or `8080` (Docker) |

- The hardcoded fallback is `http://localhost:5001` in all component files, but the backend README says to run on port `5001` (local) and `8080` (Docker).
- The frontend `.env` says `VITE_API_BASE=http://localhost:8080` — so if `.env` is loaded, it would point to Docker port, not the local dev backend port (`5001`).
- **Result:** During local dev without Docker, the `.env` will send requests to port 8080 (wrong). During Docker, the hardcoded fallback `5001` is also wrong. Whichever scenario, one of them will be mismatched.

### 10. **`fetchInsights` in `api.js` uses GET with query params — but the backend expects POST with JSON body**
- [api.js:3-9](file:///d:/Adobe-Round3/frontend/src/utils/api.js#L3-L9) — `fetchInsights()` does a GET request to `/api/insights` with query params `doc_id` and `pdf_name`.
- [main.py:476](file:///d:/Adobe-Round3/backend/main.py#L476) — The backend endpoint `POST /api/insights` expects a JSON body with `selection_text`.
- **This utility function will always fail** with a 405 Method Not Allowed. (It's not used in the main app flow though — `App.jsx` uses its own fetch logic.)

### 11. **`UseInsights.js` hook is dead code**
- [UseInsights.js](file:///d:/Adobe-Round3/frontend/src/hooks/UseInsights.js) — Imports `fetchInsights` from `api.js` (which is broken, see #10). This hook is **never imported** by any component. Dead code.

### 12. **`SelectionPreview.jsx` uses Tailwind utility classes but Tailwind v4 is NOT processing them**
- [SelectionPreview.jsx](file:///d:/Adobe-Round3/frontend/src/components/SelectionPreview.jsx) — Uses classes like `rounded-2xl`, `border-gray-200`, `bg-white/90`, `px-4`, `py-3`, `font-semibold`, etc.
- But `index.css` uses the old Tailwind v3 `@tailwind` directives, and `tailwind.css` is a pre-built v4 CSS file that only includes base/theme reset — **no utility classes are generated**.
- The `postcss.config.cjs` uses `@tailwindcss/postcss` (v4 plugin) which uses `@import "tailwindcss"` syntax, not `@tailwind base/components/utilities`.
- **Result:** Tailwind utility classes in `SelectionPreview.jsx` will NOT be applied. The component will look unstyled.

### 13. **`index.css` uses Tailwind v3 syntax (`@tailwind base; @tailwind components; @tailwind utilities;`)**
- [index.css](file:///d:/Adobe-Round3/frontend/src/index.css) — These are **Tailwind v3 directives** but the project uses **Tailwind v4** (`^4.1.12`). In v4, you use `@import "tailwindcss"` instead. This file will NOT process correctly with the v4 PostCSS plugin.

### 14. **Duplicate PostCSS config files**
- Both `postcss.config.js` (commented out) and `postcss.config.cjs` (active) exist. While only `.cjs` is active, having both is confusing.

### 15. **`tailwind.config.js` uses CommonJS (`module.exports`) in an ESM project**
- [tailwind.config.js](file:///d:/Adobe-Round3/frontend/tailwind.config.js) — Uses `module.exports = {}` but `package.json` has `"type": "module"`. Tailwind v4 doesn't use this config file anyway (it uses CSS-based config), making this file **dead code**.

### 16. **`index.html` title is still "Vite + React"**
- [index.html:7](file:///d:/Adobe-Round3/frontend/index.html#L7) — `<title>Vite + React</title>` should be `<title>AcroLens — Intelligent PDF Workbench</title>`.

### 17. **Adobe Embed SDK script in `index.html` — unnecessary if using `pdfjs-dist`**
- [index.html:8](file:///d:/Adobe-Round3/frontend/index.html#L8) — Loads `https://documentcloud.adobe.com/view-sdk/main.js` from Adobe CDN.
- The project description says "pdfjs-dist (not Adobe Embed SDK)", but `PdfViewer.jsx` actually **does** use the Adobe Embed SDK (`window.AdobeDC.View`). This is contradictory to the description but the code is internally consistent. The `pdfjs-dist` npm package is installed but **never used**.

### 18. **Backend `package.json` is empty `{}`; `node_modules` exists in backend**
- [backend/package.json](file:///d:/Adobe-Round3/backend/package.json) — Empty object. There's also a `node_modules` dir and `package-lock.json` in the backend, which are completely unnecessary for a Python project. Likely accidental.

### 19. **`llm_utils.py` — Escaped regex in fallback text cleaning (lines 239-240)**
- [llm_utils.py:239-240](file:///d:/Adobe-Round3/backend/llm_utils.py#L239-L240):
  ```python
  text = re.sub(r"^[\\-\\*\\d\\.)\\s]+", "", text)
  text = re.sub(r"\\s+", " ", text).strip()
  ```
- These regexes use **double-escaped** backslashes (`\\s` instead of `\s`). This means `\\s` matches a literal backslash followed by 's', NOT whitespace. The cleaning will not work as intended.
- Same issue on lines 222, 226, and 244.

---

## 🟢 Minor Issues (Code Quality, Best Practices)

### 20. **`PodcastButton.jsx` is unused dead code**
- [PodcastButton.jsx](file:///d:/Adobe-Round3/frontend/src/components/PodcastButton.jsx) — This is an alternative/older podcast button component that's **never imported** anywhere. `PodcastBar.jsx` is the one used in `App.jsx`.

### 21. **`README1.md` — Extra README file at root**
- Duplicate/alternative README. Should be consolidated or removed.

### 22. **No `meta description` in `index.html`**
- Missing SEO meta description tag.

### 23. **`App.jsx` line 37 — Loads `sample.pdf` by default which may not exist**
- [App.jsx:37](file:///d:/Adobe-Round3/frontend/src/App.jsx#L37) — `useState(\`\${API_BASE}/api/file/\${encodeURIComponent("sample.pdf")}\`)` — If there's no `sample.pdf` in the library, the app starts with a 404 PDF.

### 24. **Thread safety concern with `build_index()` in `main.py`**
- [main.py:410](file:///d:/Adobe-Round3/backend/main.py#L410) — `threading.Thread(target=build_index, daemon=True).start()` is called on every upload. If two uploads happen simultaneously, two concurrent `build_index` calls could cause a corrupted pickle file. The `_build_lock` in indexer.py only protects `ensure_index`, not direct `build_index` calls.

### 25. **`__pycache__` committed to repo**
- [backend/__pycache__](file:///d:/Adobe-Round3/backend/__pycache__) — Should be in `.gitignore`.

---

## 📊 Summary Table

| Severity | Count | Key Areas |
|---|---|---|
| 🔴 **Critical** | 8 | Missing deps, dead code, API key exposure, empty files |
| 🟡 **Moderate** | 11 | API mismatch, broken utilities, Tailwind v3/v4 conflicts, wrong regexes |
| 🟢 **Minor** | 6 | Dead components, missing SEO, code quality |
| **Total** | **25** | |

---

## 🎯 Priority Fix Order

1. **Add `google-cloud-texttospeech` to `requirements.txt`** — Without this, the default TTS (GCP) crashes
2. **Fix `index.css` for Tailwind v4** — Change to `@import "tailwindcss"` syntax
3. **Fix the double-escaped regexes in `llm_utils.py`** — Podcast script cleaning is broken
4. **Fix API_BASE inconsistency** — Standardize the default port across all files
5. **Remove dead code** — `main.py` first 310 lines, `UseInsights.js`, `PodcastButton.jsx`, `pdf_utils.py`, `tts_utils.py`, empty backend `package.json` + `node_modules`
6. **Fix `index.html` title** — Change to AcroLens branding
7. **Secure API keys** — Add `.env` to root `.gitignore`, rotate exposed keys
8. **Clean up config files** — Remove dead `postcss.config.js`, `tailwind.config.js`
