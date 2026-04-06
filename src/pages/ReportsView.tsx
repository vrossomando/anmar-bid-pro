import { useState, useEffect } from "react";
import { ArrowLeft, Printer, X, ChevronRight } from "lucide-react";
import { getProject, listLineItems, loadSettings, updateProject, type Project, type LineItem } from "../hooks/db";
import { printReport } from "../utils/PrintEngine";
import { buildExtensionsCSV, buildMaterialListCSV, exportCSV } from "../utils/ExportEngine";
import {
  extMat, extLaborHrs, displayUnit, isQuote,
  parseCategory, computeTotals, groupBySection,
  blendedRate, totalRate, fmtDate, expenseTotal, nonProdExtended,
  fmt, fmtHrs,
  DEFAULT_LABOR, DEFAULT_SUPPLIERS,
  type LaborConfig, type CrewCategory, type BidTotals,
  type ExpenseRow, type NonProdRow,
} from "../hooks/reportUtils";

type ReportType = "Extensions" | "Material List" | "Material Totals" | "Labor Hours" |
  "Quotes" | "Sales Tax" | "Totals" | "Select Bid Summary";

type DetailPanel = "labor-rates" | "non-quoted" | "quotes-detail" |
  "non-productive" | "job-expenses" | "subcontracts" | "overhead" |
  "profit" | "bond" | "actual-bid" | null;

interface Props {
  projectId: string;
  initialReport: ReportType;
  onBack: () => void;
}

const PRINT_CSS = `
@media print {
  body { font-family: Arial, sans-serif; font-size: 10px; color: #000; }
  .no-print { display: none !important; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #999; padding: 3px 6px; }
  th { background: #dce8f0 !important; -webkit-print-color-adjust: exact; }
  tr:nth-child(even) td { background: #f4f8fc !important; -webkit-print-color-adjust: exact; }
  @page { margin: 0.5in; size: letter landscape; }
}
`;

// ── Shared table primitives ────────────────────────────────────────────────

function TH({ children, w, right }: { children?: React.ReactNode; w?: number; right?: boolean }) {
  return (
    <th style={{ padding: "6px 8px", textAlign: right ? "right" : "left", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#2a4a6a", background: "#dce8f0", borderBottom: "2px solid #7aaac8", borderRight: "1px solid #b8d4e8", whiteSpace: "nowrap", width: w }}>
      {children}
    </th>
  );
}

function TD({ children, right, mono, bold, muted, center, colSpan, style: extraStyle }: {
  children?: React.ReactNode; right?: boolean; mono?: boolean; bold?: boolean;
  muted?: boolean; center?: boolean; colSpan?: number; style?: React.CSSProperties;
}) {
  return (
    <td colSpan={colSpan} style={{ padding: "5px 8px", textAlign: center ? "center" : right ? "right" : "left", fontFamily: mono ? "var(--font-mono)" : undefined, fontWeight: bold ? 700 : 400, color: muted ? "var(--text-muted)" : "var(--text-primary)", borderRight: "1px solid #d0e0ec", fontSize: 12, ...extraStyle }}>
      {children}
    </td>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function ReportsView({ projectId, initialReport, onBack }: Props) {
  const [project,  setProject]  = useState<Project | null>(null);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [items,   setItems]   = useState<LineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [report,  setReport]  = useState<ReportType>(initialReport);
  const [cfg,     setCfg]     = useState<LaborConfig>(DEFAULT_LABOR);
  const [panel,   setPanel]   = useState<DetailPanel>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [proj, itms, stgs] = await Promise.all([
        getProject(projectId),
        listLineItems(projectId),
        loadSettings(),
      ]);
      setProject(proj);
      setItems(itms);
      setSettings(stgs);
      if (proj) setCfg(c => ({
        ...c,
        taxRate: proj.tax_rate ?? 0,
        actualBidPrice: proj.actual_bid_price ?? 0,
      }));
      setLoading(false);
    })();
  }, [projectId]);

  useEffect(() => { setReport(initialReport); }, [initialReport]);

  // When actualBidPrice changes in cfg, persist it to the project record
  const handleSetCfg: typeof setCfg = (updater) => {
    setCfg(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      if (next.actualBidPrice !== prev.actualBidPrice && projectId) {
        updateProject(projectId, { actual_bid_price: next.actualBidPrice }).catch(() => {});
      }
      return next;
    });
  };

  const handlePrint = () => {
    if (!project) return;
    printReport({
      report,
      project,
      items,
      cfg,
      totals,
      settings,
    });
  };

  const handleExport = async () => {
    if (!project) return;
    const safeName = project.name.replace(/[^a-z0-9]/gi, "_").toLowerCase();
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    try {
      if (report === "Extensions") {
        const csv = buildExtensionsCSV(project.name, items, cfg);
        await exportCSV(`${safeName}_extensions_${date}.csv`, csv);
      } else if (report === "Material List") {
        const csv = buildMaterialListCSV(project.name, items);
        await exportCSV(`${safeName}_material_list_${date}.csv`, csv);
      }
    } catch (e) { console.error("Export failed:", e); }
  };

  const [expanded, setExpanded] = useState(false);

  if (loading || !project) {
    return <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>Loading…</div>;
  }

  const totals = computeTotals(items, cfg);
  const rate   = blendedRate(cfg.crew);

  const TABS: ReportType[] = ["Extensions", "Material List", "Quotes", "Totals", "Select Bid Summary"];

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "var(--bg-surface)", position: "relative" }}>

      {/* Top bar */}
      <div className="no-print" style={{ padding: "8px 16px", borderBottom: "2px solid #7aaac8", display: "flex", alignItems: "center", gap: 10, background: "white", flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: "var(--accent-light)", border: "none", color: "var(--accent)", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, padding: "5px 12px", borderRadius: "var(--r-md)", fontSize: 12, fontWeight: 700 }}>
          <ArrowLeft size={13} /> Estimate
        </button>
        <div style={{ display: "flex", gap: 4, flex: 1, flexWrap: "wrap" }}>
          {TABS.map(r => (
            <button key={r} onClick={() => { setReport(r); setPanel(null); }}
              style={{ padding: "5px 12px", borderRadius: "var(--r-sm)", fontSize: 12, fontWeight: report === r ? 700 : 500, cursor: "pointer", border: `1px solid ${report === r ? "var(--accent)" : "var(--border-strong)"}`, background: report === r ? "var(--accent)" : "var(--bg-surface)", color: report === r ? "white" : "var(--text-secondary)", transition: "all var(--t-fast)" }}>
              {r}
            </button>
          ))}
        </div>
        {(report === "Extensions" || report === "Totals") && (
          <button onClick={() => setExpanded(true)}
            style={{ display: "flex", alignItems: "center", gap: 5, background: "var(--bg-surface)", border: "1px solid var(--border-strong)", color: "var(--accent)", padding: "6px 14px", borderRadius: "var(--r-sm)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            ⧉ Expand View
          </button>
        )}
        {(report === "Extensions" || report === "Material List") && (
          <button onClick={handleExport}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "linear-gradient(180deg,#16a34a,#15803d)", border: "none", color: "white", padding: "6px 16px", borderRadius: "var(--r-sm)", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "Arial,sans-serif", textTransform: "uppercase", letterSpacing: "0.4px" }}>
            ↓ Export CSV
          </button>
        )}
        <button onClick={handlePrint} style={{ display: "flex", alignItems: "center", gap: 6, background: "linear-gradient(180deg,#2277cc,#1155aa)", border: "none", color: "white", padding: "6px 16px", borderRadius: "var(--r-sm)", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "Arial,sans-serif", textTransform: "uppercase", letterSpacing: "0.4px" }}>
          <Printer size={13} /> Print / PDF
        </button>
      </div>

      {/* Page header */}
      <div id="report-page-header" style={{ padding: "12px 24px 10px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", background: "white", flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>{project.name}</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 1 }}>
            {[project.client, project.address, project.bid_number ? `Bid #${project.bid_number}` : ""].filter(Boolean).join("  ·  ")}
          </div>
        </div>
        <div style={{ textAlign: "right", fontSize: 11, color: "var(--text-muted)" }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary)" }}>{report}</div>
          <div>{fmtDate(new Date().toISOString())}</div>
        </div>
      </div>

      {/* ── Expanded fullscreen overlay ── */}
      {expanded && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9000,
          background: "white", display: "flex", flexDirection: "column",
        }}>
          {/* Overlay top bar */}
          <div style={{
            padding: "10px 20px", background: "#1a3a6a", color: "white",
            display: "flex", alignItems: "center", gap: 16, flexShrink: 0,
          }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>
              {project?.name} — {report}
            </span>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
              {project?.bid_number ? `#${project.bid_number}` : ""}
            </span>
            <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
              <button onClick={handlePrint}
                style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", color: "white", padding: "5px 14px", borderRadius: "var(--r-sm)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                <Printer size={13} /> Print / PDF
              </button>
              <button onClick={() => setExpanded(false)}
                style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", color: "white", padding: "5px 14px", borderRadius: "var(--r-sm)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                <X size={13} /> Close
              </button>
            </div>
          </div>
          {/* Overlay report body — re-renders the same report component */}
          <div style={{ flex: 1, overflow: "auto" }}>
            {report === "Extensions" && items.length > 0 && (
              <ExtensionsReport items={items} cfg={cfg} />
            )}
            {report === "Totals" && project && (
              <TotalsReport
                project={project} items={items} cfg={cfg} setCfg={handleSetCfg}
                totals={totals} rate={rate}
                activePanel={null} setPanel={() => {}}
              />
            )}
          </div>
        </div>
      )}

      {/* Report body */}
      <div id="report-body" style={{ flex: 1, overflow: "auto" }}>
        {report === "Extensions"      && <ExtensionsReport      items={items} cfg={cfg} />}
        {report === "Material List"   && <MaterialListReport   items={items} />}
        {report === "Material Totals" && <MaterialTotalsReport  items={items} cfg={cfg} totals={totals} rate={rate} />}
        {report === "Labor Hours"     && <LaborHoursReport      items={items} cfg={cfg} setCfg={setCfg} rate={rate} />}
        {report === "Quotes"          && <QuotesReport          items={items} cfg={cfg} setCfg={setCfg} />}
        {report === "Sales Tax"       && <SalesTaxReport        items={items} cfg={cfg} totals={totals} />}
        {report === "Select Bid Summary" && <SelectBidSummary   project={project} items={items} cfg={cfg} setCfg={setCfg} totals={totals} rate={rate} setPanel={setPanel} />}
        {report === "Totals"          && (
          <TotalsReport
            project={project} items={items} cfg={cfg} setCfg={handleSetCfg}
            totals={totals} rate={rate}
            activePanel={panel} setPanel={setPanel}
          />
        )}
      </div>

      {/* Detail panel overlay */}
      {panel && (
        <DetailPanelOverlay
          panel={panel} cfg={cfg} setCfg={handleSetCfg}
          items={items} totals={totals} rate={rate}
          onClose={() => setPanel(null)}
        />
      )}
    </div>
  );
}

// ── EXTENSIONS REPORT ──────────────────────────────────────────────────────

