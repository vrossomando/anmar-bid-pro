import { useState, useEffect } from "react";
import { X, Archive, Upload, CheckCircle, AlertCircle } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";

type Status = { type: "idle" | "working" | "success" | "error"; message: string };

interface Props { onClose: () => void; }

export default function DatabaseBackupModal({ onClose }: Props) {
  const [dbPath, setDbPath] = useState<string>("");
  const [status, setStatus] = useState<Status>({ type: "idle", message: "" });

  useEffect(() => {
    invoke<string>("get_database_path")
      .then(p => setDbPath(p))
      .catch(() => setDbPath("%APPDATA%\\com.anmarbidpro.app\\anmarbidpro.db"));
  }, []);

  const handleBackup = async () => {
    setStatus({ type: "working", message: "Opening save dialog…" });
    try {
      const result = await invoke<string>("backup_database_dialog");
      if (result === "cancelled") setStatus({ type: "idle", message: "" });
      else setStatus({ type: "success", message: result });
    } catch (err) {
      setStatus({ type: "error", message: `Backup failed: ${String(err)}` });
    }
  };

  const handleRestore = async () => {
    if (!confirm(
      "Restoring a backup will REPLACE your current database.\n\nAll estimates not in the backup file will be lost.\n\nAre you sure?"
    )) return;
    setStatus({ type: "working", message: "Opening file picker…" });
    try {
      const result = await invoke<string>("restore_database_dialog");
      if (result === "cancelled") setStatus({ type: "idle", message: "" });
      else setStatus({ type: "success", message: result });
    } catch (err) {
      setStatus({ type: "error", message: `Restore failed: ${String(err)}` });
    }
  };

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={box}>
        <div style={hdr}>
          <div style={{ color: "white", fontSize: 15, fontWeight: 700 }}>Database Backup & Restore</div>
          <button onClick={onClose} style={closeBtn}><X size={15} /></button>
        </div>

        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 18 }}>
          {/* DB Path */}
          <div style={{ padding: "10px 14px", background: "#f0f6ff", borderRadius: "var(--r-md)", border: "1px solid #c7d9f0" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#2a4a6a", textTransform: "uppercase", marginBottom: 4 }}>Database Location</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)", wordBreak: "break-all" }}>{dbPath || "Locating…"}</div>
          </div>

          {/* Backup */}
          <div style={{ border: "1px solid var(--border-strong)", borderRadius: "var(--r-md)", overflow: "hidden" }}>
            <div style={{ padding: "10px 16px", background: "#dce8f0", borderBottom: "1px solid var(--border-strong)" }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#1a3a6a" }}>Backup</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Copy your database to a USB drive, network share, or cloud folder.</div>
            </div>
            <div style={{ padding: "14px 16px" }}>
              <ul style={{ fontSize: 12, color: "var(--text-secondary)", paddingLeft: 18, marginBottom: 12, lineHeight: 1.8 }}>
                <li>A native Save dialog will open — choose any folder</li>
                <li>Contains all jobs, estimates, and settings</li>
                <li>Recommended: back up weekly or before major changes</li>
              </ul>
              <button onClick={handleBackup} disabled={status.type === "working"}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 20px", background: "linear-gradient(180deg,#2277cc,#1155aa)", border: "none", color: "white", borderRadius: "var(--r-md)", fontSize: 13, fontWeight: 700, cursor: status.type === "working" ? "wait" : "pointer", fontFamily: "Arial,sans-serif", textTransform: "uppercase", letterSpacing: "0.4px", opacity: status.type === "working" ? 0.7 : 1 }}>
                <Archive size={14} /> {status.type === "working" ? "Opening…" : "Backup Now"}
              </button>
            </div>
          </div>

          {/* Restore */}
          <div style={{ border: "1px solid #fca5a5", borderRadius: "var(--r-md)", overflow: "hidden" }}>
            <div style={{ padding: "10px 16px", background: "#fee2e2", borderBottom: "1px solid #fca5a5" }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#991b1b" }}>Restore</div>
              <div style={{ fontSize: 12, color: "#7f1d1d", marginTop: 2 }}>⚠ Replaces your current database with a backup file.</div>
            </div>
            <div style={{ padding: "14px 16px" }}>
              <ul style={{ fontSize: 12, color: "var(--text-secondary)", paddingLeft: 18, marginBottom: 12, lineHeight: 1.8 }}>
                <li>A file picker will open — select a .db backup file</li>
                <li>Jobs created after that backup will be lost</li>
                <li>Restart the app after a successful restore</li>
              </ul>
              <button onClick={handleRestore} disabled={status.type === "working"}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 20px", background: "linear-gradient(180deg,#dc2626,#b91c1c)", border: "none", color: "white", borderRadius: "var(--r-md)", fontSize: 13, fontWeight: 700, cursor: status.type === "working" ? "wait" : "pointer", fontFamily: "Arial,sans-serif", textTransform: "uppercase", letterSpacing: "0.4px", opacity: status.type === "working" ? 0.7 : 1 }}>
                <Upload size={14} /> {status.type === "working" ? "Opening…" : "Restore from Backup"}
              </button>
            </div>
          </div>

          {/* Status */}
          {status.type !== "idle" && status.message && (
            <div style={{ display: "flex", gap: 10, padding: "12px 14px", borderRadius: "var(--r-md)", background: status.type === "success" ? "#dcfce7" : "#fee2e2", border: `1px solid ${status.type === "success" ? "#86efac" : "#fca5a5"}` }}>
              {status.type === "success"
                ? <CheckCircle size={15} style={{ color: "#16a34a", flexShrink: 0, marginTop: 1 }} />
                : <AlertCircle size={15} style={{ color: "#dc2626", flexShrink: 0, marginTop: 1 }} />}
              <div style={{ fontSize: 12, color: status.type === "success" ? "#15803d" : "#dc2626", lineHeight: 1.5 }}>
                {status.message}
                {status.type === "success" && status.message.includes("restart") && (
                  <div style={{ marginTop: 5, fontWeight: 700 }}>Close and reopen Anmar Bid Pro to load the restored data.</div>
                )}
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: "12px 24px 18px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "8px 22px", borderRadius: "var(--r-md)", fontSize: 13, fontWeight: 600, cursor: "pointer", background: "var(--bg-surface)", border: "1px solid var(--border-strong)", color: "var(--text-primary)" }}>Close</button>
        </div>
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2500, backdropFilter: "blur(4px)" };
const box: React.CSSProperties = { background: "var(--bg-raised)", border: "1px solid var(--border-strong)", borderRadius: "var(--r-lg)", width: 520, maxHeight: "90vh", boxShadow: "var(--shadow-lg)", display: "flex", flexDirection: "column" };
const hdr: React.CSSProperties = { padding: "13px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "linear-gradient(to right,#0a246a,#2a5abf)", borderRadius: "var(--r-lg) var(--r-lg) 0 0", flexShrink: 0 };
const closeBtn: React.CSSProperties = { background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", color: "white", cursor: "pointer", padding: "3px 6px", display: "flex", borderRadius: "var(--r-sm)" };
