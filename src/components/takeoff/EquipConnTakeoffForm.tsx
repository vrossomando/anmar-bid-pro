/**
 * EquipConnTakeoffForm — Motor Hookup / Equipment Connection Takeoff
 *
 * Each connection explodes into individual assembly line items visible in
 * the audit trail, extensions, and reports:
 *   - Disconnect switch
 *   - Flex conduit / MC Cable / Romex run
 *   - Termination connectors
 *   - THHN wire legs
 *   - Wire termination labor (labor-only items, both ends)
 */

import { useState, useEffect } from "react";
import { Search } from "lucide-react";
import TakeoffShell from "./TakeoffShell";
import { searchAssemblies, type Assembly } from "../../hooks/db";
import type { TakeoffLineItem } from "../../hooks/takeoffCalculations";
import type { SectionBreakdown } from "../SectionBreakdownModal";
import { v4 as uuidv4 } from "uuid";

// ── Conduit / cable / wire data ────────────────────────────────────────────

const CONDUIT_SIZES = ["3/8\"","1/2\"","3/4\"","1\"","1-1/4\"","1-1/2\"","2\"","2-1/2\"","3\"","3-1/2\"","4\""];

const WIRE_SIZES_THHN = [
  "#14","#12","#10","#8","#6","#4","#3","#2","#1",
  "#1/0","#2/0","#3/0","#4/0",
  "#250MCM","#300MCM","#350MCM","#400MCM","#500MCM","#600MCM","#750MCM",
];

const MC_CABLE_OPTIONS = [
  "14/2 Aluminum Clad MC Cable Solid","14/3 Aluminum Clad MC Cable Solid","14/4 Aluminum Clad MC Cable Solid",
  "12/2 Aluminum Clad MC Cable Solid","12/3 Aluminum Clad MC Cable Solid","12/4 Aluminum Clad MC Cable Solid",
  "10/2 Aluminum Clad MC Cable Solid","10/3 Aluminum Clad MC Cable Solid","10/4 Aluminum Clad MC Cable Solid",
  "12/2 Aluminum Clad MC Cable Stranded","12/3 Aluminum Clad MC Cable Stranded","12/4 Aluminum Clad MC Cable Stranded",
  "10/2 Aluminum Clad MC Cable Stranded","10/3 Aluminum Clad MC Cable Stranded","10/4 Aluminum Clad MC Cable Stranded",
  "8/2 Aluminum Clad MC Cable Stranded","8/3 Aluminum Clad MC Cable Stranded","8/4 Aluminum Clad MC Cable Stranded",
  "6/2 Aluminum Clad MC Cable Stranded","6/3 Aluminum Clad MC Cable Stranded","6/4 Aluminum Clad MC Cable Stranded",
  "14/3 Steel MC Cable w/Green Ground Wire",
  "12/2 Steel MC Cable w/Green Ground Wire","12/3 Steel MC Cable w/Green Ground Wire","12/4 Steel MC Cable w/Green Ground Wire",
  "10/2 Steel MC Cable w/Green Ground Wire","10/3 Steel MC Cable w/Green Ground Wire","10/4 Steel MC Cable w/Green Ground Wire",
  "8/2 Steel MC Cable with Green Ground","8/3 Steel MC Cable with Green Ground","8/4 Steel MC Cable with Green Ground",
  "6/2 Steel MC Cable with Green Ground","6/3 Steel MC Cable with Green Ground",
  "4/3 Steel MC Cable with Green Ground",
  "#1/3 Steel MC Cable with Green Ground","#1/0/3 Steel MC Cable with Green Ground",
];

const ROMEX_OPTIONS = [
  "14/2 Romex w/Ground","14/3 Romex w/Ground",
  "12/2 Romex w/Ground","12/3 Romex w/Ground",
  "10/2 Romex w/Ground","10/3 Romex w/Ground",
  "8/2 Romex w/Ground","8/3 Romex w/Ground",
  "6/2 Romex w/Ground","6/3 Romex w/Ground",
  "4/3 Romex w/Ground","3/3 Romex w/Ground","2/3 Romex w/Ground",
];

