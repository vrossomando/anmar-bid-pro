import { X } from "lucide-react";
import { formInp as formInpStyle, formNumInp as formNumInpStyle, formSelect as formSelectStyle } from "./takeoffStyles";

interface TakeoffShellProps {
  title: string;
  subtitle?: string;
  laborFactor: number;
  materialFactor: number;
  onLaborFactorChange: (v: number) => void;
  onMaterialFactorChange: (v: number) => void;
  onTakeoff: () => void;
  onClose: () => void;
  children: React.ReactNode;
  takeoffDisabled?: boolean;
  width?: number;
  quoteMode?: boolean;
  onQuoteModeChange?: (v: boolean) => void;
}

export default function TakeoffShell({
  title, subtitle, laborFactor, materialFactor,
  onLaborFactorChange, onMaterialFactorChange,
  onTakeoff, onClose, children,
  takeoffDisabled = false, width = 760,
  quoteMode = false, onQuoteModeChange,
}: TakeoffShellProps) {
  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ ...box, width }}>

        {/* ── Header ── */}
        <div style={hdr}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>{title}</div>
            {subtitle && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>{subtitle}</div>}
          </div>
          <button onClick={onClose} style={closeBtn}><X size={16} /></button>
        </div>

        {/* ── Scrollable form body ── */}
        <div style={{ flex: 1, overflow: "auto" }}>
          {children}
        </div>

        {/* ── Footer: factors + takeoff button ── */}
        <div style={footer}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <FactorField
              label="Labor Factor"
              value={laborFactor}
              onChange={onLaborFactorChange}
            />
            <FactorField
              label="Material Factor"
              value={materialFactor}
              onChange={onMaterialFactorChange}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {onQuoteModeChange && (
              <label style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer",
                padding: "5px 12px", borderRadius: "var(--r-md)",
                background: quoteMode ? "#fef3c7" : "var(--bg-surface)",
                border: `1px solid ${quoteMode ? "#f59e0b" : "var(--border-strong)"}`,
                transition: "all 0.15s ease",
              }}>
                <input
                  type="checkbox"
                  checked={quoteMode}
                  onChange={e => onQuoteModeChange(e.target.checked)}
                  style={{ width: 15, height: 15, accentColor: "#f59e0b", cursor: "pointer" }}
                />
                <span style={{ fontSize: 12, fontWeight: 700,
                  color: quoteMode ? "#92400e" : "var(--text-secondary)",
                  userSelect: "none", whiteSpace: "nowrap",
                }}>
                  {quoteMode ? "⚡ QUOTE MODE ON — $0 material" : "Quote Mode"}
                </span>
              </label>
            )}
            <button onClick={onClose} style={cancelBtn}>Cancel</button>
            <button
              onClick={onTakeoff}
              disabled={takeoffDisabled}
              style={{
                ...takeoffBtn,
                opacity: takeoffDisabled ? 0.5 : 1,
                cursor: takeoffDisabled ? "not-allowed" : "pointer",
                background: quoteMode
                  ? "linear-gradient(180deg,#f59e0b,#d97706)"
                  : "linear-gradient(180deg,#1a5abf,#0d3d8a)",
              }}
            >
              {quoteMode ? "Takeoff as Quote" : "Takeoff"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FactorField({ label, value, onChange }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <label style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 600, whiteSpace: "nowrap" }}>
        {label}
      </label>
      <div style={{ position: "relative", width: 72 }}>
        <input
          type="number"
          value={value}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          min={-50} max={100} step={1}
          style={{ ...factorInp, paddingRight: 20 }}
        />
        <span style={{ position: "absolute", right: 7, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: "var(--text-muted)", pointerEvents: "none" }}>%</span>
      </div>
    </div>
  );
}

// ── Tab system (used inside forms) ────────────────────────────────────────

interface TabsProps {
  tabs: string[];
  active: string;
  onChange: (tab: string) => void;
}

export function FormTabs({ tabs, active, onChange }: TabsProps) {
  return (
    <div style={{ display: "flex", borderBottom: "2px solid var(--border-strong)", marginBottom: 0, paddingInline: 16, background: "var(--bg-surface)", flexShrink: 0 }}>
      {tabs.map(tab => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          style={{
            background: "none", border: "none",
            borderBottom: active === tab ? "2px solid var(--accent)" : "2px solid transparent",
            marginBottom: -2,
            color: active === tab ? "var(--accent)" : "var(--text-secondary)",
            fontWeight: active === tab ? 700 : 500,
            fontSize: 12, padding: "9px 14px",
            cursor: "pointer", transition: "all var(--t-fast)",
          }}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}

// ── Form field helper ──────────────────────────────────────────────────────

export function FormRow({ label, children, span = 1 }: {
  label: string;
  children: React.ReactNode;
  span?: number;
}) {
  return (
    <div style={{ gridColumn: `span ${span}`, display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

// ── Input styles exported for use in forms ────────────────────────────────

export const formInp    = formInpStyle;
export const formNumInp = formNumInpStyle;
export const formSelect = formSelectStyle;

// ── Shared styles ──────────────────────────────────────────────────────────

const overlay: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)",
  display: "flex", alignItems: "center", justifyContent: "center",
  zIndex: 2000, backdropFilter: "blur(4px)", animation: "fadeIn 0.15s ease",
};
const box: React.CSSProperties = {
  background: "var(--bg-raised)", border: "1px solid var(--border-strong)",
  borderRadius: "var(--r-lg)", maxHeight: "90vh",
  boxShadow: "var(--shadow-lg)", display: "flex", flexDirection: "column",
  animation: "fadeIn 0.2s cubic-bezier(0.16,1,0.3,1)",
};
const hdr: React.CSSProperties = {
  padding: "12px 18px", borderBottom: "1px solid var(--border)",
  display: "flex", justifyContent: "space-between", alignItems: "center",
  background: "linear-gradient(to right, #0a246a, #2a5abf)",
  borderRadius: "var(--r-lg) var(--r-lg) 0 0", flexShrink: 0,
};
const closeBtn: React.CSSProperties = {
  background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)",
  color: "white", cursor: "pointer", padding: "3px 6px", display: "flex",
  borderRadius: "var(--r-sm)",
};
const footer: React.CSSProperties = {
  padding: "10px 18px", borderTop: "2px solid var(--border-strong)",
  display: "flex", alignItems: "center", justifyContent: "space-between",
  background: "var(--bg-surface)", flexShrink: 0,
  borderRadius: "0 0 var(--r-lg) var(--r-lg)",
};
const cancelBtn: React.CSSProperties = {
  padding: "8px 20px", borderRadius: "var(--r-md)", fontSize: 13,
  fontWeight: 600, cursor: "pointer",
  background: "var(--bg-raised)", border: "1px solid var(--border-strong)",
  color: "var(--text-secondary)",
};
const takeoffBtn: React.CSSProperties = {
  padding: "8px 28px", borderRadius: "var(--r-md)", fontSize: 14,
  fontWeight: 800, border: "none", color: "white",
  background: "linear-gradient(180deg, #2277cc 0%, #1155aa 100%)",
  boxShadow: "0 2px 8px rgba(17,85,170,0.4)",
  letterSpacing: "0.5px", textTransform: "uppercase",
  fontFamily: "Arial, sans-serif",
};
const factorInp: React.CSSProperties = {
  background: "var(--bg-raised)", border: "1px solid var(--border-strong)",
  borderRadius: "var(--r-sm)", color: "var(--text-primary)", fontSize: 12,
  padding: "5px 8px", width: "100%", fontFamily: "var(--font-mono)",
};
