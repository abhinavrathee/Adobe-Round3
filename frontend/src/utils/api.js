const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5001";

export async function fetchInsights({ docId, pdfName }) {
  const url = new URL(`${API_BASE}/api/insights`);
  if (docId) url.searchParams.set("doc_id", docId);
  if (pdfName) url.searchParams.set("pdf_name", pdfName);
  const res = await fetch(url.toString());
  return res.json();
}

export async function fetchRelated({ docId, pdfName, text, k = 6 }) {
  const body = { selected_text: text, k };
  if (docId) body.doc_id = docId;
  if (pdfName) body.pdf_name = pdfName;
  const res = await fetch(`${API_BASE}/api/related`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}
