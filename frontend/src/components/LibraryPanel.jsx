import { useEffect, useState } from "react";
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5001";

export default function LibraryPanel({ onOpen }) {
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(true);

  const refresh = async () => {
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/library`);
      const json = await res.json();
      setItems(json.items || []);
    } catch {
      setItems([]);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const open = (name) => {
    if (!onOpen) return;
    const url = `${API_BASE}/api/file/${encodeURIComponent(name)}`;
    onOpen(url);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h3 className="card-title" style={{ margin: 0 }}>Your Library</h3>
        <button className="btn" onClick={refresh} disabled={busy}>{busy ? "…" : "Refresh"}</button>
      </div>

      {busy && <p className="muted">Loading library…</p>}
      {!busy && items.length === 0 && <p className="muted">No PDFs uploaded yet.</p>}

      <ul className="lib-list">
        {items.map((it, idx) => (
          <li key={idx} className="lib-item" onClick={() => open(it.name)} title={it.name}>
            <div className="lib-name">{it.name}</div>
            <div className="lib-meta">{(it.size / 1024).toFixed(1)} KB</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
