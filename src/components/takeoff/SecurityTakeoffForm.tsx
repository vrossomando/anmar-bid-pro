import type { SectionBreakdown } from "../SectionBreakdownModal";
import { useState, useEffect } from "react";
import { Search } from "lucide-react";
import TakeoffShell, { FormRow, formNumInp } from "./TakeoffShell";
import { listAssemblies, searchAssemblies, type Assembly } from "../../hooks/db";
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

export default function SecurityTakeoffForm({
  projectId, defaultLaborRate, sectionBreakdown, onCommit, onClose,
}: Props) {
  const [allItems,    setAllItems]    = useState<Assembly[]>([]);
  const [isQuote,     setIsQuote]     = useState(false);
  const [rows,        setRows]        = useState<ItemRow[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [laborFactor, setLaborFactor] = useState(0);
  const [materialFactor, setMaterialFactor] = useState(0);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    // Load Security category + pull intercom/CCTV items from Miscellaneous
    const SECURITY_EXTRA_TERMS = [
      "intercom", "cctv", "demo cctv", "video intercom",
    ];
    Promise.all([
      listAssemblies("Security", undefined, 500, 0),
      ...SECURITY_EXTRA_TERMS.map(term =>
        searchAssemblies(term, "Miscellaneous Items", 20).catch(() => [] as Assembly[])
      ),
    ]).then(([secItems, ...miscBatches]) => {
      const seen = new Map<number, Assembly>();
      for (const a of secItems) seen.set(a.id, a);
      for (const batch of miscBatches) {
        for (const a of batch) if (!seen.has(a.id)) seen.set(a.id, a);
      }
      const merged = Array.from(seen.values()).sort((a, b) =>
        a.description.localeCompare(b.description)
      );
      setAllItems(merged);
      setRows(merged.map(a => ({ assembly: a, qty: 0 })));
    }).catch(console.error);
  }, []);

  const filtered = rows.filter(r =>
    !searchQuery ||
    r.assembly.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const setQty = (id: number, qty: number) => {
    setRows(prev => prev.map(r => r.assembly.id === id ? { ...r, qty } : r));
  };

  const handleTakeoff = () => {
    const selected = rows.filter(r => r.qty > 0);
    if (selected.length === 0) return;

    const category = `Security | ${sectionBreakdown.section} | ${sectionBreakdown.breakdown}`;
    const items: TakeoffLineItem[] = [];
    let sort = Date.now();

    for (const row of selected) {
      const a = row.assembly;
      const lf = 1 + laborFactor / 100;
      const mf = 1 + materialFactor / 100;
      items.push({
        id: uuidv4(),
        project_id: projectId,
        category,
        description: a.description,
        qty: row.qty,
        unit: a.price_unit ?? "E",
        unit_cost: isQuote ? 0 : (a.unit_price ?? 0) * mf,
        markup_pct: 0,
        labor_hours: ((Object.entries(LABOR_RATES).find(([k]) => a.description.toLowerCase().includes(k.toLowerCase()))?.[1] ?? a.labor_2 ?? a.labor_1 ?? 0) * lf),
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
      title="Security Takeoff"
      quoteMode={isQuote}
      onQuoteModeChange={setIsQuote}
      subtitle={selectedCount > 0 ? `${selectedCount} item type${selectedCount !== 1 ? "s" : ""} selected` : "Enter quantities for each item below"}
      laborFactor={laborFactor} materialFactor={materialFactor}
      onLaborFactorChange={setLaborFactor} onMaterialFactorChange={setMaterialFactor}
      onTakeoff={handleTakeoff} onClose={onClose}
      takeoffDisabled={selectedCount === 0} width={680}
    >
      <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--border)", background: "var(--bg-surface)" }}>
        <SectionInfo sb={sectionBreakdown} />
        <div style={{ position: "relative", marginTop: 10 }}>
          <Search size={13} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Filter items…"
            style={{ background: "var(--bg-raised)", border: "1px solid var(--border-strong)", borderRadius: "var(--r-md)", color: "var(--text-primary)", fontSize: 13, padding: "7px 10px 7px 28px", width: "100%" }}
          />
        </div>
      </div>

      <div style={{ overflow: "auto", flex: 1 }}>
        {/* Header */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 100px", gap: 8, padding: "8px 18px 6px", borderBottom: "1px solid var(--border)", background: "#dce8f0" }}>
          <div style={colHdr}>Item Description</div>
          <div style={{ ...colHdr, textAlign: "right" }}>Quantity</div>
        </div>

        {filtered.length === 0 && (
          <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
            {allItems.length === 0 ? "Loading items…" : "No items match your search"}
          </div>
        )}

        {filtered.map((row, idx) => (
          <div
            key={row.assembly.id}
            style={{
              display: "grid", gridTemplateColumns: "1fr 100px", gap: 8,
              padding: "7px 18px", alignItems: "center",
              background: row.qty > 0 ? "var(--accent-light)" : idx % 2 === 0 ? "white" : "#f4f8fc",
              borderBottom: "1px solid #d0e0ec",
              borderLeft: row.qty > 0 ? "3px solid var(--accent)" : "3px solid transparent",
              transition: "background 0.1s",
            }}
          >
            <div>
              <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: row.qty > 0 ? 600 : 400 }}>
                {row.assembly.description}
              </div>
              {row.assembly.unit_price && (
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>
                  ${row.assembly.unit_price.toFixed(2)} {row.assembly.price_unit}
                  &nbsp;·&nbsp;
                  {row.assembly.labor_2 ?? row.assembly.labor_1 ?? 0} labor hrs each
                </div>
              )}
              {!row.assembly.unit_price && (
                <div style={{ fontSize: 11, color: "var(--amber)", marginTop: 1 }}>Price: enter manually in estimate</div>
              )}
            </div>
            <input
              type="number"
              value={row.qty || ""}
              min={0}
              placeholder="0"
              onChange={e => setQty(row.assembly.id, parseFloat(e.target.value) || 0)}
              style={{ ...formNumInp, width: "100%", background: "white", fontWeight: row.qty > 0 ? 700 : 400 }}
            />
          </div>
        ))}
      </div>

      {/* Notes */}
      <div style={{ padding: "10px 18px", borderTop: "1px solid var(--border)", background: "var(--bg-surface)" }}>
        <FormRow label="Notes">
          <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes…" style={{ background: "var(--bg-raised)", border: "1px solid var(--border-strong)", borderRadius: "var(--r-md)", color: "var(--text-primary)", fontSize: 12, padding: "6px 10px", width: "100%" }} />
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
