// frontend/src/Landing.jsx
import "./App.css";

export default function Landing({ onEnter }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Top bar */}
      <header className="app-header">
        <a className="brand" href="#" onClick={(e) => e.preventDefault()}>
          <div className="logo">DI</div>
          <div>
            <h1 className="title">AcroLens — See beyond the pages</h1>
            <p className="subtitle">Document Insight & Engagement</p>
          </div>
        </a>
        <div className="header-actions">
          <span className="pill"><span className="dot" /> Beta</span>
        </div>
      </header>

      {/* Hero */}
      <main style={{ flex: 1, display: "grid", placeItems: "center", padding: 24 }}>
        <section
          className="card"
          style={{
            maxWidth: 860,
            width: "100%",
            textAlign: "center",
            padding: 28,
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))",
          }}
        >
          <div style={{ fontSize: 56, marginBottom: 8 }}>🧭</div>
          <h2 style={{ margin: "0 0 8px 0", fontSize: 28, fontWeight: 900 }}>
            Understand PDFs in minutes — not hours
          </h2>
          <p className="muted" style={{ margin: "0 auto 18px", maxWidth: 640 }}>
            Drop in a PDF and get instant <b>insights</b>, <b>related sections</b> across your
            library, and a narrated <b>podcast-style overview</b>. Built with Adobe PDF Embed,
            FastAPI, and on-device indexing — no random internet knowledge.
          </p>

          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              className="btn btn-primary"
              onClick={onEnter}
              style={{
                padding: "12px 16px",
                borderRadius: 999,
                fontWeight: 900,
              }}
            >
              Open the App
            </button>
            <a
              className="btn btn-ghost"
              href="https://adobe.com" target="_blank" rel="noreferrer"
              style={{ padding: "12px 16px", borderRadius: 999 }}
            >
              Learn about PDF Embed
            </a>
          </div>
        </section>

        {/* Feature grid */}
        <section style={{ marginTop: 22, width: "100%", maxWidth: 980 }}>
          <div
            className="related-list"
            style={{
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            }}
          >
            <Feature
              title="Smart Insights"
              desc="Concise bullets per page or selection: key ideas, facts, connections, counterpoints, and questions."
              badge="Round 1A/1B ready"
            />
            <Feature
              title="Related Sections"
              desc="Semantic search links passages across your entire library — open the right page in one click."
              badge="Local index • TF-IDF + fuzz"
            />
            <Feature
              title="Podcast Mode"
              desc="Generate a 2–5 minute narrated overview using your choice of TTS provider and voice."
              badge="GCP TTS • Azure • Local"
            />
            <Feature
              title="Privacy-First"
              desc="Your PDFs are indexed locally; we avoid unrelated external knowledge for grounded results."
              badge="No data leakage"
            />
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer style={{ textAlign: "center", padding: 16, opacity: 0.8 }}>
        <small className="muted">© {new Date().getFullYear()} AcroLens • Adobe India Hackathon</small>
      </footer>
    </div>
  );
}

function Feature({ title, desc, badge }) {
  return (
    <div className="related-item" style={{ background: "rgba(21,28,47,0.55)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ fontWeight: 800 }}>{title}</div>
        {badge && <span className="badge">{badge}</span>}
      </div>
      <div className="muted" style={{ lineHeight: 1.5 }}>{desc}</div>
    </div>
  );
}
