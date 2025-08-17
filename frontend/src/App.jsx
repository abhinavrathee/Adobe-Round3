import { useCallback, useEffect, useRef, useState } from "react";
import PdfViewer from "./components/PdfViewer";
import UploadPanel from "./components/UploadPanel";
import LibraryPanel from "./components/LibraryPanel";
// import SelectionPreview from "./components/SelectionPreview"; // removed
import RelatedPanel from "./components/RelatedPanel";
import InsightsBulb from "./components/InsightsBulb";
import "./App.css";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5001";

// Parse "sample.pdf" from "http://.../api/file/sample.pdf#..."
const getNameFromUrl = (url) => {
  try {
    return decodeURIComponent((url.split("/api/file/")[1] || "").split("#")[0] || "").trim();
  } catch { return ""; }
};

function Header({ onLoadDemo }) {
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
        <button className="btn ghost" onClick={onLoadDemo}>Load Demo PDF</button>
        <span className="pill"><span className="dot" /> Running</span>
      </div>
    </header>
  );
}

export default function App() {
  const [currentUrl, setCurrentUrl] = useState(`${API_BASE}/api/file/${encodeURIComponent("sample.pdf")}`);
  const [refreshFlag, setRefreshFlag] = useState(0);

  // Selection text (we won't show a separate card, but we will use it for the button)
  const [selectionText, setSelectionText] = useState("");

  // Related panel
  const [related, setRelated] = useState([]);
  const [relBusy, setRelBusy] = useState(false);
  const [relHint, setRelHint] = useState("Select some text in the PDF to see related results.");

  // Insights panel
  const [insights, setInsights] = useState(null);
  const [insBusy, setInsBusy] = useState(false);

  // current file+page (last seen from PdfViewer)
  const cur = useRef({ file: "", page: 1 });

  const loadDemo = () => {
    // NOTE: demo PDF is external → backend can’t index → insights won’t show for the demo file
    setCurrentUrl("https://documentcloud.adobe.com/view-sdk-demo/PDFs/Bodea%20Brochure.pdf");
  };

  const handleUploaded = (name) => {
    if (name) setCurrentUrl(`${API_BASE}/api/file/${encodeURIComponent(name)}`);
    setRefreshFlag((x) => x + 1);
  };

  // Helper: call /api/auto/insights with retries (index may rebuild after upload)
  // selText (optional) — if provided, backend will generate insights on this text instead of page
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

        // Optional: after a couple tries, nudge index build if the file isn't indexed
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
      setInsights(null); // no insights found
      return false;
    } catch (e) {
      console.error("[App] auto insights error", e);
      setInsights(null);
      return false;
    } finally {
      setInsBusy(false);
    }
  };

  // When the file URL changes (e.g., clicked from Library), attempt insights for page 1
  useEffect(() => {
    const name = getNameFromUrl(currentUrl);
    if (!name) return;

    // Reset related UI until selection happens
    setSelectionText("");
    setRelated([]);
    setRelHint("Select some text in the PDF to see related results.");

    // Kick off insights for page 1 in case onPageInfo doesn't fire
    fetchAutoInsightsWithRetry(name, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUrl]);

  // Page-change from PdfViewer → insights for that page
  const onPageInfo = useCallback(async ({ file, page }) => {
    cur.current = { file, page };
    await fetchAutoInsightsWithRetry(file, page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Selection-driven related search (kept — optional feature)
  const onSelectionText = useCallback(async (text, { file, page }) => {
    const sel = (text || "").trim();
    setSelectionText(sel);
    setRelated([]);
    setRelHint("");

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
      console.error("[App] related error", e);
      setRelated([]);
      setRelHint("Couldn't fetch related results. Is the backend running?");
    } finally {
      setRelBusy(false);
    }
  }, []);

  return (
    <div className="app-root">
      <Header onLoadDemo={loadDemo} />

      <main className="layout">
        <aside className="sidebar">
          {/* Single Insights card: auto + manual in one place */}
          <section className="card">
            <h3 className="card-title">Insights</h3>

            <button
              className="btn"
              onClick={() => {
                const name = getNameFromUrl(currentUrl);
                const text = selectionText?.trim();
                if (text) {
                  // Generate insights on selection
                  fetchAutoInsightsWithRetry(name, cur.current?.page || 1, 1, 500, text);
                } else {
                  // Default: generate on current page
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

          {/* Related sections kept (optional) */}
          <section className="card">
            <h3 className="card-title">Related sections</h3>
            <RelatedPanel items={related} lastSel={selectionText} busy={relBusy} hint={relHint} />
          </section>

          {/* Selection card removed */}

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
