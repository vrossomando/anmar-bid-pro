import { loadSettings } from "./db";
import type { CommodityPrices } from "../components/CommoditySheetModal";
import { COMMODITY_SETTING_KEY_BID, COMMODITY_SETTING_KEY_PCO } from "./commodityUtils";

// ── Real-World Labor Hours ─────────────────────────────────────────────────
// Extracted from actual Anmar bid estimates (3535 Market, 4519 Chestnut,
// AmeriHealth, ARC, Penn Charter). These override catalog defaults.
// All conduit/cable labor is per 100 ft (C) or per 1000 ft (M) as noted.

export const LABOR_RATES: Record<string, number> = {
  // ── EMT Conduit (hrs per 100 ft) ──
  "1/2\" EMT":   2.00,
  "3/4\" EMT":   4.00,
  "1\" EMT":     5.00,
  "1-1/4\" EMT": 6.00,
  "1-1/2\" EMT": 7.00,
  "2\" EMT":     8.00,
  "2-1/2\" EMT": 10.00,
  "3\" EMT":     12.00,
  "3-1/2\" EMT": 13.00,
  "4\" EMT":     14.00,

  // ── GRC Conduit (hrs per 100 ft) ──
  "1\" GRC":     3.75,
  "1-1/2\" GRC": 10.00,
  "2\" GRC":     12.00,
  "3\" GRC":     15.00,
  "4\" GRC":     18.00,
  "5\" GRC":     24.00,

  // ── PVC Conduit (hrs per 100 ft) ──
  "1/2\" PVC":   1.50,
  "3/4\" PVC":   1.75,
  "1\" PVC":     1.75,
  "1-1/4\" PVC": 2.00,
  "1-1/2\" PVC": 3.00,
  "2\" PVC":     2.50,
  "2-1/2\" PVC": 3.00,
  "3\" PVC":     3.50,
  "3-1/2\" PVC": 4.00,
  "4\" PVC":     3.50,
  "5\" PVC":     6.00,

  // ── Steel Flex / Greenfield (hrs per 100 ft) ──
  "1/2\" Steel Flex": 1.75,
  "3/4\" Steel Flex": 2.00,
  "1\" Steel Flex":   4.13,
  "1-1/4\" Steel Flex": 5.50,

  // ── Liquidtight (hrs per 100 ft) ──
  "1/2\" Liquidtight": 2.00,
  "1\" Liquidtight":   2.75,
  "2\" Liquidtight":   11.00,

  // ── EMT Set Screw Connectors (hrs each) ──
  "3/4\" Set Screw Steel Conn": 0.06,
  "1\" Set Screw Steel Conn":   0.07,
  "1-1/4\" Set Screw Steel Conn": 0.09,
  "1-1/2\" Set Screw Steel Conn": 0.12,
  "2\" Set Screw Steel Conn":   0.16,
  "2-1/2\" Set Screw Steel Conn": 0.17,
  "3\" Set Screw Steel Conn":   0.23,
  "4\" Set Screw Steel Conn":   0.34,

  // ── EMT Set Screw Couplings (hrs each) ──
  "3/4\" Set Screw Steel Cplg": 0.06,
  "1\" Set Screw Steel Cplg":   0.07,
  "1-1/4\" Set Screw Steel Cplg": 0.09,
  "1-1/2\" Set Screw Steel Cplg": 0.11,
  "2\" Set Screw Steel Cplg":   0.12,
  "2-1/2\" Set Screw Steel Cplg": 0.14,
  "3\" Set Screw Steel Cplg":   0.15,
  "4\" Set Screw Steel Cplg":   0.24,

  // ── 1-Hole Straps (hrs per 100 = C) ──
  "3/8\" 1-Hole Strap": 0.30,  // per M in some jobs, ~0.30/C equiv
  "3/4\" 1-Hole Strap": 0.60,
  "1\" 1-Hole Strap":   0.90,
  "1-1/4\" 1-Hole Strap": 1.22,
  "1-1/2\" 1-Hole Strap": 2.44,
  "2\" 1-Hole Strap":   1.22,
  "2-1/2\" 1-Hole Strap": 2.25,
  "3\" 1-Hole Strap":   2.25,
  "4\" 1-Hole Strap":   2.50,

  // ── Greenfield Connectors (hrs each) ──
  "1/2\" Greenfield Conn 90D": 0.12,
  "3/4\" Greenfield Conn 90D": 0.15,
  "1\" Greenfield Conn 90D":   0.10,
  "1/2\" Die-Cast Straight Squeeze Flex Conn": 0.08,
  "3/4\" Die-Cast Straight Squeeze Flex Conn": 0.10,
  "1\" Die-Cast Straight Squeeze Flex Conn":   0.15,

  // ── MC / BX Cable (hrs per 1000 ft = M) ──
  "12/2 Aluminum Clad MC Cable Solid":     10.00,
  "12/3 Aluminum Clad MC Cable Solid":     11.00,
  "10/2 Aluminum Clad MC Cable Solid":     11.00,
  "10/3 Aluminum Clad MC Cable Solid":     12.00,
  "12/2 Aluminum Clad MC Cable Stranded":  16.00,
  "8/3 Aluminum Clad MC Cable Stranded":   14.00,
  "6/3 Aluminum Clad MC Cable Stranded":   15.00,
  "3/8\" MC/BX Connector": 0.03,    // each

  // ── Romex NM-B (hrs per 1000 ft = M) ──
  "14/2 Romex w/Ground": 8.00,
  "14/3 Romex w/Ground": 9.00,
  "12/2 Romex w/Ground": 8.00,
  "12/3 Romex w/Ground": 9.00,
  "10/2 Romex w/Ground": 9.00,
  "10/3 Romex w/Ground": 12.00,
  "8/2 Romex w/Ground":  12.00,
  "8/3 Romex w/Ground":  15.00,

  // ── THHN Wire (hrs per 1000 ft = M) ──
  "#14 THHN CU Solid Wire":    5.00,
  "#12 THHN CU Solid Wire":    6.00,
  "#10 THHN CU Solid Wire":    7.00,
  "#14 THHN CU Stranded Wire": 5.00,
  "#12 THHN CU Stranded Wire": 6.00,
  "#10 THHN CU Stranded Wire": 7.00,
  "#8 THHN CU Stranded Wire":  7.00,
  "#6 THHN CU Stranded Wire":  7.50,
  "#4 THHN CU Stranded Wire":  11.00,
  "#3 THHN CU Stranded Wire":  12.00,
  "#2 THHN CU Stranded Wire":  13.00,
  "#1 THHN CU Stranded Wire":  14.00,
  "#1/0 THHN CU Stranded Wire": 15.00,
  "#2/0 THHN CU Stranded Wire": 15.00,
  "#3/0 THHN CU Stranded Wire": 16.00,
  "#4/0 THHN CU Stranded Wire": 16.00,
  "#250MCM THHN CU Stranded Wire": 30.00,
  "#350MCM THHN CU Stranded Wire": 32.00,
  "#500MCM THHN CU Stranded Wire": 34.00,
  "#600MCM THHN CU Stranded Wire": 35.00,

  // ── Luminary Cable (hrs per 1000 ft = M) ──
  "12/2 Luminary Cable (with 16/2)": 12.00,

  // ── Electrical Boxes (hrs each) ──
  "4\" Square x 1-1/2\" Deep Box w/bkt": 0.15,
  "4\" Square x 2-1/8\" Deep Box":       0.18,
  "4\" Square x 2-1/8\" Deep Box w/brkt": 0.20,
  "1G FSC Box-1/2\" Hubs":               0.55,

  // ── Devices / Receptacles (hrs each) ──
  "20A/125V Spec Grade Dup Rcpt (5-20R)": 0.15,
  "20A/125V Spec Grade GFI (5-20R)":      0.18,
  "20A/125V Premium Spec Grade GFI":      0.20,
  "20A/125V Prem Spec Grade Dup Rcpt":    0.18,
  "20A Spec Grade SP Switch":             0.12,
  "20A Spec Grade 3-Way Switch":          0.15,
  "20A/250V 2P3W Tw-Lk Rcpt":            0.20,
  "30A/250V 2P3W Sgl Rcpt":              0.30,
  "50A/250V 2P3W Sgl Rcpt":              0.40,

  // ── Plaster Rings (hrs each) ──
  "4\" Square-1G Plaster Ring-5/8\"D": 0.07,
  "4\" Square-2G Plaster Ring-5/8\"D": 0.07,

  // ── Wall Plates (hrs each) ──
  "1G SS Dup Rcpt Plate":   0.06,
  "1G SS Toggle Sw Plate":  0.08,
  "1G SS Decora/GFI Plate": 0.11,
  "1G SS Power Rcpt Plate": 0.14,
  "2G SS Dup Rcpt Plate":   0.08,

  // ── Wirenuts (hrs per 100 = C) ──
  "Red Wirenuts":  1.00,
  "Blue Wirenuts": 3.00,

  // ── Ground Screws / Hardware ──
  "Ground Screw with Bare Pigtail":   1.20,  // per C
  "6X1/4\" Pan Head Tapping Screw":  0.01,  // each

  // ── Pull Line (hrs per 1000 ft = M) ──
  "1/8\" Poly Pull Line": 2.00,
  "3/16\" Pull Line":     5.00,
  "1/4\" Pull Line":      6.00,

  // ── Wire Terminations (hrs each) ──
  "#14-12-10 Wire Termination Labor": 0.10,
  "#8-6 Wire Termination Labor":      0.15,
  "#4-1 Wire Termination Labor":      0.18,
  "#3/0-4/0 Wire Termination Labor":  0.25,

  // ── Safety Switches / Disconnects (hrs each) ──
  "30A/3P 240V GD NF Safety Sw-Nema 1":  0.50,
  "60A/3P 240V GD NF Safety Sw-Nema 1":  0.65,
  "100A/3P 240V GD NF Safety Sw-Nema 1": 2.00,
  "30A/3P 240V GD NF Safety Sw-Nema 3R": 2.00,
  "60A/3P 240V GD NF Safety Sw-Nema 3R": 1.00,

  // ── Transformers (hrs each) ──
  "7.5 KVA": 4.00,
  "15 KVA":  4.00,
  "30 KVA":  6.00,
  "45 KVA":  8.00,
  "75 KVA":  12.00,
  "112.5 KVA": 16.00,
  "150 KVA": 20.00,

  // ── Fire Alarm (hrs each) ──
  "Smoke Detector":      0.35,
  "Fire Alarm Pull Station": 0.35,
  "Audio Visual Fire Alarm Device": 0.50,
  "Strobe/Visual Fire Alarm Device": 0.50,
  "Duct Detector":       2.00,
  "Fire Alarm Low Voltage Control Panel": 8.00,
};

