import { X } from "lucide-react";
import type { Assembly } from "../hooks/db";

interface Props {
  originalItem: { description: string; assembly_id: number | null };
  replacement: Assembly;
  matchCount: number;   // how many line items share the same assembly_id / description
  onConfirm: (scope: "one" | "all") => void;
  onCancel: () => void;
}

export default function SubstituteConfirmDialog({
  originalItem, replacement, matchCount, onConfirm, onCancel,
}: Props) {
  const priceStr = replacement.unit_price != null
    ? `$${replacement.unit_price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} /${replacement.price_unit}`
    : "Quote";

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div style={box}>

        {/* Header */}
        <div style={hdr}>
          <span style={{ fontWeight: 700, fontSize: 13 }}>Confirm Substitution</span>
          <button onClick={onCancel} style={closeBtn}><X size={13} /></button>
        </div>

        {/* Body */}
        <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Arrow diagram */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <ItemCard label="Replace" description={originalItem.description} color="#dc2626" />
            <div style={{ fontSize: 22, color: "#64748b", flexShrink: 0 }}>→</div>
            <ItemCard
              label="With"
              description={replacement.description}
              sub={`#${replacement.item_number}  ·  ${priceStr}`}
              color="#16a34a"
            />
          </div>

          {/* Scope question */}
          <div style={{
            background: "#f0f6ff", border: "1px solid #c7d9f0",
            borderRadius: 6, padding: "14px 16px",
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#1a3a6a", marginBottom: 12 }}>
              How would you like to apply this substitution?
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {/* This instance only */}
              <ScopeOption
                onClick={() => onConfirm("one")}
                title="This instance only"
                description="Replace only this single line item in the estimate."
                color="#2277cc"
                icon="①"
              />

              {/* All instances */}
              <ScopeOption
                onClick={() => onConfirm("all")}
                title={`All ${matchCount} instance${matchCount !== 1 ? "s" : ""}`}
                description={`Replace every occurrence of "${originalItem.description}" in this estimate.`}
                color="#d97706"
                icon="⊛"
                disabled={matchCount <= 1}
                disabledReason="Only one instance in this estimate"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "10px 20px 16px", borderTop: "1px solid #e0e0e0", display: "flex", justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={cancelBtn}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function ItemCard({ label, description, sub, color }: {
  label: string; description: string; sub?: string; color: string;
}) {
  return (
    <div style={{
      flex: 1, border: `1px solid ${color}44`,
      borderTop: `3px solid ${color}`,
      borderRadius: 4, padding: "8px 10px",
      background: `${color}08`,
    }}>
      <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: "#1a2332", lineHeight: 1.4 }}>
        {description}
      </div>
      {sub && (
        <div style={{ fontSize: 10, color: "#64748b", marginTop: 3, fontFamily: "var(--font-mono)" }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function ScopeOption({ onClick, title, description, color, icon, disabled, disabledReason }: {
  onClick: () => void; title: string; description: string;
  color: string; icon: string; disabled?: boolean; disabledReason?: string;
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      style={{
        display: "flex", alignItems: "flex-start", gap: 12,
        padding: "12px 14px",
        background: disabled ? "#f8f8f8" : "white",
        border: `1px solid ${disabled ? "#ddd" : color + "66"}`,
        borderLeft: `4px solid ${disabled ? "#ccc" : color}`,
        borderRadius: 4, cursor: disabled ? "not-allowed" : "pointer",
        textAlign: "left", width: "100%",
        opacity: disabled ? 0.55 : 1,
        transition: "background 0.12s, box-shadow 0.12s",
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = `${color}0a`; }}
      onMouseLeave={e => { if (!disabled) e.currentTarget.style.background = "white"; }}
    >
      <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0, color }}>{icon}</span>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: disabled ? "#999" : "#1a2332", marginBottom: 2 }}>
          {title}
        </div>
        <div style={{ fontSize: 11, color: "#64748b" }}>
          {disabled && disabledReason ? disabledReason : description}
        </div>
      </div>
    </button>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const overlay: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
  display: "flex", alignItems: "center", justifyContent: "center",
  zIndex: 4000, backdropFilter: "blur(3px)", animation: "fadeIn 0.15s ease",
};
const box: React.CSSProperties = {
  background: "white", border: "1px solid #888",
  borderRadius: 6, width: 520,
  boxShadow: "0 8px 32px rgba(0,0,0,0.35)", display: "flex", flexDirection: "column",
  animation: "fadeIn 0.18s cubic-bezier(0.16,1,0.3,1)",
};
const hdr: React.CSSProperties = {
  padding: "10px 16px", background: "#1a3a6a", color: "white",
  display: "flex", justifyContent: "space-between", alignItems: "center",
  borderRadius: "6px 6px 0 0", flexShrink: 0,
};
const closeBtn: React.CSSProperties = {
  background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)",
  color: "white", cursor: "pointer", padding: "2px 6px", display: "flex", borderRadius: 2,
};
const cancelBtn: React.CSSProperties = {
  padding: "7px 20px", borderRadius: 3, fontSize: 12, fontWeight: 600,
  cursor: "pointer", background: "white", border: "1px solid #aaa", color: "#333",
};
