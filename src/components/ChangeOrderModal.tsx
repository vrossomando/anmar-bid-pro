import { useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { createLineItem, createProject } from "../hooks/db";
import type { Project } from "../hooks/db";
import { v4 as uuidv4 } from "uuid";

interface CORow {
  description: string;
  qty: number;
  unit: string;
  unitCost: number;
  laborHrs: number;
  notes: string;
}

const UNITS = ["E","C","M","LF","hr","ls","ea","sqft","day"];

const emptyRow = (): CORow => ({
  description: "", qty: 1, unit: "E", unitCost: 0, laborHrs: 0, notes: "",
});

interface Props {
  project: Project;
  defaultLaborRate: number;
  onClose: () => void;
  onCommitted: () => void;
  onOpenSubJob?: (id: string) => void;
}

export default function ChangeOrderModal({ project, defaultLaborRate, onClose, onCommitted, onOpenSubJob }: Props) {
  const [mode, setMode]           = useState<"line_items" | "sub_job">("line_items");
  const [coNumber,     setCoNumber]     = useState(`CO-${Date.now().toString().slice(-4)}`);
  const [coDate,       setCoDate]       = useState(new Date().toISOString().slice(0, 10));
  const [description,  setDescription]  = useState("");
  const [requestedBy,  setRequestedBy]  = useState("");
  const [rows,         setRows]         = useState<CORow[]>([emptyRow()]);
  const [saving,       setSaving]       = useState(false);

  const updateRow = (idx: number, field: keyof CORow, val: string | number) =>
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: val } : r));

  const addRow    = () => setRows(prev => [...prev, emptyRow()]);
  const removeRow = (idx: number) => setRows(prev => prev.filter((_, i) => i !== idx));

  const validRows = rows.filter(r => r.description.trim() && r.qty > 0);
  const totalMat  = validRows.reduce((s, r) => s + (r.qty * r.unitCost), 0);
  const totalLab  = validRows.reduce((s, r) => s + (r.qty * r.laborHrs * defaultLaborRate), 0);

  const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // ── Create as line items in current job ─────────────────────────────────
  const handleCommit = async () => {
    if (validRows.length === 0) return;
    setSaving(true);
    try {
      let sort = Date.now();
      for (const row of validRows) {
        await createLineItem({
          id: uuidv4(),
          project_id: project.id,
          category: `Change Order | ${coNumber} | ${description || "No description"}`,
          description: row.description.trim(),
          qty: row.qty,
          unit: row.unit,
          unit_cost: row.unitCost,
          markup_pct: 0,
          labor_hours: row.laborHrs,
          labor_rate: defaultLaborRate,
          assembly_id: null,
          sort_order: sort++,
        });
      }
      onCommitted();
      onClose();
    } finally { setSaving(false); }
  };

  // ── Create as a new sub-job project ─────────────────────────────────────
  const handleCreateSubJob = async () => {
    setSaving(true);
    try {
      const now  = new Date().toISOString();
      const id   = uuidv4();
      const subName = `${project.name} — ${coNumber}${description ? `: ${description}` : ""}`;
      const subBidNum = project.bid_number ? `${project.bid_number}-${coNumber}` : coNumber;
      const newProj: Project = {
        id,
        name:          subName,
        bid_number:    subBidNum,
        client:        project.client,
        address:       project.address,
        contact_name:  project.contact_name,
        contact_phone: project.contact_phone,
        contact_email: project.contact_email,
        description:   `Change Order for: ${project.name}\nRequested by: ${requestedBy}\n${description}`,
        notes:         `Parent job: ${project.name} (${project.bid_number})\nDate: ${coDate}`,
        status:        "draft",
        square_footage: 0,
        tax_rate:      project.tax_rate,
        actual_bid_price: 0,
        commodity_type: "pco" as const,
        created_at:    now,
        updated_at:    now,
      };
      await createProject(newProj);
      onClose();
      onOpenSubJob?.(id);
    } finally { setSaving(false); }
  };

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={box}>

        {/* Header */}
        <div style={hdr}>
          <div>
            <div style={{ color: "white", fontSize: 14, fontWeight: 700 }}>Change Order</div>
            <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 11, marginTop: 1 }}>{project.name}</div>
          </div>
          <button onClick={onClose} style={closeBtn}><X size={15} /></button>
        </div>

        {/* CO Header fields */}
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", background: "var(--bg-surface)", flexShrink: 0 }}>
          <div style={{ display: "grid", gridTemplateColumns: "140px 150px 1fr 1fr", gap: 12, alignItems: "end" }}>
            <div>
              <label style={labelStyle}>CO Number</label>
              <input value={coNumber} onChange={e => setCoNumber(e.target.value)} style={inp} placeholder="CO-001" />
            </div>
            <div>
              <label style={labelStyle}>Date</label>
              <input type="date" value={coDate} onChange={e => setCoDate(e.target.value)} style={inp} />
            </div>
            <div>
              <label style={labelStyle}>Description / Scope</label>
              <input value={description} onChange={e => setDescription(e.target.value)}
                placeholder="Brief description of change…" style={inp} />
            </div>
            <div>
              <label style={labelStyle}>Requested By</label>
              <input value={requestedBy} onChange={e => setRequestedBy(e.target.value)}
                placeholder="GC / Owner / Architect…" style={inp} />
            </div>
          </div>
        </div>

        {/* Mode toggle */}
        <div style={{ display: "flex", borderBottom: "1px solid var(--border)", background: "var(--bg-surface)" }}>
          <button
            onClick={() => setMode("line_items")}
            style={{ ...modeBtn, borderBottom: mode === "line_items" ? "3px solid #2277cc" : "3px solid transparent", color: mode === "line_items" ? "#2277cc" : "var(--text-muted)", fontWeight: mode === "line_items" ? 700 : 500 }}
          >
            <Plus size={13} /> Add Line Items to Job
          </button>
          <button
            onClick={() => setMode("sub_job")}
            style={{ ...modeBtn, borderBottom: mode === "sub_job" ? "3px solid #2277cc" : "3px solid transparent", color: mode === "sub_job" ? "#2277cc" : "var(--text-muted)", fontWeight: mode === "sub_job" ? 700 : 500 }}
          >
             Create as New Sub-Job
          </button>
        </div>

        {/* ── Line Items mode ── */}
        {mode === "line_items" && (
          <>
            <div style={{ flexShrink: 0, padding: "0", borderBottom: "1px solid var(--border)" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 70px 55px 110px 90px 32px", gap: 8, padding: "7px 20px", background: "#dce8f0", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#2a4a6a" }}>
                <div>Description</div><div>Qty</div><div>Unit</div>
                <div>Unit Cost</div><div>Labor Hrs</div><div />
              </div>
              <div style={{ maxHeight: 260, overflowY: "auto", padding: "8px 20px" }}>
                {rows.map((row, idx) => (
                  <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 70px 55px 110px 90px 32px", gap: 8, marginBottom: 6 }}>
                    <input value={row.description} onChange={e => updateRow(idx, "description", e.target.value)}
                      placeholder="Description…" style={inp} />
                    <input type="number" value={row.qty || ""} min={0} onChange={e => updateRow(idx, "qty", parseFloat(e.target.value) || 0)} style={numInp} />
                    <select value={row.unit} onChange={e => updateRow(idx, "unit", e.target.value)} style={sel}>
                      {UNITS.map(u => <option key={u}>{u}</option>)}
                    </select>
                    <input type="number" value={row.unitCost || ""} min={0} step={0.01}
                      onChange={e => updateRow(idx, "unitCost", parseFloat(e.target.value) || 0)} style={numInp} placeholder="0.00" />
                    <input type="number" value={row.laborHrs || ""} min={0} step={0.01}
                      onChange={e => updateRow(idx, "laborHrs", parseFloat(e.target.value) || 0)} style={numInp} placeholder="0.00" />
                    <button onClick={() => removeRow(idx)} disabled={rows.length === 1}
                      style={{ background: "none", border: "1px solid var(--border-strong)", borderRadius: "var(--r-sm)", cursor: "pointer", color: "var(--red)", padding: 0, display: "flex", alignItems: "center", justifyContent: "center", height: 28, opacity: rows.length === 1 ? 0.3 : 1 }}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
                <button onClick={addRow} style={{ background: "none", border: "1px dashed var(--border-strong)", borderRadius: "var(--r-sm)", color: "var(--text-muted)", padding: "4px 14px", cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                  <Plus size={11} /> Add Row
                </button>
              </div>
            </div>
            <div style={{ padding: "10px 20px", borderBottom: "1px solid var(--border)", display: "flex", gap: 24, fontSize: 12 }}>
              <span>Material: <strong>${fmt(totalMat)}</strong></span>
              <span>Labor: <strong>${fmt(totalLab)}</strong></span>
              <span>Total: <strong>${fmt(totalMat + totalLab)}</strong></span>
              <span style={{ color: "var(--text-muted)" }}>{validRows.length} line item{validRows.length !== 1 ? "s" : ""}</span>
            </div>
            <div style={{ padding: "12px 20px", display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={onClose} style={cancelBtn}>Cancel</button>
              <button onClick={handleCommit} disabled={saving || validRows.length === 0} style={commitBtn}>
                {saving ? "Saving…" : `Add ${validRows.length} Item${validRows.length !== 1 ? "s" : ""} to Job`}
              </button>
            </div>
          </>
        )}

        {/* ── Sub-Job mode ── */}
        {mode === "sub_job" && (
          <div style={{ padding: "20px" }}>
            <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: "16px", marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 10 }}>New Sub-Job will be created with:</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 7, fontSize: 12, color: "var(--text-secondary)" }}>
                <div><span style={fieldLabel}>Job Name:</span> {project.name} — {coNumber}{description ? `: ${description}` : ""}</div>
                <div><span style={fieldLabel}>Bid #:</span> {project.bid_number ? `${project.bid_number}-${coNumber}` : coNumber}</div>
                <div><span style={fieldLabel}>Client:</span> {project.client || "—"}</div>
                <div><span style={fieldLabel}>Address:</span> {project.address || "—"}</div>
                <div><span style={fieldLabel}>Requested By:</span> {requestedBy || "—"}</div>
              </div>
            </div>
            <div style={{ background: "#fff8e1", border: "1px solid #f0c040", borderRadius: "var(--r-md)", padding: "10px 14px", marginBottom: 16, fontSize: 12, color: "#7a5800" }}>
              This creates a full independent job that you can take off, price, and report just like any other bid. It will appear in the Bid Log and can be opened at any time.
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={onClose} style={cancelBtn}>Cancel</button>
              <button onClick={handleCreateSubJob} disabled={saving || !coNumber.trim()} style={commitBtn}>
                
                {saving ? "Creating…" : "Create Sub-Job & Open"}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
  display: "flex", alignItems: "center", justifyContent: "center",
  zIndex: 3000, backdropFilter: "blur(3px)",
};
const box: React.CSSProperties = {
  background: "var(--bg-raised)", border: "1px solid var(--border-strong)",
  borderRadius: "var(--r-lg)", width: 820, maxHeight: "90vh",
  display: "flex", flexDirection: "column", boxShadow: "var(--shadow-lg)",
};
const hdr: React.CSSProperties = {
  padding: "13px 18px", borderBottom: "1px solid var(--border)",
  display: "flex", justifyContent: "space-between", alignItems: "center",
  background: "linear-gradient(to right,#0a246a,#2a5abf)",
  borderRadius: "var(--r-lg) var(--r-lg) 0 0", flexShrink: 0,
};
const closeBtn: React.CSSProperties = {
  background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)",
  color: "white", cursor: "pointer", padding: "3px 6px", display: "flex", borderRadius: "var(--r-sm)",
};
const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 10, fontWeight: 700, color: "var(--text-secondary)",
  marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.06em",
};
const inp: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", padding: "5px 8px", fontSize: 12,
  border: "1px solid var(--border-strong)", borderRadius: "var(--r-sm)",
  fontFamily: "var(--font-body)", background: "white", color: "var(--text-primary)", outline: "none",
};
const numInp: React.CSSProperties = { ...inp, textAlign: "right" as const };
const sel: React.CSSProperties = { ...inp, padding: "4px 4px" };
const cancelBtn: React.CSSProperties = {
  padding: "8px 18px", borderRadius: "var(--r-md)", fontSize: 12, fontWeight: 600,
  cursor: "pointer", background: "var(--bg-surface)", border: "1px solid var(--border-strong)",
  color: "var(--text-primary)",
};
const commitBtn: React.CSSProperties = {
  padding: "8px 20px", borderRadius: "var(--r-md)", fontSize: 12, fontWeight: 700,
  cursor: "pointer", background: "linear-gradient(180deg,#2277cc,#1155aa)",
  border: "none", color: "white", display: "flex", alignItems: "center", gap: 6,
};
const modeBtn: React.CSSProperties = {
  flex: 1, padding: "10px 16px", fontSize: 12, fontWeight: 500, cursor: "pointer",
  background: "none", border: "none", display: "flex", alignItems: "center",
  justifyContent: "center", gap: 6,
};
const fieldLabel: React.CSSProperties = {
  fontWeight: 700, color: "var(--text-primary)", marginRight: 6,
};
