import { useState, useEffect } from "react";
import { Save, CheckCircle } from "lucide-react";
import { loadSettings, saveSetting, assemblyCategoryCounts, type Settings } from "../hooks/db";

interface SettingsPageProps {
  onSettingsChanged: () => void;
}

const FIELDS: { key: string; label: string; placeholder: string; type?: string }[] = [
  { key: "company_name",     label: "Company Name",        placeholder: "Anmar Electric" },
  { key: "company_phone",    label: "Phone Number",        placeholder: "+1 (555) 000-0000" },
  { key: "company_email",    label: "Email Address",       placeholder: "hello@anmarelectric.com" },
  { key: "default_tax_rate", label: "Default Tax Rate (%)",placeholder: "0",   type: "number" },
  { key: "default_markup",   label: "Default Markup (%)", placeholder: "20",  type: "number" },
  { key: "labor_rate",       label: "Labor Rate ($/hr)",  placeholder: "85",  type: "number" },
  { key: "currency_symbol",  label: "Currency Symbol",    placeholder: "$" },
];

export default function SettingsPage({ onSettingsChanged }: SettingsPageProps) {
  const [settings, setSettings] = useState<Settings>({});
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [catCounts, setCatCounts] = useState<{ category: string; count: number }[]>([]);

  useEffect(() => {
    loadSettings().then(setSettings);
    assemblyCategoryCounts().then(setCatCounts).catch(() => {});
  }, []);

  const handleChange = (key: string, value: string) =>
    setSettings(s => ({ ...s, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const [k, v] of Object.entries(settings)) await saveSetting(k, v);
      setSaved(true);
      onSettingsChanged();
      setTimeout(() => setSaved(false), 2500);
    } finally { setSaving(false); }
  };

  const totalItems = catCounts.reduce((s, c) => s + c.count, 0);

  return (
    <div style={{ padding: "var(--sp-8) var(--sp-10)", overflow: "auto", height: "100%", animation: "fadeIn 0.2s ease both" }}>
      <div style={{ maxWidth: 580 }}>
        <div style={{ marginBottom: "var(--sp-8)" }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 32, fontWeight: 400, color: "var(--text-primary)", lineHeight: 1.1 }}>
            Settings
          </h1>
          <p style={{ color: "var(--text-secondary)", marginTop: 4, fontSize: 13 }}>
            Company details, labor rates, and defaults
          </p>
        </div>

        {/* Company */}
        <Section title="Company">
          {FIELDS.slice(0, 3).map(f => (
            <Field key={f.key} label={f.label}>
              <input type={f.type ?? "text"} value={settings[f.key] ?? ""} onChange={e => handleChange(f.key, e.target.value)} placeholder={f.placeholder} style={inputStyle} />
            </Field>
          ))}
        </Section>

        {/* Estimating Defaults */}
        <Section title="Estimating Defaults">
          {FIELDS.slice(3).map(f => (
            <Field key={f.key} label={f.label}>
              <input type={f.type ?? "text"} value={settings[f.key] ?? ""} onChange={e => handleChange(f.key, e.target.value)} placeholder={f.placeholder}
                step={f.type === "number" ? "0.01" : undefined} min={f.type === "number" ? 0 : undefined}
                style={{ ...inputStyle, fontFamily: f.type === "number" ? "var(--font-mono)" : "var(--font-body)" }}
              />
            </Field>
          ))}
        </Section>

        {/* Save */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: "var(--sp-5)" }}>
          <button onClick={handleSave} disabled={saving}
            style={{ background: "var(--accent)", color: "#0f1117", fontWeight: 600, padding: "10px 20px", borderRadius: "var(--r-md)", border: "none", cursor: saving ? "wait" : "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 6, opacity: saving ? 0.7 : 1, boxShadow: "var(--shadow-accent)", transition: "all var(--t-fast)" }}
            onMouseEnter={e => { if (!saving) { e.currentTarget.style.background = "var(--accent-hover)"; e.currentTarget.style.transform = "translateY(-1px)"; }}}
            onMouseLeave={e => { e.currentTarget.style.background = "var(--accent)"; e.currentTarget.style.transform = ""; }}
          >
            <Save size={14} />
            {saving ? "Saving…" : "Save Settings"}
          </button>
          {saved && (
            <span style={{ color: "var(--green)", fontSize: 12, display: "flex", alignItems: "center", gap: 5, animation: "fadeIn 0.2s ease" }}>
              <CheckCircle size={13} /> Saved
            </span>
          )}
        </div>

        {/* Assembly catalog info */}
        <div style={{ marginTop: "var(--sp-10)" }}>
          <Section title={`Assembly Catalog  (${totalItems.toLocaleString()} items)`}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {catCounts.map(c => (
                <div key={c.category} style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", background: "var(--bg-raised)", borderRadius: "var(--r-md)", fontSize: 12 }}>
                  <span style={{ color: "var(--text-secondary)" }}>{c.category}</span>
                  <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-primary)", fontWeight: 500 }}>{c.count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </Section>
        </div>

        {/* DB path info */}
        <div style={{ marginTop: "var(--sp-6)", padding: "var(--sp-4)", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
          <div style={{ marginBottom: 4, color: "var(--text-secondary)", fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 11 }}>Database Location</div>
          <div>%APPDATA%\com.anmarbidpro.app\anmarbidpro.db</div>
          <div style={{ marginTop: 4 }}>SQLite via @tauri-apps/plugin-sql — 21,828 assembly items seeded at install</div>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: "var(--bg-raised)", border: "1px solid var(--border-strong)",
  borderRadius: "var(--r-md)", color: "var(--text-primary)", fontSize: 13,
  padding: "8px 12px", width: "100%", fontFamily: "var(--font-body)",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "var(--sp-6)" }}>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: "var(--sp-3)", paddingBottom: "var(--sp-2)", borderBottom: "1px solid var(--border)" }}>
        {title}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", display: "block", marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  );
}
