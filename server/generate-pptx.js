import PptxGenJS from "pptxgenjs";

// Light theme matching the original Chalhoub template palette.
const COLORS = {
  bg: "FFFFFF",
  surface: "F8F9FB",
  surface2: "EEF1F6",
  border: "D6DBE6",
  text: "0A1B3D",
  muted: "5A6478",
  accent: "4C8DFF",
  accentLight: "7BA8FF",
  brand: "A78BFA",
  brandDark: "7C5BE0",
  white: "FFFFFF",
  navy: "0A1B3D",
  ok: "34D399",
  okDark: "10B981",
  warn: "FCD34D",
  warnDark: "D29922",
  err: "F87171",
  errDark: "DC2626",
};

const FONT = "Calibri";
const SLIDE_W = 13.333;
const SLIDE_H = 7.5;

// ---------------- helpers ----------------

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function groupBy(arr, fn) {
  const m = new Map();
  for (const item of arr) {
    const k = fn(item);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(item);
  }
  return m;
}

function newSlide(pres) {
  const s = pres.addSlide();
  s.background = { color: COLORS.bg };
  return s;
}

function addFooter(slide, pageLabel, clientName, projectName) {
  slide.addShape("rect", {
    x: 0,
    y: 7.15,
    w: SLIDE_W,
    h: 0.02,
    fill: { color: COLORS.border },
    line: { color: COLORS.border },
  });
  slide.addText(
    `Accenture · SAP BG Tech Factory · ${projectName} · ${clientName}  ·  ${pageLabel}`,
    {
      x: 0.4,
      y: 7.2,
      w: 12.5,
      h: 0.25,
      fontSize: 9,
      color: COLORS.muted,
      fontFace: FONT,
      align: "left",
    }
  );
}

function addEyebrow(slide, text, color = COLORS.accent) {
  slide.addText(text, {
    x: 0.5,
    y: 0.35,
    w: 12.3,
    h: 0.32,
    fontSize: 11,
    bold: true,
    color,
    fontFace: FONT,
    charSpacing: 4,
  });
}

function addTitle(slide, text) {
  slide.addText(text, {
    x: 0.5,
    y: 0.7,
    w: 12.3,
    h: 0.6,
    fontSize: 24,
    bold: true,
    color: COLORS.navy,
    fontFace: FONT,
  });
  slide.addShape("rect", {
    x: 0.5,
    y: 1.35,
    w: 0.6,
    h: 0.05,
    fill: { color: COLORS.brand },
    line: { color: COLORS.brand },
  });
}

function addHeader(slide, eyebrow, title) {
  addEyebrow(slide, eyebrow);
  addTitle(slide, title);
}

function addParagraph(slide, text, opts = {}) {
  slide.addText(text, {
    x: opts.x ?? 0.5,
    y: opts.y ?? 1.6,
    w: opts.w ?? 12.3,
    h: opts.h ?? 1.0,
    fontSize: opts.fontSize ?? 13,
    color: opts.color ?? COLORS.text,
    fontFace: FONT,
    valign: opts.valign ?? "top",
    bold: opts.bold,
    italic: opts.italic,
    align: opts.align,
  });
}

function tableHeaderRow(cols, fillColor = COLORS.navy) {
  return cols.map((c) => ({
    text: c,
    options: {
      bold: true,
      color: COLORS.white,
      fill: { color: fillColor },
      fontSize: 10,
      fontFace: FONT,
      valign: "middle",
    },
  }));
}

function tableCell(text, opts = {}) {
  return {
    text: text == null ? "" : String(text),
    options: {
      color: opts.color || COLORS.text,
      fontSize: opts.fontSize ?? 10,
      bold: opts.bold,
      italic: opts.italic,
      fontFace: FONT,
      align: opts.align,
      valign: opts.valign ?? "top",
      fill: opts.fill ? { color: opts.fill } : { color: COLORS.surface },
    },
  };
}

function addKpiTile(slide, x, y, w, h, value, label, valueColor = COLORS.accent) {
  slide.addShape("rect", {
    x,
    y,
    w,
    h,
    fill: { color: COLORS.surface },
    line: { color: COLORS.border, width: 1 },
  });
  slide.addText(value, {
    x,
    y: y + 0.15,
    w,
    h: h * 0.55,
    fontSize: Math.min(48, Math.max(28, h * 18)),
    bold: true,
    color: valueColor,
    fontFace: FONT,
    align: "center",
    valign: "middle",
  });
  slide.addText(label.toUpperCase(), {
    x,
    y: y + h - 0.5,
    w,
    h: 0.35,
    fontSize: 10,
    bold: true,
    color: COLORS.muted,
    fontFace: FONT,
    align: "center",
    charSpacing: 3,
  });
}

// ---------------- slide builders ----------------

function s01_title(pres, meta) {
  const s = newSlide(pres);
  // top accent bar
  s.addShape("rect", {
    x: 0,
    y: 0,
    w: SLIDE_W,
    h: 0.25,
    fill: { color: COLORS.brand },
    line: { color: COLORS.brand },
  });
  // bottom navy band
  s.addShape("rect", {
    x: 0,
    y: 6.5,
    w: SLIDE_W,
    h: 1,
    fill: { color: COLORS.navy },
    line: { color: COLORS.navy },
  });
  s.addShape("rect", {
    x: 0,
    y: 6.5,
    w: 0.6,
    h: 1,
    fill: { color: COLORS.brand },
    line: { color: COLORS.brand },
  });
  s.addText("> accenture", {
    x: 0.6,
    y: 0.55,
    w: 4,
    h: 0.4,
    fontSize: 14,
    bold: true,
    color: COLORS.navy,
    fontFace: FONT,
  });
  s.addText("PREPARED FOR", {
    x: 0.6,
    y: 1.6,
    w: 6,
    h: 0.3,
    fontSize: 11,
    bold: true,
    color: COLORS.accent,
    fontFace: FONT,
    charSpacing: 6,
  });
  s.addText(meta.clientName.toUpperCase(), {
    x: 0.6,
    y: 1.95,
    w: 12,
    h: 0.5,
    fontSize: 18,
    bold: true,
    color: COLORS.navy,
    fontFace: FONT,
  });
  s.addText(`SOLUTION PLAN · ${meta.projectName}`, {
    x: 0.6,
    y: 2.7,
    w: 12,
    h: 0.4,
    fontSize: 12,
    color: COLORS.muted,
    fontFace: FONT,
    charSpacing: 4,
  });
  s.addText("SAP BG", {
    x: 0.6,
    y: 3.4,
    w: 12,
    h: 0.85,
    fontSize: 52,
    bold: true,
    color: COLORS.navy,
    fontFace: FONT,
  });
  s.addText("Tech Factory.", {
    x: 0.6,
    y: 4.25,
    w: 12,
    h: 0.85,
    fontSize: 52,
    bold: true,
    color: COLORS.brand,
    fontFace: FONT,
  });
  s.addText(
    `Solution plan for ${meta.clientName} — SAP technology layer above SAP RISE PCE.`,
    {
      x: 0.6,
      y: 5.2,
      w: 11.5,
      h: 0.45,
      fontSize: 13,
      color: COLORS.text,
      fontFace: FONT,
    }
  );
  const rows = [
    [
      tableCell("CLIENT", { bold: true, color: COLORS.brand, fontSize: 9, fill: COLORS.navy }),
      tableCell("OPPORTUNITY", { bold: true, color: COLORS.brand, fontSize: 9, fill: COLORS.navy }),
      tableCell("MARKET UNIT", { bold: true, color: COLORS.brand, fontSize: 9, fill: COLORS.navy }),
      tableCell("GENERATED", { bold: true, color: COLORS.brand, fontSize: 9, fill: COLORS.navy }),
    ],
    [
      tableCell(meta.clientName, { color: COLORS.white, fontSize: 11, fill: COLORS.navy }),
      tableCell(meta.opportunityId || "—", { color: COLORS.white, fontSize: 11, fill: COLORS.navy }),
      tableCell(meta.marketUnit || "EMEA", { color: COLORS.white, fontSize: 11, fill: COLORS.navy }),
      tableCell(new Date(meta.generatedAt).toLocaleDateString(), { color: COLORS.white, fontSize: 11, fill: COLORS.navy }),
    ],
  ];
  s.addTable(rows, {
    x: 0.8,
    y: 6.65,
    w: 12,
    colW: [3, 3, 3, 3],
    fontFace: FONT,
    border: { type: "none" },
  });
}

function s02_docControl(pres, meta, page) {
  const s = newSlide(pres);
  addHeader(s, "DOCUMENT CONTROL", "Version history.");
  const today = new Date(meta.generatedAt).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const rows = [
    tableHeaderRow(["DATE", "VERSION", "UPDATES", "OWNER", "STATUS"]),
    [
      tableCell(today),
      tableCell("1", { bold: true }),
      tableCell("Initial generated draft — products, capabilities, scope outline."),
      tableCell("Solution Architect"),
      tableCell("Draft", { color: COLORS.warnDark, bold: true }),
    ],
    [
      tableCell("TBD"),
      tableCell("2"),
      tableCell("Internal review — pricing, volumetrics confirmed."),
      tableCell("Engagement Lead"),
      tableCell("Review", { color: COLORS.accent }),
    ],
    [
      tableCell("TBD"),
      tableCell("3"),
      tableCell("Client review cycle 1."),
      tableCell("Client SPOC"),
      tableCell("Pending", { color: COLORS.muted }),
    ],
    [
      tableCell("TBD"),
      tableCell("4"),
      tableCell("Final — released to client."),
      tableCell("Engagement Lead"),
      tableCell("Released", { color: COLORS.okDark, bold: true }),
    ],
  ];
  s.addTable(rows, {
    x: 0.5,
    y: 1.7,
    w: 12.3,
    colW: [1.8, 1.1, 5.2, 2.5, 1.7],
    fontFace: FONT,
    border: { type: "solid", color: COLORS.border, pt: 0.5 },
  });
  addParagraph(
    s,
    `Generated by the RFP Solution Builder from selections against the vector catalog. ${meta.products.length} SAP products and ${meta.capabilities.length} architecture capabilities in scope.`,
    { y: 5.5, fontSize: 11, color: COLORS.muted, italic: true }
  );
  addFooter(s, page, meta.clientName, meta.projectName);
}

