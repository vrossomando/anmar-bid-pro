import { useState } from "react";
import { X } from "lucide-react";

export interface SectionBreakdown {
  section: string;
  breakdown: string;
  division: string;
  drawingRef: string;
}

interface Props {
  category: string;
  onConfirm: (sb: SectionBreakdown) => void;
  onCancel: () => void;
}

const BASE_SECTIONS = [
  "Gear/Distribution","Lighting","Devices","HVAC","Fire Alarm",
  "Temporary","Demolition","Telecom","Security","Lighting Control",
  "Generator","Audio Visual","Grounding",
];
const CUSTOM_SECTION_COUNT = 8; // Section #13 through #20

const BASE_BREAKDOWNS = ["BASE BID"];
const CUSTOM_BREAKDOWN_COUNT = 20; // Breakdown #1 through #20

function defaultSection(category: string): string {
  const map: Record<string, string> = {
    "Gear":                   "Gear/Distribution",
    "Lights":                 "Lighting",
    "Lighting":               "Lighting",
    "Lighting Control":       "Lighting Control",
    "Devices":                "Devices",
    "Fire Alarm / Nurse Call": "Fire Alarm",
    "Security / Intercom":     "Security",
    "HVAC / Equip Connections":"HVAC",
    "Generator":              "Generator",
    "Conduit / Wire Feeders": "Gear/Distribution",
    "Cable":                  "Telecom",
    "Miscellaneous Items":    "Gear/Distribution",
    "Temporary":              "Temporary",
    "Temporary Power":        "Temporary",
    "Supports":               "Gear/Distribution",
    "Layout":                 "Gear/Distribution",
    "Punch List":             "Gear/Distribution",
    "Change Order":           "Gear/Distribution",
    "Grounding":              "Grounding",
  };
  return map[category] ?? "Gear/Distribution";
}

