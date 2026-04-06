import { useState, useEffect } from "react";
import { X, Plus, Trash2, Save, BookOpen, CheckCircle } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import {
  listCustomAssemblies, saveCustomAssembly, deleteCustomAssembly,
  type CustomAssembly, type CustomAssemblyItem,
} from "../hooks/db";
import type { TakeoffLineItem } from "../hooks/takeoffCalculations";
import type { SectionBreakdown } from "./SectionBreakdownModal";

const UNITS = ["E", "C", "M", "LF", "hr", "ls", "ea", "sqft", "day"];

const CATEGORIES = [
  "Custom", "Conduit / Wire Feeders", "Devices", "Gear", "Lights",
  "Fire Alarm / Nurse Call", "Security / Intercom", "Lighting Control", "Generator",
  "Temporary", "Supports", "Miscellaneous Items",
];

const emptyItem = (): CustomAssemblyItem => ({
  description: "", qty: 1, unit: "E", unit_cost: 0, labor_hours: 0, labor_rate: 138.56, assembly_id: null,
});

interface Props {
  projectId: string;
  defaultLaborRate: number;
  sectionBreakdown: SectionBreakdown;
  /** Optional: pre-populate a new assembly from current estimate items */
  preloadItems?: TakeoffLineItem[];
  onCommit: (items: TakeoffLineItem[]) => void;
  onClose: () => void;
}

type View = "list" | "edit" | "new";