function s03_opportunityTeam(pres, meta, page) {
  const s = newSlide(pres);
  addHeader(s, "OPPORTUNITY TEAM", "Proposal team.");
  addParagraph(
    s,
    `Named owners for each service tower and supporting governance, accountable for the solution submitted in this document and for execution at contract start.`,
    { y: 1.55, h: 0.7, fontSize: 12, color: COLORS.muted }
  );
  const team = (meta.team && meta.team.length > 0) ? meta.team : [
    ["Solution Architect", "TBD", "Cross-tower technical solution"],
    ["Engagement Lead", "TBD", "Commercials, governance, escalations"],
    ["Tower Lead — Basis", "TBD", "SAP Basis & Technology Architecture"],
    ["Tower Lead — SolMan / Cloud ALM", "TBD", "Application Lifecycle Management"],
    ["Tower Lead — Security", "TBD", "Authorisations, SoD, audit, firefighter"],
    ["Transition Lead", "TBD", "Knowledge transfer & cutover to AMS"],
    ["Service Delivery Manager", "TBD", "Steady-state ops, SLA, reporting"],
    ["Client SPOC", "TBD", `Single point of contact at ${meta.clientName}`],
  ];
  const rows = [
    tableHeaderRow(["ROLE", "NAME", "COVERAGE"]),
    ...team.map((r) => [
      tableCell(r[0], { bold: true }),
      tableCell(r[1] || "TBD", { color: r[1] ? COLORS.text : COLORS.muted }),
      tableCell(r[2] || "", { color: COLORS.muted }),
    ]),
  ];
  s.addTable(rows, {
    x: 0.5,
    y: 2.4,
    w: 12.3,
    colW: [3.5, 2.5, 6.3],
    fontFace: FONT,
    border: { type: "solid", color: COLORS.border, pt: 0.5 },
  });
  addFooter(s, page, meta.clientName, meta.projectName);
}

function s04_opportunityOverview(pres, meta, page) {
  const s = newSlide(pres);
  addHeader(s, "OPPORTUNITY OVERVIEW", `${meta.projectName} — engagement at a glance.`);
  const body =
    meta.notes ||
    `${meta.clientName} is the client for this engagement. The AMS factory operates the SAP technology layer ` +
      `above SAP RISE PCE. Three integrated towers — SAP Basis & Technology Architecture, SAP SolMan / Cloud ALM, ` +
      `and SAP Security — work together to deliver predictable, audit-ready service against agreed SLAs. ` +
      `Scope covers ${meta.products.length} SAP product${meta.products.length === 1 ? "" : "s"} and ` +
      `${meta.capabilities.length} architecture capabilit${meta.capabilities.length === 1 ? "y" : "ies"}.`;
  addParagraph(s, body, { y: 1.7, h: 2.0, fontSize: 13 });
  const kpis = [
    { v: String(meta.products.length), l: "SAP Products" },
    { v: String(meta.capabilities.length), l: "Capabilities" },
    { v: meta.contractTerm || "TBD", l: "Term" },
    { v: meta.deliveryWindow || "TBD", l: "Service Window" },
  ];
  kpis.forEach((k, i) => {
    const x = 0.5 + i * 3.13;
    addKpiTile(s, x, 4.0, 2.9, 2.5, k.v, k.l);
  });
  addFooter(s, page, meta.clientName, meta.projectName);
}

function s05_dealShape(pres, meta, page) {
  const s = newSlide(pres);
  addHeader(s, "DEAL SHAPE & FINANCIALS", "Commercial shape.");
  s.addShape("rect", {
    x: 0.5,
    y: 1.7,
    w: 5.5,
    h: 4.8,
    fill: { color: COLORS.surface },
    line: { color: COLORS.border, width: 1 },
  });
  s.addText("Total contract revenue", {
    x: 0.7,
    y: 1.9,
    w: 5.1,
    h: 0.3,
    fontSize: 11,
    color: COLORS.muted,
    fontFace: FONT,
    bold: true,
    charSpacing: 3,
  });
  s.addText(meta.contractValue || "TBD", {
    x: 0.7,
    y: 2.3,
    w: 5.1,
    h: 1.5,
    fontSize: 64,
    bold: true,
    color: COLORS.accent,
    fontFace: FONT,
  });
  s.addText(`Over ${meta.contractTerm || "TBD"} term`, {
    x: 0.7,
    y: 3.9,
    w: 5.1,
    h: 0.4,
    fontSize: 13,
    color: COLORS.text,
    fontFace: FONT,
  });
  s.addText("Contract type", {
    x: 0.7,
    y: 4.5,
    w: 2.5,
    h: 0.3,
    fontSize: 10,
    color: COLORS.muted,
    fontFace: FONT,
    bold: true,
  });
  s.addText(meta.contractType || "Fixed · Output-based", {
    x: 0.7,
    y: 4.8,
    w: 4.8,
    h: 0.4,
    fontSize: 14,
    color: COLORS.navy,
    bold: true,
    fontFace: FONT,
  });
  addKpiTile(s, 6.4, 1.7, 3.1, 2.3, meta.cci || "TBD", "Overall CCI %");
  addKpiTile(s, 9.7, 1.7, 3.1, 2.3, "100%", "AO Service Mix");
  s.addText("Pricing model", {
    x: 6.4,
    y: 4.2,
    w: 6.4,
    h: 0.3,
    fontSize: 10,
    color: COLORS.muted,
    bold: true,
    fontFace: FONT,
    charSpacing: 3,
  });
  s.addText(
    "Output-based managed service (fixed monthly run rate). Volumetric review at 3-month Solution Baseline Review; quarterly thereafter.",
    {
      x: 6.4,
      y: 4.55,
      w: 6.4,
      h: 1.5,
      fontSize: 12,
      color: COLORS.text,
      fontFace: FONT,
      valign: "top",
    }
  );
  addFooter(s, page, meta.clientName, meta.projectName);
}

function s06_scopeOverview(pres, meta, page) {
  const s = newSlide(pres);
  addHeader(s, "SCOPE OVERVIEW", "Three towers, one factory.");
  addParagraph(
    s,
    `Accenture operates the SAP technology layer above SAP RISE PCE. The factory is organised as three integrated towers — SAP Basis & Technology Architecture, SAP SolMan / Cloud ALM, and SAP Security — and a transversal automation layer (GenWizard AI-OPS).`,
    { y: 1.55, h: 0.9, fontSize: 12, color: COLORS.muted }
  );
  const capsBySection = groupBy(meta.capabilities, (c) => {
    const segs = (c.path || c.label || "").split(" > ");
    return segs[0] || "General";
  });

  const towers = [
    { name: "SAP Basis", code: "T·01", color: COLORS.accent, key: "SAP Basis" },
    { name: "SolMan / Cloud ALM", code: "T·02", color: COLORS.brand, key: "SolMan / Cloud ALM" },
    { name: "Security", code: "T·03", color: COLORS.warnDark, key: "Security" },
  ];

  towers.forEach((t, i) => {
    const x = 0.5 + i * 4.27;
    const caps = capsBySection.get(t.key) || [];
    s.addShape("rect", {
      x,
      y: 2.7,
      w: 4.0,
      h: 4.3,
      fill: { color: COLORS.surface },
      line: { color: t.color, width: 2 },
    });
    s.addText(t.code, {
      x: x + 0.2,
      y: 2.85,
      w: 3.6,
      h: 0.3,
      fontSize: 11,
      bold: true,
      color: t.color,
      fontFace: FONT,
      charSpacing: 4,
    });
    s.addText(t.name, {
      x: x + 0.2,
      y: 3.15,
      w: 3.6,
      h: 0.5,
      fontSize: 22,
      bold: true,
      color: COLORS.navy,
      fontFace: FONT,
    });
    s.addText(`${caps.length} capabilities in scope`, {
      x: x + 0.2,
      y: 3.75,
      w: 3.6,
      h: 0.3,
      fontSize: 11,
      color: COLORS.muted,
      fontFace: FONT,
    });
    const examples = caps.slice(0, 8);
    const lines = examples
      .map((c) => `• ${(c.path || "").split(" > ").pop()}`)
      .join("\n");
    s.addText(lines || "• (none selected)", {
      x: x + 0.2,
      y: 4.15,
      w: 3.6,
      h: 2.7,
      fontSize: 11,
      color: COLORS.text,
      fontFace: FONT,
      valign: "top",
    });
    if (caps.length > 8) {
      s.addText(`+ ${caps.length - 8} more`, {
        x: x + 0.2,
        y: 6.7,
        w: 3.6,
        h: 0.25,
        fontSize: 9,
        color: COLORS.muted,
        italic: true,
        fontFace: FONT,
      });
    }
  });
  addFooter(s, page, meta.clientName, meta.projectName);
}

