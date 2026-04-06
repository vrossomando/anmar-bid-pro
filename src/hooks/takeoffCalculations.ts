// ── Takeoff Calculation Engine ─────────────────────────────────────────────
// All functions are pure — no database calls, no UI. They take form inputs
// and return arrays of LineItem-shaped objects ready to insert into the DB.

import { v4 as uuidv4 } from "uuid";
import type { LineItem } from "./db";

export type TakeoffLineItem = Omit<LineItem, "created_at">;

// ── Shared helpers ─────────────────────────────────────────────────────────

function item(
  projectId: string,
  category: string,
  description: string,
  qty: number,
  unit: string,
  unitCost: number,
  laborHours: number,
  laborRate: number,
  markupPct: number,
  assemblyId: number | null,
  sortOrder: number,
  laborUnit?: string
): TakeoffLineItem {
  return {
    id: uuidv4(),
    project_id: projectId,
    category,
    description,
    qty: parseFloat(qty.toFixed(4)),
    unit,
    unit_cost: unitCost,
    markup_pct: markupPct,
    labor_hours: laborHours,
    labor_unit: laborUnit ?? unit,
    labor_rate: laborRate,
    assembly_id: assemblyId,
    sort_order: sortOrder,
  };
}

function applyFactors(
  items: TakeoffLineItem[],
  laborFactorPct: number,
  materialFactorPct: number
): TakeoffLineItem[] {
  return items.map(i => ({
    ...i,
    labor_hours: parseFloat((i.labor_hours * (1 + laborFactorPct / 100)).toFixed(4)),
    unit_cost:   parseFloat((i.unit_cost   * (1 + materialFactorPct / 100)).toFixed(4)),
  }));
}

// ── Conduit / Wire Feeders ─────────────────────────────────────────────────

export interface WireRow {
  numWires: number;
  wireDescription: string;
  wireSize: string;
  unitCost: number;          // per 1000 ft from catalog
  laborPer1000ft: number;    // labor hrs per 1000 ft
  assemblyId: number | null;
  makeupLength: number;      // extra makeup wire per wire per run (ft)
}

export interface ConduitInputs {
  projectId: string;
  conduitSize: string;
  conduitType: string;
  difficulty: string;
  overallLength: number;       // feet
  numRuns: number;
  fromLabel?: string;
  toLabel?: string;
  numElbows: number;
  elbowDescription: string;
  elbowUnitCost: number;
  elbowLaborHrs: number;
  elbowAssemblyId: number | null;
  // Fittings
  couplingDescription: string;
  couplingUnitCost: number;
  couplingLaborHrs: number;
  couplingAssemblyId: number | null;
  couplingSpacingFt: number;   // 1 coupling per X feet
  supportDescription: string;
  supportUnitCost: number;
  supportLaborHrs: number;
  supportAssemblyId: number | null;
  supportSpacingFt: number;    // 1 support per X feet
  support2Description: string;
  support2UnitCost: number;
  support2LaborHrs: number;
  support2AssemblyId: number | null;
  support2SpacingFt: number;
  terminationDescription: string;
  terminationUnitCost: number;
  terminationLaborHrs: number;
  terminationAssemblyId: number | null;
  terminationsPerRun: number;
  // Conduit catalog values
  conduitUnitCostPer100ft: number;
  conduitLaborHrsPer100ft: number;
  conduitAssemblyId: number | null;
  // Wire rows
  wires: WireRow[];
  // Factors
  markupPct: number;
  laborRate: number;
  laborFactorPct: number;
  materialFactorPct: number;
  // Other items
  otherItems: { description: string; qty: number; unitCost: number; laborHrs: number }[];
}

