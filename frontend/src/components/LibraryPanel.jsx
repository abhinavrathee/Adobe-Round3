import { useEffect, useState } from "react";
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5001";

export default function LibraryPanel({ onOpen }) {
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);

  async function load() {
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/library`);
      const data = await res.json();
      setItems(data.items || []);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div>
      <div className="card-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>Your Library</span>
        <button className="btn" onClick={load} style={{ padding: "4px 8px", fontSize: 12 }}>Refresh</button>
      </div>
      {busy && <p className="muted">Loading…</p>}
      {!busy && items.length === 0 && <p className="muted">No PDFs yet. Upload some above.</p>}
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {items.map(it => (
          <li key={it.name} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px dashed var(--border)" }}>
            <button className="btn ghost" onClick={() => onOpen(`${API_BASE}/api/file/${encodeURIComponent(it.name)}`)}>{it.name}</button>
            <span className="muted" style={{ fontSize: 12 }}>{(it.size/1024).toFixed(1)} KB</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