function s07_volumetrics(pres, meta, page) {
  const s = newSlide(pres);
  addHeader(s, "VOLUMETRICS", "High level volumetrics");
  addParagraph(
    s,
    `Baseline volumes agreed with ${meta.clientName}. The 3-month Solution Baseline Review re-tests these against actuals; sustained variance triggers a formal commercial review.`,
    { y: 1.55, h: 0.7, fontSize: 12, color: COLORS.muted }
  );
  const v = meta.volumetrics || {};
  const tiles = [
    [v.users || "TBD", "SAP End Users"],
    [v.incidents || "TBD", "Incidents / yr"],
    [v.tickets || "TBD", "Service Tickets / mo"],
    [v.changes || "TBD", "Change Requests / mo"],
    [v.prodSids || "TBD", "Production SIDs"],
    [v.nonProdSids || "TBD", "Non-prod SIDs"],
    [v.saasApps || "TBD", "SaaS Apps"],
    [v.btpServices || "TBD", "BTP Services"],
  ];
  tiles.forEach((t, i) => {
    const x = 0.5 + (i % 4) * 3.13;
    const y = 2.5 + Math.floor(i / 4) * 2.2;
    addKpiTile(s, x, y, 2.9, 2.0, t[0], t[1]);
  });
  addFooter(s, page, meta.clientName, meta.projectName);
}

function s08_solutionOnAPage(pres, meta, page) {
  const s = newSlide(pres);
  addHeader(s, "SOLUTION ON A PAGE", "High Level scope");
  addParagraph(
    s,
    `${meta.clientName} · Business outcomes: always-on commerce · clean core S/4HANA · audit-ready security · predictable cost.`,
    { y: 1.55, h: 0.5, fontSize: 12, color: COLORS.muted }
  );
  const v = meta.volumetrics || {};
  const kpis = [
    [v.users || "TBD", "USERS"],
    [v.incidents || "TBD", "INCIDENTS/YR"],
    [meta.deliveryWindow || "TBD", "SERVICE WINDOW"],
    [meta.contractTerm || "TBD", "TERM"],
  ];
  kpis.forEach((k, i) => {
    const x = 0.5 + i * 3.13;
    addKpiTile(s, x, 2.1, 2.9, 1.6, k[0], k[1]);
  });

  const blocks = [
    {
      title: "SAP PRODUCTS",
      items: meta.products.slice(0, 8).map((p) => p.acronym || p.name),
      more: Math.max(0, meta.products.length - 8),
      color: COLORS.accent,
    },
    {
      title: "CAPABILITIES",
      items: meta.capabilities
        .slice(0, 8)
        .map((c) => (c.path || "").split(" > ").pop()),
      more: Math.max(0, meta.capabilities.length - 8),
      color: COLORS.brand,
    },
    {
      title: "OUTCOMES",
      items: [
        "Predictable AMS run cost",
        "Audit-ready compliance",
        "Continuous improvement via GenAI-OPS",
        "Lower MTTD / MTTR",
        "Clean-core protection",
      ],
      more: 0,
      color: COLORS.okDark,
    },
  ];
  blocks.forEach((b, i) => {
    const x = 0.5 + i * 4.27;
    s.addShape("rect", {
      x,
      y: 3.95,
      w: 4.0,
      h: 3.0,
      fill: { color: COLORS.surface },
      line: { color: b.color, width: 1 },
    });
    s.addText(b.title, {
      x: x + 0.2,
      y: 4.1,
      w: 3.6,
      h: 0.3,
      fontSize: 11,
      bold: true,
      color: b.color,
      fontFace: FONT,
      charSpacing: 4,
    });
    const lines =
      b.items.map((it) => `• ${it}`).join("\n") +
      (b.more > 0 ? `\n+ ${b.more} more` : "");
    s.addText(lines || "• (none)", {
      x: x + 0.2,
      y: 4.5,
      w: 3.6,
      h: 2.4,
      fontSize: 11,
      color: COLORS.text,
      fontFace: FONT,
      valign: "top",
    });
  });
  addFooter(s, page, meta.clientName, meta.projectName);
}

function s09_techArchitecture(pres, meta, page) {
  const s = newSlide(pres);
  addHeader(s, "HIGH-LEVEL TECHNICAL ARCHITECTURE", "Layered view of the managed platform.");
  const layers = [
    { name: "CONSUMPTION · USERS & CHANNELS", color: COLORS.accent },
    { name: "SAP APPLICATIONS · S/4HANA · BTP · SAAS", color: COLORS.accentLight },
    { name: "PLATFORMS · APP SERVERS · INTEGRATION · SSO", color: COLORS.brand },
    { name: "INFRASTRUCTURE · COMPUTE · NETWORK · STORAGE (SAP RISE ECS)", color: COLORS.warnDark },
  ];
  layers.forEach((l, i) => {
    const y = 1.7 + i * 1.25;
    s.addShape("rect", {
      x: 0.5,
      y,
      w: 12.3,
      h: 1.05,
      fill: { color: COLORS.surface },
      line: { color: l.color, width: 1 },
    });
    s.addText(l.name, {
      x: 0.7,
      y: y + 0.15,
      w: 11.9,
      h: 0.3,
      fontSize: 12,
      bold: true,
      color: l.color,
      fontFace: FONT,
      charSpacing: 3,
    });
    let detail = "";
    if (i === 0) {
      const v = meta.volumetrics || {};
      detail = `Store / POS · Office & Finance · HR & Payroll · Buyers (Ariba) · Supply (CAR / EWM) · External partners${v.users ? ` · ${v.users} users` : ""}`;
    } else if (i === 1) {
      detail = meta.products.slice(0, 10).map((p) => p.acronym || p.name).join(" · ") || "—";
    } else if (i === 2) {
      detail = "BTP services · SAP IS · OS layer · DB layer · WebDispatcher · Fiori Launchpad";
    } else {
      detail = "SAP RISE PCE on hyperscaler · DR · network · physical security";
    }
    s.addText(detail, {
      x: 0.7,
      y: y + 0.5,
      w: 11.9,
      h: 0.5,
      fontSize: 11,
      color: COLORS.text,
      fontFace: FONT,
    });
  });
  addFooter(s, page, meta.clientName, meta.projectName);
}

function s10_serviceLevels(pres, meta, page) {
  const s = newSlide(pres);
  addHeader(s, "SERVICE LEVELS", "SLAs and response targets.");
  addParagraph(
    s,
    `Response and resolution are measured against the agreed service window. SLA clock-stop applies for tickets dependent on SAP ECS, SAP OSS support, or any third party. SLA clocks start at Go-Live.`,
    { y: 1.55, h: 0.7, fontSize: 11, color: COLORS.muted }
  );
  const rows = [
    tableHeaderRow(["PRIORITY", "EXAMPLE", "RESPONSE", "RESOLUTION", "AVAILABILITY"]),
    [
      tableCell("P1 · Critical", { bold: true, color: COLORS.errDark }),
      tableCell("Production outage, multiple users affected"),
      tableCell("15 min"),
      tableCell("4 hours"),
      tableCell("99.5%", { color: COLORS.okDark, bold: true }),
    ],
    [
      tableCell("P2 · High", { bold: true, color: COLORS.warnDark }),
      tableCell("Severe degradation, business process impacted"),
      tableCell("30 min"),
      tableCell("8 hours"),
      tableCell("99.0%", { color: COLORS.okDark }),
    ],
    [
      tableCell("P3 · Medium", { bold: true, color: COLORS.accent }),
      tableCell("Limited impact, workaround exists"),
      tableCell("2 hours"),
      tableCell("3 BD"),
      tableCell("98.0%"),
    ],
    [
      tableCell("P4 · Low", { bold: true, color: COLORS.muted }),
      tableCell("Cosmetic, request, or query"),
      tableCell("1 BD"),
      tableCell("5 BD"),
      tableCell("Best effort"),
    ],
  ];
  s.addTable(rows, {
    x: 0.5,
    y: 2.4,
    w: 12.3,
    colW: [2.0, 4.5, 1.6, 1.8, 2.4],
    fontFace: FONT,
    border: { type: "solid", color: COLORS.border, pt: 0.5 },
  });
  addParagraph(
    s,
    `Service window: ${meta.deliveryWindow || "TBD"}. Monthly service reports published 5 BD after period close.`,
    { y: 5.6, h: 0.4, fontSize: 11, color: COLORS.muted, italic: true }
  );
  addFooter(s, page, meta.clientName, meta.projectName);
}