// ── T&H Pricing (Turtle & Hughes 3/26/2026 Bid Sheet) ─────────────────────
// All wire/cable prices are per 1000 ft. Conduit prices per 100 ft.

export const TH_PRICING: Record<string, number> = {
  // THHN Copper Wire (per 1000 ft)
  "#14 THHN Solid":    120.70,
  "#12 THHN Solid":    184.45,
  "#10 THHN Solid":    288.87,
  "#8 THHN Solid":     498.25,
  "#6 THHN Solid":     737.85,
  "#4 THHN Solid":     1177.68,
  "#14 THHN":          134.26,
  "#12 THHN":          198.01,
  "#10 THHN":          302.43,
  "#8 THHN":           548.94,
  "#6 THHN":           844.56,
  "#4 THHN":           1292.39,
  "#3 THHN":           1630.09,
  "#2 THHN":           2040.38,
  "#1 THHN":           2281.61,
  "#1/0 THHN":         2793.46,
  "#2/0 THHN":         3441.01,
  "#3/0 THHN":         4342.73,
  "#4/0 THHN":         5420.88,
  "250 THHN":          6281.40,
  "300 THHN":          7532.98,
  "350 THHN":          8820.35,
  "400 THHN":          10033.66,
  "500 THHN":          12678.24,
  "600 THHN":          15798.27,

  // EMT Conduit (per 100 ft)
  "1/2\" EMT":   48.40,
  "3/4\" EMT":   83.60,
  "1\" EMT":     134.20,
  "1-1/4\" EMT": 217.80,
  "1-1/2\" EMT": 266.20,
  "2\" EMT":     312.40,
  "2-1/2\" EMT": 473.00,
  "3\" EMT":     598.40,
  "3-1/2\" EMT": 789.80,
  "4\" EMT":     811.80,

  // PVC Sched 40 (per 100 ft)
  "1/2\" PVC Sched 40":   22.55,
  "3/4\" PVC Sched 40":   27.50,
  "1\" PVC Sched 40":     39.60,
  "1-1/4\" PVC Sched 40": 55.55,
  "1-1/2\" PVC Sched 40": 66.00,
  "2\" PVC Sched 40":     80.30,
  "2-1/2\" PVC Sched 40": 126.50,
  "3\" PVC Sched 40":     154.00,
  "3-1/2\" PVC Sched 40": 194.70,
  "4\" PVC Sched 40":     214.50,
  "5\" PVC Sched 40":     312.40,
  "6\" PVC Sched 40":     412.50,

  // PVC Sched 80 (per 100 ft)
  "1/2\" PVC Sched 80":   258.50,
  "3/4\" PVC Sched 80":   291.50,
  "1\" PVC Sched 80":     422.40,
  "1-1/4\" PVC Sched 80": 621.50,
  "1-1/2\" PVC Sched 80": 700.70,
  "2\" PVC Sched 80":     940.50,
  "2-1/2\" PVC Sched 80": 1612.60,
  "3\" PVC Sched 80":     1831.50,
  "3-1/2\" PVC Sched 80": 2396.90,
  "4\" PVC Sched 80":     2536.60,
  "5\" PVC Sched 80":     533.50,
  "6\" PVC Sched 80":     720.50,

  // Greenfield HW (per 100 ft)
  "1/2\" Greenfield": 35.70,
  "3/4\" Greenfield": 47.30,
  "1\" Greenfield":   63.80,
  "1-1/4\" Greenfield": 83.60,
  "1-1/2\" Greenfield": 100.10,
  "2\" Greenfield":   128.70,

  // MC/AL Cable (per 1000 ft)
  "14/2 MC/AL":  621.77,
  "12/2 MC/AL":  616.00,
  "10/2 MC/AL":  1441.32,
  "8/2 MC/AL":   1834.43,
  "6/2 MC/AL":   2771.15,
  "14/3 MC/AL":  1123.14,
  "12/3 MC/AL":  1097.84,
  "10/3 MC/AL":  1981.06,
  "8/3 MC/AL":   2536.96,
  "6/3 MC/AL":   3434.66,
  "12/4 MC/AL":  1533.31,
  "10/4 MC/AL":  2884.10,
  "12/2 H.G. MC/AL": 1154.03,
  "12/3 H.G. MC/AL": 1604.45,
  "12/2 LUM":    1055.58,
  "12/3 LUM":    1508.28,

  // Romex NM-B RX Coils (per 1000 ft)
  "14/2 Romex":  327.92,
  "12/2 Romex":  473.86,
  "10/2 Romex":  845.26,
  "8/2 Romex":   1396.52,
  "6/2 Romex":   1974.73,
  "14/3 Romex":  456.96,
  "12/3 Romex":  662.38,
  "10/3 Romex":  1055.29,
  "8/3 Romex":   1948.39,
  "6/3 Romex":   2835.07,
  "12/4 Romex":  1026.92,
};

