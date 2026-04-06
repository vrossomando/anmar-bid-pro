import { useState, useEffect } from "react";
import TakeoffShell, { FormTabs, FormRow, formNumInp, formSelect } from "./TakeoffShell";
import { calculateCableTakeoff, type CableInputs } from "../../hooks/takeoffCalculations";
import { searchAssemblies, type Assembly } from "../../hooks/db";
import { LABOR_RATES, TH_PRICING } from "../../hooks/laborRates";
import type { TakeoffLineItem } from "../../hooks/takeoffCalculations";
import type { SectionBreakdown } from "../SectionBreakdownModal";

// Each entry maps a user-friendly label to the exact catalog search term pattern.
// MC cable lives in "Conduit / Wire Feeders" → search without category filter.
// Format in catalog: "12/2 Aluminum Clad MC Cable Stranded"
const CABLE_CATEGORIES: { label: string; searchTerm: string; searchCategory?: string; hasConductors?: boolean }[] = [
  // MC Cable types (Image 1 & 2 from EBM)
  { label: "ACTHH Armored Cable (Standard BX)",        searchTerm: "Aluminum Clad MC Cable Stranded",  hasConductors: true },
  { label: "Aluminum Clad MC Cable Stranded",          searchTerm: "Aluminum Clad MC Cable Stranded",  hasConductors: true },
  { label: "Aluminum Clad MC Cable Solid",             searchTerm: "Aluminum Clad MC Cable Solid",     hasConductors: true },
  { label: "Aluminum Clad MC w/Double Ground",         searchTerm: "Aluminum Clad MC Cable Stranded",  hasConductors: true },
  { label: "Aluminum Clad MC/AP Cable Solid",          searchTerm: "Aluminum Clad MC Cable Solid",     hasConductors: true },
  { label: "Aluminum Clad MC/AP Cable Stranded",       searchTerm: "Aluminum Clad MC Cable Stranded",  hasConductors: true },
  { label: "Aluminum MC Feeder Cable",                 searchTerm: "Aluminum MC Feeder Cable",         hasConductors: true },
  { label: "Steel MC Cable w/Green Ground",            searchTerm: "Steel MC Cable",                   hasConductors: true },
  { label: "HCFC Armored Cable",                       searchTerm: "Aluminum Clad MC Cable Stranded",  hasConductors: true },
  { label: "Copper MC Feeder Cable",                   searchTerm: "Copper MC Feeder Cable",           hasConductors: true },
  // Non-Metallic / Romex
  { label: "Non-Metallic Cable (Romex NM-B)",          searchTerm: "Romex w/Ground",                   hasConductors: true },
  // SE / Service Entrance
  { label: "SE Cable (SER)",                           searchTerm: "Alum SE-SER Cable",                hasConductors: true },
  { label: "SE Cable (SEU)",                           searchTerm: "SEU",                              hasConductors: true },
  // Cord types
  { label: "SO/STO 600V Industrial Grade",             searchTerm: "SO 600",                           hasConductors: true },
  { label: "SO 600 Volt",                              searchTerm: "SO 600",                           hasConductors: true },
  { label: "SJ 300 Volt",                              searchTerm: "SJ 300",                           hasConductors: true },
  { label: "SJOOW 300 Volt",                           searchTerm: "SJOOW",                            hasConductors: true },
  { label: "SJTOW 300 Volt",                           searchTerm: "SJTOW",                            hasConductors: true },
  { label: "SOOW 600 Volt Cable",                      searchTerm: "SOOW",                             hasConductors: true },
  { label: "STO 600 Volt",                             searchTerm: "STO 600",                          hasConductors: true },
  // Low voltage / control
  { label: "Thermostat Cable",                         searchTerm: "Thermostat Wire", searchCategory: "Conduit / Wire Feeders", hasConductors: false },
  { label: "Telephone Twisted Pair Cable (3-Pair)",    searchTerm: "Twisted Pair",                     hasConductors: false },
  { label: "FPLR Shielded",                            searchTerm: "FPLR",                             hasConductors: false },
  { label: "FPLR Unshielded",                          searchTerm: "FPLR",                             hasConductors: false },
  { label: "Luminary Cable",                           searchTerm: "Luminary Cable", searchCategory: "Conduit / Wire Feeders", hasConductors: true },
  // Data
  { label: "Cat 5",                                    searchTerm: "Cat 5", searchCategory: "Cable",   hasConductors: false },
  { label: "Cat 5e",                                   searchTerm: "Cat 5e", searchCategory: "Cable",  hasConductors: false },
  { label: "Cat 6",                                    searchTerm: "Cat 6", searchCategory: "Cable",   hasConductors: false },
  { label: "Coax Cable (RG-6)",                        searchTerm: "Coaxial", searchCategory: "Cable", hasConductors: false },
  // URD & High voltage
  { label: "Aluminum URD (Direct Burial)",             searchTerm: "Aluminum URD",                     hasConductors: true },
  { label: "5KV/15KV Power Cable",                     searchTerm: "15KV", searchCategory: "Conduit / Wire Feeders", hasConductors: true },
  { label: "USE-2 (Solar/Direct Burial)",              searchTerm: "USE-2", searchCategory: "Conduit / Wire Feeders", hasConductors: false },
  { label: "Fire Alarm Cable",                         searchTerm: "Fire Alarm Cable",                 hasConductors: false },
];

