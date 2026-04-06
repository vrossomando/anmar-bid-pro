import type React from "react";

export const formInp: React.CSSProperties = {
  background: "var(--bg-raised)", border: "1px solid var(--border-strong)",
  borderRadius: "var(--r-sm)", color: "var(--text-primary)", fontSize: 13,
  padding: "6px 10px", width: "100%", fontFamily: "var(--font-body)",
};

export const formNumInp: React.CSSProperties = {
  ...formInp, fontFamily: "var(--font-mono)", textAlign: "right" as const,
};

export const formSelect: React.CSSProperties = {
  ...formInp, cursor: "pointer",
};
