import * as lancedb from "@lancedb/lancedb";
import { pipeline } from "@huggingface/transformers";

const embedder = await pipeline(
  "feature-extraction",
  "Xenova/all-MiniLM-L6-v2"
);

async function embed(text) {
  const out = await embedder(text, { pooling: "mean", normalize: true });
  return Array.from(out.data);
}

const docs = [
  "Apples are red and grow on trees",
  "The sky appears blue because of light scattering",
  "Cats are domesticated carnivorous mammals",
  "Python is a popular programming language",
  "The Eiffel Tower is in Paris, France",
];

console.log("Embedding documents...");
const rows = await Promise.all(
  docs.map(async (text, i) => ({
    id: i,
    text,
    vector: await embed(text),
  }))
);

const db = await lancedb.connect("./db");
const table = await db.createTable("notes", rows, { mode: "overwrite" });
console.log(`Indexed ${rows.length} documents.\n`);

const queries = ["fruit", "feline pet", "European landmark"];
for (const q of queries) {
  const qvec = await embed(q);
  const results = await table.search(qvec).limit(2).toArray();
  console.log(`Query: "${q}"`);
  for (const r of results) {
    console.log(`  [${r._distance.toFixed(3)}] ${r.text}`);
  }
  console.log();
}
