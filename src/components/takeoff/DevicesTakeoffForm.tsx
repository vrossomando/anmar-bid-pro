import { useState, useEffect } from "react";
import { ChevronRight, Search } from "lucide-react";
import TakeoffShell, { formNumInp } from "./TakeoffShell";
import { searchAssemblies, type Assembly } from "../../hooks/db";
import type { TakeoffLineItem } from "../../hooks/takeoffCalculations";
import { v4 as uuidv4 } from "uuid";
import type { SectionBreakdown } from "../SectionBreakdownModal";

// ── Level 1: Device categories (matching the reference screenshot) ──────────
const DEVICE_CATEGORIES: { label: string; searchTerm: string }[] = [
  { label: "Occupancy Sensors",                      searchTerm: "Occupancy Sensor" },
  { label: "Outlet & Junction Boxes",                searchTerm: "Box" },
  { label: "Receptacles — Duplex",                   searchTerm: "Duplex Receptacle" },
  { label: "Receptacles — Single",                   searchTerm: "Single Receptacle" },
  { label: "Receptacles — GFI / GFCI",               searchTerm: "GFI Duplex Receptacle" },
  { label: "Receptacles — USB",                      searchTerm: "USB Duplex Receptacle" },
  { label: "Receptacles — Tamper Resistant",         searchTerm: "Tamper Resistant Duplex" },
  { label: "Receptacles — Clock",                    searchTerm: "Clock Receptacle" },
  { label: "Receptacles — Twist Lock",               searchTerm: "Twist Lock" },
  { label: "Receptacles — 250V",                     searchTerm: "250V" },
  { label: "Switches — Single Pole",                 searchTerm: "1 Pole Switch" },
  { label: "Switches — 3-Way",                       searchTerm: "3-Way Switch" },
  { label: "Switches — 4-Way",                       searchTerm: "4-Way Switch" },
  { label: "Switches — Decora",                      searchTerm: "Decora Switch" },
  { label: "Switches — Pilot Light",                 searchTerm: "Pilot" },
  { label: "Switch / Receptacle Combos",             searchTerm: "Switch W/Recpt" },
  { label: "Dimmers",                                searchTerm: "Dimmer" },
  { label: "Timers / Photocells",                    searchTerm: "Timer" },
  { label: "Telephone / Data Jacks",                 searchTerm: "Jack" },
  { label: "Wall Heaters",                           searchTerm: "Wall Heater" },
  { label: "Smoke / CO Detectors",                   searchTerm: "Smoke" },
  { label: "Residential Devices",                    searchTerm: "Resi" },
];

interface SelectedItem {
  assembly: Assembly;
  qty: number;
}

interface Props {
  projectId: string;
  defaultLaborRate: number;
  sectionBreakdown: SectionBreakdown;
  onCommit: (items: TakeoffLineItem[]) => void;
  onClose: () => void;
}

