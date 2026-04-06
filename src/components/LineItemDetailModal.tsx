import { useState } from "react";
import { X, Save, RefreshCw } from "lucide-react";
import type { LineItem } from "../hooks/db";

// ── Difficulty factors ─────────────────────────────────────────────────────

const DIFFICULTY_FACTORS = [
  { label: "Normal",              value: 1.00 },
  { label: "Slightly Difficult",  value: 1.15 },
  { label: "Difficult",           value: 1.25 },
  { label: "Very Difficult",      value: 1.50 },
  { label: "Extremely Difficult", value: 2.00 },
];

// Categories where quote toggle is offered
const QUOTE_ELIGIBLE = ["lights","lighting","light","fire alarm","security",
  "gear","switchgear","panelboard","transformer","lighting control","generator"];

const SECTIONS = [
  "Gear/Distribution","Lighting","Devices","HVAC","Fire Alarm","Temporary",
  "Demolition","Telecom","Security","Lighting Control","Generator","Audio Visual","Grounding",
  "Section #13","Section #14","Section #15","Section #16","Section #17","Section #18","Section #19","Section #20",
];

const BREAKDOWNS = [
  "BASE BID","Breakdown #1","Breakdown #2","Breakdown #3","Breakdown #4","Breakdown #5",
  "Breakdown #6","Breakdown #7","Breakdown #8","Breakdown #9","Breakdown #10",
  "Breakdown #11","Breakdown #12","Breakdown #13","Breakdown #14","Breakdown #15",
  "Breakdown #16","Breakdown #17","Breakdown #18","Breakdown #19","Breakdown #20",
];

function parseCat(raw: string) {
  const p = raw.split("|").map(s => s.trim());
  return { category: p[0] ?? raw, section: p[1] ?? "BASE BID", breakdown: p[2] ?? "BASE BID" };
}

function buildCat(category: string, section: string, breakdown: string) {
  return `${category} | ${section} | ${breakdown}`;
}

function stripDiffTag(desc: string) { return desc.replace(/\s*\[D[\d.]+\]$/, "").trim(); }
function parseDiff(item: LineItem): number {
  const m = item.description.match(/\[D([\d.]+)\]$/);
  return m ? parseFloat(m[1]) : 1.0;
}

function unitDiv(unit: string): number {
  if (unit === "C" || unit === "c") return 100;
  if (unit === "M") return 1000;
  return 1;
}

function dispUnit(unit: string): string {
  if (unit === "C" || unit === "c") return "C";
  if (unit === "M") return "M";
  if (unit === "E" || unit === "ea") return "E";
  return unit.toUpperCase();
}

