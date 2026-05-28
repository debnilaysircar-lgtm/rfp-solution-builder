import * as lancedb from "@lancedb/lancedb";
import { pipeline } from "@huggingface/transformers";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";

const SRC = "C:\\Users\\debnilay.sircar\\sap-products-tree.html";
const TABLE = "sap_products_chunks";
const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;

function decodeEntities(s) {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&mdash;/g, "—")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function htmlToText(html) {
  let s = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ");
  s = s.replace(/<\/(p|div|li|h[1-6]|tr|br|section|article|header|footer|summary|details)>/gi, "\n");
  s = s.replace(/<br\s*\/?>(\s*)/gi, "\n");
  s = s.replace(/<[^>]+>/g, " ");
  s = decodeEntities(s);
  s = s.replace(/[ \t]+/g, " ").replace(/\n[ \t]+/g, "\n").replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

function recursiveSplit(text, size, overlap) {
  if (text.length <= size) return [text];

  const separators = ["\n\n", "\n", ". ", " ", ""];

  function split(t, sepIdx) {
    if (t.length <= size) return [t];
    const sep = separators[sepIdx] ?? "";
    const parts = sep === "" ? t.split("") : t.split(sep);
    const merged = [];
    let buf = "";
    for (const p of parts) {
      const piece = sep === "" ? p : (buf ? sep : "") + p;
      if (buf.length + piece.length <= size) {
        buf += piece;
      } else {
        if (buf) merged.push(buf);
        if (p.length > size && sepIdx < separators.length - 1) {
          merged.push(...split(p, sepIdx + 1));
          buf = "";
        } else {
          buf = p;
        }
      }
    }
    if (buf) merged.push(buf);
    return merged;
  }

  const raw = split(text, 0);

  const chunks = [];
  for (let i = 0; i < raw.length; i++) {
    let chunk = raw[i];
    if (overlap > 0 && i > 0) {
      const prev = raw[i - 1];
      const tail = prev.slice(Math.max(0, prev.length - overlap));
      chunk = tail + (tail.endsWith(" ") || chunk.startsWith(" ") ? "" : " ") + chunk;
    }
    chunks.push(chunk.trim());
  }
  return chunks.filter((c) => c.length > 0);
}

console.log(`Reading ${SRC}...`);
const html = await readFile(SRC, "utf8");
const text = htmlToText(html);
console.log(`  ${text.length.toLocaleString()} chars of cleaned text`);

console.log(`\nChunking (size=${CHUNK_SIZE}, overlap=${CHUNK_OVERLAP})...`);
const chunks = recursiveSplit(text, CHUNK_SIZE, CHUNK_OVERLAP);
console.log(`  ${chunks.length} chunks`);

console.log("\nLoading embedding model (Xenova/all-MiniLM-L6-v2)...");
const embedder = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
const embed = async (t) => {
  const out = await embedder(t, { pooling: "mean", normalize: true });
  return Array.from(out.data);
};

console.log("\nEmbedding chunks...");
const source = basename(SRC);
const records = [];
for (let i = 0; i < chunks.length; i++) {
  records.push({
    id: i,
    source,
    chunk_index: i,
    text: chunks[i],
    char_count: chunks[i].length,
    vector: await embed(chunks[i]),
  });
  if ((i + 1) % 25 === 0) console.log(`  ${i + 1}/${chunks.length}`);
}
console.log(`  ${chunks.length}/${chunks.length} done`);

console.log(`\nWriting to LanceDB table '${TABLE}'...`);
const db = await lancedb.connect("./db");
const table = await db.createTable(TABLE, records, { mode: "overwrite" });
const total = await table.countRows();
console.log(`  ${total} chunks in '${TABLE}'\n`);

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
    const preview = h.text.replace(/\s+/g, " ").slice(0, 110);
    console.log(`  [${h._distance.toFixed(3)}] #${h.chunk_index} — ${preview}${h.text.length > 110 ? "…" : ""}`);
  }
  console.log();
}
