import { useState } from "react";
import { X } from "lucide-react";
import type { Project } from "../hooks/db";

interface NewJobModalProps {
  onClose: () => void;
  onCreate: (p: Omit<Project, "id" | "created_at" | "updated_at">) => void;
}

export default function NewJobModal({ onClose, onCreate }: NewJobModalProps) {
  const [name, setName]               = useState("");
  const [bidNumber, setBidNumber]     = useState("");
  const [client, setClient]           = useState("");
  const [address, setAddress]         = useState("");
  const [sqft, setSqft]               = useState<string>("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [commodityType, setCommodityType] = useState<"bid" | "pco">("bid");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate({
      name:          name.trim(),
      bid_number:    bidNumber.trim(),
      client:        client.trim(),
      address:       address.trim(),
      contact_name:  contactName.trim(),
      contact_phone: contactPhone.trim(),
      contact_email: contactEmail.trim(),
      description:   "",
      notes:         "",
      status:        "draft",
      square_footage: parseFloat(sqft) || 0,
      tax_rate:      0,   // set in Reports > Totals per requirements
      actual_bid_price: 0,
      commodity_type: commodityType,
    });
  };

  const canSubmit = name.trim().length > 0;

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={box}>
        {/* Header */}
        <div style={hdr}>
          <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>New Job</span>
          <button onClick={onClose} style={closeBtn}><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 13 }}>

          {/* Row 1 — Job name (full width) */}
          <Field label="Job Name *">
            <input
              autoFocus value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. Main Street Office Renovation"
              required style={inp}
            />
          </Field>

          {/* Row 2 — Bid number + Square footage */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Bid Number">
              <input
                value={bidNumber} onChange={e => setBidNumber(e.target.value)}
                placeholder="e.g. 2026-047" style={inp}
              />
            </Field>
            <Field label="Square Footage">
              <input
                type="number" value={sqft} onChange={e => setSqft(e.target.value)}
                placeholder="0" min={0} step={1}
                style={{ ...inp, fontFamily: "var(--font-mono)" }}
              />
            </Field>
          </div>

          {/* Row 3 — Client (full width) */}
          <Field label="Client / Customer">
            <input
              value={client} onChange={e => setClient(e.target.value)}
              placeholder="Company or person name" style={inp}
            />
          </Field>

          {/* Row 4 — Address (full width) */}
          <Field label="Job Address">
            <input
              value={address} onChange={e => setAddress(e.target.value)}
              placeholder="Street, City, State, ZIP" style={inp}
            />
          </Field>

          {/* Divider */}
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-muted)", paddingTop: 2 }}>
            Contact Information
          </div>

          {/* Row 5 — Contact name + phone */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Contact Name">
              <input value={contactName} onChange={e => setContactName(e.target.value)}
                placeholder="Full name" style={inp} />
            </Field>
            <Field label="Contact Phone">
              <input value={contactPhone} onChange={e => setContactPhone(e.target.value)}
                placeholder="(555) 000-0000" style={inp} />
            </Field>
          </div>

          {/* Row 6 — Contact email (full width) */}
          <Field label="Contact Email">
            <input
              type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)}
              placeholder="email@company.com" style={inp}
            />
          </Field>

          {/* Commodity sheet selection */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: 6 }}>
              Commodity Pricing Sheet
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {(["bid", "pco"] as const).map(t => (
                <button
                  key={t} type="button"
                  onClick={() => setCommodityType(t)}
                  style={{
                    flex: 1, padding: "9px 0", borderRadius: 4, fontSize: 12, fontWeight: 700,
                    cursor: "pointer", border: "2px solid",
                    borderColor: commodityType === t ? "var(--accent)" : "var(--border-strong)",
                    background: commodityType === t ? "var(--accent-light)" : "white",
                    color: commodityType === t ? "var(--accent)" : "var(--text-secondary)",
                  }}
                >
                  {t === "bid" ? "BID Commodity" : "PCO Commodity"}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 5, fontStyle: "italic" }}>
              {commodityType === "bid"
                ? "Use standard BID pricing sheet for material costs"
                : "Use PCO/change-order pricing sheet for material costs"}
            </div>
          </div>

          {/* Buttons */}
          <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
            <button type="button" onClick={onClose} style={cancelBtn}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              style={{
                ...cancelBtn, flex: 2,
                background: canSubmit ? "var(--accent)" : "var(--bg-hover)",
                color: canSubmit ? "#fff" : "var(--text-muted)",
                border: "none", fontWeight: 700,
                cursor: canSubmit ? "pointer" : "not-allowed",
              }}
            >
              Create Job
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
        {label}
      </label>
      {children}
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
  borderRadius: "var(--r-lg)", width: 520, boxShadow: "var(--shadow-lg)",
  animation: "fadeIn 0.2s cubic-bezier(0.16,1,0.3,1)",
};
const hdr: React.CSSProperties = {
  padding: "14px 20px", borderBottom: "1px solid var(--border)",
  display: "flex", justifyContent: "space-between", alignItems: "center",
  background: "var(--bg-surface)", borderRadius: "var(--r-lg) var(--r-lg) 0 0",
};
const closeBtn: React.CSSProperties = {
  background: "none", border: "none", color: "var(--text-muted)",
  cursor: "pointer", padding: 4, display: "flex", borderRadius: "var(--r-sm)",
};
const inp: React.CSSProperties = {
  background: "var(--bg-surface)", border: "1px solid var(--border-strong)",
  borderRadius: "var(--r-md)", color: "var(--text-primary)", fontSize: 13,
  padding: "8px 11px", width: "100%",
};
const cancelBtn: React.CSSProperties = {
  flex: 1, padding: "9px 0", borderRadius: "var(--r-md)", fontSize: 13,
  fontWeight: 600, cursor: "pointer",
  background: "var(--bg-surface)", border: "1px solid var(--border-strong)",
  color: "var(--text-primary)",
};