function s11_rolesResponsibilities(pres, meta, page) {
  const s = newSlide(pres);
  addHeader(s, "ROLES & RESPONSIBILITIES", "SAP RISE PCE governs the responsibility split.");
  addParagraph(
    s,
    `The shared responsibility model between Accenture, SAP ECS and ${meta.clientName} is governed by the SAP RISE PCE R&R document — refreshed by SAP twice a year. Where this engagement deviates, the deviation is captured in the addenda below.`,
    { y: 1.55, h: 0.8, fontSize: 11, color: COLORS.muted }
  );
  const r = [
    ["Hyperscaler infra · compute · storage · network", "—", "Owns", "—"],
    ["OS · DB layer (HANA)", "—", "Owns", "—"],
    ["SAP Basis above RISE line · transports · jobs", "Owns", "—", "Coordination"],
    ["Cloud ALM / SolMan · monitoring · DevOps", "Owns", "—", "Coordination"],
    ["Authorisation · SoD · firefighter · access reviews", "Owns", "—", "Approves"],
    ["Functional application support · business processes", "—", "—", "Owns"],
    ["End-user training · master data ownership", "—", "—", "Owns"],
  ];
  const rows = [
    tableHeaderRow(["ACTIVITY DOMAIN", "ACCENTURE", "SAP ECS", meta.clientName.toUpperCase()]),
    ...r.map((row) =>
      row.map((c, i) =>
        tableCell(c, {
          color:
            c === "Owns" ? COLORS.okDark : c === "—" ? COLORS.muted : COLORS.text,
          bold: c === "Owns",
          align: i > 0 ? "center" : undefined,
        })
      )
    ),
  ];
  s.addTable(rows, {
    x: 0.5,
    y: 2.5,
    w: 12.3,
    colW: [5.5, 2.0, 2.0, 2.8],
    fontFace: FONT,
    border: { type: "solid", color: COLORS.border, pt: 0.5 },
  });
  addFooter(s, page, meta.clientName, meta.projectName);
}

function s12_sapLandscape(pres, meta, page) {
  const s = newSlide(pres);
  addHeader(s, "SAP LANDSCAPE OVERVIEW", "Technology Architecture volumetrics");
  const v = meta.volumetrics || {};
  addParagraph(
    s,
    `${v.prodSids || "TBD"} production SIDs, ${v.nonProdSids || "TBD"} non-production SIDs, ${v.saasApps || "TBD"} SaaS applications, ${v.btpServices || "TBD"} PaaS / BTP services in scope.`,
    { y: 1.55, h: 0.7, fontSize: 12, color: COLORS.muted }
  );
  const groups = groupBy(meta.products, (p) => p.category || "Other");
  const groupArr = Array.from(groups.entries()).sort();
  let x = 0.5;
  let y = 2.4;
  const COL_W = 4.0;
  const COL_GAP = 0.13;
  let col = 0;
  for (const [cat, items] of groupArr) {
    const blockH = 0.55 + items.length * 0.32;
    s.addShape("rect", {
      x,
      y,
      w: COL_W,
      h: blockH,
      fill: { color: COLORS.surface },
      line: { color: COLORS.border, width: 1 },
    });
    s.addText(cat, {
      x: x + 0.15,
      y: y + 0.1,
      w: COL_W - 0.2,
      h: 0.35,
      fontSize: 10,
      bold: true,
      color: COLORS.accent,
      fontFace: FONT,
      charSpacing: 3,
    });
    items.forEach((p, i) => {
      s.addText(
        `• ${p.name}${p.acronym ? ` (${p.acronym})` : ""}${p.legacy ? "  ⚠" : ""}`,
        {
          x: x + 0.15,
          y: y + 0.45 + i * 0.3,
          w: COL_W - 0.2,
          h: 0.3,
          fontSize: 10,
          color: COLORS.text,
          fontFace: FONT,
        }
      );
    });
    y += blockH + 0.15;
    if (y + blockH > 6.7) {
      col++;
      x = 0.5 + col * (COL_W + COL_GAP);
      y = 2.4;
    }
  }
  addFooter(s, page, meta.clientName, meta.projectName);
}

function s13_securityVolumetrics(pres, meta, page) {
  const s = newSlide(pres);
  addHeader(s, "SECURITY · VOLUMETRICS", "Security Volumetrics");
  const v = meta.volumetrics || {};
  addParagraph(
    s,
    `Security tickets / month: ${v.securityTickets || "TBD"} (≈3.5% of users raise an access ticket each month). ` +
      `Single-user / role modifications via Incident or SR; multi-role/user changes via CR. ` +
      `Non-PRD support assumed in scope for development authorisations.`,
    { y: 1.55, h: 1.0, fontSize: 11, color: COLORS.muted }
  );
  const tiles = [
    [v.securityTickets || "TBD", "Security tickets / mo"],
    [v.rolesManaged || "TBD", "Roles managed"],
    [v.sodViolations || "TBD", "SoD violations / mo"],
    [v.firefighterSessions || "TBD", "Firefighter / mo"],
  ];
  tiles.forEach((t, i) => {
    const x = 0.5 + (i % 2) * 6.3;
    const y = 2.9 + Math.floor(i / 2) * 2.0;
    addKpiTile(s, x, y, 6.0, 1.7, t[0], t[1]);
  });
  addFooter(s, page, meta.clientName, meta.projectName);
}

// ---- Domain View overviews (5 slides) ----

function domainViewSlide(pres, meta, page, opts) {
  const s = newSlide(pres);
  s.addText(opts.number, {
    x: 0.5,
    y: 0.4,
    w: 1.2,
    h: 1.0,
    fontSize: 60,
    bold: true,
    color: COLORS.brand,
    fontFace: FONT,
  });
  s.addText(opts.title, {
    x: 1.8,
    y: 0.45,
    w: 11,
    h: 0.5,
    fontSize: 22,
    bold: true,
    color: COLORS.navy,
    fontFace: FONT,
  });
  s.addText(opts.subtitle, {
    x: 1.8,
    y: 0.95,
    w: 11,
    h: 0.4,
    fontSize: 12,
    color: COLORS.muted,
    fontFace: FONT,
  });
  s.addText(`SOLUTION PLAN · ${opts.position} / 6`, {
    x: 1.8,
    y: 1.35,
    w: 11,
    h: 0.3,
    fontSize: 9,
    color: COLORS.muted,
    fontFace: FONT,
    charSpacing: 4,
  });

  const items = opts.items || [];
  const groups = groupBy(items, (c) => {
    const segs = (c.path || "").split(" > ");
    return segs[1] || segs[0] || "General";
  });
  const groupArr = Array.from(groups.entries()).slice(0, 6);

  if (groupArr.length === 0) {
    addParagraph(s, "(no capabilities selected for this domain)", {
      y: 3.5,
      h: 0.5,
      fontSize: 14,
      color: COLORS.muted,
      italic: true,
      align: "center",
    });
  } else {
    const cols = Math.min(3, groupArr.length);
    const rowsCount = Math.ceil(groupArr.length / cols);
    const colW = (SLIDE_W - 1.0) / cols - 0.1;
    const rowH = (SLIDE_H - 2.5) / rowsCount - 0.1;
    groupArr.forEach(([groupName, caps], idx) => {
      const c = idx % cols;
      const r = Math.floor(idx / cols);
      const x = 0.5 + c * (colW + 0.1);
      const y = 1.9 + r * (rowH + 0.1);
      s.addShape("rect", {
        x,
        y,
        w: colW,
        h: rowH,
        fill: { color: COLORS.surface },
        line: { color: opts.accent || COLORS.accent, width: 1 },
      });
      s.addText(groupName.toUpperCase(), {
        x: x + 0.15,
        y: y + 0.1,
        w: colW - 0.2,
        h: 0.3,
        fontSize: 10,
        bold: true,
        color: opts.accent || COLORS.accent,
        fontFace: FONT,
        charSpacing: 3,
      });
      s.addText(`${caps.length} component${caps.length === 1 ? "" : "s"}`, {
        x: x + 0.15,
        y: y + 0.4,
        w: colW - 0.2,
        h: 0.25,
        fontSize: 9,
        color: COLORS.muted,
        fontFace: FONT,
      });
      const text =
        caps
          .slice(0, 8)
          .map((c) => `• ${(c.path || "").split(" > ").pop()}`)
          .join("\n") +
        (caps.length > 8 ? `\n+ ${caps.length - 8} more` : "");
      s.addText(text, {
        x: x + 0.15,
        y: y + 0.7,
        w: colW - 0.2,
        h: rowH - 0.85,
        fontSize: 9,
        color: COLORS.text,
        fontFace: FONT,
        valign: "top",
      });
    });
  }
  addFooter(s, page, meta.clientName, meta.projectName);
}

function s14_19_domainViews(pres, meta, startPage) {
  const dvs = [
    {
      number: "01",
      title: "Runtime Architecture",
      subtitle: "What runs live — channels, processing engines, monitoring & enforcement",
      position: 1,
      filter: (k) => /runtime|channel|process/i.test(k),
      accent: COLORS.accent,
    },
    {
      number: "02",
      title: "Dev & Operations  · Part 1 of 2",
      subtitle: "Planning, build, release, environment, governance, monitoring & data ops",
      position: 2,
      filter: (k) => /dev|ops|operations|build|release|environment|plan/i.test(k),
      accent: COLORS.brand,
    },
    {
      number: "02",
      title: "Dev & Operations  · Part 2 of 2",
      subtitle: "Planning, build, release, environment, governance, monitoring & data ops",
      position: 3,
      filter: (k) => /alm|monitor|governance|data\s*ops/i.test(k),
      accent: COLORS.brand,
    },
    {
      number: "03",
      title: "Infrastructure",
      subtitle: "Compute, network, storage, data centre & physical security — the hosting layer",
      position: 4,
      filter: (k) => /infra|compute|network|storage|data\s*centre|physical/i.test(k),
      accent: COLORS.warnDark,
    },
    {
      number: "04",
      title: "Platforms",
      subtitle: "Application servers, integration, SSO, OS, BTP, data warehouse & security platforms",
      position: 5,
      filter: (k) => /platform|integration|sso|os|btp|warehouse|security\s*platform/i.test(k),
      accent: COLORS.accentLight,
    },
    {
      number: "05",
      title: "Data & Applications",
      subtitle: "Data governance, lifecycle, application landscape, security, ALM & documentation",
      position: 6,
      filter: (k) => /data|application|govern|lifecycle|documentation/i.test(k),
      accent: COLORS.okDark,
    },
  ];

  let p = startPage;
  for (const dv of dvs) {
    const itemsForView = meta.capabilities.filter((c) => {
      const segs = (c.path || "").split(" > ");
      const k = (segs[1] || segs[0] || "").toLowerCase();
      return dv.filter(k);
    });
    domainViewSlide(pres, meta, p++, { ...dv, items: itemsForView });
  }
  return p;
}

