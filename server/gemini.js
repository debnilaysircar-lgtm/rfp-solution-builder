const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const GEMINI_API_BASE =
  process.env.GEMINI_API_BASE ||
  "https://generativelanguage.googleapis.com/v1beta";
const TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS) || 360_000;

async function chatJson(system, user) {
  if (!GEMINI_API_KEY) {
    throw new Error(
      "GEMINI_API_KEY is not set — add it to server/.env (and run via the npm scripts so the file is loaded)."
    );
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const url = `${GEMINI_API_BASE}/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`;
    const r = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY,
      },
      signal: ctrl.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: {
          temperature: 0.3,
          responseMimeType: "application/json",
        },
      }),
    });
    if (!r.ok) {
      const errText = await r.text().catch(() => "");
      throw new Error(`Gemini HTTP ${r.status}: ${errText.slice(0, 500)}`);
    }
    const data = await r.json();
    const candidate = data?.candidates?.[0];
    const text = candidate?.content?.parts?.[0]?.text || "";
    if (!text) {
      const reason = candidate?.finishReason || "no content";
      throw new Error(`Gemini returned no text (finishReason: ${reason})`);
    }
    return JSON.parse(text);
  } finally {
    clearTimeout(timer);
  }
}

function projectBrief(meta) {
  const products = (meta.products || [])
    .slice(0, 30)
    .map((p) => p.name || p.acronym)
    .filter(Boolean)
    .join(", ");
  const topCaps = (meta.capabilities || [])
    .slice(0, 25)
    .map((c) => c.path || c.label || c.section)
    .filter(Boolean)
    .join("; ");
  return [
    `Client: ${meta.clientName}`,
    `Project: ${meta.projectName}`,
    meta.marketUnit ? `Market unit: ${meta.marketUnit}` : null,
    meta.contractTerm ? `Contract term: ${meta.contractTerm}` : null,
    meta.contractType ? `Contract type: ${meta.contractType}` : null,
    meta.deliveryWindow ? `Delivery window: ${meta.deliveryWindow}` : null,
    products ? `Products in scope: ${products}` : null,
    topCaps ? `Capabilities in scope: ${topCaps}` : null,
    meta.notes ? `Notes: ${meta.notes}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function formatContext(chunks) {
  if (!chunks || chunks.length === 0) return "";
  const blocks = chunks.slice(0, 3).map((c, i) => {
    const trimmed = (c.text || "").replace(/\s+/g, " ").slice(0, 500);
    return `[#${i + 1}]\n${trimmed}`;
  });
  return (
    "REFERENCE EXCERPTS FROM PAST SAP AMS PROPOSALS (inspiration only; do not name other clients):\n\n" +
    blocks.join("\n\n")
  );
}

function formatUserInstructions(text) {
  const s = String(text || "").trim();
  if (!s) return "";
  return (
    "USER INSTRUCTIONS FOR THIS GENERATION (highest priority — override any conflicting style from reference excerpts):\n" +
    s
  );
}

function buildUserMessage({ task, meta, contextChunks, userInstructions }) {
  const ctx = formatContext(contextChunks);
  const instr = formatUserInstructions(userInstructions);
  const parts = [];
  if (instr) parts.push(instr);
  parts.push(`${task}\n\n${projectBrief(meta)}`);
  if (ctx) parts.push(ctx);
  return parts.join("\n\n");
}

export async function generateAssumptions(meta, contextChunks = [], userInstructions = "") {
  const system =
    "You are a senior SAP AMS solution architect drafting an engagement Statement of Work. " +
    "Produce concise, contract-grade assumptions tailored to the project. " +
    "Use the reference excerpts (from past similar proposals) for tone, depth, and the kinds of clauses typically included, but rewrite for this client; do not name other clients. " +
    "If USER INSTRUCTIONS are provided, they take precedence over all other style guidance. " +
    "Each assumption must be a single sentence. " +
    "Be exhaustive — list every applicable assumption you can justify from the project brief, reference excerpts, and standard SAP AMS practice. Do not artificially limit the count. " +
    "Return strict JSON: { \"assumptions\": string[] }.";
  const user = buildUserMessage({
    task: "Draft engagement-level assumptions for this SAP AMS engagement. Generate as many distinct, non-redundant assumptions as the engagement warrants.",
    meta,
    contextChunks,
    userInstructions,
  });
  const out = await chatJson(system, user);
  const items = Array.isArray(out?.assumptions) ? out.assumptions : [];
  return items.map((s) => String(s).trim()).filter(Boolean);
}

