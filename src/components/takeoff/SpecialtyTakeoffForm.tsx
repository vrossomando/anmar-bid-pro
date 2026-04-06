import { useState, useEffect, useRef } from "react";
import { Search } from "lucide-react";
import TakeoffShell from "./TakeoffShell";
import type { TakeoffLineItem } from "../../hooks/takeoffCalculations";
import { searchAssemblies, type Assembly } from "../../hooks/db";
import { getLaborRate, getTHPrice } from "../../hooks/laborRates";
import { v4 as uuidv4 } from "uuid";
import type { SectionBreakdown } from "../SectionBreakdownModal";

// ── Specialty categories — each maps to search terms across Misc + Gear ───

const SPECIALTY_CATS: { label: string; icon: string; keywords: string[]; dbCats: string[]; quoteDefault: boolean }[] = [
  {
    label: "Demolition",
    icon: "🔨",
    keywords: ["demo ", "demolit", "remove", "demo light", "demo panel", "demo disconnect",
                "demo wiring", "demo poke", "demo wiremold", "demo motor", "demo switchgear",
                "demo chiller", "demo fa panel", "demo metering", "demo elevator"],
    dbCats: ["Miscellaneous Items", "Gear"],
    quoteDefault: false,
  },
  {
    label: "Explosion Proof",
    icon: "⚡",
    keywords: ["explosion proof", "hazardous loc", "hazard loc", "class i", "class ii",
                "division 1", "division 2", "nema 7", "nema 9", "ex proof", "xp "],
    dbCats: ["Miscellaneous Items", "Gear", "Conduit / Wire Feeders"],
    quoteDefault: true,
  },
  {
    label: "High Voltage",
    icon: "🔌",
    keywords: ["kv ", " kv", "loadbreak", "deadbreak", "switchgear", "recloser",
                "sectionalizer", "splice kit", "termination kit", "fault interrupter",
                "vacuum circuit", "oil switch", "sf6", "capacitor", "voltage regulator"],
    dbCats: ["Miscellaneous Items", "Gear"],
    quoteDefault: true,
  },
  {
    label: "Lightning Protection",
    icon: "⛈️",
    keywords: ["lightning", "surge arrest", "lightning rod", "air terminal",
                "grounding conductor", "down conductor", "lightning protection",
                "strike termination", "bonding connector", "ground ring"],
    dbCats: ["Miscellaneous Items", "Conduit / Wire Feeders"],
    quoteDefault: true,
  },
  {
    label: "Pole Line",
    icon: "🏗️",
    keywords: ["pole line", "crossarm", "guy wire", "pole hardware", "strain insulator",
                "service wire holder", "pipe mounting wire holder", "pole platform",
                "guy hardware", "galvanized strand"],
    dbCats: ["Miscellaneous Items"],
    quoteDefault: true,
  },
  {
    label: "Wire Termination Labor",
    icon: "🔧",
    keywords: ["wire termination labor", "termination labor"],
    dbCats: ["Conduit / Wire Feeders"],
    quoteDefault: false,
  },
  {
    label: "Voice & Data",
    icon: "📡",
    keywords: ["cat 5", "cat 6", "cat5", "cat6", "patch panel", "patch cord", "faceplate",
                "data jack", "modular jack", "keystone", "cable tray", "raceway",
                "structured cabling", "premise wiring", "krone", "belden", "data outlet"],
    dbCats: ["Cable", "Miscellaneous Items"],
    quoteDefault: true,
  },
  {
    label: "Motor Control Accessories",
    icon: "⚙️",
    keywords: ["motor control accessor", "contactor", "overload relay", "control transformer",
                "starter accessory", "aux contact", "push button", "pilot light", "selector switch"],
    dbCats: ["Gear", "Miscellaneous Items"],
    quoteDefault: false,
  },
  {
    label: "EV Charging",
    icon: "🔋",
    keywords: ["electric vehicle", "ev charger", "evse", "charging station", "level 2 charger"],
    dbCats: ["Miscellaneous Items"],
    quoteDefault: true,
  },
];

