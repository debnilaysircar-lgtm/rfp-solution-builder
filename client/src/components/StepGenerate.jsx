import { useMemo } from "react";

const FREQUENCY_OPTIONS = [
  "Daily",
  "Weekly",
  "Monthly",
  "Quarterly",
  "Half-yearly",
  "Annual",
  "Project-based",
  "On-demand",
];

function inferFrequency(label, path) {
  const t = ((label || "") + " " + (path || "")).toLowerCase();
  if (/\b(monitor|health|alert|backup|log|incident|24x7|24\/7|operation)\b/.test(t)) return "Daily";
  if (/\b(patch|note|kernel|transport|user|auth|access|role|housekeep)\b/.test(t)) return "Weekly";
  if (/\b(sp\b|stack|capacity|tune|performance|review|reporting)\b/.test(t)) return "Monthly";
  if (/\b(audit|drill|compliance|dr\b|disaster|bcp|sox)\b/.test(t)) return "Quarterly";
  if (/\b(upgrade|migration|implementation|setup|install|deploy)\b/.test(t)) return "Project-based";
  return "On-demand";
}

const INSTRUCTION_PRESETS = [
  "Use British English spelling and punctuation throughout.",
  "Each item must reference at least one in-scope SAP product by name.",
  "Be conservative — prefer Med/Low priorities unless evidence justifies High.",
  "Avoid the words 'GenWizard' and 'AI-Ops'.",
  "Each assumption must end with the owning party in parentheses, e.g. (Client) or (Accenture).",
  "Use a formal, contract-grade tone. No conversational hedging.",
];

