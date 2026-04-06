import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import TakeoffShell, { formInp, formNumInp, formSelect } from "./TakeoffShell";
import type { TakeoffLineItem } from "../../hooks/takeoffCalculations";
import { v4 as uuidv4 } from "uuid";
import type { SectionBreakdown } from "../SectionBreakdownModal";

interface LayoutRow {
  description: string;
  qty: number;
  unit: string;
  unitCost: number;
  laborHrs: number;
}

const UNITS = ["E", "C", "M", "LF", "ea", "hr", "ls", "day", "sqft"];

// Pre-loaded layout line items
const DEFAULT_ROWS: LayoutRow[] = [
  { description: "In-wall Rough-in Layout",        qty: 0, unit: "E", unitCost: 0, laborHrs: 0 },
  { description: "Above Ceiling Rough-in Layout",  qty: 0, unit: "E", unitCost: 0, laborHrs: 0 },
];

interface Props {
  projectId: string;
  defaultLaborRate: number;
  sectionBreakdown: SectionBreakdown;
  onCommit: (items: TakeoffLineItem[]) => void;
  onClose: () => void;
}

export default function LayoutTakeoffForm({
  projectId, defaultLaborRate, sectionBreakdown, onCommit, onClose,
}: Props) {
  const [rows,           setRows]           = useState<LayoutRow[]>(DEFAULT_ROWS.map(r => ({ ...r })));
  const [laborFactor,    setLaborFactor]    = useState(0);
  const [materialFactor, setMaterialFactor] = useState(0);

  const updateRow = (idx: number, field: keyof LayoutRow, value: string | number) =>
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));

  const addRow    = () => setRows(prev => [...prev, { description: "", qty: 0, unit: "E", unitCost: 0, laborHrs: 0 }]);
  const removeRow = (idx: number) => setRows(prev => prev.filter((_, i) => i !== idx));

  const handleTakeoff = () => {
    const valid = rows.filter(r => r.description.trim() && r.qty > 0);
    if (valid.length === 0) return;
    const category = `Layout | ${sectionBreakdown.section} | ${sectionBreakdown.breakdown}`;
    const lf = 1 + laborFactor / 100;
    const mf = 1 + materialFactor / 100;
    let sort = Date.now();
    const items: TakeoffLineItem[] = valid.map(r => ({
      id: uuidv4(), project_id: projectId, category,
      description: r.description.trim(),
      qty: r.qty, unit: r.unit,
      unit_cost: r.unitCost * mf,
      markup_pct: 0,
      labor_hours: r.laborHrs * lf,
      labor_unit: r.unit,
      labor_rate: defaultLaborRate,
      assembly_id: null, sort_order: sort++,
    }));
    onCommit(items);
  };

  const validCount = rows.filter(r => r.description.trim() && r.qty > 0).length;

  return (
    <TakeoffShell
      title="Layout Takeoff"
      subtitle={validCount > 0 ? `${validCount} item${validCount !== 1 ? "s" : ""} ready` : "Enter quantities for layout items"}
      laborFactor={laborFactor} materialFactor={materialFactor}
      onLaborFactorChange={setLaborFactor} onMaterialFactorChange={setMaterialFactor}
      onTakeoff={handleTakeoff} onClose={onClose}
      takeoffDisabled={validCount === 0} width={720}
    >
      {/* Section info */}
      <div style={{ padding: "8px 18px", background: "var(--bg-surface)", borderBottom: "1px solid var(--border)", flexShrink: 0, fontSize: 11, display: "flex", gap: 20 }}>
        <div><span style={{ fontWeight: 700, color: "var(--text-muted)" }}>Section: </span><span>{sectionBreakdown.section}</span></div>
        <div><span style={{ fontWeight: 700, color: "var(--text-muted)" }}>Breakdown: </span><span>{sectionBreakdown.breakdown}</span></div>
      </div>

      {/* Column headers */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 70px 60px 100px 100px 32px", gap: 8, padding: "7px 18px", background: "#dce8f0", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
        {["Description", "Qty", "Unit", "Unit Cost", "Labor Hrs", ""].map(h => (
          <div key={h} style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#2a4a6a" }}>{h}</div>
        ))}
      </div>

      {/* Rows */}
      <div style={{ overflow: "auto", flex: 1, padding: "10px 18px" }}>
        {rows.map((row, idx) => (
          <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 70px 60px 100px 100px 32px", gap: 8, marginBottom: 7, alignItems: "center" }}>
            <input
              value={row.description}
              onChange={e => updateRow(idx, "description", e.target.value)}
              placeholder="Description…"
              style={formInp}
            />
            <input type="number" value={row.qty || ""} min={0} placeholder="0"
              onChange={e => updateRow(idx, "qty", parseFloat(e.target.value) || 0)} style={formNumInp} />
            <select value={row.unit} onChange={e => updateRow(idx, "unit", e.target.value)} style={formSelect}>
              {UNITS.map(u => <option key={u}>{u}</option>)}
            </select>
            <input type="number" value={row.unitCost || ""} min={0} step={0.01} placeholder="0.00"
              onChange={e => updateRow(idx, "unitCost", parseFloat(e.target.value) || 0)} style={formNumInp} />
            <input type="number" value={row.laborHrs || ""} min={0} step={0.01} placeholder="0.00"
              onChange={e => updateRow(idx, "laborHrs", parseFloat(e.target.value) || 0)} style={formNumInp} />
            <button onClick={() => removeRow(idx)} disabled={rows.length === 1}
              style={{ background: "none", border: "1px solid var(--border-strong)", borderRadius: "var(--r-sm)", color: rows.length === 1 ? "#ccc" : "var(--red)", cursor: rows.length === 1 ? "not-allowed" : "pointer", padding: 0, display: "flex", alignItems: "center", justifyContent: "center", height: 30 }}>
              <Trash2 size={13} />
            </button>
          </div>
        ))}
        <button onClick={addRow} style={{ background: "none", border: "1px dashed var(--border-strong)", borderRadius: "var(--r-sm)", color: "var(--text-muted)", padding: "6px 14px", cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", gap: 5, marginTop: 4 }}>
          <Plus size={13} /> Add Row
        </button>
      </div>
    </TakeoffShell>
  );
}