// ---- In-scope capability narratives (verbose) ----

function inferFrequency(label, path) {
  const t = ((label || "") + " " + (path || "")).toLowerCase();
  if (/\b(monitor|health|alert|backup|log|incident|24x7|24\/7|operation)\b/.test(t)) return "Daily";
  if (/\b(patch|note|kernel|transport|user|auth|access|role|housekeep)\b/.test(t)) return "Weekly";
  if (/\b(sp\b|stack|capacity|tune|performance|review|reporting)\b/.test(t)) return "Monthly";
  if (/\b(audit|drill|compliance|dr\b|disaster|bcp|sox)\b/.test(t)) return "Quarterly";
  if (/\b(upgrade|migration|implementation|setup|install|deploy)\b/.test(t)) return "Project-based";
  return "On-demand";
}

function s20_inScopeFromLLM(pres, meta, startPage) {
  let p = startPage;
  const byTower = groupBy(meta.llmInScope, (r) => r.tower || "General");
  const towers = Array.from(byTower.entries());
  const ROWS_PER_SLIDE = 12;
  let secIdx = 1;
  for (const [tower, rows] of towers) {
    const pages = chunk(rows, ROWS_PER_SLIDE);
    pages.forEach((page, pi) => {
      const s = newSlide(pres);
      addHeader(
        s,
        `IN SCOPE · ${String(secIdx).padStart(2, "0")}  ·  ${tower.toUpperCase()}`,
        `${tower}${pages.length > 1 ? ` — part ${pi + 1} / ${pages.length}` : ""} · concise scope statements`
      );
      const header = tableHeaderRow(["#", "CAPABILITY", "SCOPE"]);
      const tableRows = page.map((row, idx) => [
        tableCell(String(pi * ROWS_PER_SLIDE + idx + 1), { align: "center", color: COLORS.muted, fontSize: 9 }),
        tableCell(row.capability, { bold: true, fontSize: 10 }),
        tableCell(row.scope, { fontSize: 9 }),
      ]);
      s.addTable([header, ...tableRows], {
        x: 0.5,
        y: 1.7,
        w: 12.3,
        colW: [0.5, 3.5, 8.3],
        fontFace: FONT,
        border: { pt: 0.5, color: COLORS.border },
      });
      addFooter(s, p, meta.clientName, meta.projectName);
      p++;
    });
    secIdx++;
  }
  return p;
}

function s20_inScopeNarratives(pres, meta, startPage) {
  let p = startPage;
  if (meta.capabilities.length === 0) {
    const s = newSlide(pres);
    addHeader(s, "IN SCOPE · CAPABILITIES", "No capabilities selected.");
    addFooter(s, p, meta.clientName, meta.projectName);
    return p + 1;
  }
  if (Array.isArray(meta.llmInScope) && meta.llmInScope.length > 0) {
    return s20_inScopeFromLLM(pres, meta, startPage);
  }
  const bySection = groupBy(meta.capabilities, (c) => {
    const segs = (c.path || "").split(" > ");
    return segs[0] || "General";
  });

  const firstSentence = (s) => {
    const t = String(s || "").trim();
    const m = t.match(/^[^.!?]*[.!?]/);
    return (m ? m[0] : t).trim();
  };

  const ROWS_PER_SLIDE = 9;
  let secIdx = 1;
  for (const [section, items] of bySection.entries()) {
    const pages = chunk(items, ROWS_PER_SLIDE);
    pages.forEach((page, pi) => {
      const s = newSlide(pres);
      addHeader(
        s,
        `IN SCOPE · ${String(secIdx).padStart(2, "0")}  ·  ${section.toUpperCase()}`,
        `${section}${pages.length > 1 ? ` — part ${pi + 1} / ${pages.length}` : ""} · capability table`
      );

      const header = tableHeaderRow(["#", "CAPABILITY", "FREQUENCY", "NARRATIVE", "FTE Y1→Y3"]);
      const rows = page.map((cap, idx) => {
        const label = cap.label || (cap.path || "").split(" > ").pop() || "—";
        const hasRealText = cap.text && cap.text.trim() && cap.text.trim() !== label.trim();
        const narrative = hasRealText
          ? firstSentence(cap.text)
          : `Accenture operates and maintains ${label} under the AMS SLAs.`;
        const fteY1 = parseFloat(cap.fteY1) || 0;
        const fteY3 = parseFloat(cap.fteY3) || 0;
        const ftePresent = fteY1 || fteY3;
        const fteText = ftePresent
          ? `${cap.level || "Cons."} · ${fteY1.toFixed(1)} → ${fteY3.toFixed(1)}`
          : "TBD";
        return [
          tableCell(String(pi * ROWS_PER_SLIDE + idx + 1), { align: "center", color: COLORS.muted, fontSize: 9 }),
          tableCell(label, { bold: true, fontSize: 10 }),
          tableCell(cap.frequency || inferFrequency(label, cap.path), { align: "center", fontSize: 9, color: COLORS.accent, bold: true }),
          tableCell(narrative, { fontSize: 9 }),
          tableCell(fteText, { align: "center", bold: ftePresent ? true : false, color: ftePresent ? COLORS.accent : COLORS.muted, fontSize: 9 }),
        ];
      });

      s.addTable([header, ...rows], {
        x: 0.5,
        y: 1.6,
        w: 12.3,
        colW: [0.5, 3.0, 1.3, 6.0, 1.5],
        fontFace: FONT,
        border: { pt: 0.5, color: COLORS.border },
        rowH: 0.5,
      });

      addFooter(s, p, meta.clientName, meta.projectName);
      p++;
    });
    secIdx++;
  }
  return p;
}

// ---- Assumptions ----

function s_assumptions(pres, meta, page) {
  const s = newSlide(pres);
  addHeader(s, "ASSUMPTIONS", "Engagement-level assumptions");
  addParagraph(
    s,
    `The following assumptions govern this engagement. Each invalidated assumption must be logged on the risks slide and may trigger a change request.`,
    { y: 1.55, h: 0.7, fontSize: 11, color: COLORS.muted }
  );
  const items = (meta.assumptions && meta.assumptions.length > 0) ? meta.assumptions : [
    "SAP RISE PCE responsibility split applies; clock-stops apply for ECS-dependent tickets.",
    `${meta.clientName} retains ownership of business processes, master data, and end-user training.`,
    "Third-party vendor coordination is in scope only where explicitly listed.",
    "Volumetrics agreed at signature remain the contractual baseline.",
    "Knowledge transfer from SI vendor is supported; KT duration matches transition window.",
    "Tooling licenses (SolMan / Cloud ALM, Focused Run) are in place at Go-Live.",
    "Production support starts only after a successful Go-Live readiness review.",
    "Non-prod systems are accessible from offshore delivery centres.",
  ];
  const rows = [
    tableHeaderRow(["#", "ASSUMPTION", "OWNER"]),
    ...items.map((a, i) => [
      tableCell(String(i + 1), { bold: true, color: COLORS.accent }),
      tableCell(a),
      tableCell(i % 2 ? meta.clientName : "Accenture", { color: COLORS.muted }),
    ]),
  ];
  s.addTable(rows, {
    x: 0.5,
    y: 2.4,
    w: 12.3,
    colW: [0.6, 9.7, 2.0],
    fontFace: FONT,
    border: { type: "solid", color: COLORS.border, pt: 0.5 },
  });
  addFooter(s, page, meta.clientName, meta.projectName);
  return page + 1;
}

// ---- Out of Scope — LLM-driven tabular (when available); else gap-tree bullets ----

function s_outOfScopeFromLLM(pres, meta, startPage) {
  let page = startPage;
  const ROWS_PER_SLIDE = 10;
  const bySection = groupBy(meta.llmOutOfScope, (r) => r.section || "General");
  const sections = Array.from(bySection.entries());
  let secIdx = 1;
  for (const [section, rows] of sections) {
    const pages = chunk(rows, ROWS_PER_SLIDE);
    pages.forEach((pageRows, pi) => {
      const s = newSlide(pres);
      addHeader(
        s,
        `OUT OF SCOPE · ${String(secIdx).padStart(2, "0")}  ·  ${section.toUpperCase()}`,
        `${section}${pages.length > 1 ? ` — part ${pi + 1} / ${pages.length}` : ""} · concise exclusions and rationale`
      );
      const header = tableHeaderRow(["#", "ITEM", "RATIONALE"]);
      const tableRows = pageRows.map((row, idx) => [
        tableCell(String(pi * ROWS_PER_SLIDE + idx + 1), { align: "center", color: COLORS.muted, fontSize: 9 }),
        tableCell(row.item, { bold: true, fontSize: 10, color: COLORS.warnDark }),
        tableCell(row.rationale, { fontSize: 9 }),
      ]);
      s.addTable([header, ...tableRows], {
        x: 0.5,
        y: 1.7,
        w: 12.3,
        colW: [0.5, 3.5, 8.3],
        fontFace: FONT,
        border: { pt: 0.5, color: COLORS.border },
      });
      addFooter(s, page, meta.clientName, meta.projectName);
      page++;
    });
    secIdx++;
  }
  return page;
}

