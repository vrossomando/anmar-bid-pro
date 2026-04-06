import { useState } from "react";
import { X } from "lucide-react";

interface NewProjectModalProps {
  onClose: () => void;
  onCreate: (name: string, client: string, taxRate: number) => void;
  defaultTaxRate: number;
}

export default function NewProjectModal({ onClose, onCreate, defaultTaxRate }: NewProjectModalProps) {
  const [name, setName] = useState("");
  const [client, setClient] = useState("");
  const [taxRate, setTaxRate] = useState(defaultTaxRate);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate(name.trim(), client.trim(), taxRate);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        backdropFilter: "blur(4px)",
        animation: "fadeIn 0.15s ease",
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-strong)",
        borderRadius: "var(--r-xl)",
        padding: "28px",
        width: 420,
        boxShadow: "var(--shadow-lg)",
        animation: "fadeIn 0.2s cubic-bezier(0.16,1,0.3,1)",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h2 style={{
            fontFamily: "var(--font-display)",
            fontSize: 22,
            fontWeight: 400,
            color: "var(--text-primary)",
          }}>
            New Estimate
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              padding: 4,
              display: "flex",
              borderRadius: "var(--r-sm)",
              transition: "color var(--t-fast)",
            }}
            onMouseEnter={e => (e.currentTarget.style.color = "var(--text-primary)")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Field label="Estimate Name *">
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Kitchen Remodel – Phase 1"
              required
              style={inputStyle}
            />
          </Field>
          <Field label="Client">
            <input
              value={client}
              onChange={e => setClient(e.target.value)}
              placeholder="Client or company name"
              style={inputStyle}
            />
          </Field>
          <Field label="Tax Rate (%)">
            <input
              type="number"
              value={taxRate}
              onChange={e => setTaxRate(parseFloat(e.target.value) || 0)}
              min={0}
              max={100}
              step={0.1}
              style={{ ...inputStyle, fontFamily: "var(--font-mono)" }}
            />
          </Field>

          <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                background: "var(--bg-raised)",
                border: "1px solid var(--border-strong)",
                color: "var(--text-secondary)",
                padding: "10px",
                borderRadius: "var(--r-md)",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              style={{
                flex: 2,
                background: name.trim() ? "var(--accent)" : "var(--bg-hover)",
                color: name.trim() ? "#0f1117" : "var(--text-muted)",
                fontWeight: 600,
                padding: "10px",
                borderRadius: "var(--r-md)",
                cursor: name.trim() ? "pointer" : "not-allowed",
                border: "none",
                fontSize: 13,
                transition: "all var(--t-fast)",
                boxShadow: name.trim() ? "var(--shadow-accent)" : "none",
              }}
            >
              Create Estimate
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: "var(--bg-raised)",
  border: "1px solid var(--border-strong)",
  borderRadius: "var(--r-md)",
  color: "var(--text-primary)",
  fontSize: 13,
  padding: "9px 12px",
  width: "100%",
  fontFamily: "var(--font-body)",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", display: "block", marginBottom: 5 }}>
        {label}
      </label>
      {children}
    </div>
  );
}
