// import { useCallback, useEffect, useRef, useState, useMemo } from "react";
// import PdfViewer from "./components/PdfViewer";
// import UploadPanel from "./components/UploadPanel";
// import LibraryPanel from "./components/LibraryPanel";
// import RelatedPanel from "./components/RelatedPanel";
// import InsightsBulb from "./components/InsightsBulb";
// import PodcastBar from "./components/PodcastBar";
// import "./App.css";

// const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5001";

// const getNameFromUrl = (url) => {
//   try {
//     return decodeURIComponent((url.split("/api/file/")[1] || "").split("#")[0] || "").trim();
//   } catch { return ""; }
// };

// function Header({ onGeneratePodcast, podcastSlot }) {
//   return (
//     <header className="app-header">
//       <div className="brand">
//         <div className="logo">A</div>
//         <div>
//           <h1 className="title">Document Insight & Engagement</h1>
//           <p className="subtitle">Adobe PDF Embed • React • FastAPI</p>
//         </div>
//       </div>
//       <div className="header-actions">
//         {podcastSlot}
//         <span className="pill"><span className="dot" /> Running</span>
//       </div>
//     </header>
//   );
// }

// export default function App() {
//   const [currentUrl, setCurrentUrl] = useState(`${API_BASE}/api/file/${encodeURIComponent("sample.pdf")}`);
//   const [refreshFlag, setRefreshFlag] = useState(0);

//   const [selectionText, setSelectionText] = useState("");

//   const [related, setRelated] = useState([]);
//   const [relBusy, setRelBusy] = useState(false);
//   const [relHint, setRelHint] = useState("Select some text in the PDF to see related results.");

//   const [insights, setInsights] = useState(null);
//   const [insBusy, setInsBusy] = useState(false);

//   const cur = useRef({ file: "", page: 1 });

//   const handleUploaded = (name) => {
//     if (name) setCurrentUrl(`${API_BASE}/api/file/${encodeURIComponent(name)}`);
//     setRefreshFlag((x) => x + 1);
//   };

//   const flattenInsights = useMemo(() => {
//     const data = insights || {};
//     const arr = []
//       .concat(data.keyInsights || [])
//       .concat(data.facts || [])
//       .concat(data.connections || [])
//       .concat(data.contradictions || [])
//       .concat(data.questions || []);
//     return arr.map((s) => (typeof s === "string" ? s : JSON.stringify(s)));
//   }, [insights]);

//   const fetchAutoInsightsWithRetry = async (file, page = 1, tries = 6, delayMs = 600, selText = "") => {
//     setInsBusy(true);
//     try {
//       for (let i = 0; i < tries; i++) {
//         const res = await fetch(`${API_BASE}/api/auto/insights`, {
//           method: "POST",
//           headers: { "Content-Type": "application/json" },
//           body: JSON.stringify(selText ? { file, page, text: selText } : { file, page }),
//         });
//         const data = await res.json().catch(() => ({}));
//         if (data?.insights) {
//           setInsights(data.insights);
//           return true;
//         }
//         if (i === 2) {
//           try {
//             const st = await fetch(`${API_BASE}/api/index/status`).then(r => r.json());
//             const indexed = (st?.files || []).includes(file);
//             if (!indexed) {
//               await fetch(`${API_BASE}/api/index/rebuild`, { method: "POST" }).catch(() => {});
//             }
//           } catch {}
//         }
//         await new Promise(r => setTimeout(r, delayMs));
//       }
//       setInsights(null);
//       return false;
//     } catch (e) {
//       setInsights(null);
//       return false;
//     } finally {
//       setInsBusy(false);
//     }
//   };

//   useEffect(() => {
//     const name = getNameFromUrl(currentUrl);
//     if (!name) return;
//     setSelectionText("");
//     setRelated([]);
//     setRelHint("Select some text in the PDF to see related results.");
//     fetchAutoInsightsWithRetry(name, 1);
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [currentUrl]);

//   const onPageInfo = useCallback(async ({ file, page }) => {
//     cur.current = { file, page };
//     await fetchAutoInsightsWithRetry(file, page);
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, []);

//   const onSelectionText = useCallback(async (text, { file, page }) => {
//     const sel = (text || "").trim();
//     setSelectionText(sel);
//     setRelated([]);
//     setRelHint("");

//     // NEW: copy selection to clipboard on every selection
//     if (sel) {
//       try {
//         await navigator.clipboard.writeText(sel);
//         // optional: console.log("Copied to clipboard");
//       } catch (e) {
//         console.warn("Clipboard write failed:", e);
//       }
//     }

//     if (!sel || sel.length < 8) {
//       setRelHint("Tip: select a longer phrase for better results.");
//       return;
//     }
//     setRelBusy(true);
//     try {
//       const res = await fetch(`${API_BASE}/api/related`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ selection_text: sel, doc_name: file, page }),
//       });
//       const data = await res.json().catch(() => ({}));
//       const items = data.results || data.matches || data.items || [];
//       setRelated(items);
//       if (!items.length) setRelHint("No related results found for that selection.");
//     } catch (e) {
//       setRelated([]);
//       setRelHint("Couldn't fetch related results. Is the backend running?");
//     } finally {
//       setRelBusy(false);
//     }
//   }, []);

