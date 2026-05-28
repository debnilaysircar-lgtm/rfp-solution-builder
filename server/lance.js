import * as lancedb from "@lancedb/lancedb";
import { pipeline } from "@huggingface/transformers";
import path from "node:path";

const DB_PATH =
  process.env.VECTOR_DB_PATH ||
  path.resolve("C:\\Users\\debnilay.sircar\\vectordb-test\\db");
const SOLUTIONS_DB_PATH =
  process.env.SOLUTIONS_DB_PATH ||
  path.resolve("C:\\Users\\debnilay.sircar\\solutions\\db");
const PAST_GENERATIONS_TABLE_NAME = "past_generations";
const EMBED_MODEL = "Xenova/all-MiniLM-L6-v2";

let _db = null;
let _solutionsDb = null;
let _solutionsTable = null;
let _pastGenerationsTable = null;
let _embedder = null;
const _tables = {};

export async function getDb() {
  if (!_db) _db = await lancedb.connect(DB_PATH);
  return _db;
}

export async function getEmbedder() {
  if (!_embedder) {
    console.log(`Loading embedding model ${EMBED_MODEL}...`);
    _embedder = await pipeline("feature-extraction", EMBED_MODEL);
  }
  return _embedder;
}

export async function embed(text) {
  const e = await getEmbedder();
  const out = await e(text, { pooling: "mean", normalize: true });
  return Array.from(out.data);
}

export async function getTable(name) {
  if (_tables[name]) return _tables[name];
  const db = await getDb();
  try {
    _tables[name] = await db.openTable(name);
    return _tables[name];
  } catch (e) {
    console.warn(`Table '${name}' not available:`, e.message);
    return null;
  }
}

export async function listProducts({ limit = 500, includeLegacy = true } = {}) {
  const t = await getTable("sap_products");
  if (!t) return [];
  const rows = await t.query().limit(limit).toArray();
  return rows
    .filter((r) => includeLegacy || !r.legacy)
    .map((r) => ({
      name: r.name,
      acronym: r.acronym || null,
      description: r.description || "",
      category: r.category || "",
      legacy: !!r.legacy,
    }))
    .sort((a, b) =>
      a.category === b.category
        ? a.name.localeCompare(b.name)
        : a.category.localeCompare(b.category)
    );
}

export async function searchProducts(query, limit = 20) {
  const t = await getTable("sap_products");
  if (!t || !query?.trim()) return [];
  const qv = await embed(query);
  const rows = await t.search(qv).limit(limit).toArray();
  return rows.map((r) => ({
    name: r.name,
    acronym: r.acronym || null,
    description: r.description || "",
    category: r.category || "",
    legacy: !!r.legacy,
    distance: r._distance,
  }));
}

export async function listArchTreeRows(source = "SAP_AMS_Architecture_Tree") {
  const t = await getTable("arch_trees");
  if (!t) return [];
  const rows = await t
    .query()
    .where(`source = '${source.replace(/'/g, "''")}'`)
    .limit(10000)
    .toArray();
  return rows.map((r) => ({
    source: r.source,
    section: r.section,
    pathStr: r.path,
    text: r.text,
  }));
}

export function buildCapabilityTree(rows) {
  // rows: { section, pathStr ("A > B > C > Leaf"), text }
  const root = { id: "root", label: "ROOT", children: new Map() };

  for (const row of rows) {
    const segments = row.pathStr.split(" > ").map((s) => s.trim()).filter(Boolean);
    let node = root;
    let acc = [];
    for (const seg of segments) {
      acc.push(seg);
      const id = acc.join(" > ");
      if (!node.children.has(seg)) {
        node.children.set(seg, {
          id,
          label: seg,
          children: new Map(),
          isLeaf: false,
        });
      }
      node = node.children.get(seg);
    }
    node.isLeaf = true;
    node.text = row.text;
    node.section = row.section;
  }

  const toArray = (n) => ({
    id: n.id,
    label: n.label,
    isLeaf: n.isLeaf,
    section: n.section,
    text: n.text,
    children: Array.from(n.children.values()).map(toArray),
  });

  return Array.from(root.children.values()).map(toArray);
}

