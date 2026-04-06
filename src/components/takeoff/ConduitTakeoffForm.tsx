import { useState, useEffect } from "react";
import { Plus, Trash2 } from "lucide-react";
import TakeoffShell, { FormTabs, FormRow, formInp, formNumInp, formSelect } from "./TakeoffShell";
import { calculateConduitTakeoff, type WireRow, type ConduitInputs } from "../../hooks/takeoffCalculations";
import { searchAssemblies, type Assembly } from "../../hooks/db";
import { LABOR_RATES, TH_PRICING } from "../../hooks/laborRates";
import type { TakeoffLineItem } from "../../hooks/takeoffCalculations";
import type { SectionBreakdown } from "../SectionBreakdownModal";

const CONDUIT_SIZES = ["1/2\"","3/4\"","1\"","1-1/4\"","1-1/2\"","2\"","2-1/2\"","3\"","3-1/2\"","4\""];
const CONDUIT_TYPES = ["EMT","PVC","GRC","IMC","FMC","LFMC"];
const DIFFICULTIES  = ["Standard","Difficult","Exposed / Open","Concealed / Tight"];
const WIRE_TYPES    = ["THHN - Copper Stranded","THHN - Aluminum Stranded","XHHW - Copper","XHHW - Aluminum","RHW","USE-2","Pull Line"];
const WIRE_SIZES    = ["#14","#12","#10","#8","#6","#4","#3","#2","#1","1/0","2/0","3/0","4/0","250","350","500","750","1000"];

interface Props {
  projectId: string;
  defaultMarkup: number;
  defaultLaborRate: number;
  sectionBreakdown?: SectionBreakdown;
  livePricing?: Record<string, number>;
  onCommit: (items: TakeoffLineItem[]) => void;
  onClose: () => void;
}

const emptyWire = (): WireRow => ({ numWires: 1, wireDescription: "THHN - Copper Stranded", wireSize: "#12", unitCost: 0, laborPer1000ft: 0, assemblyId: null, makeupLength: 0 });