// Look up labor rate by description keyword match
export function getLaborRate(description: string): number | null {
  // Try exact match first
  if (LABOR_RATES[description] !== undefined) return LABOR_RATES[description];
  // Try partial match
  for (const [key, val] of Object.entries(LABOR_RATES)) {
    if (description.includes(key) || key.includes(description)) return val;
  }
  return null;
}

// Look up T&H price by description keyword match
export function getTHPrice(description: string): number | null {
  if (TH_PRICING[description] !== undefined) return TH_PRICING[description];
  for (const [key, val] of Object.entries(TH_PRICING)) {
    if (description.toLowerCase().includes(key.toLowerCase())) return val;
  }
  return null;
}

// ── Runtime commodity price loader ────────────────────────────────────────
// Merges saved commodity sheet prices over the hardcoded TH_PRICING table.
// Call this once at app startup and store the result in React state.


export async function loadLivePricing(type: "bid" | "pco" = "bid"): Promise<Record<string, number>> {
  const merged: Record<string, number> = { ...TH_PRICING };
  try {
    const settings = await loadSettings();
    const key = type === "pco" ? COMMODITY_SETTING_KEY_PCO : COMMODITY_SETTING_KEY_BID;
    const raw = settings[key] ?? (type === "bid" ? settings["commodity_prices"] : undefined);
    if (!raw) return merged;
    const saved: CommodityPrices = JSON.parse(raw);

    // THHN copper wire
    for (const [size, price] of Object.entries(saved.thhn ?? {})) {
      merged[size] = price;
    }
    // Conduit — keys like "3/4\" EMT", "1\" HW", "1\" PVC40", "1\" PVC80", "1\" Greenfield"
    for (const [size, price] of Object.entries(saved.conduit ?? {})) {
      merged[size] = price;
    }
    // MC/AL cable
    for (const [size, price] of Object.entries(saved.mcCable ?? {})) {
      merged[`${size} MC/AL`] = price;
    }
    // RX Coils / Romex
    for (const [size, price] of Object.entries(saved.romex ?? {})) {
      merged[`${size} Romex`] = price;
    }
    // SEU/AL, SER/AL, XHHW/AL, Bare Copper — stored with full key
    for (const [size, price] of Object.entries(saved.seuAl ?? {})) {
      merged[size] = price;
    }
    for (const [size, price] of Object.entries(saved.serAl ?? {})) {
      merged[size] = price;
    }
    for (const [size, price] of Object.entries(saved.xhhwAl ?? {})) {
      merged[size] = price;
    }
    for (const [size, price] of Object.entries(saved.bareCu ?? {})) {
      merged[size] = price;
    }
  } catch { /* settings not yet saved */ }
  return merged;
}
