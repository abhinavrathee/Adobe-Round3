export default function RelatedPanel({ items = [], lastSel = "", busy = false, hint = "" }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white/90 shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h3 className="font-semibold text-gray-800">Related sections</h3>
        {busy && <span className="text-xs text-blue-600">loading…</span>}
      </div>

      <div className="px-4 pt-3 pb-2 text-xs text-gray-500">
        {lastSel
          ? <>“{lastSel.slice(0, 100)}{lastSel.length > 100 ? "…”" : "”"}</>
          : "Copy a sentence or paragraph in the PDF to see related results."}
      </div>

      {hint && (
        <div className="px-4 pb-2">
          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            {hint}
          </div>
        </div>
      )}

      <div className="p-4 space-y-3">
        {items.map((r, i) => (
          <button
            key={i}
            className="w-full text-left rounded-xl border p-3 hover:bg-gray-50"
            title="(Jump-to-section coming next step)"
          >
            <div className="text-xs text-gray-500">
              {r.pdf_name} • p.{r.page} • {Math.round(r.score * 100)}%
            </div>
            <div className="font-semibold">{r.section_title}</div>
            <div className="text-sm text-gray-700 mt-1">{r.snippet}</div>
          </button>
        ))}

        {!items.length && !busy && !hint && (
          <p className="text-sm text-gray-500">No results yet.</p>
        )}
      </div>
    </div>
  );
}
