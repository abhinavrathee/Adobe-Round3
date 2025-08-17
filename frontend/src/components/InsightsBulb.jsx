export default function InsightsBulb({ data, loading }) {
  if (loading) return <p className="muted">Generating insights…</p>;
  if (!data) return <p className="muted">No insights yet.</p>;

  const groups = [
    ["keyInsights", "Key insights"],
    ["facts", "Did you know?"],
    ["contradictions", "Contradictions / counterpoints"],
    ["connections", "Connections across docs"],
  ];

  return (
    <div>
      {groups.map(([k, label]) => (
        <div key={k} style={{ marginBottom: 8 }}>
          <div className="muted" style={{ fontWeight: 700 }}>{label}</div>
          <ul style={{ margin: "4px 0 0 16px" }}>
            {(data[k] || []).map((b, idx) => <li key={idx}>{b}</li>)}
          </ul>
        </div>
      ))}
    </div>
  );
}
