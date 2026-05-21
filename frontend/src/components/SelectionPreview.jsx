export default function SelectionPreview({ text }) {
  return (
    <div className="card">
      <div style={{ borderBottom: "1px solid var(--border)", paddingBottom: 8, marginBottom: 8 }}>
        <h3 className="card-title" style={{ margin: 0 }}>Selection</h3>
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.5 }}>
        {text ? (
          <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{text}</div>
        ) : (
          <p className="muted">Select some text in the PDF…</p>
        )}
      </div>
    </div>
  );
}
