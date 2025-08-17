//with this adobe api works and pdf openes
// import { useEffect } from "react";

// export default function PdfViewer() {
//   useEffect(() => {
//     const init = () => {
//       const clientId = import.meta.env.VITE_ADOBE_EMBED_API_KEY;
//       if (!clientId) {
//         console.error("Missing VITE_ADOBE_EMBED_API_KEY in frontend/.env (restart dev server after setting).");
//         return;
//       }
//       const view = new window.AdobeDC.View({
//         clientId,
//         divId: "adobe-dc-view",
//       });
//       const url = window.location.origin + "/sample.pdf";
//       view.previewFile(
//         { content: { location: { url } }, metaData: { fileName: "sample.pdf" } },
//         { embedMode: "SIZED_CONTAINER", defaultViewMode: "FIT_PAGE" }
//       ).catch((e) => {
//         console.error("Local failed, using brochure:", e);
//         view.previewFile(
//           {
//             content: { location: { url: "https://documentcloud.adobe.com/view-sdk-demo/PDFs/Bodea%20Brochure.pdf" } },
//             metaData: { fileName: "Bodea.pdf" },
//           },
//           { embedMode: "SIZED_CONTAINER", defaultViewMode: "FIT_PAGE" }
//         );
//       });
//     };

//     if (window.AdobeDC) init();
//     else document.addEventListener("adobe_dc_view_sdk.ready", init);

//     return () => document.removeEventListener("adobe_dc_view_sdk.ready", init);
//   }, []);

//   return <div id="adobe-dc-view" style={{ height: "85vh", width: "100%" }} />;
// }







// import { useEffect, useRef, useState } from "react";

// export default function PdfViewer({ fileUrl = "/sample.pdf" }) {
//   const statusRef = useRef(null);
//   const [ready, setReady] = useState(false);

//   const log = (msg) => {
//     console.log(msg);
//     if (statusRef.current) {
//       statusRef.current.textContent += `\n${msg}`;
//     }
//   };

//   useEffect(() => {
//     const clientId = import.meta.env.VITE_ADOBE_EMBED_API_KEY;
//     if (!clientId) {
//       log("❌ Missing VITE_ADOBE_EMBED_API_KEY in frontend/.env (restart dev server after setting).");
//       return;
//     } else {
//       log("✅ Client ID present.");
//     }

//     const init = () => {
//       if (!window.AdobeDC) {
//         log("❌ window.AdobeDC not available.");
//         return;
//       }
//       log("✅ AdobeDC SDK available. Initializing viewer…");

//       const view = new window.AdobeDC.View({
//         clientId,
//         divId: "adobe-dc-view",
//       });

//       const absoluteUrl = new URL(fileUrl, window.location.origin).toString();
//       log("🔗 Trying to load: " + absoluteUrl);

//       view
//         .previewFile(
//           {
//             content: { location: { url: absoluteUrl } },
//             metaData: { fileName: absoluteUrl.split("/").pop() || "document.pdf" },
//           },
//           {
//             embedMode: "SIZED_CONTAINER",
//             defaultViewMode: "FIT_PAGE",
//             showDownloadPDF: false,
//             showPrintPDF: false,
//             showAnnotationTools: false,
//           }
//         )
//         .then(() => {
//           log("✅ previewFile success.");
//           setReady(true);
//         })
//         .catch((e) => {
//           log("⚠️ previewFile failed, trying fallback… " + (e?.message || e));
//           view
//             .previewFile(
//               {
//                 content: {
//                   location: {
//                     url: "https://documentcloud.adobe.com/view-sdk-demo/PDFs/Bodea%20Brochure.pdf",
//                   },
//                 },
//                 metaData: { fileName: "Bodea-Brochure.pdf" },
//               },
//               { embedMode: "SIZED_CONTAINER", defaultViewMode: "FIT_PAGE" }
//             )
//             .then(() => {
//               log("✅ Fallback brochure loaded.");
//               setReady(true);
//             })
//             .catch((err) => log("❌ Fallback also failed: " + (err?.message || err)));
//         });
//     };

//     if (window.AdobeDC) init();
//     else document.addEventListener("adobe_dc_view_sdk.ready", init);

//     return () => document.removeEventListener("adobe_dc_view_sdk.ready", init);
//   }, [fileUrl]);

//   return (
//     <div>
//       <div id="adobe-dc-view" style={{ height: "85vh", width: "100%", border: "1px solid #ddd", borderRadius: 8 }} />
//       {!ready && (
//         <pre
//           ref={statusRef}
//           style={{
//             marginTop: 8,
//             padding: 12,
//             background: "#fff7ed",
//             border: "1px solid #fed7aa",
//             borderRadius: 8,
//             fontSize: 12,
//             whiteSpace: "pre-wrap",
//           }}
//         >
// {`🛠 Debug:
// - Ensuring SDK script loaded
// - Checking env key
// - Trying to load /sample.pdf then fallback brochure…`}
//         </pre>
//       )}
//     </div>
//   );
// }




