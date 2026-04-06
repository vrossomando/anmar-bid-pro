import { AlertCircle, Clock, CheckCircle, X } from "lucide-react";

interface Props {
  type: "bid" | "pco";
  daysSince: number | null;   // null = never uploaded
  onClose: () => void;
  onUploadNow: () => void;
}

export default function CommodityAgeDialog({ type, daysSince, onClose, onUploadNow }: Props) {
  const label = type === "pco" ? "PCO Commodity" : "BID Commodity";

  const severity =
    daysSince === null      ? "never"
    : daysSince <= 7        ? "fresh"
    : daysSince <= 30       ? "ok"
    : daysSince <= 90       ? "stale"
    :                         "old";

  const colors: Record<typeof severity, { bg: string; border: string; icon: string; text: string }> = {
    never: { bg: "#fef2f2", border: "#fca5a5", icon: "#dc2626", text: "#7f1d1d" },
    fresh: { bg: "#f0fdf4", border: "#86efac", icon: "#16a34a", text: "#14532d" },
    ok:    { bg: "#fffbeb", border: "#fde68a", icon: "#d97706", text: "#78350f" },
    stale: { bg: "#fff7ed", border: "#fdba74", icon: "#ea580c", text: "#7c2d12" },
    old:   { bg: "#fef2f2", border: "#fca5a5", icon: "#dc2626", text: "#7f1d1d" },
  };
  const c = colors[severity];

  const headline =
    daysSince === null
      ? `No ${label} sheet has ever been uploaded`
      : daysSince === 0
        ? `${label} sheet uploaded today`
        : `${label} sheet is ${daysSince} day${daysSince !== 1 ? "s" : ""} old`;

  const body =
    daysSince === null
      ? `Material costs for this job are based on built-in default pricing. Upload a ${label} sheet to use current market rates.`
      : daysSince <= 7
        ? "Your pricing is current — materials costs reflect recent market rates."
        : daysSince <= 30
          ? "Your pricing is reasonably current. Consider uploading a fresh sheet before finalizing your bid."
          : daysSince <= 90
            ? "Your pricing is over a month old. Material costs may have changed — upload a fresh sheet before bidding."
            : "Your pricing is significantly outdated. Upload a new sheet immediately to avoid under-pricing materials.";

  return (
    <div style={overlay}>
      <div style={box}>
        {/* Header */}
        <div style={{ padding: "14px 18px 0 18px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1a2332" }}>Commodity Pricing Notice</div>
          <button onClick={onClose} style={closeBtn}><X size={14} /></button>
        </div>

        {/* Body */}
        <div style={{ padding: "14px 18px" }}>
          <div style={{
            background: c.bg, border: `1px solid ${c.border}`,
            borderRadius: 6, padding: "14px 16px",
            display: "flex", gap: 12, alignItems: "flex-start",
          }}>
            {severity === "fresh"
              ? <CheckCircle size={22} style={{ color: c.icon, flexShrink: 0, marginTop: 1 }} />
              : severity === "never" || severity === "old"
                ? <AlertCircle size={22} style={{ color: c.icon, flexShrink: 0, marginTop: 1 }} />
                : <Clock size={22} style={{ color: c.icon, flexShrink: 0, marginTop: 1 }} />
            }
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: c.text, marginBottom: 4 }}>
                {headline}
              </div>
              <div style={{ fontSize: 12, color: c.text, lineHeight: 1.5, opacity: 0.85 }}>
                {body}
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <StatChip label="Sheet Type" value={label} />
            <StatChip
              label="Last Upload"
              value={daysSince === null ? "Never" : daysSince === 0 ? "Today" : `${daysSince}d ago`}
              highlight={severity === "old" || severity === "never"}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "0 18px 16px", display: "flex", gap: 8 }}>
          <button onClick={onClose} style={dismissBtn}>Proceed Anyway</button>
          <button onClick={onUploadNow} style={uploadBtn}>
            Upload New Sheet
          </button>
        </div>
      </div>
    </div>
  );
}

function StatChip({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{
      flex: 1, background: highlight ? "#fef2f2" : "#f8fafc",
      border: `1px solid ${highlight ? "#fca5a5" : "#e2e8f0"}`,
      borderRadius: 4, padding: "6px 10px",
    }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: "#64748b", textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>{label}</div>
      <div style={{ fontSize: 12, fontWeight: 700, color: highlight ? "#dc2626" : "#1a2332", marginTop: 2 }}>{value}</div>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
  display: "flex", alignItems: "center", justifyContent: "center",
  zIndex: 4000, backdropFilter: "blur(3px)",
  animation: "fadeIn 0.15s ease",
};
const box: React.CSSProperties = {
  background: "white", border: "1px solid #d1d5db", borderRadius: 8,
  width: 420, boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
  animation: "fadeIn 0.18s cubic-bezier(0.16,1,0.3,1)",
};
const closeBtn: React.CSSProperties = {
  background: "none", border: "none", cursor: "pointer",
  color: "#94a3b8", padding: 2, display: "flex",
};
const dismissBtn: React.CSSProperties = {
  flex: 1, padding: "8px 0", borderRadius: 4, fontSize: 12,
  fontWeight: 600, cursor: "pointer",
  background: "white", border: "1px solid #d1d5db", color: "#374151",
};
const uploadBtn: React.CSSProperties = {
  flex: 2, padding: "8px 0", borderRadius: 4, fontSize: 12,
  fontWeight: 700, cursor: "pointer", border: "none",
  background: "linear-gradient(180deg,#2277cc,#1155aa)", color: "white",
};
