import { useState, useEffect, useRef } from "react";
import { Search } from "lucide-react";
import TakeoffShell from "./TakeoffShell";
import type { TakeoffLineItem } from "../../hooks/takeoffCalculations";
import { searchAssemblies, type Assembly } from "../../hooks/db";
import { getLaborRate, getTHPrice } from "../../hooks/laborRates";
import { v4 as uuidv4 } from "uuid";
import type { SectionBreakdown } from "../SectionBreakdownModal";

// ── Category chip definitions ─────────────────────────────────────────────
// Each chip has a label and keywords used to filter the catalog search results

const CHIPS: { label: string; keywords: string[] }[] = [
  { label: "All",                  keywords: [] },
  { label: "Wire Connectors",      keywords: ["crimp","lug","splice","wire nut","wirenut","scotchlok","terminal","tap connector"] },
  { label: "Conduit Fittings",     keywords: ["coupling","bushing","nipple","elbow","fitting","weatherhead","expansion","ell","lb body","ll body","lr body","mall cond"] },
  { label: "Boxes & Covers",       keywords: ["box","cover","enclosure","j-box","junction","pull box","wireway","trough","gutter"] },
  { label: "Junction Boxes & Terminal Cans", keywords: ["nema 4","nema 12","nema 3r","wall-mount enclosure","pushbutton enclosure","j-box type","service rated tap","terminal can","hinged cover","stainless steel enclosure","steel gray"] },
  { label: "Hangers & Supports",   keywords: ["hanger","strap","clamp","unistrut","channel","bridle ring","beam clamp","anchor","pipe strap","conduit support"] },
  { label: "Grounding",            keywords: ["ground","grounding","ground rod","ground bar","weld conn","exothermic","bonding"] },
  { label: "MC Cable",             keywords: ["mc cable","mc feeder","armored cable","bx cable"] },
  { label: "Fiber & Data",         keywords: ["fiber","duplex","patch cord","pigtail","multimode","singlemode","lc","sc connector","st connector"] },
  { label: "Transformers",         keywords: ["transformer","xfmr","dry type","buck boost"] },
  { label: "Tape & Sealants",      keywords: ["tape","sealant","duct seal","putty","mastic","caulk","de-ox"] },
  { label: "Occupancy Sensors",    keywords: ["occupancy","sensor","motion","pir","dual tech","room controller"] },
  { label: "Strut & Framing",      keywords: ["strut","unistrut","framing","strut fitting","p1000","p2000","slotted"] },
  { label: "High Voltage",         keywords: ["kv","loadbreak","deadbreak","splice kit","termination kit","separable","elbow"] },
  { label: "Fasteners & Hardware", keywords: ["nail","screw","bolt","anchor","toggle","washer","nut","rivet","stud"] },
  { label: "Core Drill",           keywords: ["core drill","core drilling","drill"] },
  { label: "Roofing / Flashing",   keywords: ["flashing","roof","weathertight","pitch pocket"] },
];

const SEARCH_TERMS_ALL = [
  "connector","lug","splice","coupling","bushing","fitting","box","cover",
  "strap","hanger","clamp","ground","mc cable","fiber","transformer",
  "tape","sensor","strut","channel","anchor","screw","bolt","elbow",
  "weatherhead","nipple","bushing","core drill","flashing",
];

interface ItemRow { assembly: Assembly; qty: number; }

interface Props {
  projectId: string;
  defaultLaborRate: number;
  sectionBreakdown: SectionBreakdown;
  onCommit: (items: TakeoffLineItem[]) => void;
  onClose: () => void;
}

