// frontend/src/components/PodcastBar.jsx
import { useState } from "react";
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5001";

// Optional envs
const DEFAULT_PROVIDER = import.meta.env.VITE_TTS_PROVIDER || undefined;
const DEFAULT_VOICES = (import.meta.env.VITE_TTS_VOICES || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

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
        tts_provider: DEFAULT_PROVIDER,
        speakers: (DEFAULT_VOICES.length > 1 ? 2 : 1),
        voices: DEFAULT_VOICES.length ? DEFAULT_VOICES : undefined,
        rate: 150,
        // NEW: ask for ~420 words; backend will clamp to 2–5 minutes anyway
        target_words: 420
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
          background: "linear-gradient(135deg,#22c55e,#16a34a)",
          borderColor: "transparent",
          color: "#0b1a13",
          fontWeight: 800,
          padding: "10px 14px",
          borderRadius: 999
        }}
      >
        {busy ? "Voicing…" : "🎧 Podcast"}
      </button>

      {open && (audioUrl || preview || error) && (
        <div style={{
          position: "fixed",
          right: 16,
          top: 64,
          width: 380,
          zIndex: 1000,
          background: "var(--panel, #ffffff)",
          border: "1px solid var(--border, #e5e7eb)",
          borderRadius: 16,
          boxShadow: "0 24px 48px rgba(0,0,0,0.22)",
          padding: 14
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: "var(--text, #111827)" }}>Podcast</div>
            <button
              onClick={() => setOpen(false)}
              style={{
                background: "rgba(2,6,23,0.06)",
                border: "1px solid rgba(2,6,23,0.12)",
                color: "var(--text, #111827)",
                padding: "6px 10px",
                fontSize: 12,
                borderRadius: 999
              }}
            >
              Close
            </button>
          </div>

          {error ? (
            <div style={{ color: "#b91c1c", fontSize: 13, whiteSpace: "pre-wrap" }}>
              {error}
              <div style={{ marginTop: 6, opacity: 0.8 }}>
                Tip: choose a provider:<br />
                <code>VITE_TTS_PROVIDER=local | gcp | azure</code>
              </div>
            </div>
          ) : (
            <>
              {preview && (
                <div style={{
                  fontSize: 12,
                  color: "var(--muted, #475569)",
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
                <div style={{ fontSize: 12, color: "var(--muted, #6b7280)" }}>Preparing audio…</div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