function s_outOfScope(pres, meta, startPage) {
  if (Array.isArray(meta.llmOutOfScope) && meta.llmOutOfScope.length > 0) {
    return s_outOfScopeFromLLM(pres, meta, startPage);
  }
  let page = startPage;
  const userOoS = (meta.outOfScope || []).map((it) => ({
    section: "Engagement-level",
    label: it,
  }));
  const gapItems = (meta.gapTreeOoS || []).map((it) => ({
    section: it.section || "General",
    label: it.label || (it.path || "").split(" > ").pop() || "—",
  }));
  const allItems = [...userOoS, ...gapItems];
  const bySection = groupBy(allItems, (it) => it.section || "General");

  const sectionEntries = Array.from(bySection.entries());
  const sectionsPerSlide = 3;
  const slides = chunk(sectionEntries, sectionsPerSlide);
  if (slides.length === 0) slides.push([]);

  slides.forEach((batch, si) => {
    const s = newSlide(pres);
    addHeader(
      s,
      "OUT OF SCOPE",
      slides.length > 1
        ? `Capability areas outside the AMS engagement (part ${si + 1} / ${slides.length}).`
        : "Capability areas outside the AMS engagement."
    );
    if (si === 0) {
      addParagraph(
        s,
        `Items below are explicitly outside scope. Ownership remains with ${meta.clientName} or the responsible third party; items may be engaged via Change Request.`,
        { y: 1.55, h: 0.6, fontSize: 11, color: COLORS.muted }
      );
    }
    const colW = 4.1;
    batch.forEach(([section, items], i) => {
      const x = 0.5 + i * colW;
      s.addText(section.toUpperCase(), {
        x: x + 0.05,
        y: 2.3,
        w: colW - 0.2,
        h: 0.35,
        fontSize: 11,
        bold: true,
        color: COLORS.warnDark,
        fontFace: FONT,
        charSpacing: 4,
      });
      const bullets = items.map((it) => `• ${it.label}`).join("\n");
      s.addText(bullets, {
        x: x + 0.05,
        y: 2.7,
        w: colW - 0.2,
        h: 4.5,
        fontSize: 11,
        color: COLORS.text,
        fontFace: FONT,
        valign: "top",
        paraSpaceAfter: 4,
      });
    });
    if (batch.length === 0) {
      addParagraph(s, "No out-of-scope items defined.", {
        y: 2.7,
        h: 0.5,
        fontSize: 12,
        color: COLORS.muted,
      });
    }
    addFooter(s, page, meta.clientName, meta.projectName);
    page++;
  });

  return page;
}

// ---- Service Catalog (4 Security slides — preserved) ----

function serviceCatalogSlide(pres, meta, page, opts) {
  const s = newSlide(pres);
  addHeader(s, `SERVICE CATALOG · ${opts.code}`, opts.title);
  addParagraph(s, opts.subtitle, { y: 1.55, h: 0.5, fontSize: 11, color: COLORS.muted });
  const rows = [
    tableHeaderRow(["ACTIVITY", "ACTIVITY DETAIL", "TYPE", "AO SEC", "CLIENT", "BASIS", "CISO"]),
    ...opts.activities.map((a) => [
      tableCell(a[0], { bold: true }),
      tableCell(a[1], { fontSize: 9 }),
      tableCell(a[2] || "Incident", { color: COLORS.accent, fontSize: 9 }),
      tableCell(a[3] || "R/A", { bold: true, color: COLORS.okDark, align: "center" }),
      tableCell(a[4] || "C", { align: "center", color: COLORS.muted }),
      tableCell(a[5] || "I", { align: "center", color: COLORS.muted }),
      tableCell(a[6] || "I", { align: "center", color: COLORS.muted }),
    ]),
  ];
  s.addTable(rows, {
    x: 0.5,
    y: 2.1,
    w: 12.3,
    colW: [2.2, 5.0, 1.1, 0.8, 0.9, 0.8, 0.8],
    fontFace: FONT,
    border: { type: "solid", color: COLORS.border, pt: 0.5 },
  });
  addFooter(s, page, meta.clientName, meta.projectName);
}

function s_serviceCatalog(pres, meta, startPage) {
  const catalogs = [
    {
      code: "T·03",
      title: "Security — Role Design & Maintenance.",
      subtitle: "Role lifecycle, authorisations, mass changes.",
      activities: [
        ["Role creation", "Create new single / composite roles; authorisations; Tcodes / Fiori apps."],
        ["Role modification", "Update authorisation data; ownership; expiry rules."],
        ["Role deletion", "Decommission roles; reassign holders; archive."],
        ["Mass user re-assignment", "Bulk user / role changes via CR."],
        ["Role catalogue refresh", "Quarterly recertification & cleanup."],
      ],
    },
    {
      code: "T·03",
      title: "Security — Segregation of Duties.",
      subtitle: "SoD ruleset, conflict resolution, mitigations.",
      activities: [
        ["SoD ruleset review & tuning", "Review & tune SoD ruleset in GRC AC / IAG; validate against process risk taxonomy."],
        ["Conflict analysis", "Run user / role conflict reports; classify & resolve."],
        ["Mitigation controls", "Author compensating controls; assign monitors."],
        ["Recertification campaigns", "Quarterly SoD recertification; report to risk forum."],
      ],
    },
    {
      code: "T·03",
      title: "Security — Privileged Access & Firefighter.",
      subtitle: "Emergency access, technical users.",
      activities: [
        ["Firefighter ID lifecycle", "Provision, monitor, deprovision firefighter IDs."],
        ["Firefighter session review", "Daily review of log captures; exceptions to CISO."],
        ["Technical / service user lifecycle", "RFC, background, interface users; non-dialog hardening."],
        ["Privileged account rotation", "Quarterly rotation of break-glass credentials."],
      ],
    },
    {
      code: "T·03",
      title: "Security — Access Review, Compliance & Reporting.",
      subtitle: "Audit, UAR, reporting cadence.",
      activities: [
        ["User Access Review orchestration", "Plan & execute quarterly UAR campaigns; track remediation."],
        ["Audit support", "Provide evidence packs for internal / external audits."],
        ["Compliance reporting", "Monthly security KPI report; quarterly trend pack."],
        ["Access certification", "Annual recertification of role ownership."],
      ],
    },
  ];
  let p = startPage;
  for (const cat of catalogs) {
    serviceCatalogSlide(pres, meta, p++, cat);
  }
  return p;
}

// ---- RACI: LLM-generated when meta.raci is present; otherwise static fallback ----

function raciCellColor(v) {
  if (!v || v === "—") return COLORS.muted;
  if (v.includes("R")) return COLORS.okDark;
  if (v === "A") return COLORS.accent;
  if (v === "I") return COLORS.muted;
  return COLORS.text;
}

function s_raciFromLLM(pres, meta, startPage) {
  let page = startPage;
  const byTower = groupBy(meta.raci, (r) => r.tower || "General");
  const towers = Array.from(byTower.entries());

  towers.forEach(([tower, rows], i) => {
    const stakeholders = [];
    for (const row of rows) {
      for (const k of Object.keys(row.assignments || {})) {
        if (!stakeholders.includes(k)) stakeholders.push(k);
      }
    }
    const stakes = stakeholders.slice(0, 5);

    const rowsPerSlide = 8;
    const pages = chunk(rows, rowsPerSlide);
    pages.forEach((pageRows, pi) => {
      const s = newSlide(pres);
      addHeader(
        s,
        `RACI · TOWER ${String(i + 1).padStart(2, "0")}  ·  ${tower.toUpperCase()}`,
        `Tailored to each in-scope activity${pages.length > 1 ? ` — part ${pi + 1} / ${pages.length}` : ""}.`
      );
      addParagraph(
        s,
        `R = Responsible · A = Accountable · C = Consulted · I = Informed.`,
        { y: 1.55, h: 0.4, fontSize: 11, color: COLORS.muted }
      );

      const activityW = 2.4;
      const detailW = 4.0;
      const typeW = 0.85;
      const stakeW = (12.3 - activityW - detailW - typeW) / Math.max(stakes.length, 1);
      const colW = [activityW, detailW, typeW, ...stakes.map(() => stakeW)];

      const headerCols = ["ACTIVITY", "ACTIVITY DETAIL", "TYPE", ...stakes.map((s) => s.toUpperCase())];

      const tableRows = [
        tableHeaderRow(headerCols),
        ...pageRows.map((row) => {
          const cells = [
            tableCell(row.capability, { bold: true, fontSize: 9 }),
            tableCell(row.activityDetail, { fontSize: 8.5 }),
            tableCell(row.type, { color: COLORS.muted, align: "center", fontSize: 9 }),
          ];
          for (const sk of stakes) {
            const v = row.assignments?.[sk] || "—";
            cells.push(tableCell(v, {
              bold: v !== "—",
              color: raciCellColor(v),
              align: "center",
              fontSize: 9,
            }));
          }
          return cells;
        }),
      ];

      s.addTable(tableRows, {
        x: 0.5,
        y: 2.05,
        w: 12.3,
        colW,
        fontFace: FONT,
        border: { type: "solid", color: COLORS.border, pt: 0.5 },
      });
      addFooter(s, page, meta.clientName, meta.projectName);
      page++;
    });
  });
  return page;
}

