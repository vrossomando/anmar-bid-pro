import { useState } from "react";
import { X, DollarSign, HelpCircle, XCircle } from "lucide-react";

export type ZeroCostResolution = "no-cost" | "quote" | "edit";

export interface ZeroCostItem {
  description: string;
  assemblyId: number | null;
  qty: number;
  unit: string;
}

// Quote categories the user can assign a $0 item to
const QUOTE_CATEGORIES = [
  "Security / Intercom",
  "Fire Alarm / Nurse Call",
  "Gear",
  "Conduit / Wire Feeders",
  "Cable",
  "Lights & Devices",
  "Miscellaneous Items",
  "Grounding",
  "Generator",
  "Lighting Control",
  "Temporary Power",
  "Specialty Items",
  "Devices",
  "HVAC / Equip Connections",
];

interface Props {
  items: ZeroCostItem[];
  onResolve: (
    description: string,
    assemblyId: number | null,
    resolution: ZeroCostResolution,
    newUnitCost?: number,
    quoteCategory?: string
  ) => void;
  onDone: () => void;
}

export default function ZeroCostDialog({ items, onResolve, onDone }: Props) {
  const [index,         setIndex]         = useState(0);
  const [editPrice,     setEditPrice]     = useState("");
  const [editError,     setEditError]     = useState("");
  const [quoteCategory, setQuoteCategory] = useState(QUOTE_CATEGORIES[0]);
  const [showQuotePick, setShowQuotePick] = useState(false);

  const item = items[index];
  if (!item) return null;

  const isLast = index === items.length - 1;

  const advance = () => {
    setEditPrice("");
    setEditError("");
    setShowQuotePick(false);
    setQuoteCategory(QUOTE_CATEGORIES[0]);
    if (isLast) { onDone(); } else { setIndex(i => i + 1); }
  };

  const choose = (resolution: ZeroCostResolution) => {
    if (resolution === "quote") {
      // Require category selection before proceeding
      if (!showQuotePick) {
        setShowQuotePick(true);
        return;
      }
      onResolve(item.description, item.assemblyId, "quote", undefined, quoteCategory);
      advance();
      return;
    }
    if (resolution === "edit") {
      const val = parseFloat(editPrice.replace(/[$,]/g, ""));
      if (isNaN(val) || val < 0) {
        setEditError("Enter a valid unit cost (0 or greater)");
        return;
      }
      onResolve(item.description, item.assemblyId, "edit", val);
    } else {
      onResolve(item.description, item.assemblyId, resolution);
    }
    advance();
  };

  return (
    <div style={overlay}>
      <div style={box}>

        {/* Header */}
        <div style={hdr}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13 }}>$0 Unit Price Detected</div>
            {items.length > 1 && (
              <div style={{ fontSize: 10, opacity: 0.75, marginTop: 2 }}>
                Item {index + 1} of {items.length}
              </div>
            )}
          </div>
          <button onClick={onDone} style={closeBtn} title="Skip remaining"><X size={13} /></button>
        </div>

        {/* Item info */}
        <div style={{ padding: "14px 18px 0" }}>
          <div style={{
            background: "#fff8e1", border: "1px solid #f59e0b",
            borderLeft: "4px solid #f59e0b",
            borderRadius: 4, padding: "10px 14px", marginBottom: 14,
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#92400e", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
              Item with $0 unit cost
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#1a2332" }}>{item.description}</div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 3 }}>
              Qty: {item.qty.toLocaleString()} {item.unit}
            </div>
          </div>

          <div style={{ fontSize: 12, color: "#374151", marginBottom: 12, fontWeight: 600 }}>
            How should this item be handled?
          </div>

          {/* Choice buttons */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>

            {/* No cost */}
            <ChoiceBtn
              icon={<XCircle size={16} />}
              color="#6b7280"
              title="Proceed as no-cost item"
              description="Keep $0 — labor only, free sample, owner-furnished, or no material charge."
              onClick={() => choose("no-cost")}
            />

            {/* Quote — expands to show category picker */}
            <div style={{
              border: `1px solid ${showQuotePick ? "#7c3aed" : "#7c3aed44"}`,
              borderLeft: "4px solid #7c3aed",
              borderRadius: 4, overflow: "hidden",
            }}>
              <button
                onClick={() => { setShowQuotePick(p => !p); setEditError(""); }}
                style={{
                  display: "flex", alignItems: "flex-start", gap: 12,
                  padding: "10px 14px", background: showQuotePick ? "#f5f0ff" : "white",
                  border: "none", cursor: "pointer", textAlign: "left", width: "100%",
                  transition: "background 0.1s",
                }}
                onMouseEnter={e => { if (!showQuotePick) e.currentTarget.style.background = "#7c3aed0a"; }}
                onMouseLeave={e => { if (!showQuotePick) e.currentTarget.style.background = "white"; }}
              >
                <span style={{ color: "#7c3aed", marginTop: 1, flexShrink: 0 }}><HelpCircle size={16} /></span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#1a2332", marginBottom: 2 }}>
                    Place under quote section
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.4 }}>
                    Mark as quoted — price entered separately when quote is received.
                  </div>
                </div>
                <span style={{ marginLeft: "auto", color: "#7c3aed", fontSize: 16, lineHeight: 1, paddingTop: 1 }}>
                  {showQuotePick ? "▾" : "▸"}
                </span>
              </button>

              {/* Category picker — expands inline */}
              {showQuotePick && (
                <div style={{ padding: "10px 14px 12px", borderTop: "1px solid #ede9fe", background: "#faf7ff" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#6d28d9", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Assign to quote category:
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <select
                      value={quoteCategory}
                      onChange={e => setQuoteCategory(e.target.value)}
                      style={{
                        flex: 1, padding: "7px 10px",
                        border: "1px solid #c4b5fd", borderRadius: 3,
                        fontSize: 13, background: "white", color: "#1a2332",
                      }}
                    >
                      {QUOTE_CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => choose("quote")}
                      style={{
                        padding: "7px 16px", background: "#7c3aed", color: "white",
                        border: "none", borderRadius: 3, fontWeight: 700, fontSize: 12,
                        cursor: "pointer", whiteSpace: "nowrap",
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#6d28d9")}
                      onMouseLeave={e => (e.currentTarget.style.background = "#7c3aed")}
                    >
                      Assign to Quote
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Edit price */}
            <div style={{
              border: "1px solid #10b98133",
              borderLeft: "4px solid #10b981",
              borderRadius: 4, overflow: "hidden",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "#f0fdf4" }}>
                <span style={{ color: "#10b981", flexShrink: 0 }}><DollarSign size={16} /></span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#1a2332" }}>Enter unit cost</div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 1 }}>
                    Set the actual unit price for this item.
                  </div>
                </div>
              </div>
              <div style={{ padding: "8px 14px 12px", background: "white", borderTop: "1px solid #d1fae5" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <div style={{ position: "relative", flex: 1 }}>
                    <span style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "#64748b", fontSize: 13, pointerEvents: "none" }}>$</span>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={editPrice}
                      onChange={e => { setEditPrice(e.target.value); setEditError(""); }}
                      onKeyDown={e => { if (e.key === "Enter") choose("edit"); }}
                      placeholder="0.00"
                      style={{
                        width: "100%", padding: "7px 8px 7px 24px",
                        border: `1px solid ${editError ? "#ef4444" : "#d1fae5"}`,
                        borderRadius: 3, fontSize: 13,
                        fontFamily: "var(--font-mono)", background: "white",
                      }}
                    />
                  </div>
                  <button
                    onClick={() => choose("edit")}
                    style={{
                      padding: "7px 16px", background: "#10b981", color: "white",
                      border: "none", borderRadius: 3, fontWeight: 700, fontSize: 12,
                      cursor: "pointer", whiteSpace: "nowrap",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#059669")}
                    onMouseLeave={e => (e.currentTarget.style.background = "#10b981")}
                  >
                    Apply Price
                  </button>
                </div>
                {editError && (
                  <div style={{ fontSize: 11, color: "#ef4444", marginTop: 4 }}>{editError}</div>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* Footer note */}
        <div style={{ padding: "10px 18px 14px", borderTop: "1px solid #e5e7eb" }}>
          <div style={{ fontSize: 10, color: "#9ca3af", lineHeight: 1.5 }}>
            This choice applies to all instances of this item in the current estimate.
            {items.length > 1 && !isLast && (
              <span style={{ marginLeft: 6, color: "#6b7280" }}>
                · {items.length - index - 1} more item{items.length - index - 1 !== 1 ? "s" : ""} to review.
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Choice button ──────────────────────────────────────────────────────────

function ChoiceBtn({ icon, color, title, description, onClick }: {
  icon: React.ReactNode; color: string;
  title: string; description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "flex-start", gap: 12,
        padding: "10px 14px",
        background: "white",
        border: `1px solid ${color}44`,
        borderLeft: `4px solid ${color}`,
        borderRadius: 4,
        cursor: "pointer", textAlign: "left", width: "100%",
        transition: "background 0.1s",
      }}
      onMouseEnter={e => (e.currentTarget.style.background = `${color}0a`)}
      onMouseLeave={e => (e.currentTarget.style.background = "white")}
    >
      <span style={{ color, marginTop: 1, flexShrink: 0 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#1a2332", marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.4 }}>{description}</div>
      </div>
    </button>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const overlay: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
  display: "flex", alignItems: "center", justifyContent: "center",
  zIndex: 4500, backdropFilter: "blur(3px)", animation: "fadeIn 0.15s ease",
};
const box: React.CSSProperties = {
  background: "white", border: "1px solid #888",
  borderRadius: 6, width: 480, maxHeight: "90vh", overflow: "auto",
  boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
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

