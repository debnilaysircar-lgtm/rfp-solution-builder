const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const GEMINI_API_BASE =
  process.env.GEMINI_API_BASE ||
  "https://generativelanguage.googleapis.com/v1beta";
const TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS) || 360_000;

async function _chatJsonOnce(system, user, temperature) {
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
          temperature,
          responseMimeType: "application/json",
        },
      }),
    });
    if (!r.ok) {
      const errText = await r.text().catch(() => "");
      const err = new Error(`Gemini HTTP ${r.status}: ${errText.slice(0, 500)}`);
      err.status = r.status;
      throw err;
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

async function chatJson(system, user, { temperature = 0.3 } = {}) {
  if (!GEMINI_API_KEY) {
    throw new Error(
      "GEMINI_API_KEY is not set — add it to server/.env (and run via the npm scripts so the file is loaded)."
    );
  }
  const backoffs = [0, 2000, 5000, 12000]; // initial attempt + 3 retries
  let lastError = null;
  for (let i = 0; i < backoffs.length; i++) {
    if (backoffs[i] > 0) {
      console.warn(
        `  Gemini retry ${i}/${backoffs.length - 1} in ${backoffs[i]}ms (${lastError?.message || lastError})`
      );
      await new Promise((r) => setTimeout(r, backoffs[i]));
    }
    try {
      return await _chatJsonOnce(system, user, temperature);
    } catch (e) {
      lastError = e;
      const transient = e.status === 429 || (e.status >= 500 && e.status < 600);
      if (!transient) throw e;
    }
  }
  throw lastError || new Error("Gemini chatJson failed after retries");
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

function formatContext(chunks, maxChunks = 8) {
  if (!chunks || chunks.length === 0) return "";
  const blocks = chunks.slice(0, maxChunks).map((c, i) => {
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
    "Produce concise, contract-grade assumptions tailored SPECIFICALLY to this project. " +
    "Use the reference excerpts (from past similar proposals) for tone, depth, and the kinds of clauses typically included, but rewrite for this client; do not name other clients. " +
    "If USER INSTRUCTIONS are provided, they take precedence over all other style guidance. " +
    "Each assumption must be a single sentence. " +
    "CRITICAL — AVOID GENERIC BOILERPLATE. Every assumption must anchor itself in at least one specific element from the project brief: a named in-scope product (e.g. 'SAP S/4HANA Finance', 'SAP BTP Integration Suite'), a specific capability path (e.g. 'incident management for Order-to-Cash'), the contract term/type, the market unit, the delivery window, or content from the user's notes. " +
    "Forbidden patterns: bare clauses like 'The client will provide timely access to systems', 'Documentation will be made available', 'The client will designate a point of contact' — unless each is qualified by exactly WHICH product, environment, capability, or interface. Replace any generic phrasing with a specific named target. " +
    "Vary sentence structure across the list; do not produce templated 'The client will...' clauses repeatedly. Mix subjects (client, Accenture, both parties, third-party vendors, SAP) and grammatical forms. " +
    "Be exhaustive — list every applicable assumption you can justify from the project brief, reference excerpts, and standard SAP AMS practice. Do not artificially limit the count. " +
    "Return strict JSON: { \"assumptions\": string[] }.";
  const user = buildUserMessage({
    task: "Draft engagement-level assumptions for this SAP AMS engagement. Generate as many distinct, non-redundant assumptions as the engagement warrants, each clearly tailored to the specific products, capabilities, and constraints in scope.",
    meta,
    contextChunks,
    userInstructions,
  });
  const out = await chatJson(system, user, { temperature: 0.7 });
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

export async function generateInScope(meta, contextChunks = [], userInstructions = "") {
  const capabilities = Array.isArray(meta.capabilities) ? meta.capabilities : [];
  if (capabilities.length === 0) return [];

  const listing = capabilities.slice(0, 60).map((cap) => {
    const path = String(cap.path || cap.label || "").trim();
    const segs = path.split(" > ").map((s) => s.trim()).filter(Boolean);
    const tower = segs[0] || "General";
    const label = String(cap.label || segs[segs.length - 1] || path).trim();
    return { tower, label };
  }).filter((c) => c.label);
  const towerListing = listing
    .reduce((acc, c) => {
      const last = acc[acc.length - 1];
      if (last && last.tower === c.tower) last.items.push(c.label);
      else acc.push({ tower: c.tower, items: [c.label] });
      return acc;
    }, [])
    .map((g) => `Tower: ${g.tower}\n` + g.items.map((i) => `  - ${i}`).join("\n"))
    .join("\n\n");

  const system =
    "You are a senior SAP AMS solution architect writing the In-Scope section of a Solution Deck and SoW. " +
    "For each capability in CAPABILITIES IN SCOPE, produce ONE very concise scope statement (MAX 18 words, single sentence) describing precisely what Accenture covers for that capability. " +
    "Each statement MUST be specific and tailored: name the SAP product or tool involved, the trigger or cadence (CR / INC / SR / Daily / Weekly / Monthly / Periodic), and the ownership boundary where relevant. " +
    "FORBIDDEN: generic boilerplate such as 'Accenture operates and maintains X under AMS SLAs', 'Accenture provides support for X', or any sentence that reads the same as another row. Each statement must be unique. " +
    "Use the reference excerpts (from past similar SAP AMS proposals) for the kinds of details and phrasing that fit, but rewrite for this client; do not name other clients. " +
    "If USER INSTRUCTIONS are provided, they take precedence over all other style guidance. " +
    "Return strict JSON: { \"inScope\": [ { \"capability\": string (must match the input label exactly), \"tower\": string (must match the input tower), \"scope\": string } ] }. Produce exactly one row per input capability, in the same order.";
  const user = buildUserMessage({
    task:
      "Write a concise tabular In-Scope statement for each capability listed below. One short sentence per row. Order MUST match input.\n\nCAPABILITIES IN SCOPE:\n\n" +
      towerListing,
    meta,
    contextChunks,
    userInstructions,
  });

  const out = await chatJson(system, user, { temperature: 0.6 });
  const items = Array.isArray(out?.inScope) ? out.inScope : [];
  return items
    .map((row) => ({
      capability: String(row?.capability || "").trim(),
      tower: String(row?.tower || "").trim() || "General",
      scope: String(row?.scope || "").trim(),
    }))
    .filter((r) => r.capability && r.scope);
}

export async function generateOutOfScope(meta, contextChunks = [], userInstructions = "") {
  const userOoS = Array.isArray(meta.outOfScope)
    ? meta.outOfScope.filter(Boolean).map((s) => ({ section: "Engagement-level", label: String(s).trim() }))
    : [];
  const gapOoS = Array.isArray(meta.gapTreeOoS)
    ? meta.gapTreeOoS.map((it) => ({
        section: String(it.section || "General").trim(),
        label: String(it.leafLabel || it.label || (it.path || "").split(" > ").pop() || "").trim(),
      }))
    : [];
  const allItems = [...userOoS, ...gapOoS].filter((it) => it.label).slice(0, 60);
  if (allItems.length === 0) return [];

  const grouped = allItems.reduce((acc, it) => {
    const last = acc[acc.length - 1];
    if (last && last.section === it.section) last.items.push(it.label);
    else acc.push({ section: it.section, items: [it.label] });
    return acc;
  }, []);
  const listing = grouped
    .map((g) => `Section: ${g.section}\n` + g.items.map((i) => `  - ${i}`).join("\n"))
    .join("\n\n");

  const system =
    "You are a senior SAP AMS solution architect writing the Out-of-Scope section of a Solution Deck and SoW. " +
    "For each item listed in OUT-OF-SCOPE ITEMS, produce ONE very concise rationale (MAX 22 words, single sentence) explaining WHY it is excluded AND who actually owns it. " +
    "Each rationale MUST be specific: name the responsible party (SAP ECS, client business team, client CISO, 3rd-party SI, hyperscaler, etc.) and the contractual or technical reason for the exclusion. " +
    "FORBIDDEN: generic phrasings like 'X is outside the scope of this AMS engagement' or 'Not in scope; covered separately'. Each rationale must read uniquely and informatively. " +
    "Use the reference excerpts (from past similar SAP AMS proposals) for the kinds of exclusions and rationales that fit; do not name other clients. " +
    "If USER INSTRUCTIONS are provided, they take precedence over all other style guidance. " +
    "Return strict JSON: { \"outOfScope\": [ { \"section\": string (must match input section), \"item\": string (must match input label exactly), \"rationale\": string } ] }. Produce exactly one row per input item, in the same order.";
  const user = buildUserMessage({
    task:
      "Produce a concise tabular Out-of-Scope rationale for each item below. One short sentence per row. Order MUST match input.\n\nOUT-OF-SCOPE ITEMS:\n\n" +
      listing,
    meta,
    contextChunks,
    userInstructions,
  });

  const out = await chatJson(system, user, { temperature: 0.6 });
  const items = Array.isArray(out?.outOfScope) ? out.outOfScope : [];
  return items
    .map((row) => ({
      section: String(row?.section || "").trim() || "General",
      item: String(row?.item || "").trim(),
      rationale: String(row?.rationale || "").trim(),
    }))
    .filter((r) => r.item && r.rationale);
}

export async function generateRaci(meta, contextChunks = [], userInstructions = "") {
  const capabilities = Array.isArray(meta.capabilities) ? meta.capabilities : [];
  if (capabilities.length === 0) return [];

  const towers = new Map();
  for (const cap of capabilities.slice(0, 60)) {
    const path = String(cap.path || cap.label || "").trim();
    const segs = path.split(" > ").map((s) => s.trim()).filter(Boolean);
    const tower = segs[0] || "General";
    const label = String(cap.label || segs[segs.length - 1] || path).trim();
    if (!label) continue;
    if (!towers.has(tower)) towers.set(tower, []);
    towers.get(tower).push(label);
  }
  const towerListing = [...towers.entries()]
    .map(([t, items]) => `Tower: ${t}\n` + items.map((i) => `  - ${i}`).join("\n"))
    .join("\n\n");

  const system =
    "You are a senior SAP AMS solution architect drafting a RACI matrix for an engagement Statement of Work and Solution Deck. " +
    "For each in-scope capability listed in CAPABILITIES IN SCOPE, produce ONE matrix row with: " +
    "(1) capability — the EXACT label as given. " +
    "(2) tower — the EXACT tower name as given. " +
    "(3) activityDetail — one short, contract-grade sentence describing what the activity actually entails (≤25 words, concrete and specific). " +
    "(4) type — exactly one of: 'CR', 'INC', 'SR', 'Periodic', 'CR/INC', 'CR/Periodic', 'INC/Periodic' (Change Request, Incident, Service Request, scheduled cadence, or combo). " +
    "(5) assignments — an object mapping stakeholder column names to RACI letters: 'R', 'A', 'R/A', 'C', or 'I'. " +
    "STAKEHOLDERS: choose realistic SAP AMS engagement parties for the activity. Common options: 'Accenture (AO)' or tower-qualified like 'AO Security' / 'AO BASIS' / 'AO Functional'; client teams such as 'Client Business', 'Client Security', 'Client Basis', 'Client CISO/Audit'; 'SAP ECS' (RISE infrastructure); 'SI Vendor'; 'Hosting Provider'. " +
    "Within a single tower, use a CONSISTENT set of 3 to 5 stakeholder columns across all rows so the matrix is rectangular. Different towers MAY use different stakeholder sets (e.g. Security tower includes 'Client CISO/Audit'; BASIS tower includes 'SAP ECS'). " +
    "Use the reference excerpts (from past similar SAP AMS proposals) for typical splits, but tailor to this engagement; do not name other clients. " +
    "If USER INSTRUCTIONS are provided, they take precedence over all other style guidance. " +
    "CRITICAL — THE MATRIX MUST BE BALANCED. Do NOT default Accenture to R/A on every row. Examples of correct accountability shifts: " +
    "• Pure execution work (role creation, incident triage, performance tuning) → Accenture is R/A. " +
    "• Governance / audit / SOX ITGC / quarterly UAR → client CISO/Audit is A. " +
    "• Break-glass / emergency access / firefighter governance → Client CISO is A, Accenture is R. " +
    "• Activities executed at SAP ECS infrastructure layer (system refresh, OS patch, HANA restore) → SAP ECS is R; Accenture coordinates (C). " +
    "• Mitigation control ownership, SoD remediation acceptance → Client Security or CISO is A. " +
    "• Post-refresh user management, technical user lifecycle → both Accenture AND Client Basis can be R. " +
    "Vary the letters across rows. A matrix where every row reads R/A · A · I will be REJECTED. " +
    "Return strict JSON: { \"raci\": [ { \"capability\": string, \"tower\": string, \"activityDetail\": string, \"type\": string, \"assignments\": { stakeholder: string, ... } } ] }. Produce one row per input capability, in the same order as listed under each tower.";
  const user = buildUserMessage({
    task:
      "Produce a balanced RACI matrix for the following capabilities. Output exactly one row per capability in the order shown.\n\nCAPABILITIES IN SCOPE:\n\n" +
      towerListing,
    meta,
    contextChunks,
    userInstructions,
  });

  const out = await chatJson(system, user, { temperature: 0.6 });
  const items = Array.isArray(out?.raci) ? out.raci : [];

  const validLetter = (v) => {
    const s = String(v || "").trim().toUpperCase();
    if (s === "A/R") return "R/A";
    if (["R", "A", "R/A", "C", "I"].includes(s)) return s;
    return "I";
  };

  return items
    .map((row) => {
      const rawAssign =
        row?.assignments && typeof row.assignments === "object" ? row.assignments : {};
      const assignments = {};
      for (const [k, v] of Object.entries(rawAssign)) {
        const stakeholder = String(k).trim();
        if (stakeholder) assignments[stakeholder] = validLetter(v);
      }
      return {
        capability: String(row?.capability || "").trim(),
        tower: String(row?.tower || "").trim() || "General",
        activityDetail: String(row?.activityDetail || "").trim(),
        type: String(row?.type || "Periodic").trim(),
        assignments,
      };
    })
    .filter((r) => r.capability && Object.keys(r.assignments).length > 0);
}

export async function generateDependencies(meta, contextChunks = [], userInstructions = "") {
  const system =
    "You are a senior SAP AMS solution architect drafting a solution deck. " +
    "List the cross-party dependencies that must be in place for delivery, tailored SPECIFICALLY to this project. " +
    "Use the reference excerpts (from past similar proposals) for the kinds of dependencies typically called out, but rewrite for this client; do not name other clients. " +
    "If USER INSTRUCTIONS are provided, they take precedence over all other style guidance. " +
    "The dependency name must be a short natural-language phrase with spaces (e.g. 'S/4HANA Finance license procurement', 'BTP Integration Suite tenant provisioning'), NOT CamelCase or snake_case. " +
    "Each item must have a short dependency name, a detail sentence, a priority of exactly 'High', 'Med', or 'Low', and a mitigation sentence. " +
    "CRITICAL — AVOID GENERIC BOILERPLATE. Every dependency name and detail must anchor in something concrete from the project brief: a specific named in-scope product, a specific capability path, the contract term, the market unit, the delivery window, or content from the user's notes. " +
    "Forbidden patterns: bare items like 'License procurement', 'Network bandwidth', 'Point of contact' — qualify each: WHICH licenses, for WHICH product, between WHICH parties. Replace generic phrasing with named targets. " +
    "Vary the parties involved across the list (client, Accenture, SAP, SI, hosting provider, third-party ISVs) and the categories (infrastructure, licensing, data, people, contracts, integrations) — do not concentrate on one type. " +
    "Be exhaustive — list every cross-party dependency that could plausibly affect delivery. Do not artificially limit the count. " +
    "Return strict JSON: { \"dependencies\": [{ \"dependency\": string, \"detail\": string, \"priority\": \"High\"|\"Med\"|\"Low\", \"mitigation\": string }] }.";
  const user = buildUserMessage({
    task: "Draft engagement dependencies for this SAP AMS engagement. Generate as many distinct, non-redundant dependencies as the engagement warrants, each clearly tailored to the specific products, capabilities, and constraints in scope.",
    meta,
    contextChunks,
    userInstructions,
  });
  const out = await chatJson(system, user, { temperature: 0.7 });
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
