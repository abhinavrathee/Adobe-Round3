//with this adobe api works and pdf openes
// import PdfViewer from "./components/PdfViewer";
// export default function App() {
//   return (
//     <div style={{ padding: 16 }}>
//       <h1>PDF Test</h1>
//       <PdfViewer />
//     </div>
//   );
// }


// import PdfViewer from "./components/PdfViewer";

// export default function App() {
//   return (
//     <div style={{ padding: 16 }}>
//       <h1 style={{ marginBottom: 12, fontWeight: 700 }}>PDF in React</h1>
//       <PdfViewer fileUrl="/sample.pdf" />
//     </div>
//   );
// }




//at this with no css
// import { useState } from "react";
// import PdfViewer from "./components/PdfViewer";
// import UploadPanel from "./components/UploadPanel";
// import LibraryPanel from "./components/LibraryPanel";

// export default function App() {
//   const [currentUrl, setCurrentUrl] = useState("/sample.pdf");
//   const [refreshFlag, setRefreshFlag] = useState(0); // trigger library refresh after upload if you want later

//   return (
//     <div className="min-h-screen bg-gray-50">
//       <header className="px-6 py-4 bg-white shadow-sm flex items-center justify-between">
//         <h1 className="text-xl font-bold">Document Insight & Engagement</h1>
//         <div className="text-sm text-gray-500">Adobe PDF Embed • React • FastAPI</div>
//       </header>

//       <main className="p-6 grid grid-cols-12 gap-4">
//         <section className="col-span-9">
//           <PdfViewer fileUrl={currentUrl} />
//         </section>

//         <aside className="col-span-3 space-y-4">
//           <UploadPanel onUploaded={() => setRefreshFlag((x) => x + 1)} />
//           <LibraryPanel key={refreshFlag} onOpen={(url) => setCurrentUrl(url)} />
//         </aside>
//       </main>
//     </div>
//   );
// }


import { useState, useRef } from "react";
import PdfViewer from "./components/PdfViewer";
import UploadPanel from "./components/UploadPanel";
import LibraryPanel from "./components/LibraryPanel";
import SelectionPreview from "./components/SelectionPreview";
import RelatedPanel from "./components/RelatedPanel";

const API_BASE = "http://localhost:8080";

function Header({ onLoadDemo }) {
  return (
    <header className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b">
      <div className="mx-auto max-w-[1400px] px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-red-600 flex items-center justify-center text-white font-bold">A</div>
          <div>
            <h1 className="text-lg font-semibold leading-tight">Document Insight & Engagement</h1>
            <p className="text-xs text-gray-500">Adobe PDF Embed • React • FastAPI</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onLoadDemo}
            className="text-xs rounded-md border px-3 py-1.5 hover:bg-gray-50"
          >
            Load Demo PDF
          </button>
          <span className="hidden sm:inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-gray-600">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> Running
          </span>
        </div>
      </div>
    </header>
  );
}

export default function App() {
  const [currentUrl, setCurrentUrl] = useState("/sample.pdf");
  const [refreshFlag, setRefreshFlag] = useState(0);

  const [selectionText, setSelectionText] = useState("");
  const [related, setRelated] = useState([]);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState("");

  const debounceRef = useRef(null);
  const MIN_LEN = 20; // require at least ~a short sentence

  const loadDemo = () => {
    setCurrentUrl("https://documentcloud.adobe.com/view-sdk-demo/PDFs/Bodea%20Brochure.pdf");
  };

  async function onSelection(text) {
    setSelectionText(text);
    setHint("");
    setRelated([]);

    if (!text || text.trim().length < MIN_LEN) {
      setHint("Tip: copy a longer phrase or sentence (≥ 20 characters) to get high-quality related results.");
      return; // do NOT call backend for tiny selections
    }

    // Debounce calls
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        setBusy(true);
        const res = await fetch(`http://localhost:8080/api/related`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ selection_text: text }),
        });
        const data = await res.json();
        setRelated(data.results || []);
      } catch (e) {
        console.error("related error:", e);
        setRelated([]);
        setHint("Couldn’t fetch related results. Is the backend running on :8080?");
      } finally {
        setBusy(false);
      }
    }, 300);
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <Header onLoadDemo={loadDemo} />

      <main className="mx-auto max-w-[1400px] px-6 py-5">
        <div className="grid grid-cols-12 gap-5">
          {/* Left: PDF viewer */}
          <section className="col-span-12 md:col-span-8 lg:col-span-9">
            <div className="rounded-2xl border border-gray-200 bg-white/90 shadow-sm overflow-hidden">
              <PdfViewer fileUrl={currentUrl} onSelectionText={onSelection} />
            </div>
          </section>

          {/* Right: sidebar */}
          <aside className="col-span-12 md:col-span-4 lg:col-span-3">
            <div className="md:sticky md:top-20 flex flex-col gap-4">
              <RelatedPanel items={related} lastSel={selectionText} busy={busy} hint={hint} />
              <SelectionPreview text={selectionText} />
              <UploadPanel onUploaded={() => setRefreshFlag((x) => x + 1)} />
              <LibraryPanel key={refreshFlag} onOpen={(url) => setCurrentUrl(url)} />
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
