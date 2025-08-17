import { useCallback, useRef, useState } from "react";
import PdfViewer from "./components/PdfViewer";
import UploadPanel from "./components/UploadPanel";
import LibraryPanel from "./components/LibraryPanel";
import SelectionPreview from "./components/SelectionPreview";
import RelatedPanel from "./components/RelatedPanel";
import InsightsBulb from "./components/InsightsBulb";
import "./App.css";

const API_BASE = "http://localhost:5001";

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

  // Related panel
  const [selectionText, setSelectionText] = useState("");
  const [related, setRelated] = useState([]);
  const [relBusy, setRelBusy] = useState(false);
  const [relHint, setRelHint] = useState("Select some text in the PDF to see related results.");

  // Insights panel
  const [insights, setInsights] = useState(null);
  const [insBusy, setInsBusy] = useState(false);

  // track current
  const cur = useRef({ file: "", page: 1 });

  const loadDemo = () => {
    setCurrentUrl("https://documentcloud.adobe.com/view-sdk-demo/PDFs/Bodea%20Brochure.pdf");
  };

  const handleUploaded = (name) => {
    if (name) setCurrentUrl(`${API_BASE}/api/file/${encodeURIComponent(name)}`);
    setRefreshFlag((x) => x + 1);
  };

  // Auto insights on page change
  const onPageInfo = useCallback(async ({ file, page }) => {
    cur.current = { file, page };
    console.log("[App] onPageInfo ->", file, page);

    setInsBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/auto/insights`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file, page }),
      });
      const data = await res.json().catch(() => ({}));
      console.log("[App] /auto/insights ->", data);
      setInsights(data.insights || null);
    } catch (e) {
      console.error("[App] insights error", e);
      setInsights(null);
    } finally {
      setInsBusy(false);
    }

    // reset related until user selects
    setSelectionText("");
    setRelated([]);
    setRelHint("Select some text in the PDF to see related results.");
  }, []);

  // Selection-driven related
  const onSelectionText = useCallback(async (text, { file, page }) => {
    const sel = (text || "").trim();
    console.log("[App] onSelectionText ->", sel.slice(0, 80), "...");
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
      console.log("[App] /related ->", data);
      setRelated(data.results || []);
      if (!data.results?.length) setRelHint("No related results found for that selection.");
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
          <section className="card">
            <h3 className="card-title">Related sections</h3>
            <RelatedPanel items={related} lastSel={selectionText} busy={relBusy} hint={relHint} />
          </section>

          <section className="card">
            <h3 className="card-title">Insights Bulb</h3>
            <InsightsBulb data={insights} loading={insBusy} />
          </section>

          <section className="card">
            <h3 className="card-title">Selection</h3>
            <SelectionPreview text={selectionText || "Select some text in the PDF..."} />
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