//   const fileName = useMemo(() => getNameFromUrl(currentUrl), [currentUrl]);

//   return (
//     <div className="app-root">
//       <Header
//         podcastSlot={
//           <PodcastBar
//             file={fileName}
//             currentPage={cur.current.page}
//             currentSectionTitle={selectionText ? "Selected passage" : ""}
//             currentSectionText={selectionText}
//             related={related}
//             insights={flattenInsights}
//           />
//         }
//       />

//       <main className="layout">
//         <aside className="sidebar">
//           <section className="card">
//             <h3 className="card-title">Insights</h3>
//             <button
//               className="btn"
//               onClick={() => {
//                 const name = fileName;
//                 const text = selectionText?.trim();
//                 if (text) {
//                   fetchAutoInsightsWithRetry(name, cur.current?.page || 1, 1, 500, text);
//                 } else {
//                   fetchAutoInsightsWithRetry(name, cur.current?.page || 1);
//                 }
//               }}
//               disabled={insBusy}
//               style={{ marginBottom: "10px" }}
//             >
//               {insBusy
//                 ? "Generating…"
//                 : (selectionText ? "Generate Insights for Selection" : "Generate Insights")}
//             </button>
//             <InsightsBulb data={insights} loading={insBusy} />
//           </section>

//           <section className="card">
//             <h3 className="card-title">Related sections</h3>
//             <RelatedPanel items={related} lastSel={selectionText} busy={relBusy} hint={relHint} />
//           </section>

//           <section className="card">
//             <UploadPanel onUploaded={handleUploaded} />
//           </section>

//           <section className="card">
//             <LibraryPanel key={refreshFlag} onOpen={(url) => setCurrentUrl(url)} />
//           </section>
//         </aside>

//         <section className="viewer">
//           <div className="viewer-card">
//             <PdfViewer
//               fileUrl={currentUrl}
//               onPageInfo={onPageInfo}
//               onSelectionText={onSelectionText}
//             />
//           </div>
//         </section>
//       </main>
//     </div>
//   );
// }

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import PdfViewer from "./components/PdfViewer";
import UploadPanel from "./components/UploadPanel";
import LibraryPanel from "./components/LibraryPanel";
import RelatedPanel from "./components/RelatedPanel";
import InsightsBulb from "./components/InsightsBulb";
import PodcastBar from "./components/PodcastBar";
import "./App.css";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5001";

const getNameFromUrl = (url) => {
  try {
    return decodeURIComponent((url.split("/api/file/")[1] || "").split("#")[0] || "").trim();
  } catch { return ""; }
};

function Header({ onGeneratePodcast, podcastSlot }) {
  return (
    <header className="app-header">
      <div className="brand">
        <div className="logo">A</div>
        <div>
          <h1 className="title">Document Insight & Engagement</h1>
          <p className="subtitle">Adobe PDF Embed • React • FastAPI</p>
        </div>
      </div>
      <div className="header-actions">
        {podcastSlot}
        <span className="pill"><span className="dot" /> Running</span>
      </div>
    </header>
  );
}

