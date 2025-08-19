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

function Header({ podcastSlot }) {
  return (
    <header className="app-header">
      <div className="brand">
        <div className="logo">DI</div>
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

  // Navigation refs
  const pdfRef = useRef(null);
  const pendingNavRef = useRef(null); // {file, page} after doc switch

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

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
        await sleep(delayMs);
      }
      setInsights(null);
      return false;
    } catch {
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

    // perform the deferred jump when a new doc loads
    const pending = pendingNavRef.current;
    if (pending && pending.file === file) {
      pendingNavRef.current = null;
      setTimeout(() => pdfRef.current?.goToPage?.(pending.page), 250);
    }

    await fetchAutoInsightsWithRetry(file, page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- index helpers ----------
  const ensureIndexedFor = useCallback(async (file) => {
    try {
      let st = await fetch(`${API_BASE}/api/index/status`).then(r => r.json());
      const inIndex = (st?.files || []).includes(file);
      const empty = !st?.chunk_count;

      if (inIndex && !empty) return true;

      // trigger build
      await fetch(`${API_BASE}/api/index/rebuild`, { method: "POST" }).catch(() => {});
      // poll a few times
      for (let i = 0; i < 8; i++) {
        await sleep(700);
        st = await fetch(`${API_BASE}/api/index/status`).then(r => r.json());
        if ((st?.files || []).includes(file) && st?.chunk_count > 0) return true;
      }
    } catch {}
    return false;
  }, []);

  // ---------- keyword sweep fallback ----------
  const STOP = useMemo(() => new Set([
    "the","a","an","and","or","of","to","in","on","for","with","that","this","those","these",
    "is","are","was","were","be","been","being","by","as","at","from","into","it","its","their",
    "we","you","your","our","they","them","he","she","his","her","i","me","my","mine","us"
  ]), []);
  const keywordify = useCallback((s) => {
    return (s || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(w => w.length >= 4 && !STOP.has(w))
      .slice(0, 6);
  }, [STOP]);

  // ---------- helpers: related (multi-pass) ----------
  const fetchRelatedSelection = useCallback(async (body) => {
    const res = await fetch(`${API_BASE}/api/related`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return data.results || data.matches || data.items || [];
  }, []);

  const fetchAutoRelated = useCallback(async (file, page) => {
    try {
      const res = await fetch(`${API_BASE}/api/auto/related`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file, page }),
      });
      const data = await res.json().catch(() => ({}));
      let items = data.results || [];
      // exclude the exact same page
      items = items.filter(
        (r) => !( (r.pdf_name || r.file || r.filename) === file &&
                 ((r.page || r.page_num || r.pageNumber) === page) )
      );
      return items;
    } catch {
      return [];
    }
  }, []);

  const uniqueMerge = (arr) => {
    const seen = new Set();
    const out = [];
    for (const r of arr) {
      const key = `${r.pdf_name || r.file || r.filename || "?"}#${r.page || r.page_num || r.pageNumber || "?"}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push(r);
      }
    }
    return out;
  };

  const runSelectionSearchCascade = useCallback(async (sel, file, page, global = false) => {
    // 0) make sure the index actually has content for this library
    await ensureIndexedFor(file);

    // 1) strict
    let items = await fetchRelatedSelection({
      selection_text: sel,
      doc_name: global ? undefined : file,
      page:     global ? undefined : page,
      k: 8,
      min_score: 0.58,
    });

    // 2) relaxed
    if (!items.length) {
      items = await fetchRelatedSelection({
        selection_text: sel,
        doc_name: global ? undefined : file,
        page:     global ? undefined : page,
        k: 12,
        min_score: 0.42,
      });
    }

    // 3) page-based fallback
    if (!items.length && !global) {
      items = await fetchAutoRelated(file, page);
    }

    // 4) keyword sweep (very relaxed) – last resort to avoid empty panel
    if (!items.length) {
      const kws = keywordify(sel);
      const bucket = [];
      for (const kw of kws) {
        const small = await fetchRelatedSelection({
          selection_text: kw,
          k: 4,
          min_score: 0.0,
        });
        bucket.push(...small);
      }
      items = uniqueMerge(bucket).slice(0, 8);
    }

    return items;
  }, [ensureIndexedFor, fetchRelatedSelection, fetchAutoRelated, keywordify]);

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
      const items = await runSelectionSearchCascade(sel, file, page, false);
      setRelated(items);
      if (!items.length) setRelHint("No related results found for that selection.");
    } catch {
      setRelated([]);
      setRelHint("Couldn't fetch related results. Is the backend running?");
    } finally {
      setRelBusy(false);
    }
  }, [runSelectionSearchCascade]);

  const onUseSelected = useCallback(async () => {
    const sel = (selectionText || "").trim();
    if (!sel) return;
    setRelated([]); setRelHint(""); setRelBusy(true);
    try {
      const items = await runSelectionSearchCascade(sel, cur.current.file || getNameFromUrl(currentUrl), cur.current.page || 1, true);
      setRelated(items);
      if (!items.length) setRelHint("No related results found for that selection.");
    } catch {
      setRelated([]); setRelHint("Couldn't fetch related results. Is the backend running?");
    } finally {
      setRelBusy(false);
    }
  }, [selectionText, currentUrl, runSelectionSearchCascade]);

  // CLICK A RELATED CARD → open page (switch docs if needed)
  const openRelated = useCallback((r) => {
    const page = r.page || r.page_num || r.pageNumber || r.metadata?.page || 1;
    const file = r.pdf_name || r.file || r.filename || r.metadata?.file || "";
    const currentName = getNameFromUrl(currentUrl);

    if (file && file !== currentName) {
      pendingNavRef.current = { file, page };
      setCurrentUrl(`${API_BASE}/api/file/${encodeURIComponent(file)}`);
      return;
    }
    pdfRef.current?.goToPage?.(page);
  }, [currentUrl]);

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
            <RelatedPanel
              items={related}
              lastSel={selectionText}
              busy={relBusy}
              hint={relHint}
              onUseSelected={onUseSelected}
              onOpen={openRelated}
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
              ref={pdfRef}
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
