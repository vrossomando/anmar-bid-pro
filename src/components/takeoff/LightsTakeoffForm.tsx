import { useState, useEffect } from "react";
import { Plus, Trash2 } from "lucide-react";
import TakeoffShell, { FormTabs, FormRow, formInp, formNumInp } from "./TakeoffShell";
import { calculateLightsTakeoff, type AccessoryRow, type LightsInputs } from "../../hooks/takeoffCalculations";
import { searchAssemblies, getAssemblyByItemNumber, type Assembly } from "../../hooks/db";
import type { TakeoffLineItem } from "../../hooks/takeoffCalculations";
import type { SectionBreakdown } from "../SectionBreakdownModal";

// Fixture type dropdown — organized by category
const FIXTURE_TYPES = [
  "--- Fluorescent ---",
  "2'x4' Fluorescent Lay-In",
  "2'x2' Fluorescent Lay-In",
  "4' Fluorescent Lay-in",
  "4'x4' Fluorescent Lay-In",
  "2'x4' Recessed Fluorescent",
  "2'x2' Recessed Fluorescent",
  "4' Recessed Fluorescent",
  "4' Fluorescent Strip",
  "8' Fluorescent Strip",
  "4' Industrial Fluorescent",
  "8' Industrial Fluorescent",
  "4' Wrap-Around Fluorescent 2-Lamp",
  "4' Wrap-Around Fluorescent 4-Lamp",
  "2'x4' Surf Commercial Fluorescent",
  "2'x2' Surf Commercial Fluorescent",
  "4' Wall Fluorescent",
  "--- LED ---",
  "2'x4' Surface L.E.D. Fixture",
  "Ceiling/Surface Mtd. L.E.D. Fixture",
  "4' L.E.D. Strip",
  "L.E.D. Recessed Downlight",
  "Compact Fluorescent Recessed Downlight",
  "--- Recessed Can ---",
  "6\" Flush Can Light Open Trim",
  "6\" Flush Can Light WP Trim (Shower)",
  "4\" Ceiling Surface Mtd. LED Disk Trim Fixture",
  "--- Exit / Emergency ---",
  "Exit Sign-AC (Single or Double Face)",
  "Exit Sign-Battery Backup",
  "Emergency Light-Battery Backup",
  "Emergency/Exit Combo-Battery Backup",
  "--- Track Lighting ---",
  "2' Track Section",
  "4' Track Section",
  "6' Track Section",
  "8' Track Section",
  "--- Exterior ---",
  "Wall Pack-250W MH",
  "Wall Pack-400W MH",
  "Parking Lot Light-250W MH",
  "Parking Lot Light-400W MH",
  "--- Other ---",
  "Ceiling Surface Mtd. Fixture",
  "Pendant Fixture",
  "Wall Sconce",
  "High Bay Fixture",
  "Vapor Tight Fixture",
  "Other (enter manually below)",
];

const QUICK_ACCESSORIES = [
  { label: "Wire Nuts (Red)",    description: "Red Scotchlok Wirenuts (#18-10)", qty: 3 },
  { label: "Wire Nuts (Yellow)", description: "Yellow Scotchlok Wirenuts", qty: 2 },
  { label: "6\" Flex Whip",     description: "6\" Greenfield Flex Whip", qty: 1 },
  { label: "Toggle Bolt 1/4\"", description: "Toggle Bolt 1/4\"", qty: 2 },
  { label: "Toggle Bolt 3/8\"", description: "Toggle Bolt 3/8\"", qty: 2 },
];

