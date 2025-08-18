import { useEffect, useMemo, useRef, useState } from "react";

const KEY = import.meta.env.VITE_ADOBE_EMBED_KEY || "";

/**
 * Props:
 *  - fileUrl: string
 *  - onPageInfo?: ({file, page}) => void
 *  - onSelectionText?: (text: string, info: {file: string, page: number}) => void
 */
export default function PdfViewer({ fileUrl, onPageInfo, onSelectionText }) {
  const hostRef = useRef(null);
  const viewRef = useRef(null);
  const apisRef = useRef(null);
  const divIdRef = useRef(`adobe-dc-view-${Math.random().toString(36).slice(2)}`);

  // idle | loading | ready | no_key | no_sdk | no_url | error
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

  useEffect(() => {
    setLastError("");
    if (!fileUrl) { setStatus("no_url"); return; }
    if (!KEY) { setStatus("no_key"); return; }

    const mount = async () => {
      if (!hostRef.current) return;
      if (!(window.AdobeDC && window.AdobeDC.View)) { setStatus("no_sdk"); return; }

      try {
        setStatus("loading");

        // Reset container
        hostRef.current.innerHTML = "";
        const inner = document.createElement("div");
        inner.id = divIdRef.current;
        inner.style.position = "absolute";
        inner.style.inset = "0";
        inner.style.width = "100%";
        inner.style.height = "100%";
        hostRef.current.appendChild(inner);

        // Create viewer
        const view = new window.AdobeDC.View({ clientId: KEY, divId: divIdRef.current });
        viewRef.current = view;

        // Start preview
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

        // One listener for multiple events
        view.registerCallback(
          window.AdobeDC.View.Enum.CallbackType.EVENT_LISTENER,
          async (event) => {
            try {
              switch (event.type) {
                // Any of these means the viewer is usable -> clear "Loading…"
                case "APP_RENDERING_DONE":
                case "APP_RENDERED":
                case "DOCUMENT_OPEN":
                case "DOCUMENT_LOADED":
                case "PAGES_RENDERED":
                case "PAGE_VIEW":
                  setStatus("ready");
                  // fire initial/updated page info
                  if (onPageInfo && apisRef.current?.getPageRange) {
                    const range = await apisRef.current.getPageRange();
                    const page = Array.isArray(range) && range.length ? range[0] : 1;
                    onPageInfo({ file: fileName, page });
                  }
                  break;

                // Some SDK builds emit this for page changes
                case "PAGES_IN_VIEW_CHANGE": {
                  if (onPageInfo && apisRef.current?.getPageRange) {
                    const range = await apisRef.current.getPageRange();
                    const page = Array.isArray(range) && range.length ? range[0] : 1;
                    onPageInfo({ file: fileName, page });
                  }
                  break;
                }

                // Text selection complete
                case "PREVIEW_SELECTION_END": {
                  if (!onSelectionText || !apisRef.current?.getSelectedContent) break;
                  const sel = await apisRef.current.getSelectedContent();
                  const groups = sel?.data || sel?.selectedContent || sel?.selections || [];
                  const fromGroups = groups
                    .flatMap((g) =>
                      Array.isArray(g?.items)
                        ? g.items.map((it) => it?.str || it?.text || it?.content || "")
                        : [g?.text || g?.Str || g?.str || g?.content || ""]
                    )
                    .filter(Boolean);
                  const fallback = (sel?.text && [sel.text]) || (sel?.content && [sel.content]) || [];
                  const text = [...fromGroups, ...fallback].join(" ").replace(/\s+/g, " ").trim();

                  let page = 1;
                  try {
                    const range = await apisRef.current.getPageRange();
                    page = Array.isArray(range) && range.length ? range[0] : 1;
                  } catch {}
                  if (text) onSelectionText(text, { file: fileName, page });
                  break;
                }

                default:
                  break;
              }
            } catch (e) {
              console.warn("[Adobe EVENT_LISTENER] handler error:", e);
            }
          },
          {
            enableFilePreviewEvents: true,
            listenOn: [
              FP.APP_RENDERING_DONE,
              FP.DOCUMENT_OPEN,
              FP.PAGES_IN_VIEW_CHANGE,
              FP.PREVIEW_SELECTION_END,
              // extra events that help clear the overlay reliably
              FP.APP_RENDERED,
              FP.DOCUMENT_LOADED,
              FP.PAGES_RENDERED,
              FP.PAGE_VIEW,
            ],
          }
        );

        // Safety timeout: if events don’t fire, clear overlay anyway
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
}
