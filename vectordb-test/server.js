import express from "express";
import * as lancedb from "@lancedb/lancedb";
import { pipeline } from "@huggingface/transformers";

const PORT = 3000;
const EMBED_MODEL = "Xenova/all-MiniLM-L6-v2";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const GEMINI_API_BASE =
  process.env.GEMINI_API_BASE ||
  "https://generativelanguage.googleapis.com/v1beta";
const GEMINI_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS) || 120_000;

console.log("Loading embedding model...");
const embedder = await pipeline("feature-extraction", EMBED_MODEL);
const embed = async (text) => {
  const out = await embedder(text, { pooling: "mean", normalize: true });
  return Array.from(out.data);
};

console.log("Opening vector DB...");
const db = await lancedb.connect("./db");
const archTable = await db.openTable("arch_trees");
let sapTable = null;
try {
  sapTable = await db.openTable("sap_products");
} catch (_) {
  console.log("  (sap_products table not present — skipping)");
}
let sapChunksTable = null;
try {
  sapChunksTable = await db.openTable("sap_products_chunks");
} catch (_) {
  console.log("  (sap_products_chunks table not present — skipping)");
}
const SOLUTIONS_DB_PATH = process.env.SOLUTIONS_DB_PATH || "C:\\Users\\debnilay.sircar\\solutions\\db";
let solutionsTable = null;
try {
  const solutionsDb = await lancedb.connect(SOLUTIONS_DB_PATH);
  solutionsTable = await solutionsDb.openTable("chunks");
} catch (e) {
  console.log(`  (solutions DB not available at ${SOLUTIONS_DB_PATH} — skipping: ${e.message})`);
}
const ASK_FEEDBACK_TABLE = "ask_feedback";
let askFeedbackTable = null;
try {
  askFeedbackTable = await db.openTable(ASK_FEEDBACK_TABLE);
} catch (_) {
  console.log("  (ask_feedback table not present — will be created on first save)");
}
const FEEDBACK_TABLE = "feedback";
let feedbackTable = null;
try {
  feedbackTable = await db.openTable(FEEDBACK_TABLE);
  const sample = await feedbackTable.query().limit(1).toArray();
  if (sample.length === 0) {
    // Empty table with no schema — drop it so the first save can create with our schema.
    await db.dropTable(FEEDBACK_TABLE);
    feedbackTable = null;
    console.log("  (feedback table existed but was empty — dropped, will be recreated on first save)");
  }
} catch (_) {
  console.log("  (feedback table not present — will be created on first save)");
}
const archTotal = await archTable.countRows();
const sapTotal = sapTable ? await sapTable.countRows() : 0;
const sapChunksTotal = sapChunksTable ? await sapChunksTable.countRows() : 0;
const solutionsTotal = solutionsTable ? await solutionsTable.countRows() : 0;
const askFeedbackTotal = askFeedbackTable ? await askFeedbackTable.countRows() : 0;
const feedbackTotal = feedbackTable ? await feedbackTable.countRows() : 0;
console.log(`  arch_trees: ${archTotal} records`);
console.log(`  sap_products: ${sapTotal} records`);
console.log(`  sap_products_chunks: ${sapChunksTotal} records`);
console.log(`  solutions (chunks): ${solutionsTotal} records`);
console.log(`  ask_feedback: ${askFeedbackTotal} records`);
console.log(`  feedback (general): ${feedbackTotal} records`);

