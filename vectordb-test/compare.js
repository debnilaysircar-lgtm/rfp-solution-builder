import * as lancedb from "@lancedb/lancedb";
import { pipeline } from "@huggingface/transformers";

const QUESTION =
  process.argv.slice(2).join(" ") ||
  "What capabilities does the architecture provide for disaster recovery?";
const MODELS = ["phi3.5", "qwen2.5:7b"];
const K = 6;

console.log(`Question: ${QUESTION}\n`);

const embedder = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
const embed = async (t) => {
  const o = await embedder(t, { pooling: "mean", normalize: true });
  return Array.from(o.data);
};

const db = await lancedb.connect("./db");
const arch = await db.openTable("arch_trees");
const sap = await db.openTable("sap_products");

const qv = await embed(QUESTION);
const archHits = (await arch.search(qv).limit(K).toArray()).map((r) => ({
  label: `${r.source} | ${r.path}`,
  snippet: r.text,
  d: r._distance,
}));
const sapHits = (await sap.search(qv).limit(K).toArray()).map((r) => ({
  label: `SAP: ${r.name}${r.acronym ? ` (${r.acronym})` : ""}${r.legacy ? " [LEGACY]" : ""}`,
  snippet: r.description || r.text,
  d: r._distance,
}));
const top = [...archHits, ...sapHits].sort((a, b) => a.d - b.d).slice(0, K);

console.log("Retrieved context:");
top.forEach((h, i) => console.log(`  [${i + 1}] (${h.d.toFixed(3)}) ${h.label}`));
console.log();

const context = top.map((h, i) => `[${i + 1}] ${h.label}\n     ${h.snippet}`).join("\n\n");
const messages = [
  {
    role: "system",
    content:
      "You are an assistant that answers questions about an enterprise architecture taxonomy and the SAP product catalog. " +
      "Answer using ONLY the provided context. Cite sources with bracket numbers like [1], [3]. " +
      "If the context does not contain the answer, say so clearly. Be concise — 1 to 5 sentences.",
  },
  { role: "user", content: `Context items:\n${context}\n\nQuestion: ${QUESTION}` },
];

for (const model of MODELS) {
  console.log("=".repeat(72));
  console.log(`MODEL: ${model}`);
  console.log("=".repeat(72));
  const t0 = Date.now();
  const r = await fetch("http://localhost:11434/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      messages,
      options: { temperature: 0.1, num_predict: 400 },
    }),
  });
  const data = await r.json();
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(data.message?.content?.trim() || `(error: ${JSON.stringify(data)})`);
  console.log(`\n[${elapsed}s · ${data.eval_count || 0} tokens · ${data.prompt_eval_count || 0} prompt tokens]\n`);
}
