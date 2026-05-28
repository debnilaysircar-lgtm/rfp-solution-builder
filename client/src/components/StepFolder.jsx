export default function StepFolder({
  clientName,
  setClientName,
  projectName,
  setProjectName,
  opportunityId,
  setOpportunityId,
  marketUnit,
  setMarketUnit,
  contractValue,
  setContractValue,
  contractType,
  setContractType,
  contractTerm,
  setContractTerm,
  cci,
  setCci,
  deliveryWindow,
  setDeliveryWindow,
  team,
  setTeam,
  volumetrics,
  setVolumetrics,
  assumptionsText,
  setAssumptionsText,
  outOfScopeText,
  setOutOfScopeText,
  notes,
  setNotes,
  onNext,
}) {
  function vol(field) {
    return {
      value: volumetrics[field] || "",
      onChange: (e) =>
        setVolumetrics({ ...volumetrics, [field]: e.target.value }),
    };
  }

  function updateTeamRow(i, col, value) {
    const next = team.map((row, idx) =>
      idx === i ? row.map((c, ci) => (ci === col ? value : c)) : row
    );
    setTeam(next);
  }

  function addTeamRow() {
    setTeam([...team, ["", "", ""]]);
  }

  function removeTeamRow(i) {
    setTeam(team.filter((_, idx) => idx !== i));
  }

  return (
    <div>
      <h1>Project details</h1>
      <p className="lead">
        These values feed every slide of the deck and every section of the SoW. Leave
        any field blank and the template uses a sensible default (TBD where placeholder
        values are required). Generated files land in your Windows Downloads folder.
      </p>

      {/* ----- Identity ----- */}
      <details open className="panel">
        <summary className="section-summary">Client &amp; opportunity</summary>
        <div className="grid2" style={{ marginTop: 12 }}>
          <Field label="Client name *">
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="e.g. Acme Group"
            />
          </Field>
          <Field label="Project / opportunity name *">
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="e.g. SAP AMS — Tech Factory"
            />
          </Field>
          <Field label="Opportunity ID">
            <input
              type="text"
              value={opportunityId}
              onChange={(e) => setOpportunityId(e.target.value)}
              placeholder="e.g. 0012321615"
            />
          </Field>
          <Field label="Market unit">
            <input
              type="text"
              value={marketUnit}
              onChange={(e) => setMarketUnit(e.target.value)}
              placeholder="EMEA"
            />
          </Field>
        </div>
        <Field label="Executive summary (optional)" style={{ marginTop: 12 }}>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="One paragraph that goes onto the exec summary slide + SoW intro. Blank = auto-generated."
          />
        </Field>
      </details>

      {/* ----- Commercials ----- */}
      <details className="panel">
        <summary className="section-summary">Commercials &amp; deal shape</summary>
        <div className="grid3" style={{ marginTop: 12 }}>
          <Field label="Total contract value">
            <input
              type="text"
              value={contractValue}
              onChange={(e) => setContractValue(e.target.value)}
              placeholder="e.g. 10.1 M$"
            />
          </Field>
          <Field label="Contract term">
            <input
              type="text"
              value={contractTerm}
              onChange={(e) => setContractTerm(e.target.value)}
              placeholder="36 months"
            />
          </Field>
          <Field label="CCI %">
            <input
              type="text"
              value={cci}
              onChange={(e) => setCci(e.target.value)}
              placeholder="e.g. 36%"
            />
          </Field>
          <Field label="Contract type">
            <input
              type="text"
              value={contractType}
              onChange={(e) => setContractType(e.target.value)}
              placeholder="Fixed · Output-based AO"
            />
          </Field>
          <Field label="Delivery / service window">
            <input
              type="text"
              value={deliveryWindow}
              onChange={(e) => setDeliveryWindow(e.target.value)}
              placeholder="12×6 + 24×7 P1/P2"
            />
          </Field>
        </div>
      </details>

      {/* ----- Volumetrics ----- */}
      <details className="panel">
        <summary className="section-summary">Volumetrics</summary>
        <p className="muted" style={{ marginTop: 8, fontSize: 12 }}>
          These appear on the Volumetrics, Solution on a Page, and Security Volumetrics
          slides. Use any units you want (just text).
        </p>
        <div className="grid4" style={{ marginTop: 12 }}>
          <Field label="Users"><input {...vol("users")} placeholder="e.g. 4,900" /></Field>
          <Field label="Incidents / yr"><input {...vol("incidents")} placeholder="e.g. 374" /></Field>
          <Field label="Tickets / mo"><input {...vol("tickets")} placeholder="e.g. 480" /></Field>
          <Field label="Changes / mo"><input {...vol("changes")} placeholder="e.g. 35" /></Field>
          <Field label="Production SIDs"><input {...vol("prodSids")} placeholder="e.g. 10" /></Field>
          <Field label="Non-prod SIDs"><input {...vol("nonProdSids")} placeholder="e.g. 21" /></Field>
          <Field label="SaaS apps"><input {...vol("saasApps")} placeholder="e.g. 21" /></Field>
          <Field label="BTP services"><input {...vol("btpServices")} placeholder="e.g. 42" /></Field>
          <Field label="Security tickets / mo"><input {...vol("securityTickets")} placeholder="e.g. 170" /></Field>
          <Field label="Roles managed"><input {...vol("rolesManaged")} placeholder="e.g. 600" /></Field>
          <Field label="SoD violations / mo"><input {...vol("sodViolations")} placeholder="e.g. 12" /></Field>
          <Field label="Firefighter / mo"><input {...vol("firefighterSessions")} placeholder="e.g. 8" /></Field>
        </div>
      </details>

      {/* ----- Team ----- */}
      <details className="panel">
        <summary className="section-summary">Opportunity team</summary>
        <p className="muted" style={{ marginTop: 8, fontSize: 12 }}>
          Goes on the Opportunity Team slide. Add the named owners you have so far —
          blank rows are kept as TBD.
        </p>
        <table className="team-table">
          <thead>
            <tr>
              <th>Role</th>
              <th>Name</th>
              <th>Coverage</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {team.map((row, i) => (
              <tr key={i}>
                <td><input value={row[0]} onChange={(e) => updateTeamRow(i, 0, e.target.value)} placeholder="Role" /></td>
                <td><input value={row[1]} onChange={(e) => updateTeamRow(i, 1, e.target.value)} placeholder="Name" /></td>
                <td><input value={row[2]} onChange={(e) => updateTeamRow(i, 2, e.target.value)} placeholder="Coverage" /></td>
                <td>
                  <button className="ghost" onClick={() => removeTeamRow(i)} title="Remove">×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button className="ghost" onClick={addTeamRow} style={{ marginTop: 8 }}>+ Add row</button>
      </details>

      {/* ----- Assumptions / OoS ----- */}
      <details className="panel">
        <summary className="section-summary">Assumptions &amp; out-of-scope</summary>
        <Field label="Assumptions (one per line)" style={{ marginTop: 12 }}>
          <textarea
            value={assumptionsText}
            onChange={(e) => setAssumptionsText(e.target.value)}
            placeholder={"e.g.\nSAP RISE PCE responsibility split applies.\nClient retains business processes & master data.\nKnowledge transfer from SI vendor in place."}
            style={{ minHeight: 140 }}
          />
        </Field>
        <Field label="Out-of-scope items (one per line)" style={{ marginTop: 12 }}>
          <textarea
            value={outOfScopeText}
            onChange={(e) => setOutOfScopeText(e.target.value)}
            placeholder={"e.g.\nFunctional application support.\nMaster-data ownership.\nEnd-user training."}
            style={{ minHeight: 140 }}
          />
        </Field>
      </details>

      <div className="row" style={{ justifyContent: "flex-end", marginTop: 8 }}>
        <button
          className="primary"
          onClick={onNext}
          disabled={!clientName || !projectName}
        >
          Next: Pick SAP products →
        </button>
      </div>
    </div>
  );
}

function Field({ label, children, style }) {
  return (
    <label className="field" style={style}>
      <span className="lbl">{label}</span>
      {children}
    </label>
  );
}
