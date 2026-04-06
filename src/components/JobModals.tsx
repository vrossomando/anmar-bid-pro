import { useState } from "react";
import { X, FileText, Clock, CheckCircle, Send, XCircle } from "lucide-react";
import { updateProject, type Project } from "../hooks/db";

// ── BidLogModal ────────────────────────────────────────────────────────────

interface BidLogModalProps {
  projects: Project[];
  onOpen: (id: string) => void;
  onClose: () => void;
  onStatusChanged: () => void;
}

const STATUS_CFG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  draft:    { label: "Draft",    color: "#7a90a4", icon: <Clock size={11} /> },
  sent:     { label: "Sent",     color: "#2563eb", icon: <Send size={11} /> },
  approved: { label: "Approved", color: "#16a34a", icon: <CheckCircle size={11} /> },
  rejected: { label: "Rejected", color: "#dc2626", icon: <XCircle size={11} /> },
};
const STATUS_ORDER = ["draft", "sent", "approved", "rejected"];

export function BidLogModal({ projects, onOpen, onClose, onStatusChanged }: BidLogModalProps) {
  const [filter, setFilter] = useState<string>("all");

  const handleStatusChange = async (project: Project, newStatus: string) => {
    await updateProject({ ...project, status: newStatus });
    onStatusChanged();
  };

  const filtered = filter === "all" ? projects : projects.filter(p => p.status === filter);

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ ...box, width: 780 }}>
        <div style={hdr}>
          <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>Bid Log</span>
          <button onClick={onClose} style={closeBtn}><X size={16} /></button>
        </div>

        {/* Filter bar */}
        <div style={{ display: "flex", gap: 6, padding: "8px 16px", borderBottom: "1px solid var(--border)", background: "var(--bg-surface)", flexShrink: 0 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", alignSelf: "center", marginRight: 4 }}>FILTER:</span>
          {["all", ...STATUS_ORDER].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              style={{ padding: "4px 12px", borderRadius: 99, fontSize: 11, fontWeight: filter === s ? 700 : 400, cursor: "pointer", border: `1px solid ${filter === s ? "var(--accent)" : "var(--border-strong)"}`, background: filter === s ? "var(--accent)" : "var(--bg-raised)", color: filter === s ? "white" : "var(--text-secondary)", textTransform: "capitalize" }}>
              {s === "all" ? `All (${projects.length})` : `${STATUS_CFG[s]?.label} (${projects.filter(p => p.status === s).length})`}
            </button>
          ))}
        </div>

        {/* Column headers */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 140px 80px 80px", gap: 0, borderBottom: "2px solid var(--border-strong)", background: "#dce8f0", padding: "7px 16px" }}>
          {["Job Name / Client", "Bid #", "Last Updated", "Status", ""].map(h => (
            <div key={h} style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#2a4a6a" }}>{h}</div>
          ))}
        </div>

        <div style={{ overflow: "auto", flex: 1 }}>
          {filtered.length === 0 && (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>No jobs match this filter</div>
          )}
          {filtered.map((p, idx) => {
            const cfg = STATUS_CFG[p.status] ?? STATUS_CFG.draft;
            return (
              <div key={p.id} style={{ display: "grid", gridTemplateColumns: "1fr 120px 140px 80px 80px", alignItems: "center", padding: "9px 16px", borderBottom: "1px solid var(--border)", background: idx % 2 === 1 ? "var(--bg-surface)" : "var(--bg-raised)" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)" }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>{p.client || "No client"}</div>
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                  {p.bid_number || "—"}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
                  {new Date(p.updated_at).toLocaleDateString()}
                </div>
                {/* Editable status dropdown */}
                <div>
                  <select
                    value={p.status}
                    onChange={e => handleStatusChange(p, e.target.value)}
                    style={{ fontSize: 11, fontWeight: 600, color: cfg.color, background: `${cfg.color}18`, border: `1px solid ${cfg.color}40`, borderRadius: 99, padding: "2px 8px", cursor: "pointer", outline: "none" }}>
                    {STATUS_ORDER.map(s => (
                      <option key={s} value={s}>{STATUS_CFG[s].label}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button onClick={() => { onOpen(p.id); onClose(); }}
                    style={{ background: "var(--accent-light)", border: "none", color: "var(--accent)", fontSize: 11, fontWeight: 700, padding: "5px 12px", borderRadius: "var(--r-sm)", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                    <FileText size={11} /> Open
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border)", background: "var(--bg-surface)", borderRadius: "0 0 var(--r-lg) var(--r-lg)", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{projects.length} total jobs · {filtered.length} shown</span>
          <button onClick={onClose} style={cancelBtn}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ── JobNotesModal ──────────────────────────────────────────────────────────

interface JobNotesModalProps {
  projectName: string;
  notes: string;
  onSave: (notes: string) => void;
  onClose: () => void;
}

export function JobNotesModal({ projectName, notes: initialNotes, onSave, onClose }: JobNotesModalProps) {
  const [notes, setNotes] = useState(initialNotes);

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ ...box, width: 560 }}>
        <div style={hdr}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>Job Notes</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>{projectName}</div>
          </div>
          <button onClick={onClose} style={closeBtn}><X size={16} /></button>
        </div>
        <div style={{ padding: "16px 20px" }}>
          <textarea
            autoFocus value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Enter notes, scope of work, exclusions, payment terms, or any other job-specific information…"
            style={{ width: "100%", height: 260, resize: "vertical", background: "var(--bg-surface)", border: "1px solid var(--border-strong)", borderRadius: "var(--r-md)", color: "var(--text-primary)", fontSize: 13, padding: 12, fontFamily: "var(--font-body)", lineHeight: 1.6 }}
          />
        </div>
        <div style={{ padding: "10px 20px 16px", display: "flex", gap: 10 }}>
          <button onClick={onClose} style={cancelBtn}>Cancel</button>
          <button onClick={() => { onSave(notes); onClose(); }}
            style={{ ...cancelBtn, flex: 2, background: "var(--accent)", color: "#fff", border: "none", fontWeight: 700 }}>
            Save Notes
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Shared styles ──────────────────────────────────────────────────────────
const overlay: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.30)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, backdropFilter: "blur(3px)", animation: "fadeIn 0.15s ease" };
const box: React.CSSProperties = { background: "var(--bg-raised)", border: "1px solid var(--border-strong)", borderRadius: "var(--r-lg)", boxShadow: "var(--shadow-lg)", display: "flex", flexDirection: "column", maxHeight: "85vh" };
const hdr: React.CSSProperties = { padding: "14px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-surface)", borderRadius: "var(--r-lg) var(--r-lg) 0 0", flexShrink: 0 };
const closeBtn: React.CSSProperties = { background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 4, display: "flex" };
const cancelBtn: React.CSSProperties = { flex: 1, padding: "9px 0", borderRadius: "var(--r-md)", fontSize: 13, fontWeight: 600, cursor: "pointer", background: "var(--bg-surface)", border: "1px solid var(--border-strong)", color: "var(--text-primary)" };
