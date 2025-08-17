// import { useState } from "react";
// const API_BASE = "http://localhost:8080";

// export default function UploadPanel({ onUploaded }) {
//   const [files, setFiles] = useState([]);
//   const [busy, setBusy] = useState(false);

//   async function handleUpload(e) {
//     e.preventDefault();
//     if (!files.length) return;

//     const form = new FormData();
//     for (const f of files) form.append("files", f);

//     setBusy(true);
//     try {
//       const res = await fetch(`${API_BASE}/api/ingest`, {
//         method: "POST",
//         body: form,
//       });
//       const data = await res.json();
//       onUploaded?.(data.saved || []);
//     } catch (err) {
//       console.error("upload error", err);
//       onUploaded?.([]);
//     } finally {
//       setBusy(false);
//     }
//   }

//   return (
//     <div className="rounded-xl border p-4 bg-white">
//       <h3 className="font-semibold mb-2">Bulk upload PDFs</h3>
//       <form onSubmit={handleUpload}>
//         <input
//           type="file"
//           multiple
//           accept="application/pdf"
//           onChange={(e) => setFiles([...e.target.files])}
//           className="mb-2"
//         />
//         <div>
//           <button
//             type="submit"
//             className="px-3 py-1.5 rounded bg-black text-white text-sm disabled:opacity-50"
//             disabled={busy || !files.length}
//           >
//             {busy ? "Uploading..." : "Upload"}
//           </button>
//         </div>
//       </form>
//       <div className="text-xs text-gray-500 mt-1">
//         Selected: {files.length ? files.map(f => f.name).join(", ") : "none"}
//       </div>
//     </div>
//   );
// }






import { useState } from "react";
const API_BASE = "http://localhost:8080";

export default function UploadPanel({ onUploaded }) {
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);

  async function handleUpload(e) {
    e.preventDefault();
    if (!files.length) return;

    const form = new FormData();
    for (const f of files) form.append("files", f);

    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/ingest`, { method: "POST", body: form });
      const data = await res.json();
      onUploaded?.(data.saved || []);
      setFiles([]);
    } catch (err) {
      console.error("upload error", err);
      onUploaded?.([]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white/90 shadow-sm">
      <div className="px-4 py-3 border-b bg-gradient-to-r from-red-600/10 to-transparent">
        <h3 className="font-semibold text-gray-800">Bulk upload PDFs</h3>
      </div>
      <form onSubmit={handleUpload} className="p-4">
        <label className="block text-sm text-gray-600 mb-2">Select one or more PDFs</label>
        <input
          type="file"
          multiple
          accept="application/pdf"
          onChange={(e) => setFiles([...e.target.files])}
          className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-red-600 file:px-3 file:py-2 file:text-white hover:file:bg-red-700 file:cursor-pointer"
        />
        <div className="mt-3 text-xs text-gray-500">
          {files.length ? `Ready: ${files.map((f) => f.name).join(", ")}` : "No files selected"}
        </div>
        <div className="mt-4">
          <button
            type="submit"
            disabled={busy || !files.length}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 disabled:opacity-50"
          >
            {busy ? "Uploading…" : "Upload"}
          </button>
        </div>
      </form>
    </div>
  );
}
