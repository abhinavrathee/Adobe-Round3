export default function RelatedPanel({ items = [], lastSel = "", busy = false, hint = "" }) {
  return (
    <div>
      {busy && <p className="muted">Finding related content…</p>}
      {!busy && hint && <p className="muted">{hint}</p>}
      {!busy && !hint && items.length === 0 && <p className="muted">No results.</p>}
      <ul className="related-list">
        {items.map((r, i) => (
          <li key={i} className="related-item">
            <div className="related-meta">
              <span className="badge">p.{r.page}</span>
              <span className="file">{r.pdf_name}</span>
            </div>
            <div className="snippet">{r.snippet}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