// Disconnect switch groups for quick-select dropdown
const DISC_GROUPS = [
  { group: "NEMA 1 — 240V Fusible 3P",     items: ["30A/3P 4WSN 240V HD Fus Safety Sw-Nema 1","60A/3P 4WSN 240V HD Fus Safety Sw-Nema 1","100A/3P 4WSN 240V HD Fus Safety Sw-Nema1","200A/3P 4WSN 240V HD Fus Safety Sw-Nema1","400A/3P 4WSN 240V HD Fus Safety Sw-Nema1","600A/3P 4WSN 240V HD Fus Safety Sw-Nema1"] },
  { group: "NEMA 1 — 240V Non-Fusible 3P",  items: ["30A/3P 240V GD NF Safety Sw-Nema 1","60A/3P 240V GD NF Safety Sw-Nema 1","100A/3P 240V GD NF Safety Sw-Nema 1","200A/3P 240V GD NF Safety Sw-Nema 1","400A/3P 240V GD NF Safety Sw-Nema 1","600A/3P 240V GD NF Safety Sw-Nema 1"] },
  { group: "NEMA 3R — 240V Fusible 3P",     items: ["30A/3P 4WSN 240V HD Fus Safety Sw-Nema3R","60A/3P 4WSN 240V HD Fus Safety Sw-Nema3R","100A/3P 4WSN 240V HD FusSafety Sw-Nema3R","200A/3P 4WSN 240V HD FusSafety Sw-Nema3R","400A/3P 4WSN 240V HD FusSafety Sw-Nema3R","600A/3P 4WSN 240V HD FusSafety Sw-Nema3R"] },
  { group: "NEMA 3R — 240V Non-Fusible 3P", items: ["30A/3P 240V GD NF Safety Sw-Nema 3R","60A/3P 240V GD NF Safety Sw-Nema 3R","100A/3P 240V GD NF Safety Sw-Nema 3R","200A/3P 240V GD NF Safety Sw-Nema 3R"] },
  { group: "NEMA 1 — 600V Fusible 3P",      items: ["30A/3P 600V HD Fus Safety Sw-Nema 1","60A/3P 600V HD Fus Safety Sw-Nema 1","100A/3P 600V HD Fus Safety Sw-Nema 1","200A/3P 600V HD Fus Safety Sw-Nema 1","400A/3P 600V HD Fus Safety Sw-Nema 1","600A/3P 600V HD Fus Safety Sw-Nema 1"] },
  { group: "NEMA 1 — 600V Non-Fusible 3P",  items: ["30A/3P 600V HD NF Safety Sw-Nema 1","60A/3P 600V HD NF Safety Sw-Nema 1","100A/3P 600V HD NF Safety Sw-Nema 1","200A/3P 600V HD NF Safety Sw-Nema 1","400A/3P 600V HD NF Safety Sw-Nema 1","600A/3P 600V HD NF Safety Sw-Nema 1"] },
  { group: "NEMA 3R — 600V Fusible 3P",     items: ["30A/3P 600V HD Fus Safety Sw-NEMA3R","60A/3P 600V HD Fus Safety Sw-NEMA3R","100A/3P 600V HD Fus Safety Sw-NEMA3R","200A/3P 600V HD Fus Safety Sw-NEMA3R","400A/3P 600V HD Fus Safety Sw-NEMA3R","600A/3P 600V HD Fus Safety Sw-NEMA3R"] },
  { group: "NEMA 3R — 600V Non-Fusible 3P", items: ["30A/3P 600V HD NF Safety Sw-Nema 3R","60A/3P 600V HD NF Safety Sw-Nema 3R","100A/3P 600V HD NF Safety Sw-Nema 3R","200A/3P 600V HD NF Safety Sw-Nema 3R","400A/3P 600V HD NF Safety Sw-Nema 3R","600A/3P 600V HD NF Safety Sw-Nema 3R"] },
];