// ── Auto-box assembly lookup ─────────────────────────────────────────
// Mirrors EBM's pre-built fixture assemblies (A7330, A7331, A7332)
// Each fixture type maps to the box/ring/wirenut items added automatically
const FIXTURE_BOX_ASSEMBLY: Record<string, { description: string; item_number: string; qty: number }[]> = {
  // A7331 — 4" Square Box w-3/0 Ring (standard flush/surface ceiling fixtures)
  "2'x4' Fluorescent Lay-In":           [{ description: "4\" Square Box (1/2 & 3/4 KO's)", item_number: "2469", qty: 1 }, { description: "4\" Square-3/0 Plaster Ring-1/2\"D", item_number: "4891", qty: 1 }, { description: "Red Wirenuts", item_number: "6133", qty: 3 }, { description: "Seismic wire", item_number: "5257", qty: 2 }],
  "2'x2' Fluorescent Lay-In":           [{ description: "4\" Square Box (1/2 & 3/4 KO's)", item_number: "2469", qty: 1 }, { description: "4\" Square-3/0 Plaster Ring-1/2\"D", item_number: "4891", qty: 1 }, { description: "Red Wirenuts", item_number: "6133", qty: 3 }, { description: "Seismic wire", item_number: "5257", qty: 2 }],
  "4' Fluorescent Lay-in":              [{ description: "4\" Square Box (1/2 & 3/4 KO's)", item_number: "2469", qty: 1 }, { description: "4\" Square-3/0 Plaster Ring-1/2\"D", item_number: "4891", qty: 1 }, { description: "Red Wirenuts", item_number: "6133", qty: 3 }, { description: "Seismic wire", item_number: "5257", qty: 2 }],
  "4'x4' Fluorescent Lay-In":           [{ description: "4\" Square Box (1/2 & 3/4 KO's)", item_number: "2469", qty: 1 }, { description: "4\" Square-3/0 Plaster Ring-1/2\"D", item_number: "4891", qty: 1 }, { description: "Red Wirenuts", item_number: "6133", qty: 3 }, { description: "Seismic wire", item_number: "5257", qty: 2 }],
  "2'x4' Recessed Fluorescent":         [{ description: "4\" Square Box (1/2 & 3/4 KO's)", item_number: "2469", qty: 1 }, { description: "4\" Square-3/0 Plaster Ring-1/2\"D", item_number: "4891", qty: 1 }, { description: "Red Wirenuts", item_number: "6133", qty: 3 }, { description: "Seismic wire", item_number: "5257", qty: 2 }],
  "2'x2' Recessed Fluorescent":         [{ description: "4\" Square Box (1/2 & 3/4 KO's)", item_number: "2469", qty: 1 }, { description: "4\" Square-3/0 Plaster Ring-1/2\"D", item_number: "4891", qty: 1 }, { description: "Red Wirenuts", item_number: "6133", qty: 3 }, { description: "Seismic wire", item_number: "5257", qty: 2 }],
  "4' Recessed Fluorescent":            [{ description: "4\" Square Box (1/2 & 3/4 KO's)", item_number: "2469", qty: 1 }, { description: "4\" Square-3/0 Plaster Ring-1/2\"D", item_number: "4891", qty: 1 }, { description: "Red Wirenuts", item_number: "6133", qty: 3 }, { description: "Seismic wire", item_number: "5257", qty: 2 }],
  "4' Fluorescent Strip":               [{ description: "4\" Square Box (1/2 & 3/4 KO's)", item_number: "2469", qty: 1 }, { description: "4\" Square-3/0 Plaster Ring-1/2\"D", item_number: "4891", qty: 1 }, { description: "Red Wirenuts", item_number: "6133", qty: 3 }],
  "8' Fluorescent Strip":               [{ description: "4\" Square Box (1/2 & 3/4 KO's)", item_number: "2469", qty: 1 }, { description: "4\" Square-3/0 Plaster Ring-1/2\"D", item_number: "4891", qty: 1 }, { description: "Red Wirenuts", item_number: "6133", qty: 3 }],
  "4' Industrial Fluorescent":          [{ description: "4\" Square Box (1/2 & 3/4 KO's)", item_number: "2469", qty: 1 }, { description: "4\" Square-3/0 Plaster Ring-1/2\"D", item_number: "4891", qty: 1 }, { description: "Red Wirenuts", item_number: "6133", qty: 3 }],
  "8' Industrial Fluorescent":          [{ description: "4\" Square Box (1/2 & 3/4 KO's)", item_number: "2469", qty: 1 }, { description: "4\" Square-3/0 Plaster Ring-1/2\"D", item_number: "4891", qty: 1 }, { description: "Red Wirenuts", item_number: "6133", qty: 3 }],
  "4' Wrap-Around Fluorescent 2-Lamp":  [{ description: "4\" Square Box (1/2 & 3/4 KO's)", item_number: "2469", qty: 1 }, { description: "4\" Square-3/0 Plaster Ring-1/2\"D", item_number: "4891", qty: 1 }, { description: "Red Wirenuts", item_number: "6133", qty: 3 }],
  "4' Wrap-Around Fluorescent 4-Lamp":  [{ description: "4\" Square Box (1/2 & 3/4 KO's)", item_number: "2469", qty: 1 }, { description: "4\" Square-3/0 Plaster Ring-1/2\"D", item_number: "4891", qty: 1 }, { description: "Red Wirenuts", item_number: "6133", qty: 3 }],
  "2'x4' Surf Commercial Fluorescent":  [{ description: "4\" Square Box (1/2 & 3/4 KO's)", item_number: "2469", qty: 1 }, { description: "4\" Square-3/0 Plaster Ring-1/2\"D", item_number: "4891", qty: 1 }, { description: "Red Wirenuts", item_number: "6133", qty: 3 }, { description: "Seismic wire", item_number: "5257", qty: 2 }],
  "2'x2' Surf Commercial Fluorescent":  [{ description: "4\" Square Box (1/2 & 3/4 KO's)", item_number: "2469", qty: 1 }, { description: "4\" Square-3/0 Plaster Ring-1/2\"D", item_number: "4891", qty: 1 }, { description: "Red Wirenuts", item_number: "6133", qty: 3 }, { description: "Seismic wire", item_number: "5257", qty: 2 }],
  "4' Wall Fluorescent":                [{ description: "4\" Square Box (1/2 & 3/4 KO's)", item_number: "2469", qty: 1 }, { description: "4\" Square-3/0 Plaster Ring-1/2\"D", item_number: "4891", qty: 1 }, { description: "Red Wirenuts", item_number: "6133", qty: 3 }],
  "2'x4' Surface L.E.D. Fixture":       [{ description: "4\" Square Box (1/2 & 3/4 KO's)", item_number: "2469", qty: 1 }, { description: "4\" Square-3/0 Plaster Ring-1/2\"D", item_number: "4891", qty: 1 }, { description: "Red Wirenuts", item_number: "6133", qty: 3 }, { description: "Seismic wire", item_number: "5257", qty: 2 }],
  "Ceiling/Surface Mtd. L.E.D. Fixture":[{ description: "4\" Square Box (1/2 & 3/4 KO's)", item_number: "2469", qty: 1 }, { description: "4\" Square-3/0 Plaster Ring-1/2\"D", item_number: "4891", qty: 1 }, { description: "Red Wirenuts", item_number: "6133", qty: 3 }],
  "4' L.E.D. Strip":                    [{ description: "4\" Square Box (1/2 & 3/4 KO's)", item_number: "2469", qty: 1 }, { description: "4\" Square-3/0 Plaster Ring-1/2\"D", item_number: "4891", qty: 1 }, { description: "Red Wirenuts", item_number: "6133", qty: 3 }],
  "2' Track Section":                   [{ description: "4\" Square Box (1/2 & 3/4 KO's)", item_number: "2469", qty: 1 }, { description: "4\" Square-3/0 Plaster Ring-1/2\"D", item_number: "4891", qty: 1 }, { description: "Red Wirenuts", item_number: "6133", qty: 3 }],
  "4' Track Section":                   [{ description: "4\" Square Box (1/2 & 3/4 KO's)", item_number: "2469", qty: 1 }, { description: "4\" Square-3/0 Plaster Ring-1/2\"D", item_number: "4891", qty: 1 }, { description: "Red Wirenuts", item_number: "6133", qty: 3 }],
  "6' Track Section":                   [{ description: "4\" Square Box (1/2 & 3/4 KO's)", item_number: "2469", qty: 1 }, { description: "4\" Square-3/0 Plaster Ring-1/2\"D", item_number: "4891", qty: 1 }, { description: "Red Wirenuts", item_number: "6133", qty: 3 }],
  "8' Track Section":                   [{ description: "4\" Square Box (1/2 & 3/4 KO's)", item_number: "2469", qty: 1 }, { description: "4\" Square-3/0 Plaster Ring-1/2\"D", item_number: "4891", qty: 1 }, { description: "Red Wirenuts", item_number: "6133", qty: 3 }],
  "Ceiling Surface Mtd. Fixture":       [{ description: "4\" Square Box (1/2 & 3/4 KO's)", item_number: "2469", qty: 1 }, { description: "4\" Square-3/0 Plaster Ring-1/2\"D", item_number: "4891", qty: 1 }, { description: "Red Wirenuts", item_number: "6133", qty: 3 }],
  "High Bay Fixture":                   [{ description: "4\" Square Box (1/2 & 3/4 KO's)", item_number: "2469", qty: 1 }, { description: "4\" Square-3/0 Plaster Ring-1/2\"D", item_number: "4891", qty: 1 }, { description: "Red Wirenuts", item_number: "6133", qty: 3 }],
  "Vapor Tight Fixture":                [{ description: "4\" Square Box (1/2 & 3/4 KO's)", item_number: "2469", qty: 1 }, { description: "4\" Square-3/0 Plaster Ring-1/2\"D", item_number: "4891", qty: 1 }, { description: "Red Wirenuts", item_number: "6133", qty: 3 }],
  // A7330 — 4" Square Box w/Flat Brkt & 3/0 Ring (wall/pendant/emergency fixtures)
  "Pendant Fixture":      [{ description: "4\" Square x 1-1/2\" Deep Box w/bkt (1/2&3/4 KO's)", item_number: "2470", qty: 1 }, { description: "4\" Square-3/0 Plaster Ring-5/8\"D", item_number: "4892", qty: 1 }, { description: "Red Wirenuts", item_number: "6133", qty: 3 }],
  "Wall Sconce":          [{ description: "4\" Square x 1-1/2\" Deep Box w/bkt (1/2&3/4 KO's)", item_number: "2470", qty: 1 }, { description: "4\" Square-3/0 Plaster Ring-5/8\"D", item_number: "4892", qty: 1 }, { description: "Red Wirenuts", item_number: "6133", qty: 3 }],
  "Wall Pack-250W MH":    [{ description: "4\" Square x 1-1/2\" Deep Box w/bkt (1/2&3/4 KO's)", item_number: "2470", qty: 1 }, { description: "4\" Square-3/0 Plaster Ring-5/8\"D", item_number: "4892", qty: 1 }, { description: "Red Wirenuts", item_number: "6133", qty: 3 }],
  "Wall Pack-400W MH":    [{ description: "4\" Square x 1-1/2\" Deep Box w/bkt (1/2&3/4 KO's)", item_number: "2470", qty: 1 }, { description: "4\" Square-3/0 Plaster Ring-5/8\"D", item_number: "4892", qty: 1 }, { description: "Red Wirenuts", item_number: "6133", qty: 3 }],
  "Emergency Light-Battery Backup":     [{ description: "4\" Square x 1-1/2\" Deep Box w/bkt (1/2&3/4 KO's)", item_number: "2470", qty: 1 }, { description: "4\" Square-3/0 Plaster Ring-5/8\"D", item_number: "4892", qty: 1 }, { description: "Red Wirenuts", item_number: "6133", qty: 3 }],
  "Emergency/Exit Combo-Battery Backup":[{ description: "4\" Square x 1-1/2\" Deep Box w/bkt (1/2&3/4 KO's)", item_number: "2470", qty: 1 }, { description: "4\" Square-3/0 Plaster Ring-5/8\"D", item_number: "4892", qty: 1 }, { description: "Red Wirenuts", item_number: "6133", qty: 3 }],
  // A7332 — 4" Square Box w-3/0 Ring & T-Bar Brkt (exit signs — t-bar ceiling mount)
  "Exit Sign-AC (Single or Double Face)": [{ description: "4\" Square Box (1/2 & 3/4 KO's)", item_number: "2469", qty: 1 }, { description: "4\" Square-3/0 Plaster Ring-5/8\"D", item_number: "4892", qty: 1 }, { description: "T-Bar Box Hanger", item_number: "5258", qty: 1 }, { description: "Red Wirenuts", item_number: "6133", qty: 3 }],
  "Exit Sign-Battery Backup":             [{ description: "4\" Square Box (1/2 & 3/4 KO's)", item_number: "2469", qty: 1 }, { description: "4\" Square-3/0 Plaster Ring-5/8\"D", item_number: "4892", qty: 1 }, { description: "T-Bar Box Hanger", item_number: "5258", qty: 1 }, { description: "Red Wirenuts", item_number: "6133", qty: 3 }],
};

