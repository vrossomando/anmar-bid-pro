import {
  FolderOpen, FilePlus, Edit, Trash2, RotateCcw, RefreshCw, BookOpen,
  FileText, Archive, Database, Settings, LogOut,
  Shield, Bell, Zap, Cable, Lightbulb, Package, HelpCircle, CheckCircle,
  Sliders, Layers, Plus,
  BarChart2, List, DollarSign, Clock, Users, TrendingUp,
  Percent, FileCheck, Hash, Printer, GitBranch,
} from "lucide-react";

type ActiveTab = "jobfile" | "takeoff" | "reports";

interface MenuBarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  hasActiveJob: boolean;
  activeJobName: string;
  companyLogo?: string;  // base64 data-url
  // Job File actions
  onNewJob: () => void;
  onOpenJob: () => void;
  onEditJob: () => void;
  onDeleteJob: () => void;
  onChangeOrder: () => void;
  onDuplicateJob: () => void;
  onSavedAssemblies: () => void;
  onBidLog: () => void;
  onJobNotes: () => void;
  onJobBackup: () => void;
  onDatabaseBackup: () => void;
  onProgramSetup: () => void;
  onExit: () => void;
  // Takeoff actions
  onTakeoff: (category: string) => void;
  // Reports actions
  onReport: (report: string) => void;
  onProposalLetter: () => void;
  onPCOLetter: () => void;
  onBidCommoditySheet: () => void;
  onPCOCommoditySheet: () => void;
}

// ── Blue button (Job File / Takeoff) ───────────────────────────────────────
function BlueBtn({ label, icon, onClick, disabled }: { label: string; icon: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 12px", height: 42,
        background: disabled
          ? "linear-gradient(180deg, #b0bec5 0%, #90a4ae 100%)"
          : "linear-gradient(180deg, #2277cc 0%, #1155aa 35%, #1565c0 65%, #3a9ade 100%)",
        border: disabled ? "1px solid #90a4ae" : "1px solid #0a3a88",
        borderTopColor: disabled ? "#b0bec5" : "#66aaee",
        borderLeftColor: disabled ? "#b0bec5" : "#55aadd",
        borderRadius: "var(--r-sm)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.65 : 1,
        transition: "filter 0.08s",
        width: "100%",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.15)",
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.filter = "brightness(1.12)"; }}
      onMouseLeave={e => { e.currentTarget.style.filter = ""; }}
    >
      <span style={{ color: "white", fontSize: 12, fontWeight: 700, fontFamily: "Arial, sans-serif", textTransform: "uppercase", letterSpacing: "0.4px", textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}>
        {label}
      </span>
      <span style={{ color: "rgba(255,255,255,0.85)", display: "flex", flexShrink: 0 }}>{icon}</span>
    </button>
  );
}

// ── Cyan button (Reports) ──────────────────────────────────────────────────
function CyanBtn({ label, icon, onClick, disabled }: { label: string; icon: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 12px", height: 42,
        background: "linear-gradient(180deg, #22ccdd 0%, #10aacc 35%, #0fbbcc 65%, #40ddf0 100%)",
        border: "1px solid #0a6a88", borderTopColor: "#66eeff", borderLeftColor: "#44ddee",
        borderRadius: "var(--r-sm)", cursor: "pointer", transition: "filter 0.08s", width: "100%",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.15)",
      }}
      onMouseEnter={e => { e.currentTarget.style.filter = "brightness(1.10)"; }}
      onMouseLeave={e => { e.currentTarget.style.filter = ""; }}
    >
      <span style={{ color: "white", fontSize: 12, fontWeight: 700, fontFamily: "Arial, sans-serif", textTransform: "uppercase", letterSpacing: "0.4px", textShadow: "0 1px 2px rgba(0,0,0,0.4)" }}>
        {label}
      </span>
      <span style={{ color: "rgba(255,255,255,0.85)", display: "flex", flexShrink: 0 }}>{icon}</span>
    </button>
  );
}

// ── Tab button ─────────────────────────────────────────────────────────────
function TabBtn({ label, underlineChar, active, onClick }: { label: string; underlineChar: string; active: boolean; onClick: () => void }) {
  const before = label.slice(0, label.indexOf(underlineChar));
  const after = label.slice(label.indexOf(underlineChar) + 1);
  return (
    <button
      onClick={onClick}
      style={{
        padding: "6px 22px 7px",
        background: active ? "var(--bg-raised)" : "#c8d8e8",
        border: "1px solid #7aaac8",
        borderBottom: active ? "2px solid var(--bg-raised)" : "1px solid #7aaac8",
        borderRadius: "4px 4px 0 0",
        cursor: "pointer", fontSize: 13, fontWeight: active ? 700 : 500,
        color: "var(--text-primary)", fontFamily: "Arial, sans-serif",
        position: "relative", bottom: -1, zIndex: active ? 2 : 1,
        minWidth: 110, textAlign: "left",
        transition: "background var(--t-fast)",
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = "#d8e8f4"; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = "#c8d8e8"; }}
    >
      {before}
      <span style={{ textDecoration: "underline" }}>{underlineChar}</span>
      {after}
    </button>
  );
}

