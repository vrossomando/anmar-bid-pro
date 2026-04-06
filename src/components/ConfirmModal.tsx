interface ConfirmModalProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  title, message, confirmLabel = "Confirm", cancelLabel = "Cancel",
  danger = false, onConfirm, onCancel,
}: ConfirmModalProps) {
  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div style={box}>
        <div style={header}>
          <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>{title}</span>
        </div>
        <div style={{ padding: "16px 20px" }}>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.6 }}>{message}</p>
        </div>
        <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onCancel} style={cancelBtn}>
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            style={{ ...cancelBtn, background: danger ? "var(--red)" : "var(--accent)", color: "#fff", border: "none" }}
            onMouseEnter={e => { e.currentTarget.style.opacity = "0.88"; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)",
  display: "flex", alignItems: "center", justifyContent: "center",
  zIndex: 3000, backdropFilter: "blur(3px)", animation: "fadeIn 0.15s ease",
};
const box: React.CSSProperties = {
  background: "var(--bg-raised)", border: "1px solid var(--border-strong)",
  borderRadius: "var(--r-lg)", width: 400, boxShadow: "var(--shadow-lg)",
  animation: "fadeIn 0.2s cubic-bezier(0.16,1,0.3,1)",
};
const header: React.CSSProperties = {
  padding: "16px 20px", borderBottom: "1px solid var(--border)",
  background: "var(--bg-surface)", borderRadius: "var(--r-lg) var(--r-lg) 0 0",
};
const cancelBtn: React.CSSProperties = {
  padding: "8px 18px", borderRadius: "var(--r-md)", fontSize: 13,
  fontWeight: 600, cursor: "pointer",
  background: "var(--bg-surface)", border: "1px solid var(--border-strong)",
  color: "var(--text-primary)",
};