// Gauges available — stripped of # for building catalog search
const GAUGES = ["#14","#12","#10","#8","#6","#4","#3","#2","#1","1/0","2/0","3/0","4/0","250","350","500"];
const CONDUCTOR_COUNTS = ["2","3","4"];

interface Props {
  projectId: string;
  defaultMarkup: number;
  defaultLaborRate: number;
  sectionBreakdown?: SectionBreakdown;
  livePricing?: Record<string, number>;
  onCommit: (items: TakeoffLineItem[]) => void;
  onClose: () => void;
}

export default function CableTakeoffForm({ projectId, defaultMarkup, defaultLaborRate, livePricing = {}, onCommit, onClose }: Props) {
  const [tab, setTab] = useState("Main");

  const [cableCatIdx,   setCableCatIdx]   = useState(0);
  const [gauge,         setGauge]         = useState("#12");
  const [conductors,    setConductors]    = useState("2");
  const [totalLength,   setTotalLength]   = useState(0);
  const [numRuns,       setNumRuns]       = useState(1);
  const [supportSpacing, setSupportSpacing] = useState(4);
  const [laborFactor,   setLaborFactor]   = useState(0);
  const [materialFactor, setMaterialFactor] = useState(0);
  const [notes, setNotes] = useState("");

  const [cableAsm,       setCableAsm]       = useState<Assembly | null>(null);
  const [supportAsm,     setSupportAsm]     = useState<Assembly | null>(null);
  const [terminationAsm, setTerminationAsm] = useState<Assembly | null>(null);
  const [searching,      setSearching]      = useState(false);

  useEffect(() => {
    const load = async () => {
      setSearching(true);
      setCableAsm(null);
      try {
        const cat = CABLE_CATEGORIES[cableCatIdx];
        const gNum = gauge.replace("#", ""); // "12" from "#12"

        // Build search: "12/2 Aluminum Clad MC Cable Stranded"
        const query = `${gNum}/${conductors} ${cat.searchTerm}`;

        // Search without category restriction — MC cable lives in "Conduit / Wire Feeders"
        const results = await searchAssemblies(query);
        let best = results.find(a => a.unit_price !== null && a.price_unit === "M")
          ?? results.find(a => a.unit_price !== null)
          ?? results[0]
          ?? null;
        // Apply T&H pricing if available
        if (best) {
          const thKey = `${gNum}/${conductors} ${cat.searchTerm.split(" ")[0]}`;
          const thPrice = Object.entries({ ...TH_PRICING, ...livePricing }).find(([k]) =>
            best!.description.toLowerCase().includes(k.toLowerCase())
          )?.[1];
          if (thPrice) best = { ...best, unit_price: thPrice };
          // Apply real labor
          const realLabor = Object.entries(LABOR_RATES).find(([k]) =>
            best!.description.toLowerCase().includes(k.toLowerCase())
          )?.[1];
          if (realLabor) best = { ...best, labor_2: realLabor };
        }
        setCableAsm(best);

        // Support strap — size based on gauge
        const bigGauges = ["#6","#4","#3","#2","#1","1/0","2/0","3/0","4/0","250","350","500"];
        const strapSize = bigGauges.includes(gauge) ? `3/4"` : `3/8"`;
        const supports = await searchAssemblies(`${strapSize} 1-Hole`, "Conduit / Wire Feeders", 5);
        setSupportAsm(supports[0] ?? null);

        // MC/BX termination connector
        const terms = await searchAssemblies("MC/BX Conn", "Conduit / Wire Feeders", 10);
        setTerminationAsm(terms[0] ?? null);
      } finally {
        setSearching(false);
      }
    };
    load().catch(console.error);
  }, [gauge, conductors, cableCatIdx]);

  const fmt = (n: number | null | undefined) =>
    n != null
      ? `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : "—";

  const totalFt = totalLength * numRuns;

  const handleTakeoff = () => {
    const cat = CABLE_CATEGORIES[cableCatIdx];
    const gNum = gauge.replace("#", "");
    const fallbackDesc = `${gNum}/${conductors} ${cat.searchTerm}`;

    const inputs: CableInputs = {
      projectId,
      numCables: 1,
      cableDescription:       cableAsm?.description ?? fallbackDesc,
      cableUnitCostPer1000ft: cableAsm?.unit_price  ?? 0,
      cableLaborHrsPer1000ft: cableAsm?.labor_2 ?? cableAsm?.labor_1 ?? 0,
      cableAssemblyId:        cableAsm?.id ?? null,
      totalLength,
      numRuns,
      supportDescription: supportAsm?.description ?? "Cable Support",
      supportUnitCost:    supportAsm?.unit_price  ?? 0,
      supportLaborHrs:    supportAsm?.labor_2 ?? supportAsm?.labor_1 ?? 0,
      supportAssemblyId:  supportAsm?.id ?? null,
      supportSpacingFt:   supportSpacing,
      support2Description: "<None>",
      support2UnitCost: 0, support2LaborHrs: 0,
      support2AssemblyId: null, support2SpacingFt: 4,
      terminationDescription: terminationAsm?.description ?? "MC/BX Connector",
      terminationUnitCost:    terminationAsm?.unit_price  ?? 0,
      terminationLaborHrs:    terminationAsm?.labor_2 ?? terminationAsm?.labor_1 ?? 0,
      terminationAssemblyId:  terminationAsm?.id ?? null,
      markupPct:        defaultMarkup,
      laborRate:        defaultLaborRate,
      laborFactorPct:   laborFactor,
      materialFactorPct: materialFactor,
      notes,
    };
    onCommit(calculateCableTakeoff(inputs));
    setTotalLength(0);
    setNumRuns(1);
  };

  return (
    <TakeoffShell
      title="Cable Takeoff"
      subtitle={totalFt > 0 ? `${totalFt.toLocaleString()} total feet` : "Enter length and runs below"}
      laborFactor={laborFactor} materialFactor={materialFactor}
      onLaborFactorChange={setLaborFactor} onMaterialFactorChange={setMaterialFactor}
      onTakeoff={handleTakeoff} onClose={onClose}
      takeoffDisabled={totalLength <= 0} width={660}
    >
      <FormTabs tabs={["Main","Notes"]} active={tab} onChange={setTab} />

      {tab === "Main" && (
        <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Cable type */}
          <FormRow label="Cable Type">
            <select value={cableCatIdx} onChange={e => setCableCatIdx(parseInt(e.target.value))} style={formSelect}>
              {CABLE_CATEGORIES.map((c, i) => (
                <option key={i} value={i}>{c.label}</option>
              ))}
            </select>
          </FormRow>

          {/* Gauge + Conductors */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <FormRow label="Gauge">
              <select value={gauge} onChange={e => setGauge(e.target.value)} style={formSelect}>
                {GAUGES.map(g => <option key={g}>{g}</option>)}
              </select>
            </FormRow>
            <FormRow label="# Conductors">
              <select value={conductors} onChange={e => setConductors(e.target.value)} style={formSelect}>
                {CONDUCTOR_COUNTS.map(c => (
                  <option key={c} value={c}>{c} Conductor</option>
                ))}
              </select>
            </FormRow>
          </div>

          {/* Catalog match */}
          <div style={{
            background: cableAsm ? "var(--accent-light)" : "var(--bg-surface)",
            border: `1px solid ${cableAsm ? "var(--accent)" : "var(--border)"}`,
            borderRadius: "var(--r-md)", padding: "11px 14px",
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", marginBottom: 5 }}>
              Matched from Catalog
            </div>
            {searching ? (
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Searching…</div>
            ) : cableAsm ? (
              <>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                  {cableAsm.description}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 3 }}>
                  {fmt(cableAsm.unit_price)} / 1,000 ft
                  &nbsp;·&nbsp;
                  {cableAsm.labor_2 ?? cableAsm.labor_1 ?? 0} labor hrs / 1,000 ft
                </div>
              </>
            ) : (
              <div style={{ fontSize: 12, color: "var(--red)" }}>
                No catalog match — prices will be $0. You can edit them in the estimate after takeoff.
              </div>
            )}
          </div>

          {/* Length + Runs */}
          <div style={{ display: "grid", gridTemplateColumns: "160px 110px 1fr", gap: 12, alignItems: "end" }}>
            <FormRow label="Total Length (ft)">
              <input
                type="number" value={totalLength || ""} min={0} placeholder="0"
                onChange={e => setTotalLength(parseFloat(e.target.value) || 0)}
                style={formNumInp}
              />
            </FormRow>
            <FormRow label="# Runs">
              <input
                type="number" value={numRuns} min={1}
                onChange={e => setNumRuns(parseInt(e.target.value) || 1)}
                style={formNumInp}
              />
            </FormRow>
            <div style={{ paddingBottom: 7, fontSize: 12, color: "var(--text-muted)" }}>
              {totalFt > 0 ? `= ${totalFt.toLocaleString()} total feet` : ""}
            </div>
          </div>

          {/* Support + Terminations */}
          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: "11px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", marginBottom: 8 }}>
              Support &amp; Terminations
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 130px", gap: 12, marginBottom: 10, alignItems: "end" }}>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>Support</div>
                <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>
                  {supportAsm?.description ?? "Searching…"}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>
                  {fmt(supportAsm?.unit_price)} ea
                </div>
              </div>
              <FormRow label="Spacing (ft)">
                <input
                  type="number" value={supportSpacing} min={1} step={0.5}
                  onChange={e => setSupportSpacing(parseFloat(e.target.value) || 1)}
                  style={formNumInp}
                />
              </FormRow>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>
                Terminations — 2 per run (one at each end)
              </div>
              <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>
                {terminationAsm?.description ?? "Searching…"}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>
                {fmt(terminationAsm?.unit_price)} ea
                &nbsp;·&nbsp;
                qty: {2 * numRuns}
              </div>
            </div>
          </div>

          {/* Preview */}
          {totalFt > 0 && (
            <div style={{ background: "var(--accent-light)", border: "1px solid var(--accent)", borderRadius: "var(--r-md)", padding: "10px 14px", fontSize: 12 }}>
              <div style={{ fontWeight: 700, color: "var(--accent)", marginBottom: 4 }}>Takeoff Preview</div>
              <div style={{ color: "var(--text-primary)", lineHeight: 1.8 }}>
                <div>Cable: {(totalFt / 1000).toFixed(3)} × 1,000 ft</div>
                <div>Supports: {Math.ceil(totalLength / supportSpacing) * numRuns} ea @ {supportSpacing} ft o.c.</div>
                <div>Terminations: {2 * numRuns} ea</div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "Notes" && (
        <div style={{ padding: "16px 18px" }}>
          <textarea
            value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Notes for this cable run…"
            style={{ width: "100%", height: 160, resize: "vertical", background: "var(--bg-surface)", border: "1px solid var(--border-strong)", borderRadius: "var(--r-md)", color: "var(--text-primary)", fontSize: 13, padding: 10, fontFamily: "var(--font-body)" }}
          />
        </div>
      )}
    </TakeoffShell>
  );
}