export default function MiscTakeoffForm({
  projectId, defaultLaborRate, sectionBreakdown, onCommit, onClose,
}: Props) {
  const [allItems,      setAllItems]      = useState<Assembly[]>([]);
  const [rows,          setRows]          = useState<ItemRow[]>([]);
  const [isQuote,       setIsQuote]       = useState(false);
  const [searchQuery,   setSearchQuery]   = useState("");
  const [activeChip,    setActiveChip]    = useState("All");
  const [loading,       setLoading]       = useState(true);
  const [laborFactor,   setLaborFactor]   = useState(0);
  const [materialFactor,setMaterialFactor]= useState(0);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initial load — fetch a broad set of misc items
  useEffect(() => {
    setLoading(true);
    Promise.all(
      SEARCH_TERMS_ALL.map(term =>
        searchAssemblies(term, "Miscellaneous Items", 30).catch(() => [])
      )
    ).then(results => {
      const seen = new Map<number, Assembly>();
      for (const batch of results) {
        for (const a of batch) {
          if (!seen.has(a.id)) seen.set(a.id, a);
        }
      }
      setAllItems(Array.from(seen.values()).sort((a, b) => a.description.localeCompare(b.description)));
      setLoading(false);
    });
  }, []);

  // Live search
  useEffect(() => {
    if (!searchQuery.trim()) return;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      searchAssemblies(searchQuery.trim(), "Miscellaneous Items", 80)
        .then(results => {
          setAllItems(prev => {
            const seen = new Map(prev.map(a => [a.id, a]));
            for (const a of results) if (!seen.has(a.id)) seen.set(a.id, a);
            return Array.from(seen.values()).sort((a, b) => a.description.localeCompare(b.description));
          });
        });
    }, 300);
  }, [searchQuery]);

  // Filter displayed items based on active chip + search query
  const displayed = allItems.filter(a => {
    const desc = a.description.toLowerCase();
    const matchesSearch = !searchQuery.trim() || desc.includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (activeChip === "All") return true;
    const chip = CHIPS.find(c => c.label === activeChip);
    if (!chip) return true;
    return chip.keywords.some(kw => desc.includes(kw.toLowerCase()));
  });

  const toggleRow = (assembly: Assembly) => {
    setRows(prev => {
      const exists = prev.find(r => r.assembly.id === assembly.id);
      if (exists) return prev.filter(r => r.assembly.id !== assembly.id);
      return [...prev, { assembly, qty: 1 }];
    });
  };

  const setQty = (assemblyId: number, qty: number) =>
    setRows(prev => prev.map(r => r.assembly.id === assemblyId ? { ...r, qty } : r));

  const handleTakeoff = () => {
    const valid = rows.filter(r => r.qty > 0);
    if (!valid.length) return;
    const category = `Miscellaneous Items | ${sectionBreakdown.section} | ${sectionBreakdown.breakdown}`;
    const lf = 1 + laborFactor / 100;
    const mf = 1 + materialFactor / 100;
    let sort = Date.now();
    const items: TakeoffLineItem[] = valid.map(r => {
      const a = r.assembly;
      const realLabor = getLaborRate(a.description);
      const thPrice   = getTHPrice(a.description);
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
      title="Miscellaneous Items Takeoff"
      subtitle={selectedCount > 0 ? `${selectedCount} item${selectedCount !== 1 ? "s" : ""} selected` : "Browse catalog or search"}
      laborFactor={laborFactor} materialFactor={materialFactor}
      onLaborFactorChange={setLaborFactor} onMaterialFactorChange={setMaterialFactor}
      onTakeoff={handleTakeoff} onClose={onClose}
      takeoffDisabled={selectedCount === 0} width={860}
      quoteMode={isQuote} onQuoteModeChange={setIsQuote}
    >
      {/* Search bar */}
      <div style={{ padding: "10px 16px", background: "var(--bg-surface)", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
        <div style={{ position: "relative" }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search all miscellaneous items…"
            style={{ width: "100%", padding: "7px 10px 7px 32px", border: "1px solid var(--border-strong)", borderRadius: "var(--r-md)", fontSize: 13, fontFamily: "var(--font-body)", background: "white", color: "var(--text-primary)" }}
            autoFocus
          />
        </div>
      </div>

      {/* Category chips */}
      <div style={{ padding: "8px 16px", borderBottom: "1px solid var(--border)", background: "var(--bg-surface)", display: "flex", flexWrap: "wrap", gap: 6, flexShrink: 0 }}>
        {CHIPS.map(chip => (
          <button key={chip.label} onClick={() => setActiveChip(chip.label)}
            style={{ padding: "4px 12px", borderRadius: 99, fontSize: 11, fontWeight: activeChip === chip.label ? 700 : 500, cursor: "pointer", border: `1px solid ${activeChip === chip.label ? "var(--accent)" : "var(--border-strong)"}`, background: activeChip === chip.label ? "var(--accent)" : "var(--bg-raised)", color: activeChip === chip.label ? "white" : "var(--text-secondary)", whiteSpace: "nowrap" }}>
            {chip.label}
          </button>
        ))}
      </div>

      {/* Two-panel layout: catalog left, selected right */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* Left: catalog list */}
        <div style={{ flex: 1, overflow: "auto", borderRight: "2px solid var(--border-strong)" }}>
          {loading && (
            <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>Loading catalog…</div>
          )}
          {!loading && displayed.length === 0 && (
            <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>No items match. Try a different search or category.</div>
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
                  <div style={{ fontSize: 12, fontWeight: selected ? 600 : 400, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {a.description}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 1 }}>
                    {a.unit_price ? `$${a.unit_price.toFixed(2)} / ${a.price_unit}` : "Price TBD"}
                    {a.labor_2 || a.labor_1 ? ` · ${(a.labor_2 ?? a.labor_1 ?? 0).toFixed(3)} labor hrs` : ""}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: selected items with qty */}
        <div style={{ width: 280, flexShrink: 0, display: "flex", flexDirection: "column", background: "var(--bg-surface)" }}>
          <div style={{ padding: "8px 14px", background: "#dce8f0", borderBottom: "1px solid var(--border-strong)", fontSize: 11, fontWeight: 700, color: "#1a3a6a", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Selected ({selectedCount})
          </div>
          <div style={{ flex: 1, overflow: "auto" }}>
            {rows.length === 0 && (
              <div style={{ padding: 20, fontSize: 11, color: "var(--text-muted)", textAlign: "center" }}>
                Click items on the left to add them
              </div>
            )}
            {rows.map(r => (
              <div key={r.assembly.id} style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1, fontSize: 11, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.assembly.description}
                </div>
                <input type="number" value={r.qty || ""} min={0} placeholder="0"
                  onChange={e => setQty(r.assembly.id, parseFloat(e.target.value) || 0)}
                  onClick={e => e.stopPropagation()}
                  style={{ width: 56, padding: "3px 6px", border: "1px solid var(--border-strong)", borderRadius: "var(--r-sm)", fontSize: 12, textAlign: "right", fontFamily: "var(--font-mono)" }}
                />
                <span style={{ fontSize: 10, color: "var(--text-muted)", minWidth: 20 }}>
                  {r.assembly.price_unit ?? "E"}
                </span>
                <button onClick={() => toggleRow(r.assembly)}
                  style={{ background: "none", border: "none", color: "var(--red)", cursor: "pointer", fontSize: 14, padding: "0 2px", lineHeight: 1 }}>
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </TakeoffShell>
  );
}