const emptyAcc = (): AccessoryRow => ({
  description: "", qty: 1, unitCost: 0, laborHrs: 0, assemblyId: null,
});

interface Props {
  projectId: string;
  defaultMarkup: number;
  defaultLaborRate: number;
  sectionBreakdown?: SectionBreakdown;
  onCommit: (items: TakeoffLineItem[]) => void;
  onClose: () => void;
}

export default function LightsTakeoffForm({
  projectId, defaultMarkup, defaultLaborRate, sectionBreakdown, onCommit, onClose,
}: Props) {
  // ── Form state ────────────────────────────────────────────────────────────
  const [tab,          setTab]          = useState("Accessories per Fixture");
  const [designation,  setDesignation]  = useState("");
  const [fixtureType,  setFixtureType]  = useState(FIXTURE_TYPES[1]);
  const [customDesc,   setCustomDesc]   = useState("");
  const [quantity,     setQuantity]     = useState(0);
  const [notes,        setNotes]        = useState("");
  const [laborFactor,  setLaborFactor]  = useState(0);
  const [materialFactor, setMaterialFactor] = useState(0);
  const [accessories,      setAccessories]      = useState<AccessoryRow[]>([]);
  const [additionalItems,  setAdditionalItems]  = useState<AccessoryRow[]>([]);
  const [isQuoteFixture,   setIsQuoteFixture]   = useState(false);

  // ── Catalog lookup ────────────────────────────────────────────────────────
  const [fixtureAsm, setFixtureAsm] = useState<Assembly | null>(null);

  const isSeparator = fixtureType.startsWith("---");
  const isOther     = fixtureType === "Other (enter manually below)";
  const activeDesc  = isOther ? customDesc : (isSeparator ? "" : fixtureType);

  useEffect(() => {
    if (isSeparator || isOther) { setFixtureAsm(null); return; }
    searchAssemblies(fixtureType, "Lights & Devices", 5)
      .then(results => {
        const best =
          results.find(a => a.description === fixtureType && a.unit_price !== null) ??
          results.find(a => a.unit_price !== null) ??
          results[0] ?? null;
        setFixtureAsm(best);
      })
      .catch(console.error);
  }, [fixtureType, isSeparator, isOther]);

  // Auto-populate accessories when fixture type has a known box assembly
  useEffect(() => {
    const boxItems = FIXTURE_BOX_ASSEMBLY[fixtureType];
    if (!boxItems) {
      // Clear accessories if no box assembly defined for this fixture type
      setAccessories([]);
      return;
    }
    if (isSeparator || isOther) return;

    // Look up current prices from DB by item number (exact match)
    Promise.all(
      boxItems.map(b => getAssemblyByItemNumber(b.item_number)
        .then(match => ({
          description: match?.description ?? b.description,
          qty: b.qty,
          unitCost: match?.unit_price ?? 0,
          laborHrs: match?.labor_2 ?? match?.labor_1 ?? 0,
          assemblyId: match?.id ?? null,
        }))
      )
    ).then(resolved => {
      setAccessories(resolved);
    });
  }, [fixtureType]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleFixtureTypeChange = (val: string) => {
    if (val.startsWith("---")) return;
    setFixtureType(val);
  };

  const handleTakeoff = () => {
    const desc = activeDesc.trim();
    if (!desc || quantity <= 0) return;
    const inputs: LightsInputs = {
      projectId,
      description:       designation ? `[${designation}] ${desc}` : desc,
      manufacturer:      "",
      catalogNumber:     "",
      quantity,
      unitCost:          fixtureAsm?.unit_price ?? 0,
      laborHrsPerFixture: fixtureAsm?.labor_2 ?? fixtureAsm?.labor_1 ?? 0,
      assemblyId:        fixtureAsm?.id ?? null,
      isQuote:           isQuoteFixture,
      sectionBreakdown:  sectionBreakdown ?? { section: "Lighting", breakdown: "BASE BID" },
      accessories,
      additionalItems,
      markupPct:         defaultMarkup,
      laborRate:         defaultLaborRate,
      laborFactorPct:    laborFactor,
      materialFactorPct: materialFactor,
      notes,
    };
    onCommit(calculateLightsTakeoff(inputs));
    // Reset designation and quantity so user sees the form is ready for the next fixture
    setDesignation("");
    setQuantity(0);
  };

  const fmt = (n: number | null | undefined) =>
    n != null
      ? `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : "—";

  const canTakeoff = quantity > 0 && activeDesc.trim().length > 0;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <TakeoffShell
      title="Lighting Takeoff"
      quoteMode={isQuoteFixture}
      onQuoteModeChange={setIsQuoteFixture}
      subtitle={
        quantity > 0 && activeDesc
          ? `${quantity} × ${activeDesc}`
          : "Select fixture type and enter quantity"
      }
      laborFactor={laborFactor}
      materialFactor={materialFactor}
      onLaborFactorChange={setLaborFactor}
      onMaterialFactorChange={setMaterialFactor}
      onTakeoff={handleTakeoff}
      onClose={onClose}
      takeoffDisabled={!canTakeoff}
      width={760}
    >

      {/* ── Header section ── */}
      <div style={{
        padding: "14px 18px",
        background: "var(--bg-surface)",
        borderBottom: "1px solid var(--border)",
      }}>

        {/* Designation + Fixture Type */}
        <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", gap: 12, marginBottom: 12 }}>
          <FormRow label="Designation">
            <input
              value={designation}
              onChange={e => setDesignation(e.target.value)}
              placeholder="e.g. A, LP-1"
              style={formInp}
            />
          </FormRow>
          <FormRow label="Fixture Type *">
            <select
              value={fixtureType}
              onChange={e => handleFixtureTypeChange(e.target.value)}
              style={formInp}
            >
              {FIXTURE_TYPES.map((t, i) => (
                <option
                  key={i}
                  value={t}
                  disabled={t.startsWith("---")}
                  style={{
                    fontWeight:  t.startsWith("---") ? 700 : 400,
                    color:       t.startsWith("---") ? "#777" : "",
                    background:  t.startsWith("---") ? "#eee" : "",
                  }}
                >
                  {t}
                </option>
              ))}
            </select>
          </FormRow>
        </div>

        {/* Manual description (Other only) */}
        {isOther && (
          <div style={{ marginBottom: 12 }}>
            <FormRow label="Custom Description *">
              <input
                autoFocus
                value={customDesc}
                onChange={e => setCustomDesc(e.target.value)}
                placeholder="Enter fixture description…"
                style={formInp}
              />
            </FormRow>
          </div>
        )}

        {/* Catalog match banner */}
        {!isOther && !isSeparator && (
          <div style={{
            marginBottom: 12,
            background:   fixtureAsm ? "var(--accent-light)" : "var(--bg-raised)",
            border:       `1px solid ${fixtureAsm ? "var(--accent)" : "var(--border)"}`,
            borderRadius: "var(--r-md)",
            padding:      "8px 12px",
            fontSize:     12,
          }}>
            {fixtureAsm ? (
              <>
                <span style={{ color: "var(--accent)", fontWeight: 700 }}>Catalog match: </span>
                <span style={{ color: "var(--text-primary)" }}>{fixtureAsm.description}</span>
                <span style={{ color: "var(--text-muted)", marginLeft: 10 }}>
                  {isQuoteFixture
                    ? <span style={{ color: "#92400e", fontWeight: 700 }}>$0.00 (QUOTED)</span>
                    : <>{fmt(fixtureAsm.unit_price)} ea</>}
                  &nbsp;·&nbsp;
                  {fixtureAsm.labor_2 ?? fixtureAsm.labor_1 ?? 0} labor hrs each
                </span>
              </>
            ) : (
              <span style={{ color: "var(--text-muted)" }}>
                {isQuoteFixture
                  ? "No catalog match — fixture will be entered as a quoted item ($0) for supplier pricing."
                  : "No catalog match — prices will be $0. You can edit them in the estimate after takeoff."}
              </span>
            )}
          </div>
        )}

        {/* Quantity + Notes */}
        <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 12 }}>
          <FormRow label="Quantity *">
            <input
              type="number"
              value={quantity || ""}
              min={0}
              placeholder="0"
              onChange={e => setQuantity(parseInt(e.target.value) || 0)}
              style={{ ...formNumInp, fontSize: 16, fontWeight: 700 }}
            />
          </FormRow>
          <FormRow label="Notes">
            <input
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Optional notes…"
              style={formInp}
            />
          </FormRow>
        </div>
      </div>

      {/* ── Tabs ── */}
      <FormTabs
        tabs={["Accessories per Fixture", "Additional Accessories Total", "Notes", "Reminders"]}
        active={tab}
        onChange={setTab}
      />

      {/* ── Accessories per Fixture ── */}
      {tab === "Accessories per Fixture" && (
        <div style={{ padding: "12px 18px" }}>
          {/* Quick-add buttons */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)", alignSelf: "center" }}>
              Quick add:
            </span>
            {QUICK_ACCESSORIES.map(a => (
              <button
                key={a.label}
                onClick={() => setAccessories(prev => [
                  ...prev,
                  { description: a.description, qty: a.qty, unitCost: 0, laborHrs: 0, assemblyId: null },
                ])}
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border-strong)", color: "var(--text-secondary)", fontSize: 11, padding: "3px 10px", borderRadius: "var(--r-sm)", cursor: "pointer" }}
              >
                {a.label}
              </button>
            ))}
          </div>

          <AccGrid rows={accessories} onChange={setAccessories} />

          {accessories.length > 0 && quantity > 0 && (
            <div style={{ marginTop: 8, padding: "6px 10px", background: "var(--bg-surface)", borderRadius: "var(--r-md)", fontSize: 11, color: "var(--text-secondary)" }}>
              Each accessory quantity × {quantity} fixture{quantity !== 1 ? "s" : ""}
            </div>
          )}
        </div>
      )}

      {/* ── Additional Accessories Total ── */}
      {tab === "Additional Accessories Total" && (
        <div style={{ padding: "12px 18px" }}>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 10 }}>
            These quantities are NOT multiplied by fixture count — added as entered.
          </div>
          <AccGrid rows={additionalItems} onChange={setAdditionalItems} />
        </div>
      )}

      {/* ── Notes ── */}
      {tab === "Notes" && (
        <div style={{ padding: "14px 18px" }}>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Notes for this fixture type…"
            style={{
              width: "100%", height: 160, resize: "vertical",
              background: "var(--bg-surface)", border: "1px solid var(--border-strong)",
              borderRadius: "var(--r-md)", color: "var(--text-primary)",
              fontSize: 13, padding: 10, fontFamily: "var(--font-body)",
            }}
          />
        </div>
      )}

      {/* ── Reminders ── */}
      {tab === "Reminders" && (
        <div style={{ padding: "14px 18px" }}>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 10 }}>
            Common items to verify for this fixture:
          </div>
          {[
            "Verify voltage matches circuit",
            "Check ceiling type for mounting method",
            "Confirm trim / color with architect or owner",
            "Verify IC / non-IC rating if in insulated ceiling",
            "Check for dimmer compatibility",
            "Confirm wire gauge matches circuit ampacity",
            "Verify emergency battery pack required",
          ].map((r, i) => (
            <label key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: "1px solid var(--border)", cursor: "pointer" }}>
              <input type="checkbox" style={{ width: "auto", accentColor: "var(--accent)" }} />
              <span style={{ fontSize: 13, color: "var(--text-primary)" }}>{r}</span>
            </label>
          ))}
        </div>
      )}
    </TakeoffShell>
  );
}

// ── Accessory table ────────────────────────────────────────────────────────

function AccGrid({
  rows,
  onChange,
}: {
  rows: AccessoryRow[];
  onChange: React.Dispatch<React.SetStateAction<AccessoryRow[]>>;
}) {
  return (
    <>
      {rows.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 60px 85px 85px 28px", gap: 8, marginBottom: 6 }}>
          {["Description", "Qty", "Unit Cost", "Labor Hrs", ""].map(h => (
            <div key={h} style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {h}
            </div>
          ))}
        </div>
      )}
      {rows.map((acc, idx) => (
        <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 60px 85px 85px 28px", gap: 8, marginBottom: 6 }}>
          <input
            value={acc.description}
            onChange={e => onChange(prev => prev.map((a, i) => i === idx ? { ...a, description: e.target.value } : a))}
            placeholder="Description"
            style={formInp}
          />
          <input
            type="number" value={acc.qty} min={0} step={1}
            onChange={e => onChange(prev => prev.map((a, i) => i === idx ? { ...a, qty: parseFloat(e.target.value) || 0 } : a))}
            style={formNumInp}
          />
          <input
            type="number" value={acc.unitCost} min={0} step={0.01}
            onChange={e => onChange(prev => prev.map((a, i) => i === idx ? { ...a, unitCost: parseFloat(e.target.value) || 0 } : a))}
            style={formNumInp}
          />
          <input
            type="number" value={acc.laborHrs} min={0} step={0.01}
            onChange={e => onChange(prev => prev.map((a, i) => i === idx ? { ...a, laborHrs: parseFloat(e.target.value) || 0 } : a))}
            style={formNumInp}
          />
          <button
            onClick={() => onChange(prev => prev.filter((_, i) => i !== idx))}
            style={{ background: "none", border: "1px solid var(--border-strong)", borderRadius: "var(--r-sm)", color: "var(--red)", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <Trash2 size={12} />
          </button>
        </div>
      ))}
      <button
        onClick={() => onChange(prev => [...prev, emptyAcc()])}
        style={{ background: "none", border: "1px dashed var(--border-strong)", borderRadius: "var(--r-sm)", color: "var(--text-muted)", padding: "5px 12px", cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", gap: 5, marginTop: 4 }}
      >
        <Plus size={11} /> Add
      </button>
    </>
  );
}
