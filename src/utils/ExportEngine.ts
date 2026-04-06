/**
 * ExportEngine.ts
 * Generates CSV exports for Extensions and Material List reports.
 * Uses the same data structures as PrintEngine — no new dependencies needed.
 */

import { type LineItem } from "../hooks/db";
import { type LaborConfig } from "../hooks/reportUtils";
import { extMat, extLaborHrs, displayUnit, parseCategory, blendedRate } from "../hooks/reportUtils";

// ── CSV helpers ───────────────────────────────────────────────────────────

function esc(val: string | number | null | undefined): string {
  const s = String(val ?? "");
  // Wrap in quotes if contains comma, quote, or newline
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function row(...cells: (string | number | null | undefined)[]): string {
  return cells.map(esc).join(",");
}

function money(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Extensions CSV ────────────────────────────────────────────────────────

export function buildExtensionsCSV(
  projectName: string,
  items: LineItem[],
  cfg: LaborConfig
): string {
  const rate = blendedRate(cfg.crew);
  const lines: string[] = [];

  // Title rows
  lines.push(row("EXTENSIONS REPORT"));
  lines.push(row("Project:", projectName));
  lines.push(row("Date:", new Date().toLocaleDateString("en-US")));
  lines.push(row("Blended Labor Rate:", `$${money(rate)}/hr`));
  lines.push("");

  // Column headers
  lines.push(row(
    "Takeoff Type", "Section", "Breakdown",
    "Item #", "Description",
    "Qty", "Unit",
    "Unit Cost", "Ext Material ($)",
    "Labor Hrs", "Labor U", "Ext Labor Hrs",
    "Ext Labor Cost ($)"
  ));

  // Group by category (takeoff type) then section
  const groupMap = new Map<string, LineItem[]>();
  for (const item of items) {
    const { category } = parseCategory(item.category);
    if (!groupMap.has(category)) groupMap.set(category, []);
    groupMap.get(category)!.push(item);
  }

  let grandMat = 0;
  let grandLab = 0;

  for (const [groupName, groupItems] of Array.from(groupMap.entries()).sort()) {
    const groupMat = groupItems.reduce((s, i) => s + extMat(i), 0);
    const groupLab = groupItems.reduce((s, i) => s + extLaborHrs(i), 0);
    grandMat += groupMat;
    grandLab += groupLab;

    // Group header row
    lines.push(row(`--- ${groupName} ---`));

    for (const item of groupItems) {
      const { category, section, breakdown } = parseCategory(item.category);
      const ep = extMat(item);
      const el = extLaborHrs(item);
      const u  = displayUnit(item.unit);
      lines.push(row(
        category, section, breakdown,
        item.assembly_id ?? "",
        item.description,
        item.qty, u,
        item.unit_cost === 0 ? "QUOTE" : money(item.unit_cost),
        item.unit_cost === 0 ? "QUOTE" : money(ep),
        item.labor_hours || "",
        item.labor_hours ? u : "",
        el > 0 ? money(el) : "",
        el > 0 ? money(el * rate) : ""
      ));
    }

    // Group subtotal
    lines.push(row(
      "", "", "", "", `--- ${groupName} Subtotal ---`,
      "", "", "",
      money(groupMat),
      "", "",
      money(groupLab),
      money(groupLab * rate)
    ));
    lines.push("");
  }

  // Grand total
  lines.push(row(
    "", "", "", "", "GRAND TOTAL",
    "", "", "",
    money(grandMat),
    "", "",
    money(grandLab),
    money(grandLab * rate)
  ));

  return lines.join("\r\n");
}

// ── Material List CSV ─────────────────────────────────────────────────────

export function buildMaterialListCSV(
  projectName: string,
  items: LineItem[]
): string {
  const lines: string[] = [];

  // Title rows
  lines.push(row("MATERIAL LIST"));
  lines.push(row("Project:", projectName));
  lines.push(row("Date:", new Date().toLocaleDateString("en-US")));
  lines.push("");

  // Column headers
  lines.push(row("Item #", "Description", "Total Qty", "Unit", "Unit Cost ($)", "Ext Cost ($)"));

  // Aggregate: sum qty for identical description+unit
  const agg = new Map<string, {
    assemblyId: number | null;
    description: string;
    unit: string;
    qty: number;
    unitCost: number;
  }>();

  for (const item of items) {
    if (item.unit_cost === 0) continue; // Skip quoted items — no material cost to list
    const key = `${item.description.trim()}||${item.unit}`;
    if (agg.has(key)) {
      agg.get(key)!.qty += item.qty / (item.unit === "C" ? 100 : item.unit === "M" ? 1000 : 1);
    } else {
      agg.set(key, {
        assemblyId: item.assembly_id,
        description: item.description.trim(),
        unit: displayUnit(item.unit),
        qty: item.qty / (item.unit === "C" ? 100 : item.unit === "M" ? 1000 : 1),
        unitCost: item.unit_cost,
      });
    }
  }

  // Sort alphabetically
  const sorted = Array.from(agg.values()).sort((a, b) => a.description.localeCompare(b.description));

  let grandTotal = 0;
  for (const entry of sorted) {
    const ext = entry.qty * entry.unitCost;
    grandTotal += ext;
    lines.push(row(
      entry.assemblyId ?? "",
      entry.description,
      money(entry.qty),
      entry.unit,
      money(entry.unitCost),
      money(ext)
    ));
  }

  lines.push("");
  lines.push(row("", "GRAND TOTAL", "", "", "", money(grandTotal)));

  return lines.join("\r\n");
}

// ── Trigger download via Tauri invoke ─────────────────────────────────────

export async function exportCSV(
  filename: string,
  csvContent: string
): Promise<string> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<string>("save_csv_file", {
    defaultName: filename,
    content: csvContent,
  });
}