export default function ConduitTakeoffForm({ projectId, defaultMarkup, defaultLaborRate, livePricing = {}, onCommit, onClose }: Props) {
  const [tab, setTab]           = useState("Fittings");
  const [size, setSize]         = useState("3/4\"");
  const [type, setType]         = useState("EMT");
  const [difficulty, setDiff]   = useState("Standard");
  const [length, setLength]     = useState(0);
  const [runs, setRuns]         = useState(1);
  const [elbows, setElbows]     = useState(0);
  const [wires, setWires]       = useState<WireRow[]>([emptyWire()]);
  const [laborFactor, setLaborFactor]       = useState(0);
  const [materialFactor, setMaterialFactor] = useState(0);

  // Catalog assemblies for this conduit size/type
  const [conduitAsm, setConduitAsm]       = useState<Assembly | null>(null);
  const [couplingAsm, setCouplingAsm]     = useState<Assembly | null>(null);
  const [supportAsm, setSupportAsm]       = useState<Assembly | null>(null);
  const [terminationAsm, setTerminationAsm] = useState<Assembly | null>(null);
  const [elbowAsm, setElbowAsm]           = useState<Assembly | null>(null);
  const [couplingSpacing, setCouplingSpacing] = useState(10);
  const [supportSpacing,  setSupportSpacing]  = useState(8);
  const [terminationsPerRun, setTermPerRun]   = useState(2);
  const [otherItems, setOtherItems]           = useState<{description:string;qty:number;unitCost:number;laborHrs:number}[]>([]);
  const [fromLabel,  setFromLabel]  = useState("");
  const [toLabel,    setToLabel]    = useState("");
  const [numConduits, setNumConduits] = useState(1);

  // Auto-load catalog items when size or type changes
  useEffect(() => {
    // Keep the inch mark so searches match catalog entries like '3/4" EMT'
    const lookup = async () => {
      // Conduit — use T&H pricing if available, otherwise search catalog
      const thKey = `${size} ${type}`;
      const thPrice = livePricing[thKey] ?? TH_PRICING[thKey] ?? null;
      const conduits = await searchAssemblies(`${size} ${type}`, "Conduit / Wire Feeders", 10);
      let cond = conduits.find(a =>
        a.unit_price !== null && a.price_unit === "C" &&
        a.description === `${size} ${type}`
      ) ?? conduits.find(a =>
        a.unit_price !== null && a.price_unit === "C" &&
        !a.description.includes("(")
      ) ?? conduits.find(a => a.unit_price !== null && a.price_unit === "C")
        ?? conduits[0] ?? null;
      // Override with T&H pricing and real labor if available
      if (cond && thPrice) cond = { ...cond, unit_price: thPrice };
      const realLabor = LABOR_RATES[thKey];
      if (cond && realLabor) cond = { ...cond, labor_2: realLabor };
      setConduitAsm(cond);

      // Coupling
      const couplingQ = type === "EMT" ? `${size} Set Screw Steel Cplg` : `${size} ${type} Coupling`;
      const couplings = await searchAssemblies(couplingQ, "Conduit / Wire Feeders", 5);
      setCouplingAsm(couplings[0] ?? null);

      // Support (1-hole strap)
      const supports = await searchAssemblies(`${size} 1-Hole`, "Conduit / Wire Feeders", 5);
      setSupportAsm(supports[0] ?? null);

      // Termination (connector)
      const termQ = type === "EMT" ? `${size} Set Screw Steel Conn` : `${size} ${type} Conn`;
      const terms = await searchAssemblies(termQ, "Conduit / Wire Feeders", 5);
      setTerminationAsm(terms[0] ?? null);

      // Elbow — prefer a priced elbow over a field bend
      // 1/2" and 3/4" EMT have no catalog elbow — use a synthetic field bend with labor
      const ELBOW_LABOR: Record<string, [number, number]> = {
        "1/2\"":  [0.11, 0.13],
        "3/4\"":  [0.13, 0.15],
        "1\"":    [0.13, 0.15],
        "1-1/4\"": [0.19, 0.22],
        "1-1/2\"": [0.26, 0.30],
        "2\"":    [0.31, 0.35],
        "2-1/2\"": [0.44, 0.50],
        "3\"":    [0.53, 0.60],
        "3-1/2\"": [0.66, 0.75],
        "4\"":    [0.74, 0.85],
      };
      // Search for a priced elbow first
      const elbowHits = await searchAssemblies(`${size} ${type} Elbow`, "Conduit / Wire Feeders", 10);
      const pricedElbow = elbowHits.find(a =>
        a.unit_price != null && a.unit_price > 0 &&
        a.description.toLowerCase().includes("elbow")
      ) ?? null;

      if (pricedElbow) {
        setElbowAsm(pricedElbow);
      } else {
        // No priced elbow — try catalog field bend
        const fbHits = await searchAssemblies(`${size} ${type} Field Bend`, "Conduit / Wire Feeders", 5);
        if (fbHits.length > 0) {
          setElbowAsm(fbHits[0]);
        } else {
          // No catalog item — build a synthetic field bend with NECA labor
          const [l1, l2] = ELBOW_LABOR[size] ?? [0.15, 0.17];
          setElbowAsm({
            id: -1,
            item_number: "FIELD_BEND",
            description: `${size} ${type} Field Bend`,
            upc: "", cat_number: "",
            category: "Conduit / Wire Feeders",
            subcategory: "", discount: 0,
            unit_price: 0, price_unit: "E",
            price_is_quote: 0, price_is_open: 0, quote_ref: "",
            labor_1: l1, labor_2: l2,
            labor_3: null, labor_4: null, labor_5: null, labor_6: null,
            labor_unit: "E", phase: null, res_phase: null,
          } as unknown as Assembly);
        }
      }
    };
    lookup().catch(console.error);
  }, [size, type]);

  // Auto-lookup wire prices when wire type/size changes
  useEffect(() => {
    wires.forEach((wire, idx) => {
      if (wire.unitCost > 0) return; // already priced — don't overwrite
      const sizeClean = wire.wireSize.replace("#", "");
      const typeMap: Record<string, string> = {
        "THHN - Copper Stranded": `#${sizeClean} THHN CU Stranded Wire`,
        "THHN - Aluminum Stranded": `#${sizeClean} THHN AL Stranded Wire`,
        "XHHW - Copper": `#${sizeClean} XHHW CU`,
        "XHHW - Aluminum": `#${sizeClean} XHHW AL`,
        "RHW": `#${sizeClean} RHW`,
        "USE-2": `#${sizeClean} USE-2`,
        "Pull Line": "Pull Line",
      };
      const searchTerm = typeMap[wire.wireDescription] ?? `${wire.wireDescription} ${wire.wireSize}`;
      searchAssemblies(searchTerm, "Conduit / Wire Feeders", 10).then(results => {
        const match = results
          .filter(a => a.unit_price != null && a.unit_price > 0 && a.price_unit === "M")
          .sort((a, b) => (b.unit_price ?? 0) - (a.unit_price ?? 0))[0] ?? null;
        if (match) {
          setWires(prev => prev.map((w, i) => i === idx ? {
            ...w,
            unitCost: match.unit_price ?? 0,
            laborPer1000ft: match.labor_2 ?? match.labor_1 ?? 0,
            assemblyId: match.id ?? null,
          } : w));
        }
      });
    });
  }, [wires.map(w => w.wireDescription + w.wireSize).join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleWireChange = (idx: number, field: keyof WireRow, value: string | number) => {
    setWires(prev => prev.map((w, i) => i === idx
      // Reset price when type or size changes so auto-lookup refires
      ? { ...w, [field]: value, ...(field === "wireDescription" || field === "wireSize" ? { unitCost: 0, laborPer1000ft: 0, assemblyId: null } : {}) }
      : w
    ));
  };

  const addWireRow = () => setWires(prev => [...prev, emptyWire()]);
  const removeWireRow = (idx: number) => setWires(prev => prev.filter((_, i) => i !== idx));

  const handleTakeoff = () => {
    const totalRuns = runs * numConduits;
    const inputs: ConduitInputs = {
      projectId, conduitSize: size, conduitType: type, difficulty,
      overallLength: length, numRuns: totalRuns, numElbows: elbows * numConduits,
      fromLabel: fromLabel.trim() || undefined,
      toLabel: toLabel.trim() || undefined,
      elbowDescription: elbowAsm?.description ?? `${size} ${type} Elbow`,
      elbowUnitCost: elbowAsm?.unit_price ?? 0,
      elbowLaborHrs: elbowAsm?.labor_2 ?? elbowAsm?.labor_1 ?? 0,
      elbowAssemblyId: elbowAsm?.id ?? null,
      couplingDescription: couplingAsm?.description ?? `${size} ${type} Coupling`,
      couplingUnitCost: couplingAsm?.unit_price ?? 0,
      couplingLaborHrs: couplingAsm?.labor_2 ?? couplingAsm?.labor_1 ?? 0,
      couplingAssemblyId: couplingAsm?.id ?? null,
      couplingSpacingFt: couplingSpacing,
      supportDescription: supportAsm?.description ?? `${size} 1-Hole Strap`,
      supportUnitCost: supportAsm?.unit_price ?? 0,
      supportLaborHrs: supportAsm?.labor_2 ?? supportAsm?.labor_1 ?? 0,
      supportAssemblyId: supportAsm?.id ?? null,
      supportSpacingFt: supportSpacing,
      support2Description: "<None>",
      support2UnitCost: 0, support2LaborHrs: 0, support2AssemblyId: null, support2SpacingFt: 8,
      terminationDescription: terminationAsm?.description ?? `${size} ${type} Connector`,
      terminationUnitCost: terminationAsm?.unit_price ?? 0,
      terminationLaborHrs: terminationAsm?.labor_2 ?? terminationAsm?.labor_1 ?? 0,
      terminationAssemblyId: terminationAsm?.id ?? null,
      terminationsPerRun,
      conduitUnitCostPer100ft: conduitAsm?.unit_price ?? 0,
      conduitLaborHrsPer100ft: conduitAsm?.labor_2 ?? conduitAsm?.labor_1 ?? 0,
      conduitAssemblyId: conduitAsm?.id ?? null,
      wires, markupPct: defaultMarkup, laborRate: defaultLaborRate,
      laborFactorPct: laborFactor, materialFactorPct: materialFactor, otherItems,
    };
    const items = calculateConduitTakeoff(inputs);
    onCommit(items);
    // Reset so user sees the entry was committed
    setFromLabel("");
    setToLabel("");
    setLength(0);
  };

  const fmt = (n: number | null | undefined) =>
    n != null ? `$${n.toFixed(2)}` : "—";

  const totalFt = length * runs;

  return (
    <TakeoffShell
      title="Conduit / Wire Feeders Takeoff"
      subtitle={(() => {
        const label = [fromLabel, toLabel].filter(Boolean).join(" → ");
        const condLabel = numConduits > 1 ? `${numConduits} conduits` : "";
        const ftLabel = totalFt > 0 ? `${(totalFt * numConduits).toLocaleString()} total ft` : "";
        return [label, condLabel, ftLabel].filter(Boolean).join(" · ") || "Enter details below";
      })()}
      laborFactor={laborFactor} materialFactor={materialFactor}
      onLaborFactorChange={setLaborFactor} onMaterialFactorChange={setMaterialFactor}
      onTakeoff={handleTakeoff} onClose={onClose}
      takeoffDisabled={length <= 0} width={800}
    >
      {/* ── Top section ── */}
      <div style={{ padding: "14px 18px", background: "var(--bg-surface)", borderBottom: "1px solid var(--border)" }}>
        {/* From / To / Conduit count row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 90px", gap: 12, marginBottom: 10 }}>
          <FormRow label="From">
            <input
              value={fromLabel}
              onChange={e => setFromLabel(e.target.value)}
              placeholder="e.g. MDP, Panel A, Roof Unit..."
              style={formInp}
            />
          </FormRow>
          <FormRow label="To">
            <input
              value={toLabel}
              onChange={e => setToLabel(e.target.value)}
              placeholder="e.g. Panel B, AHU-1, MCB..."
              style={formInp}
            />
          </FormRow>
          <FormRow label="# Conduits">
            <input type="number" value={numConduits} min={1} max={99}
              onChange={e => setNumConduits(parseInt(e.target.value) || 1)}
              style={{ ...formNumInp, fontWeight: 700, fontSize: 15 }}
            />
          </FormRow>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "140px 180px 160px", gap: 12, marginBottom: 12 }}>
          <FormRow label="Conduit Size">
            <select value={size} onChange={e => setSize(e.target.value)} style={formSelect}>
              {CONDUIT_SIZES.map(s => <option key={s}>{s}</option>)}
            </select>
          </FormRow>
          <FormRow label="Type">
            <select value={type} onChange={e => setType(e.target.value)} style={formSelect}>
              {CONDUIT_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </FormRow>
          <FormRow label="Difficulty">
            <select value={difficulty} onChange={e => setDiff(e.target.value)} style={formSelect}>
              {DIFFICULTIES.map(d => <option key={d}>{d}</option>)}
            </select>
          </FormRow>
        </div>

        {/* Wire rows */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "60px 1fr 100px 75px 28px", gap: 8, marginBottom: 5 }}>
            <div style={colHdr}># Wires</div>
            <div style={colHdr}>Wire Type</div>
            <div style={colHdr}>Size</div>
            <div style={colHdr}>Makeup (ft)</div>
            <div />
          </div>
          {wires.map((w, idx) => (
            <div key={idx} style={{ display: "grid", gridTemplateColumns: "60px 1fr 100px 75px 28px", gap: 8, marginBottom: 5 }}>
              <input type="number" value={w.numWires} min={1} max={20}
                onChange={e => handleWireChange(idx, "numWires", parseInt(e.target.value) || 1)}
                style={{ ...formNumInp }} />
              <select value={w.wireDescription} onChange={e => handleWireChange(idx, "wireDescription", e.target.value)} style={formSelect}>
                {WIRE_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
              <select value={w.wireSize} onChange={e => handleWireChange(idx, "wireSize", e.target.value)} style={formSelect}>
                {WIRE_SIZES.map(s => <option key={s}>{s}</option>)}
              </select>
              <input type="number" value={w.makeupLength || ""} min={0} placeholder="0"
                onChange={e => handleWireChange(idx, "makeupLength", parseFloat(e.target.value) || 0)}
                style={{ ...formNumInp }} title="Extra makeup wire per wire per run (ft)" />
              <button onClick={() => removeWireRow(idx)} disabled={wires.length === 1}
                style={{ background: "none", border: "1px solid var(--border-strong)", borderRadius: "var(--r-sm)", cursor: "pointer", color: "var(--red)", padding: 0, display: "flex", alignItems: "center", justifyContent: "center", opacity: wires.length === 1 ? 0.3 : 1 }}>
                <Trash2 size={12} />
              </button>
            </div>
          ))}
          {wires.length < 6 && (
            <button onClick={addWireRow} style={{ background: "none", border: "1px dashed var(--border-strong)", borderRadius: "var(--r-sm)", color: "var(--text-muted)", padding: "4px 12px", cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", gap: 5, marginTop: 2 }}>
              <Plus size={11} /> Add Wire
            </button>
          )}
        </div>

        {/* Length / Runs / Elbows */}
        <div style={{ display: "grid", gridTemplateColumns: "130px 90px 90px 1fr", gap: 12, alignItems: "end" }}>
          <FormRow label="Overall Length (ft)">
            <input type="number" value={length || ""} min={0} onChange={e => setLength(parseFloat(e.target.value) || 0)} style={formNumInp} placeholder="0" />
          </FormRow>
          <FormRow label="# Runs">
            <input type="number" value={runs} min={1} onChange={e => setRuns(parseInt(e.target.value) || 1)} style={formNumInp} />
          </FormRow>
          <FormRow label="# Elbows">
            <input type="number" value={elbows} min={0} onChange={e => setElbows(parseInt(e.target.value) || 0)} style={formNumInp} />
          </FormRow>
          <div style={{ fontSize: 11, color: "var(--text-muted)", paddingBottom: 6 }}>
            {totalFt > 0 ? (
              <>
                <div>= {totalFt.toLocaleString()} ft/conduit</div>
                {numConduits > 1 && <div style={{ color: "var(--accent)", fontWeight: 600 }}>= {(totalFt * numConduits).toLocaleString()} ft total ({numConduits} conduits)</div>}
              </>
            ) : ""}
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <FormTabs
        tabs={["Fittings", "Other Items", "Wires (Summary)", "Notes"]}
        active={tab} onChange={setTab}
      />

      {/* ── Fittings tab ── */}
      {tab === "Fittings" && (
        <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
          <FittingRow
            label="Coupling"
            description={couplingAsm?.description ?? `${size} ${type} Coupling (auto)`}
            price={fmt(couplingAsm?.unit_price)}
            spacingLabel="# Couplings per"
            spacing={couplingSpacing}
            onSpacingChange={setCouplingSpacing}
          />
          <FittingRow
            label="Support"
            description={supportAsm?.description ?? `${size} 1-Hole Strap (auto)`}
            price={fmt(supportAsm?.unit_price)}
            spacingLabel="# Supports per"
            spacing={supportSpacing}
            onSpacingChange={setSupportSpacing}
          />
          <div style={{ display: "grid", gridTemplateColumns: "90px 1fr 120px 120px", gap: 10, alignItems: "center" }}>
            <span style={colHdr}>Terminations</span>
            <span style={{ fontSize: 12, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {terminationAsm?.description ?? `${size} ${type} Connector (auto)`}
            </span>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{fmt(terminationAsm?.unit_price)} ea</span>
            <FormRow label="# per run">
              <input type="number" value={terminationsPerRun} min={0} onChange={e => setTermPerRun(parseInt(e.target.value) || 0)} style={{ ...formNumInp, width: 70 }} />
            </FormRow>
          </div>
          <div style={{ marginTop: 6, padding: "8px 12px", background: "var(--accent-light)", borderRadius: "var(--r-md)", fontSize: 11, color: "var(--accent)" }}>
            Fittings are automatically selected from the catalog based on conduit size and type. Prices update when you change size or type.
          </div>
        </div>
      )}

      {/* ── Other Items tab ── */}
      {tab === "Other Items" && (
        <div style={{ padding: "14px 18px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 60px 80px 80px 28px", gap: 8, marginBottom: 6 }}>
            {["Description","Qty","Unit Cost","Labor Hrs",""].map(h => <div key={h} style={colHdr}>{h}</div>)}
          </div>
          {otherItems.map((o, idx) => (
            <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 60px 80px 80px 28px", gap: 8, marginBottom: 6 }}>
              <input value={o.description} onChange={e => setOtherItems(prev => prev.map((x, i) => i === idx ? { ...x, description: e.target.value } : x))} placeholder="Description" style={formInp} />
              <input type="number" value={o.qty} min={0} onChange={e => setOtherItems(prev => prev.map((x, i) => i === idx ? { ...x, qty: parseFloat(e.target.value) || 0 } : x))} style={formNumInp} />
              <input type="number" value={o.unitCost} min={0} step={0.01} onChange={e => setOtherItems(prev => prev.map((x, i) => i === idx ? { ...x, unitCost: parseFloat(e.target.value) || 0 } : x))} style={formNumInp} />
              <input type="number" value={o.laborHrs} min={0} step={0.01} onChange={e => setOtherItems(prev => prev.map((x, i) => i === idx ? { ...x, laborHrs: parseFloat(e.target.value) || 0 } : x))} style={formNumInp} />
              <button onClick={() => setOtherItems(prev => prev.filter((_, i) => i !== idx))} style={{ background: "none", border: "1px solid var(--border-strong)", borderRadius: "var(--r-sm)", color: "var(--red)", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><Trash2 size={12} /></button>
            </div>
          ))}
          <button onClick={() => setOtherItems(prev => [...prev, { description: "", qty: 1, unitCost: 0, laborHrs: 0 }])}
            style={{ background: "none", border: "1px dashed var(--border-strong)", borderRadius: "var(--r-sm)", color: "var(--text-muted)", padding: "5px 12px", cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", gap: 5, marginTop: 4 }}>
            <Plus size={11} /> Add Item
          </button>
        </div>
      )}

      {/* ── Wires Summary tab ── */}
      {tab === "Wires (Summary)" && (
        <div style={{ padding: "14px 18px" }}>
          {length <= 0 || runs <= 0 ? (
            <div style={{ color: "var(--text-muted)", fontSize: 12, padding: "20px 0", textAlign: "center" }}>
              Enter length and runs above to see wire quantities
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "var(--bg-surface)" }}>
                  {["Wire Type","Size","# Wires","Total Feet","/1000 ft"].map(h => (
                    <th key={h} style={{ padding: "7px 10px", textAlign: "left", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", borderBottom: "1px solid var(--border-strong)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {wires.filter(w => w.numWires > 0).map((w, idx) => {
                  const totalWireFt = length * runs * w.numWires;
                  return (
                    <tr key={idx} style={{ borderBottom: "1px solid var(--border)", background: idx % 2 === 1 ? "var(--bg-surface)" : "" }}>
                      <td style={{ padding: "7px 10px", color: "var(--text-primary)" }}>{w.wireDescription}</td>
                      <td style={{ padding: "7px 10px", fontFamily: "var(--font-mono)" }}>{w.wireSize}</td>
                      <td style={{ padding: "7px 10px", fontFamily: "var(--font-mono)", textAlign: "right" }}>{w.numWires}</td>
                      <td style={{ padding: "7px 10px", fontFamily: "var(--font-mono)", textAlign: "right" }}>{totalWireFt.toLocaleString()}</td>
                      <td style={{ padding: "7px 10px", fontFamily: "var(--font-mono)", textAlign: "right" }}>{(totalWireFt/1000).toFixed(3)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Notes tab ── */}
      {tab === "Notes" && (
        <div style={{ padding: "14px 18px" }}>
          <textarea placeholder="Notes for this conduit run…" style={{ width: "100%", height: 140, resize: "vertical", background: "var(--bg-surface)", border: "1px solid var(--border-strong)", borderRadius: "var(--r-md)", color: "var(--text-primary)", fontSize: 13, padding: 10, fontFamily: "var(--font-body)" }} />
        </div>
      )}
    </TakeoffShell>
  );
}

function FittingRow({ label, description, price, spacingLabel, spacing, onSpacingChange }: {
  label: string; description: string; price: string;
  spacingLabel: string; spacing: number; onSpacingChange: (v: number) => void;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "90px 1fr 80px 60px 60px", gap: 10, alignItems: "center" }}>
      <span style={colHdr}>{label}</span>
      <span style={{ fontSize: 12, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{description}</span>
      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{price} ea</span>
      <span style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>per</span>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <input type="number" value={spacing} min={1} onChange={e => onSpacingChange(parseFloat(e.target.value) || 1)}
          style={{ ...formNumInp, width: 52 }} />
        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>ft</span>
      </div>
    </div>
  );
}

const colHdr: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: "var(--text-muted)",
  textTransform: "uppercase", letterSpacing: "0.05em",
};
