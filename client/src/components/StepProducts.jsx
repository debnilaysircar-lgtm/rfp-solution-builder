import { useEffect, useMemo, useState } from "react";

export default function StepProducts({ selected, setSelected, onNext, onBack }) {
  const [allProducts, setAllProducts] = useState(null);
  const [query, setQuery] = useState("");
  const [semanticResults, setSemanticResults] = useState(null);
  const [includeLegacy, setIncludeLegacy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/products?limit=2000")
      .then((r) => r.json())
      .then((d) => setAllProducts(d.items || []))
      .catch((e) => setError(e.message));
  }, []);

  async function runSemanticSearch() {
    if (!query.trim()) {
      setSemanticResults(null);
      return;
    }
    try {
      const r = await fetch(
        `/api/products?q=${encodeURIComponent(query)}&limit=30`
      );
      const data = await r.json();
      setSemanticResults(data.items || []);
    } catch (e) {
      setError(e.message);
    }
  }

  const selectedKeys = useMemo(
    () => new Set(selected.map((p) => p.name)),
    [selected]
  );

  function toggle(product) {
    if (selectedKeys.has(product.name)) {
      setSelected(selected.filter((p) => p.name !== product.name));
    } else {
      setSelected([...selected, product]);
    }
  }

  const visible = useMemo(() => {
    if (semanticResults) return semanticResults;
    if (!allProducts) return [];
    let list = allProducts;
    if (!includeLegacy) list = list.filter((p) => !p.legacy);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.acronym || "").toLowerCase().includes(q) ||
          (p.description || "").toLowerCase().includes(q) ||
          (p.category || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [allProducts, query, includeLegacy, semanticResults]);

  const grouped = useMemo(() => {
    const m = new Map();
    for (const p of visible) {
      const k = p.category || "Uncategorised";
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(p);
    }
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [visible]);

  return (
    <div>
      <h1>SAP products in scope</h1>
      <p className="lead">
        Pick the SAP products this engagement will cover. Use the search box for keyword
        filtering, or press Enter to run a semantic search across the vector DB.
      </p>

      <div className="search-row">
        <input
          type="search"
          placeholder="filter or search semantically (press Enter)…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (semanticResults) setSemanticResults(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") runSemanticSearch();
          }}
        />
        <button onClick={runSemanticSearch} disabled={!query.trim()}>
          Semantic
        </button>
        <button
          className="ghost"
          onClick={() => {
            setQuery("");
            setSemanticResults(null);
          }}
        >
          Clear
        </button>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            color: "var(--muted)",
          }}
        >
          <input
            type="checkbox"
            checked={includeLegacy}
            onChange={(e) => setIncludeLegacy(e.target.checked)}
          />
          show legacy
        </label>
      </div>

      {error && <div className="error">{error}</div>}

      {!allProducts ? (
        <div className="empty">Loading products from vector DB…</div>
      ) : visible.length === 0 ? (
        <div className="empty">No products match.</div>
      ) : (
        <div className="product-list">
          {semanticResults && (
            <div className="product-cat">
              Semantic results · {semanticResults.length} · ranked by relevance
            </div>
          )}
          {semanticResults
            ? semanticResults.map((p) => (
                <ProductRow
                  key={p.name}
                  p={p}
                  selected={selectedKeys.has(p.name)}
                  onToggle={() => toggle(p)}
                />
              ))
            : grouped.map(([cat, items]) => (
                <div key={cat}>
                  <div className="product-cat">
                    {cat} · {items.length}
                  </div>
                  {items.map((p) => (
                    <ProductRow
                      key={p.name}
                      p={p}
                      selected={selectedKeys.has(p.name)}
                      onToggle={() => toggle(p)}
                    />
                  ))}
                </div>
              ))}
        </div>
      )}

      <div className="row" style={{ marginTop: 18, justifyContent: "space-between" }}>
        <button onClick={onBack}>← Back</button>
        <div className="muted">{selected.length} selected</div>
        <button className="primary" onClick={onNext} disabled={selected.length === 0}>
          Next: Pick capabilities →
        </button>
      </div>
    </div>
  );
}

function ProductRow({ p, selected, onToggle }) {
  return (
    <div
      className={"product-item" + (selected ? " selected" : "")}
      onClick={onToggle}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        onClick={(e) => e.stopPropagation()}
      />
      <div style={{ flex: 1 }}>
        <div>
          <span className="name">{p.name}</span>
          {p.acronym && <span className="acro">({p.acronym})</span>}
          {p.legacy && <span className="legacy-badge">LEGACY</span>}
          {typeof p.distance === "number" && (
            <span className="acro" style={{ marginLeft: 8 }}>
              d={p.distance.toFixed(3)}
            </span>
          )}
        </div>
        {p.description && <div className="desc">{p.description}</div>}
      </div>
    </div>
  );
}