// Wire termination labor: map wire size to item number and labor hours
const WIRE_TERM: { range: string; sizes: string[]; itemNum: string; labor2: number }[] = [
  { range: "#14-12-10", sizes: ["#14","#12","#10"],                         itemNum:"4409", labor2:0.10 },
  { range: "#8-6",      sizes: ["#8","#6"],                                 itemNum:"4410", labor2:0.15 },
  { range: "#4-1",      sizes: ["#4","#3","#2","#1"],                       itemNum:"4411", labor2:0.18 },
  { range: "#2/0-1/0",  sizes: ["#2/0","#1/0"],                             itemNum:"4412", labor2:0.20 },
  { range: "#3/0-4/0",  sizes: ["#3/0","#4/0"],                             itemNum:"4413", labor2:0.25 },
  { range: "#250-300",  sizes: ["#250MCM","#300MCM"],                       itemNum:"4414", labor2:0.30 },
  { range: "#350",      sizes: ["#350MCM"],                                 itemNum:"4415", labor2:0.35 },
  { range: "#400",      sizes: ["#400MCM"],                                 itemNum:"4416", labor2:0.40 },
  { range: "#500",      sizes: ["#500MCM"],                                 itemNum:"4417", labor2:0.50 },
  { range: "#600",      sizes: ["#600MCM"],                                 itemNum:"4418", labor2:0.70 },
  { range: "#750",      sizes: ["#750MCM"],                                 itemNum:"4419", labor2:0.90 },
  { range: "#1000",     sizes: ["#1000MCM"],                                itemNum:"4420", labor2:1.00 },
];

function wtForSize(size: string) {
  return WIRE_TERM.find(w => w.sizes.includes(size)) ?? WIRE_TERM[0];
}

// ── Types ──────────────────────────────────────────────────────────────────

type ConduitType = "Aluminum Flex"|"Steel Flex"|"Liquidtight"|"MC Cable"|"Romex"|"None";
type TermType    = "LT Straight (both)"|"LT 90D + Straight"|"Steel 2-Screw (both)"|"None";
type Difficulty  = "Standard"|"Difficult"|"Very Difficult";

interface WireRow { numWires: number; wireSize: string; }

interface ConnRow {
  designation: string;
  conduitSize:  string;
  conduitType:  ConduitType;
  difficulty:   Difficulty;
  wires:        [WireRow, WireRow];
  cableChoice:  string;      // for MC Cable or Romex type
  termType:     TermType;
  wireTerm1:    string;      // range label e.g. "#14-12-10"
  wireTerm2:    string;
  lengthEach:   number;
  makupPct:     number;
  discSearch:   string;      // exact description of selected switch, or ""
  qty:          number;
  notes:        string;
}

function defaultRow(): ConnRow {
  return {
    designation:"HP-1", conduitSize:"1\"", conduitType:"Aluminum Flex",
    difficulty:"Standard",
    wires: [{ numWires:3, wireSize:"#12" }, { numWires:0, wireSize:"#10" }],
    cableChoice: MC_CABLE_OPTIONS[1],
    termType:"LT Straight (both)",
    wireTerm1:"#14-12-10", wireTerm2:"#14-12-10",
    lengthEach:0, makupPct:50,
    discSearch:"", qty:1, notes:"",
  };
}

interface Props {
  projectId: string;
  defaultLaborRate: number;
  sectionBreakdown: SectionBreakdown;
  onCommit: (items: TakeoffLineItem[]) => void;
  onClose: () => void;
}

// ── Component ──────────────────────────────────────────────────────────────

