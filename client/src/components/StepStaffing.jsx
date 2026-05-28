import { useEffect, useMemo, useState } from "react";

const LEVELS = ["Mgr", "Sr. Cons.", "Cons.", "Analyst"];
const LOCATIONS = ["Offshore", "Onshore", "Mixed"];

function towerOf(cap) {
  return (cap.path || "").split(" > ")[0] || "General";
}

function dominantLevel(caps) {
  const tally = new Map();
  for (const c of caps) {
    const fte = (parseFloat(c.fteY1) || 0) +
      (parseFloat(c.fteY2) || 0) +
      (parseFloat(c.fteY3) || 0);
    tally.set(c.level || "Cons.", (tally.get(c.level || "Cons.") || 0) + fte);
  }
  if (tally.size === 0) return "Cons.";
  return [...tally.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

function seedRowsFromCaps(caps) {
  const byTower = new Map();
  for (const c of caps) {
    const t = towerOf(c);
    if (!byTower.has(t)) byTower.set(t, []);
    byTower.get(t).push(c);
  }
  const rows = [];
  for (const [tower, items] of byTower.entries()) {
    rows.push({
      id: `tower:${tower}`,
      role: tower,
      level: dominantLevel(items),
      fteY1: items.reduce((s, c) => s + (parseFloat(c.fteY1) || 0), 0).toFixed(1),
      fteY2: items.reduce((s, c) => s + (parseFloat(c.fteY2) || 0), 0).toFixed(1),
      fteY3: items.reduce((s, c) => s + (parseFloat(c.fteY3) || 0), 0).toFixed(1),
      location: "Offshore",
    });
  }
  return rows;
}

function capsSignature(caps) {
  return caps.map((c) => c.id).sort().join("|");
}

export default function StepStaffing({
  capabilities,
  staffing,
  setStaffing,
  staffingSeed,
  setStaffingSeed,
  onNext,
  onBack,
}) {
  const currentSig = useMemo(() => capsSignature(capabilities), [capabilities]);

  useEffect(() => {
    if (currentSig !== staffingSeed) {
      setStaffing(seedRowsFromCaps(capabilities));
      setStaffingSeed(currentSig);
    }
  }, [currentSig, staffingSeed, capabilities, setStaffing, setStaffingSeed]);

  const [edited, setEdited] = useState(false);

  function update(id, field, value) {
    setStaffing(staffing.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
    setEdited(true);
  }

  function addRow() {
    setStaffing([
      ...staffing,
      {
        id: `custom:${Date.now()}`,
        role: "New role",
        level: "Cons.",
        fteY1: "0",
        fteY2: "0",
        fteY3: "0",
        location: "Offshore",
      },
    ]);
    setEdited(true);
  }

  function removeRow(id) {
    setStaffing(staffing.filter((r) => r.id !== id));
    setEdited(true);
  }

  function reseed() {
    setStaffing(seedRowsFromCaps(capabilities));
    setStaffingSeed(currentSig);
    setEdited(false);
  }

  const totals = useMemo(() => {
    const sum = (f) => staffing.reduce((s, r) => s + (parseFloat(r[f]) || 0), 0);
    return { y1: sum("fteY1"), y2: sum("fteY2"), y3: sum("fteY3") };
  }, [staffing]);

  return (
    <div>
      <h1>Resource loading</h1>
      <p className="lead">
        Aggregated FTE per role across all selected capabilities. Edit the totals
        directly — values flow into the Staffing slide and SoW. Seeded at{" "}
        <strong>0.1 × capabilities × contract years</strong>; adjust to your engagement
        shape.
      </p>

      <div className="panel" style={{ marginTop: 12 }}>
        <div
          className="row"
          style={{
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 10,
          }}
        >
          <h4 style={{ margin: 0 }}>
            {staffing.length} role{staffing.length === 1 ? "" : "s"}{" "}
            {edited && <span className="muted" style={{ fontSize: 12 }}>· edited</span>}
          </h4>
          <div className="row" style={{ gap: 8 }}>
            <button className="ghost" onClick={reseed} disabled={!edited}>
              Reset to defaults
            </button>
            <button onClick={addRow}>+ Add role</button>
          </div>
        </div>

        <table className="resource-table">
          <thead>
            <tr>
              <th>Role / Tower</th>
              <th>Level</th>
              <th>Y1 FTE</th>
              <th>Y2 FTE</th>
              <th>Y3 FTE</th>
              <th>Location</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {staffing.map((r) => (
              <tr key={r.id}>
                <td>
                  <input
                    type="text"
                    value={r.role}
                    onChange={(e) => update(r.id, "role", e.target.value)}
                  />
                </td>
                <td>
                  <select
                    value={r.level}
                    onChange={(e) => update(r.id, "level", e.target.value)}
                    style={{ padding: "4px 6px", fontSize: 12 }}
                  >
                    {LEVELS.map((l) => (
                      <option key={l}>{l}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={r.fteY1 ?? ""}
                    onChange={(e) => update(r.id, "fteY1", e.target.value)}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={r.fteY2 ?? ""}
                    onChange={(e) => update(r.id, "fteY2", e.target.value)}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={r.fteY3 ?? ""}
                    onChange={(e) => update(r.id, "fteY3", e.target.value)}
                  />
                </td>
                <td>
                  <select
                    value={r.location}
                    onChange={(e) => update(r.id, "location", e.target.value)}
                    style={{ padding: "4px 6px", fontSize: 12 }}
                  >
                    {LOCATIONS.map((l) => (
                      <option key={l}>{l}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <button
                    className="ghost"
                    onClick={() => removeRow(r.id)}
                    style={{ padding: "2px 6px", fontSize: 12 }}
                    title="Remove row"
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
            {staffing.length === 0 && (
              <tr>
                <td colSpan={7} className="muted" style={{ padding: 16 }}>
                  No capabilities selected. Go back and pick capabilities, or add a
                  custom role.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2} style={{ textAlign: "right", fontWeight: 600 }}>
                TOTAL FTE
              </td>
              <td style={{ textAlign: "center", fontWeight: 600 }}>{totals.y1.toFixed(1)}</td>
              <td style={{ textAlign: "center", fontWeight: 600 }}>{totals.y2.toFixed(1)}</td>
              <td style={{ textAlign: "center", fontWeight: 600 }}>{totals.y3.toFixed(1)}</td>
              <td colSpan={2}></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="row" style={{ marginTop: 18, justifyContent: "space-between" }}>
        <button onClick={onBack}>← Back</button>
        <div className="muted">
          Y1 {totals.y1.toFixed(1)} · Y2 {totals.y2.toFixed(1)} · Y3 {totals.y3.toFixed(1)}{" "}
          FTE
        </div>
        <button className="primary" onClick={onNext}>
          Next: Generate →
        </button>
      </div>
    </div>
  );
}
