import { useEffect, useMemo, useRef } from "react";

const KEY = import.meta.env.VITE_ADOBE_EMBED_KEY || "";

/**
 * Props:
 *  - fileUrl: string
 *  - onPageInfo?: ({file, page}) => void
 *  - onSelectionText?: (text: string, info: {file: string, page: number}) => void
 */
export default function PdfViewer({ fileUrl, onPageInfo, onSelectionText }) {
  const adobeRef = useRef(null);

  const fileName = useMemo(() => {
    if (!fileUrl) return "";
    try {
      const raw = fileUrl.split("/api/file/")[1] || "";
      return decodeURIComponent(raw.split("#")[0] || "").trim();
    } catch {
      return "";
    }
  }, [fileUrl]);

  const nativeUrl = useMemo(() => {
    if (!fileUrl) return "";
    const hint = "#view=FitH&zoom=page-width";
    return fileUrl.includes("#") ? fileUrl : `${fileUrl}${hint}`;
  }, [fileUrl]);

  useEffect(() => {
    const mount = () => {
      const host = adobeRef.current;
      if (!host || !fileUrl || !KEY) return;

      try {
        host.innerHTML = "";
        if (!window.AdobeDC || !window.AdobeDC.View) return;

        console.log("[PdfViewer] initializing Adobe View", { fileUrl, fileName });
        const view = new window.AdobeDC.View({ clientId: KEY, divId: "adobe-dc-view" });

        view.previewFile(
          {
            content: { location: { url: fileUrl } },
            metaData: { fileName: fileName || "document.pdf" },
          },
          {
            embedMode: "SIZED_CONTAINER",
            defaultViewMode: "FIT_WIDTH",
            showLeftHandPanel: false,
            dockPageControls: true,
            showDownloadPDF: true,
            showPrintPDF: true,
          }
        );

        const notifyPage = async (label = "") => {
          try {
            const range = await view.getPageRange();
            const page = Array.isArray(range) && range.length ? range[0] : 1;
            console.log(`[PdfViewer] ${label} page=`, page);
            onPageInfo && onPageInfo({ file: fileName, page });
          } catch (e) {
            console.warn("[PdfViewer] getPageRange error", e);
          }
        };

        // Fire on load + page changes
        view.registerCallback(
          window.AdobeDC.View.Enum.CallbackType.DOCUMENT_LOADED,
          () => notifyPage("DOCUMENT_LOADED"),
          {}
        );
        view.registerCallback(
          window.AdobeDC.View.Enum.CallbackType.PAGES_IN_VIEW_CHANGE,
          () => notifyPage("PAGES_IN_VIEW_CHANGE"),
          {}
        );

        // Robustly read selection text from Adobe payload
        const extractText = (payload) => {
          // Known shapes: selectedContent: [{text}], selections: [{text}], data: [{items:[{str}]}]
          const groups =
            payload?.selectedContent ||
            payload?.selections ||
            payload?.data ||
            [];

          const fromGroups = groups
            .flatMap((g) => {
              if (Array.isArray(g?.items)) {
                return g.items.map((it) => it?.str || it?.text || it?.content || "");
              }
              return [g?.text || g?.Str || g?.str || g?.content || ""];
            })
            .filter(Boolean);

          // Fallback for some builds:
          const fallback =
            (payload?.text && [payload.text]) ||
            (payload?.content && [payload.content]) ||
            [];

          const text = [...fromGroups, ...fallback].join(" ").replace(/\s+/g, " ").trim();
          return text;
        };

        // On selection end
        view.registerCallback(
          window.AdobeDC.View.Enum.CallbackType.SELECTION_END,
          async (evt) => {
            try {
              console.log("[PdfViewer] SELECTION_END raw evt:", evt);
              const sel = await view.getSelectedContent();
              console.log("[PdfViewer] getSelectedContent() ->", sel);

              const text = extractText(sel);
              let page = 1;
              try {
                const range = await view.getPageRange();
                page = Array.isArray(range) && range.length ? range[0] : 1;
              } catch {}

              console.log("[PdfViewer] selection text:", text, "page:", page);
              if (text && onSelectionText) onSelectionText(text, { file: fileName, page });
            } catch (e) {
              console.warn("[PdfViewer] selection handler error", e);
            }
          },
          {}
        );
      } catch (e) {
        console.error("[PdfViewer] mount error", e);
      }
    };

    if (window.AdobeDC?.View) {
      mount();
    } else {
      const onReady = () => mount();
      document.addEventListener("adobe_dc_view_sdk.ready", onReady, { once: true });
      return () => document.removeEventListener("adobe_dc_view_sdk.ready", onReady);
    }
  }, [fileUrl, fileName, onPageInfo, onSelectionText]);

  if (!fileUrl) {
    return <div className="pdf-container" style={{ display: "grid", placeItems: "center" }}>No document loaded.</div>;
  }

  return (
    <div className="pdf-container" style={{ position: "relative" }}>
      <iframe className="pdf-frame" title="PDF" src={nativeUrl} />
      <div id="adobe-dc-view" ref={adobeRef} style={{ position: "absolute", inset: 0, display: KEY ? "block" : "none" }} />
    </div>
  );
}
