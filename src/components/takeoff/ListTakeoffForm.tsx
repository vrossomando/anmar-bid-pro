// ListTakeoffForm.tsx
// Generic reusable component for Fire Alarm, Security, Lighting Control,
// Temporary Power, and Supports style takeoff forms.
// All share the same layout: scrollable list with qty field, search, filter chips.

import { useState, useEffect, useRef } from "react";
import { Search, X } from "lucide-react";
import TakeoffShell, { formNumInp } from "./TakeoffShell";
import { searchAssemblies, listAssemblies, type Assembly } from "../../hooks/db";
import type { TakeoffLineItem } from "../../hooks/takeoffCalculations";
import { LABOR_RATES } from "../../hooks/laborRates";
import { v4 as uuidv4 } from "uuid";
import type { SectionBreakdown } from "../SectionBreakdownModal";

export interface ListFormConfig {
  title: string;
  categoryLabel: string;        // label shown on audit trail
  dbCategory: string;           // category to query in assemblies table
  dbCategoryAlt?: string;       // optional second category
  searchTerms: string[];        // broad search terms to load items
  filterChips: string[];        // quick filter buttons (first must be "All")
  filterMap?: Record<string, string>; // chip label → search term override
  searchPlaceholder: string;
  width?: number;
}

interface Props {
  projectId: string;
  defaultLaborRate: number;
  sectionBreakdown: SectionBreakdown;
  config: ListFormConfig;
  onCommit: (items: TakeoffLineItem[]) => void;
  onClose: () => void;
}

interface ItemRow { assembly: Assembly; qty: number; }

function dedupe(items: Assembly[]): Assembly[] {
  const seen = new Map<string, Assembly>();
  for (const a of items) {
    if (!seen.has(a.description) ||
        (a.unit_price !== null && seen.get(a.description)!.unit_price === null)) {
      seen.set(a.description, a);
    }
  }
  return Array.from(seen.values()).sort((a, b) => a.description.localeCompare(b.description));
}