export async function generateNarrativeSections(meta, contextChunks = [], userInstructions = "") {
  const system =
    "You are a senior SAP AMS solution architect drafting a solution deck and SoW. " +
    "Produce concise, contract-grade narrative content tailored to this client and the products/capabilities in scope. " +
    "Use the reference excerpts (from past similar proposals) for tone, depth, and structure, but rewrite for this client; do not name other clients. " +
    "Priority and likelihood values must be exactly 'High', 'Med', or 'Low'. Use natural-language phrases with spaces (no CamelCase). " +
    "Return strict JSON with this exact shape:\n" +
    "{\n" +
    '  "executiveSummary": "<one paragraph, 80-130 words, third-person, names the client and project>",\n' +
    '  "deliverables": [<exactly 6 short imperative phrases as strings>],\n' +
    '  "risks": [<exactly 5 items, each {"risk": string, "impact": string, "impactLevel": "High"|"Med"|"Low", "likelihoodLevel": "High"|"Med"|"Low", "mitigation": string}>],\n' +
    '  "limitedScopeExclusions": [<exactly 5 items, each {"item": string, "accentureRole": "Coordination"|"Coordination + testing"|"Coordination + validation"|"Coordination + post-copy steps", "owner": string}>],\n' +
    '  "synergy": {"siHandover": [<exactly 4 bullets>], "benefits": [<exactly 4 bullets>], "mitigations": [<exactly 4 bullets>]}\n' +
    "}\n" +
    "If USER INSTRUCTIONS are provided, they take precedence over all other style guidance.";
  const user = buildUserMessage({
    task: "Draft the narrative content for this SAP AMS engagement.",
    meta,
    contextChunks,
    userInstructions,
  });
  const out = await chatJson(system, user);

  const validLevel = (v) => (["High", "Med", "Low"].includes(v) ? v : "Med");
  const arr = (x) => (Array.isArray(x) ? x : []);

  return {
    executiveSummary: typeof out?.executiveSummary === "string"
      ? out.executiveSummary.trim()
      : "",
    deliverables: arr(out?.deliverables)
      .map((s) => String(s).trim())
      .filter(Boolean)
      .slice(0, 8),
    risks: arr(out?.risks)
      .map((r) => ({
        risk: String(r?.risk || "").trim(),
        impact: String(r?.impact || "").trim(),
        impactLevel: validLevel(r?.impactLevel),
        likelihoodLevel: validLevel(r?.likelihoodLevel),
        mitigation: String(r?.mitigation || "").trim(),
      }))
      .filter((r) => r.risk && r.impact)
      .slice(0, 8),
    limitedScopeExclusions: arr(out?.limitedScopeExclusions)
      .map((l) => ({
        item: String(l?.item || "").trim(),
        accentureRole: String(l?.accentureRole || "Coordination").trim(),
        owner: String(l?.owner || "").trim(),
      }))
      .filter((l) => l.item)
      .slice(0, 8),
    synergy: {
      siHandover: arr(out?.synergy?.siHandover).map((s) => String(s).trim()).filter(Boolean).slice(0, 6),
      benefits: arr(out?.synergy?.benefits).map((s) => String(s).trim()).filter(Boolean).slice(0, 6),
      mitigations: arr(out?.synergy?.mitigations).map((s) => String(s).trim()).filter(Boolean).slice(0, 6),
    },
  };
}

export async function generateDependencies(meta, contextChunks = [], userInstructions = "") {
  const system =
    "You are a senior SAP AMS solution architect drafting a solution deck. " +
    "List the cross-party dependencies that must be in place for delivery. " +
    "Use the reference excerpts (from past similar proposals) for the kinds of dependencies typically called out, but rewrite for this client; do not name other clients. " +
    "If USER INSTRUCTIONS are provided, they take precedence over all other style guidance. " +
    "The dependency name must be a short natural-language phrase with spaces (e.g. 'Network bandwidth', 'License procurement'), NOT CamelCase or snake_case. " +
    "Each item must have a short dependency name, a detail sentence, a priority " +
    "of exactly 'High', 'Med', or 'Low', and a mitigation sentence. " +
    "Be exhaustive — list every cross-party dependency that could plausibly affect delivery. Do not artificially limit the count. " +
    "Return strict JSON: { \"dependencies\": [{ \"dependency\": string, \"detail\": string, \"priority\": \"High\"|\"Med\"|\"Low\", \"mitigation\": string }] }.";
  const user = buildUserMessage({
    task: "Draft engagement dependencies for this SAP AMS engagement. Generate as many distinct, non-redundant dependencies as the engagement warrants.",
    meta,
    contextChunks,
    userInstructions,
  });
  const out = await chatJson(system, user);
  const items = Array.isArray(out?.dependencies) ? out.dependencies : [];
  return items
    .map((d) => ({
      dependency: String(d?.dependency || "").trim(),
      detail: String(d?.detail || "").trim(),
      priority: ["High", "Med", "Low"].includes(d?.priority)
        ? d.priority
        : "Med",
      mitigation: String(d?.mitigation || "").trim(),
    }))
    .filter((d) => d.dependency && d.detail);
}