// import { useEffect, useRef } from "react";

// export default function PdfViewer({ fileUrl = "/sample.pdf", onSelectionText }) {
//   const containerRef = useRef(null);

//   function extractTextFromSelection(selObj) {
//     // Try several shapes Adobe returns
//     try {
//       // 1) Newer shape: selObj.selection = [{text: "..."}]
//       if (Array.isArray(selObj?.selection)) {
//         const t = selObj.selection.map(s => s?.text || s?.Text || "").join(" ");
//         if (t.trim()) return t;
//       }
//       // 2) Elements shape: selObj.elements = [{Text: "..."}]
//       if (Array.isArray(selObj?.elements)) {
//         const t = selObj.elements.map(e => e?.Text || e?.text || "").join(" ");
//         if (t.trim()) return t;
//       }
//       // 3) selObj.selectedContent = [{Text: "..."}]
//       if (Array.isArray(selObj?.selectedContent)) {
//         const t = selObj.selectedContent.map(e => e?.Text || e?.text || "").join(" ");
//         if (t.trim()) return t;
//       }
//       // 4) Fallback to selObj.text
//       if (typeof selObj?.text === "string" && selObj.text.trim()) return selObj.text;
//       // 5) Nothing usable
//       return "";
//     } catch {
//       return "";
//     }
//   }

//   useEffect(() => {
//     const init = () => {
//       const clientId = import.meta.env.VITE_ADOBE_EMBED_API_KEY;
//       const view = new window.AdobeDC.View({ clientId, divId: "adobe-dc-view" });

//       const absoluteUrl = new URL(fileUrl, window.location.origin).toString();
//       view.previewFile(
//         {
//           content: { location: { url: absoluteUrl } },
//           metaData: { fileName: absoluteUrl.split("/").pop() || "document.pdf" },
//         },
//         { embedMode: "SIZED_CONTAINER", defaultViewMode: "FIT_PAGE" }
//       );

//       view.registerCallback(
//         window.AdobeDC.View.Enum.CallbackType.EVENT_LISTENER,
//         (event) => {
//           if (event.type === "SELECTION_END") {
//             view.getAPIs().then((apis) => {
//               apis.getSelectedContent()
//                 .then((sel) => {
//                   const text = extractTextFromSelection(sel).trim();
//                   console.log("[Adobe selection raw]", sel);
//                   console.log("[Adobe selection text]", text);
//                   if (text) {
//                     const clipped = text.slice(0, 200);
//                     onSelectionText?.(clipped);
//                   } else {
//                     // still call with something tiny so you see *some* response
//                     onSelectionText?.("test");
//                   }
//                 })
//                 .catch((err) => console.error("getSelectedContent error:", err));
//             });
//           }
//         },
//         { enablePDFAnalytics: false }
//       );
//     };

//     if (window.AdobeDC) init();
//     else document.addEventListener("adobe_dc_view_sdk.ready", init);
//     return () => document.removeEventListener("adobe_dc_view_sdk.ready", init);
//   }, [fileUrl, onSelectionText]);

//   return <div id="adobe-dc-view" ref={containerRef} style={{ height: "85vh", width: "100%" }} />;
// }









// import { useEffect } from "react";

// export default function PdfViewer({ fileUrl = "/sample.pdf", onSelectionText }) {
//   function getTextFromSelection(selObj) {
//     try {
//       if (Array.isArray(selObj?.selection)) {
//         const t = selObj.selection.map(s => s?.text || s?.Text || "").join(" ");
//         if (t.trim()) return t;
//       }
//       if (Array.isArray(selObj?.elements)) {
//         const t = selObj.elements.map(e => e?.Text || e?.text || "").join(" ");
//         if (t.trim()) return t;
//       }
//       if (Array.isArray(selObj?.selectedContent)) {
//         const t = selObj.selectedContent.map(e => e?.Text || e?.text || "").join(" ");
//         if (t.trim()) return t;
//       }
//       if (typeof selObj?.text === "string" && selObj.text.trim()) return selObj.text;
//       return "";
//     } catch {
//       return "";
//     }
//   }

//   useEffect(() => {
//     const init = () => {
//       const clientId = import.meta.env.VITE_ADOBE_EMBED_API_KEY;
//       if (!clientId) {
//         console.error("Missing VITE_ADOBE_EMBED_API_KEY");
//         return;
//       }
//       const view = new window.AdobeDC.View({ clientId, divId: "adobe-dc-view" });

