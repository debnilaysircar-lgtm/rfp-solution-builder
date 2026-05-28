import {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  ShadingType,
  convertInchesToTwip,
} from "docx";
import fs from "node:fs/promises";

// Light theme matching the PPT template palette
const COLORS = {
  text: "0A1B3D",
  muted: "5A6478",
  border: "D6DBE6",
  accent: "4C8DFF",
  brand: "A78BFA",
  surface: "F8F9FB",
  headerFill: "0A1B3D",
  white: "FFFFFF",
  ok: "10B981",
  warn: "D29922",
  err: "DC2626",
};

const FONT = "Calibri";

function p(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 120, ...(opts.spacing || {}) },
    alignment: opts.alignment,
    children: [
      new TextRun({
        text,
        font: FONT,
        size: opts.size ?? 22,
        bold: opts.bold,
        italics: opts.italic,
        color: opts.color || COLORS.text,
      }),
    ],
  });
}

function heading(text, level = HeadingLevel.HEADING_1) {
  const size =
    level === HeadingLevel.HEADING_1 ? 36 : level === HeadingLevel.HEADING_2 ? 28 : 24;
  return new Paragraph({
    heading: level,
    spacing: { before: 280, after: 160 },
    children: [
      new TextRun({
        text,
        font: FONT,
        bold: true,
        size,
        color: level === HeadingLevel.HEADING_1 ? COLORS.brand : COLORS.text,
      }),
    ],
  });
}

function bullet(text) {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 80 },
    children: [new TextRun({ text, font: FONT, size: 22, color: COLORS.text })],
  });
}

function cell(text, opts = {}) {
  return new TableCell({
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    shading: opts.fill
      ? { type: ShadingType.CLEAR, color: "auto", fill: opts.fill }
      : undefined,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [
      new Paragraph({
        alignment: opts.alignment,
        children: [
          new TextRun({
            text: text == null ? "" : String(text),
            font: FONT,
            size: opts.size ?? 20,
            bold: opts.bold,
            color: opts.color || COLORS.text,
          }),
        ],
      }),
    ],
  });
}

function table(rows, widthsPercent) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map(
      (r) =>
        new TableRow({
          children: r.map((c, i) => {
            if (c instanceof TableCell) return c;
            return cell(c, { width: widthsPercent ? widthsPercent[i] : undefined });
          }),
        })
    ),
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: COLORS.border },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: COLORS.border },
      left: { style: BorderStyle.SINGLE, size: 4, color: COLORS.border },
      right: { style: BorderStyle.SINGLE, size: 4, color: COLORS.border },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: COLORS.border },
      insideVertical: { style: BorderStyle.SINGLE, size: 2, color: COLORS.border },
    },
  });
}