export default function App() {
  const [currentUrl, setCurrentUrl] = useState(`${API_BASE}/api/file/${encodeURIComponent("sample.pdf")}`);
  const [refreshFlag, setRefreshFlag] = useState(0);

  const [selectionText, setSelectionText] = useState("");

  const [related, setRelated] = useState([]);
  const [relBusy, setRelBusy] = useState(false);
  const [relHint, setRelHint] = useState("Select some text in the PDF to see related results.");

  const [insights, setInsights] = useState(null);
  const [insBusy, setInsBusy] = useState(false);

  const cur = useRef({ file: "", page: 1 });

  const handleUploaded = (name) => {
    if (name) setCurrentUrl(`${API_BASE}/api/file/${encodeURIComponent(name)}`);
    setRefreshFlag((x) => x + 1);
  };

  const flattenInsights = useMemo(() => {
    const data = insights || {};
    const arr = []
      .concat(data.keyInsights || [])
      .concat(data.facts || [])
      .concat(data.connections || [])
      .concat(data.contradictions || [])
      .concat(data.questions || []);
    return arr.map((s) => (typeof s === "string" ? s : JSON.stringify(s)));
  }, [insights]);

  const hasSelection = useMemo(
  () => (selectionText || "").trim().length > 0,
  [selectionText]
  );

  const fetchAutoInsightsWithRetry = async (file, page = 1, tries = 6, delayMs = 600, selText = "") => {
    setInsBusy(true);
    try {
      for (let i = 0; i < tries; i++) {
        const res = await fetch(`${API_BASE}/api/auto/insights`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(selText ? { file, page, text: selText } : { file, page }),
        });
        const data = await res.json().catch(() => ({}));
        if (data?.insights) {
          setInsights(data.insights);
          return true;
        }
        if (i === 2) {
          try {
            const st = await fetch(`${API_BASE}/api/index/status`).then(r => r.json());
            const indexed = (st?.files || []).includes(file);
            if (!indexed) {
              await fetch(`${API_BASE}/api/index/rebuild`, { method: "POST" }).catch(() => {});
            }
          } catch {}
        }
        await new Promise(r => setTimeout(r, delayMs));
      }
      setInsights(null);
      return false;
    } catch (e) {
      setInsights(null);
      return false;
    } finally {
      setInsBusy(false);
    }
  };

  useEffect(() => {
    const name = getNameFromUrl(currentUrl);
    if (!name) return;
    setSelectionText("");
    setRelated([]);
    setRelHint("Select some text in the PDF to see related results.");
    fetchAutoInsightsWithRetry(name, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUrl]);

  const onPageInfo = useCallback(async ({ file, page }) => {
    cur.current = { file, page };
    await fetchAutoInsightsWithRetry(file, page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSelectionText = useCallback(async (text, { file, page }) => {
    const sel = (text || "").trim();
    setSelectionText(sel);
    setRelated([]);
    setRelHint("");

    // copy selection to clipboard on every selection
    if (sel) {
      try {
        await navigator.clipboard.writeText(sel);
      } catch (e) {
        console.warn("Clipboard write failed:", e);
      }
    }

    if (!sel || sel.length < 8) {
      setRelHint("Tip: select a longer phrase for better results.");
      return;
    }
    setRelBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/related`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selection_text: sel, doc_name: file, page }),
      });
      const data = await res.json().catch(() => ({}));
      const items = data.results || data.matches || data.items || [];
      setRelated(items);
      if (!items.length) setRelHint("No related results found for that selection.");
    } catch (e) {
      setRelated([]);
      setRelHint("Couldn't fetch related results. Is the backend running?");
    } finally {
      setRelBusy(false);
    }
  }, []);

const onUseSelected = useCallback(async (textArg) => {
  const sel = (textArg ?? selectionText ?? "").trim();

  if (!sel) {
    setRelHint("Select text in the current PDF, then click the button.");
    return;
  }

  setRelated([]);
  setRelHint("");
  setRelBusy(true);
  try {
    const res = await fetch(`${API_BASE}/api/related`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Search across the whole library
      body: JSON.stringify({ selection_text: sel, k: 6 }),
    });
    const data = await res.json().catch(() => ({}));
    const items = data.results || data.matches || data.items || [];
    setRelated(items);
    if (!items.length) setRelHint("No related results found for that selection.");
  } catch (e) {
    setRelated([]);
    setRelHint("Couldn't fetch related results. Is the backend running?");
  } finally {
    setRelBusy(false);
  }
}, [selectionText]);

  const fileName = useMemo(() => getNameFromUrl(currentUrl), [currentUrl]);

  return (
    <div className="app-root">
      <Header
        podcastSlot={
          <PodcastBar
            file={fileName}
            currentPage={cur.current.page}
            currentSectionTitle={selectionText ? "Selected passage" : ""}
            currentSectionText={selectionText}
            related={related}
            insights={flattenInsights}
          />
        }
      />

      <main className="layout">
        <aside className="sidebar">
          <section className="card">
            <h3 className="card-title">Insights</h3>
            <button
              className="btn"
              onClick={() => {
                const name = fileName;
                const text = selectionText?.trim();
                if (text) {
                  fetchAutoInsightsWithRetry(name, cur.current?.page || 1, 1, 500, text);
                } else {
                  fetchAutoInsightsWithRetry(name, cur.current?.page || 1);
                }
              }}
              disabled={insBusy}
              style={{ marginBottom: "10px" }}
            >
              {insBusy
                ? "Generating…"
                : (selectionText ? "Generate Insights for Selection" : "Generate Insights")}
            </button>
            <InsightsBulb data={insights} loading={insBusy} />
          </section>

          <section className="card">
            <h3 className="card-title">Related sections</h3>
            <RelatedPanel
              items={related}
              lastSel={selectionText}
              busy={relBusy}
              hint={relHint}
              onUseSelected={onUseSelected}
              hasSelection={hasSelection}
            />
          </section>

          <section className="card">
            <UploadPanel onUploaded={handleUploaded} />
          </section>

          <section className="card">
            <LibraryPanel key={refreshFlag} onOpen={(url) => setCurrentUrl(url)} />
          </section>
        </aside>

        <section className="viewer">
          <div className="viewer-card">
            <PdfViewer
              fileUrl={currentUrl}
              onPageInfo={onPageInfo}
              onSelectionText={onSelectionText}
            />
          </div>
        </section>
      </main>
    </div>
  );
}
