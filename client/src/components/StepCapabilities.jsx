import { useEffect, useMemo, useState } from "react";

function parseContractYears(term) {
  if (!term) return 3;
  const m = String(term).match(/(\d+(?:\.\d+)?)\s*(month|year|yr)/i);
  if (!m) return 3;
  const n = parseFloat(m[1]);
  if (/month/i.test(m[2])) return Math.max(1, Math.ceil(n / 12));
  return Math.max(1, Math.round(n));
}

function defaultFte(yearIndex, contractYears) {
  return yearIndex <= contractYears ? "0.1" : "0";
}

export default function StepCapabilities({
  selected,
  setSelected,
  contractTerm,
  onNext,
  onBack,
}) {
  const [sources, setSources] = useState([]);
  const [source, setSource] = useState("SAP_AMS_Architecture_Tree");
  const [tree, setTree] = useState(null);
  const [query, setQuery] = useState("");
  const [searchHits, setSearchHits] = useState(null);
  const [error, setError] = useState(null);

  const contractYears = useMemo(() => parseContractYears(contractTerm), [contractTerm]);

  useEffect(() => {
    fetch("/api/capability-sources")
      .then((r) => r.json())
      .then((d) => setSources(d.sources || []));
  }, []);

  useEffect(() => {
    setTree(null);
    fetch(`/api/capabilities?source=${encodeURIComponent(source)}`)
      .then((r) => r.json())
      .then((d) => setTree(d.tree || []))
      .catch((e) => setError(e.message));
  }, [source]);

  const selectedIds = useMemo(
    () => new Set(selected.map((c) => c.id)),
    [selected]
  );

  function newCap(node) {
    return {
      id: node.id,
      label: node.label,
      path: node.id,
      section: node.section,
      text: node.text,
      fteY1: defaultFte(1, contractYears),
      fteY2: defaultFte(2, contractYears),
      fteY3: defaultFte(3, contractYears),
      level: "Cons.",
    };
  }

  function toggleLeaf(node) {
    if (selectedIds.has(node.id)) {
      setSelected(selected.filter((c) => c.id !== node.id));
    } else {
      setSelected([...selected, newCap(node)]);
    }
  }

  function collectLeaves(node, acc = []) {
    if (node.isLeaf) {
      acc.push(node);
      return acc;
    }
    (node.children || []).forEach((c) => collectLeaves(c, acc));
    return acc;
  }

  function selectSubtree(node, on) {
    const leaves = collectLeaves(node);
    const ids = new Set(leaves.map((l) => l.id));
    if (on) {
      const additions = leaves
        .filter((l) => !selectedIds.has(l.id))
        .map((l) => newCap(l));
      setSelected([...selected, ...additions]);
    } else {
      setSelected(selected.filter((c) => !ids.has(c.id)));
    }
  }

  async function runSearch() {
    if (!query.trim()) {
      setSearchHits(null);
      return;
    }
    try {
      const r = await fetch("/api/search-capabilities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: query, source, limit: 25 }),
      });
      const data = await r.json();
      setSearchHits(data.items || []);
    } catch (e) {
      setError(e.message);
    }
  }

  function addHit(hit) {
    const id = hit.path;
    if (selectedIds.has(id)) return;
    setSelected([
      ...selected,
      newCap({
        id,
        label: id.split(" > ").pop(),
        path: id,
        section: hit.section,
        text: hit.text,
      }),
    ]);
  }

  return (
    <div>
      <h1>Architecture capabilities</h1>
      <p className="lead">
        Pick capabilities from the architecture tree. Click a parent node's checkbox to
        select all its children. Use the search box to find capabilities semantically.
        Each capability seeds <strong>0.1 FTE</strong> per year covered by the contract
        ({contractYears} {contractYears === 1 ? "year" : "years"}); edit aggregated
        totals on the next step.
      </p>

      <div className="search-row">
        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          style={{ width: "auto" }}
        >
          {sources.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <input
          type="search"
          placeholder="search capabilities (semantic)…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (searchHits && !e.target.value) setSearchHits(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") runSearch();
          }}
        />
        <button onClick={runSearch} disabled={!query.trim()}>
          Search
        </button>
        <button
          className="ghost"
          onClick={() => {
            setQuery("");
            setSearchHits(null);
          }}
        >
          Clear
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      {searchHits ? (
        <div className="cap-tree" style={{ padding: 8 }}>
          <div className="muted" style={{ padding: 4 }}>
            {searchHits.length} matches — click + to add
          </div>
          {searchHits.map((h, i) => (
            <div
              key={i}
              className="tree-row leaf"
              onClick={() => addHit(h)}
              style={{ padding: 6 }}
            >
              <span className="toggle">+</span>
              <input
                type="checkbox"
                className="checkbox"
                checked={selectedIds.has(h.path)}
                readOnly
              />
              <div className="label">
                {h.path}
                <span className="section">
                  · d={h.distance.toFixed(3)}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : !tree ? (
        <div className="empty">Loading capability tree…</div>
      ) : tree.length === 0 ? (
        <div className="empty">No nodes in tree.</div>
      ) : (
        <div className="cap-tree" style={{ padding: 8 }}>
          {tree.map((n) => (
            <TreeNode
              key={n.id}
              node={n}
              selectedIds={selectedIds}
              onToggleLeaf={toggleLeaf}
              onSelectSubtree={selectSubtree}
              collectLeaves={collectLeaves}
            />
          ))}
        </div>
      )}

      <div className="row" style={{ marginTop: 18, justifyContent: "space-between" }}>
        <button onClick={onBack}>← Back</button>
        <div className="muted">{selected.length} capabilities selected</div>
        <button className="primary" onClick={onNext} disabled={selected.length === 0}>
          Next: Resource loading →
        </button>
      </div>
    </div>
  );
}

function TreeNode({
  node,
  selectedIds,
  onToggleLeaf,
  onSelectSubtree,
  collectLeaves,
  depth = 0,
}) {
  const [expanded, setExpanded] = useState(depth < 1);
  const hasChildren = node.children && node.children.length > 0;
  const leaves = collectLeaves(node);
  const leafIds = leaves.map((l) => l.id);
  const allSelected = leafIds.length > 0 && leafIds.every((id) => selectedIds.has(id));
  const someSelected = leafIds.some((id) => selectedIds.has(id));

  const isLeaf = node.isLeaf && !hasChildren;

  return (
    <div className="tree-node">
      <div
        className={"tree-row" + (isLeaf ? " leaf" : "")}
        onClick={() => (hasChildren ? setExpanded(!expanded) : onToggleLeaf(node))}
      >
        <span className="toggle">
          {hasChildren ? (expanded ? "▾" : "▸") : "·"}
        </span>
        <input
          type="checkbox"
          className="checkbox"
          checked={isLeaf ? selectedIds.has(node.id) : allSelected}
          ref={(el) => {
            if (el && !isLeaf) el.indeterminate = !allSelected && someSelected;
          }}
          onClick={(e) => {
            e.stopPropagation();
            if (isLeaf) onToggleLeaf(node);
            else onSelectSubtree(node, !allSelected);
          }}
          onChange={() => {}}
        />
        <div className="label">{node.label}</div>
      </div>
      {hasChildren && expanded && (
        <div className="tree-children">
          {node.children.map((c) => (
            <TreeNode
              key={c.id}
              node={c}
              selectedIds={selectedIds}
              onToggleLeaf={onToggleLeaf}
              onSelectSubtree={onSelectSubtree}
              collectLeaves={collectLeaves}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
