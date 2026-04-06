import { useState, useEffect, useCallback, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import {
  Plus, Trash2, CheckCircle, XCircle,
  ArrowLeft, AlertCircle, BookOpen, Edit,
} from "lucide-react";
import {
  getProject, listLineItems, createLineItem, updateLineItem,
  deleteLineItem, updateProject, formatMoney,
  type Project, type LineItem,
} from "../hooks/db";
import { LABOR_RATES, TH_PRICING } from "../hooks/laborRates";
import { blendedRate, DEFAULT_LABOR } from "../hooks/reportUtils";
import AssemblyPicker from "../components/AssemblyPicker";
import LineItemDetailModal from "../components/LineItemDetailModal";
import SubstituteConfirmDialog from "../components/SubstituteConfirmDialog";
import type { Assembly } from "../hooks/db";

// ── Unit math helpers ──────────────────────────────────────────────────────
// C = per 100,  M = per 1000,  E/ea/ls/hr/lf = per 1 (each)

function unitDivisor(unit: string): number {
  if (unit === "C" || unit === "c" || unit === "/100")  return 100;
  if (unit === "M" || unit === "/1000") return 1000;
  return 1;
}

function extPrice(item: LineItem): number {
  return (item.qty / unitDivisor(item.unit)) * item.unit_cost;
}

function extLabor(item: LineItem): number {
  return (item.qty / unitDivisor(item.labor_unit ?? item.unit)) * item.labor_hours;
}

function projectTotals(items: LineItem[]) {
  const rate       = blendedRate(DEFAULT_LABOR.crew);
  const matTotal   = items.reduce((s, i) => s + extPrice(i), 0);
  const laborHours = items.reduce((s, i) => s + extLabor(i), 0);
  const laborTotal = laborHours * rate;
  return { matTotal, laborTotal, laborHours, subtotal: matTotal + laborTotal };
}

// Display unit as Roman numeral where applicable
function displayUnit(unit: string): string {
  if (unit === "C" || unit === "c" || unit === "/100")  return "C";
  if (unit === "M" || unit === "/1000") return "M";
  if (unit === "E" || unit === "ea")    return "E";
  if (unit === "L" || unit === "lf")    return "LF";
  return unit.toUpperCase();
}

// ── Component ──────────────────────────────────────────────────────────────

const UNITS = ["E","C","M","L","ea","hr","lf","ls"];

interface ProjectEditorProps {
  projectId: string;
  onBack: () => void;
  onProjectUpdated: () => void;
  currencySymbol: string;
  defaultMarkup: number;
  defaultLaborRate: number;
  refreshTrigger?: number;
}

// Apply real-world labor rate by description match
function lookupLaborRate(description: string): number | null {
  if (LABOR_RATES[description] !== undefined) return LABOR_RATES[description];
  for (const [key, val] of Object.entries(LABOR_RATES)) {
    if (description.toLowerCase().includes(key.toLowerCase()) ||
        key.toLowerCase().includes(description.toLowerCase())) return val;
  }
  return null;
}

// Apply T&H pricing by description match — only if price is per C or M (linear items)
function lookupTHPrice(description: string, priceUnit: string): number | null {
  if (!["C","M","c"].includes(priceUnit)) return null;
  const d = description.toLowerCase();
  // Direct key match
  if (TH_PRICING[description] !== undefined) return TH_PRICING[description];
  // Substring match (e.g. "3/4\" EMT" in longer description)
  for (const [key, val] of Object.entries(TH_PRICING)) {
    if (d.includes(key.toLowerCase())) return val;
  }
  // MC cable: "12/2 Aluminum Clad MC Cable Solid" -> "12/2 MC/AL"
  if (/aluminum clad|mc cable/i.test(description)) {
    const mcM = description.match(/^(\d+\/\d+(?:\s+H\.?G\.?)?)/i);
    if (mcM) {
      const sz = mcM[1].trim();
      const isHG  = /h\.?g/i.test(sz);
      const isLum = /\blum\b/i.test(description);  // whole word — not substring of "aluminum"
      const k = isLum ? `${sz.replace(/\s+lum.*/i,"").trim()} LUM`
              : isHG  ? `${sz} H.G. MC/AL`
              : `${sz.split(/\s/)[0]} MC/AL`;
      if (TH_PRICING[k] !== undefined) return TH_PRICING[k];
    }
  }
  // THHN with gauge after #: "THHN - Copper Stranded #12"
  if (/thhn|thwn/i.test(d)) {
    const isSolid = /solid/i.test(d);
    const mcm = d.match(/#?(250|300|350|400|500|600)\s*mcm/);
    if (mcm) return TH_PRICING[`${mcm[1]} THHN`] ?? null;
    const slash = d.match(/#?(\d+\/0)/);
    if (slash) return TH_PRICING[`#${slash[1].toUpperCase()} THHN`] ?? null;
    const hashGauge = d.match(/#(\d+)/);
    if (hashGauge) {
      const k = isSolid ? `#${hashGauge[1]} THHN Solid` : `#${hashGauge[1]} THHN`;
      return TH_PRICING[k] ?? null;
    }
  }
  return null;
}

export default function ProjectEditor({
  projectId, onBack, onProjectUpdated,
  currencySymbol, defaultLaborRate, refreshTrigger,
}: ProjectEditorProps) {
  const [project,    setProject]    = useState<Project | null>(null);
  const [items,      setItems]      = useState<LineItem[]>([]);
  const [saving,     setSaving]     = useState(false);
  const [saved,      setSaved]      = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [editingId,   setEditingId]   = useState<string | null>(null);
  const [detailItem,  setDetailItem]  = useState<LineItem | null>(null);
  const [dragOverId,  setDragOverId]  = useState<string | null>(null);

  // Substitute workflow
  const [substituteSource, setSubstituteSource] = useState<LineItem | null>(null);
  const [showSubPicker,    setShowSubPicker]     = useState(false);
  const [subReplacement,   setSubReplacement]    = useState<Assembly | null>(null);
  const dragId = useRef<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [proj, itms] = await Promise.all([
          getProject(projectId),
          listLineItems(projectId),
        ]);
        if (!cancelled) { setProject(proj); setItems(itms); }
      } catch (e: unknown) { if (!cancelled) setError(String(e)); }
    })();
    return () => { cancelled = true; };
  }, [projectId, refreshTrigger]);

  const scheduleProjectSave = useCallback((updated: Project) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      try {
        await updateProject(updated.id, {
          name: updated.name, client: updated.client, description: updated.description,
        });
        setSaved(true); onProjectUpdated();
        setTimeout(() => setSaved(false), 2000);
      } catch (e: unknown) { setError(String(e)); }
      finally { setSaving(false); }
    }, 600);
  }, [onProjectUpdated]);

  const handleProjectField = (field: keyof Project, value: string | number) => {
    if (!project) return;
    const updated = { ...project, [field]: value };
    setProject(updated);
    scheduleProjectSave(updated);
  };

  const addBlankItem = async () => {
    if (!project) return;
    const newItem: Omit<LineItem, "created_at"> = {
      id: uuidv4(), project_id: project.id,
      category: "", description: "",
      qty: 1, unit: "E",
      unit_cost: 0, markup_pct: 0,
      labor_hours: 0, labor_rate: defaultLaborRate,
      assembly_id: null, sort_order: items.length,
    };
    try {
      await createLineItem(newItem);
      setItems(prev => [...prev, { ...newItem, created_at: new Date().toISOString() }]);
      setEditingId(newItem.id);
      onProjectUpdated();
    } catch (e: unknown) { setError(String(e)); }
  };

  const handleAssemblySelect = async (asm: {
    id: number; description: string; category: string;
    unit_price: number | null; price_unit: string;
    labor_2: number | null; labor_1: number | null;
    labor_unit?: string;
  }) => {
    if (!project) return;
    setShowPicker(false);
    const unitMap: Record<string, string> = { E: "E", C: "C", M: "M", L: "LF", P: "ls", c: "C" };

    const realLabor = lookupLaborRate(asm.description);
    const thPrice   = lookupTHPrice(asm.description, asm.price_unit);
    const newItem: Omit<LineItem, "created_at"> = {
      id: uuidv4(), project_id: project.id,
      category: asm.category, description: asm.description,
      qty: 1, unit: unitMap[asm.price_unit] ?? "E",
      unit_cost: thPrice ?? asm.unit_price ?? 0, markup_pct: 0,
      labor_hours: realLabor ?? asm.labor_2 ?? asm.labor_1 ?? 0,
      labor_unit: unitMap[asm.labor_unit ?? asm.price_unit] ?? "E",
      labor_rate: defaultLaborRate,
      assembly_id: asm.id, sort_order: items.length,
    };
    try {
      await createLineItem(newItem);
      setItems(prev => [...prev, { ...newItem, created_at: new Date().toISOString() }]);
      onProjectUpdated();
    } catch (e: unknown) { setError(String(e)); }
  };

  const handleDetailSave = async (updated: LineItem) => {
    setItems(prev => prev.map(i => i.id === updated.id ? updated : i));
    try {
      setSaving(true);
      await updateLineItem(updated.id, updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch { setError("Failed to save item"); }
    finally { setSaving(false); }
  };

  // ── Substitute workflow ──────────────────────────────────────────────────
  const handleSubstituteOpen = (item: LineItem) => {
    setSubstituteSource(item);
    setShowSubPicker(true);
  };

  const handleSubstituteSelect = (asm: Assembly) => {
    setShowSubPicker(false);
    setSubReplacement(asm);
  };

  const handleSubstituteConfirm = async (scope: "one" | "all") => {
    if (!substituteSource || !subReplacement) return;
    const asm = subReplacement;
    const unitMap: Record<string, string> = { E: "E", C: "C", M: "M", L: "LF", P: "ls", c: "C" };
    const realLabor = lookupLaborRate(asm.description);
    const thPrice   = lookupTHPrice(asm.description, asm.price_unit);

    const fields: Partial<Omit<LineItem, "id" | "project_id" | "created_at">> = {
      description:  asm.description,
      unit:         unitMap[asm.price_unit] ?? "E",
      unit_cost:    thPrice ?? asm.unit_price ?? 0,
      labor_hours:  realLabor ?? asm.labor_2 ?? asm.labor_1 ?? 0,
      labor_unit:   unitMap[asm.labor_unit ?? asm.price_unit] ?? "E",
      assembly_id:  asm.id,
    };

    const targets = scope === "all"
      ? items.filter(i =>
          i.assembly_id != null && i.assembly_id === substituteSource.assembly_id
          || i.description === substituteSource.description
        )
      : [substituteSource];

    try {
      setSaving(true);
      await Promise.all(targets.map(t => updateLineItem(t.id, fields)));
      setItems(prev => prev.map(i =>
        targets.some(t => t.id === i.id) ? { ...i, ...fields } : i
      ));
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      onProjectUpdated();
    } catch { setError("Failed to apply substitution"); }
    finally {
      setSaving(false);
      setSubstituteSource(null);
      setSubReplacement(null);
    }
  };

  const handleItemChange = async (id: string, field: keyof LineItem, value: string | number | null) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
    try { await updateLineItem(id, { [field]: value }); onProjectUpdated(); }
    catch (e: unknown) { setError(String(e)); }
  };

  const removeItem = async (id: string) => {
    try {
      await deleteLineItem(id);
      setItems(prev => prev.filter(i => i.id !== id));
      onProjectUpdated();
    } catch (e: unknown) { setError(String(e)); }
  };

  // ── Drag-to-reorder ────────────────────────────────────────────────────
  const handleDragStart = (id: string) => {
    dragId.current = id;
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (dragId.current !== id) setDragOverId(id);
  };

  const handleDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    setDragOverId(null);
    const srcId = dragId.current;
    if (!srcId || srcId === targetId) return;
    dragId.current = null;

    // Reorder the items array
    setItems(prev => {
      const arr   = [...prev];
      const srcIdx = arr.findIndex(i => i.id === srcId);
      const tgtIdx = arr.findIndex(i => i.id === targetId);
      if (srcIdx < 0 || tgtIdx < 0) return prev;
      const [moved] = arr.splice(srcIdx, 1);
      arr.splice(tgtIdx, 0, moved);
      // Persist new sort_order values
      arr.forEach((item, i) => {
        const updated = { ...item, sort_order: i };
        updateLineItem(item.id, { sort_order: i }).catch(() => {});
      });
      return arr.map((item, i) => ({ ...item, sort_order: i }));
    });
  };

  const handleDragEnd = () => {
    dragId.current = null;
    setDragOverId(null);
  };

  if (!project) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100%", color:"var(--text-muted)" }}>
      Loading…
    </div>
  );

  const fmt = (n: number) => formatMoney(n, currencySymbol);
  const { matTotal, laborTotal, laborHours, subtotal } = projectTotals(items);

  return (
    <div style={{ height:"100%", display:"flex", flexDirection:"column", background:"var(--bg-surface)" }}>

      {/* ── Top bar ── */}
      <div style={{ padding:"8px 16px", borderBottom:"2px solid #7aaac8", display:"flex", alignItems:"center", gap:10, background:"white", flexShrink:0 }}>
        <button onClick={onBack}
          style={{ background:"var(--accent-light)", border:"none", color:"var(--accent)", cursor:"pointer", display:"flex", alignItems:"center", gap:4, padding:"5px 12px", borderRadius:"var(--r-md)", fontSize:12, fontWeight:700 }}>
          <ArrowLeft size={13} /> Menu
        </button>
        <div style={{ flex:1, display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:13, fontWeight:700, color:"var(--text-primary)" }}>{project.name}</span>
          {project.bid_number && <span style={{ fontSize:11, color:"var(--text-muted)", fontFamily:"var(--font-mono)" }}>#{project.bid_number}</span>}
          {project.client     && <span style={{ fontSize:12, color:"var(--text-secondary)" }}>· {project.client}</span>}
        </div>
        <div style={{ fontSize:11, color: saved ? "var(--green)" : "var(--text-muted)", display:"flex", alignItems:"center", gap:4 }}>
          {saving && "Saving…"}
          {saved && <><CheckCircle size={11} /> Saved</>}
        </div>
        <button onClick={() => setShowPicker(true)}
          style={{ background:"linear-gradient(180deg,#2277cc,#1155aa)", border:"none", color:"white", fontWeight:700, fontSize:12, padding:"7px 16px", borderRadius:"var(--r-sm)", cursor:"pointer", display:"flex", alignItems:"center", gap:5, fontFamily:"Arial,sans-serif", textTransform:"uppercase", letterSpacing:"0.4px" }}>
          <BookOpen size={13} /> Browse Catalog
        </button>
        <button onClick={addBlankItem}
          style={{ background:"var(--bg-surface)", border:"1px solid var(--border-strong)", color:"var(--text-secondary)", fontWeight:600, fontSize:12, padding:"7px 14px", borderRadius:"var(--r-sm)", cursor:"pointer", display:"flex", alignItems:"center", gap:5 }}>
          <Plus size={13} /> Add Row
        </button>
      </div>

      {/* ── Error ── */}
      {error && (
        <div style={{ padding:"6px 16px", background:"#fee2e2", borderBottom:"1px solid #fca5a5", color:"#dc2626", fontSize:12, display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
          <AlertCircle size={13} /> {error}
          <button onClick={() => setError(null)} style={{ marginLeft:"auto", background:"none", border:"none", color:"#dc2626", cursor:"pointer" }}><XCircle size={13}/></button>
        </div>
      )}

      {/* ── Grid ── */}
      <div style={{ flex:1, overflow:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
          <thead>
            <tr style={{ background:"#dce8f0", position:"sticky", top:0, zIndex:10 }}>
              <Th w={40}  align="center">Entry</Th>
              <Th w={85}>Item #</Th>
              <Th>Description</Th>
              <Th w={80}  align="right">Quantity</Th>
              <Th w={110} align="right">Price</Th>
              <Th w={90}  align="right">Ext Price</Th>
              <Th w={100} align="right">Labor</Th>
              <Th w={90}  align="right">Ext Labor</Th>
              <Th w={32}  align="center"></Th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={9} style={{ textAlign:"center", padding:"40px 0", color:"var(--text-muted)", fontSize:13 }}>
                  No items yet — use the Takeoff tab or Browse Catalog to add items
                </td>
              </tr>
            )}
            {items.map((item, idx) => (
              <AuditRow
                key={item.id}
                item={item}
                idx={idx}
                editing={editingId === item.id}
                isDragOver={dragOverId === item.id}
                onStartEdit={() => setDetailItem(item)}
                onStopEdit={() => setEditingId(null)}
                onChange={handleItemChange}
                onDelete={removeItem}
                currencySymbol={currencySymbol}
                onDragStart={() => handleDragStart(item.id)}
                onDragOver={e => handleDragOver(e, item.id)}
                onDrop={e => handleDrop(e, item.id)}
                onDragEnd={handleDragEnd}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Footer totals ── */}
      <div style={{ borderTop:"2px solid #7aaac8", background:"white", padding:"8px 16px", display:"flex", justifyContent:"flex-end", gap:0, flexShrink:0 }}>
        <FooterCell label="Material"       value={fmt(matTotal)} />
        <FooterCell label="Labor"          value={fmt(laborTotal)} />
        <FooterCell label="Total Labor Hrs" value={`${laborHours.toFixed(1)} hrs`} />
        <FooterCell label="Subtotal"       value={fmt(subtotal)} highlight />
      </div>

      {detailItem && (
        <LineItemDetailModal
          item={detailItem}
          baseLaborHours={null}
          onSave={handleDetailSave}
          onSubstitute={() => handleSubstituteOpen(detailItem)}
          onClose={() => setDetailItem(null)}
        />
      )}
      {showSubPicker && (
        <AssemblyPicker
          onSelect={asm => handleSubstituteSelect(asm as Assembly)}
          onClose={() => { setShowSubPicker(false); setSubstituteSource(null); }}
        />
      )}
      {subReplacement && substituteSource && (
        <SubstituteConfirmDialog
          originalItem={substituteSource}
          replacement={subReplacement}
          matchCount={items.filter(i =>
            (i.assembly_id != null && i.assembly_id === substituteSource.assembly_id)
            || i.description === substituteSource.description
          ).length}
          onConfirm={handleSubstituteConfirm}
          onCancel={() => { setSubReplacement(null); setSubstituteSource(null); }}
        />
      )}
      {showPicker && (
        <AssemblyPicker
          onSelect={handleAssemblySelect}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}

// ── Table header cell ──────────────────────────────────────────────────────

function Th({ children, w, align = "left" }: { children?: React.ReactNode; w?: number; align?: string }) {
  return (
    <th style={{
      padding:"7px 8px",
      textAlign: align as React.CSSProperties["textAlign"],
      fontSize:11, fontWeight:700,
      textTransform:"uppercase", letterSpacing:"0.06em",
      color:"#2a4a6a", borderBottom:"2px solid #7aaac8",
      borderRight:"1px solid #b8d4e8",
      width:w, whiteSpace:"nowrap",
      background:"#dce8f0",
    }}>
      {children}
    </th>
  );
}

// ── Audit row ──────────────────────────────────────────────────────────────

function AuditRow({ item, idx, editing, isDragOver, onStartEdit, onStopEdit, onChange, onDelete,
  onDragStart, onDragOver, onDrop, onDragEnd }: {
  item: LineItem; idx: number;
  editing: boolean;
  isDragOver: boolean;
  onStartEdit: () => void; onStopEdit: () => void;
  onChange: (id: string, field: keyof LineItem, value: string | number | null) => void;
  onDelete: (id: string) => void;
  currencySymbol: string;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}) {
  const ep   = extPrice(item);
  const el   = extLabor(item);
  const u    = displayUnit(item.unit);
  const lu   = displayUnit(item.labor_unit ?? item.unit);
  const isEven = idx % 2 === 0;

  // Format: "45.00 C" or "105.00 M" or "1250.00 E"
  const isZeroCost = item.unit_cost === 0 && item.qty > 0;
  const priceStr = `${item.unit_cost.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})} ${u}`;
  const laborStr = `${item.labor_hours.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})} ${lu}`;
  const fmt2 = (n: number) => n.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});

  // Quantity display: whole number for footage, decimals for others
  const qtyDisplay = (item.unit === "C" || item.unit === "M" || item.unit === "L" || item.unit === "lf")
    ? Math.round(item.qty).toLocaleString()
    : item.qty.toLocaleString("en-US",{minimumFractionDigits:0,maximumFractionDigits:3});

  return (
    <tr
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      style={{
        background: isDragOver ? "#bfdbfe" : isEven ? "white" : "#f4f8fc",
        borderBottom: isDragOver ? "2px solid var(--accent)" : "1px solid #d0e0ec",
        cursor: "grab",
        outline: isDragOver ? "1px solid var(--accent)" : "none",
      }}
      onMouseEnter={e => { if (!isDragOver) e.currentTarget.style.background = "#e8f2fa"; }}
      onMouseLeave={e => { if (!isDragOver) e.currentTarget.style.background = isEven ? "white" : "#f4f8fc"; }}
      onClick={onStartEdit}
    >
      {/* Entry / drag handle */}
      <td style={td("center")}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
          <span style={{ color:"#888", fontSize:10 }}>{idx + 1}</span>
          <span style={{ color:"#b0c4d8", fontSize:14, lineHeight:1, letterSpacing:-1 }}>⠿</span>
        </div>
      </td>

      {/* Item # */}
      <td style={td()}>
        {editing ? (
          <InlineInput value={item.assembly_id ? String(item.assembly_id) : ""} placeholder="Item #"
            onChange={v => onChange(item.id, "assembly_id", v ? parseInt(v) : null)}
            onBlur={onStopEdit} mono width={72} />
        ) : (
          <span style={{ fontFamily:"var(--font-mono)", color:"var(--text-muted)", fontSize:11 }}>
            {item.assembly_id ?? "—"}
          </span>
        )}
      </td>

      {/* Description */}
      <td style={td()}>
        {editing ? (
          <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
            <InlineInput value={item.description} placeholder="Description…"
              onChange={v => onChange(item.id, "description", v)} onBlur={onStopEdit} wide />
            <InlineInput value={item.category} placeholder="Category…"
              onChange={v => onChange(item.id, "category", v)} onBlur={onStopEdit} wide />
          </div>
        ) : (
          <div>
            <span style={{ color:"var(--text-primary)", fontWeight:500 }}>
              {item.description || <em style={{ color:"var(--text-muted)" }}>Click to edit</em>}
            </span>
            {item.category && (
              <span style={{ fontSize:10, color:"var(--text-muted)", marginLeft:6 }}>
                ({item.category})
              </span>
            )}
          </div>
        )}
      </td>

      {/* Quantity */}
      <td style={td("right")}>
        {editing ? (
          <InlineInput value={String(item.qty)}
            onChange={v => onChange(item.id, "qty", parseFloat(v) || 0)}
            onBlur={onStopEdit} mono align="right" width={70} />
        ) : (
          <span style={{ fontFamily:"var(--font-mono)" }}>{qtyDisplay}</span>
        )}
      </td>

      {/* Price — "45.00 C" */}
      <td style={td("right")}>
        {editing ? (
          <div style={{ display:"flex", gap:3, alignItems:"center" }}>
            <InlineInput value={String(item.unit_cost)}
              onChange={v => onChange(item.id, "unit_cost", parseFloat(v) || 0)}
              onBlur={onStopEdit} mono align="right" width={70} />
            <select value={item.unit} onChange={e => onChange(item.id, "unit", e.target.value)}
              onClick={e => e.stopPropagation()}
              style={{ fontSize:10, border:"1px solid var(--border-strong)", borderRadius:3, padding:"2px 3px", background:"white", color:"var(--text-secondary)", width:36 }}>
              {UNITS.map(u => <option key={u}>{u}</option>)}
            </select>
          </div>
        ) : (
          isZeroCost
            ? <span style={{ color: "#d97706", fontStyle: "italic", fontWeight: 700, fontSize: 11 }}>QUOTE</span>
            : <span style={{ fontFamily:"var(--font-mono)" }}>{priceStr}</span>
        )}
      </td>

      {/* Ext Price — computed with C/M divisor */}
      <td style={td("right")}>
        <span style={{ fontFamily:"var(--font-mono)", fontWeight:600 }}>{fmt2(ep)}</span>
      </td>

      {/* Labor — "4.00 C" */}
      <td style={td("right")}>
        {editing ? (
          <InlineInput value={String(item.labor_hours)}
            onChange={v => onChange(item.id, "labor_hours", parseFloat(v) || 0)}
            onBlur={onStopEdit} mono align="right" width={70} />
        ) : (
          <span style={{ fontFamily:"var(--font-mono)" }}>{laborStr}</span>
        )}
      </td>

      {/* Ext Labor */}
      <td style={td("right")}>
        <span style={{ fontFamily:"var(--font-mono)", fontWeight:600 }}>{fmt2(el)}</span>
      </td>

      {/* Delete */}
      <td style={{ ...td("center"), padding:"0 4px" }}>
        <button
          onClick={e => { e.stopPropagation(); onDelete(item.id); }}
          title="Delete row"
          style={{ background:"none", border:"none", color:"#ccc", cursor:"pointer", padding:3, display:"flex", alignItems:"center", borderRadius:3, transition:"color 0.1s" }}
          onMouseEnter={e => (e.currentTarget.style.color = "#dc2626")}
          onMouseLeave={e => (e.currentTarget.style.color = "#ccc")}
        >
          <Trash2 size={12} />
        </button>
      </td>
    </tr>
  );
}

// ── Inline input ───────────────────────────────────────────────────────────

function InlineInput({ value, placeholder, onChange, onBlur, mono, align, wide, width }: {
  value: string; placeholder?: string;
  onChange: (v: string) => void; onBlur?: () => void;
  mono?: boolean; align?: string; wide?: boolean; width?: number;
}) {
  return (
    <input
      autoFocus
      value={value}
      placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      onBlur={onBlur}
      onClick={e => e.stopPropagation()}
      style={{
        border:"1px solid var(--accent)", borderRadius:3,
        padding:"2px 5px", fontSize:12,
        fontFamily: mono ? "var(--font-mono)" : "var(--font-body)",
        textAlign: (align ?? "left") as React.CSSProperties["textAlign"],
        background:"white", color:"var(--text-primary)",
        width: width ?? (wide ? "100%" : 80),
        outline:"none", boxShadow:"0 0 0 2px var(--accent-dim)",
      }}
    />
  );
}

// ── Footer cell ────────────────────────────────────────────────────────────

function FooterCell({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ padding:"4px 20px", textAlign:"right", borderLeft:"1px solid var(--border)" }}>
      <div style={{ fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em", color:"var(--text-muted)", marginBottom:2 }}>
        {label}
      </div>
      <div style={{ fontFamily:"var(--font-mono)", fontSize: highlight ? 16 : 13, fontWeight: highlight ? 800 : 600, color: highlight ? "var(--accent)" : "var(--text-primary)" }}>
        {value}
      </div>
    </div>
  );
}

const td = (align?: string): React.CSSProperties => ({
  padding:"6px 8px",
  textAlign: (align ?? "left") as React.CSSProperties["textAlign"],
  borderRight:"1px solid #d0e0ec",
  fontSize:12, verticalAlign:"middle",
  color:"var(--text-primary)",
});