function ExtensionsReport({ items, cfg }: { items: LineItem[]; cfg: LaborConfig }) {
  // All unique values for each filter level
  const allSections   = Array.from(new Set(items.map(i => parseCategory(i.category).section))).sort();
  const allCategories = Array.from(new Set(items.map(i => parseCategory(i.category).category))).sort();
  const allBreakdowns = Array.from(new Set(items.map(i => parseCategory(i.category).breakdown))).sort();

  const [selSects,  setSelSects]  = useState<Set<string>>(new Set(allSections));
  const [selCats,   setSelCats]   = useState<Set<string>>(new Set(allCategories));
  const [selBreaks, setSelBreaks] = useState<Set<string>>(new Set(allBreakdowns));
  const [groupBy,   setGroupBy]   = useState<"section"|"category"|"breakdown">("category");
  const [priceFactor, setPriceFactor] = useState(0);
  const [laborFactor, setLaborFactor] = useState(0);

  const rate = blendedRate(cfg.crew);

  // Filter items
  const filtered = items.filter(i => {
    const p = parseCategory(i.category);
    return selSects.has(p.section) && selCats.has(p.category) && selBreaks.has(p.breakdown);
  });

  // Group for display
  const groupMap = new Map<string, LineItem[]>();
  for (const i of filtered) {
    const p = parseCategory(i.category);
    const key = groupBy === "section" ? p.section : groupBy === "category" ? p.category : p.breakdown;
    if (!groupMap.has(key)) groupMap.set(key, []);
    groupMap.get(key)!.push(i);
  }

  const toggleSet = (set: Set<string>, val: string): Set<string> => {
    const n = new Set(set);
    n.has(val) ? n.delete(val) : n.add(val);
    return n;
  };

  // Grand totals
  const grandMat = filtered.reduce((s, i) => s + extMat(i) * (1 + priceFactor/100), 0);
  const grandLab = filtered.reduce((s, i) => s + extLaborHrs(i) * (1 + laborFactor/100), 0);

  return (
    <div style={{ display:"flex", height:"100%", overflow:"hidden" }}>

      {/* ── Left panel ── */}
      <div className="no-print" style={{ width:210, flexShrink:0, borderRight:"2px solid var(--border-strong)", display:"flex", flexDirection:"column", background:"white", fontSize:12 }}>

        {/* Group-by */}
        <div style={{ padding:"8px 10px", background:"#1a3a6a", borderBottom:"1px solid #ccc" }}>
          <div style={{ fontSize:10, fontWeight:700, color:"rgba(255,255,255,0.7)", textTransform:"uppercase", marginBottom:6 }}>Group Report By</div>
          {([
             ["category",  "Takeoff Type (Fire Alarm, Gear, Lights…)"],
             ["section",   "Section (Gear/Distribution, Lighting…)"],
             ["breakdown", "Breakdown (Base Bid, CO #1…)"],
           ] as const).map(([val, label]) => (
            <label key={val} style={{ display:"flex", alignItems:"flex-start", gap:6, cursor:"pointer", marginBottom:4, fontSize:11, color:"white", lineHeight:1.4 }}>
              <input type="radio" checked={groupBy===val} onChange={() => setGroupBy(val)}
                style={{ marginTop:2, accentColor:"#7aaac8" }} />
              {label}
            </label>
          ))}
        </div>

        {/* Filter lists */}
        <div style={{ flex:1, overflow:"auto" }}>
          <FilterList label="Section" items={allSections} selected={selSects}
            onToggle={v => setSelSects(toggleSet(selSects, v))}
            onAll={() => setSelSects(new Set(allSections))}
            onNone={() => setSelSects(new Set())} />
          <FilterList label="Takeoff Type" items={allCategories} selected={selCats}
            onToggle={v => setSelCats(toggleSet(selCats, v))}
            onAll={() => setSelCats(new Set(allCategories))}
            onNone={() => setSelCats(new Set())} />
          {allBreakdowns.length > 1 && (
            <FilterList label="Breakdown" items={allBreakdowns} selected={selBreaks}
              onToggle={v => setSelBreaks(toggleSet(selBreaks, v))}
              onAll={() => setSelBreaks(new Set(allBreakdowns))}
              onNone={() => setSelBreaks(new Set())} />
          )}
        </div>

        {/* Factors */}
        <div style={{ padding:"8px 10px", borderTop:"1px solid var(--border)" }}>
          {[["Price Factor %", priceFactor, setPriceFactor], ["Labor Factor %", laborFactor, setLaborFactor]].map(([lbl, val, set]) => (
            <div key={lbl as string} style={{ marginBottom:6 }}>
              <div style={{ fontSize:10, fontWeight:700, color:"var(--text-muted)", textTransform:"uppercase", marginBottom:2 }}>{lbl as string}</div>
              <input type="number" value={val as number} step={0.5}
                onChange={e => (set as Function)(parseFloat(e.target.value)||0)}
                style={{ width:"100%", padding:"3px 6px", border:"1px solid var(--border-strong)", borderRadius:"var(--r-sm)", fontSize:12, fontFamily:"var(--font-mono)" }} />
            </div>
          ))}
        </div>
      </div>

      {/* ── Right: extension table matching reference exactly ── */}
      <div style={{ flex:1, overflow:"auto", background:"white" }}>
        {/* Column headers */}
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
          <thead style={{ position:"sticky", top:0, zIndex:5 }}>
            <tr>
              <TH w={72}>Item #</TH>
              <TH>Description</TH>
              <TH w={78} right>Quantity</TH>
              <TH w={90} right>Price</TH>
              <TH w={28}>U</TH>
              <TH w={90} right>Ext Price</TH>
              <TH w={80} right>Labor Hr</TH>
              <TH w={28}>U</TH>
              <TH w={80} right>Ext Lab Hr</TH>
            </tr>
          </thead>

          {/* Groups */}
          {Array.from(groupMap.entries()).map(([groupKey, gitems]) => {
            const gMat = gitems.reduce((s,i) => s + extMat(i)*(1+priceFactor/100), 0);
            const gLab = gitems.reduce((s,i) => s + extLaborHrs(i)*(1+laborFactor/100), 0);
            return (
              <tbody key={groupKey}>
                {/* Section header row */}
                <tr>
                  <td colSpan={9} style={{ textAlign:"center", padding:"10px 8px 4px", fontWeight:700, fontSize:12, color:"#333", borderTop: groupKey !== Array.from(groupMap.keys())[0] ? "16px solid #f4f8fc" : "none" }}>
                    --- {groupKey} ---
                  </td>
                </tr>

                {/* Items */}
                {gitems.map((item, idx) => {
                  const { category, section, breakdown } = parseCategory(item.category);
                  const ep  = extMat(item) * (1 + priceFactor/100);
                  const el  = extLaborHrs(item) * (1 + laborFactor/100);
                  const pu  = displayUnit(item.unit);
                  const quote = isQuote(item);
                  return (
                    <tr key={item.id} style={{ background: idx%2===0?"white":"#f9f9f9", borderBottom:"1px solid #e8e8e8" }}>
                      <TD mono muted>{item.assembly_id ?? "—"}</TD>
                      <TD>{item.description}</TD>
                      <TD mono right>{item.qty.toLocaleString()}</TD>
                      <TD mono right>
                        {quote
                          ? <span style={{ color:"#d97706", fontStyle:"italic", fontWeight:700 }}>QUOTE</span>
                          : fmt(item.unit_cost)
                        }
                      </TD>
                      <TD muted center>{quote ? "" : pu}</TD>
                      <TD mono right>{quote ? "" : fmt(ep)}</TD>
                      <TD mono right>{item.labor_hours > 0 ? fmt(item.labor_hours) : ""}</TD>
                      <TD muted center>{item.labor_hours > 0 ? pu : ""}</TD>
                      <TD mono right bold>{el > 0 ? fmt(el) : ""}</TD>
                    </tr>
                  );
                })}

                {/* Section total row */}
                <tr style={{ background:"#f0f4f8", borderTop:"1px solid #aab" }}>
                  <td colSpan={5} style={{ padding:"5px 8px", fontSize:11, fontWeight:700, color:"#333", textAlign:"right" }}>
                    --- {groupKey} Total ---
                  </td>
                  <td style={{ padding:"5px 8px", textAlign:"right", fontFamily:"var(--font-mono)", fontWeight:700, fontSize:11 }}>
                    {fmt(gMat)}
                  </td>
                  <td colSpan={2} />
                  <td style={{ padding:"5px 8px", textAlign:"right", fontFamily:"var(--font-mono)", fontWeight:700, fontSize:11 }}>
                    {fmt(gLab)}
                  </td>
                </tr>
                <tr><td colSpan={9} style={{ height:8 }} /></tr>
              </tbody>
            );
          })}

          {/* Grand total */}
          {filtered.length > 0 && (
            <tfoot>
              <tr style={{ background:"#1a3a6a" }}>
                <td colSpan={5} style={{ padding:"7px 8px", color:"white", fontWeight:700, textAlign:"right", fontSize:12 }}>Grand Total</td>
                <td style={{ padding:"7px 8px", textAlign:"right", color:"white", fontFamily:"var(--font-mono)", fontWeight:700, fontSize:13 }}>{fmt(grandMat)}</td>
                <td colSpan={2} />
                <td style={{ padding:"7px 8px", textAlign:"right", color:"white", fontFamily:"var(--font-mono)", fontWeight:700, fontSize:13 }}>{fmt(grandLab)}</td>
              </tr>
            </tfoot>
          )}

          {filtered.length === 0 && (
            <tbody>
              <tr><td colSpan={9} style={{ textAlign:"center", padding:40, color:"var(--text-muted)", fontSize:13 }}>No items match the current filters</td></tr>
            </tbody>
          )}
        </table>
      </div>
    </div>
  );
}

// ── MATERIAL LIST REPORT ──────────────────────────────────────────────────
// Aggregates all items by description, summing quantities across the estimate.

function MaterialListReport({ items }: { items: LineItem[] }) {
  // Aggregate: group by description+unit, sum qty
  const agg = new Map<string, { description: string; unit: string; qty: number; unitCost: number; assemblyId: number | null }>();
  for (const item of items) {
    const key = `${item.description}||${item.unit}`;
    if (agg.has(key)) {
      agg.get(key)!.qty += item.qty;
    } else {
      agg.set(key, {
        description: item.description,
        unit:        item.unit,
        qty:         item.qty,
        unitCost:    item.unit_cost,
        assemblyId:  item.assembly_id,
      });
    }
  }

  // Sort by description
  const rows = Array.from(agg.values()).sort((a, b) => a.description.localeCompare(b.description));

  if (rows.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
        No items in estimate yet — add items via the Takeoff tab.
      </div>
    );
  }

  const dispUnit = (u: string) => {
    if (u === "C" || u === "c") return "C";
    if (u === "M") return "M";
    if (u === "E" || u === "ea") return "E";
    return u.toUpperCase();
  };

  return (
    <div style={{ padding: "16px 24px" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr>
            <TH w={80}>Item #</TH>
            <TH>Description</TH>
            <TH w={110} right>Total Quantity</TH>
            <TH w={60}>Unit</TH>
            <TH w={110} right>Unit Price</TH>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={idx} style={{ background: idx % 2 === 0 ? "white" : "#f4f8fc", borderBottom: "1px solid #d0e0ec" }}>
              <TD mono muted>{row.assemblyId ?? "—"}</TD>
              <TD bold={row.qty > 0}>{row.description}</TD>
              <TD mono right bold>
                {row.unit === "C" || row.unit === "M"
                  ? row.qty.toLocaleString("en-US", { maximumFractionDigits: 0 })
                  : row.qty.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 3 })
                }
              </TD>
              <TD center muted>{dispUnit(row.unit)}</TD>
              <TD mono right muted>
                {row.unitCost > 0 ? `$${fmt(row.unitCost)} ${dispUnit(row.unit)}` : "—"}
              </TD>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ background: "#1a3a6a" }}>
            <td colSpan={2} style={{ padding: "7px 8px", color: "white", fontWeight: 700, fontSize: 12 }}>
              Total Items: {rows.length}
            </td>
            <td colSpan={3} style={{ padding: "7px 8px", textAlign: "right", color: "rgba(255,255,255,0.7)", fontSize: 11 }}>
              Sorted alphabetically · All quantities combined across sections
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ── Filter list sub-component ──────────────────────────────────────────────

