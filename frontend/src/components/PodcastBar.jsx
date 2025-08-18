import { useState } from "react";
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5001";

// You may set these in frontend .env (optional)
// VITE_TTS_PROVIDER=local | gcp | azure
// VITE_TTS_VOICES=en-US-Neural2-F,en-US-Neural2-D
const DEFAULT_PROVIDER = import.meta.env.VITE_TTS_PROVIDER || undefined;
const DEFAULT_VOICES = (import.meta.env.VITE_TTS_VOICES || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

/**
 * Header podcast generator (never covers the PDF UI).
 */
export default function PodcastBar({
  file,
  currentPage,
  currentSectionTitle,
  currentSectionText,
  related = [],
  insights = [],
}) {
  const [busy, setBusy] = useState(false);
  const [audioUrl, setAudioUrl] = useState("");
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);

  // filter related to current file
  const sameFileRelated = (related || []).filter(r => {
    const f = r.pdf_name || r.file || r.filename || r.metadata?.file;
    if (!file) return false;
    return !f || f === file;
  });

  async function generate() {
    try {
      setBusy(true); setError(""); setAudioUrl(""); setPreview(""); setOpen(true);

      const payload = {
        file,
        current_page: currentPage ?? null,
        current_section_title: currentSectionTitle ?? null,
        current_section_text: currentSectionText ?? null,
        related: sameFileRelated.map(r => ({
          title: r.title ?? null,
          page: r.page ?? r.page_num ?? r.pageNumber ?? r.metadata?.page ?? null,
          text: r.text ?? r.snippet ?? r.content ?? ""
        })).filter(r => r.text),
        insights: insights,
        // unified TTS params:
        tts_provider: DEFAULT_PROVIDER,        // override via env if needed
        speakers: (DEFAULT_VOICES.length > 1 ? 2 : 1),
        voices: DEFAULT_VOICES.length ? DEFAULT_VOICES : undefined,
        rate: 150,
        target_words: 800
      };

      const res = await fetch(`${API_BASE}/api/podcast/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        let msg = "Podcast generation failed";
        try { msg = (await res.json())?.detail || msg; } catch {}
        throw new Error(msg);
      }
      const data = await res.json();
      setPreview(data.script_preview || "");
      setAudioUrl(`${API_BASE}${data.url}`);
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={generate}
        disabled={busy || !file}
        className="btn"
        style={{
          background: "#16a34a",
          borderColor: "#16a34a",
          color: "white",
          fontWeight: 700
        }}
      >
        {busy ? "Voicing…" : "🎧 Podcast"}
      </button>

      {open && (audioUrl || preview || error) && (
        <div style={{
          position: "fixed",
          right: 16,
          top: 64,
          width: 360,
          zIndex: 60,
          background: "white",
          border: "1px solid #e5e7eb",
          borderRadius: 14,
          boxShadow: "0 20px 40px rgba(0,0,0,0.18)",
          padding: 12
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Podcast</div>
            <button className="btn ghost" onClick={() => setOpen(false)} style={{ fontSize: 12 }}>Close</button>
          </div>

          {error ? (
            <div style={{ color: "#b91c1c", fontSize: 13, whiteSpace: "pre-wrap" }}>
              {error}
              <div style={{ marginTop: 6, opacity: 0.8 }}>
                Tip: choose a provider:<br />
                <code>VITE_TTS_PROVIDER=local | gcp | azure</code><br />
                For <b>local</b>: install espeak-ng, pydub, ffmpeg.<br />
                For <b>gcp</b>: set GOOGLE_API_KEY or GOOGLE_APPLICATION_CREDENTIALS in backend.<br />
                For <b>azure</b>: set AZURE_TTS_* in backend.
              </div>
            </div>
          ) : (
            <>
              {preview && (
                <div style={{
                  fontSize: 12,
                  color: "#475569",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  marginBottom: 8
                }}>
                  {preview}
                </div>
              )}
              {audioUrl ? (
                <audio controls src={audioUrl} style={{ width: "100%" }} />
              ) : (
                <div style={{ fontSize: 12, color: "#6b7280" }}>Preparing audio…</div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