function s_raci(pres, meta, startPage) {
  let page = startPage;
  if (meta.capabilities.length === 0) {
    const s = newSlide(pres);
    addHeader(s, "RACI", "No capabilities selected.");
    addFooter(s, page, meta.clientName, meta.projectName);
    return page + 1;
  }
  if (Array.isArray(meta.raci) && meta.raci.length > 0) {
    return s_raciFromLLM(pres, meta, startPage);
  }
  const bySection = groupBy(meta.capabilities, (c) => {
    const segs = (c.path || "").split(" > ");
    return segs[0] || "General";
  });
  const sections = Array.from(bySection.entries());

  sections.forEach(([section, caps], i) => {
    const rowsPerSlide = 10;
    const pages = chunk(caps, rowsPerSlide);
    pages.forEach((page_caps, pi) => {
      const s = newSlide(pres);
      addHeader(
        s,
        `RACI · TOWER ${String(i + 1).padStart(2, "0")}  ·  ${section.toUpperCase()}`,
        `Built from in-scope capabilities${pages.length > 1 ? ` — part ${pi + 1} / ${pages.length}` : ""}.`
      );
      addParagraph(
        s,
        `R = Responsible · A = Accountable · C = Consulted · I = Informed. RACI for each in-scope capability under ${section}.`,
        { y: 1.55, h: 0.45, fontSize: 11, color: COLORS.muted }
      );
      const rows = [
        tableHeaderRow(["CAPABILITY", "ACCENTURE", meta.clientName.toUpperCase(), "SAP (ECS)"]),
        ...page_caps.map((cap) => [
          tableCell(cap.label || (cap.path || "").split(" > ").pop(), { bold: true }),
          tableCell("R/A", { bold: true, color: COLORS.okDark, align: "center" }),
          tableCell("A", { color: COLORS.accent, align: "center", bold: true }),
          tableCell("I", { color: COLORS.muted, align: "center" }),
        ]),
      ];
      s.addTable(rows, {
        x: 0.5,
        y: 2.15,
        w: 12.3,
        colW: [6.5, 1.95, 1.95, 1.9],
        fontFace: FONT,
        border: { type: "solid", color: COLORS.border, pt: 0.5 },
      });
      addFooter(s, page, meta.clientName, meta.projectName);
      page++;
    });
  });
  return page;
}

// ---- remaining slides ----

function s_limitedScopeExclusions(pres, meta, page) {
  const s = newSlide(pres);
  addHeader(s, "LIMITED SCOPE EXCLUSIONS", "In scope — coordination only.");
  addParagraph(
    s,
    `These activities remain partially in scope. Accenture coordinates execution with SAP ECS or owning teams; ownership of planning, execution and post-activity validation sits elsewhere.`,
    { y: 1.55, h: 0.7, fontSize: 11, color: COLORS.muted }
  );
  const items = Array.isArray(meta.limitedScopeExclusions) && meta.limitedScopeExclusions.length > 0
    ? meta.limitedScopeExclusions.map((e) => [e.item, e.accentureRole, e.owner])
    : [
        ["Hyperscaler infra changes", "Coordination", "SAP ECS"],
        ["Database refresh (system copy)", "Coordination + post-copy steps", "SAP ECS"],
        ["Major version upgrades (HANA, S/4)", "Coordination + testing", "SAP / Client"],
        ["DR failover drill", "Coordination + validation", "SAP ECS"],
        ["Penetration testing", "Coordination", `${meta.clientName} CISO`],
        ["Master-data cleanup", "Coordination", meta.clientName],
        ["Functional design changes", "Coordination", "AO functional"],
      ];
  const rows = [
    tableHeaderRow(["#", "ITEM", "ACCENTURE ROLE", "OWNER"]),
    ...items.map((it, i) => [
      tableCell(String(i + 1), { bold: true, color: COLORS.accent }),
      tableCell(it[0]),
      tableCell(it[1], { color: COLORS.warnDark }),
      tableCell(it[2], { color: COLORS.muted }),
    ]),
  ];
  s.addTable(rows, {
    x: 0.5,
    y: 2.4,
    w: 12.3,
    colW: [0.6, 5.5, 3.6, 2.6],
    fontFace: FONT,
    border: { type: "solid", color: COLORS.border, pt: 0.5 },
  });
  addFooter(s, page, meta.clientName, meta.projectName);
  return page + 1;
}

function s_dependencies(pres, meta, page) {
  const s = newSlide(pres);
  addHeader(s, "DEPENDENCIES", "What we need from each party.");
  const fromMeta = Array.isArray(meta.dependencies) && meta.dependencies.length > 0
    ? meta.dependencies.map((d) => [d.dependency, d.detail, d.priority, d.mitigation])
    : null;
  const deps = fromMeta || [
    ["ECS SR lead time", "All infra-layer actions (OS, HANA, storage, network, compute) require SR with 3–5 BD standard lead time.", "High", "Pre-agree emergency channel; cache common SRs."],
    ["Client SPOC availability", "Decision-making during steady-state.", "Med", "Define escalation matrix; named back-ups."],
    ["Tooling licenses", "Cloud ALM / Focused Run licenses in place at Go-Live.", "High", "License procurement on critical path."],
    ["KT from SI vendor", "Knowledge transfer of customisations & integrations.", "High", "Joint KT plan with measurable deliverables."],
    ["Audit cadence", "Internal & external audit windows.", "Low", "Plan UAR & evidence packs ahead of cycle."],
  ];
  const rows = [
    tableHeaderRow(["DEPENDENCY", "DETAIL", "PRIORITY", "MITIGATION"]),
    ...deps.map((d) => [
      tableCell(d[0], { bold: true }),
      tableCell(d[1]),
      tableCell(d[2], {
        color:
          d[2] === "High" ? COLORS.errDark : d[2] === "Med" ? COLORS.warnDark : COLORS.muted,
        bold: true,
        align: "center",
      }),
      tableCell(d[3], { color: COLORS.muted }),
    ]),
  ];
  s.addTable(rows, {
    x: 0.5,
    y: 1.7,
    w: 12.3,
    colW: [2.5, 5.0, 1.2, 3.6],
    fontFace: FONT,
    border: { type: "solid", color: COLORS.border, pt: 0.5 },
  });
  addFooter(s, page, meta.clientName, meta.projectName);
  return page + 1;
}

function s_risks(pres, meta, page) {
  const s = newSlide(pres);
  addHeader(s, "SOLUTION RISKS", "Solution risks & mitigations.");
  const risks = Array.isArray(meta.risks) && meta.risks.length > 0
    ? meta.risks.map((r) => [r.risk, r.impact, r.impactLevel, r.likelihoodLevel, r.mitigation])
    : [
        ["SAP ECS orchestration outside Accenture scope", "System refresh, app patching, maintenance windows.", "High", "Med", "Pre-agree SR templates; weekly governance with ECS."],
        ["Volumetric drift", "Sustained variance from baseline volumetrics.", "Med", "Med", "Quarterly review; CR if >20% sustained."],
        ["KT shortfall from SI team", "Knowledge gaps at cutover.", "Med", "Low", "Joint KT plan; technical pairing for first 4 wks."],
        ["Authorisation rework", "Role redesign needed post Go-Live.", "Med", "Med", "Recertification at month 3; mitigations in place."],
        ["Third-party integration ownership", "Ambiguity at boundaries.", "Med", "Med", "RACI per integration; named owners."],
      ];
  const rows = [
    tableHeaderRow(["RISK", "IMPACT", "IMP", "LIK", "MITIGATION"]),
    ...risks.map((r) => [
      tableCell(r[0], { bold: true }),
      tableCell(r[1]),
      tableCell(r[2], { color: r[2] === "High" ? COLORS.errDark : COLORS.warnDark, bold: true, align: "center" }),
      tableCell(r[3], { color: r[3] === "High" ? COLORS.errDark : COLORS.warnDark, bold: true, align: "center" }),
      tableCell(r[4], { color: COLORS.muted }),
    ]),
  ];
  s.addTable(rows, {
    x: 0.5,
    y: 1.7,
    w: 12.3,
    colW: [2.8, 5.0, 0.9, 0.9, 2.7],
    fontFace: FONT,
    border: { type: "solid", color: COLORS.border, pt: 0.5 },
  });
  addFooter(s, page, meta.clientName, meta.projectName);
  return page + 1;
}