function FilterList({ label, items, selected, onToggle, onAll, onNone }: {
  label: string; items: string[]; selected: Set<string>;
  onToggle: (v:string) => void; onAll: () => void; onNone: () => void;
}) {
  return (
    <div style={{ borderBottom:"1px solid var(--border)" }}>
      <div style={{ padding:"5px 10px", background:"#dce8f0", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <span style={{ fontSize:10, fontWeight:700, color:"#2a4a6a", textTransform:"uppercase" }}>{label}</span>
        <div style={{ display:"flex", gap:6 }}>
          <button onClick={onAll}  style={miniBtn}>All</button>
          <button onClick={onNone} style={miniBtn}>None</button>
        </div>
      </div>
      {items.map(s => (
        <label key={s} style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 10px", borderBottom:"1px solid #f0f4f8", cursor:"pointer", background: selected.has(s) ? "#f0f6ff" : "white" }}>
          <input type="checkbox" checked={selected.has(s)} onChange={() => onToggle(s)}
            style={{ width:"auto", accentColor:"var(--accent)" }} />
          <span style={{ fontSize:12 }}>{s}</span>
        </label>
      ))}
    </div>
  );
}

const miniBtn: React.CSSProperties = {
  padding:"1px 6px", fontSize:10, cursor:"pointer", border:"1px solid var(--border-strong)",
  borderRadius:2, background:"white", color:"var(--text-secondary)",
};


// ── MATERIAL TOTALS ────────────────────────────────────────────────────────

function MaterialTotalsReport({ items, cfg, totals, rate }: { items: LineItem[]; cfg: LaborConfig; totals: BidTotals; rate: number }) {
  const cats = new Map<string, { mat: number; hrs: number }>();
  for (const i of items) {
    const { category } = parseCategory(i.category);
    if (!cats.has(category)) cats.set(category, { mat: 0, hrs: 0 });
    const e = cats.get(category)!;
    e.mat += extMat(i); e.hrs += extLaborHrs(i);
  }
  const rows = Array.from(cats.entries()).sort((a, b) => b[1].mat - a[1].mat);
  return (
    <div style={{ padding: "16px 24px" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr><TH>Category</TH><TH w={60} right>Items</TH><TH w={130} right>Material</TH><TH w={110} right>Labor Hrs</TH><TH w={130} right>Labor Cost</TH><TH w={130} right>Combined</TH></tr></thead>
        <tbody>
          {rows.map(([cat, v], idx) => (
            <tr key={cat} style={{ background: idx % 2 === 0 ? "white" : "#f4f8fc", borderBottom: "1px solid #d0e0ec" }}>
              <TD bold={v.mat > 0}>{cat}</TD>
              <TD mono right muted>{items.filter(i => parseCategory(i.category).category === cat).length}</TD>
              <TD mono right>{v.mat > 0 ? fmt(v.mat) : "—"}</TD>
              <TD mono right>{v.hrs > 0 ? fmtHrs(v.hrs) : "—"}</TD>
              <TD mono right>{v.hrs > 0 ? fmt(v.hrs * rate) : "—"}</TD>
              <TD mono right bold>{v.mat + v.hrs * rate > 0 ? fmt(v.mat + v.hrs * rate) : "—"}</TD>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ background: "#1a3a6a" }}>
            {["TOTAL", "", fmt(totals.nonQuotedMaterial), fmtHrs(totals.directLaborHours), fmt(totals.directLaborCost), fmt(totals.nonQuotedMaterial + totals.directLaborCost)].map((v, i) => (
              <td key={i} style={{ padding: "7px 8px", textAlign: i > 1 ? "right" : "left", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 12, color: "white" }}>{v}</td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ── LABOR HOURS ────────────────────────────────────────────────────────────

function LaborHoursReport({ items, cfg, setCfg, rate }: { items: LineItem[]; cfg: LaborConfig; setCfg: React.Dispatch<React.SetStateAction<LaborConfig>>; rate: number }) {
  const totalHrs = items.reduce((s, i) => s + extLaborHrs(i), 0);
  const cats = new Map<string, number>();
  for (const i of items) {
    const { category } = parseCategory(i.category);
    cats.set(category, (cats.get(category) ?? 0) + extLaborHrs(i));
  }
  const rows = Array.from(cats.entries()).sort((a, b) => b[1] - a[1]);

  return (
    <div style={{ padding: "16px 24px", display: "flex", flexDirection: "column", gap: 20 }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr><TH>Category</TH><TH w={100} right>Hours</TH><TH w={100} right>Days (8hr)</TH><TH w={120} right>Labor Cost</TH></tr></thead>
        <tbody>
          {rows.map(([cat, hrs], idx) => (
            <tr key={cat} style={{ background: idx % 2 === 0 ? "white" : "#f4f8fc", borderBottom: "1px solid #d0e0ec" }}>
              <TD bold>{cat}</TD>
              <TD mono right>{fmtHrs(hrs)}</TD>
              <TD mono right muted>{fmtHrs(hrs / 8)}</TD>
              <TD mono right>{fmt(hrs * rate)}</TD>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ background: "#1a3a6a" }}>
            {["TOTAL", fmtHrs(totalHrs), fmtHrs(totalHrs / 8), fmt(totalHrs * rate)].map((v, i) => (
              <td key={i} style={{ padding: "7px 8px", textAlign: i > 0 ? "right" : "left", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 12, color: "white" }}>{v}</td>
            ))}
          </tr>
        </tfoot>
      </table>

      {/* Crew breakdown */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#2a4a6a", marginBottom: 8 }}>Crew Distribution</div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><TH>Category</TH><TH w={90} right>% of Total</TH><TH w={90} right>Hours</TH><TH w={80} right>Days</TH><TH w={100} right>Rate $/hr</TH><TH w={120} right>Extended</TH></tr></thead>
          <tbody>
            {cfg.crew.map((c, idx) => {
              const hrs  = totalHrs * c.pctOfTotal / 100;
              const tr   = totalRate(c);
              return (
                <tr key={idx} style={{ background: idx % 2 === 0 ? "white" : "#f4f8fc", borderBottom: "1px solid #d0e0ec" }}>
                  <TD bold={c.pctOfTotal > 0}>{c.name || <span style={{ color: "var(--text-muted)" }}>—</span>}</TD>
                  <TD mono right>{c.pctOfTotal > 0 ? `${c.pctOfTotal.toFixed(1)}%` : "—"}</TD>
                  <TD mono right>{hrs > 0 ? fmtHrs(hrs) : "—"}</TD>
                  <TD mono right muted>{hrs > 0 ? fmtHrs(hrs / 8) : "—"}</TD>
                  <TD mono right>{c.baseRate > 0 ? fmt(tr) : "—"}</TD>
                  <TD mono right bold>{hrs > 0 ? fmt(hrs * tr) : "—"}</TD>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: "#1a3a6a" }}>
              {["Current Total", `${cfg.crew.reduce((s, c) => s + c.pctOfTotal, 0).toFixed(1)}%`, fmtHrs(totalHrs), fmtHrs(totalHrs / 8), fmt(rate), fmt(totalHrs * rate)].map((v, i) => (
                <td key={i} style={{ padding: "7px 8px", textAlign: i > 0 ? "right" : "left", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 12, color: "white" }}>{v}</td>
              ))}
            </tr>
          </tfoot>
        </table>
        <div style={{ marginTop: 6, fontSize: 11, color: "var(--text-muted)" }}>
          Average of labor rate w/burden: <strong style={{ color: "var(--text-primary)" }}>${fmt(rate)}/hr</strong>
          &nbsp;&nbsp;·&nbsp;&nbsp;
          Number of job hours: <strong style={{ color: totalHrs > 0 ? "var(--accent)" : "#dc2626" }}>{fmtHrs(totalHrs)}</strong>
          &nbsp;&nbsp;·&nbsp;&nbsp;
          {cfg.crew.reduce((s, c) => s + c.pctOfTotal, 0) !== 100 && (
            <span style={{ color: "#dc2626", fontWeight: 700 }}>⚠ Crew percentages must total 100%</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── QUOTES ─────────────────────────────────────────────────────────────────

function QuotesReport({ items, cfg, setCfg }: {
  items: LineItem[];
  cfg: LaborConfig;
  setCfg: React.Dispatch<React.SetStateAction<LaborConfig>>;
}) {
  const quoteItems  = items.filter(i => isQuote(i));
  const categories  = Array.from(new Set(quoteItems.map(i => parseCategory(i.category).category)));
  const [activeCat, setActiveCat] = useState(categories[0] ?? "");

  // Editable supplier names — initialized from DEFAULT_SUPPLIERS
  const [supplierNames, setSupplierNames] = useState<string[]>([...DEFAULT_SUPPLIERS]);

  // Lump sums: [category][supplierIdx] = amount
  const [lumpSums, setLumpSums] = useState<Record<string, number[]>>(
    () => Object.fromEntries(categories.map(c => [c, Array(DEFAULT_SUPPLIERS.length).fill(0)]))
  );
  // Misc adders: [category][supplierIdx] = amount
  const [miscAdders, setMiscAdders] = useState<Record<string, number[]>>(
    () => Object.fromEntries(categories.map(c => [c, Array(DEFAULT_SUPPLIERS.length).fill(0)]))
  );
  // Selected supplier per category
  const [selectedSupplier, setSelectedSupplier] = useState<Record<string, number | "lowest">>(
    () => Object.fromEntries(categories.map(c => [c, 0]))
  );

  // Ensure arrays exist when activeCat changes
  const ensureCat = (cat: string) => {
    if (!lumpSums[cat]) {
      setLumpSums(prev => ({ ...prev, [cat]: Array(DEFAULT_SUPPLIERS.length).fill(0) }));
      setMiscAdders(prev => ({ ...prev, [cat]: Array(DEFAULT_SUPPLIERS.length).fill(0) }));
    }
  };

  const setLump  = (cat: string, idx: number, val: number) => {
    setLumpSums(prev => {
      const arr = [...(prev[cat] ?? Array(DEFAULT_SUPPLIERS.length).fill(0))];
      arr[idx] = val;
      return { ...prev, [cat]: arr };
    });
  };
  const setAdder = (cat: string, idx: number, val: number) => {
    setMiscAdders(prev => {
      const arr = [...(prev[cat] ?? Array(DEFAULT_SUPPLIERS.length).fill(0))];
      arr[idx] = val;
      return { ...prev, [cat]: arr };
    });
  };

  // Total per supplier = lump sum + adder
  const supplierTotal = (cat: string, idx: number): number => {
    const ls = lumpSums[cat]?.[idx]   ?? 0;
    const ma = miscAdders[cat]?.[idx] ?? 0;
    return ls + ma;
  };

  // When supplier radio changes, push that total into cfg.quoteAmounts
  const selectSupplier = (cat: string, idx: number | "lowest") => {
    setSelectedSupplier(prev => ({ ...prev, [cat]: idx }));
    let amount = 0;
    if (idx === "lowest") {
      const totals = supplierNames.map((_, i) => supplierTotal(cat, i));
      const nonZero = totals.filter(t => t > 0);
      amount = nonZero.length > 0 ? Math.min(...nonZero) : 0;
    } else {
      amount = supplierTotal(cat, idx);
    }
    setCfg(c => ({ ...c, quoteAmounts: { ...c.quoteAmounts, [cat]: amount } }));
  };

  // Recalculate quote amount whenever lump/adder values change (for active selection)
  const refreshQuoteAmount = (cat: string) => {
    const sel = selectedSupplier[cat];
    if (sel === undefined) return;
    selectSupplier(cat, sel);
  };

  const setLumpAndRefresh = (cat: string, idx: number, val: number) => {
    setLumpSums(prev => {
      const arr = [...(prev[cat] ?? Array(DEFAULT_SUPPLIERS.length).fill(0))];
      arr[idx] = val;
      const updated = { ...prev, [cat]: arr };
      // Immediately recalculate based on updated values
      const sel = selectedSupplier[cat];
      if (sel !== undefined) {
        let amount = 0;
        if (sel === "lowest") {
          const totals = supplierNames.map((_, i) => (i === idx ? val : lumpSums[cat]?.[i] ?? 0) + (miscAdders[cat]?.[i] ?? 0));
          const nonZero = totals.filter(t => t > 0);
          amount = nonZero.length > 0 ? Math.min(...nonZero) : 0;
        } else {
          amount = (sel === idx ? val : lumpSums[cat]?.[sel as number] ?? 0) + (miscAdders[cat]?.[sel as number] ?? 0);
        }
        setCfg(c => ({ ...c, quoteAmounts: { ...c.quoteAmounts, [cat]: amount } }));
      }
      return updated;
    });
  };

  const setAdderAndRefresh = (cat: string, idx: number, val: number) => {
    setMiscAdders(prev => {
      const arr = [...(prev[cat] ?? Array(DEFAULT_SUPPLIERS.length).fill(0))];
      arr[idx] = val;
      const updated = { ...prev, [cat]: arr };
      const sel = selectedSupplier[cat];
      if (sel !== undefined) {
        let amount = 0;
        if (sel === "lowest") {
          const totals = supplierNames.map((_, i) => (lumpSums[cat]?.[i] ?? 0) + (i === idx ? val : (prev[cat]?.[i] ?? 0)));
          const nonZero = totals.filter(t => t > 0);
          amount = nonZero.length > 0 ? Math.min(...nonZero) : 0;
        } else {
          amount = (lumpSums[cat]?.[sel as number] ?? 0) + (sel === idx ? val : prev[cat]?.[sel as number] ?? 0);
        }
        setCfg(c => ({ ...c, quoteAmounts: { ...c.quoteAmounts, [cat]: amount } }));
      }
      return updated;
    });
  };

  const fmt2 = (n: number) => n > 0 ? n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0";

  if (categories.length === 0) {
    return (
      <div style={{ padding: "40px 24px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
        No quoted items found in this estimate. Mark items as "Quote" in the takeoff forms or item editor.
      </div>
    );
  }

  const catItems = quoteItems.filter(i => parseCategory(i.category).category === activeCat);

  return (
    <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Category selector */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>Available Quotes:</span>
        <select value={activeCat}
          onChange={e => { setActiveCat(e.target.value); ensureCat(e.target.value); }}
          style={{ padding: "5px 12px", border: "1px solid var(--border-strong)", borderRadius: "var(--r-sm)", fontSize: 13, background: "white", minWidth: 220, fontWeight: 600 }}>
          {categories.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>

      {activeCat && (
        <div style={{ border: "1px solid var(--border-strong)", borderRadius: "var(--r-md)", overflow: "hidden" }}>

          {/* Items table */}
          {catItems.length > 0 && (
            <>
              <div style={{ background: "#f4f8fc", padding: "7px 12px", fontSize: 11, fontWeight: 700, color: "#2a4a6a", textTransform: "uppercase" }}>
                Prices by Item
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <TH w={80}>Design.</TH>
                    <TH>Description</TH>
                    <TH w={55} right>Qty</TH>
                    {supplierNames.map((_, i) => <TH key={i} w={100} right>{supplierNames[i]}</TH>)}
                  </tr>
                </thead>
                <tbody>
                  {catItems.map((item, idx) => (
                    <tr key={item.id} style={{ background: idx % 2 === 0 ? "white" : "#f4f8fc", borderBottom: "1px solid #d0e0ec" }}>
                      <TD mono muted>{item.assembly_id ?? "—"}</TD>
                      <TD>{item.description}</TD>
                      <TD mono right>{item.qty}</TD>
                      {supplierNames.map((_, i) => <TD key={i} mono right muted>0.00</TD>)}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: "#f0f4f8" }}>
                    <td colSpan={3} style={{ padding: "5px 8px", fontWeight: 700, fontSize: 11, textAlign: "right" }}>Subtotal</td>
                    {supplierNames.map((_, i) => (
                      <td key={i} style={{ padding: "5px 8px", textAlign: "right", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 11 }}>$0.00</td>
                    ))}
                  </tr>
                </tfoot>
              </table>
            </>
          )}

          {/* Lump Sum section */}
          <div style={{ padding: "12px 16px", background: "#fffbeb", borderTop: catItems.length > 0 ? "2px solid #fde68a" : "none" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#d97706", marginBottom: 12 }}>
              Lump Sum Quotes — Override item prices with a lump sum by supplier
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ width: 100, padding: "4px 6px", background: "#dce8f0", fontSize: 11, fontWeight: 700, color: "#2a4a6a", textAlign: "left", borderRight: "1px solid #b8d4e8" }} />
                  {supplierNames.map((name, i) => (
                    <th key={i} style={{ padding: "4px 6px", background: "#dce8f0", borderRight: "1px solid #b8d4e8", textAlign: "center" }}>
                      {/* Editable supplier name */}
                      <input
                        value={name}
                        onChange={e => setSupplierNames(prev => prev.map((n, j) => j === i ? e.target.value : n))}
                        style={{ width: "100%", padding: "3px 5px", border: "1px solid #aab", borderRadius: 2, fontSize: 11, fontWeight: 700, textAlign: "center", fontFamily: "var(--font-body)", background: "white", color: "#2a4a6a", textTransform: "uppercase" }}
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Lump sum row */}
                <tr style={{ background: "white" }}>
                  <td style={{ padding: "6px 8px", fontSize: 12, fontWeight: 700, borderRight: "1px solid #d0e0ec" }}>$ Lump Sum</td>
                  {supplierNames.map((_, i) => (
                    <td key={i} style={{ padding: "4px 6px", borderRight: "1px solid #d0e0ec" }}>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={lumpSums[activeCat]?.[i] ?? 0}
                        onChange={e => setLumpAndRefresh(activeCat, i, parseFloat(e.target.value) || 0)}
                        style={{ width: "100%", padding: "5px 8px", border: "1px solid var(--border-strong)", borderRadius: 3, fontFamily: "var(--font-mono)", fontSize: 13, textAlign: "right", background: (selectedSupplier[activeCat] === i) ? "#e8f0fe" : "white", fontWeight: selectedSupplier[activeCat] === i ? 700 : 400 }}
                      />
                    </td>
                  ))}
                </tr>
                {/* Misc adder row */}
                <tr style={{ background: "#f8f8f8" }}>
                  <td style={{ padding: "6px 8px", fontSize: 12, color: "var(--text-muted)", borderRight: "1px solid #d0e0ec" }}>Misc. Adder</td>
                  {supplierNames.map((_, i) => (
                    <td key={i} style={{ padding: "4px 6px", borderRight: "1px solid #d0e0ec" }}>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={miscAdders[activeCat]?.[i] ?? 0}
                        onChange={e => setAdderAndRefresh(activeCat, i, parseFloat(e.target.value) || 0)}
                        style={{ width: "100%", padding: "5px 8px", border: "1px solid var(--border-strong)", borderRadius: 3, fontFamily: "var(--font-mono)", fontSize: 13, textAlign: "right" }}
                      />
                    </td>
                  ))}
                </tr>
                {/* Totals row */}
                <tr style={{ background: "#f0f4f8", borderTop: "2px solid #7aaac8" }}>
                  <td style={{ padding: "6px 8px", fontSize: 12, fontWeight: 700, borderRight: "1px solid #d0e0ec" }}>Totals</td>
                  {supplierNames.map((_, i) => {
                    const total = supplierTotal(activeCat, i);
                    const isSelected = selectedSupplier[activeCat] === i;
                    return (
                      <td key={i} style={{ padding: "6px 8px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: isSelected ? 700 : 500, color: isSelected ? "var(--accent)" : "var(--text-primary)", borderRight: "1px solid #d0e0ec", background: isSelected ? "#e8f0fe" : "transparent" }}>
                        {total > 0 ? fmt2(total) : "0.00"}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Total to use — radio buttons */}
          <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap", background: "white" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>Total to use:</span>
            {supplierNames.map((name, i) => (
              <label key={i} style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", fontSize: 13 }}>
                <input
                  type="radio"
                  name={`supplier-${activeCat}`}
                  checked={selectedSupplier[activeCat] === i}
                  onChange={() => selectSupplier(activeCat, i)}
                  style={{ accentColor: "var(--accent)" }}
                />
                {name}
              </label>
            ))}
            <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", fontSize: 13 }}>
              <input
                type="radio"
                name={`supplier-${activeCat}`}
                checked={selectedSupplier[activeCat] === "lowest"}
                onChange={() => selectSupplier(activeCat, "lowest")}
                style={{ accentColor: "var(--accent)" }}
              />
              Lowest Available
            </label>
          </div>

          {/* Quote amount result */}
          <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 14, background: "#f4f8fc" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>
              Quote amount for {activeCat}:
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>$</span>
              <input
                type="number"
                min={0}
                step={0.01}
                value={cfg.quoteAmounts[activeCat] ?? 0}
                onChange={e => setCfg(c => ({ ...c, quoteAmounts: { ...c.quoteAmounts, [activeCat]: parseFloat(e.target.value) || 0 } }))}
                style={{ padding: "6px 10px", border: "2px solid var(--accent)", borderRadius: "var(--r-sm)", fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 700, width: 170, textAlign: "right", color: "var(--accent)", background: "white" }}
              />
            </div>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              This amount will appear in the Totals as quoted material
            </span>
            {selectedSupplier[activeCat] !== undefined && (
              <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--accent)", fontWeight: 600 }}>
                Using: {selectedSupplier[activeCat] === "lowest" ? "Lowest Available" : supplierNames[selectedSupplier[activeCat] as number]}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Summary across all categories */}
      {categories.length > 1 && (
        <div style={{ border: "1px solid var(--border)", borderRadius: "var(--r-md)", overflow: "hidden" }}>
          <div style={{ padding: "7px 12px", background: "#dce8f0", fontSize: 11, fontWeight: 700, color: "#2a4a6a", textTransform: "uppercase" }}>
            All Quote Categories — Total
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><TH>Category</TH><TH w={180} right>Selected Amount</TH></tr></thead>
            <tbody>
              {categories.map((cat, idx) => (
                <tr key={cat} style={{ background: idx % 2 === 0 ? "white" : "#f4f8fc", borderBottom: "1px solid #d0e0ec" }}>
                  <TD>{cat}</TD>
                  <TD mono right bold={!!cfg.quoteAmounts[cat]}>
                    {cfg.quoteAmounts[cat] ? `$${fmt2(cfg.quoteAmounts[cat])}` : <span style={{ color:"var(--text-muted)" }}>Not set</span>}
                  </TD>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: "#1a3a6a" }}>
                <td style={{ padding: "7px 8px", color: "white", fontWeight: 700, fontSize: 12 }}>Total Quoted Material</td>
                <td style={{ padding: "7px 8px", textAlign: "right", color: "white", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 14 }}>
                  ${fmt2(Object.values(cfg.quoteAmounts).reduce((s, v) => s + v, 0))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}


// ── SALES TAX ──────────────────────────────────────────────────────────────

function SalesTaxReport({ items, cfg, totals }: { items: LineItem[]; cfg: LaborConfig; totals: BidTotals }) {
  return (
    <div style={{ padding: "16px 24px", maxWidth: 540 }}>
      <div style={{ border: "1px solid var(--border)", borderRadius: "var(--r-md)", overflow: "hidden" }}>
        {[
          ["Non-Quoted Material", totals.nonQuotedMaterial, false],
          ["Quoted Material", totals.quotedMaterial, false],
          ["Total Material (taxable)", totals.totalMaterial, true],
          [`Tax Rate`, cfg.taxRate, false, "%"],
          ["Sales Tax Due", totals.salesTax, true],
        ].map(([label, val, bold, suffix], i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "9px 16px", borderBottom: "1px solid #d0e0ec", background: bold ? "#f0f6ff" : i % 2 === 0 ? "white" : "#f4f8fc" }}>
            <span style={{ fontSize: 13, fontWeight: bold ? 700 : 400, color: bold ? "#1a3a6a" : "var(--text-secondary)" }}>{label as string}</span>
            <span style={{ fontFamily: "var(--font-mono)", fontWeight: bold ? 700 : 500, fontSize: bold ? 15 : 13 }}>
              {suffix === "%" ? `${val}%` : `$${fmt(val as number)}`}
            </span>
          </div>
        ))}
      </div>
      {cfg.taxRate === 0 && (
        <div style={{ marginTop: 12, padding: "8px 12px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "var(--r-md)", fontSize: 12, color: "#92400e" }}>
          Tax rate is 0%. Set it in the Totals report → Tax rate field.
        </div>
      )}
    </div>
  );
}

// ── TOTALS ─────────────────────────────────────────────────────────────────

function TotalsReport({ project, items, cfg, setCfg, totals, rate, activePanel, setPanel }: {
  project: Project; items: LineItem[]; cfg: LaborConfig;
  setCfg: React.Dispatch<React.SetStateAction<LaborConfig>>;
  totals: BidTotals; rate: number;
  activePanel: DetailPanel; setPanel: (p: DetailPanel) => void;
}) {
  const sqft = project.square_footage || 0;

  return (
    <div style={{ padding: "16px 24px", display: "flex", gap: 24, flexWrap: "wrap" }}>
      {/* Main totals column */}
      <div style={{ flex: 1, minWidth: 440, maxWidth: 600 }}>
        <div style={{ border: "2px solid #7aaac8", borderRadius: "var(--r-md)", overflow: "hidden" }}>
          <div style={{ background: "#1a3a6a", color: "white", padding: "10px 16px", fontWeight: 700, fontSize: 14 }}>
            Bid Totals — {project.name}
          </div>

          <div style={{ padding: "0 0 4px" }}>
            {/* Material */}
            <TotalsSection label="Material" />
            <ClickableLine label="Non-Quoted" value={totals.nonQuotedMaterial} indent onClick={() => setPanel("non-quoted")} active={activePanel === "non-quoted"} />
            <ClickableLine label="Quotes" value={totals.quotedMaterial} indent onClick={() => setPanel("quotes-detail")} active={activePanel === "quotes-detail"} />
            {/* Warning: quote categories with items but no amount entered */}
            {(() => {
              const quoteItems = items.filter(i => i.unit_cost === 0 && i.qty > 0);
              const quoteCategories = Array.from(new Set(quoteItems.map(i => {
                const parts = i.category.split("|");
                return parts[0].trim();
              })));
              const missing = quoteCategories.filter(cat => !(cfg.quoteAmounts[cat] > 0));
              if (missing.length === 0) return null;
              return (
                <div style={{
                  margin: "2px 16px 4px",
                  padding: "7px 10px",
                  background: "#fff7ed",
                  border: "1px solid #fed7aa",
                  borderLeft: "3px solid #f97316",
                  borderRadius: 3,
                }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#c2410c", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
                    ⚠ Quote amounts not entered
                  </div>
                  <div style={{ fontSize: 11, color: "#9a3412", lineHeight: 1.5 }}>
                    The following quote sections have items assigned but <strong>no dollar amount entered</strong>. Go to the Quotes report to enter supplier pricing before submitting your bid:
                  </div>
                  <ul style={{ margin: "5px 0 0 14px", padding: 0, fontSize: 11, color: "#c2410c", fontWeight: 600 }}>
                    {missing.map(cat => <li key={cat}>{cat}</li>)}
                  </ul>
                </div>
              );
            })()}
            <ClickableLine label={`Sales Tax (${cfg.taxRate}%)`} value={totals.salesTax} indent onClick={() => { }} active={false}
              right={
                <input type="number" value={cfg.taxRate} min={0} max={30} step={0.01}
                  onChange={e => setCfg(c => ({ ...c, taxRate: parseFloat(e.target.value) || 0 }))}
                  style={{ width: 60, padding: "2px 6px", border: "1px solid var(--border-strong)", borderRadius: 3, fontFamily: "var(--font-mono)", fontSize: 11, textAlign: "right" }} />
              } />
            <TotalsBold label="Total Material" value={totals.totalMaterialWithTax} />

            {/* Labor */}
            <TotalsSection label="Labor" />
            <ClickableLine
              label={`Direct (${fmtHrs(totals.directLaborHours)} hours  @  $${fmt(rate)})`}
              value={totals.directLaborCost} indent
              onClick={() => setPanel("labor-rates")} active={activePanel === "labor-rates"}
            />
            <ClickableLine label="Non-Productive" value={totals.nonProductiveLaborCost} indent onClick={() => setPanel("non-productive")} active={activePanel === "non-productive"} />
            <TotalsBold label={`Total Labor   (${fmtHrs(totals.totalLaborHours)} hours)`} value={totals.totalLaborCost} />

            {/* Expenses */}
            <ClickableLine label="Direct Job Expenses" value={totals.directJobExpenses} onClick={() => setPanel("job-expenses")} active={activePanel === "job-expenses"} />
            <ClickableLine label="Tools and Miscellaneous Materials" value={totals.toolsMiscMaterials} onClick={() => setPanel("non-quoted")} active={false} />
            <ClickableLine label="Subcontracts" value={totals.subcontracts} onClick={() => setPanel("subcontracts")} active={activePanel === "subcontracts"} />

            <TotalsBold label="Job Subtotal (Prime Cost)" value={totals.jobSubtotal} large />

            {/* OH & Profit */}
            <ClickableLine label={`Overhead (${cfg.overheadPct}%)`} value={totals.overhead}
              onClick={() => setPanel("overhead")} active={activePanel === "overhead"}
              right={
                <input type="number" value={cfg.overheadPct} min={0} max={100} step={0.5}
                  onChange={e => setCfg(c => ({ ...c, overheadPct: parseFloat(e.target.value) || 0 }))}
                  style={{ width: 50, padding: "2px 6px", border: "1px solid var(--border-strong)", borderRadius: 3, fontFamily: "var(--font-mono)", fontSize: 11, textAlign: "right" }} />
              } />
            <ClickableLine label={`Profit (${cfg.profitPct}%)`} value={totals.profit}
              onClick={() => setPanel("profit")} active={activePanel === "profit"}
              right={
                <input type="number" value={cfg.profitPct} min={0} max={100} step={0.5}
                  onChange={e => setCfg(c => ({ ...c, profitPct: parseFloat(e.target.value) || 0 }))}
                  style={{ width: 50, padding: "2px 6px", border: "1px solid var(--border-strong)", borderRadius: 3, fontFamily: "var(--font-mono)", fontSize: 11, textAlign: "right" }} />
              } />

            <TotalsBold label="Job Total" value={totals.jobTotal} large />

            <ClickableLine label="Bond" value={totals.bond} onClick={() => setPanel("bond")} active={activePanel === "bond"}
              right={
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <input type="number" value={cfg.bondPct} min={0} max={10} step={0.1}
                    onChange={e => setCfg(c => ({ ...c, bondPct: parseFloat(e.target.value) || 0 }))}
                    style={{ width: 45, padding: "2px 6px", border: "1px solid var(--border-strong)", borderRadius: 3, fontFamily: "var(--font-mono)", fontSize: 11, textAlign: "right" }} />
                  <span style={{ fontSize: 10, color: "var(--text-muted)" }}>%</span>
                </div>
              } />
            <TotalsBold label="Job Total with Bond" value={totals.jobTotalWithBond} large />

            {/* Actual bid price */}
            <div style={{ padding: "8px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff8ed", borderTop: "2px solid #fde68a" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#92400e", cursor: "pointer", textDecoration: "underline dotted" }} onClick={() => setPanel("actual-bid")}>
                Actual Bid Price
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)" }}>$</span>
                <BidPriceInput
                  value={cfg.actualBidPrice}
                  placeholder={fmt(totals.jobTotalWithBond)}
                  onChange={v => setCfg(c => ({ ...c, actualBidPrice: v }))}
                  inputStyle={{ width: 150, padding: "4px 8px", border: "2px solid #fde68a", borderRadius: 4, fontFamily: "var(--font-mono)", fontSize: 16, fontWeight: 800, color: "#92400e", textAlign: "right" as const }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Analytics column */}
      <div style={{ width: 280, flexShrink: 0, display: "flex", flexDirection: "column", gap: 12 }}>
        {[
          ["Material to Direct Labor Ratio", totals.matToLaborRatio.toFixed(2), ""],
          ["Prime Cost / sq ft", sqft > 0 ? `$${fmt(totals.jobSubtotal / sqft)}` : "—", ""],
          ["Job Total / sq ft", sqft > 0 ? `$${fmt(totals.jobTotal / sqft)}` : "—", ""],
          ["Actual Bid / sq ft", sqft > 0 ? `$${fmt(totals.actualBidPrice / sqft)}` : "—", ""],
          ["Labor Cost / sq ft", sqft > 0 ? `$${fmt(totals.totalLaborCost / sqft)}` : "—", ""],
          ["Labor Hours / sq ft", sqft > 0 ? fmtHrs(totals.totalLaborHours / sqft) : "—", ""],
          ["Gross Profit $", `$${fmt(totals.grossProfitDollar)}`, ""],
          ["Gross Profit %", `${totals.grossProfitPct.toFixed(2)}%`, ""],
        ].map(([label, value]) => (
          <div key={label} style={{ padding: "8px 14px", background: "white", border: "1px solid var(--border)", borderRadius: "var(--r-md)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{label}</span>
            <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 13, color: "var(--text-primary)" }}>{value}</span>
          </div>
        ))}
        {sqft > 0 && (
          <div style={{ padding: "6px 14px", fontSize: 11, color: "var(--text-muted)" }}>
            Square footage: {sqft.toLocaleString()} sq ft
          </div>
        )}
      </div>
    </div>
  );
}

function TotalsSection({ label }: { label: string }) {
  return <div style={{ padding: "8px 16px 2px", fontSize: 13, fontWeight: 700, color: "#1a3a6a", borderTop: "1px solid #d0e0ec", marginTop: 4 }}>{label}</div>;
}

function TotalsBold({ label, value, large }: { label: string; value: number; large?: boolean }) {
  return (
    <div style={{ padding: "7px 16px", display: "flex", justifyContent: "space-between", background: large ? "#e8f0fe" : "#f0f4f8", borderTop: "1px solid #7aaac8" }}>
      <span style={{ fontSize: large ? 14 : 13, fontWeight: 800, color: "#1a3a6a" }}>$ {label}</span>
      <span style={{ fontFamily: "var(--font-mono)", fontWeight: 800, fontSize: large ? 16 : 14, color: "#1a3a6a" }}>{fmt(value)}</span>
    </div>
  );
}

function ClickableLine({ label, value, indent, onClick, active, right }: {
  label: string; value: number; indent?: boolean;
  onClick: () => void; active: boolean; right?: React.ReactNode;
}) {
  return (
    <div
      style={{ padding: "6px 16px 6px " + (indent ? "28px" : "16px"), display: "flex", justifyContent: "space-between", alignItems: "center", background: active ? "#e8f0fe" : "transparent", cursor: "pointer", transition: "background var(--t-fast)", borderLeft: active ? "3px solid var(--accent)" : "3px solid transparent" }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = "#f4f8fc"; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
      onClick={onClick}
    >
      <span style={{ fontSize: 12, color: active ? "var(--accent)" : "var(--accent)", textDecoration: "underline dotted", fontWeight: active ? 700 : 400 }}>
        {label}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {right && <div onClick={e => e.stopPropagation()}>{right}</div>}
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", minWidth: 100, textAlign: "right" }}>
          {fmt(value)}
        </span>
        <ChevronRight size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
      </div>
    </div>
  );
}

// ── SELECT BID SUMMARY ─────────────────────────────────────────────────────

function SelectBidSummary({ project, items, cfg, setCfg, totals, rate, setPanel }: {
  project: Project; items: LineItem[]; cfg: LaborConfig;
  setCfg: React.Dispatch<React.SetStateAction<LaborConfig>>;
  totals: BidTotals; rate: number; setPanel: (p: DetailPanel) => void;
}) {
  const allSections = Array.from(new Set(items.map(i => parseCategory(i.category).section)));
  const [selected, setSelected] = useState<Set<string>>(new Set(allSections));
  const toggle = (s: string) => setSelected(prev => { const n = new Set(prev); n.has(s) ? n.delete(s) : n.add(s); return n; });
  const filteredItems = items.filter(i => selected.has(parseCategory(i.category).section));
  const filteredTotals = computeTotals(filteredItems, cfg);

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      {/* Section selector */}
      <div className="no-print" style={{ width: 200, flexShrink: 0, borderRight: "2px solid var(--border-strong)", display: "flex", flexDirection: "column", background: "white" }}>
        <div style={{ padding: "10px 12px", background: "#dce8f0", borderBottom: "1px solid var(--border)", fontSize: 11, fontWeight: 700, color: "#2a4a6a", textTransform: "uppercase" }}>Sections</div>
        <div style={{ flex: 1, overflow: "auto" }}>
          {allSections.map(s => (
            <label key={s} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", borderBottom: "1px solid #f0f4f8", cursor: "pointer", background: selected.has(s) ? "#f0f6ff" : "white" }}>
              <input type="checkbox" checked={selected.has(s)} onChange={() => toggle(s)} style={{ width: "auto", accentColor: "var(--accent)" }} />
              <span style={{ fontSize: 12 }}>{s}</span>
            </label>
          ))}
        </div>
        <div style={{ padding: "8px 12px", borderTop: "1px solid var(--border)", display: "flex", gap: 6 }}>
          <button onClick={() => setSelected(new Set(allSections))} style={smallBtn}>Select All</button>
          <button onClick={() => setSelected(new Set())} style={smallBtn}>Clear All</button>
        </div>
      </div>

      {/* Filtered totals */}
      <div style={{ flex: 1, overflow: "auto" }}>
        <TotalsReport project={project} items={filteredItems} cfg={cfg} setCfg={setCfg} totals={filteredTotals} rate={rate} activePanel={null} setPanel={setPanel} />
      </div>
    </div>
  );
}

// ── DETAIL PANEL OVERLAY ───────────────────────────────────────────────────

function DetailPanelOverlay({ panel, cfg, setCfg, items, totals, rate, onClose }: {
  panel: DetailPanel; cfg: LaborConfig;
  setCfg: React.Dispatch<React.SetStateAction<LaborConfig>>;
  items: LineItem[]; totals: BidTotals; rate: number; onClose: () => void;
}) {
  const titles: Record<string, string> = {
    "labor-rates":    "Labor Rates",
    "non-quoted":     "Non-Quoted Material Detail",
    "quotes-detail":  "Quoted Material",
    "non-productive": "Non-Productive Labor",
    "job-expenses":   "Direct Job Expenses",
    "subcontracts":   "Subcontracts",
    "overhead":       "Overhead",
    "profit":         "Profit",
    "bond":           "Bond",
    "actual-bid":     "Actual Bid Price",
  };

  return (
    <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(2px)" }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "white", border: "1px solid var(--border-strong)", borderRadius: "var(--r-lg)", maxWidth: 900, width: "95%", maxHeight: "85vh", boxShadow: "var(--shadow-lg)", display: "flex", flexDirection: "column", animation: "fadeIn 0.18s ease" }}>

        {/* Panel header */}
        <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#1a3a6a", borderRadius: "var(--r-lg) var(--r-lg) 0 0" }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: "white" }}>{titles[panel ?? ""] ?? panel}</span>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", color: "white", cursor: "pointer", padding: "3px 8px", borderRadius: "var(--r-sm)", display: "flex", alignItems: "center" }}>
            <X size={14} />
          </button>
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: "16px 20px" }}>
          {panel === "labor-rates" && <LaborRatesPanel cfg={cfg} setCfg={setCfg} items={items} />}
          {panel === "non-quoted"  && <NonQuotedPanel items={items} />}
          {panel === "quotes-detail" && <QuotesDetailPanel items={items} cfg={cfg} setCfg={setCfg} />}
          {panel === "non-productive" && <NonProdPanel cfg={cfg} setCfg={setCfg} totals={totals} />}
          {panel === "job-expenses"   && <JobExpPanel cfg={cfg} setCfg={setCfg} totals={totals} />}
          {panel === "subcontracts"   && <SubcontractsPanel cfg={cfg} setCfg={setCfg} />}
          {panel === "overhead" && <PctPanel label="Overhead" pct={cfg.overheadPct} base={totals.jobSubtotal} onChange={v => setCfg(c => ({ ...c, overheadPct: v }))} />}
          {panel === "profit"   && <PctPanel label="Profit" pct={cfg.profitPct} base={totals.jobSubtotal + totals.overhead} onChange={v => setCfg(c => ({ ...c, profitPct: v }))} />}
          {panel === "bond"     && <PctPanel label="Bond" pct={cfg.bondPct} base={totals.jobTotal} onChange={v => setCfg(c => ({ ...c, bondPct: v }))} />}
          {panel === "actual-bid" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>Actual Bid Price ($)</label>
              <BidPriceInput
                value={cfg.actualBidPrice}
                onChange={v => setCfg(c => ({ ...c, actualBidPrice: v }))}
                inputStyle={{ padding: "10px 14px", border: "2px solid var(--accent)", borderRadius: "var(--r-md)", fontFamily: "var(--font-mono)", fontSize: 20, fontWeight: 700, color: "var(--accent)", width: 220, textAlign: "right" as const }}
              />
              <div style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>Calculated total: ${fmt(totals.jobTotalWithBond)}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── LABOR RATES PANEL (matches screenshot exactly) ─────────────────────────

function LaborRatesPanel({ cfg, setCfg, items }: { cfg: LaborConfig; setCfg: React.Dispatch<React.SetStateAction<LaborConfig>>; items: LineItem[] }) {
  const totalHrs  = items.reduce((s, i) => s + extLaborHrs(i), 0);
  const totalPct  = cfg.crew.reduce((s, c) => s + c.pctOfTotal, 0);
  const rate      = blendedRate(cfg.crew);
  const totalCost = totalHrs * rate;

  const update = (idx: number, field: keyof CrewCategory, val: string | number) =>
    setCfg(c => ({ ...c, crew: c.crew.map((row, i) => i === idx ? { ...row, [field]: val } : row) }));

  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 10 }}>
        Rates effective current — set % of total hours for each crew category
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <TH>Category</TH>
            <TH w={80} right>% of Total</TH>
            <TH w={85} right>Hours</TH>
            <TH w={65} right>Days</TH>
            <TH w={90} right>Base Rate</TH>
            <TH w={75} right>Burden $</TH>
            <TH w={75} right>Burden %</TH>
            <TH w={85} right>Total Rate</TH>
            <TH w={100} right>Extended</TH>
          </tr>
        </thead>
        <tbody>
          {cfg.crew.map((c, idx) => {
            const hrs = totalHrs * c.pctOfTotal / 100;
            const tr  = totalRate(c);
            return (
              <tr key={idx} style={{ background: idx % 2 === 0 ? "white" : "#f4f8fc", borderBottom: "1px solid #d0e0ec" }}>
                <td style={{ padding: "3px 6px" }}>
                  <input value={c.name} onChange={e => update(idx, "name", e.target.value)}
                    style={{ ...inlineInput, width: 160 }} placeholder="—" />
                </td>
                <td style={{ padding: "3px 6px" }}>
                  <input type="number" value={c.pctOfTotal} min={0} max={100} step={0.5}
                    onChange={e => update(idx, "pctOfTotal", parseFloat(e.target.value) || 0)}
                    style={{ ...inlineInput, textAlign: "right", width: 65 }} />
                </td>
                <td style={{ padding: "3px 8px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 11, color: hrs > 0 ? "var(--text-primary)" : "var(--text-muted)" }}>
                  {hrs > 0 ? fmtHrs(hrs) : "0.000"}
                </td>
                <td style={{ padding: "3px 8px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)" }}>
                  {hrs > 0 ? fmtHrs(hrs / 8) : "0.00"}
                </td>
                <td style={{ padding: "3px 6px" }}>
                  <input type="number" value={c.baseRate} min={0} step={0.01}
                    onChange={e => update(idx, "baseRate", parseFloat(e.target.value) || 0)}
                    style={{ ...inlineInput, textAlign: "right", width: 75 }} />
                </td>
                <td style={{ padding: "3px 6px" }}>
                  <input type="number" value={c.burdenDollars} min={0} step={0.01}
                    onChange={e => update(idx, "burdenDollars", parseFloat(e.target.value) || 0)}
                    style={{ ...inlineInput, textAlign: "right", width: 65 }} />
                </td>
                <td style={{ padding: "3px 6px" }}>
                  <input type="number" value={c.burdenPct} min={0} step={0.1}
                    onChange={e => update(idx, "burdenPct", parseFloat(e.target.value) || 0)}
                    style={{ ...inlineInput, textAlign: "right", width: 60 }} />
                </td>
                <td style={{ padding: "3px 8px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600 }}>
                  {c.baseRate > 0 ? fmt(tr) : "0.00"}
                </td>
                <td style={{ padding: "3px 8px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: hrs > 0 ? 700 : 400, color: hrs > 0 ? "var(--accent)" : "var(--text-muted)" }}>
                  {hrs > 0 ? fmt(hrs * tr) : "0.00"}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr style={{ background: "#1a3a6a" }}>
            <td style={{ padding: "7px 8px", color: "white", fontWeight: 700, fontSize: 12 }}>Current Total</td>
            <td style={{ padding: "7px 8px", textAlign: "right", color: totalPct === 100 ? "white" : "#fca5a5", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 12 }}>{totalPct.toFixed(3)}</td>
            <td style={{ padding: "7px 8px", textAlign: "right", color: "white", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 12 }}>{fmtHrs(totalHrs)}</td>
            <td style={{ padding: "7px 8px", textAlign: "right", color: "rgba(255,255,255,0.7)", fontFamily: "var(--font-mono)", fontSize: 12 }}>{fmtHrs(totalHrs / 8)}</td>
            <td style={{ padding: "7px 8px", textAlign: "right", color: "white", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 12 }}>{fmt(rate)}</td>
            <td colSpan={3} />
            <td style={{ padding: "7px 8px", textAlign: "right", color: "white", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 13 }}>${fmt(totalCost)}</td>
          </tr>
        </tfoot>
      </table>
      <div style={{ marginTop: 8, fontSize: 11, color: "var(--text-muted)", display: "flex", gap: 20 }}>
        <span>Number of job hours that must be assigned (100%): <strong style={{ color: totalPct !== 100 ? "#dc2626" : "var(--text-primary)" }}>{fmtHrs(totalHrs)}</strong></span>
        <span>↑ Average of labor rate w/burden: <strong>${fmt(rate)}</strong></span>
      </div>
      {totalPct !== 100 && (
        <div style={{ marginTop: 8, padding: "6px 12px", background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: "var(--r-sm)", fontSize: 12, color: "#dc2626" }}>
          ⚠ Crew percentages total {totalPct.toFixed(1)}% — must equal 100%
        </div>
      )}
    </div>
  );
}

// ── Non-Quoted Panel ───────────────────────────────────────────────────────

function NonQuotedPanel({ items }: { items: LineItem[] }) {
  const priced = items.filter(i => !isQuote(i) && extMat(i) > 0);
  const total  = priced.reduce((s, i) => s + extMat(i), 0);
  return (
    <div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr><TH w={85}>Item #</TH><TH>Description</TH><TH w={90} right>Qty</TH><TH w={110} right>Price</TH><TH w={100} right>Ext Price</TH></tr></thead>
        <tbody>
          {priced.map((item, idx) => (
            <tr key={item.id} style={{ background: idx % 2 === 0 ? "white" : "#f4f8fc", borderBottom: "1px solid #d0e0ec" }}>
              <TD mono muted>{item.assembly_id ?? "—"}</TD>
              <TD>{item.description}</TD>
              <TD mono right>{item.qty.toLocaleString()}</TD>
              <TD mono right>{`${fmt(item.unit_cost)} ${displayUnit(item.unit)}`}</TD>
              <TD mono right bold>{fmt(extMat(item))}</TD>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ background: "#1a3a6a" }}>
            <td colSpan={4} style={{ padding: "6px 8px", color: "white", fontWeight: 700 }}>Total Non-Quoted Material</td>
            <td style={{ padding: "6px 8px", textAlign: "right", color: "white", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 14 }}>{fmt(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function QuotesDetailPanel({ items, cfg, setCfg }: { items: LineItem[]; cfg: LaborConfig; setCfg: React.Dispatch<React.SetStateAction<LaborConfig>> }) {
  const qItems = items.filter(i => isQuote(i));
  const cats   = Array.from(new Set(qItems.map(i => parseCategory(i.category).category)));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {cats.map(cat => (
        <div key={cat} style={{ border: "1px solid var(--border)", borderRadius: "var(--r-md)", overflow: "hidden" }}>
          <div style={{ padding: "7px 12px", background: "#dce8f0", fontWeight: 700, fontSize: 12, color: "#2a4a6a", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>{cat}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Amount: $</span>
              <input type="number" min={0} step={0.01} value={cfg.quoteAmounts[cat] ?? 0}
                onChange={e => setCfg(c => ({ ...c, quoteAmounts: { ...c.quoteAmounts, [cat]: parseFloat(e.target.value) || 0 } }))}
                style={{ width: 120, padding: "3px 8px", border: "1px solid var(--accent)", borderRadius: 4, fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: "var(--accent)", textAlign: "right" }} />
            </div>
          </div>
          {qItems.filter(i => parseCategory(i.category).category === cat).map((item, idx) => (
            <div key={item.id} style={{ padding: "6px 12px", fontSize: 12, background: idx % 2 === 0 ? "white" : "#f4f8fc", borderBottom: "1px solid #d0e0ec" }}>
              {item.description}
            </div>
          ))}
        </div>
      ))}
      <div style={{ padding: "8px 12px", background: "#f0f6ff", borderRadius: "var(--r-md)", fontSize: 12, color: "var(--accent)" }}>
        Total Quoted Material: <strong>${fmt(Object.values(cfg.quoteAmounts).reduce((s, v) => s + v, 0))}</strong>
      </div>
    </div>
  );
}



function PctPanel({ label, pct, base, onChange }: { label: string; pct: number; base: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>{label} Percentage</label>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input type="number" min={0} max={100} step={0.5} value={pct}
            onChange={e => onChange(parseFloat(e.target.value) || 0)}
            style={{ padding: "10px 14px", border: "2px solid var(--accent)", borderRadius: "var(--r-md)", fontFamily: "var(--font-mono)", fontSize: 20, fontWeight: 700, color: "var(--accent)", width: 100, textAlign: "right" }} />
          <span style={{ fontSize: 18, color: "var(--text-muted)" }}>%</span>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "12px 16px", background: "#f4f8fc", borderRadius: "var(--r-md)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
          <span style={{ color: "var(--text-secondary)" }}>Applied to base of</span>
          <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>${fmt(base)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 700 }}>
          <span style={{ color: "#1a3a6a" }}>{label} Amount</span>
          <span style={{ fontFamily: "var(--font-mono)", color: "var(--accent)" }}>${fmt(base * pct / 100)}</span>
        </div>
      </div>
    </div>
  );
}

// ── NON-PRODUCTIVE LABOR PANEL ────────────────────────────────────────────

function NonProdPanel({ cfg, setCfg, totals }: { cfg: LaborConfig; setCfg: React.Dispatch<React.SetStateAction<LaborConfig>>; totals: BidTotals }) {
  const mode = cfg.nonProdMode;
  const rows = cfg.nonProdRows;
  const grandTotal = mode === "lump" ? cfg.nonProdLumpSum : rows.reduce((s, r) => s + nonProdExtended(r), 0);

  const updateRow = (idx: number, field: keyof NonProdRow, val: string | number) =>
    setCfg(c => ({ ...c, nonProdRows: c.nonProdRows.map((r, i) => i === idx ? { ...r, [field]: val } : r) }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <ModeSwitch
        mode={mode}
        lumpValue={cfg.nonProdLumpSum}
        onModeChange={m => setCfg(c => ({ ...c, nonProdMode: m as "lump"|"breakdown" }))}
        onLumpChange={v => setCfg(c => ({ ...c, nonProdLumpSum: v }))}
        showPct={false}
      />
      {mode === "breakdown" && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><TH>Description</TH><TH w={90} right>Hours</TH><TH w={100} right>Rate $</TH><TH w={85} right>Factor ±%</TH><TH w={110} right>Extended</TH></tr></thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={idx} style={{ background: idx % 2 === 0 ? "white" : "#f4f8fc", borderBottom: "1px solid #d0e0ec" }}>
                <td style={{ padding: "3px 6px" }}>
                  <input value={r.description} onChange={e => updateRow(idx, "description", e.target.value)}
                    style={inlineInput} placeholder="—" />
                </td>
                <td style={{ padding: "3px 6px" }}>
                  <input type="number" value={r.hours || ""} min={0} step={0.5} placeholder="0.00"
                    onChange={e => updateRow(idx, "hours", parseFloat(e.target.value) || 0)}
                    style={{ ...inlineInput, textAlign: "right", width: 80 }} />
                </td>
                <td style={{ padding: "3px 6px" }}>
                  <input type="number" value={r.rate || ""} min={0} step={0.01} placeholder="0.00"
                    onChange={e => updateRow(idx, "rate", parseFloat(e.target.value) || 0)}
                    style={{ ...inlineInput, textAlign: "right", width: 90 }} />
                </td>
                <td style={{ padding: "3px 6px" }}>
                  <input type="number" value={r.factorPct || ""} min={-100} max={100} step={0.5} placeholder="0.00"
                    onChange={e => updateRow(idx, "factorPct", parseFloat(e.target.value) || 0)}
                    style={{ ...inlineInput, textAlign: "right", width: 75 }} />
                </td>
                <TD mono right bold={nonProdExtended(r) > 0}>{nonProdExtended(r) > 0 ? fmt(nonProdExtended(r)) : "0.00"}</TD>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: "#1a3a6a" }}>
              <td colSpan={4} style={{ padding: "6px 10px", color: "white", fontWeight: 700, fontSize: 12 }} />
              <td style={{ padding: "6px 10px", textAlign: "right", color: "white", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 14 }}>${fmt(grandTotal)}</td>
            </tr>
          </tfoot>
        </table>
      )}
      <PctModeSection mode={mode} cfg={cfg} setCfg={setCfg} totals={totals} field="nonProd" />
    </div>
  );
}

// ── DIRECT JOB EXPENSES PANEL ─────────────────────────────────────────────

function JobExpPanel({ cfg, setCfg, totals }: { cfg: LaborConfig; setCfg: React.Dispatch<React.SetStateAction<LaborConfig>>; totals: BidTotals }) {
  const mode = cfg.jobExpMode;
  const rows = cfg.jobExpRows;
  const grandTotal = mode === "lump" ? cfg.jobExpLumpSum
    : mode === "pct" ? (cfg.jobExpPctMode === "material" ? totals.totalMaterial : cfg.jobExpPctMode === "labor" ? totals.directLaborCost : totals.totalMaterial + totals.directLaborCost) * cfg.jobExpPct / 100
    : rows.reduce((s, r) => s + expenseTotal(r), 0);

  const updateRow = (idx: number, field: keyof ExpenseRow, val: string | number) =>
    setCfg(c => ({ ...c, jobExpRows: c.jobExpRows.map((r, i) => i === idx ? { ...r, [field]: val } : r) }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <ModeSwitch
        mode={mode === "pct" ? "pct" : mode}
        lumpValue={cfg.jobExpLumpSum}
        onModeChange={m => setCfg(c => ({ ...c, jobExpMode: m as "lump"|"breakdown"|"pct" }))}
        onLumpChange={v => setCfg(c => ({ ...c, jobExpLumpSum: v }))}
        showPct
      />
      {mode === "breakdown" && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><TH>Description</TH><TH w={90} right>Quantity</TH><TH w={110} right>Rate</TH><TH w={120} right>Total</TH></tr></thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={idx} style={{ background: idx % 2 === 0 ? "white" : "#f4f8fc", borderBottom: "1px solid #d0e0ec" }}>
                <td style={{ padding: "3px 6px" }}>
                  <input value={r.description} onChange={e => updateRow(idx, "description", e.target.value)}
                    style={inlineInput} placeholder="—" />
                </td>
                <td style={{ padding: "3px 6px" }}>
                  <input type="number" value={r.qty || ""} min={0} step={1} placeholder="0.00"
                    onChange={e => updateRow(idx, "qty", parseFloat(e.target.value) || 0)}
                    style={{ ...inlineInput, textAlign: "right", width: 80 }} />
                </td>
                <td style={{ padding: "3px 6px" }}>
                  <input type="number" value={r.rate || ""} min={0} step={0.01} placeholder="0.00"
                    onChange={e => updateRow(idx, "rate", parseFloat(e.target.value) || 0)}
                    style={{ ...inlineInput, textAlign: "right", width: 100 }} />
                </td>
                <TD mono right bold={expenseTotal(r) > 0}>{expenseTotal(r) > 0 ? fmt(expenseTotal(r)) : "0.00"}</TD>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: "#1a3a6a" }}>
              <td colSpan={3} style={{ padding: "6px 10px", color: "white", fontWeight: 700, fontSize: 12 }} />
              <td style={{ padding: "6px 10px", textAlign: "right", color: "white", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 14 }}>${fmt(grandTotal)}</td>
            </tr>
          </tfoot>
        </table>
      )}
      {mode === "pct" && (
        <PctModeSection mode="pct" cfg={cfg} setCfg={setCfg} totals={totals} field="jobExp" grandTotal={grandTotal} />
      )}
    </div>
  );
}

// ── SUBCONTRACTS PANEL ────────────────────────────────────────────────────

function SubcontractsPanel({ cfg, setCfg }: { cfg: LaborConfig; setCfg: React.Dispatch<React.SetStateAction<LaborConfig>> }) {
  const mode = cfg.subMode;
  const rows = cfg.subRows;
  const grandTotal = mode === "lump" ? cfg.subLumpSum : rows.reduce((s, r) => s + expenseTotal(r), 0);

  const updateRow = (idx: number, field: keyof ExpenseRow, val: string | number) =>
    setCfg(c => ({ ...c, subRows: c.subRows.map((r, i) => i === idx ? { ...r, [field]: val } : r) }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <ModeSwitch
        mode={mode}
        lumpValue={cfg.subLumpSum}
        onModeChange={m => setCfg(c => ({ ...c, subMode: m as "lump"|"breakdown" }))}
        onLumpChange={v => setCfg(c => ({ ...c, subLumpSum: v }))}
        showPct={false}
      />
      {mode === "breakdown" && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><TH>Description</TH><TH w={90} right>Quantity</TH><TH w={110} right>Rate</TH><TH w={120} right>Total</TH></tr></thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={idx} style={{ background: idx % 2 === 0 ? "white" : "#f4f8fc", borderBottom: "1px solid #d0e0ec" }}>
                <td style={{ padding: "3px 6px" }}>
                  <input value={r.description} onChange={e => updateRow(idx, "description", e.target.value)}
                    style={inlineInput} placeholder="—" />
                </td>
                <td style={{ padding: "3px 6px" }}>
                  <input type="number" value={r.qty || ""} min={0} step={1} placeholder="0.00"
                    onChange={e => updateRow(idx, "qty", parseFloat(e.target.value) || 0)}
                    style={{ ...inlineInput, textAlign: "right", width: 80 }} />
                </td>
                <td style={{ padding: "3px 6px" }}>
                  <input type="number" value={r.rate || ""} min={0} step={0.01} placeholder="0.00"
                    onChange={e => updateRow(idx, "rate", parseFloat(e.target.value) || 0)}
                    style={{ ...inlineInput, textAlign: "right", width: 100 }} />
                </td>
                <TD mono right bold={expenseTotal(r) > 0}>{expenseTotal(r) > 0 ? fmt(expenseTotal(r)) : "0.00"}</TD>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: "#1a3a6a" }}>
              <td colSpan={3} style={{ padding: "6px 10px", color: "white", fontWeight: 700, fontSize: 12 }} />
              <td style={{ padding: "6px 10px", textAlign: "right", color: "white", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 14 }}>${fmt(grandTotal)}</td>
            </tr>
          </tfoot>
        </table>
      )}
    </div>
  );
}

// ── Mode switch (lump sum / breakdown / pct) ───────────────────────────────

function ModeSwitch({ mode, lumpValue, onModeChange, onLumpChange, showPct }: {
  mode: string; lumpValue: number;
  onModeChange: (m: string) => void; onLumpChange: (v: number) => void;
  showPct: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13 }}>
        <input type="radio" name={`mode-${Math.random()}`} checked={mode === "lump"} onChange={() => onModeChange("lump")} style={{ accentColor: "var(--accent)" }} />
        <span>A lump sum: $</span>
        <input type="number" min={0} step={0.01} value={lumpValue || ""}
          disabled={mode !== "lump"} placeholder="0.00"
          onChange={e => onLumpChange(parseFloat(e.target.value) || 0)}
          style={{ width: 140, padding: "4px 8px", border: `1px solid ${mode === "lump" ? "var(--accent)" : "var(--border-strong)"}`, borderRadius: 4, fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 600, textAlign: "right", background: mode === "lump" ? "white" : "#f4f4f4", color: mode === "lump" ? "var(--accent)" : "var(--text-muted)" }} />
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13 }}>
        <input type="radio" checked={mode === "breakdown"} onChange={() => onModeChange("breakdown")} style={{ accentColor: "var(--accent)" }} />
        A breakdown by various categories
      </label>
      {showPct && (
        <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13 }}>
          <input type="radio" checked={mode === "pct"} onChange={() => onModeChange("pct")} style={{ accentColor: "var(--accent)" }} />
          A percentage of material, labor or both
        </label>
      )}
    </div>
  );
}

// ── Percentage sub-mode section ────────────────────────────────────────────

function PctModeSection({ mode, cfg, setCfg, totals, field, grandTotal }: {
  mode: string; cfg: LaborConfig;
  setCfg: React.Dispatch<React.SetStateAction<LaborConfig>>;
  totals: BidTotals; field: string; grandTotal?: number;
}) {
  if (mode !== "pct") return null;
  const pctMode = field === "jobExp" ? cfg.jobExpPctMode : "material";
  const pct     = field === "jobExp" ? cfg.jobExpPct : 0;
  const bases = {
    material: totals.totalMaterial,
    labor:    totals.directLaborCost,
    both:     totals.totalMaterial + totals.directLaborCost,
  };
  return (
    <div style={{ padding: "12px 14px", background: "#f0f6ff", borderRadius: "var(--r-md)", display: "flex", flexDirection: "column", gap: 8 }}>
      {(["material","labor","both"] as const).map(m => (
        <label key={m} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 12 }}>
          <input type="radio" checked={pctMode === m}
            onChange={() => setCfg(c => ({ ...c, jobExpPctMode: m }))}
            style={{ accentColor: "var(--accent)" }} />
          <input type="number" min={0} max={100} step={0.1} value={pctMode === m ? pct : 0}
            onChange={e => setCfg(c => ({ ...c, jobExpPct: parseFloat(e.target.value) || 0 }))}
            disabled={pctMode !== m}
            style={{ width: 70, padding: "3px 6px", border: "1px solid var(--border-strong)", borderRadius: 3, fontFamily: "var(--font-mono)", fontSize: 12, textAlign: "right" }} />
          <span>% of {m === "material" ? "material cost" : m === "labor" ? "direct labor cost" : "material and direct labor cost"}</span>
          {pctMode === m && <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--accent)", fontSize: 12 }}>= ${fmt(bases[m] * pct / 100)}</span>}
        </label>
      ))}
    </div>
  );
}

// ── Shared styles ──────────────────────────────────────────────────────────

const smallBtn: React.CSSProperties = {
  flex: 1, padding: "4px 0", fontSize: 11, fontWeight: 600, cursor: "pointer",
  background: "var(--bg-surface)", border: "1px solid var(--border-strong)",
  borderRadius: "var(--r-sm)", color: "var(--text-secondary)",
};

const smallInput: React.CSSProperties = {
  padding: "4px 8px", border: "1px solid var(--border-strong)", borderRadius: "var(--r-sm)",
  fontFamily: "var(--font-mono)", fontSize: 12, background: "white",
};

const inlineInput: React.CSSProperties = {
  padding: "3px 6px", border: "1px solid var(--border-strong)", borderRadius: 3,
  fontFamily: "var(--font-mono)", fontSize: 11, background: "white", width: "100%",
};

// ── BidPriceInput ───────────────────────────────────────────────────────────
// Text input that accepts formatted numbers with commas and decimals.
// Displays formatted value on blur, raw editing string while focused.
function BidPriceInput({ value, onChange, placeholder, inputStyle }: {
  value: number;
  onChange: (v: number) => void;
  placeholder?: string;
  inputStyle?: React.CSSProperties;
}) {
  const [focused,  setFocused]  = useState(false);
  const [raw,      setRaw]      = useState("");

  const displayVal = focused
    ? raw
    : value > 0
      ? value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : "";

  const handleFocus = () => {
    setFocused(true);
    setRaw(value > 0 ? String(value) : "");
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Allow digits, commas, one decimal point
    const v = e.target.value.replace(/[^0-9.,]/g, "");
    setRaw(v);
    const numeric = parseFloat(v.replace(/,/g, ""));
    if (!isNaN(numeric)) onChange(numeric);
    else if (v === "" || v === ".") onChange(0);
  };

  const handleBlur = () => {
    setFocused(false);
    const numeric = parseFloat(raw.replace(/,/g, ""));
    if (!isNaN(numeric)) onChange(numeric);
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      value={displayVal}
      placeholder={placeholder}
      onFocus={handleFocus}
      onChange={handleChange}
      onBlur={handleBlur}
      style={inputStyle}
    />
  );
}