export default function ListTakeoffForm({
  projectId, defaultLaborRate, sectionBreakdown, config, onCommit, onClose,
}: Props) {
  const [allItems,       setAllItems]       = useState<Assembly[]>([]);
  const [rows,           setRows]           = useState<ItemRow[]>([]);
  const [isQuote,        setIsQuote]        = useState(false);
  const [searchQuery,    setSearchQuery]    = useState("");
  const [activeFilter,   setActiveFilter]   = useState("All");
  const [loading,        setLoading]        = useState(true);
  const [laborFactor,    setLaborFactor]    = useState(0);
  const [materialFactor, setMaterialFactor] = useState(0);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initial load
  useEffect(() => {
    setLoading(true);
    const loadItems = async () => {
      let items: Assembly[] = [];
      if (config.searchTerms.length > 0 && config.dbCategory) {
        // Use searchAssemblies for each search term, then merge
        const results = await Promise.all(
          config.searchTerms.map(term =>
            searchAssemblies(term, config.dbCategory, 200)
          )
        );
        const all = results.flat();
        // Also search alt category if provided
        if (config.dbCategoryAlt) {
          const altResults = await Promise.all(
            config.searchTerms.map(term =>
              searchAssemblies(term, config.dbCategoryAlt!, 200)
            )
          );
          all.push(...altResults.flat());
        }
        items = dedupe(all);
      } else {
        items = dedupe(await listAssemblies(config.dbCategory, undefined, 600, 0));
      }
      setAllItems(items);
      setRows(items.map(a => ({ assembly: a, qty: 0 })));
    };
    loadItems().catch(console.error).finally(() => setLoading(false));
  }, []);

  // Debounced search / filter
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!searchQuery.trim() && activeFilter === "All") {
      setRows(allItems.map(a => {
        const prev = rows.find(r => r.assembly.id === a.id);
        return { assembly: a, qty: prev?.qty ?? 0 };
      }));
      return;
    }
    searchTimer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const term = activeFilter !== "All"
          ? (config.filterMap?.[activeFilter] ?? activeFilter)
          : searchQuery;
        const cats = [config.dbCategory, ...(config.dbCategoryAlt ? [config.dbCategoryAlt] : [])];
        const results = await Promise.all(cats.map(cat => searchAssemblies(term, cat, 300)));
        const deduped = dedupe(results.flat());
        // Filter by search too if both are active
        const filtered = searchQuery
          ? deduped.filter(a => a.description.toLowerCase().includes(searchQuery.toLowerCase()))
          : deduped;
        setRows(prev => {
          const qtyMap = new Map(prev.map(r => [r.assembly.id, r.qty]));
          return filtered.map(a => ({ assembly: a, qty: qtyMap.get(a.id) ?? 0 }));
        });
      } finally { setLoading(false); }
    }, 300);
  }, [searchQuery, activeFilter]);

  const setQty = (id: number, qty: number) =>
    setRows(prev => prev.map(r => r.assembly.id === id ? { ...r, qty } : r));

  const visibleRows = (activeFilter === "All" && !searchQuery)
    ? rows
    : rows.filter(r => {
        const desc = r.assembly.description.toLowerCase();
        const chipTerm = activeFilter !== "All"
          ? (config.filterMap?.[activeFilter] ?? activeFilter).toLowerCase()
          : "";
        const matchFilter = activeFilter === "All" || desc.includes(chipTerm.split(" ")[0]);
        const matchSearch = !searchQuery || desc.includes(searchQuery.toLowerCase());
        return matchFilter && matchSearch;
      });

  const handleTakeoff = () => {
    const selected = rows.filter(r => r.qty > 0);
    if (selected.length === 0) return;
    const category = `${config.categoryLabel} | ${sectionBreakdown.section} | ${sectionBreakdown.breakdown}`;
    let sort = Date.now();
    const items: TakeoffLineItem[] = selected.map(({ assembly: a, qty }) => {
      const lf = 1 + laborFactor / 100;
      const mf = 1 + materialFactor / 100;
      // Try real-world labor rate first
      const realLabor = Object.entries(LABOR_RATES).find(([k]) =>
        a.description.toLowerCase().includes(k.toLowerCase())
      )?.[1];
      return {
        id: uuidv4(), project_id: projectId, category,
        description: a.description,
        qty, unit: a.price_unit ?? "E",
        unit_cost: isQuote ? 0 : (a.unit_price ?? 0) * mf,
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
      title={config.title}
      quoteMode={isQuote}
      onQuoteModeChange={setIsQuote}
      subtitle={selectedCount > 0
        ? `${selectedCount} item type${selectedCount !== 1 ? "s" : ""} selected`
        : `${allItems.length} items — enter quantities`}
      laborFactor={laborFactor} materialFactor={materialFactor}
      onLaborFactorChange={setLaborFactor} onMaterialFactorChange={setMaterialFactor}
      onTakeoff={handleTakeoff} onClose={onClose}
      takeoffDisabled={selectedCount === 0}
      width={config.width ?? 720}
    >
      {/* Search + filter bar */}
      <div style={{ padding: "10px 18px", borderBottom: "1px solid var(--border)", background: "var(--bg-surface)", flexShrink: 0 }}>
        {/* Section info */}
        <div style={{ display: "flex", gap: 16, fontSize: 11, marginBottom: 8 }}>
          <div><span style={{ fontWeight: 700, color: "var(--text-muted)" }}>Section: </span><span>{sectionBreakdown.section}</span></div>
          <div><span style={{ fontWeight: 700, color: "var(--text-muted)" }}>Breakdown: </span><span>{sectionBreakdown.breakdown}</span></div>
        </div>

        {/* Search */}
        <div style={{ position: "relative" }}>
          <Search size={13} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
          <input
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setActiveFilter("All"); }}
            placeholder={config.searchPlaceholder}
            style={{ background: "var(--bg-raised)", border: "1px solid var(--border-strong)", borderRadius: "var(--r-md)", color: "var(--text-primary)", fontSize: 13, padding: "7px 30px 7px 28px", width: "100%" }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")}
              style={{ position: "absolute", right: 7, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 2, display: "flex" }}>
              <X size={12} />
            </button>
          )}
        </div>

        {/* Filter chips */}
        {config.filterChips.length > 1 && (
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 8 }}>
            {config.filterChips.map(f => (
              <button key={f}
                onClick={() => { setActiveFilter(f); setSearchQuery(""); }}
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
        )}
      </div>

      {/* Column headers */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 80px 90px", gap: 8, padding: "6px 18px", background: "#dce8f0", borderBottom: "1px solid var(--border)", position: "sticky", top: 0, flexShrink: 0 }}>
        <div style={colHdr}>Item Description ({visibleRows.length} shown)</div>
        <div style={{ ...colHdr, textAlign: "right" }}>Price</div>
        <div style={{ ...colHdr, textAlign: "right" }}>Labor</div>
        <div style={{ ...colHdr, textAlign: "right" }}>Qty</div>
      </div>

      {/* Item list */}
      <div style={{ overflow: "auto", flex: 1 }}>
        {loading && (
          <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>Loading…</div>
        )}
        {!loading && visibleRows.length === 0 && (
          <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
            No items match — try a different filter or search term
          </div>
        )}
        {visibleRows.map((row, idx) => {
          const a = row.assembly;
          return (
            <div key={a.id} style={{
              display: "grid", gridTemplateColumns: "1fr 80px 80px 90px", gap: 8,
              padding: "5px 18px", alignItems: "center",
              background: row.qty > 0 ? "var(--accent-light)" : idx % 2 === 0 ? "white" : "#f4f8fc",
              borderBottom: "1px solid #d0e0ec",
              borderLeft: row.qty > 0 ? "3px solid var(--accent)" : "3px solid transparent",
            }}>
              <div style={{ fontSize: 12, color: "var(--text-primary)", fontWeight: row.qty > 0 ? 600 : 400 }}>
                {a.description}
              </div>
              <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", textAlign: "right", color: a.unit_price ? "var(--text-secondary)" : "var(--amber)" }}>
                {a.unit_price ? `${a.unit_price.toFixed(2)} ${a.price_unit}` : "Quote"}
              </div>
              <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", textAlign: "right", color: "var(--text-muted)" }}>
                {a.labor_2 ?? a.labor_1 ?? 0}
              </div>
              <input type="number" value={row.qty || ""} min={0} placeholder="0"
                onChange={e => setQty(a.id, parseFloat(e.target.value) || 0)}
                style={{ ...formNumInp, width: "100%", background: "white", fontWeight: row.qty > 0 ? 700 : 400 }} />
            </div>
          );
        })}
      </div>

      {/* Selection summary */}
      {selectedCount > 0 && (
        <div style={{ padding: "7px 18px", background: "var(--accent-light)", borderTop: "1px solid var(--accent)", fontSize: 12, color: "var(--accent)", fontWeight: 600, flexShrink: 0 }}>
          {selectedCount} item type{selectedCount !== 1 ? "s" : ""} selected — click Takeoff to add to estimate
        </div>
      )}
    </TakeoffShell>
  );
}

const colHdr: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, textTransform: "uppercase",
  letterSpacing: "0.06em", color: "#2a4a6a",
};