export default function EquipConnTakeoffForm({ projectId, defaultLaborRate, sectionBreakdown, onCommit, onClose }: Props) {
  const [rows,           setRows]           = useState<ConnRow[]>([defaultRow()]);
  const [activeIdx,      setActiveIdx]      = useState(0);
  const [laborFactor,    setLaborFactor]    = useState(0);
  const [materialFactor, setMaterialFactor] = useState(0);
  const [discSearch,     setDiscSearch]     = useState("");
  const [discResults,    setDiscResults]    = useState<Assembly[]>([]);
  const [discLoading,    setDiscLoading]    = useState(false);
  const [committing,     setCommitting]     = useState(false);

  const row = rows[activeIdx] ?? rows[0];

  const update = (field: keyof ConnRow, val: unknown) =>
    setRows(prev => prev.map((r, i) => i === activeIdx ? { ...r, [field]: val } : r));

  const updateWire = (wi: 0|1, field: keyof WireRow, val: unknown) =>
    setRows(prev => prev.map((r, i) => {
      if (i !== activeIdx) return r;
      const wires = [...r.wires] as [WireRow, WireRow];
      wires[wi] = { ...wires[wi], [field]: val };
      return { ...r, wires };
    }));

  // Disconnect catalog search
  useEffect(() => {
    const q = discSearch.trim();
    if (!q) { setDiscResults([]); return; }
    const t = setTimeout(async () => {
      setDiscLoading(true);
      try {
        const res = await searchAssemblies(q, undefined, 40);
        setDiscResults(res.filter(a =>
          /safety sw|disconnect|fusible switch/i.test(a.description)
        ));
      } finally { setDiscLoading(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [discSearch]);

  // Lookup helper: first catalog hit matching description
  const lookup = async (term: string): Promise<Assembly|null> => {
    const hits = await searchAssemblies(term, undefined, 10);
    return hits.find(a => a.description.toLowerCase().includes(term.toLowerCase().split(" ")[0].toLowerCase())) ?? hits[0] ?? null;
  };

  // Build individual line items for one connection
  const buildItems = async (r: ConnRow): Promise<TakeoffLineItem[]> => {
    const category = `Equipment Connections | ${sectionBreakdown.section} | ${sectionBreakdown.breakdown}`;
    const lf = 1 + laborFactor / 100;
    const mf = 1 + materialFactor / 100;
    const tag = r.designation.trim() || "Equip Conn";
    const items: TakeoffLineItem[] = [];
    let sort = Date.now();

    const push = (desc: string, qty: number, unit: string, unitCost: number, laborHrs: number, asmId: number|null = null, laborUnit?: string) => {
      items.push({
        id: uuidv4(), project_id: projectId, category,
        description: `${tag} — ${desc}`,
        qty, unit,
        unit_cost: unitCost * mf,
        markup_pct: 0,
        labor_hours: laborHrs * lf,
        labor_unit: laborUnit ?? unit,
        labor_rate: defaultLaborRate,
        assembly_id: asmId,
        sort_order: sort++,
      });
    };

    const isConduit = r.conduitType !== "MC Cable" && r.conduitType !== "Romex" && r.conduitType !== "None";
    const isCable   = r.conduitType === "MC Cable" || r.conduitType === "Romex";

    // 1. Disconnect switch
    if (r.discSearch) {
      const sw = await lookup(r.discSearch);
      if (sw) push(sw.description, r.qty, "E", sw.unit_price ?? 0, sw.labor_2 ?? sw.labor_1 ?? 1.5, sw.id, sw.labor_unit);
    }

    // 2. Conduit run (flex types)
    if (isConduit && r.lengthEach > 0) {
      const flexTerm = `${r.conduitSize} ${r.conduitType === "Liquidtight" ? "Liquidtight (metallic)" : r.conduitType}`;
      const flex = await lookup(flexTerm);
      if (flex) {
        const totalFt = r.lengthEach * r.qty;
        push(flex.description, totalFt, "C", flex.unit_price ?? 0, flex.labor_2 ?? flex.labor_1 ?? 0, flex.id, flex.labor_unit);
      }

      // Termination connectors
      const connTerms: string[] = [];
      if (r.termType === "LT Straight (both)")  connTerms.push(`${r.conduitSize} Seal-tite Conn (Str)`, `${r.conduitSize} Seal-tite Conn (Str)`);
      if (r.termType === "LT 90D + Straight")   connTerms.push(`${r.conduitSize} Seal-tite Conn (90`, `${r.conduitSize} Seal-tite Conn (Str)`);
      if (r.termType === "Steel 2-Screw (both)") connTerms.push(`${r.conduitSize} Steel 2-Screw Flex Conn`, `${r.conduitSize} Steel 2-Screw Flex Conn`);

      for (const ct of connTerms) {
        const conn = await lookup(ct);
        if (conn) push(conn.description, r.qty, "E", conn.unit_price ?? 0, conn.labor_2 ?? conn.labor_1 ?? 0, conn.id, conn.labor_unit);
      }
    }

    // 3. MC Cable or Romex run
    if (isCable && r.lengthEach > 0) {
      const cable = await lookup(r.cableChoice);
      if (cable) {
        const totalFt = r.lengthEach * r.qty;
        push(cable.description, totalFt, "M", cable.unit_price ?? 0, cable.labor_2 ?? cable.labor_1 ?? 0, cable.id, cable.labor_unit);
      }
      // Connector at each end (2 per connection)
      const connTerm = r.conduitType === "MC Cable" ? "3/8\" MC/BX Connector" : "1/2\" Romex Conn";
      const conn = await lookup(connTerm);
      if (conn) push(conn.description, r.qty * 2, "E", conn.unit_price ?? 0, conn.labor_2 ?? conn.labor_1 ?? 0, conn.id, conn.labor_unit);
    }

    // 4. THHN wire (conduit runs only)
    if (isConduit && r.lengthEach > 0) {
      for (const wire of r.wires) {
        if (wire.numWires <= 0) continue;
        const wireFt = Math.ceil(r.lengthEach * (1 + r.makupPct / 100));
        const thhn = await lookup(`${wire.wireSize} THHN CU Stranded Wire`);
        if (thhn) {
          const totalFt = wireFt * wire.numWires * r.qty;
          push(thhn.description, totalFt, "M", thhn.unit_price ?? 0, thhn.labor_2 ?? thhn.labor_1 ?? 0, thhn.id, thhn.labor_unit);
        }
      }

      // 5. Wire termination labor (labor-only, both ends = ×2)
      for (let wi = 0; wi < 2; wi++) {
        const wire = r.wires[wi];
        if (wire.numWires <= 0) continue;
        const wtKey = wi === 0 ? r.wireTerm1 : r.wireTerm2;
        const wt = WIRE_TERM.find(w => w.range === wtKey);
        if (wt) {
          const ends = 2;
          push(`${wt.range} Wire Termination Labor`, wire.numWires * ends * r.qty, "E", 0, wt.labor2, null);
        }
      }
    }

    return items;
  };

  const handleTakeoff = async () => {
    const valid = rows.filter(r => r.qty > 0 && r.designation.trim());
    if (!valid.length || committing) return;
    setCommitting(true);
    try {
      const all: TakeoffLineItem[] = [];
      for (const r of valid) all.push(...(await buildItems(r)));
      onCommit(all);
    } finally { setCommitting(false); }
  };

  const validCount = rows.filter(r => r.qty > 0 && r.designation.trim()).length;
  const isConduit  = row.conduitType !== "MC Cable" && row.conduitType !== "Romex" && row.conduitType !== "None";
  const isCable    = row.conduitType === "MC Cable" || row.conduitType === "Romex";

  return (
    <TakeoffShell
      title="Equipment Connections — Motor Hookup"
      subtitle={committing ? "Building assembly…" : validCount > 0 ? `${validCount} connection${validCount !== 1 ? "s" : ""} — explodes into individual line items` : "Configure motor/equipment hookup below"}
      laborFactor={laborFactor} materialFactor={materialFactor}
      onLaborFactorChange={setLaborFactor} onMaterialFactorChange={setMaterialFactor}
      onTakeoff={handleTakeoff} onClose={onClose}
      takeoffDisabled={validCount === 0 || committing} width={1060}
      quoteMode={false} onQuoteModeChange={() => {}}
    >
      {/* Info */}
      <div style={{ padding:"7px 16px", background:"#f0f6ff", borderBottom:"1px solid #c7d9f0", fontSize:11, color:"#1a3a6a", flexShrink:0 }}>
        Each connection explodes into <strong>individual line items</strong>: disconnect, flex/cable, connectors, wire, and termination labor — all shown separately in the audit trail and extensions.
      </div>

      <div style={{ display:"flex", flex:1, overflow:"hidden" }}>

        {/* ── Left: connections list ─────────────────────────────────── */}
        <div style={{ width:172, flexShrink:0, borderRight:"1px solid var(--border)", overflow:"auto", background:"var(--bg-surface)" }}>
          <div style={{ padding:"8px 10px 4px", fontSize:9, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.07em", color:"var(--text-muted)" }}>Connections</div>
          {rows.map((r, idx) => (
            <div key={idx} onClick={() => setActiveIdx(idx)}
              style={{ padding:"8px 10px", cursor:"pointer", borderBottom:"1px solid var(--border)", borderLeft:`3px solid ${idx===activeIdx?"var(--accent)":"transparent"}`, background:idx===activeIdx?"var(--bg-active)":"transparent", transition:"background 0.1s" }}
              onMouseEnter={e => { if(idx!==activeIdx)(e.currentTarget as HTMLElement).style.background="var(--bg-raised)"; }}
              onMouseLeave={e => { if(idx!==activeIdx)(e.currentTarget as HTMLElement).style.background="transparent"; }}
            >
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div>
                  <div style={{ fontSize:12, fontWeight:idx===activeIdx?700:500, color:idx===activeIdx?"var(--accent)":"var(--text-primary)" }}>{r.designation||`Conn ${idx+1}`}</div>
                  <div style={{ fontSize:10, color:"var(--text-muted)", marginTop:1 }}>{r.conduitSize} · qty {r.qty}</div>
                </div>
                {rows.length>1 && (
                  <button onClick={e=>{e.stopPropagation();setRows(p=>p.filter((_,i)=>i!==idx));setActiveIdx(Math.max(0,idx-1));}}
                    style={{ background:"none", border:"none", color:"var(--text-muted)", cursor:"pointer", fontSize:14, padding:"0 2px" }}>×</button>
                )}
              </div>
            </div>
          ))}
          <button onClick={()=>{setRows(p=>[...p,defaultRow()]);setActiveIdx(rows.length);}}
            style={{ width:"100%", padding:"8px 10px", background:"none", border:"none", borderTop:"1px dashed var(--border)", color:"var(--text-muted)", cursor:"pointer", fontSize:11, textAlign:"left" }}>
            + Add Connection
          </button>
        </div>

        {/* ── Right: form ────────────────────────────────────────────── */}
        <div style={{ flex:1, overflow:"auto", padding:"14px 18px", display:"flex", flexDirection:"column", gap:12 }}>

          {/* Designation + section info */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:10 }}>
            <Field label="Designation">
              <input value={row.designation} onChange={e=>update("designation",e.target.value)} placeholder="HP-1" style={inp} />
            </Field>
            <Field label="Section"><input value={sectionBreakdown.section} readOnly style={{...inp,background:"#f5f5f5"}} /></Field>
            <Field label="Breakdown"><input value={sectionBreakdown.breakdown} readOnly style={{...inp,background:"#f5f5f5"}} /></Field>
            <Field label="Drawing Ref"><input value={sectionBreakdown.drawingRef} readOnly style={{...inp,background:"#f5f5f5"}} /></Field>
          </div>

          {/* Conduit / Cable panel */}
          <Panel title="Conduit / Cable">
            <div style={{ display:"grid", gridTemplateColumns:"120px 1fr 130px", gap:10 }}>
              <Field label="Conduit Size">
                <select value={row.conduitSize} onChange={e=>update("conduitSize",e.target.value)} style={sel}>
                  {CONDUIT_SIZES.map(s=><option key={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Conduit / Cable Type">
                <select value={row.conduitType} onChange={e=>update("conduitType",e.target.value as ConduitType)} style={sel}>
                  <option value="Aluminum Flex">Aluminum Flex</option>
                  <option value="Steel Flex">Steel Flex</option>
                  <option value="Liquidtight">Liquidtight (Metallic)</option>
                  <option value="MC Cable">MC Cable</option>
                  <option value="Romex">Romex</option>
                  <option value="None">None (wire / labor only)</option>
                </select>
              </Field>
              <Field label="Difficulty">
                <select value={row.difficulty} onChange={e=>update("difficulty",e.target.value as Difficulty)} style={sel}>
                  <option>Standard</option><option>Difficult</option><option>Very Difficult</option>
                </select>
              </Field>
            </div>
            {isCable && (
              <div style={{ marginTop:8 }}>
                <Field label={`${row.conduitType} Type`}>
                  <select value={row.cableChoice} onChange={e=>update("cableChoice",e.target.value)} style={sel}>
                    {(row.conduitType==="MC Cable"?MC_CABLE_OPTIONS:ROMEX_OPTIONS).map(o=><option key={o}>{o}</option>)}
                  </select>
                </Field>
              </div>
            )}
          </Panel>

          {/* Wire rows (conduit runs only) */}
          {isConduit && (
            <Panel title="Wire">
              <div style={{ display:"grid", gridTemplateColumns:"90px 1fr 120px", gap:8, marginBottom:6 }}>
                {["# Wires","Wire Type","Size"].map(h=><div key={h} style={colHdr}>{h}</div>)}
              </div>
              {([0,1] as const).map(wi=>(
                <div key={wi} style={{ display:"grid", gridTemplateColumns:"90px 1fr 120px", gap:8, marginBottom:6 }}>
                  <input type="number" min={0} max={12} value={row.wires[wi].numWires||""} placeholder="0"
                    onChange={e=>updateWire(wi,"numWires",parseInt(e.target.value)||0)}
                    style={{...inp,fontFamily:"var(--font-mono)",textAlign:"right"}} />
                  <select style={sel} defaultValue="THHN - Copper Stranded" disabled>
                    <option>THHN - Copper Stranded</option>
                  </select>
                  <select value={row.wires[wi].wireSize} onChange={e=>updateWire(wi,"wireSize",e.target.value)} style={sel}>
                    {WIRE_SIZES_THHN.map(s=><option key={s}>{s}</option>)}
                  </select>
                </div>
              ))}
            </Panel>
          )}

          {/* Termination panel (conduit only) */}
          {isConduit && (
            <Panel title="Termination">
              <Field label="Termination Type">
                <select value={row.termType} onChange={e=>update("termType",e.target.value as TermType)} style={sel}>
                  <option value="LT Straight (both)">LT Straight Connectors (both ends)</option>
                  <option value="LT 90D + Straight">LT 90D + LT Straight Connector</option>
                  <option value="Steel 2-Screw (both)">Steel 2-Screw Flex Conn (both ends)</option>
                  <option value="None">None</option>
                </select>
              </Field>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginTop:8 }}>
                <Field label="Wire Termination Labor — Row 1">
                  <select value={row.wireTerm1} onChange={e=>update("wireTerm1",e.target.value)} style={sel}>
                    {WIRE_TERM.map(w=><option key={w.range} value={w.range}>{w.range} Wire Termination Labor</option>)}
                  </select>
                </Field>
                <Field label="Wire Termination Labor — Row 2">
                  <select value={row.wireTerm2} onChange={e=>update("wireTerm2",e.target.value)} style={sel}>
                    {WIRE_TERM.map(w=><option key={w.range} value={w.range}>{w.range} Wire Termination Labor</option>)}
                  </select>
                </Field>
              </div>
            </Panel>
          )}

          {/* Disconnect panel */}
          <Panel title="Disconnect Switch">
            <Field label="Quick Select (grouped by NEMA / Voltage / Type)">
              <select value={row.discSearch} onChange={e=>{update("discSearch",e.target.value);setDiscSearch("");setDiscResults([]);}} style={sel}>
                <option value="">— No Disconnect —</option>
                {DISC_GROUPS.map(g=>(
                  <optgroup key={g.group} label={g.group}>
                    {g.items.map(desc=><option key={desc} value={desc}>{desc}</option>)}
                  </optgroup>
                ))}
              </select>
            </Field>
            <div style={{ marginTop:8, position:"relative" }}>
              <Field label="Or Search Full Catalog">
                <div style={{ position:"relative" }}>
                  <Search size={12} style={{ position:"absolute", left:8, top:"50%", transform:"translateY(-50%)", color:"var(--text-muted)", pointerEvents:"none" }} />
                  <input value={discSearch} onChange={e=>setDiscSearch(e.target.value)}
                    placeholder="Search disconnect / safety switch…"
                    style={{...inp,paddingLeft:26}} />
                </div>
              </Field>
              {(discLoading||discResults.length>0) && (
                <div style={{ position:"absolute", top:"100%", left:0, right:0, background:"white", border:"1px solid var(--border-strong)", borderRadius:"var(--r-md)", boxShadow:"var(--shadow-md)", zIndex:100, maxHeight:180, overflow:"auto" }}>
                  {discLoading && <div style={{ padding:"8px 12px", fontSize:12, color:"var(--text-muted)" }}>Searching…</div>}
                  {discResults.map(a=>(
                    <div key={a.id} onClick={()=>{update("discSearch",a.description);setDiscSearch("");setDiscResults([]);}}
                      style={{ padding:"7px 12px", cursor:"pointer", fontSize:12, borderBottom:"1px solid var(--border)" }}
                      onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background="var(--bg-raised)"}
                      onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background="white"}>
                      <div style={{ fontWeight:500 }}>{a.description}</div>
                      <div style={{ fontSize:10, color:"var(--text-muted)" }}>#{a.item_number} · {a.unit_price?`$${a.unit_price.toFixed(2)}`:"Quote"}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {row.discSearch && (
              <div style={{ marginTop:6, fontSize:11, color:"var(--accent)", fontWeight:600 }}>
                ✓ {row.discSearch}
                <button onClick={()=>update("discSearch","")} style={{ marginLeft:8, fontSize:10, background:"none", border:"none", color:"var(--red)", cursor:"pointer" }}>✕ Clear</button>
              </div>
            )}
          </Panel>

          {/* Length + Qty + Makeup */}
          <Panel title="Quantity & Length">
            <div style={{ display:"grid", gridTemplateColumns:"130px 80px 90px 100px 1fr", gap:10, alignItems:"end" }}>
              <Field label="Length Each (ft)">
                <input type="number" min={0} value={row.lengthEach||""} placeholder="0"
                  onChange={e=>update("lengthEach",parseFloat(e.target.value)||0)}
                  style={{...inp,fontFamily:"var(--font-mono)",textAlign:"right"}} />
              </Field>
              <Field label="Quantity">
                <input type="number" min={1} value={row.qty||""} placeholder="1"
                  onChange={e=>update("qty",parseInt(e.target.value)||1)}
                  style={{...inp,fontFamily:"var(--font-mono)",textAlign:"right"}} />
              </Field>
              {isConduit && (
                <>
                  <Field label="Wire Makeup %">
                    <input type="number" min={0} max={300} value={row.makupPct}
                      onChange={e=>update("makupPct",parseInt(e.target.value)||0)}
                      style={{...inp,fontFamily:"var(--font-mono)",textAlign:"right"}} />
                  </Field>
                  <div style={{ paddingBottom:2, fontSize:11, color:"var(--text-muted)", alignSelf:"flex-end" }}>
                    % added to wire length
                  </div>
                </>
              )}
            </div>
          </Panel>

          {/* Assembly preview */}
          {row.qty > 0 && row.designation.trim() && (
            <div style={{ padding:"10px 12px", background:"#f8fafc", border:"1px solid var(--border)", borderRadius:"var(--r-sm)", fontSize:11, color:"var(--text-secondary)" }}>
              <div style={{ fontWeight:700, color:"var(--text-primary)", marginBottom:4 }}>Assembly Preview — {row.designation}</div>
              <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
                {row.discSearch && <div>• Disconnect: {row.discSearch}</div>}
                {(isConduit||isCable) && row.lengthEach>0 && (
                  <div>• {isConduit?`${row.conduitSize} ${row.conduitType} — ${row.lengthEach * row.qty} ft total`:row.cableChoice+` — ${row.lengthEach * row.qty} ft total`}</div>
                )}
                {isConduit && row.termType!=="None" && row.lengthEach>0 && <div>• Termination: {row.termType} (×{row.qty} ea end)</div>}
                {isConduit && row.wires.filter(w=>w.numWires>0).map((w,i)=>(
                  <div key={i}>• {w.numWires} × {w.wireSize} THHN — {Math.ceil(row.lengthEach*(1+row.makupPct/100))*w.numWires*row.qty} ft total</div>
                ))}
                {isConduit && row.wires.filter(w=>w.numWires>0).length>0 && (
                  <div>• Wire termination labor — both ends</div>
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          <Field label="Notes">
            <input value={row.notes} onChange={e=>update("notes",e.target.value)} placeholder="Optional…" style={inp} />
          </Field>
        </div>
      </div>
    </TakeoffShell>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ border:"1px solid var(--border-strong)", borderRadius:"var(--r-sm)", overflow:"hidden" }}>
      <div style={{ padding:"5px 10px", background:"#dce8f0", borderBottom:"1px solid var(--border-strong)", fontSize:11, fontWeight:700, color:"#2a4a6a", textTransform:"uppercase", letterSpacing:"0.04em" }}>{title}</div>
      <div style={{ padding:"10px 12px" }}>{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize:10, fontWeight:700, color:"var(--text-secondary)", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:4 }}>{label}</div>
      {children}
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const inp: React.CSSProperties = {
  padding:"6px 8px", border:"1px solid var(--border-strong)",
  borderRadius:"var(--r-sm)", fontSize:12, fontFamily:"var(--font-body)",
  background:"white", color:"var(--text-primary)", width:"100%",
};
const sel: React.CSSProperties = { ...inp, cursor:"pointer" };
const colHdr: React.CSSProperties = {
  fontSize:10, fontWeight:700, textTransform:"uppercase" as const,
  letterSpacing:"0.06em", color:"#2a4a6a",
};
