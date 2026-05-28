import express from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import { fileURLToPath } from "node:url";
import {
  listProducts,
  searchProducts,
  listArchTreeRows,
  buildCapabilityTree,
  searchCapabilities,
  searchSolutions,
  savePastGenerationBatch,
  pastGenerationsStats,
  listFolderEntries,
  getTable,
} from "./lance.js";
import { generatePptx } from "./generate-pptx.js";
import { generateDocx } from "./generate-docx.js";
import {
  generateAssumptions,
  generateDependencies,
  generateNarrativeSections,
} from "./gemini.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR =
  process.env.OUTPUT_DIR || path.join(os.homedir(), "Downloads");
const PORT = process.env.PORT || 4000;

await fs.mkdir(OUTPUT_DIR, { recursive: true });

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", async (_req, res) => {
  try {
    const sap = await getTable("sap_products");
    const arch = await getTable("arch_trees");
    res.json({
      ok: true,
      tables: {
        sap_products: sap ? await sap.countRows() : 0,
        arch_trees: arch ? await arch.countRows() : 0,
      },
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get("/api/folder", async (req, res) => {
  const folderPath = (req.query.path || "").toString();
  if (!folderPath) return res.status(400).json({ error: "missing path" });
  try {
    const entries = await listFolderEntries(folderPath);
    res.json({ path: folderPath, entries });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get("/api/products", async (req, res) => {
  const q = (req.query.q || "").toString().trim();
  const limit = Math.min(parseInt(req.query.limit) || 500, 2000);
  try {
    const items = q
      ? await searchProducts(q, limit)
      : await listProducts({ limit });
    res.json({ items });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/capabilities", async (req, res) => {
  const source = (req.query.source || "SAP_AMS_Architecture_Tree").toString();
  try {
    const rows = await listArchTreeRows(source);
    const tree = buildCapabilityTree(rows);
    res.json({ source, tree, count: rows.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/capability-sources", async (_req, res) => {
  try {
    const t = await getTable("arch_trees");
    if (!t) return res.json({ sources: [] });
    const rows = await t.query().select(["source"]).limit(10000).toArray();
    const sources = [...new Set(rows.map((r) => r.source))].sort();
    res.json({ sources });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/search-capabilities", async (req, res) => {
  const { q, source, limit } = req.body || {};
  try {
    const items = await searchCapabilities(q, source, limit || 20);
    res.json({ items });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/generate", async (req, res) => {
  const {
    clientName,
    projectName,
    products = [],
    capabilities = [],
    deliveryWindow,
    contractTerm,
    notes,
  } = req.body || {};

  if (!clientName || !projectName) {
    return res
      .status(400)
      .json({ error: "clientName and projectName are required" });
  }

  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const slug = projectName.replace(/[^a-z0-9]+/gi, "_");
  const pptxName = `${slug}_Solution_${ts}.pptx`;
  const docxName = `${slug}_SoW_${ts}.docx`;

  // Pull gap tree as the basis for verbose Out-of-Scope content.
  // Use only leaf (lowest-level) nodes — a row is a leaf when no other row's
  // pathStr extends it. Render each leaf as a single complete sentence.
  let gapTreeOoS = [];
  try {
    const gapRows = await listArchTreeRows("EMEA_Gap_Architecture_Tree");
    const allPaths = new Set(gapRows.map((r) => r.pathStr));
    const isLeaf = (path) => {
      const prefix = path + " > ";
      for (const p of allPaths) if (p !== path && p.startsWith(prefix)) return false;
      return true;
    };
    const toSentence = (label) => {
      const clean = String(label || "").trim().replace(/[.\s]+$/, "");
      if (!clean) return "";
      const first = clean.charAt(0).toUpperCase() + clean.slice(1);
      return `${first} is outside the scope of this AMS engagement.`;
    };
    gapTreeOoS = gapRows
      .filter((r) => isLeaf(r.pathStr))
      .map((r) => {
        const segs = r.pathStr.split(" > ").map((s) => s.trim()).filter(Boolean);
        const leafLabel = segs[segs.length - 1];
        const sentence = toSentence(leafLabel);
        return {
          section: segs[0] || "General",
          parent: segs[segs.length - 2] || "",
          label: sentence,
          leafLabel,
          path: r.pathStr,
          narrative: sentence,
        };
      })
      .filter((it) => it.label);
  } catch (e) {
    console.warn("Could not load gap tree:", e.message);
  }

  const meta = {
    ...req.body,
    clientName,
    projectName,
    products,
    capabilities,
    deliveryWindow: deliveryWindow || "",
    contractTerm: contractTerm || "",
    notes: notes || "",
    gapTreeOoS,
    generatedAt: new Date().toISOString(),
  };

  const userAssumptions = Array.isArray(meta.assumptions) ? meta.assumptions : [];

  const productList = (meta.products || [])
    .map((p) => p.name || p.acronym)
    .filter(Boolean)
    .join(", ");
  const capList = (meta.capabilities || [])
    .slice(0, 10)
    .map((c) => c.path || c.label)
    .filter(Boolean)
    .join("; ");
  const assumptionsQuery = `${meta.projectName} ${productList} engagement assumptions scope responsibility split SAP AMS ${capList}`;
  const dependenciesQuery = `${meta.projectName} ${productList} dependencies infrastructure licenses vendor SAP RISE ECS SI handover ${capList}`;
  const narrativeQuery = `${meta.projectName} ${productList} executive summary deliverables risks limited scope exclusions synergy SI to AMS handover ${capList}`;

  const [assumptionsCtx, dependenciesCtx, narrativeCtx] = await Promise.all([
    searchSolutions(assumptionsQuery, 3).catch((e) => {
      console.warn("RAG search (assumptions) failed:", e.message);
      return [];
    }),
    searchSolutions(dependenciesQuery, 3).catch((e) => {
      console.warn("RAG search (dependencies) failed:", e.message);
      return [];
    }),
    searchSolutions(narrativeQuery, 3).catch((e) => {
      console.warn("RAG search (narrative) failed:", e.message);
      return [];
    }),
  ]);
  console.log(
    `RAG: ${assumptionsCtx.length} assumption, ${dependenciesCtx.length} dependency, ${narrativeCtx.length} narrative chunks`
  );

  const userInstructions = String(req.body.userInstructions || "").trim();
  if (userInstructions) {
    console.log(`User instructions (${userInstructions.length} chars): ${userInstructions.slice(0, 200)}${userInstructions.length > 200 ? "…" : ""}`);
  }

  let llmAssumptions = null;
  let llmDependencies = null;
  let llmNarrative = null;
  if (userAssumptions.length === 0) {
    console.log("Calling LLM for assumptions...");
    const t0 = Date.now();
    llmAssumptions = await generateAssumptions(meta, assumptionsCtx, userInstructions).catch((e) => {
      console.warn("LLM assumptions failed:", e.message);
      return null;
    });
    console.log(`  assumptions done in ${Math.round((Date.now() - t0) / 1000)}s`);
  }
  {
    console.log("Calling LLM for dependencies...");
    const t0 = Date.now();
    llmDependencies = await generateDependencies(meta, dependenciesCtx, userInstructions).catch((e) => {
      console.warn("LLM dependencies failed:", e.message);
      return null;
    });
    console.log(`  dependencies done in ${Math.round((Date.now() - t0) / 1000)}s`);
  }
  {
    console.log("Calling LLM for narrative sections (exec summary / risks / deliverables / synergy / exclusions)...");
    const t0 = Date.now();
    llmNarrative = await generateNarrativeSections(meta, narrativeCtx, userInstructions).catch((e) => {
      console.warn("LLM narrative failed:", e.message);
      return null;
    });
    console.log(`  narrative done in ${Math.round((Date.now() - t0) / 1000)}s`);
  }
  if (llmAssumptions && llmAssumptions.length > 0) {
    meta.assumptions = llmAssumptions;
  }
  if (llmDependencies && llmDependencies.length > 0) {
    meta.dependencies = llmDependencies;
  }
  if (llmNarrative) {
    if (llmNarrative.executiveSummary) meta.executiveSummary = llmNarrative.executiveSummary;
    if (llmNarrative.deliverables?.length) meta.deliverables = llmNarrative.deliverables;
    if (llmNarrative.risks?.length) meta.risks = llmNarrative.risks;
    if (llmNarrative.limitedScopeExclusions?.length) meta.limitedScopeExclusions = llmNarrative.limitedScopeExclusions;
    if (llmNarrative.synergy) meta.synergy = llmNarrative.synergy;
  }

  try {
    const pptxPath = path.join(OUTPUT_DIR, pptxName);
    const docxPath = path.join(OUTPUT_DIR, docxName);
    await generatePptx(meta, pptxPath);
    await generateDocx(meta, docxPath);

    // Persist this generation's outcomes for future RAG reuse (best-effort, non-blocking).
    const baseCtx = {
      generationId: ts,
      clientName: meta.clientName,
      projectName: meta.projectName,
      productList,
      capList,
      ts: meta.generatedAt,
    };
    const outcomeEntries = [];
    (meta.assumptions || []).forEach((text, i) =>
      outcomeEntries.push({ ...baseCtx, section: "assumptions", itemIndex: i, text })
    );
    (meta.dependencies || []).forEach((d, i) =>
      outcomeEntries.push({
        ...baseCtx,
        section: "dependencies",
        itemIndex: i,
        text: `[${d.priority}] ${d.dependency}: ${d.detail} (mitigation: ${d.mitigation})`,
      })
    );
    (meta.risks || []).forEach((r, i) =>
      outcomeEntries.push({
        ...baseCtx,
        section: "risks",
        itemIndex: i,
        text: `[I:${r.impactLevel} L:${r.likelihoodLevel}] ${r.risk}: ${r.impact} (mitigation: ${r.mitigation})`,
      })
    );
    (meta.deliverables || []).forEach((text, i) =>
      outcomeEntries.push({ ...baseCtx, section: "deliverables", itemIndex: i, text })
    );
    (meta.limitedScopeExclusions || []).forEach((e, i) =>
      outcomeEntries.push({
        ...baseCtx,
        section: "limitedScopeExclusions",
        itemIndex: i,
        text: `${e.item} — Accenture: ${e.accentureRole}; Owner: ${e.owner}`,
      })
    );
    if (meta.synergy?.siHandover?.length || meta.synergy?.benefits?.length || meta.synergy?.mitigations?.length) {
      const syn = meta.synergy;
      const synText =
        [
          syn.siHandover?.length ? "SI handover: " + syn.siHandover.join(" | ") : null,
          syn.benefits?.length ? "Benefits: " + syn.benefits.join(" | ") : null,
          syn.mitigations?.length ? "Mitigations: " + syn.mitigations.join(" | ") : null,
        ]
          .filter(Boolean)
          .join("\n");
      outcomeEntries.push({ ...baseCtx, section: "synergy", itemIndex: 0, text: synText });
    }
    if (meta.executiveSummary) {
      outcomeEntries.push({ ...baseCtx, section: "executiveSummary", itemIndex: 0, text: meta.executiveSummary });
    }
    savePastGenerationBatch(outcomeEntries)
      .then((rs) => {
        const ok = rs.filter((r) => r.ok).length;
        console.log(`Past-generations stored: ${ok}/${outcomeEntries.length} entries.`);
      })
      .catch((e) => console.warn("savePastGenerationBatch failed:", e.message));

    res.json({
      ok: true,
      generationId: ts,
      outputDir: OUTPUT_DIR,
      pptx: { name: pptxName, url: `/api/download/${pptxName}`, path: pptxPath },
      docx: { name: docxName, url: `/api/download/${docxName}`, path: docxPath },
      llmContent: {
        assumptions: meta.assumptions || [],
        dependencies: meta.dependencies || [],
        risks: meta.risks || [],
        deliverables: meta.deliverables || [],
        limitedScopeExclusions: meta.limitedScopeExclusions || [],
        synergy: meta.synergy || null,
        executiveSummary: meta.executiveSummary || "",
      },
      context: {
        clientName: meta.clientName,
        projectName: meta.projectName,
        productList,
        capList,
      },
    });
  } catch (e) {
    console.error("generate error:", e);
    res.status(500).json({ error: e.message, stack: e.stack });
  }
});

app.get("/api/past-generations/stats", async (_req, res) => {
  try {
    const stats = await pastGenerationsStats();
    res.json(stats);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/download/:name", async (req, res) => {
  const name = path.basename(req.params.name);
  const filePath = path.join(OUTPUT_DIR, name);
  try {
    await fs.access(filePath);
    res.download(filePath);
  } catch {
    res.status(404).json({ error: "file not found" });
  }
});

app.get("/api/recent", async (_req, res) => {
  try {
    const files = await fs.readdir(OUTPUT_DIR);
    const items = await Promise.all(
      files
        .filter((f) => f.endsWith(".pptx") || f.endsWith(".docx"))
        .map(async (f) => {
          const stat = await fs.stat(path.join(OUTPUT_DIR, f));
          return {
            name: f,
            url: `/api/download/${f}`,
            size: stat.size,
            modified: stat.mtime,
          };
        })
    );
    items.sort((a, b) => new Date(b.modified) - new Date(a.modified));
    res.json({ items });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Serve the built React client if present (production deploy on same port).
const CLIENT_DIST = path.resolve(__dirname, "..", "client", "dist");
try {
  await fs.access(CLIENT_DIST);
  app.use(express.static(CLIENT_DIST));
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.sendFile(path.join(CLIENT_DIST, "index.html"));
  });
  console.log(`Serving built client from ${CLIENT_DIST}`);
} catch {
  console.log(`No built client at ${CLIENT_DIST} — API only (run \`npm run build\` in /client to embed the UI).`);
}

app.listen(PORT, () => {
  console.log(`RFP Solution Builder server listening on http://localhost:${PORT}`);
});