export default function SavedAssembliesModal({
  projectId, defaultLaborRate, sectionBreakdown, preloadItems, onCommit, onClose,
}: Props) {
  const [assemblies, setAssemblies]   = useState<CustomAssembly[]>([]);
  const [view,       setView]         = useState<View>("list");
  const [editing,    setEditing]      = useState<CustomAssembly | null>(null);
  const [saving,     setSaving]       = useState(false);
  const [saved,      setSaved]        = useState(false);
  const [loading,    setLoading]      = useState(true);

  useEffect(() => {
    listCustomAssemblies().then(a => { setAssemblies(a); setLoading(false); });
  }, []);

  const refresh = () => listCustomAssemblies().then(setAssemblies);

  // ── Start a new blank assembly ──
  const handleNew = () => {
    const newAsm: CustomAssembly = {
      id: uuidv4(), name: "", category: "Custom", description: "",
      items: [emptyItem()],
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    setEditing(newAsm);
    setView("new");
  };

  // ── Edit an existing assembly ──
  const handleEdit = (a: CustomAssembly) => {
    setEditing({ ...a, items: a.items.map(i => ({ ...i })) });
    setView("edit");
  };

  // ── Apply an assembly to the current estimate ──
  const handleApply = (a: CustomAssembly) => {
    const category = `${a.category} | ${sectionBreakdown.section} | ${sectionBreakdown.breakdown}`;
    let sort = Date.now();
    const items: TakeoffLineItem[] = a.items
      .filter(i => i.description.trim() && i.qty > 0)
      .map(i => ({
        id: uuidv4(), project_id: projectId, category,
        description: i.description.trim(),
        qty: i.qty, unit: i.unit,
        unit_cost: i.unit_cost, markup_pct: 0,
        labor_hours: i.labor_hours,
        labor_unit: i.unit,
        labor_rate: i.labor_rate || defaultLaborRate,
        assembly_id: i.assembly_id, sort_order: sort++,
      }));
    onCommit(items);
  };

  // ── Delete assembly ──
  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete saved assembly "${name}"? This cannot be undone.`)) return;
    await deleteCustomAssembly(id);
    await refresh();
  };

  // ── Save assembly being edited ──
  const handleSave = async () => {
    if (!editing || !editing.name.trim()) return;
    setSaving(true);
    try {
      await saveCustomAssembly({ ...editing, updated_at: new Date().toISOString() });
      await refresh();
      setSaved(true);
      setTimeout(() => { setSaved(false); setView("list"); setEditing(null); }, 1200);
    } finally { setSaving(false); }
  };

  const updateItem = (idx: number, field: keyof CustomAssemblyItem, val: string | number | null) =>
    setEditing(prev => prev ? {
      ...prev,
      items: prev.items.map((it, i) => i === idx ? { ...it, [field]: val } : it),
    } : null);

  const addItem = () =>
    setEditing(prev => prev ? { ...prev, items: [...prev.items, emptyItem()] } : null);

  const removeItem = (idx: number) =>
    setEditing(prev => prev ? { ...prev, items: prev.items.filter((_, i) => i !== idx) } : null);

  // ── LIST VIEW ──────────────────────────────────────────────────────────
  if (view === "list") {
    return (
      <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
        <div style={{ ...box, width: 680 }}>
          <div style={hdr}>
            <div style={{ color: "white", fontSize: 14, fontWeight: 700 }}>Saved Assemblies</div>
            <button onClick={onClose} style={closeBtn}><X size={14} /></button>
          </div>

          {/* Section info + New button */}
          <div style={{ padding: "10px 18px", background: "var(--bg-surface)", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
              <span style={{ fontWeight: 700 }}>Section:</span> {sectionBreakdown.section} &nbsp;·&nbsp;
              <span style={{ fontWeight: 700 }}>Breakdown:</span> {sectionBreakdown.breakdown}
            </div>
            <button onClick={handleNew}
              style={{ display: "flex", alignItems: "center", gap: 6, background: "linear-gradient(180deg,#2277cc,#1155aa)", border: "none", color: "white", padding: "7px 14px", borderRadius: "var(--r-sm)", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "Arial,sans-serif" }}>
              <Plus size={13} /> New Assembly
            </button>
          </div>

          <div style={{ flex: 1, overflow: "auto" }}>
            {loading && (
              <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>Loading…</div>
            )}
            {!loading && assemblies.length === 0 && (
              <div style={{ padding: 40, textAlign: "center" }}>
                <BookOpen size={40} style={{ color: "var(--text-muted)", margin: "0 auto 12px", display: "block" }} />
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>No saved assemblies yet</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>
                  Create reusable item packages — conduit runs, circuit packages, device clusters — to drop into any estimate instantly.
                </div>
                <button onClick={handleNew}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "linear-gradient(180deg,#2277cc,#1155aa)", border: "none", color: "white", padding: "9px 20px", borderRadius: "var(--r-md)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  <Plus size={14} /> Create First Assembly
                </button>
              </div>
            )}
            {assemblies.map((a, idx) => (
              <div key={a.id} style={{ borderBottom: "1px solid var(--border)", background: idx % 2 === 0 ? "white" : "#f8fafc" }}>
                <div style={{ padding: "12px 18px", display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary)" }}>{a.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                      {a.category} &nbsp;·&nbsp; {a.items.length} item{a.items.length !== 1 ? "s" : ""}
                      {a.description && <>&nbsp;·&nbsp; {a.description}</>}
                    </div>
                    {/* Item preview */}
                    <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {a.items.slice(0, 4).map((item, i) => (
                        <span key={i} style={{ fontSize: 10, padding: "2px 8px", background: "#e8f0fe", borderRadius: 99, color: "#1a3a6a" }}>
                          {item.qty} {item.unit} {item.description.length > 28 ? item.description.slice(0, 28) + "…" : item.description}
                        </span>
                      ))}
                      {a.items.length > 4 && (
                        <span style={{ fontSize: 10, padding: "2px 8px", background: "#f0f4f8", borderRadius: 99, color: "var(--text-muted)" }}>
                          +{a.items.length - 4} more
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                    <button onClick={() => handleEdit(a)}
                      style={outlineBtn}>Edit</button>
                    <button onClick={() => handleApply(a)}
                      style={{ ...outlineBtn, background: "linear-gradient(180deg,#2277cc,#1155aa)", color: "white", border: "none", fontWeight: 700 }}>
                      Apply to Estimate
                    </button>
                    <button onClick={() => handleDelete(a.id, a.name)}
                      style={{ ...outlineBtn, color: "var(--red)", borderColor: "var(--red)" }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ padding: "10px 18px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end" }}>
            <button onClick={onClose} style={outlineBtn}>Close</button>
          </div>
        </div>
      </div>
    );
  }

  // ── EDIT / NEW VIEW ────────────────────────────────────────────────────
  if (!editing) return null;
  const title = view === "new" ? "New Saved Assembly" : `Edit: ${editing.name}`;

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ ...box, width: 800 }}>
        <div style={hdr}>
          <div style={{ color: "white", fontSize: 14, fontWeight: 700 }}>{title}</div>
          <button onClick={() => { setView("list"); setEditing(null); }} style={closeBtn}><X size={14} /></button>
        </div>

        {/* Assembly name / category */}
        <div style={{ padding: "12px 18px", background: "var(--bg-surface)", borderBottom: "1px solid var(--border)", flexShrink: 0, display: "grid", gridTemplateColumns: "1fr 200px", gap: 12 }}>
          <div>
            <label style={lbl}>Assembly Name *</label>
            <input value={editing.name} onChange={e => setEditing(p => p ? { ...p, name: e.target.value } : null)}
              placeholder="e.g. 20A Circuit Package, Standard Device Row…"
              style={{ ...inp, fontSize: 14, fontWeight: 600 }} autoFocus />
          </div>
          <div>
            <label style={lbl}>Category</label>
            <select value={editing.category} onChange={e => setEditing(p => p ? { ...p, category: e.target.value } : null)} style={{ ...inp, padding: "6px 8px" }}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div style={{ padding: "6px 18px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          <label style={lbl}>Description / Notes</label>
          <input value={editing.description} onChange={e => setEditing(p => p ? { ...p, description: e.target.value } : null)}
            placeholder="Optional description…" style={inp} />
        </div>

        {/* Column headers */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 65px 55px 100px 100px 100px 32px", gap: 7, padding: "6px 18px", background: "#dce8f0", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          {["Description", "Qty", "Unit", "Unit Cost", "Labor Hrs", "Labor Rate", ""].map(h => (
            <div key={h} style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#2a4a6a" }}>{h}</div>
          ))}
        </div>

        {/* Item rows */}
        <div style={{ flex: 1, overflow: "auto", padding: "10px 18px" }}>
          {editing.items.map((item, idx) => (
            <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 65px 55px 100px 100px 100px 32px", gap: 7, marginBottom: 6, alignItems: "center" }}>
              <input value={item.description}
                onChange={e => updateItem(idx, "description", e.target.value)}
                placeholder="Item description…" style={inp} />
              <input type="number" value={item.qty || ""} min={0} placeholder="0"
                onChange={e => updateItem(idx, "qty", parseFloat(e.target.value) || 0)}
                style={{ ...inp, textAlign: "right", fontFamily: "var(--font-mono)" }} />
              <select value={item.unit} onChange={e => updateItem(idx, "unit", e.target.value)}
                style={{ ...inp, padding: "5px 4px" }}>
                {UNITS.map(u => <option key={u}>{u}</option>)}
              </select>
              <input type="number" value={item.unit_cost || ""} min={0} step={0.01} placeholder="0.00"
                onChange={e => updateItem(idx, "unit_cost", parseFloat(e.target.value) || 0)}
                style={{ ...inp, textAlign: "right", fontFamily: "var(--font-mono)" }} />
              <input type="number" value={item.labor_hours || ""} min={0} step={0.01} placeholder="0.00"
                onChange={e => updateItem(idx, "labor_hours", parseFloat(e.target.value) || 0)}
                style={{ ...inp, textAlign: "right", fontFamily: "var(--font-mono)" }} />
              <input type="number" value={item.labor_rate || ""} min={0} step={0.01} placeholder="138.56"
                onChange={e => updateItem(idx, "labor_rate", parseFloat(e.target.value) || 0)}
                style={{ ...inp, textAlign: "right", fontFamily: "var(--font-mono)" }} />
              <button onClick={() => removeItem(idx)} disabled={editing.items.length === 1}
                style={{ background: "none", border: "1px solid var(--border-strong)", borderRadius: "var(--r-sm)", color: editing.items.length === 1 ? "#ccc" : "var(--red)", cursor: editing.items.length === 1 ? "not-allowed" : "pointer", padding: 0, display: "flex", alignItems: "center", justifyContent: "center", height: 30 }}>
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          <button onClick={addItem}
            style={{ background: "none", border: "1px dashed var(--border-strong)", borderRadius: "var(--r-sm)", color: "var(--text-muted)", padding: "6px 14px", cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", gap: 5, marginTop: 4 }}>
            <Plus size={13} /> Add Item
          </button>
        </div>

        {/* Footer */}
        <div style={{ padding: "10px 18px 16px", borderTop: "1px solid var(--border)", display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={() => { setView("list"); setEditing(null); }} style={outlineBtn}>Cancel</button>
          <button onClick={handleSave} disabled={saving || !editing.name.trim() || editing.items.length === 0}
            title={editing.items.length === 0 ? "Add at least one item before saving" : undefined}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 20px", borderRadius: "var(--r-md)", fontSize: 13, fontWeight: 700, cursor: saving || !editing.name.trim() ? "not-allowed" : "pointer", background: saved ? "linear-gradient(180deg,#16a34a,#15803d)" : "linear-gradient(180deg,#2277cc,#1155aa)", border: "none", color: "white", opacity: !editing.name.trim() ? 0.5 : 1, fontFamily: "Arial,sans-serif", textTransform: "uppercase", letterSpacing: "0.4px" }}>
            {saved ? <><CheckCircle size={13} /> Saved!</> : <><Save size={13} /> {saving ? "Saving…" : "Save Assembly"}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const overlay: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
  display: "flex", alignItems: "center", justifyContent: "center",
  zIndex: 2500, backdropFilter: "blur(4px)", animation: "fadeIn 0.15s ease",
};
const box: React.CSSProperties = {
  background: "var(--bg-raised)", border: "1px solid var(--border-strong)",
  borderRadius: "var(--r-lg)", maxHeight: "88vh",
  boxShadow: "var(--shadow-lg)", display: "flex", flexDirection: "column",
  animation: "fadeIn 0.2s cubic-bezier(0.16,1,0.3,1)",
};
const hdr: React.CSSProperties = {
  padding: "12px 18px", background: "linear-gradient(to right,#0a246a,#2a5abf)",
  borderRadius: "var(--r-lg) var(--r-lg) 0 0",
  display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0,
};
const closeBtn: React.CSSProperties = {
  background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)",
  color: "white", cursor: "pointer", padding: "3px 6px", display: "flex", borderRadius: "var(--r-sm)",
};
const outlineBtn: React.CSSProperties = {
  padding: "7px 14px", borderRadius: "var(--r-sm)", border: "1px solid var(--border-strong)",
  background: "var(--bg-surface)", color: "var(--text-primary)", fontSize: 12, fontWeight: 600,
  cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
};
const inp: React.CSSProperties = {
  width: "100%", padding: "6px 9px", border: "1px solid var(--border-strong)",
  borderRadius: "var(--r-sm)", fontSize: 12, fontFamily: "var(--font-body)",
  color: "var(--text-primary)", background: "white",
};
const lbl: React.CSSProperties = {
  display: "block", fontSize: 10, fontWeight: 700, color: "var(--text-muted)",
  textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3,
};
