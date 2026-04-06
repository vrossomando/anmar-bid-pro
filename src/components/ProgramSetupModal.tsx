import { useState, useEffect } from "react";
import { X, Save, CheckCircle, Building, Phone, Mail, Globe, DollarSign, Percent, Upload, FileText } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { loadSettings, saveSetting } from "../hooks/db";

interface Props {
  onClose: () => void;
  onSaved: () => void;
}

interface ProgramSettings {
  company_name: string;
  company_address: string;
  company_city: string;
  company_state: string;
  company_zip: string;
  company_phone: string;
  company_fax: string;
  company_email: string;
  company_website: string;
  company_license: string;
  // Estimating defaults
  default_markup: string;
  default_overhead: string;
  default_profit: string;
  default_bond: string;
  default_tax_rate: string;
  // Labor defaults
  foreman_rate: string;
  journeyman_rate: string;
  apprentice_rate: string;
  foreman_pct: string;
  journeyman_pct: string;
  apprentice_pct: string;
  // Display
  currency_symbol: string;
  bid_number_prefix: string;
  next_bid_number: string;
  // Branding
  company_logo: string;  // base64 data-url or empty string
  // Proposal letter
  estimator_name: string;
  estimator_title: string;
}

const DEFAULTS: ProgramSettings = {
  company_name: "Anmar Electric",
  company_address: "",
  company_city: "",
  company_state: "PA",
  company_zip: "",
  company_phone: "",
  company_fax: "",
  company_email: "",
  company_website: "",
  company_license: "",
  default_markup: "0",
  default_overhead: "10",
  default_profit: "0",
  default_bond: "0",
  default_tax_rate: "0",
  foreman_rate: "144.42",
  journeyman_rate: "138.56",
  apprentice_rate: "103.93",
  foreman_pct: "10",
  journeyman_pct: "70",
  apprentice_pct: "20",
  currency_symbol: "$",
  bid_number_prefix: "",
  next_bid_number: "1",
  company_logo: "",
  estimator_name: "",
  estimator_title: "Project Estimator",
};

type Tab = "company" | "estimating" | "labor" | "proposal";