// ── Three-column grid ──────────────────────────────────────────────────────
function BtnGrid({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 5, padding: "10px 10px 12px", background: "#b8d4e8" }}>
      {children}
    </div>
  );
}

// ── Column ─────────────────────────────────────────────────────────────────
function Col({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>{children}</div>;
}

// ── Main MenuBar ───────────────────────────────────────────────────────────
export default function MenuBar({
  activeTab, onTabChange, hasActiveJob, activeJobName, companyLogo,
  onNewJob, onOpenJob, onEditJob, onDeleteJob, onChangeOrder,
  onDuplicateJob, onSavedAssemblies,
  onBidLog, onJobNotes, onJobBackup, onDatabaseBackup, onBidCommoditySheet, onPCOCommoditySheet, onProgramSetup, onExit,
  onTakeoff, onReport, onProposalLetter, onPCOLetter,
}: MenuBarProps) {
  return (
    <div style={{ background: "#b8d4e8", borderBottom: "2px solid #7aaac8", flexShrink: 0 }}>
      {/* App title bar */}
      <div style={{ background: "linear-gradient(to right, #0a246a, #3a6abf)", padding: "5px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {companyLogo && (
            <img
              src={companyLogo}
              alt="Company logo"
              style={{ height: 28, maxWidth: 120, objectFit: "contain", borderRadius: 3 }}
            />
          )}
          <span style={{ color: "white", fontWeight: 700, fontSize: 13, letterSpacing: "0.5px" }}>
            Anmar Bid Pro
            {hasActiveJob && (
              <span style={{ fontWeight: 400, opacity: 0.8, marginLeft: 12 }}>— {activeJobName}</span>
            )}
          </span>
        </div>
        <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 11 }}>v1.0</span>
      </div>

      {/* Tab buttons */}
      <div style={{ display: "flex", gap: 2, padding: "5px 8px 0", alignItems: "flex-end" }}>
        <TabBtn label="Job File" underlineChar="J" active={activeTab === "jobfile"} onClick={() => onTabChange("jobfile")} />
        <TabBtn label="Takeoff" underlineChar="T" active={activeTab === "takeoff"} onClick={() => onTabChange("takeoff")} />
        <TabBtn label="Reports" underlineChar="R" active={activeTab === "reports"} onClick={() => onTabChange("reports")} />
      </div>

      {/* ── JOB FILE TAB ── */}
      {activeTab === "jobfile" && (
        <BtnGrid>
          <Col>
            <BlueBtn label="New Job"    icon={<FilePlus size={14} />}  onClick={onNewJob} />
            <BlueBtn label="Open Job"   icon={<FolderOpen size={14} />} onClick={onOpenJob} />
            <BlueBtn label="Edit Job"   icon={<Edit size={14} />}       onClick={onEditJob}   disabled={!hasActiveJob} />
            <BlueBtn label="Delete Job"    icon={<Trash2 size={14} />}   onClick={onDeleteJob}      disabled={!hasActiveJob} />
            <BlueBtn label="Duplicate Job" icon={<RefreshCw size={14} />} onClick={onDuplicateJob}   disabled={!hasActiveJob} />
          </Col>
          <Col>
            <BlueBtn label="Change Order" icon={<RotateCcw size={14} />} onClick={onChangeOrder} disabled={!hasActiveJob} />
            <BlueBtn label="Bid Log"      icon={<BookOpen size={14} />}  onClick={onBidLog} />
            <BlueBtn label="Job Notes"    icon={<FileText size={14} />}  onClick={onJobNotes}   disabled={!hasActiveJob} />
            <BlueBtn label="Job Backup"   icon={<Archive size={14} />}   onClick={onJobBackup}  disabled={!hasActiveJob} />
          </Col>
          <Col>
            <CyanBtn label="Database Backup"    icon={<Database size={14} />}    onClick={onDatabaseBackup} />
            <CyanBtn label="BID Commodity Pricing" icon={<TrendingUp size={14} />} onClick={onBidCommoditySheet} />
            <CyanBtn label="PCO Commodity Pricing" icon={<TrendingUp size={14} />} onClick={onPCOCommoditySheet} />
            <CyanBtn label="Program Setup"      icon={<Settings size={14} />}    onClick={onProgramSetup} />
            <CyanBtn label="Exit"               icon={<LogOut size={14} />}      onClick={onExit} />
          </Col>
        </BtnGrid>
      )}

      {/* ── TAKEOFF TAB ── */}
      {activeTab === "takeoff" && (
        <BtnGrid>
          {/* Left column */}
          <Col>
            <BlueBtn label="Lights"             icon={<Lightbulb size={14} />} onClick={() => onTakeoff("Lights")}                   disabled={!hasActiveJob} />
            <BlueBtn label="Lighting Control"   icon={<Sliders size={14} />}   onClick={() => onTakeoff("Lighting Control")}          disabled={!hasActiveJob} />
            <BlueBtn label="Devices"            icon={<Package size={14} />}   onClick={() => onTakeoff("Devices")}                   disabled={!hasActiveJob} />
            <BlueBtn label="HVAC / Equip Conn"  icon={<Zap size={14} />}       onClick={() => onTakeoff("HVAC / Equip Connections")}  disabled={!hasActiveJob} />
            <BlueBtn label="Gear"               icon={<Zap size={14} />}       onClick={() => onTakeoff("Gear")}                      disabled={!hasActiveJob} />
            <BlueBtn label="Generator"          icon={<Zap size={14} />}       onClick={() => onTakeoff("Generator")}                 disabled={!hasActiveJob} />
            <BlueBtn label="Grounding"          icon={<Zap size={14} />}       onClick={() => onTakeoff("Grounding")}                 disabled={!hasActiveJob} />
          </Col>
          {/* Middle column */}
          <Col>
            <BlueBtn label="Fire Alarm / Nurse Call" icon={<Bell size={14} />}    onClick={() => onTakeoff("Fire Alarm / Nurse Call")}  disabled={!hasActiveJob} />
            <BlueBtn label="Security / Intercom"     icon={<Shield size={14} />}  onClick={() => onTakeoff("Security / Intercom")}      disabled={!hasActiveJob} />
            <BlueBtn label="Temp Pwr / Light"        icon={<Zap size={14} />}     onClick={() => onTakeoff("Temporary Power")}          disabled={!hasActiveJob} />
            <BlueBtn label="Conduit / Wire Feeders"  icon={<Cable size={14} />}   onClick={() => onTakeoff("Conduit / Wire Feeders")}   disabled={!hasActiveJob} />
            <BlueBtn label="Cable"                   icon={<Cable size={14} />}   onClick={() => onTakeoff("Cable")}                    disabled={!hasActiveJob} />
            <BlueBtn label="Supports"                icon={<Layers size={14} />}  onClick={() => onTakeoff("Supports")}                 disabled={!hasActiveJob} />
            <BlueBtn label="Specialty Items"         icon={<Layers size={14} />}  onClick={() => onTakeoff("Specialty Items")}          disabled={!hasActiveJob} />
          </Col>
          {/* Right column */}
          <Col>
            <BlueBtn label="Layout"           icon={<List size={14} />}        onClick={() => onTakeoff("Layout")}              disabled={!hasActiveJob} />
            <BlueBtn label="Punch List"       icon={<CheckCircle size={14} />} onClick={() => onTakeoff("Punch List")}          disabled={!hasActiveJob} />
            <BlueBtn label="Misc Items"       icon={<Package size={14} />}     onClick={() => onTakeoff("Miscellaneous Items")} disabled={!hasActiveJob} />
            <BlueBtn label="Temp Items"       icon={<Plus size={14} />}        onClick={() => onTakeoff("Temporary Items")}     disabled={!hasActiveJob} />
            <BlueBtn label="Saved Assemblies" icon={<BookOpen size={14} />}    onClick={onSavedAssemblies}                     disabled={!hasActiveJob} />
            {!hasActiveJob && (
              <div style={{ padding: "8px 10px", background: "rgba(255,255,255,0.5)", borderRadius: "var(--r-sm)", fontSize: 11, color: "#445568", fontStyle: "italic", border: "1px dashed #7aaac8" }}>
                Open or create a job to start taking off items
              </div>
            )}
          </Col>
        </BtnGrid>
      )}

      {/* ── REPORTS TAB ── */}
      {activeTab === "reports" && (
        <BtnGrid>
          <Col>
            <BlueBtn label="Extensions"        icon={<List size={14} />}       onClick={() => onReport("Extensions")}        disabled={!hasActiveJob} />
            <BlueBtn label="Material List"     icon={<Package size={14} />}    onClick={() => onReport("Material List")}     disabled={!hasActiveJob} />
            <BlueBtn label="Quotes"            icon={<HelpCircle size={14} />} onClick={() => onReport("Quotes")}            disabled={!hasActiveJob} />
          </Col>
          <Col>
            <CyanBtn label="Totals"            icon={<Hash size={14} />}       onClick={() => onReport("Totals")}            disabled={!hasActiveJob} />
            <CyanBtn label="Select Bid Summary" icon={<Printer size={14} />}  onClick={() => onReport("Select Bid Summary")} disabled={!hasActiveJob} />
            <CyanBtn label="Exit"              icon={<LogOut size={14} />}     onClick={onExit} />
          </Col>
          <Col>
            <CyanBtn label="Proposal Letter"   icon={<FileText size={14} />}  onClick={onProposalLetter}                    disabled={!hasActiveJob} />
            <CyanBtn label="PCO Letter"        icon={<FileText size={14} />}  onClick={onPCOLetter}                         disabled={!hasActiveJob} />
          </Col>
        </BtnGrid>
      )}
    </div>
  );
}
