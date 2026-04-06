// PrintEngine.tsx
// Generates clean, formatted HTML for printing / saving as PDF.
// Uses a hidden iframe approach so print styles don't affect the main UI.

import type { LineItem, Project } from "../hooks/db";
import type { LaborConfig, BidTotals } from "../hooks/reportUtils";
import {
  extMat, extLaborHrs, displayUnit, isQuote,
  parseCategory, fmt, fmtHrs, blendedRate, computeTotals,
  type CrewCategory,
} from "../hooks/reportUtils";

// ── Shared CSS injected into every printed document ────────────────────────

const BASE_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 10pt;
    color: #1a2332;
    background: white;
  }
  h1 { font-size: 14pt; font-weight: 700; }
  h2 { font-size: 11pt; font-weight: 700; }

  /* ── Page header ── */
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 2px solid #1a3a6a;
    padding-bottom: 8px;
    margin-bottom: 14px;
  }
  .company-info { font-size: 9pt; color: #444; line-height: 1.5; }
  .company-name { font-size: 13pt; font-weight: 700; color: #1a3a6a; }
  .job-info { text-align: right; font-size: 9pt; color: #444; line-height: 1.5; }
  .report-title { font-size: 12pt; font-weight: 700; color: #1a3a6a; }

  /* ── Tables ── */
  table { width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 9pt; }
  th {
    background: #dce8f0;
    border: 1px solid #9ab4c8;
    padding: 4px 6px;
    text-align: left;
    font-size: 8pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #1a3a6a;
  }
  th.right { text-align: right; }
  td {
    border: 1px solid #c8dce8;
    padding: 3px 6px;
    vertical-align: middle;
    font-size: 9pt;
  }
  td.right  { text-align: right; font-family: "Courier New", monospace; }
  td.center { text-align: center; }
  td.mono   { font-family: "Courier New", monospace; }
  td.muted  { color: #666; }
  td.bold   { font-weight: 700; }
  tr.even   { background: #f4f8fc; }
  tr.odd    { background: white; }

  /* ── Section headers inside tables ── */
  tr.section-hdr td {
    text-align: center;
    font-weight: 700;
    font-size: 10pt;
    background: white;
    border-left: none;
    border-right: none;
    border-top: 10px solid #f0f4f8;
    padding: 6px 0 3px;
    color: #1a2332;
  }
  tr.subtotal td {
    background: #e8f0fe;
    font-weight: 700;
    border-top: 1px solid #9ab4c8;
  }
  tr.grand-total td {
    background: #1a3a6a;
    color: white;
    font-weight: 700;
    font-size: 10pt;
    border-color: #1a3a6a;
  }

  /* ── Two-column totals layout ── */
  .totals-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }
  .totals-section { margin-bottom: 14px; }
  .totals-row {
    display: flex;
    justify-content: space-between;
    padding: 4px 8px;
    border-bottom: 1px solid #e8eef4;
    font-size: 9.5pt;
  }
  .totals-row.header {
    background: #dce8f0;
    font-weight: 700;
    font-size: 9pt;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #1a3a6a;
    border-bottom: 2px solid #9ab4c8;
  }
  .totals-row.subtotal { font-weight: 700; background: #f0f4f8; }
  .totals-row.grand {
    background: #1a3a6a;
    color: white;
    font-weight: 700;
    font-size: 11pt;
    border-bottom: none;
    margin-top: 4px;
  }
  .totals-row .label { color: inherit; }
  .totals-row .amount { font-family: "Courier New", monospace; font-weight: 700; }
  .quote-label { color: #d97706; font-style: italic; }

  /* ── Print settings ── */
  @page {
    margin: 0.6in 0.5in;
    size: letter landscape;
  }
  /* Portrait override — applied via body.portrait class */
  body.portrait {
    font-size: 10.5pt;
  }
  @page {
    size: letter landscape;
    margin: 0.6in 0.5in;
  }
`;

// ── Header HTML builder ────────────────────────────────────────────────────

function buildHeader(
  project: Project,
  reportTitle: string,
  settings: Record<string, string>,
  date: string
): string {
  const company  = settings.company_name  || "Anmar Electric";
  const address  = settings.company_address || "";
  const cityLine = [settings.company_city, settings.company_state, settings.company_zip].filter(Boolean).join(", ");
  const phone    = settings.company_phone   || "";
  const email    = settings.company_email   || "";
  const license  = settings.company_license || "";
  const logo     = settings.company_logo    || "";

  const logoHTML = logo
    ? `<img src="${logo}" alt="Company logo" style="max-height:48px;max-width:160px;object-fit:contain;display:block;margin-bottom:6px;" />`
    : "";

  return `
    <div class="page-header">
      <div>
        ${logoHTML}
        <div class="company-name">${esc(company)}</div>
        <div class="company-info">
          ${address  ? esc(address)                : ""}
          ${cityLine ? `<br>${esc(cityLine)}`       : ""}
          ${phone    ? `<br>${esc(phone)}`          : ""}
          ${email    ? `<br>${esc(email)}`          : ""}
          ${license  ? `<br>Lic# ${esc(license)}`  : ""}
        </div>
      </div>
      <div style="text-align:center;">
        <div class="report-title">${esc(reportTitle)}</div>
        <div style="font-size:9pt;color:#666;margin-top:4px;">${date}</div>
      </div>
      <div class="job-info">
        <div style="font-weight:700;font-size:11pt;color:#1a2332;">${esc(project.name)}</div>
        ${project.client     ? `<div>${esc(project.client)}</div>`     : ""}
        ${project.address    ? `<div>${esc(project.address)}</div>`    : ""}
        ${project.bid_number ? `<div>Bid #${esc(project.bid_number)}</div>` : ""}
      </div>
    </div>
  `;
}

// ── Utility ────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function money(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── EXTENSIONS REPORT HTML ────────────────────────────────────────────────

function buildExtensionsHTML(
  project: Project,
  items: LineItem[],
  settings: Record<string, string>
): string {
  const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "2-digit", day: "2-digit" });
  const header = buildHeader(project, "Extension By Section", settings, date);

  // Group by category (takeoff type: Fire Alarm, Gear, Lights, etc.)
  // then within each group sort by section for sub-context
  const groupMap = new Map<string, LineItem[]>();
  for (const item of items) {
    const { category } = parseCategory(item.category);
    if (!groupMap.has(category)) groupMap.set(category, []);
    groupMap.get(category)!.push(item);
  }
  // Sort groups alphabetically
  const sortedGroups = Array.from(groupMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  let rows = "";
  let grandMat = 0;
  let grandLab = 0;

  for (const [groupName, sitems] of sortedGroups) {
    const secMat = sitems.reduce((s, i) => s + extMat(i), 0);
    const secLab = sitems.reduce((s, i) => s + extLaborHrs(i), 0);
    grandMat += secMat;
    grandLab += secLab;

    rows += `<tr class="section-hdr"><td colspan="9">--- ${esc(groupName)} ---</td></tr>`;
    // Within each category, sub-group by section
    const subSections = new Map<string, LineItem[]>();
    for (const item of sitems) {
      const sec = parseCategory(item.category).section;
      if (!subSections.has(sec)) subSections.set(sec, []);
      subSections.get(sec)!.push(item);
    }
    const hasMultipleSections = subSections.size > 1;
    let rowIdx = 0;
    for (const [sec, secItems] of subSections) {
      if (hasMultipleSections) {
        rows += `<tr style="background:#f4f8fc;"><td colspan="9" style="padding:3px 6px;font-size:8pt;font-style:italic;color:#445;border-top:1px solid #9ab4c8;">&nbsp;&nbsp;${esc(sec)}</td></tr>`;
      }
      secItems.forEach((item) => {
        const ep    = extMat(item);
        const el    = extLaborHrs(item);
        const u     = displayUnit(item.unit);
        const quote = isQuote(item);
        const cls   = rowIdx % 2 === 0 ? "even" : "odd";
        rowIdx++;
        rows += `
          <tr class="${cls}">
            <td class="mono muted">${esc(String(item.assembly_id ?? "—"))}</td>
            <td>${esc(item.description)}</td>
            <td class="right">${item.qty.toLocaleString()}</td>
            <td class="right">${quote ? '<span class="quote-label">QUOTE</span>' : money(item.unit_cost)}</td>
            <td class="center muted">${quote ? "" : u}</td>
            <td class="right bold">${quote ? "—" : money(ep)}</td>
            <td class="right">${item.labor_hours > 0 ? money(item.labor_hours) : "—"}</td>
            <td class="center muted">${item.labor_hours > 0 ? u : ""}</td>
            <td class="right bold">${el > 0 ? money(el) : "—"}</td>
          </tr>`;
      });
    }
    rows += `
      <tr class="subtotal">
        <td colspan="5" style="text-align:right;">--- ${esc(groupName)} Total ---</td>
        <td class="right">${money(secMat)}</td>
        <td colspan="2"></td>
        <td class="right">${money(secLab)}</td>
      </tr>
      <tr><td colspan="9" style="height:8px;border:none;"></td></tr>`;
  }

  rows += `
    <tr class="grand-total">
      <td colspan="5" style="text-align:right;color:white;">Grand Total</td>
      <td class="right" style="color:white;">${money(grandMat)}</td>
      <td colspan="2"></td>
      <td class="right" style="color:white;">${money(grandLab)}</td>
    </tr>`;

  const table = `
    <style>
      /* Extensions portrait overrides */
      table { font-size: 8.5pt; }
      td, th { padding: 2px 5px; }
      .section-hdr td { font-size: 9pt; padding: 5px 0 2px; }
    </style>
    <table>
      <thead>
        <tr>
          <th style="width:60px;">Item #</th>
          <th>Description</th>
          <th class="right" style="width:60px;">Qty</th>
          <th class="right" style="width:76px;">Price</th>
          <th style="width:22px;">U</th>
          <th class="right" style="width:76px;">Ext Price</th>
          <th class="right" style="width:66px;">Labor Hr</th>
          <th style="width:22px;">U</th>
          <th class="right" style="width:66px;">Ext Lab Hr</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;

  return wrapDocument("Extension By Section", header + table, true);
}

// ── MATERIAL LIST HTML ─────────────────────────────────────────────────────

function buildMaterialListHTML(
  project: Project,
  items: LineItem[],
  settings: Record<string, string>
): string {
  const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "2-digit", day: "2-digit" });
  const header = buildHeader(project, "Material List", settings, date);

  // Aggregate by description+unit
  const agg = new Map<string, { description: string; unit: string; qty: number; unitCost: number; assemblyId: number | null }>();
  for (const item of items) {
    const key = `${item.description}||${item.unit}`;
    if (agg.has(key)) { agg.get(key)!.qty += item.qty; }
    else agg.set(key, { description: item.description, unit: item.unit, qty: item.qty, unitCost: item.unit_cost, assemblyId: item.assembly_id });
  }
  const rows_data = Array.from(agg.values()).sort((a, b) => a.description.localeCompare(b.description));

  let rows = "";
  rows_data.forEach((row, idx) => {
    const u = displayUnit(row.unit);
    rows += `
      <tr class="${idx % 2 === 0 ? "even" : "odd"}">
        <td class="mono muted">${esc(String(row.assemblyId ?? "—"))}</td>
        <td>${esc(row.description)}</td>
        <td class="right bold">${row.qty.toLocaleString("en-US", { maximumFractionDigits: 2 })}</td>
        <td class="center muted">${u}</td>
        <td class="right muted">${row.unitCost > 0 ? `$${money(row.unitCost)} ${u}` : "—"}</td>
      </tr>`;
  });

  rows += `
    <tr class="grand-total">
      <td colspan="2" style="color:white;">Total: ${rows_data.length} items</td>
      <td colspan="3" style="color:white;text-align:right;font-size:8pt;">Sorted alphabetically · All quantities combined across sections</td>
    </tr>`;

  const table = `
    <table>
      <thead><tr>
        <th style="width:80px;">Item #</th>
        <th>Description</th>
        <th class="right" style="width:110px;">Total Quantity</th>
        <th style="width:50px;">Unit</th>
        <th class="right" style="width:120px;">Unit Price</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;

  return wrapDocument("Material List", header + table, true);
}

// ── TOTALS REPORT HTML ─────────────────────────────────────────────────────

function buildTotalsHTML(
  project: Project,
  items: LineItem[],
  cfg: LaborConfig,
  totals: BidTotals,
  settings: Record<string, string>
): string {
  const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "2-digit", day: "2-digit" });
  const header = buildHeader(project, "Bid Summary — Totals", settings, date);
  const rate = blendedRate(cfg.crew);

  const row = (label: string, value: string, cls = "") =>
    `<div class="totals-row ${cls}"><span class="label">${esc(label)}</span><span class="amount">${value}</span></div>`;
  const hdr = (label: string) =>
    `<div class="totals-row header"><span>${esc(label)}</span></div>`;
  const blank = () => `<div class="totals-row" style="height:6px;border:none;"></div>`;

  // ── Material ──────────────────────────────────────────────────────────────
  const materialSection = `
    <div class="totals-section">
      ${hdr("Material")}
      ${row("Non-Quoted Material", `$${money(totals.nonQuotedMaterial)}`)}
      ${row("Quoted Material",     `$${money(totals.quotedMaterial)}`)}
      ${row("Sales Tax",           `$${money(totals.salesTax)}`)}
      ${row("Total Material",      `$${money(totals.totalMaterialWithTax)}`, "subtotal")}
    </div>`;

  // ── Labor ─────────────────────────────────────────────────────────────────
  const laborSection = `
    <div class="totals-section">
      ${hdr("Direct Labor")}
      ${row("Total Labor Hours",   fmtHrs(totals.directLaborHours) + " hrs")}
      ${row("Blended Rate",        "$" + money(rate) + "/hr")}
      ${row("Direct Labor Cost",   "$" + money(totals.directLaborCost), "subtotal")}
      ${blank()}
      ${hdr("Non-Productive Labor")}
      ${row("Non-Productive Cost", "$" + money(totals.nonProductiveLaborCost), "subtotal")}
    </div>`;

  // ── Other + O&P + Final ───────────────────────────────────────────────────
  const otherSection = `
    <div class="totals-section">
      ${hdr("Other Costs")}
      ${row("Direct Job Expenses", "$" + money(totals.directJobExpenses))}
      ${row("Subcontracts",        "$" + money(totals.subcontracts))}
      ${row("Job Subtotal",        "$" + money(totals.jobSubtotal), "subtotal")}
      ${blank()}
      ${hdr("Overhead & Profit")}
      ${row("Overhead (" + cfg.overheadPct + "%)", "$" + money(totals.overhead))}
      ${row("Profit (" + cfg.profitPct + "%)",     "$" + money(totals.profit))}
      ${row("Job Total",           "$" + money(totals.jobTotal), "subtotal")}
      ${blank()}
      ${hdr("Bond")}
      ${row("Bond (" + cfg.bondPct + "%)", "$" + money(totals.bond))}
      ${blank()}
      ${row("ACTUAL BID PRICE",    "$" + money(totals.jobTotalWithBond), "grand")}
    </div>`;

  // ── Quoted items breakout ─────────────────────────────────────────────────
  const quoteItems = items.filter(i => isQuote(i));
  const quoteCategories = Array.from(new Set(quoteItems.map(i => parseCategory(i.category).category)));

  let quoteSectionHTML = "";
  if (quoteCategories.length > 0) {
    let quoteRows = "";
    let quotedTotal = 0;

    for (const cat of quoteCategories) {
      const catItems = quoteItems.filter(i => parseCategory(i.category).category === cat);
      const amount = cfg.quoteAmounts[cat] ?? 0;
      quotedTotal += amount;

      quoteRows += `<tr><td colspan="4" style="background:#dce8f0;font-weight:700;font-size:9pt;color:#1a3a6a;padding:4px 8px;border-top:2px solid #9ab4c8;">${esc(cat)}</td></tr>`;

      catItems.forEach((item, idx2) => {
        quoteRows += `<tr class="${idx2 % 2 === 0 ? "even" : "odd"}">
          <td class="mono muted" style="padding-left:14px;">${esc(String(item.assembly_id ?? "—"))}</td>
          <td style="padding-left:14px;">${esc(item.description)}</td>
          <td class="right">${item.qty.toLocaleString()}</td>
          <td class="center muted">${esc(item.unit)}</td>
        </tr>`;
      });

      quoteRows += `<tr>
        <td colspan="3" style="text-align:right;font-weight:700;padding:4px 8px;border-bottom:2px solid #9ab4c8;">Quote Amount — ${esc(cat)}:</td>
        <td class="right bold" style="font-size:10pt;border-bottom:2px solid #9ab4c8;">$${money(amount)}</td>
      </tr>
      <tr><td colspan="4" style="height:5px;border:none;"></td></tr>`;
    }

    quoteRows += `<tr class="grand-total">
      <td colspan="3" style="color:white;font-weight:700;">Total Quoted Material</td>
      <td class="right bold" style="color:white;font-size:11pt;">$${money(quotedTotal)}</td>
    </tr>`;

    quoteSectionHTML = `
      <div style="margin-top:16px;">
        <h2 style="margin-bottom:8px;color:#1a3a6a;font-size:11pt;border-bottom:2px solid #1a3a6a;padding-bottom:4px;">Quoted Items Breakout</h2>
        <table>
          <thead><tr>
            <th style="width:75px;">Item #</th>
            <th>Description</th>
            <th class="right" style="width:65px;">Qty</th>
            <th class="right" style="width:50px;">Unit</th>
          </tr></thead>
          <tbody>${quoteRows}</tbody>
        </table>
      </div>`;
  }

  // ── Portrait single-column layout ─────────────────────────────────────────
  const body = `
    <style>
      .totals-grid { display: block; }
      .totals-section { margin-bottom: 8px; }
      .totals-row { font-size: 10pt; padding: 5px 12px; }
      .totals-row.header { font-size: 8.5pt; }
      .totals-row.grand  { font-size: 13pt; padding: 9px 12px; margin-top: 4px; }
    </style>
    ${materialSection}
    ${laborSection}
    ${otherSection}
    ${quoteSectionHTML}`;

  return wrapDocument("Bid Summary — Totals", header + body, true);
}

// ── QUOTES HTML ───────────────────────────────────────────────────────────

function buildQuotesHTML(
  project: Project,
  items: LineItem[],
  cfg: LaborConfig,
  settings: Record<string, string>
): string {
  const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "2-digit", day: "2-digit" });
  const header = buildHeader(project, "Quotes Summary", settings, date);

  const quoteItems  = items.filter(i => isQuote(i));
  const categories  = Array.from(new Set(quoteItems.map(i => parseCategory(i.category).category)));

  let body = "";
  for (const cat of categories) {
    const catItems = quoteItems.filter(i => parseCategory(i.category).category === cat);
    const amount   = cfg.quoteAmounts[cat] ?? 0;

    let rows = "";
    catItems.forEach((item, idx) => {
      rows += `
        <tr class="${idx % 2 === 0 ? "even" : "odd"}">
          <td class="mono muted">${esc(String(item.assembly_id ?? "—"))}</td>
          <td>${esc(item.description)}</td>
          <td class="right">${item.qty}</td>
          <td class="right">${esc(item.unit)}</td>
        </tr>`;
    });

    body += `
      <h2 style="margin-bottom:6px;color:#1a3a6a;">${esc(cat)}</h2>
      <table>
        <thead><tr>
          <th style="width:80px;">Item #</th><th>Description</th>
          <th class="right" style="width:60px;">Qty</th>
          <th style="width:50px;">Unit</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="text-align:right;font-weight:700;font-size:10pt;margin-bottom:16px;color:#1a3a6a;">
        Quote Amount: $${money(amount)}
      </div>`;
  }

  const total = Object.values(cfg.quoteAmounts).reduce((s, v) => s + v, 0);
  body += `
    <div style="display:flex;justify-content:flex-end;margin-top:10px;">
      <div style="background:#1a3a6a;color:white;padding:8px 20px;font-weight:700;font-size:12pt;">
        Total Quoted Material: $${money(total)}
      </div>
    </div>`;

  return wrapDocument("Quotes Summary", header + body, true);
}

// ── SELECT BID SUMMARY HTML ──────────────────────────────────────────────
// Filtered view showing only selected sections with a clean summary layout.

function buildSelectBidSummaryHTML(
  project: Project,
  items: LineItem[],
  cfg: LaborConfig,
  totals: BidTotals,
  settings: Record<string, string>
): string {
  const date   = new Date().toLocaleDateString("en-US", { year: "numeric", month: "2-digit", day: "2-digit" });
  const header = buildHeader(project, "Bid Summary by Section", settings, date);
  const rate   = blendedRate(cfg.crew);

  // Group items by section
  const sectionMap = new Map<string, LineItem[]>();
  for (const item of items) {
    const { section } = parseCategory(item.category);
    if (!sectionMap.has(section)) sectionMap.set(section, []);
    sectionMap.get(section)!.push(item);
  }

  // Build section summary rows
  let secRows = "";
  let totalMat = 0;
  let totalLab = 0;

  for (const [section, sitems] of sectionMap) {
    const mat = sitems.reduce((s, i) => s + extMat(i), 0);
    const lab = sitems.reduce((s, i) => s + extLaborHrs(i), 0);
    const labCost = lab * rate;
    totalMat += mat;
    totalLab += lab;

    secRows += `
      <tr class="odd">
        <td style="font-weight:600;">${esc(section)}</td>
        <td class="right">${money(mat)}</td>
        <td class="right">${fmtHrs(lab)}</td>
        <td class="right">${money(labCost)}</td>
        <td class="right bold">${money(mat + labCost)}</td>
      </tr>`;
  }

  const secTable = `
    <h2 style="margin-bottom:8px;color:#1a3a6a;border-bottom:2px solid #1a3a6a;padding-bottom:4px;">Section Breakdown</h2>
    <table>
      <thead><tr>
        <th>Section</th>
        <th class="right" style="width:110px;">Material</th>
        <th class="right" style="width:80px;">Labor Hrs</th>
        <th class="right" style="width:110px;">Labor Cost</th>
        <th class="right" style="width:110px;">Section Total</th>
      </tr></thead>
      <tbody>${secRows}</tbody>
      <tfoot>
        <tr class="grand-total">
          <td style="color:white;font-weight:700;">TOTALS</td>
          <td class="right" style="color:white;font-weight:700;">${money(totalMat)}</td>
          <td class="right" style="color:white;font-weight:700;">${fmtHrs(totalLab)}</td>
          <td class="right" style="color:white;font-weight:700;">${money(totalLab * rate)}</td>
          <td class="right" style="color:white;font-weight:700;">${money(totalMat + totalLab * rate)}</td>
        </tr>
      </tfoot>
    </table>`;

  // Bid summary box
  const summaryBox = `
    <div style="margin-top:20px;border:2px solid #1a3a6a;border-radius:4px;overflow:hidden;">
      <div style="background:#1a3a6a;color:white;padding:8px 16px;font-weight:700;font-size:11pt;">Bid Summary</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0;">
        <div style="padding:8px 16px;border-right:1px solid #dce8f0;">
          ${bidRow("Non-Quoted Material", "$" + money(totals.nonQuotedMaterial))}
          ${bidRow("Quoted Material",     "$" + money(totals.quotedMaterial))}
          ${bidRow("Sales Tax",           "$" + money(totals.salesTax))}
          ${bidRow("Direct Labor",        "$" + money(totals.directLaborCost), true)}
          ${bidRow("Non-Productive Labor","$" + money(totals.nonProductiveLaborCost))}
          ${bidRow("Direct Job Expenses", "$" + money(totals.directJobExpenses))}
          ${bidRow("Subcontracts",        "$" + money(totals.subcontracts))}
        </div>
        <div style="padding:8px 16px;">
          ${bidRow("Job Subtotal",        "$" + money(totals.jobSubtotal), true)}
          ${bidRow("Overhead (" + cfg.overheadPct + "%)", "$" + money(totals.overhead))}
          ${bidRow("Profit (" + cfg.profitPct + "%)",     "$" + money(totals.profit))}
          ${bidRow("Bond (" + cfg.bondPct + "%)",         "$" + money(totals.bond))}
          <div style="margin-top:8px;background:#1a3a6a;color:white;padding:8px 12px;font-weight:700;font-size:12pt;display:flex;justify-content:space-between;">
            <span>ACTUAL BID PRICE</span>
            <span>$${money(totals.jobTotalWithBond)}</span>
          </div>
        </div>
      </div>
    </div>`;

  return wrapDocument("Bid Summary by Section", header + secTable + summaryBox, true);
}

function bidRow(label: string, value: string, bold = false): string {
  return `<div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid #f0f0f0;font-size:9.5pt;${bold ? "font-weight:700;" : ""}">
    <span>${esc(label)}</span><span style="font-family:'Courier New',monospace;">${value}</span>
  </div>`;
}

// ── Document wrapper ───────────────────────────────────────────────────────

function wrapDocument(title: string, body: string, portrait = false): string {
  const pageStyle = portrait
    ? `<style>@page { size: letter portrait; margin: 0.55in 0.5in; }</style>`
    : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${esc(title)}</title>
  <style>${BASE_CSS}</style>
  ${pageStyle}
</head>
<body class="${portrait ? "portrait" : ""}">${body}</body>
</html>`;
}

// ── Main print trigger ─────────────────────────────────────────────────────

export interface PrintOptions {
  report: string;
  project: Project;
  items: LineItem[];
  cfg: LaborConfig;
  totals: BidTotals;
  settings: Record<string, string>;
}

export function printReport(opts: PrintOptions): void {
  const { report, project, items, cfg, totals, settings } = opts;

  let html = "";
  switch (report) {
    case "Extensions":
      html = buildExtensionsHTML(project, items, settings);
      break;
    case "Material List":
      html = buildMaterialListHTML(project, items, settings);
      break;
    case "Totals":
      html = buildTotalsHTML(project, items, cfg, totals, settings);
      break;
    case "Quotes":
      html = buildQuotesHTML(project, items, cfg, settings);
      break;
    case "Select Bid Summary":
      html = buildSelectBidSummaryHTML(project, items, cfg, totals, settings);
      break;
    default:
      html = buildExtensionsHTML(project, items, settings);
  }

  // Create a hidden iframe, write the HTML into it, then print it
  const existingFrame = document.getElementById("__print_frame__");
  if (existingFrame) existingFrame.remove();

  const iframe = document.createElement("iframe");
  iframe.id = "__print_frame__";
  iframe.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) return;

  doc.open();
  doc.write(html);
  doc.close();

  // Wait for content to render then print
  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    // Clean up after print dialog closes
    setTimeout(() => iframe.remove(), 3000);
  }, 400);
}