function s_staffing(pres, meta, page) {
  const s = newSlide(pres);
  addHeader(s, "STAFFING", "FMO service delivery — staffing pyramid.");
  const sumFor = (caps, field) =>
    caps.reduce((s, c) => s + (parseFloat(c[field]) || 0), 0);

  const userStaffing = Array.isArray(meta.staffing) && meta.staffing.length > 0
    ? meta.staffing
    : null;

  let totalY1, totalY2, totalY3;
  const rows = [tableHeaderRow(["TOWER / ROLE", "LEVEL", "Y1 FTE", "Y2 FTE", "Y3 FTE", "LOCATION"])];

  if (userStaffing) {
    totalY1 = sumFor(userStaffing, "fteY1");
    totalY2 = sumFor(userStaffing, "fteY2");
    totalY3 = sumFor(userStaffing, "fteY3");
    for (const r of userStaffing) {
      rows.push([
        r.role,
        r.level || "Cons.",
        (parseFloat(r.fteY1) || 0).toFixed(1),
        (parseFloat(r.fteY2) || 0).toFixed(1),
        (parseFloat(r.fteY3) || 0).toFixed(1),
        r.location || "Offshore",
      ]);
    }
    rows.push(["TOTAL", "", totalY1.toFixed(1), totalY2.toFixed(1), totalY3.toFixed(1), ""]);
  } else {
    totalY1 = sumFor(meta.capabilities, "fteY1");
    totalY2 = sumFor(meta.capabilities, "fteY2");
    totalY3 = sumFor(meta.capabilities, "fteY3");
    rows.push(
      ["Engagement Lead", "Sr. Manager", "0.3", "0.3", "0.3", "Onshore"],
      ["Service Delivery Manager", "Manager", "1.0", "1.0", "1.0", "Onshore"],
      ["Tower Lead — Basis", "Manager", "1.0", "1.0", "1.0", "Offshore"],
      ["Tower Lead — SolMan/CALM", "Manager", "0.5", "0.5", "0.5", "Offshore"],
      ["Tower Lead — Security", "Manager", "0.5", "0.5", "0.5", "Offshore"],
      ["Basis Engineers", "Sr. Cons.", "2.5", "2.0", "1.8", "Offshore"],
      ["SolMan / Cloud ALM Engineers", "Cons.", "1.5", "1.2", "1.0", "Offshore"],
      ["Security Engineers", "Cons.", "1.7", "1.5", "1.4", "Offshore"]
    );
  }

  addParagraph(
    s,
    userStaffing
      ? `Aggregated FTE per role as configured on the Resource Loading step. Y1 ${totalY1.toFixed(1)} · Y2 ${totalY2.toFixed(1)} · Y3 ${totalY3.toFixed(1)} — offshore-led delivery with named tower leads.`
      : `Offshore-led delivery with named tower leads. FTE figures shown are placeholder defaults — configure aggregated FTE on the Resource Loading step to drive these.`,
    { y: 1.55, h: 0.7, fontSize: 11, color: COLORS.muted }
  );
  const tableRows = rows.map((r, ri) => {
    if (ri === 0) return r;
    const isTotal = r[0] === "TOTAL";
    return r.map((c, i) =>
      tableCell(c, {
        bold: isTotal || i === 0,
        color: isTotal
          ? COLORS.accent
          : i === 0
            ? COLORS.text
            : i >= 2 && i <= 4
              ? COLORS.accent
              : COLORS.text,
        align: i >= 2 && i <= 4 ? "center" : undefined,
        fill: isTotal ? COLORS.surface2 : COLORS.surface,
      })
    );
  });
  s.addTable(tableRows, {
    x: 0.5,
    y: 2.4,
    w: 12.3,
    colW: [4.5, 1.8, 1.4, 1.4, 1.4, 1.8],
    fontFace: FONT,
    border: { type: "solid", color: COLORS.border, pt: 0.5 },
  });
  addFooter(s, page, meta.clientName, meta.projectName);
  return page + 1;
}

function s_synergy(pres, meta, page) {
  const s = newSlide(pres);
  addHeader(s, "SYNERGY", "Synergy with on-ground SI + AO teams.");
  addParagraph(
    s,
    `A subset of the incumbent SI team transitions directly into the AMS factory, preserving system context and shortening the ramp.`,
    { y: 1.55, h: 0.7, fontSize: 12, color: COLORS.muted }
  );
  const llmSyn = meta.synergy && typeof meta.synergy === "object" ? meta.synergy : null;
  const cols = [
    {
      title: "SI → AMS HEADCOUNT HANDOVER",
      bullets: llmSyn?.siHandover?.length ? llmSyn.siHandover : [
        "Named SI engineers shadow AMS team in last 4 weeks of SI.",
        "Direct transition for select roles (Basis SME, Security SME).",
        "Reverse-KT post-Go-Live for first 8 weeks.",
        "Runbook & known-issue register inherited verbatim.",
      ],
      color: COLORS.accent,
    },
    {
      title: "SYNERGY BENEFITS",
      bullets: llmSyn?.benefits?.length ? llmSyn.benefits : [
        "Continuity of system context.",
        "Faster MTTR in first 6 months.",
        "Reduced rediscovery effort.",
        "Single delivery centre, shared toolchain.",
      ],
      color: COLORS.okDark,
    },
    {
      title: "MITIGATIONS",
      bullets: llmSyn?.mitigations?.length ? llmSyn.mitigations : [
        "Joint go/no-go gate at cutover.",
        "Twin-staff key roles for 8 weeks.",
        "Quality back-stop SLA for KT artefacts.",
        "Shared retro with SI to feed lessons in.",
      ],
      color: COLORS.brand,
    },
  ];
  cols.forEach((c, i) => {
    const x = 0.5 + i * 4.27;
    s.addShape("rect", {
      x,
      y: 2.5,
      w: 4.0,
      h: 4.4,
      fill: { color: COLORS.surface },
      line: { color: c.color, width: 1 },
    });
    s.addText(c.title, {
      x: x + 0.2,
      y: 2.65,
      w: 3.6,
      h: 0.3,
      fontSize: 10,
      bold: true,
      color: c.color,
      fontFace: FONT,
      charSpacing: 4,
    });
    s.addText(c.bullets.map((b) => `• ${b}`).join("\n\n"), {
      x: x + 0.2,
      y: 3.05,
      w: 3.6,
      h: 3.8,
      fontSize: 11,
      color: COLORS.text,
      fontFace: FONT,
      valign: "top",
    });
  });
  addFooter(s, page, meta.clientName, meta.projectName);
  return page + 1;
}

function s_genWizard(pres, meta, page) {
  const s = newSlide(pres);
  addHeader(s, "GENWIZARD AI-OPS", "Accenture GenWizard — AI-powered SAP AI-OPS.");
  addParagraph(
    s,
    `The factory runs on Accenture's GenWizard AI-OPS — a portfolio of agents and tools applied across the SAP support lifecycle to industrialise repeatable work, surface insights, and reduce toil.`,
    { y: 1.55, h: 0.7, fontSize: 12, color: COLORS.muted }
  );
  const agents = [
    { name: "TICKET-TRIAGE AGENT", v: "Auto-classifies & enriches incidents with run-book hints.", color: COLORS.accent },
    { name: "ROOT-CAUSE COPILOT", v: "RCA acceleration by log + change-set correlation.", color: COLORS.brand },
    { name: "AUTH-DESIGN COPILOT", v: "Role design suggestions; SoD pre-check.", color: COLORS.warnDark },
    { name: "TRANSPORT GATE", v: "Risk-score transports pre-import.", color: COLORS.okDark },
    { name: "BATCH SENTRY", v: "Predict batch overruns; pre-emptive remediation.", color: COLORS.accentLight },
    { name: "DOC GENERATOR", v: "Auto-update runbooks from change history.", color: COLORS.brand },
  ];
  agents.forEach((a, i) => {
    const x = 0.5 + (i % 3) * 4.27;
    const y = 2.5 + Math.floor(i / 3) * 2.2;
    s.addShape("rect", {
      x,
      y,
      w: 4.0,
      h: 2.0,
      fill: { color: COLORS.surface },
      line: { color: a.color, width: 1 },
    });
    s.addText(a.name, {
      x: x + 0.2,
      y: y + 0.15,
      w: 3.6,
      h: 0.4,
      fontSize: 11,
      bold: true,
      color: a.color,
      fontFace: FONT,
      charSpacing: 3,
    });
    s.addText(a.v, {
      x: x + 0.2,
      y: y + 0.6,
      w: 3.6,
      h: 1.3,
      fontSize: 11,
      color: COLORS.text,
      fontFace: FONT,
      valign: "top",
    });
  });
  addFooter(s, page, meta.clientName, meta.projectName);
  return page + 1;
}

// ---------------- main ----------------

export async function generatePptx(meta, outPath) {
  const pres = new PptxGenJS();
  pres.layout = "LAYOUT_WIDE";
  pres.author = "Accenture";
  pres.company = "Accenture";
  pres.title = `${meta.projectName} — Solution Plan`;

  s01_title(pres, meta);
  s02_docControl(pres, meta, 2);
  s03_opportunityTeam(pres, meta, 3);
  s04_opportunityOverview(pres, meta, 4);
  s05_dealShape(pres, meta, 5);
  s06_scopeOverview(pres, meta, 6);
  s07_volumetrics(pres, meta, 7);
  s08_solutionOnAPage(pres, meta, 8);
  s09_techArchitecture(pres, meta, 9);
  s10_serviceLevels(pres, meta, 10);
  s11_rolesResponsibilities(pres, meta, 11);
  s12_sapLandscape(pres, meta, 12);
  s13_securityVolumetrics(pres, meta, 13);

  let p = 14;
  p = s14_19_domainViews(pres, meta, p); // 14..19
  p = s20_inScopeNarratives(pres, meta, p); // verbose in-scope narratives, paginated
  p = s_assumptions(pres, meta, p);
  p = s_outOfScope(pres, meta, p); // verbose, gap tree + user OoS, paginated
  p = s_serviceCatalog(pres, meta, p);
  p = s_raci(pres, meta, p); // RACI built from selections, paginated
  p = s_limitedScopeExclusions(pres, meta, p);
  p = s_dependencies(pres, meta, p);
  p = s_risks(pres, meta, p);
  p = s_staffing(pres, meta, p);
  p = s_synergy(pres, meta, p);
  p = s_genWizard(pres, meta, p);

  await pres.writeFile({ fileName: outPath });
  return outPath;
}