function fmt(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface Props {
  item: LineItem;
  baseLaborHours: number | null;
  onSave: (updated: LineItem) => void;
  onSubstitute: () => void;
  onClose: () => void;
}

export default function LineItemDetailModal({ item, baseLaborHours, onSave, onSubstitute, onClose }: Props) {
  const cleanDesc = stripDiffTag(item.description);
  const initDiff  = parseDiff(item);
  const parsedCat = parseCat(item.category);

  // ── State ──────────────────────────────────────────────────────────────
  const [description, setDescription] = useState(cleanDesc);
  const [category,    setCategory]    = useState(parsedCat.category);
  const [section,     setSection]     = useState(parsedCat.section);
  const [breakdown,   setBreakdown]   = useState(parsedCat.breakdown);
  const [qty,         setQty]         = useState(item.qty);
  const [priceUnit,   setPriceUnit]   = useState(item.unit);              // unit for price
  const [laborUnit,   setLaborUnit]   = useState(item.labor_unit ?? item.unit); // unit for labor
  const [unitCost,    setUnitCost]    = useState(item.unit_cost);
  const [isQuote,     setIsQuote]     = useState(item.unit_cost === 0 && item.labor_hours === 0);
  const [quoteRef,    setQuoteRef]    = useState("None");
  const [markupPct,   setMarkupPct]   = useState(item.markup_pct);
  const [factor,      setFactor]      = useState(0);
  const [adjustment,  setAdjustment]  = useState(0);

  // Labor columns 1-6 (col1=easy, col2=standard, col3=NECA, etc.)
  const baseHrs = baseLaborHours ?? (initDiff !== 1.0 ? item.labor_hours / initDiff : item.labor_hours);
  const [laborCols, setLaborCols] = useState<number[]>([
    baseHrs, item.labor_hours, 0, 0, 0, 0
  ]);
  const [laborFactor, setLaborFactor] = useState(0);
  const [difficulty,  setDifficulty]  = useState(initDiff);
  const [laborRate,   setLaborRate]   = useState(item.labor_rate);
  const [assemblyId,  setAssemblyId]  = useState(item.assembly_id ? String(item.assembly_id) : "");
  const [activeTab,   setActiveTab]   = useState<"item"|"updating"|"assemblies">("item");

  // Quote eligible?
  const quoteEligible = QUOTE_ELIGIBLE.some(q => category.toLowerCase().includes(q));

  // Computed
  const tradePrice  = unitCost * (1 + markupPct / 100) * (1 + factor / 100) + adjustment;
  const appliedLab  = laborCols[1] * difficulty * (1 + laborFactor / 100);
  const pDiv        = unitDiv(priceUnit);
  const lDiv        = unitDiv(laborUnit);
  const extMat      = (qty / pDiv) * (isQuote ? 0 : unitCost);
  const extLabHrs   = (qty / lDiv) * appliedLab;
  const extLabCost  = extLabHrs * laborRate;

  const setLaborCol = (idx: number, val: number) =>
    setLaborCols(prev => prev.map((v, i) => i === idx ? val : v));

  const handleSave = () => {
    const diffTag = difficulty !== 1.0 ? ` [D${difficulty}]` : "";
    onSave({
      ...item,
      description:  description.trim() + diffTag,
      category:     buildCat(category, section, breakdown),
      qty,
      unit:         priceUnit,
      unit_cost:    isQuote ? 0 : unitCost,
      markup_pct:   markupPct,
      labor_hours:  appliedLab,
      labor_unit:   laborUnit,
      labor_rate:   laborRate,
      assembly_id:  assemblyId ? parseInt(assemblyId) : null,
    });
    onClose();
  };

  const UnitSelector = ({ value, onChange, id }: { value: string; onChange: (v:string)=>void; id: string }) => (
    <select id={id} value={value} onChange={e => onChange(e.target.value)}
      style={{ padding: "4px 6px", border: "1px solid #999", borderRadius: 2, fontSize: 12, background: "white", fontFamily: "var(--font-mono)", width: 54 }}>
      <option value="E">E</option>
      <option value="C">C</option>
      <option value="M">M</option>
      <option value="LF">LF</option>
    </select>
  );

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={box}>

        {/* ── Title bar ── */}
        <div style={titleBar}>
          <span style={{ fontWeight: 700, fontSize: 13 }}>
            {parsedCat.category} › {parsedCat.section}
          </span>
          <button onClick={onClose} style={closeBtn}><X size={13} /></button>
        </div>

        {/* ── Description row ── */}
        <div style={{ padding: "8px 14px", borderBottom: "1px solid #ccc", display: "flex", gap: 8, alignItems: "center", background: "white" }}>
          <div style={{ flex: 1 }}>
            <label style={lbl}>Description</label>
            <input value={description} onChange={e => setDescription(e.target.value)}
              style={{ ...inp, fontSize: 13, width: "100%" }} />
          </div>
          <div style={{ width: 160 }}>
            <label style={lbl}>Item Number</label>
            <input value={assemblyId} onChange={e => setAssemblyId(e.target.value)}
              style={{ ...inp, fontFamily: "var(--font-mono)" }} placeholder="—" />
          </div>
        </div>

        {/* ── Section / Breakdown / Qty ── */}
        <div style={{ padding: "6px 14px", borderBottom: "1px solid #ccc", background: "#f5f5f5", display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8, alignItems: "end" }}>
          <div>
            <label style={lbl}>Section</label>
            <select value={section} onChange={e => setSection(e.target.value)} style={{ ...inp, padding: "4px 6px" }}>
              {SECTIONS.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Breakdown</label>
            <select value={breakdown} onChange={e => setBreakdown(e.target.value)} style={{ ...inp, padding: "4px 6px" }}>
              {BREAKDOWNS.map(b => <option key={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Qty</label>
            <input type="number" value={qty} min={0} step={1} onChange={e => setQty(parseFloat(e.target.value)||0)}
              style={{ ...inp, width: 90, textAlign: "right", fontFamily: "var(--font-mono)" }} />
          </div>
        </div>

        {/* ── Tabs ── */}
        <div style={{ display: "flex", borderBottom: "2px solid #7aaac8", background: "#f0f0f0", flexShrink: 0 }}>
          {(["item","updating","assemblies"] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              style={{ padding: "7px 18px", border: "none", cursor: "pointer", fontSize: 12, fontWeight: activeTab===t?700:400, background: activeTab===t?"white":"transparent", color: activeTab===t?"var(--accent)":"var(--text-secondary)", borderBottom: activeTab===t?"2px solid var(--accent)":"2px solid transparent", marginBottom:-2, textTransform:"capitalize" }}>
              {t === "item" ? "Item Info" : t === "updating" ? "Updating" : "Assemblies"}
            </button>
          ))}
        </div>

        {/* ── Tab body ── */}
        <div style={{ flex: 1, overflow: "auto", padding: "10px 14px" }}>
          {activeTab === "item" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 14 }}>

              {/* ── PRICE panel ── */}
              <div style={{ border: "1px solid #bbb", borderRadius: 4, overflow: "hidden" }}>
                <div style={panelHdr}>Price</div>
                <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Trade Price</span>
                    <input type="number" value={unitCost} min={0} step={0.01}
                      onChange={e => setUnitCost(parseFloat(e.target.value)||0)}
                      style={{ ...numInp, width: 90 }} disabled={isQuote} />
                  </div>

                  {/* Discount / Target / Quote radio */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {[
                      { id:"discount", label:"Discount %" },
                      { id:"target",   label:"Target" },
                    ].map(opt => (
                      <label key={opt.id} style={{ display:"flex", alignItems:"center", gap:6, fontSize:12 }}>
                        <input type="radio" name="pricetype" defaultChecked={opt.id==="target"}
                          style={{ accentColor:"var(--accent)" }} />
                        <span style={{ width: 90 }}>{opt.label}</span>
                        {opt.id === "discount" && (
                          <input type="number" value={markupPct} min={0} step={0.5}
                            onChange={e => setMarkupPct(parseFloat(e.target.value)||0)}
                            style={{ ...numInp, width: 65 }} />
                        )}
                        {opt.id === "target" && (
                          <>
                            <input type="number" value={tradePrice} readOnly
                              style={{ ...numInp, width: 80, color:"var(--accent)", fontWeight:700 }} />
                            <label style={{ display:"flex", alignItems:"center", gap:3, fontSize:11, color:"var(--text-muted)" }}>
                              <input type="checkbox" style={{ width:"auto" }} /> Open
                            </label>
                          </>
                        )}
                      </label>
                    ))}
                    {quoteEligible && (
                      <label style={{ display:"flex", alignItems:"center", gap:6, fontSize:12 }}>
                        <input type="radio" name="pricetype" checked={isQuote} onChange={() => setIsQuote(true)}
                          style={{ accentColor:"var(--accent)" }} />
                        <button onClick={() => setIsQuote(!isQuote)}
                          style={{ padding:"2px 10px", fontSize:11, cursor:"pointer", background:"#dce8f0", border:"1px solid #9ab", borderRadius:3 }}>
                          Quote
                        </button>
                        <select value={quoteRef} onChange={e => setQuoteRef(e.target.value)}
                          style={{ fontSize:11, padding:"2px 4px", border:"1px solid #aaa", borderRadius:2, flex:1 }}>
                          <option>None</option>
                          <option>Quote 1</option><option>Quote 2</option><option>Quote 3</option>
                          <option>Quote 4</option><option>Quote 5</option><option>Quote 6</option>
                        </select>
                      </label>
                    )}
                  </div>

                  <div style={hRule} />

                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ fontSize:12, color:"var(--text-secondary)" }}>Unit of Measure</span>
                    <UnitSelector id="price-unit" value={priceUnit} onChange={setPriceUnit} />
                  </div>
                  <label style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, cursor:"pointer" }}>
                    <input type="checkbox" defaultChecked style={{ width:"auto", accentColor:"var(--accent)" }} />
                    Use custom price
                  </label>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ fontSize:12, color:"var(--text-secondary)", width:70 }}>Factor</span>
                    <input type="number" value={factor} min={0} step={1}
                      onChange={e => setFactor(parseFloat(e.target.value)||0)}
                      style={{ ...numInp, width: 60 }} />
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ fontSize:12, color:"var(--text-secondary)", width:70 }}>Adjustment</span>
                    <input type="number" value={adjustment} step={0.01}
                      onChange={e => setAdjustment(parseFloat(e.target.value)||0)}
                      style={{ ...numInp, width: 80 }} />
                  </div>

                  {/* Ext price summary */}
                  <div style={hRule} />
                  <div style={{ fontSize:11, color:"var(--text-muted)", lineHeight:1.7 }}>
                    <div>Qty: <strong>{qty.toLocaleString()}</strong> {priceUnit === "C" ? "÷ 100" : priceUnit === "M" ? "÷ 1,000" : ""}</div>
                    <div>Ext Price: <strong style={{ color:"var(--accent)" }}>${fmt(extMat)}</strong></div>
                  </div>
                </div>
              </div>

              {/* ── LABOR panel ── */}
              <div style={{ border: "1px solid #bbb", borderRadius: 4, overflow: "hidden" }}>
                <div style={panelHdr}>Labor</div>
                <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                  {["Column 1","Column 2","Column 3","Column 4","Column 5","Column 6"].map((label, idx) => (
                    <div key={idx} style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <label style={{ display:"flex", alignItems:"center", gap:4, fontSize:12 }}>
                        <input type="checkbox" defaultChecked={idx < 2} style={{ width:"auto" }} />
                        <span style={{ width:60, fontSize:12, color:"var(--text-secondary)" }}>{label}</span>
                      </label>
                      <input type="number" value={laborCols[idx]} min={0} step={0.01}
                        onChange={e => setLaborCol(idx, parseFloat(e.target.value)||0)}
                        style={{ ...numInp, width: 70 }} />
                      <label style={{ display:"flex", alignItems:"center", gap:3, fontSize:11, color:"var(--text-muted)" }}>
                        <input type="checkbox" style={{ width:"auto" }} /> Open
                      </label>
                      {idx === 2 && (
                        <label style={{ display:"flex", alignItems:"center", gap:3, fontSize:11, color:"var(--accent)" }}>
                          <input type="checkbox" defaultChecked style={{ width:"auto" }} /> NECA
                        </label>
                      )}
                    </div>
                  ))}

                  <div style={hRule} />

                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ fontSize:12, color:"var(--text-secondary)" }}>Unit of Measure</span>
                    <UnitSelector id="labor-unit" value={laborUnit} onChange={setLaborUnit} />
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ fontSize:12, color:"var(--text-secondary)", width:50 }}>Factor</span>
                    <input type="number" value={laborFactor} min={0} step={1}
                      onChange={e => setLaborFactor(parseFloat(e.target.value)||0)}
                      style={{ ...numInp, width: 60 }} />
                  </div>

                  <div style={hRule} />
                  <div style={{ fontSize:11, color:"var(--text-muted)", lineHeight:1.7 }}>
                    <div>Using Col 2: <strong>{fmt(laborCols[1])}</strong> hrs/{laborUnit}</div>
                    <div>Ext Hrs: <strong style={{ color:"var(--accent)" }}>{fmt(extLabHrs)}</strong></div>
                  </div>
                </div>
              </div>

              {/* ── RIGHT panel: difficulty + rate ── */}
              <div style={{ display:"flex", flexDirection:"column", gap:10, minWidth:150 }}>
                <div style={{ border: "1px solid #bbb", borderRadius: 4, overflow: "hidden" }}>
                  <div style={panelHdr}>Difficulty</div>
                  <div style={{ padding: "8px 10px", display:"flex", flexDirection:"column", gap:4 }}>
                    {DIFFICULTY_FACTORS.map(d => (
                      <label key={d.value} style={{ display:"flex", alignItems:"center", gap:7, cursor:"pointer", fontSize:12 }}>
                        <input type="radio" name="difficulty" checked={difficulty===d.value}
                          onChange={() => setDifficulty(d.value)}
                          style={{ accentColor:"var(--accent)" }} />
                        <span style={{ fontWeight: difficulty===d.value?700:400, color: difficulty===d.value?"var(--accent)":"var(--text-primary)" }}>
                          {d.label}
                        </span>
                        {d.value !== 1.0 && <span style={{ fontSize:10, color:"var(--text-muted)" }}>×{d.value}</span>}
                      </label>
                    ))}
                    {difficulty !== 1.0 && (
                      <div style={{ marginTop:4, fontSize:10, color:"var(--accent)", borderTop:"1px solid #eee", paddingTop:4 }}>
                        Applied: {fmt(laborCols[1])} × {difficulty} = <strong>{fmt(appliedLab)} hrs</strong>
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ border: "1px solid #bbb", borderRadius: 4, overflow: "hidden" }}>
                  <div style={panelHdr}>Labor Rate</div>
                  <div style={{ padding: "8px 10px" }}>
                    <div style={{ fontSize:11, color:"var(--text-muted)", marginBottom:4 }}>$/hr</div>
                    <input type="number" value={laborRate} min={0} step={0.01}
                      onChange={e => setLaborRate(parseFloat(e.target.value)||0)}
                      style={{ ...numInp, width:"100%" }} />
                    <div style={{ marginTop:6, fontSize:10, color:"var(--text-muted)" }}>
                      Labor cost:<br />
                      <strong style={{ color:"var(--accent)" }}>${fmt(extLabCost)}</strong>
                    </div>
                  </div>
                </div>

                <div style={{ border: "1px solid #bbb", borderRadius: 4, padding:"8px 10px" }}>
                  <label style={{ display:"flex", alignItems:"center", gap:6, cursor:"pointer", fontSize:12 }}>
                    <input type="checkbox" style={{ width:"auto" }} />
                    Exclude from reports
                  </label>
                  <label style={{ display:"flex", alignItems:"center", gap:6, cursor:"pointer", fontSize:12, marginTop:6 }}>
                    <input type="checkbox" style={{ width:"auto" }} />
                    Save Permanent to Master
                  </label>
                </div>
              </div>
            </div>
          )}

          {activeTab === "updating" && (
            <div style={{ padding: 20, color: "var(--text-muted)", fontSize: 13, textAlign: "center" }}>
              Updating options — adjust prices against latest pricing schedules
            </div>
          )}

          {activeTab === "assemblies" && (
            <div style={{ padding: 20, color: "var(--text-muted)", fontSize: 13, textAlign: "center" }}>
              Assemblies tab — view component breakdown of this item
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{ padding:"10px 14px", borderTop:"1px solid var(--border)", display:"flex", gap:10, flexShrink:0, background:"#f5f5f5" }}>
          <button onClick={onClose} style={cancelBtn}>Cancel</button>
          <button
            onClick={() => { onClose(); onSubstitute(); }}
            style={{ ...cancelBtn, flex:1.2, background:"linear-gradient(180deg,#16a34a,#15803d)", color:"white", border:"none", fontWeight:700, fontFamily:"Arial,sans-serif", textTransform:"uppercase", letterSpacing:"0.4px", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
            <RefreshCw size={13} /> Substitute
          </button>
          <button onClick={handleSave}
            style={{ ...cancelBtn, flex:2, background:"linear-gradient(180deg,#2277cc,#1155aa)", color:"white", border:"none", fontWeight:700, fontFamily:"Arial,sans-serif", textTransform:"uppercase", letterSpacing:"0.4px", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
            <Save size={13} /> Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const overlay: React.CSSProperties = {
  position:"fixed", inset:0, background:"rgba(0,0,0,0.45)",
  display:"flex", alignItems:"center", justifyContent:"center",
  zIndex:3000, backdropFilter:"blur(2px)", animation:"fadeIn 0.15s ease",
};
const box: React.CSSProperties = {
  background:"white", border:"1px solid #888",
  borderRadius:4, width:820, maxHeight:"92vh",
  boxShadow:"0 8px 32px rgba(0,0,0,0.3)", display:"flex", flexDirection:"column",
  animation:"fadeIn 0.15s ease",
};
const titleBar: React.CSSProperties = {
  padding:"8px 14px", background:"#1a3a6a", color:"white",
  display:"flex", justifyContent:"space-between", alignItems:"center", flexShrink:0,
};
const closeBtn: React.CSSProperties = {
  background:"rgba(255,255,255,0.15)", border:"1px solid rgba(255,255,255,0.3)",
  color:"white", cursor:"pointer", padding:"2px 6px", display:"flex", borderRadius:2,
};
const cancelBtn: React.CSSProperties = {
  flex:1, padding:"8px 0", borderRadius:3, fontSize:12,
  fontWeight:600, cursor:"pointer",
  background:"white", border:"1px solid #aaa", color:"#333",
};
const inp: React.CSSProperties = {
  padding:"5px 8px", border:"1px solid #aaa", borderRadius:2,
  fontSize:12, color:"#333", background:"white", width:"100%",
};
const numInp: React.CSSProperties = {
  padding:"3px 6px", border:"1px solid #aaa", borderRadius:2,
  fontSize:12, fontFamily:"var(--font-mono)", color:"#333",
  background:"white", textAlign:"right" as const,
};
const lbl: React.CSSProperties = {
  display:"block", fontSize:10, fontWeight:700, color:"#666",
  textTransform:"uppercase" as const, letterSpacing:"0.04em", marginBottom:3,
};
const panelHdr: React.CSSProperties = {
  padding:"5px 10px", background:"#e8eef4", borderBottom:"1px solid #ccc",
  fontSize:11, fontWeight:700, color:"#2a4a6a", textTransform:"uppercase" as const,
};
const hRule: React.CSSProperties = {
  borderTop:"1px solid #e0e0e0", margin:"2px 0",
};
