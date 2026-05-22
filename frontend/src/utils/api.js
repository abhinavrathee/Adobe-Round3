const API_BASE = import.meta.env.VITE_API_BASE || "";

export async function fetchInsights({ selectionText }) {
  const res = await fetch(`${API_BASE}/api/insights`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ selection_text: selectionText }),
  });
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
