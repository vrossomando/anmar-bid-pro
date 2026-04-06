import { useState, useEffect } from "react";
import { Search } from "lucide-react";
import TakeoffShell, { FormTabs, FormRow, formInp, formNumInp, formSelect } from "./TakeoffShell";
import { searchAssemblies, type Assembly } from "../../hooks/db";
import type { TakeoffLineItem } from "../../hooks/takeoffCalculations";
import { v4 as uuidv4 } from "uuid";
import type { SectionBreakdown } from "../SectionBreakdownModal";

// Gear type categories — used to filter catalog search
const GEAR_TYPES = [
  "Panelboard",
  "Main Switchboard",
  "Transformer",
  "Safety Switch / Disconnect",
  "Circuit Breaker",
  "Motor Starter",
  "Motor Control Center",
  "Transfer Switch",
  "Generator",
  "UPS",
  "Meter / CT Cabinet",
  "Grounding Bushing",
  "Other Gear",
];

const VOLTAGES = [
  "120/208 Volt",
  "120/240 Volt",
  "277/480 Volt",
  "480 Volt",
  "240 Volt",
  "208 Volt",
  "600 Volt",
  "Other",
];

const PHASE_WIRE = [
  "1 Phase / 2 Wire",
  "1 Phase / 3 Wire",
  "3 Phase / 3 Wire",
  "3 Phase / 4 Wire",
];

const MAIN_TYPES = [
  "Main Lugs Only",
  "Main Circuit Breaker",
  "Main Fusible Switch",
  "No Main",
];

// Map gear type → catalog search keyword
const GEAR_SEARCH: Record<string, string> = {
  "Panelboard":              "Panelboard",
  "Main Switchboard":        "Switchboard",
  "Transformer":             "KVA",
  "Safety Switch / Disconnect": "Safety Sw",
  "Circuit Breaker":         "Circuit Breaker",
  "Motor Starter":           "Starter",
  "Motor Control Center":    "MCC",
  "Transfer Switch":         "Transfer Switch",
  "Generator":               "Generator",
  "UPS":                     "UPS",
  "Meter / CT Cabinet":      "Meter",
  "Grounding Bushing":       "Grounding Bushing",
  "Other Gear":              "",
};

interface Props {
  projectId: string;
  defaultLaborRate: number;
  sectionBreakdown: SectionBreakdown;
  onCommit: (items: TakeoffLineItem[]) => void;
  onClose: () => void;
}