export default function StepGenerate({
  meta,
  userInstructions,
  setUserInstructions,
  products,
  capabilities,
  setCapabilities,
  busy,
  setBusy,
  error,
  setError,
  output,
  setOutput,
  onBack,
}) {
  // Seed proposed frequency for any capability missing one. Defaults preserve
  // through generation; the user can override any row before clicking Generate.
  const capsWithFreq = useMemo(
    () =>
      capabilities.map((c) => ({
        ...c,
        frequency: c.frequency || inferFrequency(c.label, c.path),
      })),
    [capabilities]
  );

  function setFrequency(id, frequency) {
    setCapabilities(
      capsWithFreq.map((c) => (c.id === id ? { ...c, frequency } : c))
    );
  }

  function resetFrequencies() {
    setCapabilities(
      capsWithFreq.map((c) => ({
        ...c,
        frequency: inferFrequency(c.label, c.path),
      }))
    );
  }
  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...meta,
          products,
          capabilities: capsWithFreq,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "generation failed");
      setOutput(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const ready = meta.clientName && meta.projectName && products.length > 0;

  return (
    <div>
      <h1>Generate outputs</h1>
      <p className="lead">
        Review the configuration, then generate the PPTX solution deck (34 slides) and
        DOCX SoW. Both files are written to <code>server/output/</code> and offered as
        downloads.
      </p>

      <div className="panel">
        <h3 style={{ marginBottom: 12, fontSize: 13, color: "var(--muted)" }}>
          REVIEW
        </h3>
        <ReviewRow label="Client" value={meta.clientName} />
        <ReviewRow label="Project" value={meta.projectName} />
        <ReviewRow label="Opportunity ID" value={meta.opportunityId || "—"} />
        <ReviewRow label="Market unit" value={meta.marketUnit || "—"} />
        <ReviewRow label="Contract value" value={meta.contractValue || "—"} />
        <ReviewRow label="Term" value={meta.contractTerm || "—"} />
        <ReviewRow label="CCI %" value={meta.cci || "—"} />
        <ReviewRow label="Delivery window" value={meta.deliveryWindow || "—"} />
        <ReviewRow label="Products" value={`${products.length} selected`} />
        <ReviewRow
          label="Capabilities"
          value={`${capabilities.length} selected`}
        />
        <ReviewRow
          label="Volumetrics filled"
          value={`${Object.values(meta.volumetrics || {}).filter(Boolean).length} / 12`}
        />
        <ReviewRow
          label="Team named"
          value={`${(meta.team || []).filter((r) => r[1]).length} of ${
            (meta.team || []).length
          }`}
        />
        <ReviewRow
          label="Custom assumptions"
          value={meta.assumptions?.length ? `${meta.assumptions.length} provided` : "default"}
        />
        <ReviewRow
          label="Custom OoS items"
          value={meta.outOfScope?.length ? `${meta.outOfScope.length} provided` : "default"}
        />
      </div>

      {capsWithFreq.length > 0 && (
        <div className="panel" style={{ marginTop: 16 }}>
          <div
            className="row"
            style={{
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 6,
            }}
          >
            <h3 style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
              IN SCOPE · FREQUENCY
            </h3>
            <button
              className="ghost"
              style={{ fontSize: 11, padding: "3px 8px" }}
              onClick={resetFrequencies}
              title="Re-run the keyword heuristic for every row"
            >
              Reset proposals
            </button>
          </div>
          <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
            Proposed frequency per capability (from keyword heuristic). Override any
            row — your values are passed to the PPTX and DOCX renderers as-is.
          </div>
          <table className="resource-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
                <th>Capability</th>
                <th>Tower</th>
                <th style={{ width: 160 }}>Frequency</th>
              </tr>
            </thead>
            <tbody>
              {capsWithFreq.map((c, i) => {
                const tower = (c.path || "").split(" > ")[0] || "General";
                const proposed = inferFrequency(c.label, c.path);
                const overridden = c.frequency !== proposed;
                return (
                  <tr key={c.id}>
                    <td style={{ color: "var(--muted)" }}>{i + 1}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{c.label}</div>
                      <div
                        className="muted"
                        style={{ fontSize: 11, fontFamily: "DM Mono, monospace" }}
                      >
                        {c.path}
                      </div>
                    </td>
                    <td>{tower}</td>
                    <td>
                      <select
                        value={c.frequency}
                        onChange={(e) => setFrequency(c.id, e.target.value)}
                        style={{
                          padding: "4px 6px",
                          fontSize: 12,
                          width: "100%",
                        }}
                      >
                        {FREQUENCY_OPTIONS.map((f) => (
                          <option key={f}>{f}</option>
                        ))}
                      </select>
                      {overridden && (
                        <div
                          className="muted"
                          style={{ fontSize: 10, marginTop: 2 }}
                        >
                          proposed: {proposed}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="panel" style={{ marginTop: 16 }}>
        <h3 style={{ marginBottom: 6, fontSize: 13, color: "var(--muted)" }}>
          STEER THE LLM
        </h3>
        <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
          Free-form instructions injected into every LLM-generated section
          (assumptions, dependencies, risks, deliverables, executive summary, synergy,
          limited-scope exclusions). Highest priority — overrides reference-deck style.
        </div>
        <textarea
          rows={5}
          value={userInstructions}
          onChange={(e) => setUserInstructions(e.target.value)}
          placeholder="e.g. Use British English. Each risk must reference an SAP product by name. Keep all assumptions under 20 words."
          style={{
            width: "100%",
            fontFamily: "inherit",
            fontSize: 13,
            padding: 10,
            borderRadius: 6,
            border: "1px solid var(--border)",
            background: "var(--surface)",
            color: "var(--text)",
            resize: "vertical",
          }}
        />
        <div
          className="row"
          style={{ flexWrap: "wrap", gap: 6, marginTop: 10 }}
        >
          <div className="muted" style={{ fontSize: 11, marginRight: 4 }}>
            quick presets:
          </div>
          {INSTRUCTION_PRESETS.map((p, i) => (
            <button
              key={i}
              className="ghost"
              style={{ fontSize: 11, padding: "3px 8px" }}
              onClick={() =>
                setUserInstructions(
                  userInstructions ? `${userInstructions}\n${p}` : p
                )
              }
              title={`Append: ${p}`}
            >
              + {p.length > 36 ? p.slice(0, 33) + "…" : p}
            </button>
          ))}
          {userInstructions && (
            <button
              className="ghost"
              style={{ fontSize: 11, padding: "3px 8px", marginLeft: "auto" }}
              onClick={() => setUserInstructions("")}
            >
              clear
            </button>
          )}
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="generate-card">
        <div className="title">Ready to generate?</div>
        <div className="desc">
          Produces a 34-slide PowerPoint solution deck + Word SoW based on your inputs.
          Empty values render as "TBD" so you can edit afterward.
        </div>
        <button className="primary" onClick={generate} disabled={!ready || busy}>
          {busy ? "Generating…" : "Generate PPTX + DOCX"}
        </button>
      </div>

      {output && (
        <div className="panel" style={{ marginTop: 18 }}>
          <h3 style={{ marginBottom: 12, fontSize: 13, color: "var(--muted)" }}>
            GENERATED
          </h3>
          {output.outputDir && (
            <div
              className="muted"
              style={{
                marginBottom: 10,
                fontFamily: "DM Mono, monospace",
                fontSize: 12,
              }}
            >
              Saved to: {output.outputDir}
            </div>
          )}
          <div className="output-links">
            <a href={output.pptx.url} download>
              <span className="ico">PPTX</span>
              {output.pptx.name}
            </a>
            <a href={output.docx.url} download>
              <span className="ico">DOCX</span>
              {output.docx.name}
            </a>
          </div>
        </div>
      )}

      <div className="row" style={{ marginTop: 18 }}>
        <button onClick={onBack}>← Back</button>
      </div>
    </div>
  );
}

function ReviewRow({ label, value, mono }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "180px 1fr",
        padding: "6px 0",
        borderBottom: "1px solid var(--border)",
        fontSize: 13,
      }}
    >
      <div style={{ color: "var(--muted)", fontWeight: 600 }}>{label}</div>
      <div style={{ fontFamily: mono ? "DM Mono, monospace" : "inherit" }}>
        {value}
      </div>
    </div>
  );
}
