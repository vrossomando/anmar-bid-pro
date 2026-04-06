import { useState } from "react";
import { X } from "lucide-react";
import type { Project } from "../hooks/db";

interface EditJobModalProps {
  project: Project;
  onSave: (updates: Partial<Project>) => void;
  onClose: () => void;
}

export default function EditJobModal({ project, onSave, onClose }: EditJobModalProps) {
  const [name,         setName]         = useState(project.name);
  const [bidNumber,    setBidNumber]    = useState(project.bid_number    || "");
  const [client,       setClient]       = useState(project.client        || "");
  const [address,      setAddress]      = useState(project.address       || "");
  const [sqft,         setSqft]         = useState(project.square_footage > 0 ? String(project.square_footage) : "");
  const [contactName,  setContactName]  = useState(project.contact_name  || "");
  const [contactPhone, setContactPhone] = useState(project.contact_phone || "");
  const [contactEmail, setContactEmail] = useState(project.contact_email || "");
  const [status,       setStatus]       = useState(project.status);
  const [commodityType, setCommodityType] = useState<"bid" | "pco">(project.commodity_type ?? "bid");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({
      name:          name.trim(),
      bid_number:    bidNumber.trim(),
      client:        client.trim(),
      address:       address.trim(),
      contact_name:  contactName.trim(),
      contact_phone: contactPhone.trim(),
      contact_email: contactEmail.trim(),
      square_footage: parseFloat(sqft) || 0,
      status,
      commodity_type: commodityType,
    });
  };

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={box}>
        <div style={hdr}>
          <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>Edit Job</span>
          <button onClick={onClose} style={closeBtn}><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 13, overflow: "auto" }}>

          {/* Job name */}
          <Field label="Job Name *">
            <input autoFocus value={name} onChange={e => setName(e.target.value)} required style={inp} />
          </Field>

          {/* Bid number + Square footage + Status */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <Field label="Bid Number">
              <input value={bidNumber} onChange={e => setBidNumber(e.target.value)}
                placeholder="e.g. 2026-047" style={inp} />
            </Field>
            <Field label="Square Footage">
              <input type="number" value={sqft} onChange={e => setSqft(e.target.value)}
                placeholder="0" min={0} step={1}
                style={{ ...inp, fontFamily: "var(--font-mono)" }} />
            </Field>
            <Field label="Status">
              <select value={status} onChange={e => setStatus(e.target.value as Project["status"])} style={inp}>
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </Field>
          </div>

          {/* Client */}
          <Field label="Client / Customer">
            <input value={client} onChange={e => setClient(e.target.value)}
              placeholder="Company or person name" style={inp} />
          </Field>

          {/* Address */}
          <Field label="Job Address">
            <input value={address} onChange={e => setAddress(e.target.value)}
              placeholder="Street, City, State, ZIP" style={inp} />
          </Field>

          {/* Contact section */}
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-muted)" }}>
            Contact Information
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Contact Name">
              <input value={contactName} onChange={e => setContactName(e.target.value)} style={inp} />
            </Field>
            <Field label="Contact Phone">
              <input value={contactPhone} onChange={e => setContactPhone(e.target.value)} style={inp} />
            </Field>
          </div>
          <Field label="Contact Email">
            <input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} style={inp} />
          </Field>

          {/* Commodity pricing sheet type */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: 6 }}>
              Commodity Pricing Sheet
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {(["bid", "pco"] as const).map(t => (
                <button key={t} type="button" onClick={() => setCommodityType(t)}
                  style={{
                    flex: 1, padding: "8px 0", borderRadius: 4, fontSize: 12, fontWeight: 700,
                    cursor: "pointer", border: "2px solid",
                    borderColor: commodityType === t ? "var(--accent)" : "var(--border-strong)",
                    background: commodityType === t ? "var(--accent-light)" : "white",
                    color: commodityType === t ? "var(--accent)" : "var(--text-secondary)",
                  }}>
                  {t === "bid" ? "BID Commodity" : "PCO Commodity"}
                </button>
              ))}
            </div>
          </div>

          {/* Buttons */}
          <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
            <button type="button" onClick={onClose} style={cancelBtn}>Cancel</button>
            <button type="submit"
              style={{ ...cancelBtn, flex: 2, background: "var(--accent)", color: "#fff", border: "none", fontWeight: 700 }}>
              Save Changes
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
  borderRadius: "var(--r-lg)", width: 520, maxHeight: "85vh",
  boxShadow: "var(--shadow-lg)", display: "flex", flexDirection: "column",
};
const hdr: React.CSSProperties = {
  padding: "14px 20px", borderBottom: "1px solid var(--border)",
  display: "flex", justifyContent: "space-between", alignItems: "center",
  background: "var(--bg-surface)", borderRadius: "var(--r-lg) var(--r-lg) 0 0", flexShrink: 0,
};
const closeBtn: React.CSSProperties = {
  background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 4, display: "flex",
};
const inp: React.CSSProperties = {
  background: "var(--bg-surface)", border: "1px solid var(--border-strong)",
  borderRadius: "var(--r-md)", color: "var(--text-primary)", fontSize: 13,
  padding: "8px 11px", width: "100%",
};
const cancelBtn: React.CSSProperties = {
  flex: 1, padding: "9px 0", borderRadius: "var(--r-md)", fontSize: 13,
  fontWeight: 600, cursor: "pointer",
  background: "var(--bg-surface)", border: "1px solid var(--border-strong)", color: "var(--text-primary)",
};
