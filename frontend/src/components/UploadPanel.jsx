import { useRef, useState } from "react";
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5001";

export default function UploadPanel({ onUploaded }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [picked, setPicked] = useState(0);

  async function tryIngest(fd) {
    const res = await fetch(`${API_BASE}/api/ingest`, { method: "POST", body: fd });
    if (!res.ok) throw new Error((await res.json())?.detail || "Upload failed");
    return res.json();
  }
  async function tryUploadSingle(file) {
    const sfd = new FormData();
    sfd.append("file", file);
    const res = await fetch(`${API_BASE}/api/upload`, { method: "POST", body: sfd });
    if (!res.ok) throw new Error((await res.json())?.detail || "Upload failed");
    return res.json();
  }

  async function handleUpload(e) {
    e.preventDefault();
    const files = inputRef.current?.files;
    if (!files || !files.length) return;

    const fd = new FormData();
    for (let f of files) fd.append("files", f);

    try {
      setBusy(true); setMsg("");
      let data;
      try {
        data = await tryIngest(fd);
      } catch {
        data = await tryUploadSingle(files[0]);
      }
      setMsg("Upload successful!");
      const first = data?.saved?.[0] || data;
      if (first && onUploaded) onUploaded(first);
      if (inputRef.current) { inputRef.current.value = ""; setPicked(0); }
    } catch (err) {
      setMsg("Upload error: " + (err?.message || err));
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={handleUpload}>
      <div className="upload-row" style={{ marginBottom: 8 }}>
        <label className="file-chip">
          <span>Choose PDFs</span>
          <small>{picked ? `${picked} selected` : "click to browse"}</small>
          <input
            type="file"
            ref={inputRef}
            accept="application/pdf"
            multiple
            onChange={(e) => setPicked(e.target.files?.length || 0)}
          />
        </label>
        <button className="btn btn-primary" disabled={busy || !picked}>
          {busy ? "Uploading…" : "Upload"}
        </button>
      </div>
      {msg && <p className="muted" style={{ marginTop: 4 }}>{msg}</p>}
    </form>
  );
}
