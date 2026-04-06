import { useMemo } from "react";
import { PlusCircle, FileText, TrendingUp, CheckCircle, Clock, XCircle, Send } from "lucide-react";
import type { Project } from "../hooks/db";

interface DashboardProps {
  projects: Project[];
  onNewProject: () => void;
  onSelectProject: (id: string) => void;
  currencySymbol: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  draft:    { label: "Draft",    color: "#8b93a8", bg: "rgba(139,147,168,0.12)", icon: <Clock size={12} /> },
  sent:     { label: "Sent",     color: "#60a5fa", bg: "rgba(96,165,250,0.12)",  icon: <Send size={12} /> },
  approved: { label: "Approved", color: "#34d399", bg: "rgba(52,211,153,0.12)",  icon: <CheckCircle size={12} /> },
  rejected: { label: "Rejected", color: "#f87171", bg: "rgba(248,113,113,0.12)", icon: <XCircle size={12} /> },
};

export default function Dashboard({ projects, onNewProject, onSelectProject, currencySymbol }: DashboardProps) {
  const stats = useMemo(() => {
    const byStatus = { draft: 0, sent: 0, approved: 0, rejected: 0 };
    for (const p of projects) byStatus[p.status as keyof typeof byStatus]++;
    return byStatus;
  }, [projects]);

  const recent = projects.slice(0, 8);

  return (
    <div style={{
      padding: "var(--sp-8) var(--sp-10)",
      overflow: "auto",
      height: "100%",
      animation: "fadeIn 0.25s ease both",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "var(--sp-8)" }}>
        <div>
          <h1 style={{
            fontFamily: "var(--font-display)",
            fontSize: 32,
            fontWeight: 400,
            color: "var(--text-primary)",
            lineHeight: 1.1,
          }}>
            Dashboard
          </h1>
          <p style={{ color: "var(--text-secondary)", marginTop: 4, fontSize: 13 }}>
            {projects.length} project{projects.length !== 1 ? "s" : ""} total
          </p>
        </div>
        <button
          onClick={onNewProject}
          style={{
            background: "var(--accent)",
            color: "#0f1117",
            fontWeight: 600,
            padding: "9px 16px",
            borderRadius: "var(--r-md)",
            fontSize: 13,
            boxShadow: "var(--shadow-accent)",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            transition: "all var(--t-fast)",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "var(--accent-hover)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "var(--accent)"; e.currentTarget.style.transform = ""; }}
        >
          <PlusCircle size={15} />
          New Estimate
        </button>
      </div>

      {/* Stat cards */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: "var(--sp-4)",
        marginBottom: "var(--sp-8)",
      }}>
        {(["draft", "sent", "approved", "rejected"] as const).map((status) => {
          const cfg = STATUS_CONFIG[status];
          return (
            <div key={status} style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-lg)",
              padding: "var(--sp-5)",
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-muted)", fontWeight: 600 }}>
                  {cfg.label}
                </span>
                <span style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  color: cfg.color,
                  background: cfg.bg,
                  padding: "3px 7px",
                  borderRadius: 99,
                  fontSize: 11,
                }}>
                  {cfg.icon}
                </span>
              </div>
              <span style={{
                fontFamily: "var(--font-mono)",
                fontSize: 28,
                fontWeight: 500,
                color: cfg.color,
                lineHeight: 1,
              }}>
                {stats[status]}
              </span>
            </div>
          );
        })}
      </div>

      {/* Recent projects */}
      {recent.length > 0 && (
        <div>
          <h2 style={{
            fontFamily: "var(--font-display)",
            fontSize: 20,
            fontWeight: 400,
            color: "var(--text-primary)",
            marginBottom: "var(--sp-4)",
          }}>
            Recent Projects
          </h2>
          <div style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)",
            overflow: "hidden",
          }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {["Project", "Client", "Status", "Last Updated"].map((h) => (
                    <th key={h} style={{
                      padding: "10px 16px",
                      textAlign: "left",
                      fontSize: 11,
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.07em",
                      color: "var(--text-muted)",
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recent.map((p, idx) => {
                  const cfg = STATUS_CONFIG[p.status];
                  return (
                    <tr
                      key={p.id}
                      onClick={() => onSelectProject(p.id)}
                      style={{
                        borderBottom: idx < recent.length - 1 ? "1px solid var(--border)" : "none",
                        cursor: "pointer",
                        transition: "background var(--t-fast)",
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-raised)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "")}
                    >
                      <td style={{ padding: "11px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <FileText size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                          <span style={{ fontWeight: 500, color: "var(--text-primary)", fontSize: 13 }}>{p.name}</span>
                        </div>
                      </td>
                      <td style={{ padding: "11px 16px", color: "var(--text-secondary)", fontSize: 12 }}>
                        {p.client || "—"}
                      </td>
                      <td style={{ padding: "11px 16px" }}>
                        <span style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          color: cfg.color,
                          background: cfg.bg,
                          padding: "3px 9px",
                          borderRadius: 99,
                          fontSize: 11,
                          fontWeight: 500,
                        }}>
                          {cfg.icon}
                          {cfg.label}
                        </span>
                      </td>
                      <td style={{ padding: "11px 16px", color: "var(--text-muted)", fontSize: 12, fontFamily: "var(--font-mono)" }}>
                        {new Date(p.updated_at).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {projects.length === 0 && (
        <div style={{
          textAlign: "center",
          padding: "var(--sp-12)",
          background: "var(--bg-surface)",
          border: "1px dashed var(--border-strong)",
          borderRadius: "var(--r-xl)",
        }}>
          <TrendingUp size={40} style={{ color: "var(--text-muted)", margin: "0 auto var(--sp-4)" }} />
          <h3 style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--text-primary)", fontWeight: 400, marginBottom: 8 }}>
            No estimates yet
          </h3>
          <p style={{ color: "var(--text-secondary)", marginBottom: "var(--sp-5)", fontSize: 13 }}>
            Create your first estimate to get started
          </p>
          <button
            onClick={onNewProject}
            style={{
              background: "var(--accent)",
              color: "#0f1117",
              fontWeight: 600,
              padding: "10px 20px",
              borderRadius: "var(--r-md)",
              border: "none",
              cursor: "pointer",
              fontSize: 13,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <PlusCircle size={15} />
            Create Estimate
          </button>
        </div>
      )}
    </div>
  );
}