// Static EVSE items (not yet in catalog DB — sourced from EBM_2026.mdb)
const EVSE_STATIC = [
  { id: -26595, description: "30 Amp 2 Pole Wall Mount EV Charger",       price_unit: "E", unit_price: null, labor_1: null, labor_2: null, category: "Miscellaneous Items", item_number: "26595", upc: "", cat_number: "", subcategory: "Electric Vehicle", discount: 0, phase: 0 },
  { id: -26596, description: "40 Amp 2 Pole Wall Mount EV Charger",       price_unit: "E", unit_price: null, labor_1: null, labor_2: null, category: "Miscellaneous Items", item_number: "26596", upc: "", cat_number: "", subcategory: "Electric Vehicle", discount: 0, phase: 0 },
  { id: -26597, description: "70 Amp 2 Pole Wall Mount EV Charger",       price_unit: "E", unit_price: null, labor_1: null, labor_2: null, category: "Miscellaneous Items", item_number: "26597", upc: "", cat_number: "", subcategory: "Electric Vehicle", discount: 0, phase: 0 },
  { id: -26598, description: "30 Amp 2 Pole Ceiling Mount EV Charger",    price_unit: "E", unit_price: null, labor_1: null, labor_2: null, category: "Miscellaneous Items", item_number: "26598", upc: "", cat_number: "", subcategory: "Electric Vehicle", discount: 0, phase: 0 },
  { id: -26599, description: "40 Amp 2 Pole Ceiling Mount EV Charger",    price_unit: "E", unit_price: null, labor_1: null, labor_2: null, category: "Miscellaneous Items", item_number: "26599", upc: "", cat_number: "", subcategory: "Electric Vehicle", discount: 0, phase: 0 },
  { id: -26600, description: "30 Amp 2 Pole Single Pedestal EV Charger",  price_unit: "E", unit_price: null, labor_1: null, labor_2: null, category: "Miscellaneous Items", item_number: "26600", upc: "", cat_number: "", subcategory: "Electric Vehicle", discount: 0, phase: 0 },
  { id: -26601, description: "30 Amp 2 Pole Dual Pedestal EV Charger",    price_unit: "E", unit_price: null, labor_1: null, labor_2: null, category: "Miscellaneous Items", item_number: "26601", upc: "", cat_number: "", subcategory: "Electric Vehicle", discount: 0, phase: 0 },
] as import("../../hooks/db").Assembly[];

interface ItemRow { assembly: Assembly; qty: number; }

interface Props {
  projectId: string;
  defaultLaborRate: number;
  sectionBreakdown: SectionBreakdown;
  onCommit: (items: TakeoffLineItem[]) => void;
  onClose: () => void;
}

