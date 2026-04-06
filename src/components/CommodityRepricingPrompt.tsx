import { RefreshCw, X } from "lucide-react";

interface Props {
  jobName: string;
  type: "bid" | "pco";
  onReprice: () => void;
  onSkip: () => void;
}

export default function CommodityRepricingPrompt({ jobName, type, onReprice, onSkip }: Props) {
  const label = type === "pco" ? "PCO Commodity" : "BID Commodity";

  return (
    <div style={overlay}>
      <div style={box}>
        <div style={{ padding: "14px 18px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <RefreshCw size={15} style={{ color: "#2277cc" }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: "#1a2332" }}>Update Material Pricing?</span>
          </div>
          <button onClick={onSkip} style={closeBtn}><X size={14} /></button>
        </div>

        <div style={{ padding: "12px 18px", fontSize: 12, color: "#374151", lineHeight: 1.6 }}>
          You're opening <strong>{jobName}</strong>, which uses the <strong>{label}</strong> sheet.
          <br /><br />
          Would you like to reprice all commodity items (THHN wire, conduit, MC cable, Romex)
          based on the most recently uploaded {label} sheet?
        </div>

        <div style={{ padding: "0 18px 16px", display: "flex", gap: 8 }}>
          <button onClick={onSkip} style={skipBtn}>Skip — Keep Current Prices</button>
          <button onClick={onReprice} style={repriceBtn}>
            <RefreshCw size={12} style={{ marginRight: 5 }} />
            Reprice Now
          </button>
        </div>
      </div>
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
  width: 400, boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
  animation: "fadeIn 0.18s cubic-bezier(0.16,1,0.3,1)",
};
const closeBtn: React.CSSProperties = {
  background: "none", border: "none", cursor: "pointer",
  color: "#94a3b8", padding: 2, display: "flex",
};
const skipBtn: React.CSSProperties = {
  flex: 1, padding: "8px 0", borderRadius: 4, fontSize: 12,
  fontWeight: 600, cursor: "pointer",
  background: "white", border: "1px solid #d1d5db", color: "#374151",
};
const repriceBtn: React.CSSProperties = {
  flex: 1, padding: "8px 0", borderRadius: 4, fontSize: 12,
  fontWeight: 700, cursor: "pointer", border: "none",
  background: "linear-gradient(180deg,#2277cc,#1155aa)", color: "white",
  display: "flex", alignItems: "center", justifyContent: "center",
};