export function calculateConduitTakeoff(inputs: ConduitInputs): TakeoffLineItem[] {
  const {
    projectId, conduitSize, conduitType, difficulty,
    overallLength, numRuns, markupPct, laborRate,
    laborFactorPct, materialFactorPct,
  } = inputs;

  const totalLength = overallLength * numRuns;
  const category = "Conduit / Wire Feeders";
  const results: TakeoffLineItem[] = [];
  let sort = 0;

  // 1. Conduit — qty = actual linear feet, unit = C (per 100), unit_cost = per-100 price
  if (totalLength > 0 && inputs.conduitUnitCostPer100ft > 0) {
    results.push(item(
      projectId, category,
      [
        `${conduitSize} ${conduitType}${difficulty !== "Standard" ? ` (${difficulty})` : ""}`,
        inputs.fromLabel && inputs.toLabel ? `${inputs.fromLabel} → ${inputs.toLabel}` :
        inputs.fromLabel ? `From: ${inputs.fromLabel}` :
        inputs.toLabel   ? `To: ${inputs.toLabel}`     : "",
      ].filter(Boolean).join(" — "),
      totalLength, "C",
      inputs.conduitUnitCostPer100ft,
      inputs.conduitLaborHrsPer100ft,
      laborRate, markupPct,
      inputs.conduitAssemblyId, sort++
    ));
  }

  // 2. Couplings
  if (inputs.couplingDescription && inputs.couplingSpacingFt > 0 && overallLength > 0) {
    const qty = Math.ceil(overallLength / inputs.couplingSpacingFt) * numRuns;
    if (qty > 0) {
      results.push(item(
        projectId, category, inputs.couplingDescription,
        qty, "ea", inputs.couplingUnitCost, inputs.couplingLaborHrs,
        laborRate, markupPct, inputs.couplingAssemblyId, sort++
      ));
    }
  }

  // 3. Supports
  if (inputs.supportDescription && inputs.supportSpacingFt > 0 && overallLength > 0) {
    const qty = Math.ceil(overallLength / inputs.supportSpacingFt) * numRuns;
    if (qty > 0) {
      results.push(item(
        projectId, category, inputs.supportDescription,
        qty, "ea", inputs.supportUnitCost, inputs.supportLaborHrs,
        laborRate, markupPct, inputs.supportAssemblyId, sort++
      ));
    }
  }

  // 4. Second support (optional)
  if (inputs.support2Description && inputs.support2Description !== "<None>" && inputs.support2SpacingFt > 0 && overallLength > 0) {
    const qty = Math.ceil(overallLength / inputs.support2SpacingFt) * numRuns;
    if (qty > 0) {
      results.push(item(
        projectId, category, inputs.support2Description,
        qty, "ea", inputs.support2UnitCost, inputs.support2LaborHrs,
        laborRate, markupPct, inputs.support2AssemblyId, sort++
      ));
    }
  }

  // 5. Terminations (connectors)
  if (inputs.terminationDescription && inputs.terminationsPerRun > 0) {
    const qty = inputs.terminationsPerRun * numRuns;
    results.push(item(
      projectId, category, inputs.terminationDescription,
      qty, "ea", inputs.terminationUnitCost, inputs.terminationLaborHrs,
      laborRate, markupPct, inputs.terminationAssemblyId, sort++
    ));
  }

  // 6. Elbows
  if (inputs.numElbows > 0 && inputs.elbowDescription) {
    const qty = inputs.numElbows * numRuns;
    results.push(item(
      projectId, category, inputs.elbowDescription,
      qty, "ea", inputs.elbowUnitCost, inputs.elbowLaborHrs,
      laborRate, markupPct, inputs.elbowAssemblyId, sort++
    ));
  }

  // 7. Wire rows
  for (const wire of inputs.wires) {
    if (!wire.wireDescription || wire.numWires <= 0) continue;
    const makeupFt = (wire.makeupLength ?? 0) * numRuns * wire.numWires;
    const totalWireFt = (overallLength * numRuns * wire.numWires) + makeupFt;
    if (totalWireFt <= 0) continue;
    // qty = actual feet, unit = M (per 1000), unit_cost = per-1000 price
    results.push(item(
      projectId, category,
      `${wire.wireDescription} ${wire.wireSize}`,
      totalWireFt, "M",
      wire.unitCost, wire.laborPer1000ft,
      laborRate, markupPct, wire.assemblyId, sort++
    ));
  }

  // 8. Other items
  for (const other of inputs.otherItems) {
    if (!other.description || other.qty <= 0) continue;
    results.push(item(
      projectId, category, other.description,
      other.qty, "ea", other.unitCost, other.laborHrs,
      laborRate, markupPct, null, sort++
    ));
  }

  return applyFactors(results, laborFactorPct, materialFactorPct);
}

// ── Cable ──────────────────────────────────────────────────────────────────

export interface CableInputs {
  projectId: string;
  numCables: number;
  cableDescription: string;
  cableUnitCostPer1000ft: number;
  cableLaborHrsPer1000ft: number;
  cableAssemblyId: number | null;
  totalLength: number;          // feet per run
  numRuns: number;
  supportDescription: string;
  supportUnitCost: number;
  supportLaborHrs: number;
  supportAssemblyId: number | null;
  supportSpacingFt: number;
  support2Description: string;
  support2UnitCost: number;
  support2LaborHrs: number;
  support2AssemblyId: number | null;
  support2SpacingFt: number;
  terminationDescription: string;
  terminationUnitCost: number;
  terminationLaborHrs: number;
  terminationAssemblyId: number | null;
  markupPct: number;
  laborRate: number;
  laborFactorPct: number;
  materialFactorPct: number;
  notes: string;
}