export default function GearTakeoffForm({
  projectId, defaultLaborRate, sectionBreakdown, onCommit, onClose,
}: Props) {
  const [tab,           setTab]          = useState("Main");
  const [isQuote,       setIsQuote]       = useState(false);
  const [designation,   setDesignation]  = useState("");
  const [gearType,      setGearType]     = useState(GEAR_TYPES[0]);
  const [selectedItem,  setSelectedItem] = useState<Assembly | null>(null);
  const [searchQuery,   setSearchQuery]  = useState("");
  const [searchResults, setSearchResults] = useState<Assembly[]>([]);
  const [searching,     setSearching]    = useState(false);
  const [numSections,   setNumSections]  = useState(1);
  const [voltage,       setVoltage]      = useState(VOLTAGES[0]);
  const [phaseWire,     setPhaseWire]    = useState(PHASE_WIRE[2]);
  const [typeOfMain,    setTypeOfMain]   = useState(MAIN_TYPES[0]);
  const [hasMeter,      setHasMeter]     = useState(false);
  const [hasUGPS,       setHasUGPS]      = useState(false);
  const [factoryAssm,   setFactoryAssm]  = useState(false);
  const [quantity,      setQuantity]     = useState(1);
  const [notes,         setNotes]        = useState("");
  const [laborFactor,   setLaborFactor]  = useState(0);
  const [materialFactor, setMaterialFactor] = useState(0);

  // Auto-search when gear type changes
  useEffect(() => {
    const keyword = GEAR_SEARCH[gearType] ?? gearType;
    if (!keyword) { setSearchResults([]); return; }
    setSearching(true);
    setSelectedItem(null);
    searchAssemblies(keyword, "Gear", 80)
      .then(results => {
        const withPrice = results.filter(r => r.unit_price !== null);
        setSearchResults(withPrice.length > 0 ? withPrice : results.slice(0, 40));
      })
      .catch(console.error)
      .finally(() => setSearching(false));
  }, [gearType]);

  // Manual keyword search
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const results = await searchAssemblies(searchQuery, "Gear", 80);
      setSearchResults(results.filter(r => r.unit_price !== null));
    } finally { setSearching(false); }
  };

  const handleTakeoff = () => {
    if (quantity <= 0) return;
    const lf = 1 + laborFactor / 100;
    const mf = 1 + materialFactor / 100;

    const desc = [
      designation && `[${designation}]`,
      selectedItem?.description ?? gearType,
      numSections > 1 && `${numSections} Sections`,
      voltage,
      phaseWire,
      typeOfMain,
      hasMeter && "w/Meter",
      hasUGPS && "w/UGPS",
      factoryAssm && "Factory Assembled",
    ].filter(Boolean).join(" ");

    const category = `Gear | ${sectionBreakdown.section} | ${sectionBreakdown.breakdown}`;
    const item: TakeoffLineItem = {
      id: uuidv4(), project_id: projectId, category,
      description: desc, qty: quantity, unit: "E",
      unit_cost: isQuote ? 0 : (selectedItem?.unit_price ?? 0) * mf,
      markup_pct: 0,
      labor_hours: ((selectedItem?.labor_2 ?? selectedItem?.labor_1 ?? 0) * lf),
      labor_unit: selectedItem?.labor_unit ?? "E",
      labor_rate: defaultLaborRate,
      assembly_id: selectedItem?.id ?? null,
      sort_order: Date.now(),
    };

    const extraItems: TakeoffLineItem[] = [];
    // Notes line if present
    if (notes) {
      extraItems.push({ ...item, id: uuidv4(), description: `  Note: ${notes}`, unit_cost: 0, labor_hours: 0, sort_order: Date.now() + 1 });
    }
    onCommit([item, ...extraItems]);
    setDesignation("");
    setQuantity(0);
    setNotes("");
  };

  const fmt = (n: number | null | undefined) =>
    n != null ? `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—";

  return (
    <TakeoffShell
      title="Gear Takeoff"
      quoteMode={isQuote}
      onQuoteModeChange={setIsQuote}
      subtitle={selectedItem ? selectedItem.description : "Select gear type and item from catalog"}
      laborFactor={laborFactor} materialFactor={materialFactor}
      onLaborFactorChange={setLaborFactor} onMaterialFactorChange={setMaterialFactor}
      onTakeoff={handleTakeoff} onClose={onClose}
      takeoffDisabled={quantity <= 0} width={780}
    >
      <FormTabs tabs={["Main", "Other Quoted Items", "Notes", "Reminders", "Additional Items"]} active={tab} onChange={setTab} />

      {tab === "Main" && (
        <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
          <SectionInfo sb={sectionBreakdown} />

          {/* Designation + Type */}
          <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", gap: 12 }}>
            <FormRow label="Designation">
              <input value={designation} onChange={e => setDesignation(e.target.value)} placeholder="e.g. MDP, PP-1" style={formInp} />
            </FormRow>
            <FormRow label="Type">
              <select value={gearType} onChange={e => setGearType(e.target.value)} style={formSelect}>
                {GEAR_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </FormRow>
          </div>

          {/* Catalog search + results */}
          <FormRow label="Item from Catalog" span={2}>
            <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
              <div style={{ position: "relative", flex: 1 }}>
                <Search size={13} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSearch()}
                  placeholder="Search catalog…"
                  style={{ ...formInp, paddingLeft: 28 }} />
              </div>
              <button onClick={handleSearch} style={{ background: "var(--accent)", color: "white", border: "none", borderRadius: "var(--r-sm)", padding: "0 14px", cursor: "pointer", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>
                {searching ? "…" : "Search"}
              </button>
            </div>
            {/* Results list */}
            <div style={{ maxHeight: 180, overflow: "auto", border: "1px solid var(--border-strong)", borderRadius: "var(--r-md)", background: "white" }}>
              {searching && <div style={{ padding: "10px 12px", fontSize: 12, color: "var(--text-muted)" }}>Searching…</div>}
              {!searching && searchResults.length === 0 && <div style={{ padding: "10px 12px", fontSize: 12, color: "var(--text-muted)" }}>No results — try a search above</div>}
              {searchResults.map((item, idx) => (
                <button key={item.id} onClick={() => setSelectedItem(item)}
                  style={{
                    width: "100%", background: selectedItem?.id === item.id ? "var(--accent-light)" : idx % 2 === 0 ? "white" : "#f8fafc",
                    border: "none", borderBottom: "1px solid #e8f0f8",
                    borderLeft: selectedItem?.id === item.id ? "3px solid var(--accent)" : "3px solid transparent",
                    cursor: "pointer", padding: "7px 12px", textAlign: "left",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    transition: "background var(--t-fast)",
                  }}
                  onMouseEnter={e => { if (selectedItem?.id !== item.id) e.currentTarget.style.background = "#e8f2fa"; }}
                  onMouseLeave={e => { if (selectedItem?.id !== item.id) e.currentTarget.style.background = idx % 2 === 0 ? "white" : "#f8fafc"; }}
                >
                  <span style={{ fontSize: 12, color: "var(--text-primary)", fontWeight: selectedItem?.id === item.id ? 600 : 400 }}>{item.description}</span>
                  <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--accent)", flexShrink: 0, marginLeft: 12 }}>{fmt(item.unit_price)} {item.price_unit}</span>
                </button>
              ))}
            </div>
            {selectedItem && (
              <div style={{ marginTop: 6, padding: "6px 10px", background: "var(--accent-light)", border: "1px solid var(--accent)", borderRadius: "var(--r-sm)", fontSize: 11 }}>
                <span style={{ color: "var(--accent)", fontWeight: 700 }}>Selected: </span>
                <span style={{ color: "var(--text-primary)" }}>{selectedItem.description}</span>
                <span style={{ color: "var(--text-muted)", marginLeft: 10 }}>{fmt(selectedItem.unit_price)} · {selectedItem.labor_2 ?? selectedItem.labor_1 ?? 0} labor hrs</span>
              </div>
            )}
          </FormRow>

          {/* # of Sections + Voltage + Phase */}
          <div style={{ display: "grid", gridTemplateColumns: "110px 180px 1fr", gap: 12 }}>
            <FormRow label="# of Sections">
              <input type="number" value={numSections} min={1} onChange={e => setNumSections(parseInt(e.target.value) || 1)} style={formNumInp} />
            </FormRow>
            <FormRow label="Voltage">
              <select value={voltage} onChange={e => setVoltage(e.target.value)} style={formSelect}>
                {VOLTAGES.map(v => <option key={v}>{v}</option>)}
              </select>
            </FormRow>
            <FormRow label="Phase / Wire">
              <select value={phaseWire} onChange={e => setPhaseWire(e.target.value)} style={formSelect}>
                {PHASE_WIRE.map(p => <option key={p}>{p}</option>)}
              </select>
            </FormRow>
          </div>

          {/* Type of Main */}
          <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 12 }}>
            <FormRow label="Type of Main">
              <select value={typeOfMain} onChange={e => setTypeOfMain(e.target.value)} style={formSelect}>
                {MAIN_TYPES.map(m => <option key={m}>{m}</option>)}
              </select>
            </FormRow>
            <FormRow label="Quantity">
              <input type="number" value={quantity} min={1} onChange={e => setQuantity(parseInt(e.target.value) || 1)} style={{ ...formNumInp, fontSize: 15, fontWeight: 700 }} />
            </FormRow>
          </div>

          {/* Checkboxes */}
          <div style={{ display: "flex", gap: 24, paddingTop: 4 }}>
            {[["Meter", hasMeter, setHasMeter], ["UGPS", hasUGPS, setHasUGPS], ["Factory Assembled", factoryAssm, setFactoryAssm]].map(([label, val, setter]) => (
              <label key={label as string} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13, color: "var(--text-primary)" }}>
                <input type="checkbox" checked={val as boolean} onChange={e => (setter as (v: boolean) => void)(e.target.checked)}
                  style={{ accentColor: "var(--accent)", width: 14, height: 14 }} />
                {label as string}
              </label>
            ))}
          </div>

          {/* Notes */}
          <FormRow label="Notes">
            <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Verify AIC rating, coordinate with utility" style={formInp} />
          </FormRow>
        </div>
      )}

      {tab === "Other Quoted Items" && (
        <div style={{ padding: "14px 18px" }}>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 12 }}>
            Add quoted items associated with this gear section (breakers, disconnects, accessories, etc.)
          </div>
          <div style={{ color: "var(--text-muted)", fontSize: 12 }}>— Use Browse Catalog in the estimate to add breakers and accessories —</div>
        </div>
      )}

      {tab === "Notes" && (
        <div style={{ padding: "14px 18px" }}>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes for this gear item…"
            style={{ width: "100%", height: 160, resize: "vertical", background: "var(--bg-surface)", border: "1px solid var(--border-strong)", borderRadius: "var(--r-md)", color: "var(--text-primary)", fontSize: 13, padding: 10, fontFamily: "var(--font-body)" }} />
        </div>
      )}

      {tab === "Reminders" && (
        <div style={{ padding: "14px 18px" }}>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 10 }}>Common items to verify:</div>
          {[
            "Confirm AIC (Ampere Interrupting Capacity) rating",
            "Verify NEMA enclosure type (1, 3R, 4, 12)",
            "Confirm bus ampacity and future breaker spaces",
            "Verify main breaker ampacity matches feeder",
            "Check for metering requirements with utility",
            "Confirm grounding and bonding requirements",
            "Verify clearance space requirements per NEC",
          ].map((r, i) => (
            <label key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: "1px solid var(--border)", cursor: "pointer" }}>
              <input type="checkbox" style={{ width: "auto", accentColor: "var(--accent)" }} />
              <span style={{ fontSize: 13, color: "var(--text-primary)" }}>{r}</span>
            </label>
          ))}
        </div>
      )}

      {tab === "Additional Items" && (
        <div style={{ padding: "14px 18px" }}>
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            Use Browse Catalog in the estimate to add additional items (breakers, lugs, accessories).
          </div>
        </div>
      )}
    </TakeoffShell>
  );
}

function SectionInfo({ sb }: { sb: SectionBreakdown }) {
  return (
    <div style={{ display: "flex", gap: 16, fontSize: 11, paddingBottom: 8, borderBottom: "1px solid var(--border)" }}>
      {[["Section", sb.section], ["Breakdown", sb.breakdown], ["Division", sb.division], ["Drawing", sb.drawingRef]].map(([k, v]) => (
        <div key={k}><span style={{ fontWeight: 700, color: "var(--text-muted)" }}>{k}: </span><span style={{ color: "var(--text-primary)" }}>{v}</span></div>
      ))}
    </div>
  );
}
