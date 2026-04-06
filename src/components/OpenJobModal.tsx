import { useState, useMemo } from "react";
import { X, Search, FileText, Clock, CheckCircle, Send, XCircle } from "lucide-react";
import type { Project } from "../hooks/db";

interface OpenJobModalProps {
  projects: Project[];
  onOpen: (id: string) => void;
  onClose: () => void;
}

const STATUS_CFG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  draft:    { label: "Draft",    color: "#7a90a4", icon: <Clock size={11} /> },
  sent:     { label: "Sent",     color: "#2563eb", icon: <Send size={11} /> },
  approved: { label: "Approved", color: "#16a34a", icon: <CheckCircle size={11} /> },
  rejected: { label: "Rejected", color: "#dc2626", icon: <XCircle size={11} /> },
};

export default function OpenJobModal({ projects, onOpen, onClose }: OpenJobModalProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return projects;
    const q = query.toLowerCase();
    return projects.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.client.toLowerCase().includes(q) ||
      p.bid_number?.toLowerCase().includes(q) ||
      p.address?.toLowerCase().includes(q)
    );
  }, [projects, query]);

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={box}>
        <div style={hdr}>
          <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>
            Open Job ({projects.length} total)
          </span>
          <button onClick={onClose} style={closeBtn}><X size={16} /></button>
        </div>

        {/* Search bar */}
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", background: "var(--bg-surface)" }}>
          <div style={{ position: "relative" }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
            <input
              autoFocus value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Search by job name, client, or address…"
              style={{ ...inp, paddingLeft: 32 }}
            />
          </div>
        </div>

        {/* Job list */}
        <div style={{ overflow: "auto", maxHeight: 440 }}>
          {filtered.length === 0 && (
            <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
              {query ? `No jobs matching "${query}"` : "No jobs yet"}
            </div>
          )}
          {filtered.map((p, idx) => {
            const cfg = STATUS_CFG[p.status] ?? STATUS_CFG.draft;
            return (
              <button key={p.id} onClick={() => onOpen(p.id)}
                style={{
                  width: "100%", background: "none", border: "none", cursor: "pointer",
                  padding: "11px 16px", display: "flex", alignItems: "center", gap: 12,
                  borderBottom: idx < filtered.length - 1 ? "1px solid var(--border)" : "none",
                  textAlign: "left", transition: "background var(--t-fast)",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-hover)")}
                onMouseLeave={e => (e.currentTarget.style.background = "none")}
              >
                <div style={{ width: 36, height: 36, borderRadius: "var(--r-md)", background: "var(--accent-light)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <FileText size={16} style={{ color: "var(--accent)" }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.name}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 1 }}>
                    {p.bid_number ? `#${p.bid_number} · ` : ""}{[p.client, p.address].filter(Boolean).join(" · ") || "No client info"}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: cfg.color, background: `${cfg.color}18`, padding: "2px 8px", borderRadius: 99 }}>
                    {cfg.icon} {cfg.label}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    {new Date(p.updated_at).toLocaleDateString()}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border)", background: "var(--bg-surface)", borderRadius: "0 0 var(--r-lg) var(--r-lg)" }}>
          <button onClick={onClose} style={cancelBtn}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.30)",
  display: "flex", alignItems: "center", justifyContent: "center",
  zIndex: 2000, backdropFilter: "blur(3px)", animation: "fadeIn 0.15s ease",
};
const box: React.CSSProperties = {
  background: "var(--bg-raised)", border: "1px solid var(--border-strong)",
  borderRadius: "var(--r-lg)", width: 560, boxShadow: "var(--shadow-lg)",
  display: "flex", flexDirection: "column", maxHeight: "80vh",
};
const hdr: React.CSSProperties = {
  padding: "14px 16px", borderBottom: "1px solid var(--border)",
  display: "flex", justifyContent: "space-between", alignItems: "center",
  background: "var(--bg-surface)", borderRadius: "var(--r-lg) var(--r-lg) 0 0", flexShrink: 0,
};
const closeBtn: React.CSSProperties = { background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 4, display: "flex" };
const inp: React.CSSProperties = { background: "var(--bg-raised)", border: "1px solid var(--border-strong)", borderRadius: "var(--r-md)", color: "var(--text-primary)", fontSize: 13, padding: "8px 11px", width: "100%" };
const cancelBtn: React.CSSProperties = { padding: "7px 16px", borderRadius: "var(--r-md)", fontSize: 13, fontWeight: 600, cursor: "pointer", background: "var(--bg-raised)", border: "1px solid var(--border-strong)", color: "var(--text-secondary)" };
