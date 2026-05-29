export default function Summary({
  clientName,
  projectName,
  selectedProducts,
  setSelectedProducts,
  selectedCapabilities,
  setSelectedCapabilities,
  output,
}) {
  return (
    <div>
      <h3>Spec sheet</h3>
      <div className="stat">
        <div>Client</div>
        <div className="v" data-text="true">{clientName || "—"}</div>
      </div>
      <div className="stat">
        <div>Project</div>
        <div className="v" data-text="true">{projectName || "—"}</div>
      </div>
      <div className="stat">
        <div>SAP products</div>
        <div className="v">{String(selectedProducts.length).padStart(2, "0")}</div>
      </div>
      <div className="stat">
        <div>Capabilities</div>
        <div className="v">{String(selectedCapabilities.length).padStart(2, "0")}</div>
      </div>

      {selectedProducts.length > 0 && (
        <>
          <h3 style={{ marginTop: 18 }}>Selected products</h3>
          <div className="selected-chips">
            {selectedProducts.map((p) => (
              <span className="chip" key={p.name} title={p.description}>
                {p.acronym || p.name.slice(0, 24)}
                <span
                  className="x"
                  onClick={() =>
                    setSelectedProducts(
                      selectedProducts.filter((x) => x.name !== p.name)
                    )
                  }
                >
                  ×
                </span>
              </span>
            ))}
          </div>
        </>
      )}

      {selectedCapabilities.length > 0 && (
        <>
          <h3>Selected capabilities</h3>
          <div className="selected-chips">
            {selectedCapabilities.map((c) => (
              <span
                className="chip"
                key={c.id}
                title={c.path}
                style={{ maxWidth: "100%" }}
              >
                <span
                  style={{
                    maxWidth: 250,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {c.label}
                </span>
                <span
                  className="x"
                  onClick={() =>
                    setSelectedCapabilities(
                      selectedCapabilities.filter((x) => x.id !== c.id)
                    )
                  }
                >
                  ×
                </span>
              </span>
            ))}
          </div>
        </>
      )}

      {output && (
        <>
          <h3 style={{ marginTop: 18 }}>Last generated</h3>
          <div className="output-links">
            <a href={output.pptx.url} download>
              <span className="ico">PPTX</span> {output.pptx.name.slice(0, 28)}…
            </a>
            <a href={output.docx.url} download>
              <span className="ico">DOCX</span> {output.docx.name.slice(0, 28)}…
            </a>
          </div>
        </>
      )}
    </div>
  );
}