export async function searchCapabilities(query, source, limit = 20) {
  const t = await getTable("arch_trees");
  if (!t || !query?.trim()) return [];
  const qv = await embed(query);
  let s = t.search(qv).limit(limit);
  if (source) s = s.where(`source = '${source.replace(/'/g, "''")}'`);
  const rows = await s.toArray();
  return rows.map((r) => ({
    source: r.source,
    section: r.section,
    path: r.path,
    text: r.text,
    distance: r._distance,
  }));
}

async function getSolutionsTable() {
  if (_solutionsTable) return _solutionsTable;
  try {
    if (!_solutionsDb) _solutionsDb = await lancedb.connect(SOLUTIONS_DB_PATH);
    _solutionsTable = await _solutionsDb.openTable("chunks");
    return _solutionsTable;
  } catch (e) {
    console.warn("Solutions table not available:", e.message);
    return null;
  }
}

export async function searchSolutions(query, limit = 8) {
  const t = await getSolutionsTable();
  if (!t || !query?.trim()) return [];
  const qv = await embed(query);
  const rows = await t.search(qv).limit(limit).toArray();
  return rows.map((r) => ({
    clientFolder: r.clientFolder,
    fileName: r.fileName,
    fileType: r.fileType,
    chunkIdx: r.chunkIdx,
    text: r.text,
    distance: r._distance,
  }));
}

async function getPastGenerationsTable() {
  if (_pastGenerationsTable) return _pastGenerationsTable;
  try {
    const db = await getDb();
    _pastGenerationsTable = await db.openTable(PAST_GENERATIONS_TABLE_NAME);
    return _pastGenerationsTable;
  } catch {
    return null;
  }
}

export async function savePastGeneration(entry) {
  const text = String(entry.text || "").trim();
  if (!text) return { ok: false, reason: "empty text" };
  const vector = await embed(text);
  const row = {
    id: String(entry.id || `${entry.generationId}-${entry.section}-${entry.itemIndex ?? "all"}-${Date.now()}`),
    generationId: String(entry.generationId || ""),
    section: String(entry.section || ""),
    itemIndex: Number(entry.itemIndex ?? -1),
    text,
    clientName: String(entry.clientName || ""),
    projectName: String(entry.projectName || ""),
    productList: String(entry.productList || ""),
    capList: String(entry.capList || ""),
    ts: String(entry.ts || new Date().toISOString()),
    vector,
  };
  const db = await getDb();
  if (!_pastGenerationsTable) {
    try {
      _pastGenerationsTable = await db.openTable(PAST_GENERATIONS_TABLE_NAME);
    } catch {
      _pastGenerationsTable = await db.createTable(PAST_GENERATIONS_TABLE_NAME, [row]);
      return { ok: true, id: row.id };
    }
  }
  await _pastGenerationsTable.add([row]);
  return { ok: true, id: row.id };
}

export async function savePastGenerationBatch(entries) {
  const results = [];
  for (const e of entries) {
    try {
      results.push(await savePastGeneration(e));
    } catch (err) {
      results.push({ ok: false, error: err.message });
    }
  }
  return results;
}

export async function searchPastGenerations({ section, query, limit = 3, clientName } = {}) {
  const t = await getPastGenerationsTable();
  if (!t || !query?.trim()) return [];
  const qv = await embed(query);
  let s = t.search(qv).limit(limit);
  const clauses = [];
  if (section) clauses.push(`section = '${String(section).replace(/'/g, "''")}'`);
  if (clientName) clauses.push(`clientName = '${String(clientName).replace(/'/g, "''")}'`);
  if (clauses.length) s = s.where(clauses.join(" AND "));
  const rows = await s.toArray();
  return rows.map((r) => ({
    id: r.id,
    section: r.section,
    text: r.text,
    clientName: r.clientName,
    projectName: r.projectName,
    ts: r.ts,
    distance: r._distance,
  }));
}

export async function pastGenerationsStats() {
  const t = await getPastGenerationsTable();
  if (!t) return { total: 0, exists: false };
  const total = await t.countRows();
  return { total, exists: true };
}

export async function listFolderEntries(folderPath) {
  const fs = await import("node:fs/promises");
  try {
    const entries = await fs.readdir(folderPath, { withFileTypes: true });
    return entries.map((e) => ({
      name: e.name,
      isDirectory: e.isDirectory(),
      isFile: e.isFile(),
    }));
  } catch (e) {
    throw new Error(`Cannot read folder '${folderPath}': ${e.message}`);
  }
}
