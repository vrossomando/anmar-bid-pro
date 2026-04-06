import type { SectionBreakdown } from "../SectionBreakdownModal";
import { useState, useEffect } from "react";
import { Search } from "lucide-react";
import TakeoffShell, { FormRow, formNumInp } from "./TakeoffShell";
import { listAssemblies, type Assembly } from "../../hooks/db";
import type { TakeoffLineItem } from "../../hooks/takeoffCalculations";
import { LABOR_RATES } from "../../hooks/laborRates";
import { v4 as uuidv4 } from "uuid";

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

const SUBCATEGORIES = [
  "All",
  "Ground Rods & Accessories",
  "Ground Rod Clamps",
  "Bronze Pipe Clamps",
  "Weld Connectors",
  "Ground Bars & Misc",
  "Grounding Wire & Cable",
];

export default function GroundingTakeoffForm({
  projectId, defaultLaborRate, sectionBreakdown, onCommit, onClose,
}: Props) {
  const [allItems,       setAllItems]       = useState<Assembly[]>([]);
  const [rows,           setRows]           = useState<ItemRow[]>([]);
  const [isQuote,        setIsQuote]        = useState(false);
  const [searchQuery,    setSearchQuery]    = useState("");
  const [activeSubcat,   setActiveSubcat]   = useState("All");
  const [laborFactor,    setLaborFactor]    = useState(0);
  const [materialFactor, setMaterialFactor] = useState(0);
  const [notes,          setNotes]          = useState("");

  useEffect(() => {
    listAssemblies("Grounding", undefined, 500, 0)
      .then(items => {
        const sorted = [...items].sort((a, b) => {
          if (a.subcategory !== b.subcategory)
            return a.subcategory.localeCompare(b.subcategory);
          return a.description.localeCompare(b.description);
        });
        setAllItems(sorted);
        setRows(sorted.map(a => ({ assembly: a, qty: 0 })));
      })
      .catch(console.error);
  }, []);

  const filtered = rows.filter(r => {
    const matchesSub = activeSubcat === "All" || r.assembly.subcategory === activeSubcat;
    const matchesSearch = !searchQuery ||
      r.assembly.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.assembly.item_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.assembly.cat_number ?? "").toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSub && matchesSearch;
  });

  const setQty = (id: number, qty: number) =>
    setRows(prev => prev.map(r => r.assembly.id === id ? { ...r, qty } : r));

  const handleTakeoff = () => {
    const selected = rows.filter(r => r.qty > 0);
    if (selected.length === 0) return;

    const category = `Grounding | ${sectionBreakdown.section} | ${sectionBreakdown.breakdown}`;
    const items: TakeoffLineItem[] = [];
    let sort = Date.now();

    for (const row of selected) {
      const a = row.assembly;
      const lf = 1 + laborFactor / 100;
      const mf = 1 + materialFactor / 100;
      const baseLabor =
        Object.entries(LABOR_RATES).find(([k]) =>
          a.description.toLowerCase().includes(k.toLowerCase())
        )?.[1] ?? a.labor_2 ?? a.labor_1 ?? 0;

      items.push({
        id: uuidv4(),
        project_id: projectId,
        category,
        description: a.description,
        qty: row.qty,
        unit: a.price_unit ?? "E",
        unit_cost: isQuote ? 0 : (a.unit_price ?? 0) * mf,
        markup_pct: 0,
        labor_hours: baseLabor * lf,
        labor_unit: a.labor_unit ?? "E",
        labor_rate: defaultLaborRate,
        assembly_id: a.id,
        sort_order: sort++,
      });
    }
    onCommit(items);
  };

  const selectedCount = rows.filter(r => r.qty > 0).length;

  return (
    <TakeoffShell
      title="Grounding Takeoff"
      quoteMode={isQuote}
      onQuoteModeChange={setIsQuote}
      subtitle={
        selectedCount > 0
          ? `${selectedCount} item type${selectedCount !== 1 ? "s" : ""} selected`
          : "Enter quantities for each item below"
      }
      laborFactor={laborFactor} materialFactor={materialFactor}
      onLaborFactorChange={setLaborFactor} onMaterialFactorChange={setMaterialFactor}
      onTakeoff={handleTakeoff} onClose={onClose}
      takeoffDisabled={selectedCount === 0} width={780}
    >
      {/* ── Top bar: section info + search ── */}
      <div style={{ padding: "12px 18px 10px", borderBottom: "1px solid var(--border)", background: "var(--bg-surface)" }}>
        <SectionInfo sb={sectionBreakdown} />
        <div style={{ position: "relative", marginTop: 10 }}>
          <Search size={13} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Filter by description, item #, or cat #…"
            style={{ background: "var(--bg-raised)", border: "1px solid var(--border-strong)", borderRadius: "var(--r-md)", color: "var(--text-primary)", fontSize: 13, padding: "7px 10px 7px 28px", width: "100%" }}
          />
        </div>
      </div>

      {/* ── Subcategory filter chips ── */}
      <div style={{ display: "flex", gap: 6, padding: "8px 18px", borderBottom: "1px solid var(--border)", background: "#f0f6fb", flexWrap: "wrap" }}>
        {SUBCATEGORIES.map(sub => (
          <button
            key={sub}
            onClick={() => setActiveSubcat(sub)}
            style={{
              fontSize: 11, fontWeight: 600, padding: "4px 10px",
              borderRadius: 20, border: "1px solid",
              cursor: "pointer",
              background: activeSubcat === sub ? "var(--accent)" : "white",
              color: activeSubcat === sub ? "white" : "var(--text-secondary)",
              borderColor: activeSubcat === sub ? "var(--accent)" : "var(--border-strong)",
              transition: "all 0.12s",
            }}
          >
            {sub}
          </button>
        ))}
      </div>

      {/* ── Item list ── */}
      <div style={{ overflow: "auto", flex: 1 }}>
        {/* Column headers */}
        <div style={{ display: "grid", gridTemplateColumns: "60px 1fr 120px 80px", gap: 8, padding: "8px 18px 6px", borderBottom: "1px solid var(--border)", background: "#dce8f0" }}>
          <div style={colHdr}>Item #</div>
          <div style={colHdr}>Description</div>
          <div style={{ ...colHdr, textAlign: "right" }}>Unit Price</div>
          <div style={{ ...colHdr, textAlign: "right" }}>Quantity</div>
        </div>

        {filtered.length === 0 && (
          <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
            {allItems.length === 0 ? "Loading items…" : "No items match your filter"}
          </div>
        )}

        {filtered.map((row, idx) => {
          const a = row.assembly;
          const priceStr = a.unit_price != null
            ? `$${a.unit_price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} /${a.price_unit}`
            : null;
          const laborStr = (a.labor_2 ?? a.labor_1) != null
            ? `${(a.labor_2 ?? a.labor_1)!.toFixed(2)}h`
            : null;

          return (
            <div
              key={a.id}
              style={{
                display: "grid", gridTemplateColumns: "60px 1fr 120px 80px", gap: 8,
                padding: "7px 18px", alignItems: "center",
                background: row.qty > 0 ? "var(--accent-light)" : idx % 2 === 0 ? "white" : "#f4f8fc",
                borderBottom: "1px solid #d0e0ec",
                borderLeft: row.qty > 0 ? "3px solid var(--accent)" : "3px solid transparent",
                transition: "background 0.1s",
              }}
            >
              {/* Item number */}
              <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace" }}>
                {a.item_number}
              </div>

              {/* Description + meta */}
              <div>
                <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: row.qty > 0 ? 600 : 400 }}>
                  {a.description}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>
                  {a.subcategory}
                  {a.cat_number ? ` · ${a.cat_number}` : ""}
                  {laborStr ? ` · ${laborStr} labor` : ""}
                </div>
              </div>

              {/* Price */}
              <div style={{ textAlign: "right", fontSize: 12 }}>
                {priceStr ? (
                  <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{priceStr}</span>
                ) : (
                  <span style={{ color: "var(--amber)", fontSize: 11 }}>Enter manually</span>
                )}
              </div>

              {/* Qty input */}
              <input
                type="number"
                value={row.qty || ""}
                min={0}
                placeholder="0"
                onChange={e => setQty(a.id, parseFloat(e.target.value) || 0)}
                style={{ ...formNumInp, width: "100%", background: "white", fontWeight: row.qty > 0 ? 700 : 400 }}
              />
            </div>
          );
        })}
      </div>

      {/* ── Notes ── */}
      <div style={{ padding: "10px 18px", borderTop: "1px solid var(--border)", background: "var(--bg-surface)" }}>
        <FormRow label="Notes">
          <input
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Optional notes…"
            style={{ background: "var(--bg-raised)", border: "1px solid var(--border-strong)", borderRadius: "var(--r-md)", color: "var(--text-primary)", fontSize: 12, padding: "6px 10px", width: "100%" }}
          />
        </FormRow>
      </div>
    </TakeoffShell>
  );
}

function SectionInfo({ sb }: { sb: SectionBreakdown }) {
  return (
    <div style={{ display: "flex", gap: 16, fontSize: 11 }}>
      {[["Section", sb.section], ["Breakdown", sb.breakdown], ["Division", sb.division], ["Drawing", sb.drawingRef]].map(([k, v]) => (
        <div key={k}>
          <span style={{ fontWeight: 700, color: "var(--text-muted)" }}>{k}: </span>
          <span style={{ color: "var(--text-primary)" }}>{v}</span>
        </div>
      ))}
    </div>
  );
}

const colHdr: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, textTransform: "uppercase",
  letterSpacing: "0.06em", color: "#2a4a6a",
};
