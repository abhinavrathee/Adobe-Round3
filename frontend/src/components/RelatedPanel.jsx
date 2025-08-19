// export default function RelatedPanel({ items = [], lastSel = "", busy = false, hint = "", onUseSelected }) {

//   return (
//     <div>
//       {busy && <p className="muted">Finding related content…</p>}
//       {!busy && hint && <p className="muted">{hint}</p>}
//       {!busy && !hint && items.length === 0 && <p className="muted">No results.</p>}
//       <ul className="related-list">
//         {items.map((r, i) => {
//           const page = r.page || r.page_num || r.pageNumber || r.metadata?.page || "?";
//           const file = r.pdf_name || r.file || r.filename || r.metadata?.file || "";
//           const snippet = r.snippet || r.text || r.chunk || r.content || "";
//         return (
//           <li key={i} className="related-item">
//             <div className="related-meta">
//               <span className="badge">p.{page}</span>
//               {file && <span className="file">{file}</span>}
//             </div>
//             <div className="snippet">{snippet}</div>
//           </li>
//         )})}
//       </ul>
//     </div>
//   );
// }
export default function RelatedPanel({ items = [], lastSel = "", busy = false, hint = "", onUseSelected }) {
  const sel = (lastSel || "").trim();
  const canUse = !!sel && !busy; // enable when we have a selection and we're not loading

  return (
    <div>
      {/* Action row */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <button
          className="btn"
          onClick={() => onUseSelected && onUseSelected()}
          disabled={!canUse}
          title={sel ? "Find related sections using your current selection" : "Select text in the PDF to enable"}
        >
          Use Selected Text
        </button>
        <div
          className="muted"
          style={{
            fontSize: 12,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            flex: 1,
          }}
        >
          {sel ? `Selected: "${sel}"` : "Select text to search."}
        </div>
      </div>

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
          );
        })}
      </ul>
    </div>
  );
}