export function calculateCableTakeoff(inputs: CableInputs): TakeoffLineItem[] {
  const {
    projectId, numCables, totalLength, numRuns,
    markupPct, laborRate, laborFactorPct, materialFactorPct,
  } = inputs;

  const category = "Cable";
  const results: TakeoffLineItem[] = [];
  let sort = 0;

  const totalCableFt = totalLength * numRuns * numCables;

  // 1. Cable — qty = actual feet, unit = M (per 1000), unit_cost = per-1000 price
  if (totalCableFt > 0 && inputs.cableDescription) {
    results.push(item(
      projectId, category, inputs.cableDescription,
      totalCableFt, "M",
      inputs.cableUnitCostPer1000ft, inputs.cableLaborHrsPer1000ft,
      laborRate, markupPct, inputs.cableAssemblyId, sort++
    ));
  }

  // 2. Support (1-hole strap, etc.)
  if (inputs.supportDescription && inputs.supportSpacingFt > 0 && totalLength > 0) {
    const qty = Math.ceil(totalLength / inputs.supportSpacingFt) * numRuns * numCables;
    if (qty > 0) {
      results.push(item(
        projectId, category, inputs.supportDescription,
        qty, "ea", inputs.supportUnitCost, inputs.supportLaborHrs,
        laborRate, markupPct, inputs.supportAssemblyId, sort++
      ));
    }
  }

  // 3. Second support (optional)
  if (inputs.support2Description && inputs.support2Description !== "<None>" && inputs.support2SpacingFt > 0 && totalLength > 0) {
    const qty = Math.ceil(totalLength / inputs.support2SpacingFt) * numRuns * numCables;
    if (qty > 0) {
      results.push(item(
        projectId, category, inputs.support2Description,
        qty, "ea", inputs.support2UnitCost, inputs.support2LaborHrs,
        laborRate, markupPct, inputs.support2AssemblyId, sort++
      ));
    }
  }

  // 4. Terminations — 2 per cable per run (one at each end)
  if (inputs.terminationDescription && numCables > 0 && numRuns > 0) {
    const qty = 2 * numCables * numRuns;
    results.push(item(
      projectId, category, inputs.terminationDescription,
      qty, "ea", inputs.terminationUnitCost, inputs.terminationLaborHrs,
      laborRate, markupPct, inputs.terminationAssemblyId, sort++
    ));
  }

  return applyFactors(results, laborFactorPct, materialFactorPct);
}

// ── Lights & Devices ───────────────────────────────────────────────────────

export interface AccessoryRow {
  description: string;
  qty: number;           // per fixture
  unitCost: number;
  laborHrs: number;
  assemblyId: number | null;
  priceUnit: string;     // "E", "C" (per 100), "M" (per 1000) — drives correct unit/qty on line item
}

export interface LightsInputs {
  projectId: string;
  description: string;
  manufacturer: string;
  catalogNumber: string;
  quantity: number;            // number of fixtures
  unitCost: number;            // per fixture (0 when isQuote=true)
  laborHrsPerFixture: number;  // from catalog
  assemblyId: number | null;
  isQuote: boolean;            // fixture price comes from supplier quote
  sectionBreakdown: { section: string; breakdown: string }; // for category string
  accessories: AccessoryRow[]; // per-fixture accessories
  additionalItems: AccessoryRow[]; // total (not multiplied by qty)
  markupPct: number;
  laborRate: number;
  laborFactorPct: number;
  materialFactorPct: number;
  notes: string;
}

export function calculateLightsTakeoff(inputs: LightsInputs): TakeoffLineItem[] {
  const {
    projectId, description, quantity,
    markupPct, laborRate, laborFactorPct, materialFactorPct,
  } = inputs;

  const { section, breakdown } = inputs.sectionBreakdown;
  const category = `Lights | ${section} | ${breakdown}`;
  const results: TakeoffLineItem[] = [];
  let sort = 0;

  if (quantity <= 0 || !description) return [];

  // 1. The fixture itself — unit_cost is 0 for quoted items
  const fixtureCost = inputs.isQuote ? 0 : inputs.unitCost;
  results.push(item(
    projectId, category,
    [description, inputs.manufacturer, inputs.catalogNumber].filter(Boolean).join(" — "),
    quantity, "ea",
    fixtureCost, inputs.laborHrsPerFixture,
    laborRate, markupPct, inputs.assemblyId, sort++
  ));

  // 2. Per-fixture accessories × quantity
  for (const acc of inputs.accessories) {
    if (!acc.description || acc.qty <= 0) continue;
    const pu = (acc.priceUnit ?? "E").toUpperCase();
    // Total raw count across all fixtures
    const rawQty = acc.qty * quantity;
    // For C/M items the line item qty is in hundreds/thousands, unit_cost is per-100/per-1000
    const lineQty  = pu === "C" ? rawQty / 100
                   : pu === "M" ? rawQty / 1000
                   : rawQty;
    const lineUnit = pu === "C" ? "C" : pu === "M" ? "M" : "ea";
    results.push(item(
      projectId, category, acc.description,
      lineQty, lineUnit,
      acc.unitCost, acc.laborHrs,
      laborRate, markupPct, acc.assemblyId, sort++
    ));
  }

  // 3. Additional items — total quantity (not per-fixture)
  for (const add of inputs.additionalItems) {
    if (!add.description || add.qty <= 0) continue;
    const pu = (add.priceUnit ?? "E").toUpperCase();
    const lineQty  = pu === "C" ? add.qty / 100
                   : pu === "M" ? add.qty / 1000
                   : add.qty;
    const lineUnit = pu === "C" ? "C" : pu === "M" ? "M" : "ea";
    results.push(item(
      projectId, category, add.description,
      lineQty, lineUnit,
      add.unitCost, add.laborHrs,
      laborRate, markupPct, add.assemblyId, sort++
    ));
  }

  return applyFactors(results, laborFactorPct, materialFactorPct);
}
