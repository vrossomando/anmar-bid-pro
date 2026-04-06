import { FileText, Clock, CheckCircle, Send, XCircle, TrendingUp, PlusCircle } from "lucide-react";
import type { Project } from "../hooks/db";

interface NoJobViewProps {
  projects: Project[];
  onNewJob: () => void;
  onOpenJob: (id: string) => void;
}

const STATUS_CFG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  draft:    { label: "Draft",    color: "#7a90a4", icon: <Clock size={11} /> },
  sent:     { label: "Sent",     color: "#2563eb", icon: <Send size={11} /> },
  approved: { label: "Approved", color: "#16a34a", icon: <CheckCircle size={11} /> },
  rejected: { label: "Rejected", color: "#dc2626", icon: <XCircle size={11} /> },
};

export default function NoJobView({ projects, onNewJob, onOpenJob }: NoJobViewProps) {
  const byStatus = {
    draft: projects.filter(p => p.status === "draft").length,
    sent: projects.filter(p => p.status === "sent").length,
    approved: projects.filter(p => p.status === "approved").length,
    rejected: projects.filter(p => p.status === "rejected").length,
  };
  const recent = projects.slice(0, 10);

  return (
    <div style={{ flex: 1, overflow: "auto", padding: "28px 36px", background: "var(--bg-surface)", animation: "fadeIn 0.2s ease" }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 400, color: "var(--text-primary)" }}>
            Welcome to Anmar Bid Pro
          </h1>
          <p style={{ color: "var(--text-secondary)", marginTop: 4, fontSize: 13 }}>
            Use the <strong>Job File</strong> tab above to create or open a job, then use <strong>Takeoff</strong> to build your estimate.
          </p>
        </div>

        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 28 }}>
          {(["draft","sent","approved","rejected"] as const).map(status => {
            const cfg = STATUS_CFG[status];
            return (
              <div key={status} style={{ background: "var(--bg-raised)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <span style={{ color: cfg.color }}>{cfg.icon}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-muted)" }}>{cfg.label}</span>
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 26, fontWeight: 600, color: cfg.color }}>{byStatus[status]}</div>
              </div>
            );
          })}
        </div>

        {/* Recent jobs */}
        {recent.length > 0 ? (
          <div>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Recent Jobs
            </h2>
            <div style={{ background: "var(--bg-raised)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", overflow: "hidden" }}>
              {recent.map((p, idx) => {
                const cfg = STATUS_CFG[p.status] ?? STATUS_CFG.draft;
                return (
                  <button key={p.id} onClick={() => onOpenJob(p.id)}
                    style={{
                      width: "100%", background: "none", border: "none", cursor: "pointer",
                      padding: "11px 16px", display: "flex", alignItems: "center", gap: 12,
                      borderBottom: idx < recent.length - 1 ? "1px solid var(--border)" : "none",
                      textAlign: "left", transition: "background var(--t-fast)",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-hover)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "none")}
                  >
                    <div style={{ width: 34, height: 34, borderRadius: "var(--r-md)", background: "var(--accent-light)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <FileText size={15} style={{ color: "var(--accent)" }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{p.client || "No client"}{p.bid_number ? ` · #${p.bid_number}` : ""}{p.address ? ` · ${p.address}` : ""}</div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: cfg.color, background: `${cfg.color}18`, padding: "2px 9px", borderRadius: 99, display: "inline-flex", alignItems: "center", gap: 4 }}>
                      {cfg.icon} {cfg.label}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", minWidth: 80, textAlign: "right" }}>
                      {new Date(p.updated_at).toLocaleDateString()}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "48px 0", background: "var(--bg-raised)", border: "1px dashed var(--border-strong)", borderRadius: "var(--r-xl)" }}>
            <TrendingUp size={40} style={{ color: "var(--text-muted)", margin: "0 auto 12px", display: "block" }} />
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: 20, color: "var(--text-primary)", fontWeight: 400, marginBottom: 8 }}>No estimates yet</h3>
            <p style={{ color: "var(--text-secondary)", marginBottom: 16, fontSize: 13 }}>Click <strong>New Job</strong> on the Job File tab to get started</p>
            <button onClick={onNewJob} style={{ background: "var(--accent)", color: "#fff", fontWeight: 700, padding: "10px 20px", borderRadius: "var(--r-md)", border: "none", cursor: "pointer", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}>
              <PlusCircle size={14} /> New Job
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
