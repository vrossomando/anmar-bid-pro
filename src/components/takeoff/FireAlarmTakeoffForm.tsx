import { useState, useEffect, useRef } from "react";
import { Search, X } from "lucide-react";
import TakeoffShell, { FormRow, formNumInp } from "./TakeoffShell";
import { searchAssemblies, listAssemblies, type Assembly } from "../../hooks/db";
import type { TakeoffLineItem } from "../../hooks/takeoffCalculations";
import { LABOR_RATES } from "../../hooks/laborRates";
import { v4 as uuidv4 } from "uuid";
import type { SectionBreakdown } from "../SectionBreakdownModal";

// Common fire alarm device types for quick filtering
const DEVICE_FILTERS = [
  "All",
  "Smoke Detector",
  "Heat Detector",
  "Pull Station",
  "Horn / Strobe",
  "Panel",
  "Duct Detector",
  "Annunciator",
  "Door Holder",
  "Transformer",
  "Bell",
  "Nurse Call",
];

interface Props {
  projectId: string;
  defaultLaborRate: number;
  sectionBreakdown: SectionBreakdown;
  onCommit: (items: TakeoffLineItem[]) => void;
  onClose: () => void;
}

interface ItemRow {
  assembly: Assembly;
  qty: number;
}

export default function FireAlarmTakeoffForm({
  projectId, defaultLaborRate, sectionBreakdown, onCommit, onClose,
}: Props) {
  const [allItems,      setAllItems]      = useState<Assembly[]>([]);
  const [isQuote,       setIsQuote]       = useState(false);
  const [rows,          setRows]          = useState<ItemRow[]>([]);
  const [searchQuery,   setSearchQuery]   = useState("");
  const [activeFilter,  setActiveFilter]  = useState("All");
  const [loading,       setLoading]       = useState(true);
  const [laborFactor,   setLaborFactor]   = useState(0);
  const [materialFactor, setMaterialFactor] = useState(0);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load items — start with priced items, then load all
  useEffect(() => {
    setLoading(true);
    listAssemblies("Fire Alarm", undefined, 500, 0)
      .then(items => {
        // Deduplicate by description (keep first with price if available)
        const seen = new Map<string, Assembly>();
        for (const a of items) {
          if (!seen.has(a.description) || (a.unit_price !== null && seen.get(a.description)!.unit_price === null)) {
            seen.set(a.description, a);
          }
        }
        // Filter out items that are clearly misclassified in the Fire Alarm category:
        // lighting fixtures, lamps, under-cabinet lights, and solar wire (USE-2)
        const FA_EXCLUDE = [
          "fluorescent", "led tape", " lamp ", "lamp (", "lamp twist",
          "under cabinet", "under-cabinet", "flush can light", "can light housing",
          "can light trim", "led recessed retrofit", "led disk trim",
          "type use-2", "type use ", "alum. type", "copper type use",
          "undercabinet", "vanity fixture",
        ];
        const deduped = Array.from(seen.values())
          .filter(a => {
            const dl = a.description.toLowerCase();
            return !FA_EXCLUDE.some(kw => dl.includes(kw));
          })
          .sort((a, b) => a.description.localeCompare(b.description));
        setAllItems(deduped);
        setRows(deduped.map(a => ({ assembly: a, qty: 0 })));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Debounced search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!searchQuery.trim() && activeFilter === "All") return;

    searchTimer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await searchAssemblies(searchQuery || activeFilter, "Fire Alarm", 300);
        const seen = new Map<string, Assembly>();
        for (const a of results) {
          if (!seen.has(a.description) || (a.unit_price !== null && seen.get(a.description)!.unit_price === null)) {
            seen.set(a.description, a);
          }
        }
        const deduped = Array.from(seen.values()).sort((a, b) => a.description.localeCompare(b.description));
        // Merge with existing rows to preserve qtys
        setRows(prev => {
          const qtyMap = new Map(prev.map(r => [r.assembly.id, r.qty]));
          return deduped.map(a => ({ assembly: a, qty: qtyMap.get(a.id) ?? 0 }));
        });
        setAllItems(deduped);
      } finally { setLoading(false); }
    }, 300);
  }, [searchQuery, activeFilter]);

  const setQty = (id: number, qty: number) => {
    setRows(prev => prev.map(r => r.assembly.id === id ? { ...r, qty } : r));
  };

  // Filter by device type
  const visibleRows = activeFilter === "All" && !searchQuery
    ? rows
    : rows.filter(r => {
        const desc = r.assembly.description.toLowerCase();
        const matchFilter = activeFilter === "All" || desc.includes(activeFilter.toLowerCase().replace(" / ", " ").split(" ")[0]);
        const matchSearch = !searchQuery || desc.includes(searchQuery.toLowerCase());
        return matchFilter && matchSearch;
      });

  const handleTakeoff = () => {
    const selected = rows.filter(r => r.qty > 0);
    if (selected.length === 0) return;
    const category = `Fire Alarm | ${sectionBreakdown.section} | ${sectionBreakdown.breakdown}`;
    const items: TakeoffLineItem[] = [];
    let sort = Date.now();
    for (const row of selected) {
      const a = row.assembly;
      const lf = 1 + laborFactor / 100;
      const mf = 1 + materialFactor / 100;
      items.push({
        id: uuidv4(), project_id: projectId, category,
        description: a.description,
        qty: row.qty, unit: a.price_unit ?? "E",
        unit_cost: isQuote ? 0 : (a.unit_price ?? 0) * mf,
        markup_pct: 0,
        labor_hours: (a.labor_2 ?? a.labor_1 ?? 0) * lf,
      labor_unit: a.labor_unit ?? "E",
        labor_rate: defaultLaborRate,
        assembly_id: a.id, sort_order: sort++,
      });
    }
    onCommit(items);
  };

  const selectedCount = rows.filter(r => r.qty > 0).length;

  return (
    <TakeoffShell
      title="Fire Alarm Takeoff"
      quoteMode={isQuote}
      onQuoteModeChange={setIsQuote}
      subtitle={selectedCount > 0 ? `${selectedCount} item type${selectedCount !== 1 ? "s" : ""} selected` : `${allItems.length} items — enter quantities`}
      laborFactor={laborFactor} materialFactor={materialFactor}
      onLaborFactorChange={setLaborFactor} onMaterialFactorChange={setMaterialFactor}
      onTakeoff={handleTakeoff} onClose={onClose}
      takeoffDisabled={selectedCount === 0} width={740}
    >
      {/* Search + filter bar */}
      <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--border)", background: "var(--bg-surface)", flexShrink: 0 }}>
        <SectionInfo sb={sectionBreakdown} />
        <div style={{ marginTop: 10, position: "relative" }}>
          <Search size={13} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search fire alarm items…"
            style={{ background: "var(--bg-raised)", border: "1px solid var(--border-strong)", borderRadius: "var(--r-md)", color: "var(--text-primary)", fontSize: 13, padding: "7px 30px 7px 28px", width: "100%" }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} style={{ position: "absolute", right: 7, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 2, display: "flex" }}>
              <X size={12} />
            </button>
          )}
        </div>
        {/* Device type quick filters */}
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 8 }}>
          {DEVICE_FILTERS.map(f => (
            <button key={f} onClick={() => { setActiveFilter(f); setSearchQuery(""); }}
              style={{
                background: activeFilter === f ? "var(--accent)" : "var(--bg-raised)",
                border: `1px solid ${activeFilter === f ? "var(--accent)" : "var(--border-strong)"}`,
                color: activeFilter === f ? "white" : "var(--text-secondary)",
                fontSize: 11, fontWeight: activeFilter === f ? 700 : 400,
                padding: "3px 10px", borderRadius: 99, cursor: "pointer",
                transition: "all var(--t-fast)",
              }}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Item list */}
      <div style={{ overflow: "auto", flex: 1 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 100px", gap: 8, padding: "7px 18px", background: "#dce8f0", borderBottom: "1px solid var(--border)", position: "sticky", top: 0 }}>
          <div style={colHdr}>Item Description ({visibleRows.length} shown)</div>
          <div style={{ ...colHdr, textAlign: "right" }}>Quantity</div>
        </div>

        {loading && (
          <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>Loading…</div>
        )}

        {!loading && visibleRows.length === 0 && (
          <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
            No items match — try a different filter or search term
          </div>
        )}

        {visibleRows.map((row, idx) => (
          <div
            key={row.assembly.id}
            style={{
              display: "grid", gridTemplateColumns: "1fr 100px", gap: 8,
              padding: "6px 18px", alignItems: "center",
              background: row.qty > 0 ? "var(--accent-light)" : idx % 2 === 0 ? "white" : "#f4f8fc",
              borderBottom: "1px solid #d0e0ec",
              borderLeft: row.qty > 0 ? "3px solid var(--accent)" : "3px solid transparent",
            }}
          >
            <div>
              <div style={{ fontSize: 12, color: "var(--text-primary)", fontWeight: row.qty > 0 ? 600 : 400 }}>
                {row.assembly.description}
              </div>
              {row.assembly.unit_price ? (
                <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                  ${row.assembly.unit_price.toFixed(2)} {row.assembly.price_unit}
                  &nbsp;·&nbsp;
                  {row.assembly.labor_2 ?? row.assembly.labor_1 ?? 0} labor hrs ea
                </div>
              ) : (
                <div style={{ fontSize: 10, color: "var(--amber)" }}>Price: enter in estimate</div>
              )}
            </div>
            <input type="number" value={row.qty || ""} min={0} placeholder="0"
              onChange={e => setQty(row.assembly.id, parseFloat(e.target.value) || 0)}
              style={{ ...formNumInp, width: "100%", background: "white", fontWeight: row.qty > 0 ? 700 : 400 }} />
          </div>
        ))}
      </div>

      {/* Selected summary */}
      {selectedCount > 0 && (
        <div style={{ padding: "8px 18px", background: "var(--accent-light)", borderTop: "1px solid var(--accent)", fontSize: 12, color: "var(--accent)", fontWeight: 600, flexShrink: 0 }}>
          {selectedCount} item type{selectedCount !== 1 ? "s" : ""} selected — click Takeoff to add to estimate
        </div>
      )}
    </TakeoffShell>
  );
}

function SectionInfo({ sb }: { sb: SectionBreakdown }) {
  return (
    <div style={{ display: "flex", gap: 16, fontSize: 11 }}>
      {[["Section", sb.section], ["Breakdown", sb.breakdown], ["Division", sb.division], ["Drawing", sb.drawingRef]].map(([k, v]) => (
        <div key={k}><span style={{ fontWeight: 700, color: "var(--text-muted)" }}>{k}: </span><span style={{ color: "var(--text-primary)" }}>{v}</span></div>
      ))}
    </div>
  );
}

const colHdr: React.CSSProperties = { fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#2a4a6a" };
