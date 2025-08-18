import { useState } from "react";
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5001";

/**
 * Floating action button that generates an audio podcast from:
 *  - current section text (if any)
 *  - related items (snippets)
 *  - insights (flattened bullets)
 *
 * Props:
 * - file, currentPage, currentSectionTitle, currentSectionText
 * - related: Array<{title?, page?, text? | snippet? | content?}>
 * - insights: string[]
 */
export default function PodcastButton({
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

  async function generate() {
    try {
      setBusy(true); setError(""); setAudioUrl(""); setPreview("");

      const payload = {
        file,
        current_page: currentPage ?? null,
        current_section_title: currentSectionTitle ?? null,
        current_section_text: currentSectionText ?? null,
        related: (related || []).map(r => ({
          title: r.title ?? null,
          page: r.page ?? r.page_num ?? r.pageNumber ?? r.metadata?.page ?? null,
          text: r.text ?? r.snippet ?? r.content ?? ""
        })).filter(r => r.text),
        insights: insights || [],
        rate: 180,
        volume: 1.0,
        target_words: 650
      };

      const res = await fetch(`${API_BASE}/api/podcast/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      // Give a helpful error if TTS isn’t installed
      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        throw new Error(msg || "Podcast generation failed");
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
    <>
      {/* Floating action button */}
      <button
        onClick={generate}
        disabled={busy || !file}
        title="Generate a 2–5 min narrated audio from this section, related, and insights."
        style={{
          position: "fixed",
          right: 24,
          bottom: 24,
          zIndex: 60,
          background: "linear-gradient(135deg,#22c55e,#16a34a)",
          color: "#0b1a13",
          border: "none",
          padding: "14px 18px",
          borderRadius: 999,
          fontWeight: 800,
          fontSize: 15,
          boxShadow: "0 12px 30px rgba(34,197,94,0.35)",
          cursor: busy ? "not-allowed" : "pointer"
        }}
      >
        {busy ? "Voicing…" : "🎧 Generate & Play"}
      </button>

      {/* Mini player / status popover */}
      {(audioUrl || preview || error) && (
        <div style={{
          position: "fixed",
          right: 24,
          bottom: 86,
          width: 360,
          zIndex: 60,
          background: "white",
          border: "1px solid #e5e7eb",
          borderRadius: 14,
          boxShadow: "0 20px 40px rgba(0,0,0,0.18)",
          padding: 12
        }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>
            Podcast
          </div>

          {error ? (
            <div style={{ color: "#b91c1c", fontSize: 13, whiteSpace: "pre-wrap" }}>
              {error}
              <div style={{ marginTop: 6, opacity: 0.8 }}>
                Tip: in backend venv run<br />
                <code>pip install pyttsx3==2.90 comtypes pypiwin32</code>
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
                <div style={{ fontSize: 12, color: "#6b7280" }}>
                  Preparing audio…
                </div>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}
