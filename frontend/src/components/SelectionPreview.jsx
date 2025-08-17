export default function SelectionPreview({ text }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white/90 shadow-sm">
      <div className="px-4 py-3 border-b">
        <h3 className="font-semibold text-gray-800">Selection</h3>
      </div>
      <div className="p-4 text-sm text-gray-700">
        {text ? (
          <div className="whitespace-pre-wrap">{text}</div>
        ) : (
          <p className="text-gray-500">Select some text in the PDF…</p>
        )}
      </div>
    </div>
  );
}