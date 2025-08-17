export default function RelatedPanel({ items = [], lastSel = "", busy = false, hint = "" }) {
  return (
    <div>
      {busy && <p className="muted">Finding related content…</p>}
      {!busy && hint && <p className="muted">{hint}</p>}
      {!busy && !hint && items.length === 0 && <p className="muted">No results.</p>}
      <ul className="related-list">
        {items.map((r, i) => {
          const page = r.page || r.page_num || r.pageNumber || r.metadata?.page || "?";
          const file = r.pdf_name || r.file || r.filename || r.metadata?.file || "";
          const snippet = r.snippet || r.text || r.chunk || r.content || "";
        return (
          <li key={i} className="related-item">
            <div className="related-meta">
              <span className="badge">p.{page}</span>
              {file && <span className="file">{file}</span>}
            </div>
            <div className="snippet">{snippet}</div>
          </li>
        )})}
      </ul>
    </div>
  );
}