export default function DevicesTakeoffForm({
  projectId, defaultLaborRate, sectionBreakdown, onCommit, onClose,
}: Props) {
  const [selectedCatIdx, setSelectedCatIdx] = useState(2); // Duplex by default
  const [items,          setItems]          = useState<Assembly[]>([]);
  const [searchQuery,    setSearchQuery]    = useState("");
  const [loading,        setLoading]        = useState(false);
  const [selectedItems,  setSelectedItems]  = useState<Map<number, SelectedItem>>(new Map());
  const [laborFactor,    setLaborFactor]    = useState(0);
  const [materialFactor, setMaterialFactor] = useState(0);

  // Load items when category changes
  useEffect(() => {
    const cat = DEVICE_CATEGORIES[selectedCatIdx];
    setLoading(true);
    setItems([]);
    searchAssemblies(cat.searchTerm, "Lights & Devices", 200)
      .then(results => {
        // Deduplicate by description, prefer priced items
        const seen = new Map<string, Assembly>();
        for (const a of results) {
          if (!seen.has(a.description) || (a.unit_price !== null && seen.get(a.description)!.unit_price === null)) {
            seen.set(a.description, a);
          }
        }
        setItems(Array.from(seen.values()).sort((a, b) => a.description.localeCompare(b.description)));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedCatIdx]);

  const handleCategorySelect = (idx: number) => {
    setSelectedCatIdx(idx);
    setSearchQuery("");
  };

  const setQty = (assembly: Assembly, qty: number) => {
    setSelectedItems(prev => {
      const next = new Map(prev);
      if (qty <= 0) {
        next.delete(assembly.id);
      } else {
        next.set(assembly.id, { assembly, qty });
      }
      return next;
    });
  };

  const filteredItems = searchQuery
    ? items.filter(i => i.description.toLowerCase().includes(searchQuery.toLowerCase()))
    : items;

  const handleTakeoff = () => {
    if (selectedItems.size === 0) return;
    const category = `Devices | ${sectionBreakdown.section} | ${sectionBreakdown.breakdown}`;
    const lf = 1 + laborFactor / 100;
    const mf = 1 + materialFactor / 100;
    let sort = Date.now();

    const result: TakeoffLineItem[] = Array.from(selectedItems.values()).map(({ assembly: a, qty }) => ({
      id: uuidv4(), project_id: projectId, category,
      description: a.description,
      qty, unit: a.price_unit ?? "E",
      unit_cost: (a.unit_price ?? 0) * mf,
      markup_pct: 0,
      labor_hours: (a.labor_2 ?? a.labor_1 ?? 0) * lf,
      labor_unit: a.labor_unit ?? "E",
      labor_rate: defaultLaborRate,
      assembly_id: a.id, sort_order: sort++,
    }));

    onCommit(result);
  };

  const totalSelected = selectedItems.size;
  const fmt = (n: number | null | undefined) =>
    n != null ? `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—";

  return (
    <TakeoffShell
      title="Devices Takeoff"
      subtitle={totalSelected > 0
        ? `${totalSelected} device type${totalSelected !== 1 ? "s" : ""} selected`
        : "Select a category, then enter quantities"}
      laborFactor={laborFactor} materialFactor={materialFactor}
      onLaborFactorChange={setLaborFactor} onMaterialFactorChange={setMaterialFactor}
      onTakeoff={handleTakeoff} onClose={onClose}
      takeoffDisabled={totalSelected === 0} width={860}
    >
      {/* Section info bar */}
      <div style={{ padding: "8px 16px", background: "var(--bg-surface)", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
        <SectionInfo sb={sectionBreakdown} />
      </div>

      {/* Main two-panel layout */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden", minHeight: 0 }}>

        {/* ── Left panel: category list ── */}
        <div style={{ width: 240, flexShrink: 0, borderRight: "2px solid var(--border-strong)", overflow: "auto", background: "white" }}>
          <div style={{ padding: "7px 12px", background: "#dce8f0", borderBottom: "1px solid var(--border)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#2a4a6a" }}>
            Device Category
          </div>
          {DEVICE_CATEGORIES.map((cat, idx) => (
            <button
              key={idx}
              onClick={() => handleCategorySelect(idx)}
              style={{
                width: "100%", background: selectedCatIdx === idx ? "#1a56db" : "transparent",
                border: "none", cursor: "pointer", padding: "8px 12px",
                textAlign: "left", display: "flex", alignItems: "center", gap: 6,
                borderBottom: "1px solid #e8f0f8",
                transition: "background var(--t-fast)",
              }}
              onMouseEnter={e => { if (selectedCatIdx !== idx) e.currentTarget.style.background = "#e8f2fa"; }}
              onMouseLeave={e => { if (selectedCatIdx !== idx) e.currentTarget.style.background = "transparent"; }}
            >
              <ChevronRight size={11} style={{ color: selectedCatIdx === idx ? "white" : "var(--text-muted)", flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: selectedCatIdx === idx ? "white" : "var(--text-primary)", fontWeight: selectedCatIdx === idx ? 700 : 400 }}>
                {cat.label}
              </span>
            </button>
          ))}
        </div>

        {/* ── Right panel: items list ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
          {/* Search within category */}
          <div style={{ padding: "8px 14px", borderBottom: "1px solid var(--border)", background: "var(--bg-surface)", flexShrink: 0 }}>
            <div style={{ position: "relative" }}>
              <Search size={12} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={`Search ${DEVICE_CATEGORIES[selectedCatIdx].label}…`}
                style={{ background: "var(--bg-raised)", border: "1px solid var(--border-strong)", borderRadius: "var(--r-sm)", color: "var(--text-primary)", fontSize: 12, padding: "6px 10px 6px 26px", width: "100%" }}
              />
            </div>
          </div>

          {/* Column headers */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 90px 90px 80px", gap: 8, padding: "6px 14px", background: "#dce8f0", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
            <div style={colHdr}>Description</div>
            <div style={{ ...colHdr, textAlign: "right" }}>Price</div>
            <div style={{ ...colHdr, textAlign: "right" }}>Labor Hrs</div>
            <div style={{ ...colHdr, textAlign: "right" }}>Quantity</div>
          </div>

          {/* Items */}
          <div style={{ overflow: "auto", flex: 1 }}>
            {loading && (
              <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>Loading…</div>
            )}
            {!loading && filteredItems.length === 0 && (
              <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
                No items found
              </div>
            )}
            {filteredItems.map((item, idx) => {
              const sel = selectedItems.get(item.id);
              const isSelected = !!sel && sel.qty > 0;
              return (
                <div
                  key={item.id}
                  style={{
                    display: "grid", gridTemplateColumns: "1fr 90px 90px 80px", gap: 8,
                    padding: "5px 14px", alignItems: "center",
                    background: isSelected ? "#e8f0fe" : idx % 2 === 0 ? "white" : "#f8fafc",
                    borderBottom: "1px solid #e8f0f8",
                    borderLeft: isSelected ? "3px solid var(--accent)" : "3px solid transparent",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 12, color: "var(--text-primary)", fontWeight: isSelected ? 600 : 400 }}>
                      {item.description}
                    </div>
                    {item.cat_number && (
                      <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{item.cat_number}</div>
                    )}
                  </div>
                  <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", textAlign: "right", color: item.unit_price ? "var(--text-primary)" : "var(--amber)" }}>
                    {item.unit_price ? `${fmt(item.unit_price)} ${item.price_unit}` : "Quote"}
                  </div>
                  <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", textAlign: "right", color: "var(--text-secondary)" }}>
                    {item.labor_2 ?? item.labor_1 ?? 0}
                  </div>
                  <input
                    type="number"
                    value={sel?.qty || ""}
                    min={0}
                    placeholder="0"
                    onChange={e => setQty(item, parseFloat(e.target.value) || 0)}
                    style={{ ...formNumInp, width: "100%", background: "white", fontWeight: isSelected ? 700 : 400, fontSize: 12 }}
                  />
                </div>
              );
            })}
          </div>

          {/* Selected summary bar */}
          {totalSelected > 0 && (
            <div style={{ padding: "7px 14px", background: "#e8f0fe", borderTop: "1px solid var(--accent)", fontSize: 12, color: "var(--accent)", fontWeight: 600, flexShrink: 0, display: "flex", justifyContent: "space-between" }}>
              <span>{totalSelected} device type{totalSelected !== 1 ? "s" : ""} across all categories</span>
              <span>{Array.from(selectedItems.values()).reduce((s, i) => s + i.qty, 0)} total pieces</span>
            </div>
          )}
        </div>
      </div>
    </TakeoffShell>
  );
}

function SectionInfo({ sb }: { sb: SectionBreakdown }) {
  return (
    <div style={{ display: "flex", gap: 20, fontSize: 11 }}>
      <div><span style={{ fontWeight: 700, color: "var(--text-muted)" }}>Section: </span><span style={{ color: "var(--text-primary)" }}>{sb.section}</span></div>
      <div><span style={{ fontWeight: 700, color: "var(--text-muted)" }}>Breakdown: </span><span style={{ color: "var(--text-primary)" }}>{sb.breakdown}</span></div>
    </div>
  );
}

const colHdr: React.CSSProperties = { fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#2a4a6a" };
