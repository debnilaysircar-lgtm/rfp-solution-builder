import * as lancedb from "@lancedb/lancedb";
import { pipeline } from "@huggingface/transformers";
import { readFile } from "node:fs/promises";

const SRC = "C:\\Users\\debnilay.sircar\\sap-products-tree.html";

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function parse(html) {
  const lines = html.split(/\r?\n/);
  const records = [];
  let category = null;

  const catRe = /<summary>\s*(\d+)\.\s+(.+?)\s*(?:<span\s+class="count"|<\/summary>)/i;
  const leafRe = /<span\s+class="leaf">(.+?)<\/span>\s*<\/li>/i;
  const nameRe = /<span\s+class="name">(.+?)<\/span>/i;
  const acroRe = /<span\s+class="acronym">\(([^)]+)\)<\/span>/i;
  const descRe = /<span\s+class="desc">\s*(?:&mdash;|—|--)?\s*(.+?)<\/span>/i;
  const legacyRe = /<span\s+class="legacy">/i;

  for (const line of lines) {
    const c = catRe.exec(line);
    if (c) {
      const num = c[1];
      const text = decodeEntities(c[2].replace(/<.*?>/g, "")).trim();
      category = `${num}. ${text}`;
      continue;
    }
    const l = leafRe.exec(line);
    if (!l || !category) continue;
    const inner = l[1];
    const name = nameRe.exec(inner)?.[1]?.trim();
    if (!name) continue;
    const acronym = acroRe.exec(inner)?.[1]?.trim() || null;
    const description = descRe.exec(inner)?.[1]?.trim() || "";
    const legacy = legacyRe.test(inner);
    records.push({
      name: decodeEntities(name),
      acronym: acronym ? decodeEntities(acronym) : null,
      description: decodeEntities(description),
      category,
      legacy,
    });
  }
  return records;
}

console.log("Reading source...");
const html = await readFile(SRC, "utf8");
const items = parse(html);
console.log(`  parsed ${items.length} products across ${new Set(items.map(i => i.category)).size} categories`);
console.log(`  legacy products: ${items.filter(i => i.legacy).length}`);

console.log("\nLoading embedding model...");
const embedder = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
const embed = async (text) => {
  const out = await embedder(text, { pooling: "mean", normalize: true });
  return Array.from(out.data);
};

console.log("Embedding...");
const records = [];
let i = 0;
for (const it of items) {
  const embedText = [
    it.name,
    it.acronym ? `(${it.acronym})` : "",
    it.description,
    it.category,
  ].filter(Boolean).join(" — ");
  records.push({
    ...it,
    acronym: it.acronym || "",
    text: embedText,
    vector: await embed(embedText),
  });
  i++;
  if (i % 50 === 0) console.log(`  ${i}/${items.length}`);
}
console.log(`  ${i}/${items.length} done`);

console.log("\nWriting to LanceDB table 'sap_products'...");
const db = await lancedb.connect("./db");
const table = await db.createTable("sap_products", records, { mode: "overwrite" });
const total = await table.countRows();
console.log(`  ${total} records in 'sap_products' table\n`);

const queries = [
  "in-memory database",
  "human resources",
  "supply chain planning",
  "legacy CRM",
  "low-code development",
];
for (const q of queries) {
  const qvec = await embed(q);
  const hits = await table.search(qvec).limit(3).toArray();
  console.log(`Query: "${q}"`);
  for (const h of hits) {
    const legacy = h.legacy ? " [LEGACY]" : "";
    console.log(`  [${h._distance.toFixed(3)}] ${h.name}${legacy} — ${h.category}`);
  }
  console.log();
}
