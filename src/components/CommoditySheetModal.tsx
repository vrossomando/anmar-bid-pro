import { useState, useRef } from "react";
import { X, Upload, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";
import { saveSetting } from "../hooks/db";
import { commoditySettingKey, commodityUploadTsKey } from "../hooks/commodityUtils";

// ── Types ──────────────────────────────────────────────────────────────────

export interface CommodityPrices {
  thhn:    Record<string, number>;   // THHN copper (solid + stranded)
  conduit: Record<string, number>;   // EMT, HW, PVC40, PVC80, Greenfield per 100ft
  mcCable: Record<string, number>;   // MC/AL cable per 1000ft
  romex:   Record<string, number>;   // RX Coils per 1000ft
  seuAl:   Record<string, number>;   // SEU/AL per 1000ft
  serAl:   Record<string, number>;   // SER/AL per 1000ft
  xhhwAl:  Record<string, number>;   // XHHW/AL per 1000ft
  bareCu:  Record<string, number>;   // Bare Copper per 1000ft
  updatedAt:  string;
  sourceFile: string;
}


// ── Parser ─────────────────────────────────────────────────────────────────
// Parses the raw text extracted from a T&H-style bid sheet.
// Works with CSV (from Excel Save As), or text extracted from PDF.

function parsePrice(s: string): number | null {
  const n = parseFloat(s.replace(/[$,\s]/g, ""));
  return isNaN(n) || n <= 0 ? null : n;
}

function parseCommodityText(text: string, filename: string): CommodityPrices {
  const prices: CommodityPrices = {
    thhn: {}, conduit: {}, mcCable: {}, romex: {},
    seuAl: {}, serAl: {}, xhhwAl: {}, bareCu: {},
    updatedAt: new Date().toISOString(), sourceFile: filename,
  };

  const dollarRe = /\$[\d,]+(?:\.\d{1,2})?/g;

  function dollars(line: string): (number | null)[] {
    return [...line.matchAll(dollarRe)].map(m => parsePrice(m[0]));
  }

  // ── Section detection ────────────────────────────────────────────────────
  // The T&H sheet has three distinct tables. We detect which table we're in
  // by scanning for header keywords, then parse rows with that context.
  // This avoids ambiguity: "2" means wire gauge in wire mode, conduit size in conduit mode.

  type Section = "wire" | "conduit" | "mc" | null;
  let section: Section = null;
  let solidMode = true; // wire table: solid section vs stranded section

  // ── Conduit sizes (longest first to avoid partial match) ─────────────────
  // Inch mark is optional — PDF.js may or may not include it
  const conduitSizes: Array<[RegExp, string]> = [
    [/^1\s*[\/\\]?\s*2\s*"?\s*$/i,           '1/2"'],
    [/^3\s*[\/\\]?\s*4\s*"?\s*$/i,           '3/4"'],
    [/^1\s+1\s*[\/\\]?\s*4\s*"?\s*$/i,       '1-1/4"'],
    [/^1\s+1\s*[\/\\]?\s*2\s*"?\s*$/i,       '1-1/2"'],
    [/^1\s*"?\s*$/i,                          '1"'],
    [/^2\s+1\s*[\/\\]?\s*2\s*"?\s*$/i,       '2-1/2"'],
    [/^3\s+1\s*[\/\\]?\s*2\s*"?\s*$/i,       '3-1/2"'],
    [/^2\s*"?\s*$/i,                          '2"'],
    [/^3\s*"?\s*$/i,                          '3"'],
    [/^4\s*"?\s*$/i,                          '4"'],
    [/^5\s*"?\s*$/i,                          '5"'],
    [/^6\s*"?\s*$/i,                          '6"'],
  ];

  // ── Wire sizes ───────────────────────────────────────────────────────────
  // Solid section (THHN only): 14 SOLID, 12 SOLID, ..., 2 SOLID
  const solidSizes: Array<[RegExp, string]> = [
    [/^14\s+solid/i, "#14 THHN Solid"],
    [/^12\s+solid/i, "#12 THHN Solid"],
    [/^10\s+solid/i, "#10 THHN Solid"],
    [/^8\s+solid/i,  "#8 THHN Solid"],
    [/^6\s+solid/i,  "#6 THHN Solid"],
    [/^4\s+solid/i,  "#4 THHN Solid"],
    [/^2\s+solid/i,  "#2 THHN Solid"],
  ];

  // Stranded section: 14 STR (or just 14), 12, 10, 8, 6, 4, 3, 2, 1, 1/0..600
  // Columns: THHN | SEU/AL | SER/AL | SER/AL/5C | XHHW/AL | BARE/CU
  const strSizes: Array<[RegExp, string, string]> = [
    [/^14\s+(str|stranded)\b/i, "#14 THHN", "14"],
    [/^14\b/i,   "#14 THHN",   "14"],
    [/^12\b/i,   "#12 THHN",   "12"],
    [/^10\b/i,   "#10 THHN",   "10"],
    [/^8\b/i,    "#8 THHN",    "8"],
    [/^6\b/i,    "#6 THHN",    "6"],
    [/^4\b/i,    "#4 THHN",    "4"],
    [/^3\b/i,    "#3 THHN",    "3"],
    [/^2\b/i,    "#2 THHN",    "2"],
    [/^1\b(?!\s*[\/0])/i, "#1 THHN", "1"],
    [/^1\/0\b/i, "#1/0 THHN",  "1/0"],
    [/^2\/0\b/i, "#2/0 THHN",  "2/0"],
    [/^3\/0\b/i, "#3/0 THHN",  "3/0"],
    [/^4\/0\b/i, "#4/0 THHN",  "4/0"],
    [/^250\b/i,  "250 THHN",   "250"],
    [/^300\b/i,  "300 THHN",   "300"],
    [/^350\b/i,  "350 THHN",   "350"],
    [/^400\b/i,  "400 THHN",   "400"],
    [/^500\b/i,  "500 THHN",   "500"],
    [/^600\b/i,  "600 THHN",   "600"],
  ];

  // ── MC/Cable sizes ────────────────────────────────────────────────────────
  // Columns: MCR/AL | RX COILS | UF COILS
  const mcSizes: Array<[RegExp, string]> = [
    [/^14\/2\b/i,              "14/2"],
    [/^12\/2\s+h\.?g/i,        "12/2 H.G."],
    [/^12\/2\s+lum/i,          "12/2 LUM"],
    [/^12\/2\b/i,              "12/2"],
    [/^10\/2\b/i,              "10/2"],
    [/^8\/2\b/i,               "8/2"],
    [/^6\/2\b/i,               "6/2"],
    [/^14\/3\b/i,              "14/3"],
    [/^12\/3\s+h\.?g/i,        "12/3 H.G."],
    [/^12\/3\s+lum/i,          "12/3 LUM"],
    [/^12\/3\b/i,              "12/3"],
    [/^10\/3\b/i,              "10/3"],
    [/^8\/3\b/i,               "8/3"],
    [/^6\/3\b/i,               "6/3"],
    [/^12\/4\b/i,              "12/4"],
    [/^10\/4\b/i,              "10/4"],
  ];

  const dbg = (window as any).__commodityDebug;
  const lines = text.split(/[\r\n]+/).map(l => l.trim()).filter(Boolean);
  if (dbg) console.log("Total lines:", lines.length, "Sample:", lines.slice(0,20));

  for (const line of lines) {
    const lo = line.toLowerCase().trim();
    const d  = dollars(line);

    // ── Detect section changes ──────────────────────────────────────────
    // Look for table header keywords (no dollar signs on these lines)
    if (d.length === 0 || (d.length === 1 && line.indexOf("$") === -1)) {
      if (/conduit/i.test(lo)) { section = "conduit"; if(dbg) console.log(">> SECTION: conduit"); continue; }
      if (/mc\s*\/\s*al|mcr\/al|rx\s+coils/i.test(lo)) { section = "mc"; if(dbg) console.log(">> SECTION: mc, line:", JSON.stringify(line)); continue; }
      if (/thhn|per\s+1000\s+feet|prices\s+per/i.test(lo)) { if(dbg) console.log(">> SECTION: wire, line:", JSON.stringify(line));
        section = "wire";
        solidMode = true; // reset to solid section at start of wire table
        continue;
      }
      // Solid/Stranded sub-section headers within wire table
      if (section === "wire") {
        if (/solid/i.test(lo) && !/\d/.test(lo)) { solidMode = true; continue; }
        if (/str(anded)?/i.test(lo) && !/\d/.test(lo)) { solidMode = false; continue; }
      }
      continue;
    }

    if (d.length === 0) continue;

    // ── Parse by section ────────────────────────────────────────────────

    if (section === "conduit") {
      for (const [re, canonical] of conduitSizes) {
        if (re.test(lo)) {
          // d[0]=EMT  d[1]=HW  d[2]=PVC Sched40  d[3]=PVC Sched80  d[4]=Greenfield
          if (d[0]) prices.conduit[`${canonical} EMT`]         = d[0];
          if (d[1]) prices.conduit[`${canonical} HW`]          = d[1];
          if (d[2]) prices.conduit[`${canonical} PVC Sched 40`] = d[2];
          if (d[3]) prices.conduit[`${canonical} PVC Sched 80`] = d[3];
          if (d[4]) prices.conduit[`${canonical} Greenfield`]  = d[4];
          break;
        }
      }
      continue;
    }

    if (section === "mc") {
      for (const [re, sizeKey] of mcSizes) {
        if (re.test(lo)) {
          // d[0]=MCR/AL  d[1]=RX Coils  d[2]=UF Coils
          if (d[0]) prices.mcCable[sizeKey] = d[0];
          if (d[1]) prices.romex[sizeKey]   = d[1];
          break;
        }
      }
      continue;
    }

    if (section === "wire") {
      // Detect transition from solid to stranded: first stranded row is "14 STR" or "14" after solid section
      if (/\bstr(anded)?\b/i.test(lo)) solidMode = false;
      if (solidMode) {
        for (const [re, thhnKey] of solidSizes) {
          if (re.test(lo)) {
            if (d[0]) prices.thhn[thhnKey] = d[0];
            // BARE/CU appears in solid section for 8, 6, 4 solid
            if (d[5]) prices.bareCu[`${thhnKey.replace(" THHN Solid","").replace("#","")} BARE/CU`] = d[5];
            break;
          }
        }
        // After the last solid row (2 SOLID), check if next row starts stranded
        continue;
      }
      // Stranded section
      for (const [re, thhnKey, sizeKey] of strSizes) {
        if (re.test(lo)) {
          // d[0]=THHN  d[1]=SEU/AL  d[2]=SER/AL  d[3]=SER/AL/5C  d[4]=XHHW/AL  d[5]=BARE/CU
          if (d[0]) prices.thhn[thhnKey]            = d[0];
          if (d[1]) prices.seuAl[`${sizeKey} SEU/AL`]  = d[1];
          if (d[2]) prices.serAl[`${sizeKey} SER/AL`]  = d[2];
          if (d[4]) prices.xhhwAl[`${sizeKey} XHHW/AL`] = d[4];
          if (d[5]) prices.bareCu[`${sizeKey} BARE/CU`] = d[5];
          // Detect solid→stranded transition: if we matched a stranded pattern while solidMode, flip
          if (solidMode) solidMode = false;
          break;
        }
      }
      continue;
    }

    // ── Fallback: no section detected yet — try to infer from content ──
    // MC sizes are unambiguous (contain "/")
    for (const [re, sizeKey] of mcSizes) {
      if (re.test(lo)) {
        if (d[0]) prices.mcCable[sizeKey] = d[0];
        if (d[1]) prices.romex[sizeKey]   = d[1];
        break;
      }
    }
  }

  return prices;
}

// ── File reading ───────────────────────────────────────────────────────────

async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = e => resolve((e.target?.result as string) ?? "");
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
}

// Extract structured cell data from PDF using x,y positions
// Returns rows as arrays of {x, text} objects so we can detect column alignment
async function extractPdfStructured(file: File): Promise<Array<Array<{x: number; text: string}>>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfjsLib = (window as any).pdfjsLib;
  if (!pdfjsLib) throw new Error("PDF.js not loaded. Please save as CSV and upload that instead.");
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  }
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

  // Collect all items across all pages with x,y,text
  const allItems: Array<{x: number; y: number; text: string; pageY: number}> = [];
  let pageOffset = 0;

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const vp = page.getViewport({ scale: 1 });
    const tc = await page.getTextContent();
    for (const item of tc.items as Array<{str: string; transform: number[]}>) {
      if (!item.str.trim()) continue;
      const x = Math.round(item.transform[4]);
      const y = Math.round(vp.height - item.transform[5]); // flip y: 0=top
      allItems.push({ x, y, text: item.str.trim(), pageY: y + pageOffset });
    }
    pageOffset += Math.round(vp.height) + 20;
  }

  // Group into rows by y-position (items within 4px of each other are same row)
  allItems.sort((a, b) => a.pageY - b.pageY || a.x - b.x);
  const rows: Array<Array<{x: number; text: string}>> = [];
  let currentRow: Array<{x: number; text: string}> = [];
  let lastY = -999;

  for (const item of allItems) {
    if (Math.abs(item.pageY - lastY) > 4 && currentRow.length > 0) {
      rows.push(currentRow);
      currentRow = [];
    }
    currentRow.push({ x: item.x, text: item.str ?? item.text });
    lastY = item.pageY;
  }
  if (currentRow.length > 0) rows.push(currentRow);

  return rows;
}


// Legacy flat-text extractor kept for CSV fallback
async function extractPdfText(file: File): Promise<string> {
  const rows = await extractPdfStructured(file);
  const dbg = (window as any).__commodityDebug;
  const result = rows.map(row => row.map(c => c.text).join("   ")).join("\n");
  if (dbg) {
    console.log("=== PDF RAW TEXT (", rows.length, "rows) ===");
    result.split("\n").forEach((l: string, i: number) => {
      if (l.trim()) console.log(i + ":", JSON.stringify(l));
    });
  }
  return result;
}


async function processFile(file: File): Promise<CommodityPrices> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";

  if (ext === "pdf") {
    return parsePdfStructured(file);
  }
  if (ext === "csv" || ext === "txt") {
    const text = await readFileAsText(file);
    return parseCommodityText(text, file.name);
  }
  if (ext === "xlsx" || ext === "xls") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const XLSXGlobal = (window as any).XLSX;
    if (!XLSXGlobal) throw new Error("Excel library not loaded. Save as CSV and upload that instead.");
    const buffer = await file.arrayBuffer();
    const wb = XLSXGlobal.read(buffer, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    return parseCommodityText(XLSXGlobal.utils.sheet_to_csv(ws), file.name);
  }
  throw new Error(`Unsupported file type ".${ext}". Please upload a CSV, PDF, or Excel file.`);
}

// ── Structured PDF parser ──────────────────────────────────────────────────
// Uses x,y positions from PDF.js to correctly assign sparse multi-column cells.

async function parsePdfStructured(file: File): Promise<CommodityPrices> {
  const prices: CommodityPrices = {
    thhn: {}, conduit: {}, mcCable: {}, romex: {},
    seuAl: {}, serAl: {}, xhhwAl: {}, bareCu: {},
    updatedAt: new Date().toISOString(), sourceFile: file.name,
  };

  const rows = await extractPdfStructured(file);
  const dbg = (window as any).__commodityDebug;

  // ── Step 1: build column x-maps from ALL rows ─────────────────────────
  // Header rows may be split across multiple y-rows, so we scan all of them.
  // We collect x-positions for each known column token wherever they appear.

  type ColMap = Record<string, number>;
  const wireColX: ColMap  = {};
  const condColX: ColMap  = {};
  const mcColX: ColMap    = {};

  function rowText(row: Array<{x:number;text:string}>) {
    return row.map(c => c.text).join(" ");
  }

  for (const row of rows) {
    for (const cell of row) {
      const t = cell.text.trim().toUpperCase();
      // Wire columns
      if (t === "THHN")       wireColX["THHN"]       = cell.x;
      if (t === "SEU/AL")     wireColX["SEU/AL"]      = cell.x;
      if (t === "SER/AL")     wireColX["SER/AL"]      = cell.x;
      if (t === "SER/AL/5C")  wireColX["SER/AL/5C"]   = cell.x;
      if (t === "XHHW/AL")    wireColX["XHHW/AL"]     = cell.x;
      if (t === "BARE/CU")    wireColX["BARE/CU"]     = cell.x;
      // Conduit columns
      if (t === "EMT")        condColX["EMT"]         = cell.x;
      if (t === "HW")         condColX["HW"]          = cell.x;
      if (t === "GREENFIELD") condColX["GREENFIELD"]  = cell.x;
      // PVC columns: headers appear as two rows "PVC  PVC" then "Sched 40  Sched 80"
      // We identify them by "Sched 40" and "Sched 80" tokens
      if (t === "SCHED 40" || t === "SCHED" && false) condColX["PVC Sched 40"] = cell.x;
      if (t === "SCHED 80") condColX["PVC Sched 80"] = cell.x;
      // Handle "40" and "80" alone on a row with nearby "PVC" — look for Sched pattern
      // MC columns
      if (t === "MCR/AL")     mcColX["MCR/AL"]        = cell.x;
      if (t === "RX COILS" || t === "RX")  mcColX["RX COILS"] = cell.x;
      if (t === "UF COILS" || t === "UF")  mcColX["UF COILS"] = cell.x;
    }
    // Handle "Sched 40" and "Sched 80" as two-word tokens split across cells
    const rt = rowText(row).trim();
    if (/sched\s+40/i.test(rt)) {
      // Find the "40" or "Sched" cell — use the rightmost token of the pair
      for (let i = 0; i < row.length; i++) {
        if (/^40$/.test(row[i].text.trim())) {
          condColX["PVC Sched 40"] = row[i].x;
        }
        if (/^sched\s+40$/i.test(row[i].text.trim())) {
          condColX["PVC Sched 40"] = row[i].x;
        }
      }
    }
    if (/sched\s+80/i.test(rt)) {
      for (let i = 0; i < row.length; i++) {
        if (/^80$/.test(row[i].text.trim())) {
          condColX["PVC Sched 80"] = row[i].x;
        }
        if (/^sched\s+80$/i.test(row[i].text.trim())) {
          condColX["PVC Sched 80"] = row[i].x;
        }
      }
    }
    // "RX COILS" may be two cells: "RX" then "COILS"
    if (/rx\s+coils/i.test(rt)) {
      const rxIdx = row.findIndex(c => /^rx$/i.test(c.text.trim()));
      if (rxIdx >= 0) mcColX["RX COILS"] = row[rxIdx].x;
    }
    // "UF COILS" may be two cells
    if (/uf\s+coils/i.test(rt)) {
      const ufIdx = row.findIndex(c => /^uf$/i.test(c.text.trim()));
      if (ufIdx >= 0) mcColX["UF COILS"] = row[ufIdx].x;
    }
  }

  if (dbg) {
    console.log("Wire cols:", wireColX);
    console.log("Conduit cols:", condColX);
    console.log("MC cols:", mcColX);
  }

  // ── Step 2: nearest-column assignment ────────────────────────────────────
  function nearestCol(x: number, colMap: ColMap, tolerance = 70): string | null {
    let best: string | null = null;
    let bestDist = tolerance;
    for (const [name, cx] of Object.entries(colMap)) {
      const dist = Math.abs(x - cx);
      if (dist < bestDist) { bestDist = dist; best = name; }
    }
    return best;
  }

  // ── Step 3: size identification helpers ──────────────────────────────────
  const dollarRe = /^\$[\d,]+(?:\.\d{1,2})?$/;
  function isPrice(s: string) { return dollarRe.test(s.trim()); }

  function wireThhnKey(s: string): string | null {
    const t = s.trim().toLowerCase().replace(/\s+/g," ");
    const sol = t.match(/^(\d+)\s+solid/);
    if (sol) return `#${sol[1]} THHN Solid`;
    const slsh = t.match(/^(\d+\/0)$/);
    if (slsh) return `#${slsh[1].toUpperCase()} THHN`;
    const mcm = t.match(/^(250|300|350|400|500|600)$/);
    if (mcm) return `${mcm[1]} THHN`;
    const str = t.match(/^(\d+)(\s+str(anded)?)?$/);
    if (str) return `#${str[1]} THHN`;
    return null;
  }

  function conduitCanonical(s: string): string | null {
    const t = s.trim().replace(/"/g,"").trim();
    const map: Record<string,string> = {
      "1/2":'1/2"', "3/4":'3/4"',
      "1 1/4":'1-1/4"', "1 1/2":'1-1/2"', "1":'1"',
      "2 1/2":'2-1/2"', "3 1/2":'3-1/2"',
      "2":'2"', "3":'3"', "4":'4"', "5":'5"', "6":'6"',
    };
    return map[t] ?? null;
  }

  // MC size: "14/2", "12/2", "12/2 H.G.", "12/2 LUM", etc.
  const mcSizeRe = /^(\d+\/\d+(?:\s+(?:h\.?g\.?|lum))?)$/i;

  // ── Step 4: process each row ──────────────────────────────────────────────
  for (const row of rows) {
    if (row.length < 2) continue;
    const cells = [...row].sort((a,b) => a.x - b.x);
    const firstText = cells[0].text.trim();
    const priceCells = cells.filter(c => isPrice(c.text));
    if (priceCells.length === 0) continue;

    // ── Wire rows ──────────────────────────────────────────────────────────
    const thhnKey = wireThhnKey(firstText);
    if (thhnKey && Object.keys(wireColX).length > 0) {
      for (const cell of priceCells) {
        const col = nearestCol(cell.x, wireColX);
        const val = parsePrice(cell.text);
        if (!val || !col) continue;
        const sz = firstText.replace(/\s+str(anded)?$/i, "").trim();
        if (col === "THHN")      prices.thhn[thhnKey]              = val;
        else if (col === "SEU/AL")   prices.seuAl[`${sz} SEU/AL`]  = val;
        else if (col === "SER/AL")   prices.serAl[`${sz} SER/AL`]  = val;
        else if (col === "XHHW/AL")  prices.xhhwAl[`${sz} XHHW/AL`]= val;
        else if (col === "BARE/CU")  prices.bareCu[`${sz} BARE/CU`]= val;
      }
      continue;
    }

    // ── Conduit rows (may include MC data on the same line) ───────────────
    const condSize = conduitCanonical(firstText);
    if (condSize && Object.keys(condColX).length > 0) {
      // Split the row: conduit data before any MC size token, MC after
      let mcStartIdx = -1;
      for (let i = 1; i < cells.length; i++) {
        if (mcSizeRe.test(cells[i].text.trim())) { mcStartIdx = i; break; }
      }

      const condCells = (mcStartIdx >= 0 ? cells.slice(1, mcStartIdx) : cells.slice(1))
        .filter(c => isPrice(c.text));

      for (const cell of condCells) {
        const col = nearestCol(cell.x, condColX);
        const val = parsePrice(cell.text);
        if (!val || !col) continue;
        if (col === "EMT")            prices.conduit[`${condSize} EMT`]         = val;
        else if (col === "HW")        prices.conduit[`${condSize} HW`]          = val;
        else if (col === "PVC Sched 40") prices.conduit[`${condSize} PVC Sched 40`] = val;
        else if (col === "PVC Sched 80") prices.conduit[`${condSize} PVC Sched 80`] = val;
        else if (col === "GREENFIELD")prices.conduit[`${condSize} Greenfield`]  = val;
      }

      if (mcStartIdx >= 0) {
        const mcSize = cells[mcStartIdx].text.trim();
        const mcCells = cells.slice(mcStartIdx + 1).filter(c => isPrice(c.text));
        for (const cell of mcCells) {
          const col = nearestCol(cell.x, mcColX, 90);
          const val = parsePrice(cell.text);
          if (!val) continue;
          if (!col || col === "MCR/AL")    prices.mcCable[mcSize] = val;
          else if (col === "RX COILS")     prices.romex[mcSize]   = val;
          else if (col === "UF COILS")     { /* UF stored separately if needed */ }
        }
      }
      continue;
    }

    // ── Standalone MC rows (H.G., LUM, and overflow MC sizes) ────────────
    if (mcSizeRe.test(firstText) && Object.keys(mcColX).length > 0) {
      const mcSize = firstText;
      for (const cell of priceCells) {
        const col = nearestCol(cell.x, mcColX, 90);
        const val = parsePrice(cell.text);
        if (!val) continue;
        if (!col || col === "MCR/AL")  prices.mcCable[mcSize] = val;
        else if (col === "RX COILS")   prices.romex[mcSize]   = val;
      }
      continue;
    }
  }

  if (dbg) {
    console.log("Results — THHN:", Object.keys(prices.thhn).length,
      "conduit:", Object.keys(prices.conduit).length,
      "MC:", Object.keys(prices.mcCable).length,
      "Romex:", Object.keys(prices.romex).length,
      "SEU:", Object.keys(prices.seuAl).length);
  }

  return prices;
}


// ── Component ──────────────────────────────────────────────────────────────

interface Props {
  type: "bid" | "pco";
  onClose: () => void;
  onUpdated: (type: "bid" | "pco") => void;
}

type Status = "idle" | "parsing" | "preview" | "error";

export default function CommoditySheetModal({ type, onClose, onUpdated }: Props) {
  const [status,   setStatus]   = useState<Status>("idle");
  const [message,  setMessage]  = useState("");
  const [preview,  setPreview]  = useState<CommodityPrices | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setStatus("parsing");
    setMessage(`Reading ${file.name}…`);
    setPreview(null);
    try {
      const prices = await processFile(file);
      const total = countPrices(prices);
      if (total === 0) {
        setStatus("error");
        setMessage(
          "No prices were found in this file. " +
          "If uploading an Excel file, try File → Save As → CSV, then upload the CSV. " +
          "If uploading a PDF, make sure it is a digital PDF (not a scanned image)."
        );
      } else {
        setPreview(prices);
        setStatus("preview");
        setMessage(`Found ${total} price${total !== 1 ? "s" : ""} — review below then click Apply`);
      }
    } catch (e: unknown) {
      setStatus("error");
      setMessage(String(e));
    }
  };

  const handleApply = async () => {
    if (!preview) return;
    await saveSetting(commoditySettingKey(type), JSON.stringify(preview));
    await saveSetting(commodityUploadTsKey(type), new Date().toISOString());
    onUpdated(type);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const total = preview ? countPrices(preview) : 0;

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={box}>

        {/* Header */}
        <div style={hdr}>
          <div>
            <div style={{ color: "white", fontSize: 14, fontWeight: 700 }}>
              {type === "pco" ? "PCO Commodity Pricing" : "BID Commodity Pricing"}
            </div>
            <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 11, marginTop: 1 }}>
              {type === "pco" ? "Upload PCO/change-order distributor bid sheet" : "Upload your latest distributor bid sheet"}
            </div>
          </div>
          <button onClick={onClose} style={closeBtn}><X size={15} /></button>
        </div>

        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16, overflow: "auto", flex: 1 }}>

          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? "var(--accent)" : "var(--border-strong)"}`,
              borderRadius: "var(--r-lg)", padding: "32px 20px", textAlign: "center",
              cursor: "pointer", background: dragOver ? "var(--accent-light)" : "var(--bg-surface)",
              transition: "all var(--t-fast)", flexShrink: 0,
            }}
          >
            <Upload size={30} style={{ color: dragOver ? "var(--accent)" : "var(--text-muted)", margin: "0 auto 12px", display: "block" }} />
            <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)", marginBottom: 4 }}>
              Drop your bid sheet here
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              or click to browse — <strong>CSV recommended</strong>, also accepts PDF
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.pdf,.txt,.xlsx,.xls"
              style={{ display: "none" }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
            />
          </div>

          {/* Tip box */}
          <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "var(--r-md)", padding: "10px 14px", fontSize: 12, color: "#92400e" }}>
            <strong>Best results:</strong> Open the T&H Excel bid sheet, then go to <em>File → Save As → CSV (Comma delimited)</em> and upload that CSV file. PDFs also work if they are digital (not scanned).
          </div>

          {/* Status message */}
          {status !== "idle" && (
            <div style={{
              display: "flex", alignItems: "flex-start", gap: 10,
              padding: "10px 14px", borderRadius: "var(--r-md)", flexShrink: 0,
              background: status === "error" ? "#fee2e2" : status === "preview" ? "#dcfce7" : "var(--bg-surface)",
              border: `1px solid ${status === "error" ? "#fca5a5" : status === "preview" ? "#86efac" : "var(--border)"}`,
              fontSize: 13,
            }}>
              {status === "parsing" && <RefreshCw size={15} style={{ color: "var(--accent)", flexShrink: 0, marginTop: 1 }} />}
              {status === "preview" && <CheckCircle size={15} style={{ color: "#16a34a", flexShrink: 0, marginTop: 1 }} />}
              {status === "error"   && <AlertCircle size={15} style={{ color: "#dc2626", flexShrink: 0, marginTop: 1 }} />}
              <span style={{ color: status === "error" ? "#dc2626" : status === "preview" ? "#15803d" : "var(--text-secondary)", lineHeight: 1.5 }}>
                {message}
              </span>
            </div>
          )}

          {/* Preview tables */}
          {preview && status === "preview" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {Object.keys(preview.thhn).length > 0 && (
                <PriceTable title={`THHN Copper Wire — ${Object.keys(preview.thhn).length} sizes`} unit="per 1,000 ft" data={preview.thhn} />
              )}
              {Object.keys(preview.seuAl ?? {}).length > 0 && (
                <PriceTable title={`SEU/AL Wire — ${Object.keys(preview.seuAl).length} sizes`} unit="per 1,000 ft" data={preview.seuAl} />
              )}
              {Object.keys(preview.serAl ?? {}).length > 0 && (
                <PriceTable title={`SER/AL Wire — ${Object.keys(preview.serAl).length} sizes`} unit="per 1,000 ft" data={preview.serAl} />
              )}
              {Object.keys(preview.xhhwAl ?? {}).length > 0 && (
                <PriceTable title={`XHHW/AL Wire — ${Object.keys(preview.xhhwAl).length} sizes`} unit="per 1,000 ft" data={preview.xhhwAl} />
              )}
              {Object.keys(preview.bareCu ?? {}).length > 0 && (
                <PriceTable title={`Bare Copper Wire — ${Object.keys(preview.bareCu).length} sizes`} unit="per 1,000 ft" data={preview.bareCu} />
              )}
              {Object.keys(preview.conduit).length > 0 && (
                <PriceTable title={`Conduit — ${Object.keys(preview.conduit).length} items`} unit="per 100 ft" data={preview.conduit} />
              )}
              {Object.keys(preview.mcCable).length > 0 && (
                <PriceTable title={`MC/AL Cable — ${Object.keys(preview.mcCable).length} sizes`} unit="per 1,000 ft" data={preview.mcCable} />
              )}
              {Object.keys(preview.romex).length > 0 && (
                <PriceTable title={`RX Coils / Romex — ${Object.keys(preview.romex).length} sizes`} unit="per 1,000 ft" data={preview.romex} />
              )}
            </div>
          )}

          {/* Idle instructions */}
          {status === "idle" && (
            <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: "14px 16px", fontSize: 12 }}>
              <div style={{ fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>What this updates</div>
              <div style={{ color: "var(--text-secondary)", lineHeight: 2 }}>
                <div>• THHN copper wire — solid and stranded, all sizes</div>
                <div>• SEU/AL, SER/AL, XHHW/AL, Bare Copper — all sizes</div>
                <div>• EMT, HW (GRC), PVC Sched 40, PVC Sched 80, Greenfield conduit</div>
                <div>• MC/AL armored cable — all sizes and configurations (H.G., LUM)</div>
                <div>• RX Coils — all sizes</div>
                <div style={{ marginTop: 6, color: "var(--text-muted)", fontStyle: "italic" }}>
                  Prices apply immediately to all new takeoff items. Existing estimate line items are updated automatically.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 24px 18px", borderTop: "1px solid var(--border)", display: "flex", gap: 10, flexShrink: 0 }}>
          <button onClick={onClose} style={cancelBtn}>Cancel</button>
          {status === "preview" && total > 0 && (
            <button
              onClick={handleApply}
              style={{ ...cancelBtn, flex: 2, background: "linear-gradient(180deg,#2277cc,#1155aa)", color: "white", border: "none", fontWeight: 700, fontFamily: "Arial,sans-serif", textTransform: "uppercase", letterSpacing: "0.4px" }}
            >
              Apply {total} Price Updates
            </button>
          )}
          {(status === "error" || status === "preview") && (
            <button
              onClick={() => { setStatus("idle"); setPreview(null); setMessage(""); fileRef.current?.click(); }}
              style={{ ...cancelBtn, color: "var(--accent)", borderColor: "var(--accent)" }}
            >
              Upload Different File
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function countPrices(p: CommodityPrices): number {
  return Object.keys(p.thhn).length + Object.keys(p.conduit).length +
    Object.keys(p.mcCable).length + Object.keys(p.romex).length +
    Object.keys(p.seuAl ?? {}).length + Object.keys(p.serAl ?? {}).length +
    Object.keys(p.xhhwAl ?? {}).length + Object.keys(p.bareCu ?? {}).length;
}

// ── Price preview table ────────────────────────────────────────────────────

function PriceTable({ title, unit, data }: { title: string; unit: string; data: Record<string, number> }) {
  const entries = Object.entries(data).sort(([a], [b]) => a.localeCompare(b));
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: "var(--r-md)", overflow: "hidden" }}>
      <div style={{ padding: "7px 12px", background: "#dce8f0", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#2a4a6a" }}>{title}</span>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{unit}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px,1fr))", maxHeight: 160, overflow: "auto" }}>
        {entries.map(([key, val]) => (
          <div key={key} style={{ padding: "5px 10px", borderBottom: "1px solid #f0f4f8", display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12 }}>
            <span style={{ color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{key}</span>
            <span style={{ fontFamily: "var(--font-mono)", color: "var(--accent)", fontWeight: 600, flexShrink: 0 }}>
              ${val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const overlay: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.40)",
  display: "flex", alignItems: "center", justifyContent: "center",
  zIndex: 2500, backdropFilter: "blur(4px)", animation: "fadeIn 0.15s ease",
};
const box: React.CSSProperties = {
  background: "var(--bg-raised)", border: "1px solid var(--border-strong)",
  borderRadius: "var(--r-lg)", width: 640, maxHeight: "88vh",
  boxShadow: "var(--shadow-lg)", display: "flex", flexDirection: "column",
  animation: "fadeIn 0.2s cubic-bezier(0.16,1,0.3,1)",
};
const hdr: React.CSSProperties = {
  padding: "14px 20px", borderBottom: "1px solid var(--border)",
  display: "flex", justifyContent: "space-between", alignItems: "center",
  background: "linear-gradient(to right,#0a246a,#2a5abf)",
  borderRadius: "var(--r-lg) var(--r-lg) 0 0", flexShrink: 0,
};
const closeBtn: React.CSSProperties = {
  background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)",
  color: "white", cursor: "pointer", padding: "3px 6px", display: "flex",
  borderRadius: "var(--r-sm)",
};
const cancelBtn: React.CSSProperties = {
  flex: 1, padding: "9px 0", borderRadius: "var(--r-md)", fontSize: 13,
  fontWeight: 600, cursor: "pointer",
  background: "var(--bg-surface)", border: "1px solid var(--border-strong)",
  color: "var(--text-primary)",
};