//       const absoluteUrl = fileUrl.startsWith("http")
//         ? fileUrl
//         : new URL(fileUrl, window.location.origin).toString();

//       view.previewFile(
//         {
//           content: { location: { url: absoluteUrl } },
//           metaData: { fileName: absoluteUrl.split("/").pop() || "document.pdf" },
//         },
//         {
//           embedMode: "SIZED_CONTAINER",
//           defaultViewMode: "FIT_PAGE",
//           showDownloadPDF: false,
//           showPrintPDF: false,
//           showAnnotationTools: false,
//         }
//       );

//       view.registerCallback(
//         window.AdobeDC.View.Enum.CallbackType.EVENT_LISTENER,
//         (event) => {
//           if (event.type === "SELECTION_END") {
//             view.getAPIs().then((apis) => {
//               apis.getSelectedContent()
//                 .then((sel) => {
//                   const text = getTextFromSelection(sel).trim();
//                   if (text) onSelectionText?.(text.slice(0, 500));
//                 })
//                 .catch((err) => console.error("getSelectedContent error:", err));
//             });
//           }
//         },
//         { enablePDFAnalytics: false }
//       );
//     };

//     if (window.AdobeDC) init();
//     else document.addEventListener("adobe_dc_view_sdk.ready", init);
//     return () => document.removeEventListener("adobe_dc_view_sdk.ready", init);
//   }, [fileUrl, onSelectionText]);

//   return <div id="adobe-dc-view" className="h-[85vh] w-full" />;
// }













import { useEffect } from "react";

export default function PdfViewer({ fileUrl = "/sample.pdf", onSelectionText }) {
  useEffect(() => {
    const init = () => {
      const clientId = import.meta.env.VITE_ADOBE_EMBED_API_KEY;
      if (!clientId) {
        console.error("[PDF] Missing VITE_ADOBE_EMBED_API_KEY");
        return;
      }

      const view = new window.AdobeDC.View({ clientId, divId: "adobe-dc-view" });

      const absoluteUrl = fileUrl.startsWith("http")
        ? fileUrl
        : new URL(fileUrl, window.location.origin).toString();

      view.previewFile(
        {
          content: { location: { url: absoluteUrl } },
          metaData: { fileName: absoluteUrl.split("/").pop() || "document.pdf" },
        },
        {
          embedMode: "SIZED_CONTAINER",
          defaultViewMode: "FIT_PAGE",
          showDownloadPDF: false,
          showPrintPDF: false,
          showAnnotationTools: false,
        }
      );

      const CB = window.AdobeDC.View.Enum.CallbackType.EVENT_LISTENER;
      const EVT = window.AdobeDC.View.Enum.Events;

      view.registerCallback(
        window.AdobeDC.View.Enum.CallbackType.EVENT_LISTENER,
        (event) => {
          // Preferred path (if SDK exposes it) — NEVER crash if absent
          const canGetAPIs = typeof view.getAPIs === "function";

          if ((event?.type === EVT.SELECTION_END || event?.type === "SELECTION_END") && canGetAPIs) {
            view.getAPIs().then((apis) => {
              if (!apis?.getSelectedContent) return;
              apis.getSelectedContent().then((sel) => {
                // Try common shapes
                const pieces = []
                  .concat(sel?.selection ?? [])
                  .map((s) => s?.text ?? s?.Text ?? "")
                  .filter(Boolean);
                const text =
                  (pieces.length ? pieces.join(" ") : "") ||
                  (Array.isArray(sel?.elements) ? sel.elements.map(e => e?.Text ?? e?.text ?? "").join(" ") : "") ||
                  (typeof sel?.text === "string" ? sel.text : "");
                if (text?.trim()) onSelectionText?.(text.trim().slice(0, 500));
              });
            });
          }

          // Fallback that works in your environment:
          // When the user clicks the Copy bubble (or presses Ctrl/Cmd+C),
          // Adobe emits TEXT_COPY with the actual selected text.
          if (event?.type === window.AdobeDC.View.Enum.Events.TEXT_COPY || event?.type === "TEXT_COPY") {
            console.log("[PDF] TEXT_COPY payload:", event?.data);  // should show copiedText
            const t = (event?.data?.copiedText || "").trim();
            if (t) onSelectionText?.(t.slice(0, 500));
          }
        },
        { enablePDFAnalytics: true } // more events available
      );
    };

    if (window.AdobeDC) init();
    else document.addEventListener("adobe_dc_view_sdk.ready", init);
    return () => document.removeEventListener("adobe_dc_view_sdk.ready", init);
  }, [fileUrl, onSelectionText]);

  return <div id="adobe-dc-view" className="h-[85vh] w-full" />;
}
