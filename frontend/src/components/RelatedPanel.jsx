export default function RelatedPanel({
  items = [],
  lastSel = "",
  busy = false,
  hint = "",
  activeIdx = -1,
  onUseSelected,
  onOpen, // click handler for a card
}) {
  const toSnippet = (t) => {
    const s = (t || "").replace(/\s+/g, " ").trim();
    if (!s) return "";
    const sentences = s.split(/(?<=[.!?])\s+/);
    const take = Math.min(4, Math.max(2, sentences.length));
    const joined = sentences.slice(0, take).join(" ");
    return joined.length > 420 ? joined.slice(0, 420) + "…" : joined;
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <h3 className="card-title" style={{ margin: 0 }}>
          Related sections & Snippets
        </h3>

        <button
          className="btn"
          onClick={onUseSelected}
          disabled={!lastSel || busy}
          title={lastSel ? "Search related using current selection" : "Select text in the PDF first"}
          style={{
            padding: "8px 14px",
            borderRadius: 999,
            fontWeight: 800,
            background: "linear-gradient(135deg,#60a5fa,#a78bfa)",
            color: "white",
            border: "none",
            opacity: (!lastSel || busy) ? 0.6 : 1,
            cursor: (!lastSel || busy) ? "not-allowed" : "pointer",
          }}
        >
          Use Selected Text
        </button>
      </div>

      {busy && <p className="muted">Finding related content…</p>}
      {!busy && hint && <p className="muted">{hint}</p>}
      {!busy && !hint && items.length === 0 && <p className="muted">No results.</p>}

      <ul className="related-list" style={{ display: "grid", gap: 10 }}>
        {items.map((r, i) => {
          const page = r.page || r.page_num || r.pageNumber || r.metadata?.page || "?";
          const file = r.pdf_name || r.file || r.filename || r.metadata?.file || "";
          const rawSnippet = r.snippet || r.text || r.chunk || r.content || "";
          const snippet = toSnippet(rawSnippet);
          const title = r.section_title || r.title || `Page ${page}`;

          return (
            <li
              key={i}
              className="related-item"
              onClick={() => onOpen && onOpen(r, i)}
              style={{
                cursor: onOpen ? "pointer" : "default",
                border: i === activeIdx
                  ? "2px solid #60a5fa"
                  : "1px solid rgba(148,163,184,.25)",
                borderRadius: 14,
                padding: 12,
                background: i === activeIdx
                  ? "rgba(96,165,250,0.12)"
                  : "rgba(255,255,255,0.06)",
                color: "#e5e7eb",
                transition: "border 0.2s, background 0.2s",
              }}
            >
              <div
                className="related-meta"
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  marginBottom: 6,
                  fontSize: 12,
                  color: "#94a3b8", // slate-400
                }}
              >
                <span className="badge" style={{ background: "rgba(148,163,184,.2)", color: "#e5e7eb", padding: "2px 6px", borderRadius: 8 }}>
                  p.{page}
                </span>
                {file && <span className="file" title={file}>{file}</span>}
              </div>

              <div style={{ fontWeight: 700, marginBottom: 6, color: "#f8fafc" /* near-white */ }}>
                {title}
              </div>

              <div
                className="snippet"
                style={{
                  fontSize: 13,
                  lineHeight: 1.45,
                  color: "#cbd5e1", // slate-300
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {snippet || "No preview text available for this section."}
              </div>

              {onOpen && (
                <div style={{ marginTop: 8, fontSize: 12, color: "#9aa4b2" }}>
                  Click to open this page in the viewer →
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
