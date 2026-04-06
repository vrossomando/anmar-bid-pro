import type { LineItem, Project } from "./db";

// ── Unit math ──────────────────────────────────────────────────────────────

export function unitDivisor(unit: string): number {
  if (unit === "C" || unit === "c" || unit === "/100") return 100;
  if (unit === "M" || unit === "/1000") return 1000;
  return 1;
}

export function extMat(item: LineItem): number {
  return (item.qty / unitDivisor(item.unit)) * item.unit_cost;
}

export function extLaborHrs(item: LineItem): number {
  return (item.qty / unitDivisor(item.labor_unit ?? item.unit)) * item.labor_hours;
}

export function displayUnit(unit: string): string {
  if (unit === "C" || unit === "c") return "C";
  if (unit === "M") return "M";
  if (unit === "E" || unit === "ea") return "E";
  if (unit === "L" || unit === "lf") return "LF";
  return unit.toUpperCase();
}

export function isQuote(item: LineItem): boolean {
  // A quoted item has $0 unit cost — the fixture price comes from a supplier quote.
  // Labor hours may still be present (installation labor is estimated separately).
  return item.unit_cost === 0 && item.qty > 0;
}

// ── Crew category types ────────────────────────────────────────────────────

export interface CrewCategory {
  name: string;
  pctOfTotal: number;  // 0-100
  baseRate: number;
  burdenDollars: number;
  burdenPct: number;
}

export const DEFAULT_CREW: CrewCategory[] = [
  { name: "Foreman w Truck",  pctOfTotal: 0,  baseRate: 144.42, burdenDollars: 0, burdenPct: 0 },
  { name: "Project Foreman",  pctOfTotal: 0,  baseRate: 144.42, burdenDollars: 0, burdenPct: 0 },
  { name: "General Foreman",  pctOfTotal: 0,  baseRate: 144.42, burdenDollars: 0, burdenPct: 0 },
  { name: "Foreman",          pctOfTotal: 10, baseRate: 144.42, burdenDollars: 0, burdenPct: 0 },
  { name: "Journeyman",       pctOfTotal: 70, baseRate: 138.56, burdenDollars: 0, burdenPct: 0 },
  { name: "Apprentice",       pctOfTotal: 20, baseRate: 103.93, burdenDollars: 0, burdenPct: 0 },
  { name: "",                 pctOfTotal: 0,  baseRate: 0,      burdenDollars: 0, burdenPct: 0 },
  { name: "",                 pctOfTotal: 0,  baseRate: 0,      burdenDollars: 0, burdenPct: 0 },
  { name: "",                 pctOfTotal: 0,  baseRate: 0,      burdenDollars: 0, burdenPct: 0 },
  { name: "",                 pctOfTotal: 0,  baseRate: 0,      burdenDollars: 0, burdenPct: 0 },
];

export function totalRate(cat: CrewCategory): number {
  return cat.baseRate + cat.burdenDollars + (cat.baseRate * cat.burdenPct / 100);
}

export function blendedRate(crew: CrewCategory[]): number {
  const total = crew.reduce((s, c) => s + c.pctOfTotal, 0);
  if (total === 0) return 0;
  return crew.reduce((s, c) => s + (c.pctOfTotal / total) * totalRate(c), 0);
}

// ── Quote management ───────────────────────────────────────────────────────

export interface QuoteEntry {
  category: string;     // "Lighting", "Fire Alarm", "Gear" etc.
  itemId: string;       // line item id it belongs to
  description: string;
  qty: number;
  // Per-supplier lump sum prices (user enters these)
  supplierPrices: Record<string, number>;  // supplierName → price
  miscAdder: number;
  selectedSupplier: string;  // which supplier's price to use
}

export const DEFAULT_SUPPLIERS = ["Anmar", "Colonial", "Turtle & Hughes", "Graybar", "American Power", "Denny"];

// ── Labor config ───────────────────────────────────────────────────────────

// ── Direct Job Expense rows (Description | Qty | Rate → Total) ────────────

export interface ExpenseRow {
  description: string;
  qty: number;
  rate: number;
}

export function expenseTotal(r: ExpenseRow): number {
  return r.qty * r.rate;
}

export const DEFAULT_JOB_EXPENSE_ROWS: ExpenseRow[] = [
  { description: "Permits",            qty: 0, rate: 0 },
  { description: "Inspections",        qty: 0, rate: 0 },
  { description: "Fireproofing material", qty: 0, rate: 0 },
  { description: "Heating",            qty: 0, rate: 0 },
  { description: "PECO Costs",         qty: 0, rate: 0 },
  { description: "Permit",             qty: 0, rate: 0 },
  { description: "Temporary Power",    qty: 0, rate: 0 },
  { description: "Excavation",         qty: 0, rate: 0 },
  { description: "Auto CAD",           qty: 0, rate: 0 },
  { description: "Project Management", qty: 0, rate: 0 },
  { description: "Tool Rental",        qty: 0, rate: 0 },
  { description: "",                   qty: 0, rate: 0 },
  { description: "",                   qty: 0, rate: 0 },
];