export default function SectionBreakdownModal({ category, onConfirm, onCancel }: Props) {
  const [section,   setSection]   = useState(defaultSection(category));
  const [breakdown, setBreakdown] = useState("BASE BID");

  // Custom names for Section #13-20 and Breakdown #1-20
  const [sectionNames, setSectionNames]     = useState<string[]>(
    Array.from({ length: CUSTOM_SECTION_COUNT }, (_, i) => `Section #${i + 13}`)
  );
  const [breakdownNames, setBreakdownNames] = useState<string[]>(
    Array.from({ length: CUSTOM_BREAKDOWN_COUNT }, (_, i) => `Breakdown #${i + 1}`)
  );

  // Inline edit state
  const [editingSectionIdx,   setEditingSectionIdx]   = useState<number | null>(null);
  const [editingBreakdownIdx, setEditingBreakdownIdx] = useState<number | null>(null);
  const [editVal, setEditVal] = useState("");

  const allSections   = [...BASE_SECTIONS, ...sectionNames];
  const allBreakdowns = [...BASE_BREAKDOWNS, ...breakdownNames];

  const handleConfirm = () => {
    onConfirm({ section, breakdown, division: section, drawingRef: "All" });
  };

  const startEditSection = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const customIdx = idx - BASE_SECTIONS.length;
    if (customIdx < 0) return; // base sections are not editable
    setEditingSectionIdx(customIdx);
    setEditVal(sectionNames[customIdx]);
  };

  const commitEditSection = () => {
    if (editingSectionIdx === null) return;
    const newVal = editVal.trim() || `Section #${editingSectionIdx + 13}`;
    const oldName = sectionNames[editingSectionIdx];
    setSectionNames(prev => prev.map((n, i) => i === editingSectionIdx ? newVal : n));
    if (section === oldName) setSection(newVal);
    setEditingSectionIdx(null);
  };

  const startEditBreakdown = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const customIdx = idx - BASE_BREAKDOWNS.length;
    if (customIdx < 0) return;
    setEditingBreakdownIdx(customIdx);
    setEditVal(breakdownNames[customIdx]);
  };

  const commitEditBreakdown = () => {
    if (editingBreakdownIdx === null) return;
    const newVal = editVal.trim() || `Breakdown #${editingBreakdownIdx + 1}`;
    const oldName = breakdownNames[editingBreakdownIdx];
    setBreakdownNames(prev => prev.map((n, i) => i === editingBreakdownIdx ? newVal : n));
    if (breakdown === oldName) setBreakdown(newVal);
    setEditingBreakdownIdx(null);
  };

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div style={box}>
        {/* Header */}
        <div style={hdr}>
          <div style={{ color: "white", fontSize: 14, fontWeight: 700 }}>
            {category} Takeoff
          </div>
          <button onClick={onCancel} style={closeBtn}><X size={15} /></button>
        </div>

        <div style={{ padding: "16px 20px", display: "flex", gap: 16 }}>
          {/* Section column */}
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Section</label>
            <div style={listBox}>
              {allSections.map((s, idx) => {
                const customIdx = idx - BASE_SECTIONS.length;
                const isEditing = customIdx >= 0 && editingSectionIdx === customIdx;
                const isCustom  = customIdx >= 0;
                return (
                  <div
                    key={idx}
                    onClick={() => { if (!isEditing) setSection(s); }}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "5px 8px", cursor: "pointer", fontSize: 12,
                      background: section === s ? "#1a56db" : "transparent",
                      color: section === s ? "white" : "#1a2332",
                      borderRadius: 3, gap: 4,
                    }}
                  >
                    {isEditing ? (
                      <input
                        autoFocus
                        value={editVal}
                        onChange={e => setEditVal(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") commitEditSection(); if (e.key === "Escape") setEditingSectionIdx(null); }}
                        onClick={e => e.stopPropagation()}
                        style={{ flex: 1, fontSize: 12, padding: "1px 4px", border: "1px solid #2277cc", borderRadius: 3, outline: "none" }}
                      />
                    ) : (
                      <span style={{ flex: 1 }}>{s}</span>
                    )}
                    {isCustom && !isEditing && (
                      <button
                        onClick={e => startEditSection(idx, e)}
                        title="Rename"
                        style={{ background: "none", border: "none", cursor: "pointer", padding: "0 2px", opacity: 0.5, color: "inherit", display: "flex", alignItems: "center" }}
                      >
                        ✎
                      </button>
                    )}
                    {isEditing && (
                      <button
                        onClick={e => { e.stopPropagation(); commitEditSection(); }}
                        style={{ background: "none", border: "none", cursor: "pointer", padding: "0 2px", color: "#22aa44", display: "flex", alignItems: "center" }}
                      >
                        ✓
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Breakdown column */}
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Breakdown</label>
            <div style={listBox}>
              {allBreakdowns.map((b, idx) => {
                const customIdx = idx - BASE_BREAKDOWNS.length;
                const isEditing = customIdx >= 0 && editingBreakdownIdx === customIdx;
                const isCustom  = customIdx >= 0;
                return (
                  <div
                    key={idx}
                    onClick={() => { if (!isEditing) setBreakdown(b); }}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "5px 8px", cursor: "pointer", fontSize: 12,
                      background: breakdown === b ? "#1a56db" : "transparent",
                      color: breakdown === b ? "white" : "#1a2332",
                      borderRadius: 3, gap: 4,
                    }}
                  >
                    {isEditing ? (
                      <input
                        autoFocus
                        value={editVal}
                        onChange={e => setEditVal(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") commitEditBreakdown(); if (e.key === "Escape") setEditingBreakdownIdx(null); }}
                        onClick={e => e.stopPropagation()}
                        style={{ flex: 1, fontSize: 12, padding: "1px 4px", border: "1px solid #2277cc", borderRadius: 3, outline: "none" }}
                      />
                    ) : (
                      <span style={{ flex: 1 }}>{b}</span>
                    )}
                    {isCustom && !isEditing && (
                      <button
                        onClick={e => startEditBreakdown(idx, e)}
                        title="Rename"
                        style={{ background: "none", border: "none", cursor: "pointer", padding: "0 2px", opacity: 0.5, color: "inherit", display: "flex", alignItems: "center" }}
                      >
                        ✎
                      </button>
                    )}
                    {isEditing && (
                      <button
                        onClick={e => { e.stopPropagation(); commitEditBreakdown(); }}
                        style={{ background: "none", border: "none", cursor: "pointer", padding: "0 2px", color: "#22aa44", display: "flex", alignItems: "center" }}
                      >
                        ✓
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Selected summary */}
        <div style={{ padding: "0 20px 10px", fontSize: 12, color: "var(--text-secondary)" }}>
          <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>Section:</span> {section}
          &nbsp;&nbsp;
          <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>Breakdown:</span> {breakdown}
        </div>

        {/* Buttons */}
        <div style={{ padding: "10px 20px 18px", display: "flex", gap: 10 }}>
          <button onClick={onCancel} style={cancelBtn}>Cancel</button>
          <button
            onClick={handleConfirm}
            style={{
              ...cancelBtn, flex: 2,
              background: "linear-gradient(180deg,#2277cc,#1155aa)",
              color: "white", border: "none", fontWeight: 700,
              fontFamily: "Arial,sans-serif", textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            Continue →
          </button>
        </div>
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.40)",
  display: "flex", alignItems: "center", justifyContent: "center",
  zIndex: 2000, backdropFilter: "blur(3px)", animation: "fadeIn 0.15s ease",
};
const box: React.CSSProperties = {
  background: "var(--bg-raised)", border: "1px solid var(--border-strong)",
  borderRadius: "var(--r-lg)", width: 520, boxShadow: "var(--shadow-lg)",
  animation: "fadeIn 0.18s cubic-bezier(0.16,1,0.3,1)",
};
const hdr: React.CSSProperties = {
  padding: "13px 18px", borderBottom: "1px solid var(--border)",
  display: "flex", justifyContent: "space-between", alignItems: "center",
  background: "linear-gradient(to right,#0a246a,#2a5abf)",
  borderRadius: "var(--r-lg) var(--r-lg) 0 0",
};
const closeBtn: React.CSSProperties = {
  background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)",
  color: "white", cursor: "pointer", padding: "3px 6px", display: "flex",
  borderRadius: "var(--r-sm)",
};
const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 11, fontWeight: 700,
  color: "var(--text-secondary)", marginBottom: 5,
  textTransform: "uppercase", letterSpacing: "0.06em",
};
const listBox: React.CSSProperties = {
  width: "100%", background: "white",
  border: "1px solid var(--border-strong)",
  borderRadius: "var(--r-sm)", overflow: "auto",
  maxHeight: 260,
};
const cancelBtn: React.CSSProperties = {
  flex: 1, padding: "9px 0", borderRadius: "var(--r-md)", fontSize: 13,
  fontWeight: 600, cursor: "pointer",
  background: "var(--bg-surface)", border: "1px solid var(--border-strong)",
  color: "var(--text-primary)",
};
