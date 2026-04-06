import { FileText, Settings, PlusCircle, TrendingUp, FolderOpen } from "lucide-react";
import type { Project } from "../hooks/db";

interface SidebarProps {
  projects: Project[];
  activeProjectId: string | null;
  activePage: "dashboard" | "project" | "settings";
  onSelectProject: (id: string) => void;
  onNewProject: () => void;
  onShowDashboard: () => void;
  onShowSettings: () => void;
}

const STATUS_DOT: Record<string, string> = {
  draft:    "#8b93a8",
  sent:     "#60a5fa",
  approved: "#34d399",
  rejected: "#f87171",
};

export default function Sidebar({
  projects,
  activeProjectId,
  activePage,
  onSelectProject,
  onNewProject,
  onShowDashboard,
  onShowSettings,
}: SidebarProps) {
  return (
    <aside style={{
      width: 220,
      minWidth: 220,
      background: "var(--bg-surface)",
      borderRight: "1px solid var(--border)",
      display: "flex",
      flexDirection: "column",
      height: "100%",
    }}>
      {/* Logo / brand */}
      <div style={{
        padding: "20px 18px 14px",
        borderBottom: "1px solid var(--border)",
      }}>
        <div style={{
          fontFamily: "var(--font-display)",
          fontSize: 20,
          color: "var(--text-primary)",
          letterSpacing: "-0.3px",
        }}>
          Estimate<span style={{ color: "var(--accent)" }}>Pro</span>
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>
          v0.1.0
        </div>
      </div>

      {/* Nav */}
      <nav style={{ padding: "10px 8px", display: "flex", flexDirection: "column", gap: 2 }}>
        <NavItem
          icon={<TrendingUp size={14} />}
          label="Dashboard"
          active={activePage === "dashboard"}
          onClick={onShowDashboard}
        />
      </nav>

      {/* Projects list */}
      <div style={{
        flex: 1,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 16px 6px",
        }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Projects
          </span>
          <button
            onClick={onNewProject}
            title="New project"
            style={{
              background: "none",
              border: "none",
              color: "var(--text-secondary)",
              padding: 2,
              cursor: "pointer",
              borderRadius: "var(--r-sm)",
              display: "flex",
              alignItems: "center",
              transition: "color var(--t-fast)",
            }}
            onMouseEnter={e => (e.currentTarget.style.color = "var(--accent)")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--text-secondary)")}
          >
            <PlusCircle size={14} />
          </button>
        </div>

        <ul style={{
          listStyle: "none",
          overflow: "auto",
          flex: 1,
          padding: "0 8px 8px",
          display: "flex",
          flexDirection: "column",
          gap: 1,
        }}>
          {projects.length === 0 && (
            <li style={{ padding: "8px 10px", color: "var(--text-muted)", fontSize: 12 }}>
              No projects yet
            </li>
          )}
          {projects.map((p) => (
            <ProjectItem
              key={p.id}
              project={p}
              active={activeProjectId === p.id && activePage === "project"}
              onClick={() => onSelectProject(p.id)}
            />
          ))}
        </ul>
      </div>

      {/* Footer settings */}
      <div style={{ padding: "8px", borderTop: "1px solid var(--border)" }}>
        <NavItem
          icon={<Settings size={14} />}
          label="Settings"
          active={activePage === "settings"}
          onClick={onShowSettings}
        />
      </div>
    </aside>
  );
}

function NavItem({ icon, label, active, onClick }: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? "var(--accent-dim)" : "none",
        border: "none",
        color: active ? "var(--accent)" : "var(--text-secondary)",
        padding: "7px 10px",
        borderRadius: "var(--r-md)",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: "100%",
        textAlign: "left",
        fontWeight: active ? 600 : 400,
        fontSize: 13,
        transition: "all var(--t-fast)",
      }}
      onMouseEnter={e => { if (!active) { e.currentTarget.style.background = "var(--bg-hover)"; e.currentTarget.style.color = "var(--text-primary)"; } }}
      onMouseLeave={e => { if (!active) { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "var(--text-secondary)"; } }}
    >
      {icon}
      {label}
    </button>
  );
}

function ProjectItem({ project, active, onClick }: {
  project: Project;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        onClick={onClick}
        style={{
          background: active ? "var(--bg-active)" : "none",
          border: `1px solid ${active ? "var(--border-strong)" : "transparent"}`,
          color: active ? "var(--text-primary)" : "var(--text-secondary)",
          padding: "6px 10px",
          borderRadius: "var(--r-md)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 8,
          width: "100%",
          textAlign: "left",
          fontSize: 12,
          transition: "all var(--t-fast)",
        }}
        onMouseEnter={e => { if (!active) { e.currentTarget.style.background = "var(--bg-hover)"; e.currentTarget.style.color = "var(--text-primary)"; } }}
        onMouseLeave={e => { if (!active) { e.currentTarget.style.background = "none"; e.currentTarget.style.border = "1px solid transparent"; e.currentTarget.style.color = "var(--text-secondary)"; } }}
      >
        <span style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: STATUS_DOT[project.status] ?? "#8b93a8",
          flexShrink: 0,
        }} />
        <span style={{
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          flex: 1,
        }}>
          {project.name}
        </span>
      </button>
    </li>
  );
}
