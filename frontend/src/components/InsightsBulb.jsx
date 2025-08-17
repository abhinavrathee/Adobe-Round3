export default function InsightsBulb({ data, loading }) {
  // data is expected to be the inner object:
  // { keyInsights, facts, contradictions, connections, questions }
  if (loading) return <p className="muted">Generating insights…</p>;
  if (!data) return <p className="muted">No insights yet.</p>;

  const normalized = {
    keyInsights: Array.isArray(data.keyInsights) ? data.keyInsights : (data.insights || []),
    facts: Array.isArray(data.facts) ? data.facts : [],
    contradictions: Array.isArray(data.contradictions) ? data.contradictions : (data.cautions || []),
    connections: Array.isArray(data.connections) ? data.connections : [],
    questions: Array.isArray(data.questions) ? data.questions : [],
  };

  const groups = [
    ["keyInsights", "Key insights"],
    ["facts", "Did you know?"],
    ["contradictions", "Contradictions / counterpoints (possible angles to consider)"],
    ["connections", "Connections"],
    ["questions", "Questions"],
  ];

  return (
    <div>
      {groups.map(([k, label]) => (
        <div key={k} style={{ marginBottom: 10 }}>
          <div className="muted" style={{ fontWeight: 700 }}>{label}</div>
          {normalized[k]?.length ? (
            <ul style={{ margin: "6px 0 0 18px" }}>
              {normalized[k].map((b, idx) => (
                <li key={idx} style={{ marginBottom: 4 }}>
                  {typeof b === "string" ? b : JSON.stringify(b)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted" style={{ margin: "4px 0 0 0" }}>—</p>
          )}
        </div>
      ))}
    </div>
  );
}