export default function ProgramSetupModal({ onClose, onSaved }: Props) {
  const [settings, setSettings] = useState<ProgramSettings>(DEFAULTS);
  const [activeTab, setActiveTab] = useState<Tab>("company");
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);

  useEffect(() => {
    loadSettings().then(dbSettings => {
      setSettings(prev => {
        const merged = { ...prev };
        for (const [k, v] of Object.entries(dbSettings)) {
          if (k in merged) (merged as Record<string, string>)[k] = v;
        }
        return merged;
      });
    });
  }, []);

  const set = (key: keyof ProgramSettings, val: string) =>
    setSettings(s => ({ ...s, [key]: val }));

  // Check template presence whenever proposal tab is visited
  useEffect(() => {
    if (activeTab === "proposal") {
      invoke<boolean>("has_proposal_template")
        .then(has => setTemplateStatus(has ? "present" : "absent"))
        .catch(() => setTemplateStatus("absent"));
    }
  }, [activeTab]);

  const handleTemplateUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setTemplateUploading(true);
    setTemplateMsg(null);
    try {
      const buf = await file.arrayBuffer();
      const bytes = Array.from(new Uint8Array(buf));
      await invoke("save_proposal_template", { data: bytes });
      setTemplateStatus("present");
      setTemplateMsg(`✓ Template uploaded: ${file.name}`);
    } catch (err) {
      setTemplateMsg(`✗ Upload failed: ${String(err)}`);
    } finally {
      setTemplateUploading(false);
      e.target.value = "";
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const [k, v] of Object.entries(settings)) {
        await saveSetting(k, v);
      }
      setSaved(true);
      onSaved();
      setTimeout(() => setSaved(false), 2000);
    } finally { setSaving(false); }
  };

  const [templateStatus, setTemplateStatus] = useState<"unknown"|"present"|"absent">("unknown");
  const [templateUploading, setTemplateUploading] = useState(false);
  const [templateMsg, setTemplateMsg] = useState<string|null>(null);

  const TABS: { id: Tab; label: string }[] = [
    { id: "company",    label: "Company Info" },
    { id: "estimating", label: "Estimating Defaults" },
    { id: "labor",      label: "Labor Rates" },
    { id: "proposal",   label: "Proposal Letter" },
  ];

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={box}>
        {/* Header */}
        <div style={hdr}>
          <div style={{ color: "white", fontSize: 15, fontWeight: 700 }}>Program Setup</div>
          <button onClick={onClose} style={closeBtn}><X size={15} /></button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "2px solid var(--border-strong)", background: "var(--bg-surface)", flexShrink: 0 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              style={{ padding: "10px 20px", border: "none", cursor: "pointer", fontSize: 13, fontWeight: activeTab === t.id ? 700 : 500, background: "transparent", color: activeTab === t.id ? "var(--accent)" : "var(--text-secondary)", borderBottom: `2px solid ${activeTab === t.id ? "var(--accent)" : "transparent"}`, marginBottom: -2, transition: "all var(--t-fast)" }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: "auto", padding: "20px 24px" }}>

          {/* Company Info */}
          {activeTab === "company" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

              {/* ── Logo upload ── */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                  Company Logo
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  {/* Preview box */}
                  <div style={{
                    width: 120, height: 56, border: "2px dashed var(--border-strong)",
                    borderRadius: "var(--r-md)", display: "flex", alignItems: "center",
                    justifyContent: "center", background: "#f8fafc", flexShrink: 0, overflow: "hidden",
                  }}>
                    {settings.company_logo ? (
                      <img src={settings.company_logo} alt="Logo preview" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                    ) : (
                      <span style={{ fontSize: 10, color: "var(--text-muted)", textAlign: "center", lineHeight: 1.4 }}>No logo<br />uploaded</span>
                    )}
                  </div>
                  {/* Controls */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <label style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      padding: "7px 14px", background: "linear-gradient(180deg,#2277cc,#1155aa)",
                      color: "white", borderRadius: "var(--r-sm)", fontSize: 12,
                      fontWeight: 600, cursor: "pointer", border: "none", userSelect: "none",
                    }}>
                      📁 Choose Image…
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
                        style={{ display: "none" }}
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = ev => {
                            const result = ev.target?.result as string;
                            set("company_logo", result);
                          };
                          reader.readAsDataURL(file);
                          e.target.value = ""; // reset so same file can be re-selected
                        }}
                      />
                    </label>
                    {settings.company_logo && (
                      <button
                        onClick={() => set("company_logo", "")}
                        style={{ padding: "6px 14px", background: "none", border: "1px solid #fca5a5", color: "#dc2626", borderRadius: "var(--r-sm)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                      >
                        ✕ Remove Logo
                      </button>
                    )}
                    <div style={{ fontSize: 10, color: "var(--text-muted)", lineHeight: 1.5 }}>
                      PNG, JPG, SVG, GIF, WebP<br />
                      Shown in top-left of the app bar
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ height: 1, background: "var(--border)" }} />
              <FieldRow icon={<Building size={14} />} label="Company Name" required>
                <TextInput value={settings.company_name} onChange={v => set("company_name", v)} placeholder="Anmar Electric" />
              </FieldRow>
              <FieldRow icon={null} label="Address">
                <TextInput value={settings.company_address} onChange={v => set("company_address", v)} placeholder="123 Main Street" />
              </FieldRow>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 100px", gap: 10 }}>
                <div>
                  <label style={labelStyle}>City</label>
                  <TextInput value={settings.company_city} onChange={v => set("company_city", v)} placeholder="Philadelphia" />
                </div>
                <div>
                  <label style={labelStyle}>State</label>
                  <TextInput value={settings.company_state} onChange={v => set("company_state", v)} placeholder="PA" />
                </div>
                <div>
                  <label style={labelStyle}>ZIP</label>
                  <TextInput value={settings.company_zip} onChange={v => set("company_zip", v)} placeholder="19103" />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <FieldRow icon={<Phone size={14} />} label="Phone">
                  <TextInput value={settings.company_phone} onChange={v => set("company_phone", v)} placeholder="(215) 555-0100" />
                </FieldRow>
                <FieldRow icon={<Phone size={14} />} label="Fax">
                  <TextInput value={settings.company_fax} onChange={v => set("company_fax", v)} placeholder="(215) 555-0101" />
                </FieldRow>
              </div>
              <FieldRow icon={<Mail size={14} />} label="Email">
                <TextInput value={settings.company_email} onChange={v => set("company_email", v)} placeholder="estimating@anmarelectric.com" type="email" />
              </FieldRow>
              <FieldRow icon={<Globe size={14} />} label="Website">
                <TextInput value={settings.company_website} onChange={v => set("company_website", v)} placeholder="www.anmarelectric.com" />
              </FieldRow>
              <FieldRow icon={null} label="Contractor License #">
                <TextInput value={settings.company_license} onChange={v => set("company_license", v)} placeholder="PA-12345" />
              </FieldRow>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <FieldRow icon={null} label="Bid Number Prefix">
                  <TextInput value={settings.bid_number_prefix} onChange={v => set("bid_number_prefix", v)} placeholder="AE-" />
                </FieldRow>
                <FieldRow icon={null} label="Next Bid Number">
                  <TextInput value={settings.next_bid_number} onChange={v => set("next_bid_number", v)} placeholder="1001" type="number" />
                </FieldRow>
              </div>
            </div>
          )}

          {/* Estimating Defaults */}
          {activeTab === "estimating" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ fontSize: 12, color: "var(--text-muted)", padding: "8px 12px", background: "#f0f6ff", borderRadius: "var(--r-md)", border: "1px solid #c7d9f0" }}>
                These are the default values used when creating new estimates. They can be overridden per-job in the Reports → Totals screen.
              </div>
              <SectionLabel>Material</SectionLabel>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <FieldRow icon={<Percent size={14} />} label="Default Markup %">
                  <NumInput value={settings.default_markup} onChange={v => set("default_markup", v)} min={0} max={100} step={0.5} />
                </FieldRow>
                <FieldRow icon={<Percent size={14} />} label="Default Tax Rate %">
                  <NumInput value={settings.default_tax_rate} onChange={v => set("default_tax_rate", v)} min={0} max={20} step={0.01} />
                </FieldRow>
              </div>
              <SectionLabel>Overhead & Profit</SectionLabel>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <FieldRow icon={<Percent size={14} />} label="Overhead %">
                  <NumInput value={settings.default_overhead} onChange={v => set("default_overhead", v)} min={0} max={100} step={0.5} />
                </FieldRow>
                <FieldRow icon={<Percent size={14} />} label="Profit %">
                  <NumInput value={settings.default_profit} onChange={v => set("default_profit", v)} min={0} max={100} step={0.5} />
                </FieldRow>
                <FieldRow icon={<Percent size={14} />} label="Bond %">
                  <NumInput value={settings.default_bond} onChange={v => set("default_bond", v)} min={0} max={10} step={0.1} />
                </FieldRow>
              </div>
              <SectionLabel>Display</SectionLabel>
              <FieldRow icon={<DollarSign size={14} />} label="Currency Symbol">
                <TextInput value={settings.currency_symbol} onChange={v => set("currency_symbol", v)} placeholder="$" />
              </FieldRow>
            </div>
          )}

          {/* Labor Rates */}
          {activeTab === "labor" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ fontSize: 12, color: "var(--text-muted)", padding: "8px 12px", background: "#f0f6ff", borderRadius: "var(--r-md)", border: "1px solid #c7d9f0" }}>
                Default crew rates and mix. These are loaded into every new Totals report and can be adjusted per-estimate there.
              </div>
              <SectionLabel>Hourly Rates</SectionLabel>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <FieldRow icon={<DollarSign size={14} />} label="Foreman ($/hr)">
                  <NumInput value={settings.foreman_rate} onChange={v => set("foreman_rate", v)} min={0} step={0.01} />
                </FieldRow>
                <FieldRow icon={<DollarSign size={14} />} label="Journeyman ($/hr)">
                  <NumInput value={settings.journeyman_rate} onChange={v => set("journeyman_rate", v)} min={0} step={0.01} />
                </FieldRow>
                <FieldRow icon={<DollarSign size={14} />} label="Apprentice ($/hr)">
                  <NumInput value={settings.apprentice_rate} onChange={v => set("apprentice_rate", v)} min={0} step={0.01} />
                </FieldRow>
              </div>
              <SectionLabel>Default Crew Mix</SectionLabel>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <FieldRow icon={<Percent size={14} />} label="Foreman %">
                  <NumInput value={settings.foreman_pct} onChange={v => set("foreman_pct", v)} min={0} max={100} step={1} />
                </FieldRow>
                <FieldRow icon={<Percent size={14} />} label="Journeyman %">
                  <NumInput value={settings.journeyman_pct} onChange={v => set("journeyman_pct", v)} min={0} max={100} step={1} />
                </FieldRow>
                <FieldRow icon={<Percent size={14} />} label="Apprentice %">
                  <NumInput value={settings.apprentice_pct} onChange={v => set("apprentice_pct", v)} min={0} max={100} step={1} />
                </FieldRow>
              </div>
              {/* Blended rate preview */}
              {(() => {
                const fm = parseFloat(settings.foreman_rate) || 0;
                const jm = parseFloat(settings.journeyman_rate) || 0;
                const ap = parseFloat(settings.apprentice_rate) || 0;
                const fp = parseFloat(settings.foreman_pct) || 0;
                const jp = parseFloat(settings.journeyman_pct) || 0;
                const pp = parseFloat(settings.apprentice_pct) || 0;
                const total = fp + jp + pp;
                const blended = total > 0 ? (fm * fp + jm * jp + ap * pp) / total : 0;
                return (
                  <div style={{ padding: "12px 16px", background: total === 100 ? "#dcfce7" : "#fee2e2", borderRadius: "var(--r-md)", border: `1px solid ${total === 100 ? "#86efac" : "#fca5a5"}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: 12, color: total === 100 ? "#15803d" : "#dc2626" }}>
                      {total === 100 ? "✓ Crew mix totals 100%" : `⚠ Crew mix totals ${total}% — must equal 100%`}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "var(--font-mono)", color: "#1a3a6a" }}>
                      Blended: ${blended.toFixed(2)}/hr
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
          {/* Proposal Letter */}
          {activeTab === "proposal" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

              {/* Template upload */}
              <div>
                <SectionLabel>Proposal Template (.docx)</SectionLabel>
                <div style={{ padding: "14px 16px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "var(--r-md)" }}>
                  {/* Status badge */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <div style={{
                      padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                      background: templateStatus === "present" ? "#dcfce7" : templateStatus === "absent" ? "#fee2e2" : "#f1f5f9",
                      color: templateStatus === "present" ? "#15803d" : templateStatus === "absent" ? "#b91c1c" : "#64748b",
                      border: `1px solid ${templateStatus === "present" ? "#86efac" : templateStatus === "absent" ? "#fca5a5" : "#cbd5e1"}`,
                    }}>
                      {templateStatus === "present" ? "✓ Template on file" : templateStatus === "absent" ? "✗ No template uploaded" : "Checking…"}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 12, lineHeight: 1.5 }}>
                    Upload your <strong>.docx</strong> proposal letter template. Place tokens like{" "}
                    <code style={{ background: "#e2e8f0", padding: "1px 5px", borderRadius: 3, fontSize: 10 }}>{"{{PROJECT_NAME}}"}</code>{" "}
                    anywhere in the document and they will be replaced automatically when you generate a letter.
                  </div>
                  <label style={{
                    display: "inline-flex", alignItems: "center", gap: 7,
                    padding: "8px 16px", background: "linear-gradient(180deg,#2277cc,#1155aa)",
                    color: "white", borderRadius: "var(--r-sm)", fontSize: 12, fontWeight: 700,
                    cursor: templateUploading ? "not-allowed" : "pointer", opacity: templateUploading ? 0.6 : 1,
                  }}>
                    <Upload size={13} />
                    {templateUploading ? "Uploading…" : templateStatus === "present" ? "Replace Template" : "Upload Template"}
                    <input type="file" accept=".docx" onChange={handleTemplateUpload} style={{ display: "none" }} disabled={templateUploading} />
                  </label>
                  {templateMsg && (
                    <div style={{ marginTop: 10, fontSize: 11, color: templateMsg.startsWith("✓") ? "#15803d" : "#b91c1c", fontWeight: 600 }}>
                      {templateMsg}
                    </div>
                  )}
                </div>
              </div>

              {/* Estimator info — pre-fills the manual fields */}
              <div>
                <SectionLabel>Default Estimator Info</SectionLabel>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 10 }}>
                  These values pre-fill the Estimator Name and Title fields in the Proposal Letter dialog so you don't have to retype them each time.
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <FieldRow icon={<FileText size={14} />} label="Estimator Name">
                    <input value={settings.estimator_name} onChange={e => set("estimator_name", e.target.value)}
                      placeholder="e.g. Vincent Rossomando"
                      style={{ padding: "7px 10px", border: "1px solid var(--border-strong)", borderRadius: "var(--r-sm)", fontSize: 13, width: "100%", background: "white" }} />
                  </FieldRow>
                  <FieldRow icon={<FileText size={14} />} label="Estimator Title">
                    <input value={settings.estimator_title} onChange={e => set("estimator_title", e.target.value)}
                      placeholder="e.g. Project Estimator"
                      style={{ padding: "7px 10px", border: "1px solid var(--border-strong)", borderRadius: "var(--r-sm)", fontSize: 13, width: "100%", background: "white" }} />
                  </FieldRow>
                </div>
              </div>

              {/* Token reference */}
              <div>
                <SectionLabel>Available Template Tokens</SectionLabel>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  {[
                    ["{{PROJECT_NAME}}",    "Job name — auto-filled"],
                    ["{{BID_NUMBER}}",      "Bid number — auto-filled (header)"],
                    ["{{PROPOSAL_DATE}}",   "Today's date — auto-filled"],
                    ["{{BID_TOTAL}}",       "Bid total — auto-filled"],
                    ["{{RECIPIENT_NAME}}",  "Recipient — filled in dialog"],
                    ["{{RECIPIENT_COMPANY}}","Company — filled in dialog"],
                    ["{{SALUTATION}}",      "Salutation — filled in dialog"],
                    ["{{ESTIMATOR_NAME}}",  "Your name — filled in dialog"],
                    ["{{ESTIMATOR_TITLE}}", "Your title — filled in dialog"],
                  ].map(([token, desc]) => (
                    <div key={token} style={{ display: "flex", gap: 8, alignItems: "baseline", padding: "4px 0", borderBottom: "1px solid #f1f5f9" }}>
                      <code style={{ fontSize: 10, background: "#e2e8f0", padding: "1px 5px", borderRadius: 3, flexShrink: 0, color: "#1e40af" }}>{token}</code>
                      <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 24px 18px", borderTop: "1px solid var(--border)", display: "flex", gap: 10, flexShrink: 0 }}>
          <button onClick={onClose} style={cancelBtn}>Cancel</button>
          <button onClick={handleSave} disabled={saving}
            style={{ ...cancelBtn, flex: 2, background: saved ? "linear-gradient(180deg,#16a34a,#15803d)" : "linear-gradient(180deg,#2277cc,#1155aa)", color: "white", border: "none", fontWeight: 700, fontFamily: "Arial,sans-serif", textTransform: "uppercase", letterSpacing: "0.4px", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
            {saved ? <><CheckCircle size={14} /> Saved</> : <><Save size={14} /> {saving ? "Saving…" : "Save Settings"}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Helper components ──────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#2a4a6a", paddingTop: 4, borderTop: "1px solid var(--border)", marginTop: 4 }}>
      {children}
    </div>
  );
}

function FieldRow({ label, icon, required, children }: { label: string; icon: React.ReactNode; required?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={labelStyle}>
        {icon && <span style={{ display: "inline-flex", marginRight: 5, verticalAlign: "middle", color: "var(--text-muted)" }}>{icon}</span>}
        {label}
        {required && <span style={{ color: "var(--accent)", marginLeft: 3 }}>*</span>}
      </label>
      {children}
    </div>
  );
}

function TextInput({ value, onChange, placeholder, type = "text" }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      style={{ padding: "8px 12px", border: "1px solid var(--border-strong)", borderRadius: "var(--r-sm)", fontSize: 13, fontFamily: "var(--font-body)", color: "var(--text-primary)", background: "white", width: "100%" }} />
  );
}

function NumInput({ value, onChange, min, max, step }: { value: string; onChange: (v: string) => void; min?: number; max?: number; step?: number }) {
  return (
    <input type="number" value={value} min={min} max={max} step={step} onChange={e => onChange(e.target.value)}
      style={{ padding: "8px 12px", border: "1px solid var(--border-strong)", borderRadius: "var(--r-sm)", fontSize: 13, fontFamily: "var(--font-mono)", color: "var(--text-primary)", background: "white", width: "100%", textAlign: "right" }} />
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const overlay: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.40)",
  display: "flex", alignItems: "center", justifyContent: "center",
  zIndex: 2500, backdropFilter: "blur(4px)", animation: "fadeIn 0.15s ease",
};
const box: React.CSSProperties = {
  background: "var(--bg-raised)", border: "1px solid var(--border-strong)",
  borderRadius: "var(--r-lg)", width: 580, maxHeight: "88vh",
  boxShadow: "var(--shadow-lg)", display: "flex", flexDirection: "column",
  animation: "fadeIn 0.2s cubic-bezier(0.16,1,0.3,1)",
};
const hdr: React.CSSProperties = {
  padding: "14px 20px", borderBottom: "1px solid var(--border)",
  display: "flex", justifyContent: "space-between", alignItems: "center",
  background: "linear-gradient(to right,#0a246a,#2a5abf)",
  borderRadius: "var(--r-lg) var(--r-lg) 0 0", flexShrink: 0,
};
const closeBtn: React.CSSProperties = {
  background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)",
  color: "white", cursor: "pointer", padding: "3px 6px", display: "flex",
  borderRadius: "var(--r-sm)",
};
const cancelBtn: React.CSSProperties = {
  flex: 1, padding: "9px 0", borderRadius: "var(--r-md)", fontSize: 13,
  fontWeight: 600, cursor: "pointer",
  background: "var(--bg-surface)", border: "1px solid var(--border-strong)",
  color: "var(--text-primary)",
};
const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: "var(--text-secondary)",
  textTransform: "uppercase", letterSpacing: "0.05em",
};
