import Database from "@tauri-apps/plugin-sql";

const DB_PATH = "sqlite:anmarbidpro.db";
let _db: Database | null = null;

export async function getDb(): Promise<Database> {
  if (_db) return _db;
  try {
    _db = await Database.load(DB_PATH);
    return _db;
  } catch (e) {
    _db = null; // reset so next call retries
    throw e;
  }
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface Project {
  id: string;
  name: string;
  bid_number: string;
  client: string;
  address: string;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  description: string;
  notes: string;
  status: "draft" | "sent" | "approved" | "rejected";
  square_footage: number;
  tax_rate: number;
  actual_bid_price: number;
  commodity_type: "bid" | "pco";  // which commodity sheet to use for pricing
  created_at: string;
  updated_at: string;
}

export interface LineItem {
  id: string;
  project_id: string;
  category: string;
  description: string;
  qty: number;
  unit: string;        // price unit: E, C, M, LF
  unit_cost: number;
  markup_pct: number;
  labor_hours: number;
  labor_unit: string;  // labor unit: E, C, M, LF (may differ from price unit)
  labor_rate: number;
  assembly_id: number | null;
  sort_order: number;
  created_at: string;
}

export interface Assembly {
  id: number;
  item_number: string;
  description: string;
  upc: string;
  cat_number: string;
  category: string;
  subcategory: string;
  discount: number;
  unit_price: number | null;
  price_unit: string;
  price_is_quote: number;
  price_is_open: number;
  quote_ref: string;
  labor_1: number | null;
  labor_2: number | null;
  labor_3: number | null;
  labor_4: number | null;
  labor_5: number | null;
  labor_6: number | null;
  labor_unit: string;
  phase: number;
  res_phase: number;
}

export type Settings = Record<string, string>;

export const PRICE_UNIT_LABELS: Record<string, string> = {
  E: "each", C: "/ 100", M: "/ 1000", L: "/ LF", P: "project", c: "/ 100",
};

export const APP_CATEGORIES = [
  "Security",
  "Fire Alarm",
  "Gear",
  "Conduit / Wire Feeders",
  "Cable",
  "Lights & Devices",
  "Miscellaneous Items",
] as const;

export type AppCategory = typeof APP_CATEGORIES[number];

// ── Project CRUD ───────────────────────────────────────────────────────────

export async function listProjects(): Promise<Project[]> {
  const db = await getDb();
  return db.select<Project[]>(`SELECT * FROM projects ORDER BY updated_at DESC`);
}

export async function getProject(id: string): Promise<Project | null> {
  const db = await getDb();
  const rows = await db.select<Project[]>(`SELECT * FROM projects WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function createProject(p: Omit<Project, "created_at" | "updated_at">): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO projects (id, name, bid_number, client, address, contact_name, contact_phone, contact_email, description, notes, status, square_footage, tax_rate, actual_bid_price, commodity_type)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
    [p.id, p.name, p.bid_number, p.client, p.address, p.contact_name, p.contact_phone, p.contact_email, p.description, p.notes, p.status, p.square_footage, p.tax_rate, p.actual_bid_price ?? 0, p.commodity_type ?? "bid"]
  );
}

export async function updateProject(
  id: string,
  fields: Partial<Omit<Project, "id" | "created_at" | "updated_at">>
): Promise<void> {
  const db = await getDb();
  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  for (const [k, v] of Object.entries(fields)) { sets.push(`${k} = $${i++}`); vals.push(v); }
  sets.push(`updated_at = datetime('now')`);
  vals.push(id);
  await db.execute(`UPDATE projects SET ${sets.join(", ")} WHERE id = $${i}`, vals);
}

export async function deleteProject(id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`DELETE FROM projects WHERE id = $1`, [id]);
}

// ── Line Item CRUD ─────────────────────────────────────────────────────────

export async function listLineItems(projectId: string): Promise<LineItem[]> {
  const db = await getDb();
  return db.select<LineItem[]>(
    `SELECT * FROM line_items WHERE project_id = $1 ORDER BY sort_order, created_at`,
    [projectId]
  );
}

export async function createLineItem(item: Omit<LineItem, "created_at">): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO line_items
       (id,project_id,category,description,qty,unit,unit_cost,markup_pct,
        labor_hours,labor_unit,labor_rate,assembly_id,sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [item.id, item.project_id, item.category, item.description, item.qty,
     item.unit, item.unit_cost, item.markup_pct, item.labor_hours,
     item.labor_unit ?? "E", item.labor_rate, item.assembly_id ?? null, item.sort_order]
  );
  await db.execute(`UPDATE projects SET updated_at=datetime('now') WHERE id=$1`, [item.project_id]);
}

export async function updateLineItem(
  id: string,
  fields: Partial<Omit<LineItem, "id" | "project_id" | "created_at">>
): Promise<void> {
  const db = await getDb();
  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  for (const [k, v] of Object.entries(fields)) { sets.push(`${k} = $${i++}`); vals.push(v); }
  vals.push(id);
  await db.execute(`UPDATE line_items SET ${sets.join(", ")} WHERE id = $${i}`, vals);
}

export async function deleteLineItem(id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`DELETE FROM line_items WHERE id = $1`, [id]);
}

// ── Assemblies Catalog ─────────────────────────────────────────────────────

export async function listSubcategories(category: string): Promise<string[]> {
  const db = await getDb();
  const rows = await db.select<{ subcategory: string }[]>(
    `SELECT DISTINCT subcategory FROM assemblies WHERE category=$1 ORDER BY subcategory`,
    [category]
  );
  return rows.map((r) => r.subcategory);
}

export async function listAssemblies(
  category: string,
  subcategory?: string,
  limit = 250,
  offset = 0
): Promise<Assembly[]> {
  const db = await getDb();
  if (subcategory) {
    return db.select<Assembly[]>(
      `SELECT * FROM assemblies WHERE category=$1 AND subcategory=$2
       ORDER BY description LIMIT $3 OFFSET $4`,
      [category, subcategory, limit, offset]
    );
  }
  return db.select<Assembly[]>(
    `SELECT * FROM assemblies WHERE category=$1
     ORDER BY subcategory, description LIMIT $2 OFFSET $3`,
    [category, limit, offset]
  );
}

export async function searchAssemblies(
  query: string,
  category?: string,
  limit = 150
): Promise<Assembly[]> {
  const db = await getDb();
  const like = `%${query}%`;
  if (category) {
    return db.select<Assembly[]>(
      `SELECT * FROM assemblies
       WHERE category=$1 AND (description LIKE $2 OR item_number LIKE $2 OR cat_number LIKE $2)
       ORDER BY description LIMIT $3`,
      [category, like, limit]
    );
  }
  return db.select<Assembly[]>(
    `SELECT * FROM assemblies
     WHERE description LIKE $1 OR item_number LIKE $1 OR cat_number LIKE $1
     ORDER BY category, description LIMIT $2`,
    [like, limit]
  );
}

export async function getAssemblyByItemNumber(itemNumber: string): Promise<Assembly | null> {
  const db = await getDb();
  const rows = await db.select<Assembly[]>(
    `SELECT * FROM assemblies WHERE item_number=$1 AND unit_price IS NOT NULL ORDER BY unit_price DESC LIMIT 1`,
    [itemNumber]
  );
  if (rows.length > 0) return rows[0];
  // Fallback: any row with that item number
  const all = await db.select<Assembly[]>(`SELECT * FROM assemblies WHERE item_number=$1 LIMIT 1`, [itemNumber]);
  return all[0] ?? null;
}

export async function getAssembly(id: number): Promise<Assembly | null> {
  const db = await getDb();
  const rows = await db.select<Assembly[]>(`SELECT * FROM assemblies WHERE id=$1`, [id]);
  return rows[0] ?? null;
}

export async function assemblyCategoryCounts(): Promise<{ category: string; count: number }[]> {
  const db = await getDb();
  return db.select<{ category: string; count: number }[]>(
    `SELECT category, COUNT(*) as count FROM assemblies GROUP BY category ORDER BY count DESC`
  );
}

// ── Settings ───────────────────────────────────────────────────────────────

export async function loadSettings(): Promise<Settings> {
  const db = await getDb();
  const rows = await db.select<{ key: string; value: string }[]>(`SELECT key, value FROM settings`);
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export async function saveSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO settings (key,value) VALUES ($1,$2)
     ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
    [key, value]
  );
}

// ── Math helpers ───────────────────────────────────────────────────────────

export function materialCost(item: LineItem): number {
  return item.qty * item.unit_cost * (1 + item.markup_pct / 100);
}

export function laborCost(item: LineItem): number {
  return item.qty * item.labor_hours * item.labor_rate;
}

export function lineTotal(item: LineItem): number {
  return materialCost(item) + laborCost(item);
}

export function projectTotals(items: LineItem[], taxRate: number) {
  const materialSubtotal = items.reduce((s, i) => s + materialCost(i), 0);
  const laborSubtotal    = items.reduce((s, i) => s + laborCost(i), 0);
  const subtotal         = materialSubtotal + laborSubtotal;
  const tax              = subtotal * (taxRate / 100);
  const total            = subtotal + tax;
  const totalLaborHours  = items.reduce((s, i) => s + i.qty * i.labor_hours, 0);
  return { materialSubtotal, laborSubtotal, subtotal, tax, total, totalLaborHours };
}

export function priceUnitLabel(code: string): string {
  return PRICE_UNIT_LABELS[code] ?? code;
}

export function formatMoney(n: number, symbol = "$"): string {
  return `${symbol}${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ── Custom Assemblies ──────────────────────────────────────────────────────
// A custom assembly is a named collection of line items that can be
// dropped into any estimate as a single action.

export interface CustomAssembly {
  id: string;
  name: string;
  category: string;
  description: string;
  items: CustomAssemblyItem[];
  created_at: string;
  updated_at: string;
}

export interface CustomAssemblyItem {
  description: string;
  qty: number;
  unit: string;
  unit_cost: number;
  labor_hours: number;
  labor_rate: number;
  assembly_id: number | null;
}

export async function listCustomAssemblies(): Promise<CustomAssembly[]> {
  const db   = await getDb();
  const rows = await db.select<{ id: string; name: string; category: string; description: string; items: string; created_at: string; updated_at: string }[]>(
    `SELECT id, name, category, description, items, created_at, updated_at
     FROM custom_assemblies ORDER BY name`
  );
  return rows.map(r => ({ ...r, items: JSON.parse(r.items) as CustomAssemblyItem[] }));
}

export async function saveCustomAssembly(a: CustomAssembly): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO custom_assemblies (id, name, category, description, items, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, datetime('now'), datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
       name=excluded.name, category=excluded.category,
       description=excluded.description, items=excluded.items,
       updated_at=datetime('now')`,
    [a.id, a.name, a.category, a.description, JSON.stringify(a.items)]
  );
}

export async function deleteCustomAssembly(id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`DELETE FROM custom_assemblies WHERE id = $1`, [id]);
}

// ── Duplicate Project ─────────────────────────────────────────────────────
// Creates a full copy of a project and all its line items.

export async function duplicateProject(sourceId: string, newName: string): Promise<string> {
  const db      = await getDb();
  const newId   = crypto.randomUUID();
  const sources = await db.select<any[]>(`SELECT * FROM projects WHERE id = $1`, [sourceId]);
  if (!sources.length) throw new Error("Source project not found");
  const src = sources[0];

  await db.execute(
    `INSERT INTO projects (id, name, client, description, status, tax_rate, address,
       contact_name, contact_phone, contact_email, notes, bid_number, square_footage,
       actual_bid_price, commodity_type, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,datetime('now'),datetime('now'))`,
    [newId, newName, src.client, src.description, "draft", src.tax_rate,
     src.address, src.contact_name, src.contact_phone, src.contact_email,
     src.notes, "", src.square_footage, 0, src.commodity_type ?? "bid"]
  );

  // Copy all line items
  const items = await db.select<any[]>(`SELECT * FROM line_items WHERE project_id = $1`, [sourceId]);
  for (const item of items) {
    await db.execute(
      `INSERT INTO line_items (id, project_id, category, description, qty, unit,
         unit_cost, markup_pct, labor_hours, labor_unit, labor_rate, assembly_id, sort_order, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,datetime('now'))`,
      [crypto.randomUUID(), newId, item.category, item.description, item.qty, item.unit,
       item.unit_cost, item.markup_pct, item.labor_hours, item.labor_unit ?? "E", item.labor_rate,
       item.assembly_id, item.sort_order]
    );
  }
  return newId;
}

// ── Commodity repricing ────────────────────────────────────────────────────
// Maps a line item description to the correct livePricing key.
// Returns null if the item is not a commodity-priced item.
function commodityPriceKey(description: string, unit: string): string | null {
  if (unit !== "C" && unit !== "M") return null;
  const d = description.toLowerCase();

  // ── MC / Armored cable (unit M) ──────────────────────────────────────
  // Description: "12/2 Aluminum Clad MC Cable Solid" → key "12/2 MC/AL"
  const mcMatch = d.match(/^(\d+\/\d+)(?:\s+h\.?g\.?)?(?:\s+aluminum clad|\s+mc|\s+armored)/);
  if (mcMatch) {
    const size = description.trim().match(/^(\d+\/\d+(?:\s+[Hh]\.?[Gg]\.?)?)/)?.[1] ?? "";
    const isHG  = /h\.?g/i.test(size);
    const isLum = /\blum\b/i.test(d);  // "LUM" as whole word — not substring of "aluminum"
    if (isLum) return `${size.replace(/\s+lum.*/i,"").trim()} LUM`;
    if (isHG)  return `${size.trim()} H.G. MC/AL`;
    const base = size.replace(/\s.*$/, "").trim(); // just "12/2"
    return `${base} MC/AL`;
  }

  // ── Romex / NM-B (unit M) ────────────────────────────────────────────
  if (/romex|nm-b|nm cable/i.test(d)) {
    const sz = d.match(/(\d+\/\d+)/)?.[1];
    if (sz) return `${sz} Romex`;
  }

  // ── THHN / THWN copper wire (unit M) ────────────────────────────────
  if (/thhn|thwn/i.test(d)) {
    const isSolid = /solid/i.test(d);
    // gauge: #12, #10, 250MCM, etc.
    const mcm = d.match(/#?(250|300|350|400|500|600)\s*mcm/);
    if (mcm) return `${mcm[1]} THHN`;
    const slash = d.match(/#?(\d+\/0)/);
    if (slash) return `#${slash[1].toUpperCase()} THHN`;
    // Match "#12" anywhere in description (handles "THHN - Copper Stranded #12" format)
    const hashGauge = d.match(/#(\d+)/);
    if (hashGauge) return isSolid ? `#${hashGauge[1]} THHN Solid` : `#${hashGauge[1]} THHN`;
    // Match gauge before THHN: "12 THHN CU Stranded"
    const beforeThhn = d.match(/(\d+)\s+thhn/);
    if (beforeThhn) return isSolid ? `#${beforeThhn[1]} THHN Solid` : `#${beforeThhn[1]} THHN`;
  }

  // ── EMT conduit (unit C) ─────────────────────────────────────────────
  if (/\bemt\b/i.test(d)) {
    const sz = description.trim().match(/^([\d\/\s\-]+(?:"|')?)\s*emt/i)?.[1]?.trim()
            ?? description.trim().match(/^([\d\/\s]+)\s*"?\s*emt/i)?.[1]?.trim();
    if (sz) {
      const canon = canonicalConduitSize(sz);
      if (canon) return `${canon} EMT`;
    }
  }

  // ── HW / GRC conduit (unit C) ────────────────────────────────────────
  if (/\bgrc\b|\bhw\b|rigid steel|rigid conduit/i.test(d) && !/elbow|coupling|conn/i.test(d)) {
    const sz = description.trim().match(/^([\d\/\s\-]+(?:"|')?)\s*/)?.[1]?.trim();
    if (sz) {
      const canon = canonicalConduitSize(sz);
      if (canon) return `${canon} HW`;
    }
  }

  // ── PVC conduit (unit C) ─────────────────────────────────────────────
  if (/\bpvc\b/i.test(d) && /conduit|schedule|sched/i.test(d) && !/connector|coupling|elbow|adaptor/i.test(d)) {
    const is80 = /sched(ule)?\s*80|sch\.?\s*80/i.test(d);
    const sz = description.trim().match(/^([\d\/\s\-]+(?:"|')?)/)?.[1]?.trim();
    if (sz) {
      const canon = canonicalConduitSize(sz);
      if (canon) return `${canon} ${is80 ? "PVC Sched 80" : "PVC Sched 40"}`;
    }
  }

  // ── Greenfield / flex conduit (unit C) ──────────────────────────────
  if (/greenfield|steel flex(?!\s*conn)/i.test(d)) {
    const sz = description.trim().match(/^([\d\/\s\-]+(?:"|')?)/)?.[1]?.trim();
    if (sz) {
      const canon = canonicalConduitSize(sz);
      if (canon) return `${canon} Greenfield`;
    }
  }

  // Fallback: try direct TH_PRICING key match
  return null;
}

function canonicalConduitSize(s: string): string | null {
  const t = s.replace(/"/g,"").trim();
  const map: Record<string, string> = {
    "1/2": '1/2"', "3/4": '3/4"',
    "1 1/4": '1-1/4"', "1 1/2": '1-1/2"',
    "1-1/4": '1-1/4"', "1-1/2": '1-1/2"', "1": '1"',
    "2 1/2": '2-1/2"', "2-1/2": '2-1/2"',
    "3 1/2": '3-1/2"', "3-1/2": '3-1/2"',
    "2": '2"', "3": '3"', "4": '4"', "5": '5"', "6": '6"',
  };
  return map[t] ?? null;
}

export async function repriceCommodityItems(
  projectId: string,
  livePricing: Record<string, number>
): Promise<number> {
  const db = await getDb();
  const items = await db.select<{ id: string; description: string; unit: string; unit_cost: number }[]>(
    `SELECT id, description, unit, unit_cost FROM line_items WHERE project_id = $1`,
    [projectId]
  );
  let count = 0;
  for (const item of items) {
    // Try structured key lookup first
    let key = commodityPriceKey(item.description, item.unit);
    // Fallback: substring match against all pricing keys (catches custom T entries)
    if (!key && (item.unit === "C" || item.unit === "M")) {
      key = Object.keys(livePricing).find(k =>
        item.description.toLowerCase().includes(k.toLowerCase())
      ) ?? null;
    }
    if (!key) continue;
    const newCost = livePricing[key];
    if (!newCost || newCost === item.unit_cost) continue;
    await db.execute(
      `UPDATE line_items SET unit_cost = $1 WHERE id = $2`,
      [newCost, item.id]
    );
    count++;
  }
  if (count > 0) {
    await db.execute(`UPDATE projects SET updated_at=datetime('now') WHERE id=$1`, [projectId]);
  }
  return count;
}
