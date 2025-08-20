import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";

// const KEY = import.meta.env.VITE_ADOBE_EMBED_KEY || "";
const KEY =
  (typeof window !== "undefined" && window.__CONFIG?.ADOBE_EMBED_API_KEY) ||
  import.meta.env.VITE_ADOBE_EMBED_KEY ||
  "";

/**
 * Props:
 *  - fileUrl: string
 *  - onPageInfo?: ({file, page}) => void
 *  - onSelectionText?: (text: string, info: {file: string, page: number}) => void
 */
const PdfViewer = forwardRef(function PdfViewer({ fileUrl, onPageInfo, onSelectionText }, ref) {
  const hostRef = useRef(null);
  const viewRef = useRef(null);
  const apisRef = useRef(null);
  const divIdRef = useRef(`adobe-dc-view-${Math.random().toString(36).slice(2)}`);

  const [status, setStatus] = useState("idle");
  const [lastError, setLastError] = useState("");
  const safetyTimerRef = useRef(null);

  const fileName = useMemo(() => {
    if (!fileUrl) return "";
    try {
      const raw = fileUrl.split("/api/file/")[1] || "";
      return decodeURIComponent(raw.split("#")[0] || "").trim() || "document.pdf";
    } catch {
      return "document.pdf";
    }
  }, [fileUrl]);

  // Expose “goToPage” to parents; try several Adobe API variants
  useImperativeHandle(ref, () => ({
    goToPage: async (page) => {
      const apis = apisRef.current;
      if (!apis) return false;
      const p = Number(page) || 1;

      try {
        if (typeof apis.gotoLocation === "function") {
          try { await apis.gotoLocation(p); return true; } catch {}
          try { await apis.gotoLocation({ pageNumber: p }); return true; } catch {}
        }
        if (typeof apis.setCurrentPage === "function") {
          await apis.setCurrentPage(p); return true;
        }
        if (typeof apis.scrollToPage === "function") {
          await apis.scrollToPage(p); return true;
        }
      } catch (e) {
        console.warn("[PdfViewer] goToPage failed:", e);
      }
      console.warn("[PdfViewer] No working navigation API in this SDK build.");
      return false;
    },
  }));

  useEffect(() => {
    setLastError("");
    if (!fileUrl) { setStatus("no_url"); return; }
    if (!KEY) { setStatus("no_key"); return; }

    const mount = async () => {
      if (!hostRef.current) return;
      if (!(window.AdobeDC && window.AdobeDC.View)) { setStatus("no_sdk"); return; }

      try {
        setStatus("loading");

        hostRef.current.innerHTML = "";
        const inner = document.createElement("div");
        inner.id = divIdRef.current;
        inner.style.position = "absolute";
        inner.style.inset = "0";
        inner.style.width = "100%";
        inner.style.height = "100%";
        hostRef.current.appendChild(inner);

        const view = new window.AdobeDC.View({ clientId: KEY, divId: divIdRef.current });
        viewRef.current = view;

        const preview = view.previewFile(
          { content: { location: { url: fileUrl } }, metaData: { fileName } },
          {
            embedMode: "SIZED_CONTAINER",
            defaultViewMode: "FIT_WIDTH",
            showLeftHandPanel: false,
            dockPageControls: true,
            showDownloadPDF: true,
            showPrintPDF: true,
          }
        );

        const viewer = await preview;
        const apis = await viewer.getAPIs();
        apisRef.current = apis;

        const FP = window.AdobeDC.View.Enum.FilePreviewEvents;

        const extractText = (payload) => {
          if (!payload) return "";
          if (typeof payload === "string") return payload;
          const arr = payload.selectedContent || payload.selections || payload.data || payload.items || null;
          if (Array.isArray(arr)) {
            return arr
              .flatMap((g) =>
                Array.isArray(g?.items)
                  ? g.items.map((it) => it?.str || it?.text || it?.content || "")
                  : [g?.text || g?.Str || g?.str || g?.content || ""]
              )
              .filter(Boolean)
              .join(" ");
          }
          return (payload.text || payload.content || "").toString();
        };

        view.registerCallback(
          window.AdobeDC.View.Enum.CallbackType.EVENT_LISTENER,
          async (event) => {
            try {
              const ready = [
                FP.APP_RENDERING_DONE,
                FP.APP_RENDERED,
                FP.DOCUMENT_OPEN,
                FP.DOCUMENT_LOADED,
                FP.PAGES_RENDERED,
                FP.PAGE_VIEW,
                FP.PAGES_IN_VIEW_CHANGE,
              ];
              if (ready.includes(event.type)) {
                setStatus("ready");
                if (onPageInfo && apisRef.current?.getPageRange) {
                  const range = await apisRef.current.getPageRange();
                  const page = Array.isArray(range) && range.length ? range[0] : 1;
                  onPageInfo({ file: fileName, page });
                }
              }

              if (event.type === FP.PREVIEW_SELECTION_END) {
                if (!onSelectionText) return;

                let text = extractText(event?.data || event?.detail || "");
                if (!text && apisRef.current?.getSelectedContent) {
                  try {
                    const sel = await apisRef.current.getSelectedContent();
                    text =
                      extractText(sel) ||
                      extractText(sel?.data) ||
                      extractText(sel?.selectedContent) ||
                      "";
                  } catch {}
                }
                text = (text || "").replace(/\s+/g, " ").trim();

                let page = 1;
                try {
                  const range = await apisRef.current.getPageRange();
                  page = Array.isArray(range) && range.length ? range[0] : 1;
                } catch {
                  const d = event?.data || event?.detail || {};
                  page = d?.pageNumber || d?.page || 1;
                }

                if (text) onSelectionText(text, { file: fileName, page });
              }
            } catch (e) {
              console.warn("[Adobe EVENT_LISTENER] handler error:", e);
            }
          },
          {
            enableFilePreviewEvents: true,
            listenOn: [
              FP.APP_RENDERING_DONE,
              FP.APP_RENDERED,
              FP.DOCUMENT_OPEN,
              FP.DOCUMENT_LOADED,
              FP.PAGES_RENDERED,
              FP.PAGE_VIEW,
              FP.PAGES_IN_VIEW_CHANGE,
              FP.PREVIEW_SELECTION_END,
            ],
          }
        );

        if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
        safetyTimerRef.current = setTimeout(() => setStatus("ready"), 2000);
      } catch (e) {
        console.error("[PdfViewer] mount error", e);
        setLastError(String(e?.message || e));
        setStatus("error");
      }
    };

    if (window.AdobeDC?.View) {
      mount();
    } else {
      const onReady = () => mount();
      document.addEventListener("adobe_dc_view_sdk.ready", onReady, { once: true });
      return () => document.removeEventListener("adobe_dc_view_sdk.ready", onReady);
    }

    return () => {
      if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
    };
  }, [fileUrl, fileName, onPageInfo, onSelectionText]);

  if (!fileUrl) {
    return <div className="pdf-container" style={{ display: "grid", placeItems: "center" }}>No document loaded.</div>;
  }

  return (
    <div className="pdf-container" style={{ position: "relative" }}>
      <div
        ref={hostRef}
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          touchAction: "pan-y pinch-zoom",
          overscrollBehavior: "contain",
        }}
      />
      {status !== "ready" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            pointerEvents: "none",
            zIndex: 2,
          }}
        >
          <div
            style={{
              background: "rgba(255,255,255,0.9)",
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              padding: "10px 14px",
              fontSize: 13,
              color: "#374151",
            }}
          >
            {status === "loading" && "Loading PDF…"}
            {status === "no_url" && "No document loaded."}
            {status === "no_key" && "VITE_ADOBE_EMBED_KEY missing."}
            {status === "no_sdk" && "Adobe SDK not loaded (check index.html script)."}
            {status === "error" && `Adobe viewer error. ${lastError || ""}`}
          </div>
        </div>
      )}
    </div>
  );
});

export default PdfViewer;
