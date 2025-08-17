// import { useEffect, useState } from "react";
// const API_BASE = "http://localhost:8080";

// export default function LibraryPanel({ onOpen }) {
//   const [items, setItems] = useState([]);
//   const [busy, setBusy] = useState(false);

//   async function load() {
//     setBusy(true);
//     try {
//       const res = await fetch(`${API_BASE}/api/library`);
//       const data = await res.json();
//       setItems(data.items || []);
//     } catch (e) {
//       console.error("library error", e);
//       setItems([]);
//     } finally {
//       setBusy(false);
//     }
//   }

//   useEffect(() => { load(); }, []);

//   return (
//     <div className="rounded-xl border p-4 bg-white">
//       <div className="flex items-center justify-between mb-2">
//         <h3 className="font-semibold">Your Library</h3>
//         <button
//           onClick={load}
//           className="text-xs px-2 py-1 rounded border"
//           disabled={busy}
//         >
//           {busy ? "Refreshing..." : "Refresh"}
//         </button>
//       </div>
//       {!items.length && <p className="text-sm text-gray-500">No PDFs yet. Upload some above.</p>}
//       <div className="space-y-2">
//         {items.map((it) => (
//           <button
//             key={it.name}
//             onClick={() => onOpen?.(`${API_BASE}/api/file/${encodeURIComponent(it.name)}`)}
//             className="w-full text-left p-2 rounded hover:bg-gray-50 border"
//             title="Open in viewer"
//           >
//             <div className="font-medium">{it.name}</div>
//             <div className="text-xs text-gray-500">{(it.size/1024).toFixed(1)} KB</div>
//           </button>
//         ))}
//       </div>
//     </div>
//   );
// }







import { useEffect, useState } from "react";
const API_BASE = "http://localhost:8080";

export default function LibraryPanel({ onOpen }) {
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);

  async function load() {
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/library`);
      const data = await res.json();
      setItems(data.items || []);
    } catch (e) {
      console.error("library error", e);
      setItems([]);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white/90 shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h3 className="font-semibold text-gray-800">Your Library</h3>
        <button
          onClick={load}
          className="text-xs rounded-md border px-2 py-1 hover:bg-gray-50 disabled:opacity-50"
          disabled={busy}
          title="Refresh library"
        >
          {busy ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <div className="p-2">
        {!items.length && (
          <p className="px-2 py-3 text-sm text-gray-500">No PDFs yet. Upload some above.</p>
        )}

        <ul className="space-y-2">
          {items.map((it) => (
            <li key={it.name}>
              <button
                onClick={() => onOpen?.(`${API_BASE}/api/file/${encodeURIComponent(it.name)}`)}
                className="group w-full text-left rounded-xl border px-3 py-2 hover:bg-gray-50 flex items-center gap-3"
                title="Open in viewer"
              >
                <div className="h-9 w-7 rounded-md bg-red-600/10 border border-red-600/20 flex items-center justify-center">
                  <span className="text-[10px] font-semibold text-red-600">PDF</span>
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-gray-800 truncate group-hover:text-red-700">
                    {it.name}
                  </div>
                  <div className="text-xs text-gray-500">{(it.size / 1024).toFixed(1)} KB</div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