// ── Subcontract rows (Description | Qty | Rate → Total) ───────────────────

export const DEFAULT_SUBCONTRACT_ROWS: ExpenseRow[] = [
  { description: "Excavation",                       qty: 0, rate: 0 },
  { description: "Data and Communication (Public Space)", qty: 0, rate: 0 },
  { description: "Modular Data",                     qty: 0, rate: 0 },
  { description: "Sound",                            qty: 0, rate: 0 },
  { description: "Security",                         qty: 0, rate: 0 },
  { description: "Asphalt Cut & Patch",              qty: 0, rate: 0 },
  { description: "Concrete Cut & Patch",             qty: 0, rate: 0 },
  { description: "Pole Base (Form & Concrete)",      qty: 0, rate: 0 },
  { description: "Pole Base (Drilling)",             qty: 0, rate: 0 },
  { description: "Pole Base (Poured in Place)",      qty: 0, rate: 0 },
  { description: "Trench (Backhoe)",                 qty: 0, rate: 0 },
  { description: "Trench (Riding Trencher)",         qty: 0, rate: 0 },
  { description: "",                                 qty: 0, rate: 0 },
  { description: "",                                 qty: 0, rate: 0 },
];

// ── Non-Productive Labor rows (Description | Hours | Rate | Factor% → Extended) ──

export interface NonProdRow {
  description: string;
  hours: number;
  rate: number;
  factorPct: number;
}

export function nonProdExtended(r: NonProdRow): number {
  return r.hours * r.rate * (1 + r.factorPct / 100);
}

export const DEFAULT_NON_PROD_ROWS: NonProdRow[] = [
  { description: "Timekeeper",         hours: 0, rate: 0,      factorPct: 0 },
  { description: "Watchman",           hours: 0, rate: 0,      factorPct: 0 },
  { description: "Flagman",            hours: 0, rate: 0,      factorPct: 0 },
  { description: "Testing",            hours: 0, rate: 0,      factorPct: 0 },
  { description: "Material Purchasing",hours: 0, rate: 0,      factorPct: 0 },
  { description: "Temporary Standby",  hours: 0, rate: 0,      factorPct: 0 },
  { description: "Fireproofing",       hours: 0, rate: 0,      factorPct: 0 },
  { description: "Foreman",            hours: 0, rate: 144.42, factorPct: 0 },
  { description: "Non Productive Labor",hours: 0, rate: 138.56, factorPct: 0 },
  { description: "",                   hours: 0, rate: 0,      factorPct: 0 },
  { description: "",                   hours: 0, rate: 0,      factorPct: 0 },
];

export interface LaborConfig {
  crew: CrewCategory[];
  // Non-productive labor
  nonProdMode: "lump" | "breakdown";
  nonProdLumpSum: number;
  nonProdRows: NonProdRow[];
  // Direct Job Expenses
  jobExpMode: "lump" | "breakdown" | "pct";
  jobExpLumpSum: number;
  jobExpRows: ExpenseRow[];
  jobExpPctMode: "material" | "labor" | "both";
  jobExpPct: number;
  // Subcontracts
  subMode: "lump" | "breakdown";
  subLumpSum: number;
  subRows: ExpenseRow[];
  overheadPct: number;
  profitPct: number;
  bondPct: number;
  taxRate: number;
  actualBidPrice: number;
  // Quotes: category → selected price
  quoteAmounts: Record<string, number>;   // category → $ amount
}

export const DEFAULT_LABOR: LaborConfig = {
  crew: DEFAULT_CREW,
  nonProdMode: "breakdown",
  nonProdLumpSum: 0,
  nonProdRows: DEFAULT_NON_PROD_ROWS.map(r => ({ ...r })),
  jobExpMode: "breakdown",
  jobExpLumpSum: 0,
  jobExpRows: DEFAULT_JOB_EXPENSE_ROWS.map(r => ({ ...r })),
  jobExpPctMode: "material",
  jobExpPct: 0,
  subMode: "breakdown",
  subLumpSum: 0,
  subRows: DEFAULT_SUBCONTRACT_ROWS.map(r => ({ ...r })),
  overheadPct: 10,
  profitPct: 0,
  bondPct: 0,
  taxRate: 0,
  actualBidPrice: 0,
  quoteAmounts: {},
};

// ── Bid totals ─────────────────────────────────────────────────────────────

export interface BidTotals {
  nonQuotedMaterial: number;
  quotedMaterial: number;
  totalMaterial: number;
  salesTax: number;
  totalMaterialWithTax: number;
  directLaborHours: number;
  directLaborCost: number;
  nonProductiveLaborCost: number;
  totalLaborHours: number;
  totalLaborCost: number;
  directJobExpenses: number;
  toolsMiscMaterials: number;
  subcontracts: number;
  jobSubtotal: number;  // prime cost
  overhead: number;
  profit: number;
  jobTotal: number;
  bond: number;
  jobTotalWithBond: number;
  actualBidPrice: number;
  blendedRate: number;
  // Analytics
  matToLaborRatio: number;
  grossProfitDollar: number;
  grossProfitPct: number;
}

