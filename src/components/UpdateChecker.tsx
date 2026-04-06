import { useEffect, useState } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { CheckCircle, RefreshCw, X } from "lucide-react";

// Silent update checker — runs once on startup, shows a non-intrusive prompt
// if a newer version is available. User can dismiss and update later.

export default function UpdateChecker() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [version, setVersion]                 = useState("");
  const [notes, setNotes]                     = useState("");
  const [installing, setInstalling]           = useState(false);
  const [dismissed, setDismissed]             = useState(false);

  useEffect(() => {
    // Check for updates after a short delay so the app loads first
    const timer = setTimeout(async () => {
      try {
        const update = await check();
        if (update?.available) {
          setVersion(update.version ?? "");
          setNotes(update.body ?? "");
          setUpdateAvailable(true);
        }
      } catch {
        // Silently ignore — no internet, GitHub down, etc.
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  const handleInstall = async () => {
    setInstalling(true);
    try {
      const update = await check();
      if (update?.available) {
        await update.downloadAndInstall();
        await relaunch();
      }
    } catch (e) {
      setInstalling(false);
      console.error("Update failed:", e);
    }
  };

  if (!updateAvailable || dismissed) return null;

  return (
    <div style={{
      position: "fixed", bottom: 20, right: 20, zIndex: 9999,
      width: 340, background: "white",
      border: "1px solid #d1d5db", borderRadius: 8,
      boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
      animation: "fadeIn 0.3s ease",
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        background: "linear-gradient(to right, #0a246a, #2a5abf)",
        padding: "10px 14px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <CheckCircle size={14} style={{ color: "white" }} />
          <span style={{ color: "white", fontSize: 13, fontWeight: 700 }}>
            Update Available
          </span>
        </div>
        <button
          onClick={() => setDismissed(true)}
          style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.7)", padding: 2, display: "flex" }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Body */}
      <div style={{ padding: "12px 14px" }}>
        <div style={{ fontSize: 12, color: "#374151", marginBottom: 8 }}>
          <strong>Anmar Bid Pro {version}</strong> is now available.
          {notes && (
            <div style={{ marginTop: 6, fontSize: 11, color: "#6b7280", lineHeight: 1.5, maxHeight: 60, overflow: "auto" }}>
              {notes}
            </div>
          )}
        </div>
        <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 10 }}>
          The app will restart automatically after installing.
          Your data will not be affected.
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setDismissed(true)}
            style={{
              flex: 1, padding: "7px 0", borderRadius: 4, fontSize: 12,
              fontWeight: 600, cursor: "pointer",
              background: "white", border: "1px solid #d1d5db", color: "#374151",
            }}
          >
            Later
          </button>
          <button
            onClick={handleInstall}
            disabled={installing}
            style={{
              flex: 2, padding: "7px 0", borderRadius: 4, fontSize: 12,
              fontWeight: 700, cursor: installing ? "not-allowed" : "pointer",
              border: "none",
              background: installing
                ? "#9ca3af"
                : "linear-gradient(180deg,#2277cc,#1155aa)",
              color: "white",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}
          >
            {installing
              ? <><RefreshCw size={12} style={{ animation: "spin 1s linear infinite" }} /> Installing…</>
              : <><CheckCircle size={12} /> Install & Restart</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}
