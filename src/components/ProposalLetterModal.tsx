import { useState, useEffect } from "react";
import { X, FileText, CheckCircle, AlertCircle } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import type { Project } from "../hooks/db";
import { loadSettings, listLineItems, getProject } from "../hooks/db";
import { computeTotals, DEFAULT_LABOR } from "../hooks/reportUtils";

interface Props {
  project: Project;
  onClose: () => void;
}

interface ManualFields {
  recipientName:    string;
  recipientCompany: string;
  salutation:       string;
  estimatorName:    string;
  estimatorTitle:   string;
}

const STORAGE_KEY = (projectId: string) => `proposal_fields_${projectId}`;

function loadSaved(projectId: string): Partial<ManualFields> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY(projectId));
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveToDisk(projectId: string, fields: ManualFields) {
  try { localStorage.setItem(STORAGE_KEY(projectId), JSON.stringify(fields)); } catch {}
}

export default function ProposalLetterModal({ project, onClose }: Props) {
  const [manual, setManual] = useState<ManualFields>({
    recipientName:    "",
    recipientCompany: project.client || "",
    salutation:       "",
    estimatorName:    "",
    estimatorTitle:   "Project Estimator",
  });
  const [companyName, setCompanyName] = useState("Anmar Electric");
  const [hasTemplate, setHasTemplate] = useState<boolean | null>(null);
  const [generating,  setGenerating]  = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [success,     setSuccess]     = useState(false);
  const [bidTotal,    setBidTotal]    = useState(0);
  const [freshProject, setFreshProject] = useState<Project>(project);

  // Today's date formatted
  const today = new Date().toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric"
  });

  // Format bid total
  const bidTotalFmt = bidTotal > 0
    ? `$${bidTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "$0.00";

  useEffect(() => {
    // Load saved manual fields for this project
    const saved = loadSaved(project.id);
    setManual(prev => ({ ...prev, ...saved }));

    // Check template, load company name, and compute bid total from line items
    Promise.all([
      invoke<boolean>("has_proposal_template").catch(() => false),
      loadSettings(),
      listLineItems(project.id),
      getProject(project.id),
    ]).then(([hasT, settings, items, fresh]) => {
      setHasTemplate(hasT);
      if (settings.company_name) setCompanyName(settings.company_name);
      if (!saved.estimatorName && settings.estimator_name) {
        setManual(prev => ({ ...prev, estimatorName: settings.estimator_name ?? "" }));
      }
      if (!saved.estimatorTitle && settings.estimator_title) {
        setManual(prev => ({ ...prev, estimatorTitle: settings.estimator_title ?? "Project Estimator" }));
      }
      // Compute bid total from line items
      const totals = computeTotals(items, DEFAULT_LABOR);
      setBidTotal(totals.actualBidPrice);
      if (fresh) setFreshProject(fresh);
    });
  }, [project.id]);

  const set = (field: keyof ManualFields, val: string) =>
    setManual(prev => ({ ...prev, [field]: val }));

  const handleGenerate = async () => {
    if (!hasTemplate) return;
    setError(null);
    setGenerating(true);

    // Save manual fields for next time
    saveToDisk(project.id, manual);

    // Build token map — passed as a plain object to Tauri
    const tokens: [string, string][] = [
      // Auto-filled
      ["{{PROJECT_NAME}}",    freshProject.name                              ],
      ["{{BID_NUMBER}}",      freshProject.bid_number || "—"                 ],
      ["{{BID_TOTAL}}",       bidTotalFmt                                    ],
      ["{{PROPOSAL_DATE}}",   today                                          ],
      // Manual
      ["{{RECIPIENT_NAME}}",    manual.recipientName    || "_______________" ],
      ["{{RECIPIENT_COMPANY}}", manual.recipientCompany || "_______________" ],
      ["{{SALUTATION}}",        manual.salutation       || "Dear Sir/Madam," ],
      ["{{ESTIMATOR_NAME}}",    manual.estimatorName    || companyName       ],
      ["{{ESTIMATOR_TITLE}}",   manual.estimatorTitle   || "Project Estimator"],
    ];

    const safeName = `Proposal_${(freshProject.bid_number || freshProject.name).replace(/[^a-zA-Z0-9]/g, "_")}`;

    try {
      await invoke("generate_proposal_letter", { tokens, outputName: safeName });
      setSuccess(true);
      setTimeout(() => { setSuccess(false); onClose(); }, 1800);
    } catch (e) {
      setError(String(e));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={box}>

        {/* Header */}
        <div style={hdr}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <FileText size={16} />
            <span style={{ fontWeight: 700, fontSize: 14 }}>Generate Proposal Letter</span>
          </div>
          <button onClick={onClose} style={closeBtn}><X size={14} /></button>
        </div>

        <div style={{ overflow: "auto", flex: 1 }}>

          {/* No template warning */}
          {hasTemplate === false && (
            <div style={{ margin: "16px 20px", padding: "12px 14px", background: "#fff7ed", border: "1px solid #fed7aa", borderLeft: "4px solid #f97316", borderRadius: 4 }}>
              <div style={{ fontWeight: 700, fontSize: 12, color: "#c2410c", marginBottom: 4 }}>
                ⚠ No proposal template found
              </div>
              <div style={{ fontSize: 11, color: "#9a3412" }}>
                Go to <strong>Job File → Program Setup → Proposal Letter</strong> to upload your template.
              </div>
            </div>
          )}

          {/* Auto-filled section */}
          <div style={{ padding: "14px 20px 0" }}>
            <SectionLabel>Auto-Filled from Project</SectionLabel>
            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 4, padding: "10px 14px", marginBottom: 14 }}>
              {[
                ["Job Name",     freshProject.name],
                ["Bid Number",   freshProject.bid_number || "—"],
                ["Proposal Date",today],
                ["Bid Total",    bidTotalFmt],
              ].map(([label, value]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #e8eef4", fontSize: 12 }}>
                  <span style={{ color: "#64748b", fontWeight: 600 }}>{label}</span>
                  <span style={{ color: "#1a2332", fontFamily: "var(--font-mono)", fontSize: 11 }}>{value}</span>
                </div>
              ))}
            </div>

            {/* Manual fields */}
            <SectionLabel>Fill In Before Generating</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
              <Field label="Recipient Name" hint="e.g. John Smith">
                <input value={manual.recipientName} onChange={e => set("recipientName", e.target.value)}
                  placeholder="Recipient name…" style={inp} autoFocus />
              </Field>
              <Field label="Recipient Company" hint="e.g. ABC Property Group">
                <input value={manual.recipientCompany} onChange={e => set("recipientCompany", e.target.value)}
                  placeholder="Company name…" style={inp} />
              </Field>
              <Field label="Salutation" hint="e.g. Dear Mr. Smith,">
                <input value={manual.salutation} onChange={e => set("salutation", e.target.value)}
                  placeholder="Dear …" style={inp} />
              </Field>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Field label="Estimator Name">
                  <input value={manual.estimatorName} onChange={e => set("estimatorName", e.target.value)}
                    placeholder="Your name…" style={inp} />
                </Field>
                <Field label="Estimator Title">
                  <input value={manual.estimatorTitle} onChange={e => set("estimatorTitle", e.target.value)}
                    placeholder="Project Estimator" style={inp} />
                </Field>
              </div>
            </div>

            {/* Note about remembering values */}
            <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 14, fontStyle: "italic" }}>
              ✓ Your entries are remembered per project for next time.
            </div>

            {/* Error */}
            {error && (
              <div style={{ padding: "10px 12px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 4, fontSize: 12, color: "#b91c1c", marginBottom: 12, display: "flex", gap: 8, alignItems: "flex-start" }}>
                <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 20px 16px", borderTop: "1px solid #e0e0e0", display: "flex", gap: 10, flexShrink: 0 }}>
          <button onClick={onClose} style={cancelBtn}>Cancel</button>
          <button
            onClick={handleGenerate}
            disabled={!hasTemplate || generating || success}
            style={{
              flex: 2, padding: "9px 0",
              background: success
                ? "linear-gradient(180deg,#16a34a,#15803d)"
                : !hasTemplate
                  ? "#cbd5e1"
                  : "linear-gradient(180deg,#2277cc,#1155aa)",
              color: "white",
              border: "none", borderRadius: 3, fontSize: 13,
              fontWeight: 700, cursor: !hasTemplate || generating ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
              transition: "background 0.2s",
            }}
          >
            {success
              ? <><CheckCircle size={14} /> Opening in Word…</>
              : generating
                ? "Generating…"
                : <><FileText size={14} /> Generate &amp; Open in Word</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#2a4a6a", marginBottom: 8, paddingBottom: 4, borderBottom: "1px solid #dce8f0" }}>
      {children}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
        {hint && <span style={{ fontSize: 10, color: "#94a3b8" }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const overlay: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
  display: "flex", alignItems: "center", justifyContent: "center",
  zIndex: 3500, backdropFilter: "blur(3px)", animation: "fadeIn 0.15s ease",
};
const box: React.CSSProperties = {
  background: "white", border: "1px solid #888", borderRadius: 6,
  width: 500, maxHeight: "88vh",
  boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
  display: "flex", flexDirection: "column",
  animation: "fadeIn 0.18s cubic-bezier(0.16,1,0.3,1)",
};
const hdr: React.CSSProperties = {
  padding: "11px 18px", background: "linear-gradient(to right, #0a246a, #2a5abf)",
  color: "white", display: "flex", justifyContent: "space-between", alignItems: "center",
  borderRadius: "6px 6px 0 0", flexShrink: 0,
};
const closeBtn: React.CSSProperties = {
  background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)",
  color: "white", cursor: "pointer", padding: "3px 6px", display: "flex", borderRadius: 2,
};
const inp: React.CSSProperties = {
  padding: "7px 10px", border: "1px solid #d1d5db", borderRadius: 3,
  fontSize: 13, fontFamily: "inherit", color: "#1a2332",
  background: "white", width: "100%",
};
const cancelBtn: React.CSSProperties = {
  flex: 1, padding: "9px 0", borderRadius: 3, fontSize: 12,
  fontWeight: 600, cursor: "pointer",
  background: "white", border: "1px solid #aaa", color: "#333",
};