export function computeTotals(items: LineItem[], cfg: LaborConfig): BidTotals {
  const rate = blendedRate(cfg.crew);
  const nonQuotedItems = items.filter(i => !isQuote(i));
  const quoteItems     = items.filter(i => isQuote(i));

  const nonQuotedMaterial = nonQuotedItems.reduce((s, i) => s + extMat(i), 0);

  // Sum quote amounts by category
  const quotedMaterial = quoteItems.reduce((s, i) => {
    const cat = parseCategory(i.category).category;
    return s + (cfg.quoteAmounts[cat] ?? 0) * i.qty;
  }, 0)
  // Also add any quote amounts that may have been entered for named categories
  + Object.values(cfg.quoteAmounts).reduce((s, v) => s + v, 0) -
  quoteItems.reduce((s, i) => {
    const cat = parseCategory(i.category).category;
    return s + (cfg.quoteAmounts[cat] ?? 0) * i.qty;
  }, 0);
  // Simpler: just sum all quote amounts directly
  const quotedMaterialTotal = Object.values(cfg.quoteAmounts).reduce((s, v) => s + v, 0);

  const totalMaterial = nonQuotedMaterial + quotedMaterialTotal;
  const salesTax = totalMaterial * (cfg.taxRate / 100);
  const totalMaterialWithTax = totalMaterial + salesTax;

  const directLaborHours = items.reduce((s, i) => s + extLaborHrs(i), 0);
  const directLaborCost  = directLaborHours * rate;
  const nonProductiveLaborCost = cfg.nonProdMode === "lump"
    ? cfg.nonProdLumpSum
    : cfg.nonProdRows.reduce((s, r) => s + nonProdExtended(r), 0);
  const nonProdHours = cfg.nonProdMode === "lump" ? 0 : cfg.nonProdRows.reduce((s, r) => s + r.hours, 0);
  const totalLaborHours = directLaborHours + nonProdHours;
  const totalLaborCost  = directLaborCost + nonProductiveLaborCost;

  const directJobExpenses = cfg.jobExpMode === "lump"
    ? cfg.jobExpLumpSum
    : cfg.jobExpMode === "pct"
      ? (cfg.jobExpPctMode === "material" ? totalMaterial :
         cfg.jobExpPctMode === "labor"    ? directLaborCost :
         totalMaterial + directLaborCost) * cfg.jobExpPct / 100
      : cfg.jobExpRows.reduce((s, r) => s + expenseTotal(r), 0);

  const subcontracts = cfg.subMode === "lump"
    ? cfg.subLumpSum
    : cfg.subRows.reduce((s, r) => s + expenseTotal(r), 0);

  const jobSubtotal = totalMaterialWithTax + totalLaborCost + directJobExpenses + subcontracts;
  const overhead = jobSubtotal * (cfg.overheadPct / 100);
  const profit   = (jobSubtotal + overhead) * (cfg.profitPct / 100);
  const jobTotal = jobSubtotal + overhead + profit;
  const bond     = jobTotal * (cfg.bondPct / 100);
  const jobTotalWithBond = jobTotal + bond;
  const actualBidPrice = cfg.actualBidPrice || jobTotalWithBond;

  const grossProfitDollar = actualBidPrice - jobSubtotal;
  const grossProfitPct    = actualBidPrice > 0 ? (grossProfitDollar / actualBidPrice) * 100 : 0;
  const matToLaborRatio   = totalLaborCost > 0 ? totalMaterial / totalLaborCost : 0;

  return {
    nonQuotedMaterial, quotedMaterial: quotedMaterialTotal,
    totalMaterial, salesTax, totalMaterialWithTax,
    directLaborHours, directLaborCost, nonProductiveLaborCost,
    totalLaborHours, totalLaborCost,
    directJobExpenses,
    toolsMiscMaterials: 0,
    subcontracts,
    jobSubtotal, overhead, profit, jobTotal, bond, jobTotalWithBond,
    actualBidPrice, blendedRate: rate,
    matToLaborRatio, grossProfitDollar, grossProfitPct,
  };
}

// ── Parsing ────────────────────────────────────────────────────────────────

export function parseCategory(raw: string): { category: string; section: string; breakdown: string } {
  const parts = raw.split("|").map(s => s.trim());
  return {
    category:  parts[0] ?? raw,
    section:   parts[1] ?? "BASE BID",
    breakdown: parts[2] ?? "BASE BID",
  };
}

export function groupByCategory(items: LineItem[]): Map<string, LineItem[]> {
  const map = new Map<string, LineItem[]>();
  for (const item of items) {
    const { category } = parseCategory(item.category);
    if (!map.has(category)) map.set(category, []);
    map.get(category)!.push(item);
  }
  return map;
}

export function groupBySection(items: LineItem[]): Map<string, LineItem[]> {
  const map = new Map<string, LineItem[]>();
  for (const item of items) {
    const { section } = parseCategory(item.category);
    if (!map.has(section)) map.set(section, []);
    map.get(section)!.push(item);
  }
  return map;
}

// ── Formatting ─────────────────────────────────────────────────────────────

export function fmt(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtHrs(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
}