export default function SpecialtyTakeoffForm({
  projectId, defaultLaborRate, sectionBreakdown, onCommit, onClose,
}: Props) {
  const [activeCat,     setActiveCat]     = useState(SPECIALTY_CATS[0]);
  const [allItems,      setAllItems]      = useState<Assembly[]>([]);
  const [rows,          setRows]          = useState<ItemRow[]>([]);
  const [isQuote,       setIsQuote]       = useState(SPECIALTY_CATS[0].quoteDefault);
  const [searchQuery,   setSearchQuery]   = useState("");
  const [loading,       setLoading]       = useState(false);
  const [laborFactor,   setLaborFactor]   = useState(0);
  const [materialFactor,setMaterialFactor]= useState(0);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load items when category changes
  useEffect(() => {
    setLoading(true);
    setAllItems([]);
    setSearchQuery("");
    setIsQuote(activeCat.quoteDefault);

    Promise.all(
      activeCat.keywords.flatMap(kw =>
        activeCat.dbCats.map(cat =>
          searchAssemblies(kw, cat, 40).catch(() => [] as Assembly[])
        )
      )
    ).then(batches => {
      const seen = new Map<number, Assembly>();
      // Inject static EVSE items for EV Charging category
      if (activeCat.label === "EV Charging") {
        for (const a of EVSE_STATIC) seen.set(a.id, a);
      }
      for (const batch of batches) {
        for (const a of batch) if (!seen.has(a.id)) seen.set(a.id, a);
      }
      const sorted = Array.from(seen.values()).sort((a, b) => a.description.localeCompare(b.description));
      setAllItems(sorted);
      setLoading(false);
    });
  }, [activeCat]);

  // Live search within current category
  useEffect(() => {
    if (!searchQuery.trim()) return;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      Promise.all(
        activeCat.dbCats.map(cat =>
          searchAssemblies(searchQuery.trim(), cat, 60).catch(() => [] as Assembly[])
        )
      ).then(batches => {
        setAllItems(prev => {
          const seen = new Map(prev.map(a => [a.id, a]));
          for (const batch of batches) for (const a of batch) if (!seen.has(a.id)) seen.set(a.id, a);
          return Array.from(seen.values()).sort((a, b) => a.description.localeCompare(b.description));
        });
      });
    }, 300);
  }, [searchQuery, activeCat]);

  const displayed = allItems.filter(a => {
    if (!searchQuery.trim()) return true;
    return a.description.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const toggleRow = (assembly: Assembly) => {
    setRows(prev => {
      const exists = prev.find(r => r.assembly.id === assembly.id);
      if (exists) return prev.filter(r => r.assembly.id !== assembly.id);
      return [...prev, { assembly, qty: 1 }];
    });
  };

  const setQty = (id: number, qty: number) =>
    setRows(prev => prev.map(r => r.assembly.id === id ? { ...r, qty } : r));

  const handleTakeoff = () => {
    const valid = rows.filter(r => r.qty > 0);
    if (!valid.length) return;
    const category = `${activeCat.label} | ${sectionBreakdown.section} | ${sectionBreakdown.breakdown}`;
    const lf = 1 + laborFactor / 100;
    const mf = 1 + materialFactor / 100;
    let sort = Date.now();
    const items: TakeoffLineItem[] = valid.map(r => {
      const a = r.assembly;
      const realLabor = getLaborRate(a.description);
      const thPrice = getTHPrice(a.description);
      const unitMap: Record<string, string> = { E: "E", C: "C", M: "M", L: "LF" };
      return {
        id: uuidv4(), project_id: projectId, category,
        description: a.description,
        qty: r.qty,
        unit: unitMap[a.price_unit ?? "E"] ?? "E",
        unit_cost: isQuote ? 0 : (thPrice ?? a.unit_price ?? 0) * mf,
        markup_pct: 0,
        labor_hours: (realLabor ?? a.labor_2 ?? a.labor_1 ?? 0) * lf,
      labor_unit: a.labor_unit ?? "E",
        labor_rate: defaultLaborRate,
        assembly_id: a.id, sort_order: sort++,
      };
    });
    onCommit(items);
  };

  const selectedCount = rows.filter(r => r.qty > 0).length;

  return (
    <TakeoffShell
      title="Specialty Items Takeoff"
      subtitle={selectedCount > 0 ? `${selectedCount} item${selectedCount !== 1 ? "s" : ""} selected` : `${activeCat.icon} ${activeCat.label}`}
      laborFactor={laborFactor} materialFactor={materialFactor}
      onLaborFactorChange={setLaborFactor} onMaterialFactorChange={setMaterialFactor}
      onTakeoff={handleTakeoff} onClose={onClose}
      takeoffDisabled={selectedCount === 0} width={920}
      quoteMode={isQuote} onQuoteModeChange={setIsQuote}
    >
      {/* Category tabs */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, padding: "8px 14px", borderBottom: "1px solid var(--border)", background: "var(--bg-surface)", flexShrink: 0 }}>
        {SPECIALTY_CATS.map(cat => (
          <button key={cat.label} onClick={() => { setActiveCat(cat); setRows([]); }}
            style={{ padding: "5px 12px", borderRadius: "var(--r-md)", fontSize: 12, fontWeight: activeCat.label === cat.label ? 700 : 500, cursor: "pointer", border: `1px solid ${activeCat.label === cat.label ? "var(--accent)" : "var(--border-strong)"}`, background: activeCat.label === cat.label ? "var(--accent)" : "var(--bg-raised)", color: activeCat.label === cat.label ? "white" : "var(--text-secondary)", whiteSpace: "nowrap" }}>
            {cat.icon} {cat.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div style={{ padding: "8px 14px", background: "var(--bg-surface)", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
        <div style={{ position: "relative" }}>
          <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder={`Search ${activeCat.label} items…`}
            style={{ width: "100%", padding: "6px 10px 6px 30px", border: "1px solid var(--border-strong)", borderRadius: "var(--r-md)", fontSize: 12, fontFamily: "var(--font-body)", background: "white" }} />
        </div>
      </div>

      {/* Two-panel */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Catalog */}
        <div style={{ flex: 1, overflow: "auto", borderRight: "2px solid var(--border-strong)" }}>
          {loading && <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>Loading {activeCat.label} items…</div>}
          {!loading && displayed.length === 0 && (
            <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
              No items found. Try a different search term.
            </div>
          )}
          {displayed.map(a => {
            const selected = rows.some(r => r.assembly.id === a.id);
            return (
              <div key={a.id} onClick={() => toggleRow(a)}
                style={{ padding: "8px 14px", borderBottom: "1px solid var(--border)", cursor: "pointer", background: selected ? "var(--accent-light)" : "white", display: "flex", alignItems: "center", gap: 10 }}
                onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLDivElement).style.background = "#f0f6ff"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = selected ? "var(--accent-light)" : "white"; }}
              >
                <input type="checkbox" checked={selected} onChange={() => {}} onClick={e => e.stopPropagation()}
                  style={{ width: 14, height: 14, accentColor: "var(--accent)", flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: selected ? 600 : 400, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.description}</div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 1 }}>
                    {a.unit_price ? `$${a.unit_price.toFixed(2)} / ${a.price_unit}` : "Price TBD"}
                    {(a.labor_2 ?? a.labor_1) ? ` · ${(a.labor_2 ?? a.labor_1 ?? 0).toFixed(3)} labor hrs` : ""}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected */}
        <div style={{ width: 280, flexShrink: 0, display: "flex", flexDirection: "column", background: "var(--bg-surface)" }}>
          <div style={{ padding: "8px 14px", background: "#dce8f0", borderBottom: "1px solid var(--border-strong)", fontSize: 11, fontWeight: 700, color: "#1a3a6a", textTransform: "uppercase" }}>
            Selected ({selectedCount})
          </div>
          <div style={{ flex: 1, overflow: "auto" }}>
            {rows.length === 0 && <div style={{ padding: 20, fontSize: 11, color: "var(--text-muted)", textAlign: "center" }}>Click items on the left to add them</div>}
            {rows.map(r => (
              <div key={r.assembly.id} style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1, fontSize: 11, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.assembly.description}</div>
                <input type="number" value={r.qty || ""} min={0} placeholder="0"
                  onChange={e => setQty(r.assembly.id, parseFloat(e.target.value) || 0)}
                  onClick={e => e.stopPropagation()}
                  style={{ width: 56, padding: "3px 6px", border: "1px solid var(--border-strong)", borderRadius: "var(--r-sm)", fontSize: 12, textAlign: "right", fontFamily: "var(--font-mono)" }} />
                <span style={{ fontSize: 10, color: "var(--text-muted)", minWidth: 20 }}>{r.assembly.price_unit ?? "E"}</span>
                <button onClick={() => toggleRow(r.assembly)} style={{ background: "none", border: "none", color: "var(--red)", cursor: "pointer", fontSize: 14, padding: "0 2px" }}>×</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </TakeoffShell>
  );
}
