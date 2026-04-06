import { useState, useEffect, useCallback, useRef } from "react";
import { Search, X, ChevronRight, Plus, AlertCircle } from "lucide-react";
import {
  listSubcategories, listAssemblies, searchAssemblies,
  APP_CATEGORIES, PRICE_UNIT_LABELS,
  type Assembly, type AppCategory,
} from "../hooks/db";

interface AssemblyPickerProps {
  onSelect: (assembly: Assembly) => void;
  onClose: () => void;
  defaultCategory?: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  "Security":               "#f59e0b",
  "Fire Alarm":             "#f87171",
  "Gear":                   "#60a5fa",
  "Conduit / Wire Feeders": "#34d399",
  "Cable":                  "#a78bfa",
  "Lights & Devices":       "#fbbf24",
  "Miscellaneous Items":    "#8b93a8",
  "Grounding":              "#10b981",
};

export default function AssemblyPicker({ onSelect, onClose, defaultCategory }: AssemblyPickerProps) {
  const [activeCategory, setActiveCategory] = useState<string>(defaultCategory ?? APP_CATEGORIES[0]);
  const [subcategories, setSubcategories] = useState<string[]>([]);
  const [activeSubcat, setActiveSubcat] = useState<string | null>(null);
  const [assemblies, setAssemblies] = useState<Assembly[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const LIMIT = 200;
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load subcategories when category changes
  useEffect(() => {
    setSubcategories([]);
    setActiveSubcat(null);
    setAssemblies([]);
    setOffset(0);
    listSubcategories(activeCategory).then((subs) => {
      setSubcategories(subs);
      if (subs.length > 0) setActiveSubcat(subs[0]);
    });
  }, [activeCategory]);

  // Load assemblies when subcategory or offset changes
  const loadAssemblies = useCallback(async (cat: string, subcat: string | null, off: number) => {
    if (searchQuery.trim()) return;
    setLoading(true);
    try {
      const rows = await listAssemblies(cat, subcat ?? undefined, LIMIT, off);
      setAssemblies((prev) => off === 0 ? rows : [...prev, ...rows]);
      setHasMore(rows.length === LIMIT);
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setOffset(0);
      loadAssemblies(activeCategory, activeSubcat, 0);
    }
  }, [activeCategory, activeSubcat, loadAssemblies, searchQuery]);

  // Debounced search — searches ALL categories when query is active
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!searchQuery.trim()) return;
    searchTimer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const rows = await searchAssemblies(searchQuery.trim(), undefined);
        setAssemblies(rows);
        setHasMore(false);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, [searchQuery]);

  const handleSubcat = (sub: string) => {
    setActiveSubcat(sub);
    setOffset(0);
  };

  const handleLoadMore = () => {
    const next = offset + LIMIT;
    setOffset(next);
    loadAssemblies(activeCategory, activeSubcat, next);
  };

  const accent = CATEGORY_COLORS[activeCategory] ?? "#f59e0b";

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(0,0,0,0.65)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 2000,
      backdropFilter: "blur(4px)",
      animation: "fadeIn 0.15s ease",
    }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: 900, height: 620,
        background: "var(--bg-surface)",
        border: "1px solid var(--border-strong)",
        borderRadius: "var(--r-xl)",
        boxShadow: "var(--shadow-lg)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        animation: "fadeIn 0.2s cubic-bezier(0.16,1,0.3,1)",
      }}>

        {/* Header */}
        <div style={{
          padding: "14px 20px",
          borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", gap: 12,
          background: "var(--bg-raised)",
          flexShrink: 0,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--text-primary)" }}>
              Assembly Catalog
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>
              21,828 items — {searchQuery.trim() ? "searching all categories" : "click any item to add to estimate"}
            </div>
          </div>
          {/* Search */}
          <div style={{ position: "relative", width: 260 }}>
            <Search size={13} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
            <input
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search descriptions, item #, cat #…"
              style={{
                background: "var(--bg-deep)",
                border: "1px solid var(--border-strong)",
                borderRadius: "var(--r-md)",
                color: "var(--text-primary)",
                fontSize: 12,
                padding: "7px 28px 7px 28px",
                width: "100%",
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 2, display: "flex" }}
              >
                <X size={12} />
              </button>
            )}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 4, display: "flex", borderRadius: "var(--r-sm)" }}
            onMouseEnter={e => e.currentTarget.style.color = "var(--text-primary)"}
            onMouseLeave={e => e.currentTarget.style.color = "var(--text-muted)"}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

          {/* Left: category tabs */}
          <div style={{
            width: 180, flexShrink: 0,
            borderRight: "1px solid var(--border)",
            display: "flex", flexDirection: "column",
            overflow: "auto",
            background: "var(--bg-deep)",
          }}>
            <div style={{ padding: "8px 8px 4px", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)" }}>
              Category
            </div>
            {APP_CATEGORIES.map((cat) => {
              const color = CATEGORY_COLORS[cat] ?? "#8b93a8";
              const active = cat === activeCategory;
              return (
                <button key={cat} onClick={() => setActiveCategory(cat)}
                  style={{
                    background: active ? "var(--bg-active)" : "none",
                    border: "none",
                    borderLeft: `3px solid ${active ? color : "transparent"}`,
                    color: active ? "var(--text-primary)" : "var(--text-secondary)",
                    padding: "9px 10px 9px 11px",
                    cursor: "pointer",
                    textAlign: "left",
                    fontSize: 12,
                    fontWeight: active ? 600 : 400,
                    display: "flex", alignItems: "center", gap: 7,
                    transition: "all var(--t-fast)",
                  }}
                  onMouseEnter={e => { if (!active) { e.currentTarget.style.background = "var(--bg-raised)"; e.currentTarget.style.color = "var(--text-primary)"; }}}
                  onMouseLeave={e => { if (!active) { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "var(--text-secondary)"; }}}
                >
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, flexShrink: 0 }} />
                  {cat}
                </button>
              );
            })}
          </div>

          {/* Middle: subcategory list */}
          {subcategories.length > 1 && !searchQuery && (
            <div style={{
              width: 150, flexShrink: 0,
              borderRight: "1px solid var(--border)",
              overflow: "auto",
              background: "var(--bg-surface)",
            }}>
              <div style={{ padding: "8px 8px 4px", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)" }}>
                Sub-type
              </div>
              {/* "All" option */}
              <SubcatBtn label="All" active={activeSubcat === null} onClick={() => handleSubcat("")} accent={accent} />
              {subcategories.map((sub) => (
                <SubcatBtn key={sub} label={sub} active={activeSubcat === sub} onClick={() => handleSubcat(sub)} accent={accent} />
              ))}
            </div>
          )}

          {/* Right: assembly list */}
          <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column" }}>
            {/* Column headers */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 80px 70px 80px 80px 36px",
              gap: 8,
              padding: "8px 12px",
              borderBottom: "1px solid var(--border)",
              background: "var(--bg-raised)",
              flexShrink: 0,
            }}>
              {["Description", "Item #", "Cat #", "Unit Price", "Labor", ""].map((h) => (
                <div key={h} style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-muted)" }}>{h}</div>
              ))}
            </div>

            {/* Rows */}
            <div style={{ flex: 1, overflow: "auto" }}>
              {loading && assemblies.length === 0 && (
                <div style={{ padding: 24, color: "var(--text-muted)", fontSize: 12, textAlign: "center" }}>Loading…</div>
              )}
              {!loading && assemblies.length === 0 && (
                <div style={{ padding: 24, color: "var(--text-muted)", fontSize: 12, textAlign: "center" }}>
                  {searchQuery ? `No results for "${searchQuery}"` : "No items found"}
                </div>
              )}
              {assemblies.map((asm) => (
                <AssemblyRow key={asm.id} asm={asm} accent={accent} onSelect={onSelect} showCategory={!!searchQuery.trim()} />
              ))}
              {hasMore && (
                <button
                  onClick={handleLoadMore}
                  style={{
                    width: "100%", padding: "10px", background: "none",
                    border: "none", borderTop: "1px solid var(--border)",
                    color: "var(--text-muted)", cursor: "pointer", fontSize: 12,
                    transition: "all var(--t-fast)",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-raised)"; e.currentTarget.style.color = "var(--text-primary)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "var(--text-muted)"; }}
                >
                  Load more…
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SubcatBtn({ label, active, onClick, accent }: { label: string; active: boolean; onClick: () => void; accent: string }) {
  return (
    <button onClick={onClick}
      style={{
        background: active ? `${accent}18` : "none",
        border: "none",
        color: active ? accent : "var(--text-secondary)",
        padding: "7px 10px",
        cursor: "pointer", textAlign: "left", fontSize: 11,
        fontWeight: active ? 600 : 400,
        display: "flex", alignItems: "center", gap: 5, width: "100%",
        transition: "all var(--t-fast)",
      }}
      onMouseEnter={e => { if (!active) { e.currentTarget.style.background = "var(--bg-hover)"; e.currentTarget.style.color = "var(--text-primary)"; }}}
      onMouseLeave={e => { if (!active) { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "var(--text-secondary)"; }}}
    >
      {active && <ChevronRight size={10} />}
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label || "All"}</span>
    </button>
  );
}

