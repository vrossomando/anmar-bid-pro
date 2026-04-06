import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { TakeoffLineItem } from "../../hooks/takeoffCalculations";
import type { SectionBreakdown } from "../../App";

interface TempRow {
  id: string;
  description: string;
  qty: number;
  unit: string;
  unitCost: number;
  laborHrs: number;
}

interface Props {
  projectId: string;
  defaultMarkup: number;
  defaultLaborRate: number;
  sectionBreakdown: SectionBreakdown | null;
  onCommit: (items: TakeoffLineItem[]) => void;
  onCancel: () => void;
}

const newRow = (): TempRow => ({
  id: crypto.randomUUID(),
  description: "",
  qty: 1,
  unit: "ea",
  unitCost: 0,
  laborHrs: 0,
});

const UNITS = ["ea", "C", "M", "lf", "ls", "hr", "day"];

export default function TempItemsTakeoffForm({
  projectId, defaultMarkup, defaultLaborRate,
  sectionBreakdown, onCommit, onCancel,
}: Props) {
  const [rows, setRows] = useState<TempRow[]>([newRow()]);

  const updateRow = (id: string, field: keyof TempRow, value: string | number) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const addRow = () => setRows(prev => [...prev, newRow()]);
  const removeRow = (id: string) => setRows(prev => prev.filter(r => r.id !== id));

  const handleCommit = () => {
    const valid = rows.filter(r => r.description.trim() && r.qty > 0);
    if (valid.length === 0) return;

    const { section, breakdown } = sectionBreakdown ?? { section: "Temporary", breakdown: "BASE BID" };
    const category = `Temporary Items | ${section} | ${breakdown}`;

    const items: TakeoffLineItem[] = valid.map((r, idx) => {
      const extMat   = r.unitCost * r.qty;
      const markup   = extMat * (defaultMarkup / 100);
      const extLabor = r.laborHrs * r.qty * defaultLaborRate;
      return {
        id:           crypto.randomUUID(),
        project_id:   projectId,
        assembly_id:  null,
        category,
        description:  r.description.trim(),
        qty:          r.qty,
        unit:         r.unit,
        unit_cost:    r.unitCost,
        markup_pct:   defaultMarkup,
        ext_material: extMat + markup,
        labor_hours:  r.laborHrs * r.qty,
        labor_unit:   "E",
        labor_rate:   defaultLaborRate,
        ext_labor:    extLabor,
        sort_order:   Date.now() + idx,
      };
    });

    onCommit(items);
    setRows([newRow()]);
  };

  const inp: React.CSSProperties = {
    background: "var(--bg-input)", border: "1px solid var(--border)",
    borderRadius: "var(--r-sm)", color: "var(--text-primary)",
    padding: "5px 8px", fontSize: 13, width: "100%", boxSizing: "border-box",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
        Add any number of custom items with descriptions, quantities, unit prices, and labor rates.
      </div>

      {/* Header row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 70px 70px 110px 90px 36px", gap: 6, alignItems: "center" }}>
        {["Description", "Qty", "Unit", "Unit Price", "Labor Hrs", ""].map((h, i) => (
          <div key={i} style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</div>
        ))}
      </div>

      {/* Data rows */}
      {rows.map(row => (
        <div key={row.id} style={{ display: "grid", gridTemplateColumns: "1fr 70px 70px 110px 90px 36px", gap: 6, alignItems: "center" }}>
          <input
            style={inp}
            placeholder="Description"
            value={row.description}
            onChange={e => updateRow(row.id, "description", e.target.value)}
          />
          <input
            style={{ ...inp, textAlign: "right" }}
            type="number" min={0} step={1}
            value={row.qty || ""}
            onChange={e => updateRow(row.id, "qty", parseFloat(e.target.value) || 0)}
          />
          <select
            style={{ ...inp, padding: "5px 4px" }}
            value={row.unit}
            onChange={e => updateRow(row.id, "unit", e.target.value)}
          >
            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
          <input
            style={{ ...inp, textAlign: "right" }}
            type="number" min={0} step={0.01}
            value={row.unitCost || ""}
            placeholder="0.00"
            onChange={e => updateRow(row.id, "unitCost", parseFloat(e.target.value) || 0)}
          />
          <input
            style={{ ...inp, textAlign: "right" }}
            type="number" min={0} step={0.01}
            value={row.laborHrs || ""}
            placeholder="0.00"
            onChange={e => updateRow(row.id, "laborHrs", parseFloat(e.target.value) || 0)}
          />
          <button
            onClick={() => removeRow(row.id)}
            disabled={rows.length === 1}
            style={{ background: "none", border: "none", cursor: rows.length === 1 ? "not-allowed" : "pointer", color: "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center", padding: 4 }}
          >
            <Trash2 size={15} />
          </button>
        </div>
      ))}

      {/* Add row button */}
      <button
        onClick={addRow}
        style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "1px dashed var(--border)", borderRadius: "var(--r-sm)", color: "var(--text-secondary)", padding: "7px 14px", fontSize: 13, cursor: "pointer", width: "fit-content" }}
      >
        <Plus size={14} /> Add another item
      </button>

      {/* Actions */}
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", borderTop: "1px solid var(--border)", paddingTop: 16, marginTop: 4 }}>
        <button
          onClick={onCancel}
          style={{ padding: "8px 20px", borderRadius: "var(--r-sm)", border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-secondary)", fontSize: 13, cursor: "pointer" }}
        >
          Cancel
        </button>
        <button
          onClick={handleCommit}
          disabled={!rows.some(r => r.description.trim() && r.qty > 0)}
          style={{ padding: "8px 24px", borderRadius: "var(--r-sm)", border: "none", background: "var(--accent)", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
        >
          Add to Estimate
        </button>
      </div>
    </div>
  );
}