async function saveGeneralFeedback(entry) {
  const text = String(entry.text || "").trim();
  if (!text) return { ok: false, reason: "empty text" };
  const vector = await embed(text);
  const row = {
    id: String(entry.id || `fb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    text,
    rating: Number(entry.rating ?? 0),
    topic: String(entry.topic || "").trim(),
    ts: new Date().toISOString(),
    vector,
  };
  if (!feedbackTable) {
    try {
      feedbackTable = await db.openTable(FEEDBACK_TABLE);
    } catch {
      feedbackTable = await db.createTable(FEEDBACK_TABLE, [row]);
      return { ok: true, id: row.id, created: true };
    }
  }
  await feedbackTable.add([row]);
  return { ok: true, id: row.id };
}

async function listGeneralFeedback(limit = 50) {
  if (!feedbackTable) return [];
  const rows = await feedbackTable.query().limit(limit).toArray();
  return rows
    .map((r) => ({ id: r.id, text: r.text, rating: r.rating, topic: r.topic, ts: r.ts }))
    .sort((a, b) => (b.ts || "").localeCompare(a.ts || ""));
}

async function searchGeneralFeedback(question, limit = 3) {
  if (!feedbackTable || !question?.trim()) return [];
  const qv = await embed(question);
  const rows = await feedbackTable.search(qv).limit(limit).toArray();
  return rows
    .filter((r) => r._distance <= 1.2)
    .map((r) => ({ text: r.text, rating: r.rating, topic: r.topic, distance: r._distance }));
}

async function saveAskFeedback(entry) {
  const question = String(entry.question || "").trim();
  if (!question) return { ok: false, reason: "empty question" };
  const vector = await embed(question);
  const row = {
    id: String(entry.id || `ask-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    question,
    originalAnswer: String(entry.originalAnswer || ""),
    acceptedAnswer: String(entry.acceptedAnswer || entry.originalAnswer || ""),
    rating: Number(entry.rating ?? 0),
    note: String(entry.note || ""),
    ts: new Date().toISOString(),
    vector,
  };
  if (!askFeedbackTable) {
    try {
      askFeedbackTable = await db.openTable(ASK_FEEDBACK_TABLE);
    } catch {
      askFeedbackTable = await db.createTable(ASK_FEEDBACK_TABLE, [row]);
      return { ok: true, id: row.id, created: true };
    }
  }
  await askFeedbackTable.add([row]);
  return { ok: true, id: row.id };
}

async function searchAskFeedback(question, limit = 5) {
  if (!askFeedbackTable || !question?.trim()) return { positive: [], negative: [] };
  const qv = await embed(question);
  const rows = await askFeedbackTable.search(qv).limit(limit * 2).toArray();
  const positive = [];
  const negative = [];
  for (const r of rows) {
    if (r._distance > 1.2) continue;
    const rec = {
      question: r.question,
      originalAnswer: r.originalAnswer,
      acceptedAnswer: r.acceptedAnswer,
      rating: r.rating,
      note: r.note,
      distance: r._distance,
    };
    if (r.rating >= 1 && positive.length < limit) positive.push(rec);
    else if (r.rating <= -1 && negative.length < limit) negative.push(rec);
  }
  return { positive, negative };
}

async function geminiReady() {
  if (!GEMINI_API_KEY) {
    return { ok: false, error: "GEMINI_API_KEY not set", target: GEMINI_MODEL };
  }
  try {
    const r = await fetch(`${GEMINI_API_BASE}/models`, {
      headers: { "x-goog-api-key": GEMINI_API_KEY },
    });
    if (!r.ok) return { ok: false, error: `HTTP ${r.status}`, target: GEMINI_MODEL };
    const data = await r.json();
    const models = (data.models || []).map((m) =>
      String(m.name || "").replace(/^models\//, "")
    );
    const present = models.some((m) => m === GEMINI_MODEL);
    return { ok: present, models, target: GEMINI_MODEL };
  } catch (e) {
    return { ok: false, error: String(e.message || e), target: GEMINI_MODEL };
  }
}

const app = express();
app.use(express.json());

app.get("/status", async (_req, res) => {
  const llm = await geminiReady();
  const fbTotal = askFeedbackTable ? await askFeedbackTable.countRows() : 0;
  const genFbTotal = feedbackTable ? await feedbackTable.countRows() : 0;
  res.json({
    archTotal,
    sapTotal,
    sapChunksTotal,
    solutionsTotal,
    askFeedbackTotal: fbTotal,
    feedbackTotal: genFbTotal,
    gemini: llm,
  });
});

app.post("/general-feedback", async (req, res) => {
  try {
    const r = await saveGeneralFeedback(req.body || {});
    res.json(r);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get("/general-feedback/list", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const items = await listGeneralFeedback(limit);
    res.json({ items });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/feedback", async (req, res) => {
  try {
    const r = await saveAskFeedback(req.body || {});
    res.json(r);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get("/feedback/stats", async (_req, res) => {
  if (!askFeedbackTable) return res.json({ total: 0, exists: false });
  res.json({ total: await askFeedbackTable.countRows(), exists: true });
});

app.get("/search", async (req, res) => {
  const q = (req.query.q || "").trim();
  const source = req.query.source || "";
  const table = (req.query.table || "arch").toLowerCase();
  const limit = Math.min(parseInt(req.query.limit) || 15, 50);
  if (!q) return res.json({ query: q, results: [] });

  const qvec = await embed(q);
  const target =
    table === "sap" ? sapTable :
    table === "sap_chunks" ? sapChunksTable :
    table === "solutions" ? solutionsTable :
    archTable;
  if (!target) return res.status(404).json({ error: `table '${table}' not loaded` });

  let s = target.search(qvec).limit(limit);
  if (source && table === "arch") {
    s = s.where(`source = '${source.replace(/'/g, "''")}'`);
  }
  const rows = await s.toArray();

  res.json({
    query: q,
    table,
    results: rows.map((r) => {
      if (table === "sap") {
        return {
          name: r.name,
          acronym: r.acronym,
          description: r.description,
          category: r.category,
          legacy: !!r.legacy,
          text: r.text,
          distance: r._distance,
        };
      }
      if (table === "sap_chunks") {
        return {
          source: r.source,
          chunk_index: r.chunk_index,
          char_count: r.char_count,
          text: r.text,
          distance: r._distance,
        };
      }
      if (table === "solutions") {
        return {
          clientFolder: r.clientFolder,
          fileName: r.fileName,
          fileType: r.fileType,
          chunkIdx: r.chunkIdx,
          totalChunks: r.totalChunks,
          text: r.text,
          distance: r._distance,
        };
      }
      return {
        source: r.source,
        section: r.section,
        path: r.path,
        text: r.text,
        distance: r._distance,
      };
    }),
  });
});

app.post("/ask", async (req, res) => {
  const ol = await geminiReady();
  if (!ol.ok) {
    return res.status(503).json({
      error: `Gemini not ready. ${ol.error || `model '${GEMINI_MODEL}' not available`}`,
      detail: ol,
    });
  }

  const q = (req.body?.q || "").trim();
  const k = Math.min(parseInt(req.body?.k) || 10, 25);
  const source = req.body?.source || "";
  const tables = req.body?.tables || ["arch", "sap", "solutions"];
  if (!q) return res.status(400).json({ error: "missing q" });

  const qvec = await embed(q);
  const hits = [];

  if (tables.includes("arch")) {
    let s = archTable.search(qvec).limit(k);
    if (source) s = s.where(`source = '${source.replace(/'/g, "''")}'`);
    const rows = await s.toArray();
    rows.forEach((r) =>
      hits.push({
        kind: "arch",
        label: `${r.source} | ${r.path}`,
        snippet: r.text,
        distance: r._distance,
        meta: { source: r.source, section: r.section, path: r.path },
      })
    );
  }
  if (tables.includes("sap") && sapTable) {
    const rows = await sapTable.search(qvec).limit(k).toArray();
    rows.forEach((r) =>
      hits.push({
        kind: "sap",
        label: `SAP product: ${r.name}${r.acronym ? ` (${r.acronym})` : ""}${r.legacy ? " [LEGACY]" : ""}`,
        snippet: r.description || r.text,
        distance: r._distance,
        meta: { name: r.name, acronym: r.acronym, description: r.description, category: r.category, legacy: !!r.legacy },
      })
    );
  }
  if (tables.includes("sap_chunks") && sapChunksTable) {
    const rows = await sapChunksTable.search(qvec).limit(k).toArray();
    rows.forEach((r) =>
      hits.push({
        kind: "sap_chunks",
        label: `SAP chunk #${r.chunk_index} (${r.source})`,
        snippet: r.text,
        distance: r._distance,
        meta: { source: r.source, chunk_index: r.chunk_index, char_count: r.char_count },
      })
    );
  }
  if (tables.includes("solutions") && solutionsTable) {
    const rows = await solutionsTable.search(qvec).limit(k).toArray();
    rows.forEach((r) =>
      hits.push({
        kind: "solutions",
        label: `Solution doc: ${r.clientFolder} | ${r.fileName} (chunk ${r.chunkIdx + 1}/${r.totalChunks})`,
        snippet: r.text,
        distance: r._distance,
        meta: { clientFolder: r.clientFolder, fileName: r.fileName, fileType: r.fileType, chunkIdx: r.chunkIdx, totalChunks: r.totalChunks },
      })
    );
  }

  hits.sort((a, b) => a.distance - b.distance);
  const top = hits.slice(0, k);

  const context = top
    .map((h, i) => `[${i + 1}] ${h.label}\n     ${h.snippet}`)
    .join("\n\n");

  const fb = await searchAskFeedback(q, 3).catch(() => ({ positive: [], negative: [] }));
  const genFb = await searchGeneralFeedback(q, 3).catch(() => []);
  const fbParts = [];
  if (fb.positive.length) {
    const lines = fb.positive.map(
      (p, i) =>
        `[+${i + 1}] Q: ${p.question}\n     APPROVED ANSWER: ${(p.acceptedAnswer || "").slice(0, 600)}` +
        (p.note ? `\n     NOTE: ${p.note.slice(0, 200)}` : "")
    );
    fbParts.push(
      "USER-APPROVED ANSWERS FROM SIMILAR PAST QUESTIONS (mimic this phrasing and facts when relevant):\n" +
        lines.join("\n")
    );
  }
  if (fb.negative.length) {
    const lines = fb.negative.map(
      (n, i) =>
        `[-${i + 1}] Q: ${n.question}\n     REJECTED ANSWER: ${(n.originalAnswer || "").slice(0, 500)}` +
        (n.note ? `\n     REASON: ${n.note.slice(0, 200)}` : "")
    );
    fbParts.push(
      "USER-REJECTED ANSWERS FROM SIMILAR PAST QUESTIONS (do NOT repeat this style or these claims):\n" +
        lines.join("\n")
    );
  }
  if (genFb.length) {
    const lines = genFb.map((g, i) => {
      const tag = g.rating > 0 ? "PREFERENCE" : g.rating < 0 ? "AVOID" : "GUIDANCE";
      const topic = g.topic ? ` [${g.topic}]` : "";
      return `[${i + 1}] ${tag}${topic}: ${String(g.text).slice(0, 400)}`;
    });
    fbParts.push(
      "GENERAL USER FEEDBACK RELEVANT TO THIS QUESTION (apply unless it conflicts with the provided context):\n" +
        lines.join("\n")
    );
  }
  const fbBlock = fbParts.join("\n\n");

  const system =
    "You are an expert SAP / enterprise-architecture assistant. Answer the user's question fully using BOTH (a) your own knowledge of SAP, enterprise architecture, and AMS engagements, and (b) the retrieved context items provided below. " +
    "Do not refuse to answer just because the context is sparse — fall back on your own knowledge and answer directly. " +
    "When a specific claim is directly supported by one of the retrieved context items, add an inline citation like [1] or [1][3] using only numbers shown in 'Context items:'. Never invent citation numbers. Claims that come from your general knowledge need no citation. " +
    "If the retrieved context contradicts something you'd say from general knowledge, prefer the context — it's curated for this client environment. " +
    "Be informative but concise — typically 3 to 6 sentences. " +
    "Solution-doc excerpts are from past proposals; use them as factual reference but do not name other clients unless directly relevant. " +
    "USER-APPROVED past answers take precedence over context for phrasing; USER-REJECTED past answers must be avoided.";

  const user = (fbBlock ? fbBlock + "\n\n" : "") + `Context items:\n${context}\n\nQuestion: ${q}`;

  const t0 = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), GEMINI_TIMEOUT_MS);
  let data;
  try {
    const r = await fetch(
      `${GEMINI_API_BASE}/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_API_KEY,
        },
        signal: ctrl.signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 600 },
        }),
      }
    );
    if (!r.ok) {
      const text = await r.text();
      return res.status(502).json({ error: `Gemini HTTP ${r.status}`, body: text });
    }
    data = await r.json();
  } finally {
    clearTimeout(timer);
  }
  const candidate = data?.candidates?.[0];
  const answer = candidate?.content?.parts?.[0]?.text || "";
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  const trimmedAnswer = answer.trim();
  const citedSet = new Set();
  for (const m of trimmedAnswer.matchAll(/\[(\d+(?:\s*,\s*\d+)*)\]/g)) {
    for (const part of m[1].split(",")) {
      const n = parseInt(part.trim(), 10);
      if (Number.isFinite(n) && n >= 1 && n <= top.length) citedSet.add(n);
    }
  }
  const citedSources = [...citedSet].sort((a, b) => a - b);

  res.json({
    question: q,
    answer: trimmedAnswer,
    elapsed_seconds: parseFloat(elapsed),
    model: GEMINI_MODEL,
    feedbackUsed: { positive: fb.positive.length, negative: fb.negative.length, general: genFb.length },
    citedSources,
    sources: top.map((h, i) => ({ n: i + 1, kind: h.kind, label: h.label, snippet: h.snippet, distance: h.distance, meta: h.meta })),
  });
});

app.get("/", (_req, res) => res.type("html").send(HTML));

app.listen(PORT, () => console.log(`UI: http://localhost:${PORT}`));

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Architecture + SAP Search & Ask</title>
<style>
  :root {
    --bg:#0d1117; --surface:#161b22; --surface2:#1c2128; --border:#30363d;
    --text:#e6edf3; --muted:#7d8590; --accent:#58a6ff; --accent2:#2f81f7;
  }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:var(--bg); color:var(--text); font:14px/1.5 system-ui, sans-serif; min-height:100vh; }
  .wrap { max-width:1000px; margin:0 auto; padding:32px 24px 80px; }
  h1 { font-size:22px; font-weight:700; margin-bottom:4px; }
  .sub { color:var(--muted); margin-bottom:20px; font-size:13px; }
  .mode-tabs { display:flex; gap:4px; margin-bottom:16px; }
  .mode-tab {
    padding:8px 16px; border-radius:8px; border:1px solid var(--border);
    background:var(--surface); color:var(--muted); cursor:pointer; font:inherit; font-size:13px; font-weight:600;
  }
  .mode-tab.active { background:var(--accent2); color:#fff; border-color:var(--accent2); }
  .bar { display:flex; gap:8px; margin-bottom:16px; flex-wrap:wrap; }
  input, select, textarea, button {
    background:var(--surface); border:1px solid var(--border); color:var(--text);
    padding:10px 14px; border-radius:8px; font:inherit; outline:none;
  }
  input:focus, textarea:focus, select:focus { border-color:var(--accent); }
  #q-search, #q-ask { flex:1; min-width:280px; }
  #q-ask { min-height:60px; resize:vertical; }
  button.primary { background:var(--accent2); color:#fff; border-color:var(--accent2); font-weight:600; cursor:pointer; }
  button.primary:hover { background:var(--accent); }
  button.primary:disabled { opacity:0.5; cursor:not-allowed; }
  .results { display:flex; flex-direction:column; gap:8px; }
  .hit {
    background:var(--surface); border:1px solid var(--border); border-radius:8px;
    padding:12px 14px;
  }
  .hit:hover { border-color:var(--accent); }
  .hit .text { font-weight:600; font-size:15px; margin-bottom:4px; }
  .hit .path { color:var(--muted); font-size:12px; font-family:'DM Mono', monospace; word-break:break-word; }
  .hit .meta { display:flex; gap:10px; align-items:center; margin-top:6px; font-size:11px; flex-wrap:wrap; }
  .badge { padding:2px 8px; border-radius:4px; font-weight:600; background:var(--surface2); border:1px solid var(--border); }
  .badge.legacy { background:rgba(139,92,246,.15); color:#c4b5fd; border-color:rgba(139,92,246,.3); }
  .badge.sap { background:rgba(47,129,247,.15); color:#79c0ff; border-color:rgba(47,129,247,.3); }
  .score { color:var(--muted); font-family:'DM Mono', monospace; }
  .score.good { color:#a3e635; } .score.ok { color:#facc15; } .score.weak { color:var(--muted); }
  .empty { color:var(--muted); padding:30px; text-align:center; }
  .count { color:var(--muted); font-size:12px; margin-bottom:10px; }
  .answer {
    background:rgba(47,129,247,0.08); border:1px solid rgba(47,129,247,0.3);
    border-radius:8px; padding:16px; margin-bottom:16px; font-size:15px; line-height:1.6;
    white-space:pre-wrap;
  }
  .answer-meta { color:var(--muted); font-size:12px; margin-top:8px; font-style:italic; }
  .src-num { color:var(--accent); font-family:'DM Mono', monospace; font-weight:600; }
  .cite {
    color:var(--accent); text-decoration:none; font-weight:600;
    padding:0 2px; border-radius:3px; cursor:pointer; font-family:'DM Mono', monospace;
  }
  .cite:hover { background:rgba(47,129,247,0.15); text-decoration:underline; }
  .hit { scroll-margin-top:20px; transition: background 0.6s, border-color 0.6s; }
  .hit.cited { border-color:rgba(47,129,247,0.45); }
  .hit.uncited { opacity:0.55; }
  .hit.flash { background:rgba(47,129,247,0.22) !important; border-color:var(--accent) !important; }
  .pill { font-size:11px; padding:2px 8px; border-radius:99px; background:var(--surface2); color:var(--muted); }
  .pill.ok { background:rgba(163,230,53,.15); color:#a3e635; }
  .pill.wait { background:rgba(250,204,21,.15); color:#facc15; }
  .pill.err { background:rgba(248,81,73,.15); color:#f85149; }
  .panel { display:none; }
  .panel.active { display:block; }
  .hint { color:var(--muted); font-size:12px; }
  .feedback-box {
    background:var(--surface); border:1px solid var(--border); border-radius:8px;
    padding:12px 14px; margin-bottom:16px; display:flex; flex-direction:column; gap:8px;
  }
  .fb-header { font-size:12px; font-weight:700; color:var(--muted); letter-spacing:0.04em; text-transform:uppercase; }
  .fb-row { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
  .fb-btn {
    background:var(--surface2); border:1px solid var(--border); color:var(--text);
    padding:6px 12px; border-radius:6px; font:inherit; font-size:13px; cursor:pointer;
  }
  .fb-btn:hover { border-color:var(--accent); }
  .fb-btn.active { background:var(--accent2); color:#fff; border-color:var(--accent2); }
  #fb-accepted { min-height:60px; resize:vertical; font:inherit; }
  #fb-note { width:100%; }
  #genfb-text { min-height:100px; flex:1; resize:vertical; font:inherit; }
  .badge.good { background:rgba(163,230,53,.15); color:#a3e635; border-color:rgba(163,230,53,.3); }
  .badge.bad { background:rgba(248,81,73,.15); color:#f85149; border-color:rgba(248,81,73,.3); }
  .hit-fb { display:flex; gap:4px; margin-left:auto; }
  .hit-fb button {
    background:transparent; border:1px solid var(--border); color:var(--muted);
    padding:2px 8px; border-radius:4px; font-size:11px; cursor:pointer; font:inherit;
  }
  .hit-fb button:hover { border-color:var(--accent); color:var(--text); }
  .hit-fb button.good { color:#a3e635; border-color:rgba(163,230,53,.3); background:rgba(163,230,53,.08); }
  .hit-fb button.bad { color:#f85149; border-color:rgba(248,81,73,.3); background:rgba(248,81,73,.08); }
  .hit-fb .saved { color:var(--muted); font-size:11px; padding:2px 6px; }
</style>
</head>
<body>
<div class="wrap">
  <h1>Architecture + SAP Search & Ask</h1>
  <div class="sub">Semantic search + local LLM Q&A · <strong id="arch-total">…</strong> arch nodes · <strong id="sap-total">…</strong> SAP products · <strong id="sap-chunks-total">…</strong> SAP chunks · <strong id="sol-total">…</strong> solution chunks · <strong id="fb-total">…</strong> ask feedback · <strong id="genfb-total">…</strong> general feedback · <span id="llm-pill" class="pill wait">Gemini checking…</span></div>

  <div class="mode-tabs">
    <button class="mode-tab active" data-mode="search">Search</button>
    <button class="mode-tab" data-mode="ask">Ask AI</button>
    <button class="mode-tab" data-mode="feedback">Feedback</button>
  </div>

  <!-- SEARCH PANEL -->
  <div class="panel active" id="panel-search">
    <div class="bar">
      <input id="q-search" type="search" placeholder="e.g. disaster recovery, HANA, low-code..." autofocus>
      <select id="table-search">
        <option value="arch">Architecture trees</option>
        <option value="sap">SAP products (structured)</option>
        <option value="sap_chunks">SAP products (chunks)</option>
        <option value="solutions">Solution docs (past proposals)</option>
      </select>
      <select id="source-search">
        <option value="">All sources</option>
        <option value="EMEA_Architecture_Tree">EMEA</option>
        <option value="EMEA_Gap_Architecture_Tree">EMEA Gap</option>
        <option value="SAP_AMS_Architecture_Tree">SAP AMS</option>
      </select>
      <select id="limit">
        <option value="10">10</option>
        <option value="20" selected>20</option>
        <option value="50">50</option>
      </select>
    </div>
    <div id="search-count" class="count"></div>
    <div id="search-results" class="results"></div>
  </div>

  <!-- ASK PANEL -->
  <div class="panel" id="panel-ask">
    <div class="bar">
      <textarea id="q-ask" placeholder="Ask a question across architecture trees + SAP products..."></textarea>
    </div>
    <div class="bar">
      <button id="ask-btn" class="primary" disabled>Ask</button>
      <span class="hint">Powered by Gemini</span>
    </div>
    <div id="ask-output"></div>
  </div>

  <!-- FEEDBACK PANEL -->
  <div class="panel" id="panel-feedback">
    <div class="hint" style="margin-bottom:12px;">
      Free-form guidance stored in <code>feedback.lance</code>. The LLM retrieves entries semantically related to a question and applies them when answering on the Ask AI tab.
    </div>
    <div class="bar">
      <textarea id="genfb-text" placeholder="What should the assistant know? e.g. 'When asked about HANA migrations, always mention DR planning.' or 'The S/4HANA Cloud public edition is preferred over private.'"></textarea>
    </div>
    <div class="bar">
      <input id="genfb-topic" type="text" placeholder="Optional topic / tag (e.g. HANA, security, scoping)" style="flex:1;" />
      <div class="row" style="gap:4px;">
        <button class="fb-btn" data-rating="1" id="genfb-good">+ preference</button>
        <button class="fb-btn" data-rating="-1" id="genfb-bad">− avoid</button>
        <button class="fb-btn" data-rating="0" id="genfb-neutral">guidance</button>
      </div>
    </div>
    <div class="bar" style="justify-content:flex-end;">
      <span id="genfb-status" class="hint"></span>
      <button id="genfb-save" class="primary" disabled>Save feedback</button>
    </div>

    <div style="margin-top:24px;">
      <div class="fb-header" style="margin-bottom:8px;">Stored feedback</div>
      <div id="genfb-list" class="results"></div>
    </div>
  </div>
</div>

<script>
const $ = (s) => document.querySelector(s);

document.querySelectorAll('.mode-tab').forEach(t => {
  t.addEventListener('click', () => {
    document.querySelectorAll('.mode-tab').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    $('#panel-' + t.dataset.mode).classList.add('active');
    if (t.dataset.mode === 'feedback') loadFeedbackList();
  });
});

async function pollStatus() {
  try {
    const s = await fetch('/status').then(r => r.json());
    $('#arch-total').textContent = s.archTotal;
    $('#sap-total').textContent = s.sapTotal;
    $('#sap-chunks-total').textContent = s.sapChunksTotal ?? 0;
    $('#sol-total').textContent = s.solutionsTotal ?? 0;
    $('#fb-total').textContent = s.askFeedbackTotal ?? 0;
    $('#genfb-total').textContent = s.feedbackTotal ?? 0;
    const pill = $('#llm-pill');
    if (s.gemini.ok) {
      pill.textContent = 'Gemini: ' + s.gemini.target;
      pill.className = 'pill ok';
      $('#ask-btn').disabled = false;
    } else {
      pill.textContent = 'Gemini: ' + (s.gemini.error || 'model not available');
      pill.className = 'pill err';
      pill.title = JSON.stringify(s.gemini);
    }
  } catch (e) {
    $('#llm-pill').textContent = 'status error';
    $('#llm-pill').className = 'pill err';
  }
  setTimeout(pollStatus, 4000);
}
pollStatus();

function scoreClass(d) { return d < 0.6 ? 'good' : d < 1.0 ? 'ok' : 'weak'; }
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
let searchTimer;
function resultChunkText(h, table) {
  if (table === 'sap') return (h.name ? h.name + ' — ' : '') + (h.description || h.text || '');
  if (table === 'sap_chunks') return h.text || '';
  if (table === 'solutions') return h.text || '';
  return h.text || '';
}
function resultLabel(h, table) {
  if (table === 'sap') return 'SAP product: ' + (h.name || '') + (h.acronym ? ' (' + h.acronym + ')' : '');
  if (table === 'sap_chunks') return 'SAP chunk #' + h.chunk_index + ' (' + h.source + ')';
  if (table === 'solutions') return 'Solution doc: ' + h.clientFolder + ' | ' + h.fileName + ' (chunk ' + (h.chunkIdx + 1) + '/' + h.totalChunks + ')';
  return (h.source || '') + ' | ' + (h.path || '');
}

async function runSearch() {
  const q = $('#q-search').value.trim();
  if (!q) { $('#search-results').innerHTML = ''; $('#search-count').textContent = ''; return; }
  const table = $('#table-search').value;
  const p = new URLSearchParams({ q, table, source: $('#source-search').value, limit: $('#limit').value });
  const data = await fetch('/search?' + p).then(r => r.json());
  $('#search-count').textContent = data.results.length + ' result' + (data.results.length===1?'':'s');
  $('#search-results').innerHTML = data.results.length
    ? data.results.map((h, i) => {
      const fbCtl = \`<span class="hit-fb" data-idx="\${i}">
          <button data-rating="1" title="Mark as relevant — boost similar results next time">+ good</button>
          <button data-rating="-1" title="Mark as irrelevant — avoid similar results next time">− bad</button>
        </span>\`;
      if (table === 'sap') {
        return \`
        <div class="hit" data-idx="\${i}">
          <div class="text">\${escapeHtml(h.name)}\${h.acronym ? ' <span class="badge sap">'+escapeHtml(h.acronym)+'</span>' : ''}\${h.legacy ? ' <span class="badge legacy">LEGACY</span>' : ''}</div>
          <div class="path">\${escapeHtml(h.description)}</div>
          <div class="meta">
            <span class="badge">\${escapeHtml(h.category)}</span>
            <span class="score \${scoreClass(h.distance)}">distance \${h.distance.toFixed(3)}</span>
            \${fbCtl}
          </div>
        </div>\`;
      }
      if (table === 'sap_chunks') {
        return \`
        <div class="hit" data-idx="\${i}">
          <div class="text">Chunk #\${h.chunk_index}</div>
          <div class="path">\${escapeHtml(h.text)}</div>
          <div class="meta">
            <span class="badge">\${escapeHtml(h.source)}</span>
            <span class="badge">\${h.char_count} chars</span>
            <span class="score \${scoreClass(h.distance)}">distance \${h.distance.toFixed(3)}</span>
            \${fbCtl}
          </div>
        </div>\`;
      }
      if (table === 'solutions') {
        return \`
        <div class="hit" data-idx="\${i}">
          <div class="text">\${escapeHtml(h.fileName)} <span class="badge">chunk \${h.chunkIdx + 1}/\${h.totalChunks}</span></div>
          <div class="path">\${escapeHtml(h.text)}</div>
          <div class="meta">
            <span class="badge">\${escapeHtml(h.clientFolder)}</span>
            <span class="badge">\${escapeHtml(h.fileType)}</span>
            <span class="score \${scoreClass(h.distance)}">distance \${h.distance.toFixed(3)}</span>
            \${fbCtl}
          </div>
        </div>\`;
      }
      return \`
      <div class="hit" data-idx="\${i}">
        <div class="text">\${escapeHtml(h.text)}</div>
        <div class="path">\${escapeHtml(h.path)}</div>
        <div class="meta">
          <span class="badge">\${escapeHtml(h.source.replace(/_/g,' '))}</span>
          <span class="score \${scoreClass(h.distance)}">distance \${h.distance.toFixed(3)}</span>
          \${fbCtl}
        </div>
      </div>\`;
    }).join('')
    : '<div class="empty">No matches</div>';

  // Wire feedback buttons for each result
  $('#search-results').querySelectorAll('.hit-fb').forEach(group => {
    const idx = Number(group.dataset.idx);
    const h = data.results[idx];
    const chunkText = resultChunkText(h, table);
    const label = resultLabel(h, table);
    group.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', async () => {
        const rating = Number(btn.dataset.rating);
        const otherBtn = group.querySelector(\`button[data-rating="\${-rating}"]\`);
        btn.disabled = true;
        if (otherBtn) otherBtn.disabled = true;
        try {
          const r = await fetch('/feedback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              question: q,
              originalAnswer: chunkText,
              acceptedAnswer: rating === 1 ? chunkText : '',
              rating,
              note: 'search result · ' + label,
            }),
          });
          const j = await r.json();
          if (j.ok) {
            btn.classList.add(rating === 1 ? 'good' : 'bad');
            const saved = document.createElement('span');
            saved.className = 'saved';
            saved.textContent = 'saved';
            group.appendChild(saved);
          } else {
            btn.disabled = false;
            if (otherBtn) otherBtn.disabled = false;
          }
        } catch (e) {
          btn.disabled = false;
          if (otherBtn) otherBtn.disabled = false;
        }
      });
    });
  });
}
$('#q-search').addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(runSearch, 200); });
$('#table-search').addEventListener('change', runSearch);
$('#source-search').addEventListener('change', runSearch);
$('#limit').addEventListener('change', runSearch);

async function runAsk() {
  const q = $('#q-ask').value.trim();
  if (!q) return;
  const btn = $('#ask-btn');
  const out = $('#ask-output');
  btn.disabled = true;
  btn.textContent = 'Thinking…';
  out.innerHTML = '<div class="answer">Generating with Gemini...</div>';
  try {
    const r = await fetch('/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q, k: 10 }),
    });
    const data = await r.json();
    if (data.error) { out.innerHTML = '<div class="answer">Error: ' + escapeHtml(data.error) + '</div>'; return; }
    const fbUsed = data.feedbackUsed || { positive: 0, negative: 0, general: 0 };
    const fbUsedLine = (fbUsed.positive || fbUsed.negative || fbUsed.general)
      ? \` · feedback used: +\${fbUsed.positive} / -\${fbUsed.negative} / \${fbUsed.general || 0} general\`
      : '';
    const citedSet = new Set(data.citedSources || []);
    const validNums = new Set((data.sources || []).map(s => s.n));
    const renderAnswer = (txt) => escapeHtml(txt).replace(/\\[(\\d+(?:\\s*,\\s*\\d+)*)\\]/g, (_m, body) =>
      body.split(',').map(p => p.trim()).filter(p => validNums.has(Number(p)))
        .map(n => \`<a class="cite" data-src="\${n}" href="#src-\${n}">[\${n}]</a>\`).join('')
    );
    out.innerHTML = \`
      <div class="answer">\${renderAnswer(data.answer)}
        <div class="answer-meta">\${data.elapsed_seconds}s · \${escapeHtml(data.model)} via Gemini\${fbUsedLine} · cited \${citedSet.size}/\${(data.sources || []).length} sources</div>
      </div>
      <div class="feedback-box" id="fb-box">
        <div class="fb-header">Train the LLM · feedback on this answer</div>
        <div class="fb-row">
          <button class="fb-btn" data-rating="1" id="fb-good">+ good</button>
          <button class="fb-btn" data-rating="-1" id="fb-bad">− bad</button>
          <span class="hint">Optional: correct the answer or add a note below, then save.</span>
        </div>
        <textarea id="fb-accepted" placeholder="Edit the answer to what it should have said (used as the approved version)…">\${escapeHtml(data.answer)}</textarea>
        <input id="fb-note" type="text" placeholder="Optional note — e.g. why it was wrong, or what to emphasize next time" />
        <div class="fb-row" style="justify-content:flex-end;">
          <span id="fb-status" class="hint"></span>
          <button id="fb-save" class="primary" disabled>Save feedback</button>
        </div>
      </div>
      <div class="count">\${data.sources.length} retrieved sources</div>
      <div class="results">
        \${data.sources.map(s => \`
          <div class="hit \${citedSet.has(s.n) ? 'cited' : 'uncited'}" id="src-\${s.n}">
            <div class="text"><span class="src-num">[\${s.n}]</span> \${escapeHtml(s.label)}</div>
            <div class="path">\${escapeHtml(s.snippet)}</div>
            <div class="meta">
              <span class="badge">\${s.kind === 'sap' ? 'SAP product' : s.kind === 'solutions' ? 'solution doc' : s.kind === 'sap_chunks' ? 'SAP chunk' : 'arch node'}</span>
              <span class="score \${scoreClass(s.distance)}">distance \${s.distance.toFixed(3)}</span>
            </div>
          </div>\`).join('')}
      </div>\`;
    out.querySelectorAll('a.cite').forEach(a => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        const n = a.dataset.src;
        const target = document.getElementById('src-' + n);
        if (!target) return;
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.classList.add('flash');
        setTimeout(() => target.classList.remove('flash'), 1500);
      });
    });
    wireFeedback({ question: data.question, originalAnswer: data.answer });
  } finally {
    btn.disabled = false;
    btn.textContent = 'Ask';
  }
}
$('#ask-btn').addEventListener('click', runAsk);
$('#q-ask').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); runAsk(); }
});

// ---- General feedback tab ----
let genfbRating = 0;
function refreshGenfbState() {
  $('#genfb-good').classList.toggle('active', genfbRating === 1);
  $('#genfb-bad').classList.toggle('active', genfbRating === -1);
  $('#genfb-neutral').classList.toggle('active', genfbRating === 0 && $('#genfb-text').value.trim() !== '');
  $('#genfb-save').disabled = $('#genfb-text').value.trim() === '';
}
$('#genfb-good').addEventListener('click', () => { genfbRating = genfbRating === 1 ? 0 : 1; refreshGenfbState(); });
$('#genfb-bad').addEventListener('click', () => { genfbRating = genfbRating === -1 ? 0 : -1; refreshGenfbState(); });
$('#genfb-neutral').addEventListener('click', () => { genfbRating = 0; refreshGenfbState(); });
$('#genfb-text').addEventListener('input', refreshGenfbState);
$('#genfb-topic').addEventListener('input', refreshGenfbState);
refreshGenfbState();

$('#genfb-save').addEventListener('click', async () => {
  const text = $('#genfb-text').value.trim();
  if (!text) return;
  const btn = $('#genfb-save');
  const status = $('#genfb-status');
  btn.disabled = true;
  status.textContent = 'Saving…';
  try {
    const r = await fetch('/general-feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, rating: genfbRating, topic: $('#genfb-topic').value.trim() }),
    });
    const data = await r.json();
    if (data.ok) {
      status.textContent = 'Saved.';
      $('#genfb-text').value = '';
      $('#genfb-topic').value = '';
      genfbRating = 0;
      refreshGenfbState();
      loadFeedbackList();
    } else {
      status.textContent = 'Error: ' + (data.error || data.reason || 'unknown');
      btn.disabled = false;
    }
  } catch (e) {
    status.textContent = 'Error: ' + e.message;
    btn.disabled = false;
  }
});

async function loadFeedbackList() {
  const list = $('#genfb-list');
  list.innerHTML = '<div class="empty">Loading…</div>';
  try {
    const data = await fetch('/general-feedback/list?limit=100').then(r => r.json());
    if (!data.items || data.items.length === 0) {
      list.innerHTML = '<div class="empty">No feedback saved yet.</div>';
      return;
    }
    list.innerHTML = data.items.map(it => {
      const tag = it.rating > 0 ? 'preference' : it.rating < 0 ? 'avoid' : 'guidance';
      const tagCls = it.rating > 0 ? 'good' : it.rating < 0 ? 'bad' : '';
      return \`
        <div class="hit">
          <div class="text">\${escapeHtml(it.text)}</div>
          <div class="meta">
            <span class="badge \${tagCls}">\${tag}</span>
            \${it.topic ? '<span class="badge">'+escapeHtml(it.topic)+'</span>' : ''}
            <span class="score weak">\${escapeHtml((it.ts || '').slice(0, 19).replace('T', ' '))}</span>
          </div>
        </div>\`;
    }).join('');
  } catch (e) {
    list.innerHTML = '<div class="empty">Error loading: ' + escapeHtml(e.message) + '</div>';
  }
}

function wireFeedback({ question, originalAnswer }) {
  let rating = 0;
  const goodBtn = $('#fb-good');
  const badBtn = $('#fb-bad');
  const saveBtn = $('#fb-save');
  const status = $('#fb-status');
  const accepted = $('#fb-accepted');
  const note = $('#fb-note');
  const refresh = () => {
    goodBtn.classList.toggle('active', rating === 1);
    badBtn.classList.toggle('active', rating === -1);
    saveBtn.disabled = rating === 0 && accepted.value.trim() === originalAnswer.trim() && !note.value.trim();
  };
  goodBtn.onclick = () => { rating = rating === 1 ? 0 : 1; refresh(); };
  badBtn.onclick = () => { rating = rating === -1 ? 0 : -1; refresh(); };
  accepted.oninput = refresh;
  note.oninput = refresh;
  saveBtn.onclick = async () => {
    saveBtn.disabled = true;
    status.textContent = 'Saving…';
    try {
      const r = await fetch('/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          originalAnswer,
          acceptedAnswer: accepted.value.trim() || originalAnswer,
          rating,
          note: note.value.trim(),
        }),
      });
      const data = await r.json();
      if (data.ok) {
        status.textContent = 'Saved. Future answers will use this.';
        saveBtn.textContent = 'Saved';
      } else {
        status.textContent = 'Error: ' + (data.error || data.reason || 'unknown');
        saveBtn.disabled = false;
      }
    } catch (e) {
      status.textContent = 'Error: ' + e.message;
      saveBtn.disabled = false;
    }
  };
  refresh();
}
</script>
</body>
</html>`;
