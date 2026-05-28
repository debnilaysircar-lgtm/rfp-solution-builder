import * as lancedb from "@lancedb/lancedb";
import { pipeline } from "@huggingface/transformers";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";

const TREES_DIR =
  "C:\\Users\\debnilay.sircar\\OneDrive - Accenture\\1. Initiative\\Operatons_Architeture_Overall\\trees";
const FILES = [
  "EMEA_Architecture_Tree.html",
  "EMEA_Gap_Architecture_Tree.html",
  "SAP_AMS_Architecture_Tree.html",
];

function extractData(html) {
  const m = html.match(/const\s+DATA\s*=\s*(\[[\s\S]*?\])\s*;/);
  if (!m) throw new Error("Could not locate `const DATA = [...]` block");
  return JSON.parse(m[1]);
}

function flatten(data, source) {
  const rows = [];
  for (const sec of data) {
    const section = sec.section;
    const walk = (node, trail) => {
      const path = [...trail, node.text];
      if (node.children && node.children.length) {
        for (const c of node.children) walk(c, path);
      } else {
        rows.push({
          source,
          section,
          path: path.join(" > "),
          text: node.text,
        });
      }
    };
    for (const root of sec.tree) walk(root, [section]);
  }
  return rows;
}

console.log("Loading embedding model...");
const embedder = await pipeline(
  "feature-extraction",
  "Xenova/all-MiniLM-L6-v2"
);
const embed = async (text) => {
  const out = await embedder(text, { pooling: "mean", normalize: true });
  return Array.from(out.data);
};

const allRows = [];
for (const file of FILES) {
  const html = await readFile(`${TREES_DIR}\\${file}`, "utf8");
  const data = extractData(html);
  const rows = flatten(data, basename(file, ".html"));
  console.log(`  ${file}: ${rows.length} leaf nodes`);
  allRows.push(...rows);
}
console.log(`Total: ${allRows.length} nodes to index\n`);

console.log("Embedding (this takes a moment)...");
let done = 0;
const records = [];
for (const r of allRows) {
  const embedInput = `${r.path}`;
  records.push({ ...r, vector: await embed(embedInput) });
  done++;
  if (done % 50 === 0) console.log(`  ${done}/${allRows.length}`);
}
console.log(`  ${done}/${allRows.length} done\n`);

const db = await lancedb.connect("./db");
const table = await db.createTable("arch_trees", records, {
  mode: "overwrite",
});
console.log(`Indexed into LanceDB table 'arch_trees'.\n`);

const queries = [
  "disaster recovery",
  "API management and integration",
  "test automation",
  "data governance",
  "machine learning",
];
for (const q of queries) {
  const qvec = await embed(q);
  const hits = await table.search(qvec).limit(3).toArray();
  console.log(`Query: "${q}"`);
  for (const h of hits) {
    console.log(`  [${h._distance.toFixed(3)}] (${h.source}) ${h.path}`);
  }
  console.log();
}