function headerCell(text, width) {
  return cell(text, { width, bold: true, color: COLORS.white, fill: COLORS.headerFill });
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

export async function generateDocx(meta, outPath) {
  const today = new Date(meta.generatedAt);
  const dateStr = today.toLocaleDateString("en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const children = [];

  // ----- TITLE -----
  children.push(
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { after: 80 },
      children: [
        new TextRun({
          text: "STATEMENT OF WORK",
          font: FONT,
          bold: true,
          size: 22,
          color: COLORS.accent,
          characterSpacing: 60,
        }),
      ],
    })
  );
  children.push(
    new Paragraph({
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: meta.projectName,
          font: FONT,
          bold: true,
          size: 56,
          color: COLORS.text,
        }),
      ],
    })
  );
  children.push(
    new Paragraph({
      spacing: { after: 320 },
      children: [
        new TextRun({
          text: `Prepared for ${meta.clientName}  ·  ${dateStr}`,
          font: FONT,
          size: 24,
          color: COLORS.muted,
        }),
      ],
    })
  );

  // ----- Document control -----
  children.push(heading("Document Control", HeadingLevel.HEADING_2));
  children.push(
    table(
      [
        [headerCell("Field", 30), headerCell("Value", 70)],
        ["Client", meta.clientName],
        ["Project", meta.projectName],
        ["Opportunity ID", meta.opportunityId || "—"],
        ["Market unit", meta.marketUnit || "—"],
        ["Date generated", today.toLocaleString()],
        ["Delivery window", meta.deliveryWindow || "TBD"],
        ["Contract term", meta.contractTerm || "TBD"],
        ["Contract value", meta.contractValue || "TBD"],
      ],
      [30, 70]
    )
  );

  // ----- 1. EXECUTIVE SUMMARY -----
  children.push(heading("1. Executive Summary"));
  children.push(
    p(
      meta.executiveSummary ||
        meta.notes ||
        `This Statement of Work (SoW) describes the scope, deliverables, and ` +
          `commercial framework for the ${meta.projectName} engagement between Accenture ` +
          `and ${meta.clientName}. The engagement covers ${meta.products.length} SAP ` +
          `product${meta.products.length === 1 ? "" : "s"} and ${meta.capabilities.length} ` +
          `architecture capabilit${meta.capabilities.length === 1 ? "y" : "ies"}.`
    )
  );

  // ----- 2. SCOPE -----
  children.push(heading("2. Scope of Services"));
  children.push(
    p(
      `The following SAP products and architecture capabilities are in scope for this engagement. ` +
        `Items not listed here are explicitly out of scope unless added by a signed change request.`
    )
  );

  // 2.1 Products
  children.push(heading("2.1 In-scope SAP Products", HeadingLevel.HEADING_2));
  if (meta.products.length === 0) {
    children.push(p("No SAP products selected.", { italic: true, color: COLORS.muted }));
  } else {
    const productsByCategory = groupBy(meta.products, (q) => q.category || "Uncategorised");
    for (const [category, items] of Array.from(productsByCategory.entries()).sort()) {
      children.push(heading(category, HeadingLevel.HEADING_3));
      const rows = [
        [
          headerCell("Product", 25),
          headerCell("Acronym", 12),
          headerCell("Status", 13),
          headerCell("Description", 50),
        ],
        ...items.map((it) => [
          cell(it.name, { bold: true }),
          cell(it.acronym || "—"),
          cell(it.legacy ? "Legacy" : "Current", {
            color: it.legacy ? COLORS.warn : COLORS.ok,
            bold: true,
          }),
          cell(it.description || "—"),
        ]),
      ];
      children.push(table(rows, [25, 12, 13, 50]));
      children.push(p(" ", { size: 8 }));
    }
  }

  // 2.2 Capabilities — concise LLM-generated in-scope statements (tabular)
  const hasLLMInScope = Array.isArray(meta.llmInScope) && meta.llmInScope.length > 0;
  children.push(heading("2.2 In-scope Architecture Capabilities", HeadingLevel.HEADING_2));
  children.push(
    p(
      hasLLMInScope
        ? `Each capability is in scope under the AMS engagement; the table below states what Accenture covers per capability in a concise, tailored form.`
        : `Each capability listed below is in scope under the AMS engagement.`
    )
  );

  if (meta.capabilities.length === 0) {
    children.push(p("No capabilities selected.", { italic: true, color: COLORS.muted }));
  } else if (hasLLMInScope) {
    const widths = [5, 30, 65];
    const byTower = groupBy(meta.llmInScope, (r) => r.tower || "General");
    for (const [tower, rows] of byTower.entries()) {
      children.push(heading(tower, HeadingLevel.HEADING_3));
      const tableRows = [
        [
          headerCell("#", widths[0]),
          headerCell("Capability", widths[1]),
          headerCell("Scope", widths[2]),
        ],
        ...rows.map((row, i) => [
          cell(String(i + 1), { width: widths[0], alignment: AlignmentType.CENTER, color: COLORS.muted }),
          cell(row.capability, { width: widths[1], bold: true }),
          cell(row.scope, { width: widths[2] }),
        ]),
      ];
      children.push(table(tableRows, widths));
      children.push(p(" ", { size: 8 }));
    }
  } else {
    const inferFrequency = (label, path) => {
      const t = ((label || "") + " " + (path || "")).toLowerCase();
      if (/\b(monitor|health|alert|backup|log|incident|24x7|24\/7|operation)\b/.test(t)) return "Daily";
      if (/\b(patch|note|kernel|transport|user|auth|access|role|housekeep)\b/.test(t)) return "Weekly";
      if (/\b(sp\b|stack|capacity|tune|performance|review|reporting)\b/.test(t)) return "Monthly";
      if (/\b(audit|drill|compliance|dr\b|disaster|bcp|sox)\b/.test(t)) return "Quarterly";
      if (/\b(upgrade|migration|implementation|setup|install|deploy)\b/.test(t)) return "Project-based";
      return "On-demand";
    };
    const firstSentence = (s) => {
      const t = String(s || "").trim();
      const m = t.match(/^[^.!?]*[.!?]/);
      return (m ? m[0] : t).trim();
    };

    const capsBySection = groupBy(meta.capabilities, (c) => {
      const segs = (c.path || c.label || "").split(" > ");
      return segs[0] || "General";
    });
    for (const [section, items] of Array.from(capsBySection.entries()).sort()) {
      children.push(heading(section, HeadingLevel.HEADING_3));
      const widths = [4, 26, 13, 42, 15];
      const rows = [
        [
          headerCell("#", widths[0]),
          headerCell("Capability", widths[1]),
          headerCell("Frequency", widths[2]),
          headerCell("Narrative", widths[3]),
          headerCell("FTE Y1→Y3", widths[4]),
        ],
      ];
      items.forEach((c, i) => {
        const label = c.label || (c.path || "").split(" > ").pop() || "—";
        const hasRealText = c.text && c.text.trim() && c.text.trim() !== label.trim();
        const narrative = hasRealText
          ? firstSentence(c.text)
          : `Accenture operates and maintains ${label} under the AMS SLAs.`;
        const fteY1 = parseFloat(c.fteY1) || 0;
        const fteY3 = parseFloat(c.fteY3) || 0;
        const ftePresent = fteY1 || fteY3;
        const fteText = ftePresent
          ? `${c.level || "Cons."} · ${fteY1.toFixed(1)} → ${fteY3.toFixed(1)}`
          : "TBD";
        rows.push([
          cell(String(i + 1), { width: widths[0], alignment: "center", color: COLORS.muted }),
          cell(label, { width: widths[1], bold: true }),
          cell(c.frequency || inferFrequency(label, c.path), { width: widths[2], alignment: "center", color: COLORS.accent, bold: true }),
          cell(narrative, { width: widths[3] }),
          cell(fteText, { width: widths[4], alignment: "center", color: ftePresent ? COLORS.accent : COLORS.muted, bold: ftePresent ? true : false }),
        ]);
      });
      children.push(table(rows, widths));
      children.push(p(" ", { size: 8 }));
    }
  }

  // 2.3 Resource loading summary (aggregated per-role from Resource Loading step)
  if (Array.isArray(meta.staffing) && meta.staffing.length > 0) {
    children.push(heading("2.3 Resource Loading Summary", HeadingLevel.HEADING_2));
    children.push(
      p(
        "Aggregated FTE per role across the contract term, as configured on the Resource Loading step."
      )
    );
    let y1 = 0,
      y2 = 0,
      y3 = 0;
    const rows = [
      [
        headerCell("Role / Tower", 40),
        headerCell("Level", 14),
        headerCell("Y1", 12),
        headerCell("Y2", 12),
        headerCell("Y3", 11),
        headerCell("Location", 11),
      ],
    ];
    for (const r of meta.staffing) {
      const f1 = parseFloat(r.fteY1) || 0;
      const f2 = parseFloat(r.fteY2) || 0;
      const f3 = parseFloat(r.fteY3) || 0;
      y1 += f1;
      y2 += f2;
      y3 += f3;
      rows.push([
        cell(r.role || "—", { bold: true }),
        cell(r.level || "Cons.", { color: COLORS.muted }),
        cell(f1.toFixed(1), { alignment: AlignmentType.CENTER }),
        cell(f2.toFixed(1), { alignment: AlignmentType.CENTER }),
        cell(f3.toFixed(1), { alignment: AlignmentType.CENTER }),
        cell(r.location || "Offshore", { color: COLORS.muted }),
      ]);
    }
    rows.push([
      cell("TOTAL", { bold: true, fill: COLORS.surface }),
      cell("", { fill: COLORS.surface }),
      cell(y1.toFixed(1), {
        bold: true,
        alignment: AlignmentType.CENTER,
        color: COLORS.accent,
        fill: COLORS.surface,
      }),
      cell(y2.toFixed(1), {
        bold: true,
        alignment: AlignmentType.CENTER,
        color: COLORS.accent,
        fill: COLORS.surface,
      }),
      cell(y3.toFixed(1), {
        bold: true,
        alignment: AlignmentType.CENTER,
        color: COLORS.accent,
        fill: COLORS.surface,
      }),
      cell("", { fill: COLORS.surface }),
    ]);
    children.push(table(rows, [40, 14, 12, 12, 11, 11]));
  }

  // ----- 3. RACI -----
  children.push(heading("3. RACI"));
  const hasLLMRaci = Array.isArray(meta.raci) && meta.raci.length > 0;
  children.push(
    p(
      `R = Responsible · A = Accountable · C = Consulted · I = Informed. ` +
        (hasLLMRaci
          ? `RACI is tailored per in-scope activity, grouped by tower, with assignments reflecting each activity's risk profile, accountability owner, and execution layer.`
          : `RACI for each in-scope capability is shown below, grouped by tower. Default split: Accenture is R/A for service operation; ${meta.clientName} is A for business decisions and approvals; SAP (RISE ECS) is I for above-the-line activities.`)
    )
  );
  const raciCellColor = (v) => {
    if (!v || v === "—") return COLORS.muted;
    if (v.includes("R")) return COLORS.ok;
    if (v === "A") return COLORS.accent;
    if (v === "I") return COLORS.muted;
    return COLORS.text;
  };
  if (meta.capabilities.length === 0) {
    children.push(p("No capabilities selected — RACI is empty.", { italic: true, color: COLORS.muted }));
  } else if (hasLLMRaci) {
    const byTower = groupBy(meta.raci, (r) => r.tower || "General");
    let towerIdx = 1;
    for (const [tower, rows] of byTower.entries()) {
      children.push(heading(`3.${towerIdx} Tower — ${tower}`, HeadingLevel.HEADING_2));
      const stakeholders = [];
      for (const row of rows) {
        for (const k of Object.keys(row.assignments || {})) {
          if (!stakeholders.includes(k)) stakeholders.push(k);
        }
      }
      const stakes = stakeholders.slice(0, 5);

      const activityW = 18;
      const detailW = 36;
      const typeW = 8;
      const remaining = 100 - activityW - detailW - typeW;
      const stakeW = Math.floor(remaining / Math.max(stakes.length, 1));
      const lastStakeW = remaining - stakeW * (stakes.length - 1);
      const stakeWidths = stakes.map((_, i) => (i === stakes.length - 1 ? lastStakeW : stakeW));
      const widths = [activityW, detailW, typeW, ...stakeWidths];

      const tableRows = [
        [
          headerCell("Activity", activityW),
          headerCell("Activity Detail", detailW),
          headerCell("Type", typeW),
          ...stakes.map((sk, i) => headerCell(sk, stakeWidths[i])),
        ],
        ...rows.map((row) => {
          const cells = [
            cell(row.capability, { bold: true }),
            cell(row.activityDetail),
            cell(row.type, { color: COLORS.muted, alignment: AlignmentType.CENTER }),
          ];
          for (const sk of stakes) {
            const v = row.assignments?.[sk] || "—";
            cells.push(
              cell(v, {
                bold: v !== "—",
                color: raciCellColor(v),
                alignment: AlignmentType.CENTER,
              })
            );
          }
          return cells;
        }),
      ];
      children.push(table(tableRows, widths));
      children.push(p(" ", { size: 8 }));
      towerIdx++;
    }
  } else {
    const capsBySection = groupBy(meta.capabilities, (c) => {
      const segs = (c.path || c.label || "").split(" > ");
      return segs[0] || "General";
    });
    let towerIdx = 1;
    for (const [section, items] of capsBySection.entries()) {
      children.push(heading(`3.${towerIdx} Tower — ${section}`, HeadingLevel.HEADING_2));
      const rows = [
        [
          headerCell("Capability", 60),
          headerCell("Accenture", 13),
          headerCell(meta.clientName, 13),
          headerCell("SAP (ECS)", 14),
        ],
        ...items.map((c) => [
          cell(c.label || (c.path || "").split(" > ").pop(), { bold: true }),
          cell("R/A", { bold: true, color: COLORS.ok, alignment: AlignmentType.CENTER }),
          cell("A", { bold: true, color: COLORS.accent, alignment: AlignmentType.CENTER }),
          cell("I", { color: COLORS.muted, alignment: AlignmentType.CENTER }),
        ]),
      ];
      children.push(table(rows, [60, 13, 13, 14]));
      children.push(p(" ", { size: 8 }));
      towerIdx++;
    }
  }

  // ----- 4. SERVICE LEVELS & SEVERITY MATRIX -----
  children.push(heading("4. Service Levels & Severity Matrix"));
  children.push(
    p(
      `Accenture commits to the response and resolution targets below. Severity is assigned at ticket creation by the L1/L2 analyst against the criteria in Table 4.1 and is subject to joint review with ${meta.clientName} during the Monthly Service Review. Service hours align to the agreed coverage window (${meta.deliveryWindow || "TBD"}); P1 and P2 incidents are covered 24×7 regardless of standard working hours.`
    )
  );
  children.push(heading("4.1 Severity Definitions", HeadingLevel.HEADING_2));
  children.push(
    table(
      [
        [headerCell("Severity", 15), headerCell("Business Impact", 50), headerCell("Trigger Examples", 35)],
        [cell("P1 — Critical", { bold: true, color: COLORS.errDark }), "Business-critical function unavailable in production; no workaround; revenue, compliance or safety exposure.", "ERP down, payroll run blocked, integration to bank/customs offline, mass authorisation failure."],
        [cell("P2 — High", { bold: true, color: COLORS.warnDark }), "Major function impaired or significant degradation; partial workaround exists but impact is felt across a business unit.", "Single critical interface failing, batch job consistently breaching SLA, role assignment broken for a tower."],
        [cell("P3 — Medium", { bold: true }), "Non-critical defect; documented workaround in place; single-user or low-volume impact.", "Localised report error, non-blocking validation bug, intermittent SSO redirect issue."],
        [cell("P4 — Low", { bold: true, color: COLORS.muted }), "Cosmetic, advisory or enhancement; no operational impact.", "Label correction, documentation update, minor authorisation tuning request."],
      ],
      [15, 50, 35]
    )
  );
  children.push(heading("4.2 Response & Resolution Targets", HeadingLevel.HEADING_2));
  children.push(
    table(
      [
        [headerCell("Severity", 12), headerCell("Coverage", 18), headerCell("Response", 18), headerCell("Resolution / Workaround", 27), headerCell("Achievement Target", 25)],
        [cell("P1", { bold: true }), "24×7", "15 minutes", "4 elapsed hours", "95% per calendar month"],
        [cell("P2", { bold: true }), "24×7", "1 hour", "8 business hours", "95% per calendar month"],
        [cell("P3", { bold: true }), "Standard window", "4 business hours", "2 business days", "90% per calendar month"],
        [cell("P4", { bold: true }), "Standard window", "8 business hours", "5 business days", "Best endeavours"],
      ],
      [12, 18, 18, 27, 25]
    )
  );
  children.push(
    p(
      "SLA clock pauses are triggered while the ticket is in “awaiting customer”, “awaiting third-party” or “awaiting SAP ECS” states; resumption is automatic on state change. SLA does not apply during pre-announced maintenance windows or for incidents attributable to events outside Accenture's control (SAP ECS infrastructure events, hyperscaler outages, telco failure, force majeure)."
    )
  );

  // ----- 5. OPERATIONAL PROCESSES -----
  children.push(heading("5. Operational Processes"));
  children.push(
    p(
      "Operational processes are aligned to ITIL 4 service-management practice and instrumented in Cloud ALM (process flow, change record) and Focused Run (system monitoring, alert routing). The four lifecycle processes below govern the day-to-day operation of the in-scope landscape."
    )
  );
  children.push(heading("5.1 Incident Management", HeadingLevel.HEADING_2));
  children.push(p("Trigger: monitoring alert, end-user ticket, integration error, or SAP-issued notification. Workflow: detect → triage & severity assignment → diagnose → resolve or workaround → verify with requester → close. Tool of record: ServiceNow (or client-equivalent) integrated to Cloud ALM. P1/P2 incidents follow the major-incident protocol with a designated Incident Commander and bridge call within 30 minutes of severity assignment."));
  children.push(heading("5.2 Problem Management", HeadingLevel.HEADING_2));
  children.push(p("Trigger: recurring or impactful incident pattern, post-incident review action, or trend identified in the monthly review. Workflow: log problem → root-cause analysis (5-Whys / Ishikawa as appropriate) → workaround in KEDB → permanent fix via change record → closure with reviewed RCA. Problems unresolved beyond 30 days are escalated for executive review."));
  children.push(heading("5.3 Change Management", HeadingLevel.HEADING_2));
  children.push(p("All landscape-affecting changes are governed by CAB. Standard changes (pre-approved, low-risk, well-tested) bypass CAB and follow a runbook. Normal changes require risk assessment, peer review, rollback plan and Change Advisory Board approval. Emergency changes follow an expedited e-CAB with retrospective full-CAB review at the next session. Transport movement is performed via CTS+/ChaRM (ABAP) and gCTS (Git-managed artefacts)."));
  children.push(heading("5.4 Release Management", HeadingLevel.HEADING_2));
  children.push(p(`Releases are bundled on a fortnightly cadence for minor changes, with major releases (SAP Support Package updates, FPS upgrades, S/4 upgrades) coordinated against the SAP ECS-published maintenance calendar. ${meta.clientName} owns business sign-off via UAT acceptance before any production release. Release notes are produced for every release and published to the shared service portal.`));

  // ----- 6. SOLUTION ARCHITECTURE & TOOLCHAIN -----
  children.push(heading("6. Solution Architecture & Toolchain"));
  children.push(
    p(
      `The managed service operates over the agreed in-scope SAP products (${(meta.products || []).map((p) => p.name).filter(Boolean).slice(0, 8).join(", ") || "in-scope SAP landscape"}) running on SAP RISE Private Cloud Edition (or equivalent hosting). Accenture is responsible for application-layer operation, automation and continuous improvement; SAP (RISE/ECS) is responsible for infrastructure, OS, database engine and platform-level patching per the published Roles & Responsibilities split. The toolchain below is the standard reference; deviations agreed during transition are recorded in the run-book.`
    )
  );
  children.push(
    table(
      [
        [headerCell("Layer", 22), headerCell("Tool of Record", 30), headerCell("Purpose & Ownership", 48)],
        ["Application monitoring", "SAP Cloud ALM (Operations)", "Business-process and integration KPIs, end-to-end traceability. Accenture-operated."],
        ["System monitoring", "SAP Focused Run (FRUN)", "Technical monitoring, alert hub, capacity views. Accenture-operated; data sourced from ECS-managed agents."],
        ["Service desk", "ServiceNow / client ITSM", "Ticketing, CMDB, change records, knowledge base. Client-owned platform; Accenture operates the SAP-related queues."],
        ["Transport management", "CTS+ / ChaRM / gCTS", "Coordinated transports across Dev → QA → Pre-prod → Prod. Accenture-operated; ChaRM CAB workflow integrated with ServiceNow."],
        ["Identity & access", "SAP IAS + IPS", "Federated SSO, SCIM provisioning, JIT roles. Accenture configures; client IdP is the authoritative source of identity."],
        ["Integration", "BTP Integration Suite / CPI", "iFlow design, monitoring, alerting on integration failures. Accenture-operated."],
        ["Code & config repository", "Git (Azure DevOps / GitHub) + abapGit", "Source-of-truth for custom code, scripts, configuration-as-code. Accenture-managed; client read-access provided."],
        ["Earlywatch & advisories", "SAP for Me + EarlyWatch Alert", "Weekly EWA review, SAP Note compliance, Vulnerability advisories. Accenture-operated."],
      ],
      [22, 30, 48]
    )
  );
  children.push(
    p(
      "Boundaries with SAP ECS are formalised in the Joint Operations Manual produced during transition. All ECS-bound activities (system copy, kernel patching, infrastructure failover) are raised as Service Requests via the SAP for Me portal; Accenture coordinates execution, validates pre/post conditions and confirms business readiness."
    )
  );

  // ----- 7. SECURITY, AUDIT & COMPLIANCE -----
  children.push(heading("7. Security, Audit & Compliance"));
  children.push(
    p(
      `Security operation aligns to ISO 27001 / SOC 2 control families and supports ${meta.clientName}'s broader compliance regime. Accenture is responsible for the application-layer controls listed below; underlying infrastructure and hyperscaler controls remain with SAP ECS. Joint controls are exercised through the monthly Security Working Group.`
    )
  );
  children.push(bullet("Role design governance — role changes follow a four-eyes review with Accenture security architect approval; weekly role-change window; emergency requests via e-CAB. Custom roles undergo SoD validation prior to transport."));
  children.push(bullet("Segregation of Duties — automated SoD scan executed weekly via GRC ARA (Access Risk Analysis); violations logged to the Risk Register; remediation owner and target date captured. Quarterly SoD trend review at the Steering Committee."));
  children.push(bullet("Access certification — User Access Review (UAR) executed at month 3 post Go-Live, and annually thereafter. Privileged-access review monthly. Firefighter sessions logged and reviewed within 48 hours of session close."));
  children.push(bullet("Audit support — Accenture provides evidence packs for internal and external audits within the lead-times agreed in the audit calendar. Standard evidence (change log, access log, transport log, EarlyWatch reports) is retained for seven years."));
  children.push(bullet("Vulnerability response — SAP HotNews and Security Notes triaged within 5 business days; HotNews-rated patches applied within the next available change window (target ≤30 days from publication). Zero-day exposures follow the emergency change path."));
  children.push(bullet("Data residency & handling — data remains within the SAP RISE region defined in the master agreement; Accenture personnel access is governed by the data-protection schedule. Penetration testing is coordinated by Accenture with the client CISO; execution is client-led and out of scope."));

  // ----- 8. TRANSITION & KNOWLEDGE MANAGEMENT -----
  children.push(heading("8. Transition & Knowledge Management"));
  children.push(
    p(
      `Transition from the current operating model into the Accenture-managed service follows a four-phase model, with a steady-state cut-over only after exit criteria have been signed off by ${meta.clientName} and the outgoing SI/AO provider.`
    )
  );
  children.push(
    table(
      [
        [headerCell("Phase", 22), headerCell("Duration", 14), headerCell("Activities", 38), headerCell("Exit Criteria", 26)],
        ["1. Plan & Mobilise", "Weeks 1–4", "RACI signed; access & infra provisioning; tooling configured; runbook templates issued; SI handover plan agreed.", "All access live; tooling green; KT plan signed."],
        ["2. Shadow", "Weeks 5–8", "Incumbent leads operations; Accenture observes and documents. Runbook completion ≥80%.", "Runbook coverage ≥80%; ticket triage parity demonstrated."],
        ["3. Reverse-Shadow", "Weeks 9–12", "Accenture leads operations; incumbent reviews; defects of Phase 2 closed; KEDB seeded with ≥30 known errors.", "Two consecutive weeks SLA-green; KEDB ≥30 entries."],
        ["4. Steady State", "Week 13+", "Accenture owns operations end-to-end; hyper-care for 4 weeks post cut-over; weekly governance.", "Hyper-care exit at week 16 (formal sign-off)."],
      ],
      [22, 14, 38, 26]
    )
  );
  children.push(heading("8.1 KT Artefacts Delivered", HeadingLevel.HEADING_2));
  children.push(bullet("Run-book per in-scope system — landscape map, daily/weekly/monthly task list, contact tree, escalation paths."));
  children.push(bullet("Known Error Database (KEDB) — symptom → cause → workaround → permanent-fix status, owned by the Problem Manager."));
  children.push(bullet("Custom-code inventory — Z-object catalogue, ownership, criticality, dependencies (SCMON + Code Inspector outputs)."));
  children.push(bullet("Process-flow diagrams — end-to-end for top 10 business processes; sequence diagrams for top 5 integrations."));
  children.push(bullet("Operational baselines — performance benchmarks captured at the end of Phase 2 (response times, batch durations, integration throughput)."));

  // ----- 9. SERVICE REPORTING & GOVERNANCE -----
  children.push(heading("9. Service Reporting & Governance"));
  children.push(
    p(
      `Service performance, risks and continuous-improvement items are surfaced through the cadence below. Forums are chaired jointly by Accenture and ${meta.clientName}; the Steering Committee is the highest decision-making body in the engagement.`
    )
  );
  children.push(
    table(
      [
        [headerCell("Forum", 26), headerCell("Cadence", 16), headerCell("Attendees", 26), headerCell("Output", 32)],
        ["Daily stand-up (tower)", "Daily", "Tower lead, on-call analyst, client SPOC.", "Top-3 priorities, blockers, SLA risk flags."],
        ["Weekly Service Review", "Weekly", "Service Delivery Manager, tower leads, client service owner.", "Weekly SLA dashboard, change calendar, P1/P2 trend."],
        ["Monthly Service Review (MSR)", "Monthly", "SDM, client service owner, security lead, problem manager.", "Service-credit calculation, problem closure, improvement actions."],
        ["Quarterly Business Review (QBR)", "Quarterly", "Engagement lead, client sponsor, finance, executive observers.", "Trend pack, capacity & volumetrics, roadmap, commercial review."],
        ["Steering Committee", "Quarterly", "Account director, client CIO/sponsor, Accenture MD.", "Strategic decisions, scope changes, escalations resolved."],
        ["Security Working Group", "Monthly", "Security architect (Accenture), client CISO delegate, GRC lead.", "SoD trend, UAR status, vulnerability remediation."],
      ],
      [26, 16, 26, 32]
    )
  );
  children.push(heading("9.1 Escalation Matrix", HeadingLevel.HEADING_2));
  children.push(
    table(
      [
        [headerCell("Level", 12), headerCell("Owner", 26), headerCell("Engaged When", 35), headerCell("Response", 27)],
        ["L1", "Tower Lead (Accenture)", "Operational issue, SLA at risk.", "Within 30 minutes."],
        ["L2", "Service Delivery Manager", "Multi-tower issue or L1 unresolved >2 hours.", "Within 1 hour."],
        ["L3", "Engagement Lead (Accenture)", "Customer-facing impact, commercial implication.", "Within 4 hours."],
        ["L4", "Account Director / Client Sponsor", "Contractual or strategic risk.", "Within 1 business day."],
      ],
      [12, 26, 35, 27]
    )
  );
  children.push(
    p(
      "Continuous improvement is logged in the joint Improvement Backlog. A target of two improvement actions delivered per tower per quarter is committed; outcomes (effort saved, MTTR reduction, automation count) are reported at the QBR."
    )
  );

  // ----- 10. SERVICE CONTINUITY (DR / BCP) -----
  children.push(heading("10. Service Continuity (DR & BCP)"));
  children.push(
    p(
      "Service continuity commitments below apply to the application-layer recovery activities owned by Accenture. Infrastructure-layer DR (compute, storage, network, database engine) is delivered by SAP ECS per the published RISE service description and is reflected here for completeness."
    )
  );
  children.push(
    table(
      [
        [headerCell("System Tier", 20), headerCell("RPO", 16), headerCell("RTO", 16), headerCell("Validation Cadence", 22), headerCell("Recovery Owner", 26)],
        ["Tier 1 — Mission critical (Prod ERP, CFIN, Identity)", "15 minutes", "4 hours", "Semi-annual full DR test", "SAP ECS (infra) + Accenture (app)"],
        ["Tier 2 — Business critical (Analytics, Integration hub)", "1 hour", "8 hours", "Annual DR test", "SAP ECS (infra) + Accenture (app)"],
        ["Tier 3 — Important (Non-prod, BTP services)", "4 hours", "24 hours", "Annual table-top exercise", "Accenture (configuration & re-provisioning)"],
        ["Tier 4 — Standard (Sandbox, training)", "24 hours", "Best effort", "Not formally tested", "Accenture (rebuild from baseline)"],
      ],
      [20, 16, 16, 22, 26]
    )
  );
  children.push(
    p(
      "Major-incident runbook activation triggers a 24×7 bridge with named Incident Commander, formal communications plan and stakeholder updates at fixed intervals (every 30 minutes for P1). Post-incident review (PIR) is completed within five business days of resolution, with actions tracked to closure in the Problem queue."
    )
  );

  // ----- 11. DELIVERABLES -----
  children.push(heading("11. Deliverables"));
  children.push(
    p(
      "Accenture will deliver the artefacts listed below. Acceptance criteria for each " +
        "deliverable will be agreed at the start of the corresponding workstream."
    )
  );
  const deliverables = Array.isArray(meta.deliverables) && meta.deliverables.length > 0
    ? meta.deliverables
    : [
        "Solution Plan deck — covers products, capabilities, architecture, and service levels.",
        "Service catalogue — activity-level breakdown per capability tower.",
        "Roles & responsibilities matrix (RACI) per tower.",
        "Run-book and operating procedures for each in-scope SAP product.",
        "Transition plan from current state to managed-service steady state.",
        "Monthly service-level report against agreed KPIs.",
      ];
  for (const d of deliverables) children.push(bullet(d));

  // ----- 12. TIMELINE -----
  children.push(heading("12. Indicative Timeline"));
  children.push(
    table(
      [
        [headerCell("Phase", 25), headerCell("Duration", 20), headerCell("Output", 55)],
        ["Mobilisation", "Weeks 1–4", "Team onboarded, tooling provisioned, baseline confirmed."],
        ["Transition", "Weeks 5–12", "Knowledge transfer, shadow operations, runbooks finalised."],
        ["Steady-state", meta.contractTerm || "Months 4–36", "Managed service delivery against SLA."],
        ["Continuous improvement", "Ongoing", "Automation, GenAI-Ops, cost & quality improvements."],
      ],
      [25, 20, 55]
    )
  );

  // ----- 13. COMMERCIALS -----
  children.push(heading("13. Commercial Framework"));
  children.push(
    p(
      "Commercials are output-based across the contract term. The model assumes the " +
        "volumetrics agreed at signature; sustained variance triggers a formal commercial review."
    )
  );
  children.push(
    table(
      [
        [headerCell("Element", 35), headerCell("Basis", 65)],
        ["Pricing model", meta.contractType || "Output-based managed service (fixed monthly run rate)."],
        ["Contract value", meta.contractValue || "TBD"],
        ["Contract term", meta.contractTerm || "TBD"],
        ["Delivery window", meta.deliveryWindow || "TBD"],
        ["CCI %", meta.cci || "TBD"],
        ["Volumetric review", "3-month Solution Baseline Review; quarterly thereafter."],
        ["Change requests", "Items outside this scope handled via signed change request."],
      ],
      [35, 65]
    )
  );

  // ----- 14. ASSUMPTIONS -----
  children.push(heading("14. Assumptions"));
  children.push(
    p(
      "This SoW is predicated on the assumptions below. Anything not explicitly in scope " +
        "in Section 2 is excluded unless covered by a change request."
    )
  );
  const assumptions = (meta.assumptions && meta.assumptions.length > 0) ? meta.assumptions : [
    "SAP RISE PCE responsibility split applies where relevant.",
    `${meta.clientName} retains ownership of business processes, master data, and end-user training.`,
    "Third-party vendor coordination is in scope only where explicitly listed.",
    "Volumetrics agreed at signature remain the contractual baseline.",
  ];
  for (const a of assumptions) children.push(bullet(a));

  // ----- 15. OUT OF SCOPE -----
  const hasLLMOoS = Array.isArray(meta.llmOutOfScope) && meta.llmOutOfScope.length > 0;
  children.push(heading("15. Out of Scope"));
  children.push(
    p(
      hasLLMOoS
        ? `The items below are explicitly outside scope; each row notes the responsible party and the contractual or technical reason for the exclusion.`
        : `The items below are explicitly outside the scope of this AMS engagement. Ownership remains with ${meta.clientName} ` +
            `or the responsible third party; items may be engaged via Change Request through the Service Delivery Manager.`
    )
  );

  if (hasLLMOoS) {
    const oosBySection = groupBy(meta.llmOutOfScope, (r) => r.section || "General");
    let oosIdx = 1;
    const widths = [5, 30, 65];
    for (const [section, rows] of oosBySection.entries()) {
      children.push(heading(`15.${oosIdx} ${section}`, HeadingLevel.HEADING_2));
      const tableRows = [
        [
          headerCell("#", widths[0]),
          headerCell("Item", widths[1]),
          headerCell("Rationale", widths[2]),
        ],
        ...rows.map((row, i) => [
          cell(String(i + 1), { width: widths[0], alignment: AlignmentType.CENTER, color: COLORS.muted }),
          cell(row.item, { width: widths[1], bold: true, color: COLORS.warn }),
          cell(row.rationale, { width: widths[2] }),
        ]),
      ];
      children.push(table(tableRows, widths));
      children.push(p(" ", { size: 8 }));
      oosIdx++;
    }
  } else {
    const userOoS = (meta.outOfScope || []).map((it) => ({
      section: "Engagement-level declarations",
      label: it,
    }));
    const gapItems = (meta.gapTreeOoS || []).map((it) => ({
      section: it.section || "General",
      label: it.label || (it.path || "").split(" > ").pop() || "—",
    }));
    const detailItems = [...userOoS, ...gapItems];
    const oosBySection = groupBy(detailItems, (it) => it.section || "General");

    if (detailItems.length === 0) {
      children.push(p("No out-of-scope items defined.", { italic: true, color: COLORS.muted }));
    } else {
      let oosIdx = 1;
      for (const [section, items] of oosBySection.entries()) {
        children.push(heading(`15.${oosIdx} ${section}`, HeadingLevel.HEADING_2));
        for (const it of items) {
          children.push(bullet(it.label));
        }
        oosIdx++;
      }
    }
  }

  // ----- 16. SIGNATURES -----
  children.push(heading("16. Signatures"));
  children.push(p("By signing below, both parties agree to the scope, deliverables, and commercial terms set out in this Statement of Work."));
  children.push(p(" "));
  children.push(
    table(
      [
        [headerCell("Accenture", 50), headerCell(meta.clientName, 50)],
        [cell(" "), cell(" ")],
        [cell("Name: ____________________"), cell("Name: ____________________")],
        [cell("Title: ____________________"), cell("Title: ____________________")],
        [cell("Date: _____________________"), cell("Date: _____________________")],
      ],
      [50, 50]
    )
  );

  const doc = new Document({
    creator: "Accenture · RFP Solution Builder",
    title: `${meta.projectName} — Statement of Work`,
    description: `SoW for ${meta.clientName}`,
    styles: {
      default: {
        document: { run: { font: FONT, size: 22 } },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(0.8),
              bottom: convertInchesToTwip(0.8),
              left: convertInchesToTwip(0.9),
              right: convertInchesToTwip(0.9),
            },
          },
        },
        children,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  await fs.writeFile(outPath, buffer);
  return outPath;
}