function AssemblyRow({ asm, accent, onSelect, showCategory }: { asm: Assembly; accent: string; onSelect: (a: Assembly) => void; showCategory?: boolean }) {
  const priceLabel = asm.price_is_quote
    ? asm.quote_ref
    : asm.price_is_open
    ? "Open"
    : asm.unit_price !== null
    ? `$${asm.unit_price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${PRICE_UNIT_LABELS[asm.price_unit] ?? asm.price_unit}`
    : "—";

  const labor = asm.labor_2 ?? asm.labor_1 ?? null;
  const laborLabel = labor !== null ? `${labor}h` : "—";

  const needsAttention = asm.price_is_quote || asm.price_is_open;

  return (
    <div
      onClick={() => onSelect(asm)}
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 80px 70px 80px 80px 36px",
        gap: 8,
        padding: "6px 12px",
        borderBottom: "1px solid var(--border)",
        cursor: "pointer",
        alignItems: "center",
        transition: "background var(--t-fast)",
      }}
      onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-raised)")}
      onMouseLeave={e => (e.currentTarget.style.background = "")}
    >
      {/* Description */}
      <div style={{ overflow: "hidden" }}>
        <div style={{ fontSize: 12, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {asm.description}
        </div>
        <div style={{ fontSize: 10, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", gap: 6, alignItems: "center" }}>
          {showCategory && (
            <span style={{
              display: "inline-block",
              background: `${CATEGORY_COLORS[asm.category] ?? "#8b93a8"}22`,
              color: CATEGORY_COLORS[asm.category] ?? "#8b93a8",
              border: `1px solid ${CATEGORY_COLORS[asm.category] ?? "#8b93a8"}44`,
              borderRadius: 3,
              padding: "0px 5px",
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.04em",
              flexShrink: 0,
            }}>
              {asm.category}
            </span>
          )}
          {asm.cat_number && <span>{asm.cat_number}</span>}
        </div>
      </div>

      {/* Item # */}
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {asm.item_number}
      </div>

      {/* Unit */}
      <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
        {asm.price_unit ? (PRICE_UNIT_LABELS[asm.price_unit] ?? asm.price_unit) : "—"}
      </div>

      {/* Price */}
      <div style={{
        fontFamily: "var(--font-mono)", fontSize: 11,
        color: needsAttention ? "var(--accent)" : "var(--text-primary)",
        display: "flex", alignItems: "center", gap: 4,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {needsAttention && <AlertCircle size={10} style={{ flexShrink: 0 }} />}
        {priceLabel}
      </div>

      {/* Labor */}
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)" }}>
        {laborLabel}
      </div>

      {/* Add button */}
      <button
        onClick={(e) => { e.stopPropagation(); onSelect(asm); }}
        style={{
          background: `${accent}22`,
          border: `1px solid ${accent}44`,
          color: accent,
          borderRadius: "var(--r-sm)",
          padding: "3px",
          cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all var(--t-fast)",
        }}
        onMouseEnter={e => { e.currentTarget.style.background = accent; e.currentTarget.style.color = "#0f1117"; }}
        onMouseLeave={e => { e.currentTarget.style.background = `${accent}22`; e.currentTarget.style.color = accent; }}
      >
        <Plus size={12} />
      </button>
    </div>
  );
}
