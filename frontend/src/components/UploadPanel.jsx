import { useRef, useState } from "react";
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5001";

export default function UploadPanel({ onUploaded }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

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
        // Prefer existing multi-upload endpoint
        data = await tryIngest(fd);
      } catch {
        // Fallback: single upload (first file)
        data = await tryUploadSingle(files[0]);
      }

      setMsg("Upload successful!");
      const first = data?.saved?.[0] || data; // accept either shape
      if (first && onUploaded) onUploaded(first);
      if (inputRef.current) inputRef.current.value = "";
    } catch (err) {
      setMsg("Upload error: " + (err?.message || err));
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={handleUpload}>
      <input type="file" ref={inputRef} accept="application/pdf" multiple />
      <div style={{ height: 8 }} />
      <button className="btn" disabled={busy}>{busy ? "Uploading…" : "Upload"}</button>
      {msg && <p className="muted" style={{ marginTop: 8 }}>{msg}</p>}
    </form>
  );
}
