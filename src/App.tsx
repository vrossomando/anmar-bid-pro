import { useState, useEffect, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import MenuBar from "./components/MenuBar";
import ProjectEditor from "./pages/ProjectEditor";
import NoJobView from "./pages/NoJobView";
import NewJobModal from "./components/NewJobModal";
import OpenJobModal from "./components/OpenJobModal";
import EditJobModal from "./components/EditJobModal";
import ConfirmModal from "./components/ConfirmModal";
import { BidLogModal, JobNotesModal } from "./components/JobModals";
import {
  listProjects, createProject, updateProject, deleteProject,
  getProject, loadSettings, createLineItem, duplicateProject,
  listLineItems, updateLineItem, repriceCommodityItems,
  type Project, type Settings,
} from "./hooks/db";
import ZeroCostDialog, { type ZeroCostResolution, type ZeroCostItem } from "./components/ZeroCostDialog";
import ProposalLetterModal from "./components/ProposalLetterModal";
import PCOLetterModal from "./components/PCOLetterModal";
import ConduitTakeoffForm  from "./components/takeoff/ConduitTakeoffForm";
import CableTakeoffForm    from "./components/takeoff/CableTakeoffForm";
import LightsTakeoffForm   from "./components/takeoff/LightsTakeoffForm";
import SecurityTakeoffForm from "./components/takeoff/SecurityTakeoffForm";
import FireAlarmTakeoffForm from "./components/takeoff/FireAlarmTakeoffForm";
import GearTakeoffForm     from "./components/takeoff/GearTakeoffForm";
import MiscTakeoffForm     from "./components/takeoff/MiscTakeoffForm";
import DevicesTakeoffForm          from "./components/takeoff/DevicesTakeoffForm";
import LightingControlTakeoffForm from "./components/takeoff/LightingControlTakeoffForm";
import GeneratorTakeoffForm       from "./components/takeoff/GeneratorTakeoffForm";
import LayoutTakeoffForm         from "./components/takeoff/LayoutTakeoffForm";
import PunchListTakeoffForm      from "./components/takeoff/PunchListTakeoffForm";
import TempPowerTakeoffForm       from "./components/takeoff/TempPowerTakeoffForm";
import SupportsTakeoffForm        from "./components/takeoff/SupportsTakeoffForm";
import EquipConnTakeoffForm       from "./components/takeoff/EquipConnTakeoffForm";
import SpecialtyTakeoffForm       from "./components/takeoff/SpecialtyTakeoffForm";
import GroundingTakeoffForm       from "./components/takeoff/GroundingTakeoffForm";
import SectionBreakdownModal, { type SectionBreakdown } from "./components/SectionBreakdownModal";
import CommoditySheetModal   from "./components/CommoditySheetModal";
import CommodityAgeDialog    from "./components/CommodityAgeDialog";
import CommodityRepricingPrompt from "./components/CommodityRepricingPrompt";
import UpdateChecker          from "./components/UpdateChecker";
import ProgramSetupModal      from "./components/ProgramSetupModal";
import DatabaseBackupModal    from "./components/DatabaseBackupModal";
import SavedAssembliesModal   from "./components/SavedAssembliesModal";
import ChangeOrderModal      from "./components/ChangeOrderModal";
import ReportsView from "./pages/ReportsView";
import type { TakeoffLineItem } from "./hooks/takeoffCalculations";
import { loadLivePricing } from "./hooks/laborRates";
import { COMMODITY_UPLOAD_TS_BID, COMMODITY_UPLOAD_TS_PCO } from "./hooks/commodityUtils";

type ActiveTab = "jobfile" | "takeoff" | "reports";
type Modal =
  | "newJob" | "openJob" | "editJob" | "deleteJob"
  | "bidLog" | "jobNotes" | "exit" | null;

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("jobfile");
  const [modal, setModal] = useState<Modal>(null);
  const [takeoffCategory,   setTakeoffCategory]   = useState<string | null>(null);
  const [pendingCategory,   setPendingCategory]   = useState<string | null>(null);
  const [showCommodity,         setShowCommodity]         = useState(false);
  const [commodityModalType,    setCommodityModalType]    = useState<"bid" | "pco">("bid");
  const [editorRefreshTrigger,  setEditorRefreshTrigger]  = useState(0);
  const [showCommodityAge,      setShowCommodityAge]      = useState(false);
  const [commodityAgeDays,      setCommodityAgeDays]      = useState<number | null>(null);
  const [commodityAgeType,      setCommodityAgeType]      = useState<"bid" | "pco">("bid");
  const [showRepricingPrompt,   setShowRepricingPrompt]   = useState(false);
  const [pendingOpenProject,    setPendingOpenProject]    = useState<Project | null>(null);
  const [showProgramSetup,  setShowProgramSetup]  = useState(false);
  const [showDbBackup,       setShowDbBackup]       = useState(false);
  const [showSavedAsm,       setShowSavedAsm]       = useState(false);
  const [showChangeOrder,  setShowChangeOrder]   = useState(false);
  const [showProposalLetter, setShowProposalLetter] = useState(false);
  const [showPCOLetter,      setShowPCOLetter]      = useState(false);
  const [activeReport,      setActiveReport]      = useState<string | null>(null);
  const [livePricing,       setLivePricing]       = useState<Record<string, number>>({});  // waiting for section/breakdown
  const [sectionBreakdown,  setSectionBreakdown]  = useState<SectionBreakdown>({
    section: "Gear/Distribution", breakdown: "BASE BID", division: "Electrical", drawingRef: "All",
  });
  const [editorKey, setEditorKey] = useState(0);  // increment to force ProjectEditor reload
  const [settings, setSettings] = useState<Settings>({});
  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);

  // Zero-cost dialog
  const [zeroCostItems,    setZeroCostItems]    = useState<ZeroCostItem[]>([]);
  const [zeroCostPending,  setZeroCostPending]  = useState<Array<TakeoffLineItem & { sort_order: number }>>([]);

  const refreshProjects = useCallback(async () => {
    try {
      const data = await listProjects();
      setProjects(data);
      // Keep active project in sync
      if (activeProject) {
        const updated = data.find(p => p.id === activeProject.id);
        if (updated) setActiveProject(updated);
      }
    } catch (e) { console.error(e); }
  }, [activeProject]);

  const refreshSettings = useCallback(async () => {
    try { setSettings(await loadSettings()); } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        // Call listProjects directly so DB errors propagate here
        const data = await listProjects();
        setProjects(data);
        const s = await loadSettings();
        setSettings(s);
        const pricing = await loadLivePricing();
        setLivePricing(pricing);
        setDbReady(true);
      } catch (e: unknown) {
        console.error("DB init error:", e);
        setDbError("Database error: " + String(e) + "\n\nTry restarting the app. If this persists, use Database Backup > Restore to reload your data.");
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Reload live pricing whenever the active project changes (uses project's commodity_type)
  useEffect(() => {
    if (!activeProject) return;
    const type = (activeProject.commodity_type ?? "bid") as "bid" | "pco";
    loadLivePricing(type).then(setLivePricing).catch(() => {});
  }, [activeProject?.id, activeProject?.commodity_type]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Job File actions ────────────────────────────────────────────────────

  const handleCreateJob = async (fields: Omit<Project, "id" | "created_at" | "updated_at">) => {
    const id = uuidv4();
    const now = new Date().toISOString();
    const proj: Project = { ...fields, id, created_at: now, updated_at: now };
    try {
      await createProject(proj);
      await refreshProjects();
      setActiveProject(proj);
      setModal(null);
      setActiveTab("takeoff");
    } catch (e) {
      console.error("createProject failed:", e);
      setDbError("Failed to create job: " + String(e));
    }
  };

  // ── Commodity helpers ────────────────────────────────────────────────────
  const getDaysSinceCommodityUpload = async (type: "bid" | "pco"): Promise<number | null> => {
    const settings = await loadSettings();
    const tsKey = type === "pco" ? COMMODITY_UPLOAD_TS_PCO : COMMODITY_UPLOAD_TS_BID;
    const ts = settings[tsKey];
    if (!ts) return null;
    const ms = Date.now() - new Date(ts).getTime();
    return Math.floor(ms / (1000 * 60 * 60 * 24));
  };

  const doOpenJob = async (proj: Project) => {
    setActiveProject(proj);
    setModal(null);
    setActiveTab("takeoff");
    // Show commodity age dialog every time a job is opened
    const type = (proj.commodity_type ?? "bid") as "bid" | "pco";
    const days = await getDaysSinceCommodityUpload(type);
    setCommodityAgeType(type);
    setCommodityAgeDays(days);
    setShowCommodityAge(true);
  };

  const handleOpenJob = async (id: string) => {
    const proj = await getProject(id);
    if (!proj) return;
    setModal(null);
    // If switching from a different active job, ask about repricing first
    if (activeProject && activeProject.id !== id) {
      setPendingOpenProject(proj);
      setShowRepricingPrompt(true);
    } else {
      await doOpenJob(proj);
    }
  };

  const handleRepricingConfirm = async (doReprice: boolean) => {
    setShowRepricingPrompt(false);
    const proj = pendingOpenProject;
    setPendingOpenProject(null);
    if (!proj) return;
    if (doReprice) {
      const type = (proj.commodity_type ?? "bid") as "bid" | "pco";
      const pricing = await loadLivePricing(type);
      await repriceCommodityItems(proj.id, pricing);
      setLivePricing(pricing);
      setEditorRefreshTrigger(t => t + 1);
    }
    await doOpenJob(proj);
  };

  const handleEditJob = async (updates: Partial<Project>) => {
    if (!activeProject) return;
    try {
      await updateProject(activeProject.id, updates);
      await refreshProjects();
      const updated = await getProject(activeProject.id);
      if (updated) setActiveProject(updated);
      setModal(null);
    } catch (e) { console.error(e); }
  };

  const handleDeleteJob = async () => {
    if (!activeProject) return;
    try {
      await deleteProject(activeProject.id);
      setActiveProject(null);
      await refreshProjects();
      setModal(null);
    } catch (e) { console.error(e); }
  };

  const handleSaveNotes = async (notes: string) => {
    if (!activeProject) return;
    try {
      await updateProject(activeProject.id, { notes });
      await refreshProjects();
    } catch (e) { console.error(e); }
  };

  const handleJobBackup = async () => {
    // Full backup functionality comes in Phase 6
    // For now, export job data as a JSON download via the browser
    if (!activeProject) return;
    try {
      const data = JSON.stringify({ project: activeProject, exported_at: new Date().toISOString() }, null, 2);
      const blob = new Blob([data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${activeProject.name.replace(/[^a-z0-9]/gi, "_")}_backup.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) { console.error("Backup failed:", e); }
  };

  const handleDatabaseBackup = () => {
    setShowDbBackup(true);
  };

  const handleDuplicateJob = async () => {
    if (!activeProject) return;
    const newName = prompt(`Duplicate "${activeProject.name}"

New job name:`, `${activeProject.name} (Copy)`);
    if (!newName?.trim()) return;
    try {
      const newId = await duplicateProject(activeProject.id, newName.trim());
      const projs = await listProjects();
      setProjects(projs);
      const newProj = projs.find(p => p.id === newId);
      if (newProj) setActiveProject(newProj);
    } catch (err) {
      alert("Failed to duplicate job: " + String(err));
    }
  };

  const handleExit = () => {
    window.close();
  };

  const handleTakeoff = (category: string) => {
    if (!activeProject) return;
    setPendingCategory(category);   // show section/breakdown modal first
  };

  const handleSectionBreakdownConfirm = (sb: SectionBreakdown) => {
    setSectionBreakdown(sb);
    setTakeoffCategory(pendingCategory);
    setPendingCategory(null);
  };

  const handleCommitTakeoff = async (items: TakeoffLineItem[]) => {
    // Detect unique zero-cost items (unit_cost === 0, not zero-qty)
    const zeroCost = items.filter(i => i.unit_cost === 0 && i.qty > 0);
    // Deduplicate by description so we don't ask about the same item twice
    const seen = new Set<string>();
    const uniqueZero: ZeroCostItem[] = [];
    for (const i of zeroCost) {
      const key = i.assembly_id != null ? `id:${i.assembly_id}` : `desc:${i.description}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueZero.push({ description: i.description, assemblyId: i.assembly_id, qty: i.qty, unit: i.unit });
      }
    }

    // Build the full list of items to persist (with sort_order)
    const toSave = items.map((item, idx) => ({ ...item, sort_order: Date.now() + idx }));

    if (uniqueZero.length > 0) {
      // Hold items — show dialog first
      setZeroCostPending(toSave);
      setZeroCostItems(uniqueZero);
    } else {
      // No zero-cost items — save immediately
      for (const item of toSave) await createLineItem(item);
      await refreshProjects();
      setEditorKey(k => k + 1);
    }
  };

  const handleZeroCostResolve = async (
    description: string,
    assemblyId: number | null,
    resolution: ZeroCostResolution,
    newUnitCost?: number,
    quoteCategory?: string
  ) => {
    const unitCost = resolution === "edit" ? (newUnitCost ?? 0) : 0;

    // Update pending items in memory
    setZeroCostPending(prev => prev.map(item => {
      const matches = assemblyId != null
        ? item.assembly_id === assemblyId
        : item.description === description;
      if (!matches) return item;
      // For quote: reroute category to the chosen quote category + keep unit_cost = 0
      if (resolution === "quote" && quoteCategory) {
        const parts = item.category.split("|").map(s => s.trim());
        const section   = parts[1] ?? "Gear/Distribution";
        const breakdown = parts[2] ?? "BASE BID";
        return { ...item, unit_cost: 0, category: `${quoteCategory} | ${section} | ${breakdown}` };
      }
      return { ...item, unit_cost: unitCost };
    }));

    // Also patch any existing matching line items already in the project
    if (!activeProject) return;
    try {
      const existing = await listLineItems(activeProject.id);
      const targets = existing.filter(i =>
        assemblyId != null ? i.assembly_id === assemblyId : i.description === description
      );
      if (targets.length > 0) {
        await Promise.all(targets.map(t => {
          if (resolution === "quote" && quoteCategory) {
            const parts = t.category.split("|").map(s => s.trim());
            const section   = parts[1] ?? "Gear/Distribution";
            const breakdown = parts[2] ?? "BASE BID";
            return updateLineItem(t.id, {
              unit_cost: 0,
              category: `${quoteCategory} | ${section} | ${breakdown}`,
            });
          }
          return updateLineItem(t.id, { unit_cost: unitCost });
        }));
      }
    } catch { /* non-fatal */ }
  };

  const handleZeroCostDone = async () => {
    const toSave = zeroCostPending;
    setZeroCostItems([]);
    setZeroCostPending([]);
    for (const item of toSave) await createLineItem(item);
    await refreshProjects();
    setEditorKey(k => k + 1);
  };

  const handleReport = (report: string) => {
    if (!activeProject) return;
    setActiveReport(report);
  };

  // ── Render ────────────────────────────────────────────────────────────

  const currencySymbol = settings.currency_symbol ?? "$";
  const defaultMarkup    = 0;  // No default markup — set per line item if needed
  const defaultLaborRate = parseFloat(settings.labor_rate        ?? "85");

  if (dbError) {
    const isMigration = dbError.includes("migration") && dbError.includes("modified");
    const doReset = async () => {
      if (!confirm("This will delete the database and start fresh.\n\nAll jobs will be lost unless you have a backup.\n\nContinue?")) return;
      // Try invoke first; if it fails (DB broken), show manual path
      let resetOk = false;
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("reset_database");
        resetOk = true;
      } catch (_) {
        resetOk = false;
      }
      if (resetOk) {
        window.location.reload();
      } else {
        alert(
          "Please delete this file manually, then restart the app:\n\n" +
          "  %APPDATA%\\com.anmarbidpro.app\\anmarbidpro.db\n\n" +
          "Steps:\n" +
          "1. Close this app\n" +
          "2. Open File Explorer\n" +
          "3. Paste the path above into the address bar\n" +
          "4. Delete anmarbidpro.db (and .db-shm / .db-wal if present)\n" +
          "5. Restart the app"
        );
      }
    };
    return (
      <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16, padding: 40, background: "var(--bg-surface)" }}>
        <div style={{ fontSize: 44 }}>⚠️</div>
        <h2 style={{ color: "var(--text-primary)", fontWeight: 700, fontSize: 20 }}>Database Error</h2>
        <p style={{ color: "var(--text-secondary)", fontSize: 13, maxWidth: 440, textAlign: "center", lineHeight: 1.6 }}>
          {isMigration ? "The database schema has changed. Click Reset to start fresh. Restore a backup afterward if you have one." : dbError}
        </p>
        <button onClick={doReset}
          style={{ padding: "10px 28px", background: "#dc2626", color: "white", border: "none", borderRadius: 6, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
          Reset Database & Start Fresh
        </button>
        <p style={{ color: "var(--text-muted)", fontSize: 11, maxWidth: 400, textAlign: "center" }}>
          {isMigration ? "Original error: " + dbError : "Try restarting. If this persists, click Reset above."}
        </p>
      </div>
    );
  }

  if (!dbReady) {
    return (
      <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, color: "var(--text-secondary)", fontSize: 13, background: "var(--bg-surface)" }}>
        <span style={{ animation: "pulse-ring 1.4s infinite", color: "var(--accent)" }}>●</span>
        Initializing Anmar Bid Pro…
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", background: "var(--bg-surface)" }}>

      {/* ── Menu bar ── */}
      <MenuBar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          hasActiveJob={!!activeProject}
          activeJobName={activeProject?.name ?? ""}
          companyLogo={settings.company_logo ?? undefined}
          onNewJob={() => setModal("newJob")}
          onOpenJob={() => setModal("openJob")}
          onEditJob={() => { if (activeProject) setModal("editJob"); }}
          onDeleteJob={() => { if (activeProject) setModal("deleteJob"); }}
          onChangeOrder={() => setShowChangeOrder(true)}
          onDuplicateJob={handleDuplicateJob}
          onSavedAssemblies={() => setShowSavedAsm(true)}
          onBidLog={() => setModal("bidLog")}
          onJobNotes={() => { if (activeProject) setModal("jobNotes"); }}
          onJobBackup={handleJobBackup}
          onDatabaseBackup={handleDatabaseBackup}
          onBidCommoditySheet={() => { setCommodityModalType("bid"); setShowCommodity(true); }}
          onPCOCommoditySheet={() => { setCommodityModalType("pco"); setShowCommodity(true); }}
          onProgramSetup={() => setShowProgramSetup(true)}
          onExit={() => setModal("exit")}
          onTakeoff={handleTakeoff}
          onReport={handleReport}
          onProposalLetter={() => setShowProposalLetter(true)}
          onPCOLetter={() => setShowPCOLetter(true)}
        />

      {/* ── Main content area ── */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {activeReport && activeProject ? (
          <ReportsView
            key={`${activeProject.id}-${activeReport}`}
            projectId={activeProject.id}
            initialReport={activeReport as any}
            onBack={() => setActiveReport(null)}
          />
        ) : activeProject ? (
          <ProjectEditor
            key={`${activeProject.id}-${editorKey}`}
            projectId={activeProject.id}
            onBack={() => setActiveProject(null)}
            onProjectUpdated={refreshProjects}
            currencySymbol={currencySymbol}
            defaultMarkup={defaultMarkup}
            defaultLaborRate={defaultLaborRate}
            refreshTrigger={editorRefreshTrigger}
          />
        ) : (
          <NoJobView
            projects={projects}
            onNewJob={() => setModal("newJob")}
            onOpenJob={handleOpenJob}
          />
        )}
      </div>

      {/* ── Status bar ── */}
      <div style={{ height: 22, background: "linear-gradient(to right, #1a3a6a, #2a5aa0)", display: "flex", alignItems: "center", paddingInline: 12, gap: 16, flexShrink: 0 }}>
        <StatusCell>{activeProject ? `${activeProject.bid_number ? `#${activeProject.bid_number} · ` : ""}${activeProject.name}` : "No job open"}</StatusCell>
        <StatusCell>{activeProject ? `Client: ${activeProject.client || "—"}` : `${projects.length} jobs on file`}</StatusCell>
        <StatusCell style={{ marginLeft: "auto" }}>Anmar Bid Pro v1.0</StatusCell>
      </div>

      {/* ── Modals ── */}
      {modal === "newJob" && (
        <NewJobModal
          onClose={() => setModal(null)}
          onCreate={handleCreateJob}
        />
      )}

      {modal === "openJob" && (
        <OpenJobModal
          projects={projects}
          onOpen={handleOpenJob}
          onClose={() => setModal(null)}
        />
      )}

      {modal === "editJob" && activeProject && (
        <EditJobModal
          project={activeProject}
          onSave={handleEditJob}
          onClose={() => setModal(null)}
        />
      )}

      {modal === "deleteJob" && activeProject && (
        <ConfirmModal
          title="Delete Job"
          message={`Are you sure you want to permanently delete "${activeProject.name}"? This will also delete all line items and cannot be undone.`}
          confirmLabel="Delete Job"
          danger
          onConfirm={handleDeleteJob}
          onCancel={() => setModal(null)}
        />
      )}

      {modal === "bidLog" && (
        <BidLogModal
          projects={projects}
          onOpen={handleOpenJob}
          onClose={() => setModal(null)}
          onStatusChanged={refreshProjects}
        />
      )}

      {modal === "jobNotes" && activeProject && (
        <JobNotesModal
          projectName={activeProject.name}
          notes={activeProject.notes ?? ""}
          onSave={handleSaveNotes}
          onClose={() => setModal(null)}
        />
      )}

      {/* ── Section / Breakdown modal (shown before any takeoff form) ── */}
      {pendingCategory && activeProject && (
        <SectionBreakdownModal
          category={pendingCategory}
          onConfirm={handleSectionBreakdownConfirm}
          onCancel={() => setPendingCategory(null)}
        />
      )}

      {/* ── Takeoff Forms ── */}
      {takeoffCategory === "Conduit / Wire Feeders" && activeProject && (
        <ConduitTakeoffForm
          projectId={activeProject.id}
          defaultMarkup={defaultMarkup}
          defaultLaborRate={defaultLaborRate}
          sectionBreakdown={sectionBreakdown}
          livePricing={livePricing}
          onCommit={handleCommitTakeoff}
          onClose={() => setTakeoffCategory(null)}
        />
      )}
      {takeoffCategory === "Cable" && activeProject && (
        <CableTakeoffForm
          projectId={activeProject.id}
          defaultMarkup={defaultMarkup}
          defaultLaborRate={defaultLaborRate}
          sectionBreakdown={sectionBreakdown}
          livePricing={livePricing}
          onCommit={handleCommitTakeoff}
          onClose={() => setTakeoffCategory(null)}
        />
      )}
      {(takeoffCategory === "Lights" || takeoffCategory === "Lighting") && activeProject && (
        <LightsTakeoffForm
          projectId={activeProject.id}
          defaultMarkup={defaultMarkup}
          defaultLaborRate={defaultLaborRate}
          sectionBreakdown={sectionBreakdown}
          onCommit={handleCommitTakeoff}
          onClose={() => setTakeoffCategory(null)}
        />
      )}
      {takeoffCategory === "Security / Intercom" && activeProject && (
        <SecurityTakeoffForm
          projectId={activeProject.id}
          defaultLaborRate={defaultLaborRate}
          sectionBreakdown={sectionBreakdown}
          onCommit={handleCommitTakeoff}
          onClose={() => setTakeoffCategory(null)}
        />
      )}
      {takeoffCategory === "Fire Alarm / Nurse Call" && activeProject && (
        <FireAlarmTakeoffForm
          projectId={activeProject.id}
          defaultLaborRate={defaultLaborRate}
          sectionBreakdown={sectionBreakdown}
          onCommit={handleCommitTakeoff}
          onClose={() => setTakeoffCategory(null)}
        />
      )}
      {takeoffCategory === "Gear" && activeProject && (
        <GearTakeoffForm
          projectId={activeProject.id}
          defaultLaborRate={defaultLaborRate}
          sectionBreakdown={sectionBreakdown}
          onCommit={handleCommitTakeoff}
          onClose={() => setTakeoffCategory(null)}
        />
      )}
      {takeoffCategory === "Generator" && activeProject && (
        <GeneratorTakeoffForm
          projectId={activeProject.id}
          defaultLaborRate={defaultLaborRate}
          sectionBreakdown={sectionBreakdown}
          onCommit={handleCommitTakeoff}
          onClose={() => setTakeoffCategory(null)}
        />
      )}
      {takeoffCategory === "Lighting Control" && activeProject && (
        <LightingControlTakeoffForm
          projectId={activeProject.id}
          defaultLaborRate={defaultLaborRate}
          sectionBreakdown={sectionBreakdown}
          onCommit={handleCommitTakeoff}
          onClose={() => setTakeoffCategory(null)}
        />
      )}
      {takeoffCategory === "Temporary Power" && activeProject && (
        <TempPowerTakeoffForm
          projectId={activeProject.id}
          defaultLaborRate={defaultLaborRate}
          sectionBreakdown={sectionBreakdown}
          onCommit={handleCommitTakeoff}
          onClose={() => setTakeoffCategory(null)}
        />
      )}
      {takeoffCategory === "Supports" && activeProject && (
        <SupportsTakeoffForm
          projectId={activeProject.id}
          defaultLaborRate={defaultLaborRate}
          sectionBreakdown={sectionBreakdown}
          onCommit={handleCommitTakeoff}
          onClose={() => setTakeoffCategory(null)}
        />
      )}
      {takeoffCategory === "Layout" && activeProject && (
        <LayoutTakeoffForm
          projectId={activeProject.id}
          defaultLaborRate={defaultLaborRate}
          sectionBreakdown={sectionBreakdown}
          onCommit={handleCommitTakeoff}
          onClose={() => setTakeoffCategory(null)}
        />
      )}
      {takeoffCategory === "Punch List" && activeProject && (
        <PunchListTakeoffForm
          projectId={activeProject.id}
          defaultLaborRate={defaultLaborRate}
          sectionBreakdown={sectionBreakdown}
          onCommit={handleCommitTakeoff}
          onClose={() => setTakeoffCategory(null)}
        />
      )}
      {takeoffCategory === "Miscellaneous Items" && activeProject && (
        <MiscTakeoffForm
          projectId={activeProject.id}
          defaultLaborRate={defaultLaborRate}
          sectionBreakdown={sectionBreakdown}
          onCommit={handleCommitTakeoff}
          onClose={() => setTakeoffCategory(null)}
        />
      )}
      {takeoffCategory === "Devices" && activeProject && (
        <DevicesTakeoffForm
          projectId={activeProject.id}
          defaultLaborRate={defaultLaborRate}
          sectionBreakdown={sectionBreakdown}
          onCommit={handleCommitTakeoff}
          onClose={() => setTakeoffCategory(null)}
        />
      )}

      {takeoffCategory === "HVAC / Equip Connections" && activeProject && (
        <EquipConnTakeoffForm
          projectId={activeProject.id}
          defaultLaborRate={defaultLaborRate}
          sectionBreakdown={sectionBreakdown}
          onCommit={handleCommitTakeoff}
          onClose={() => setTakeoffCategory(null)}
        />
      )}

      {takeoffCategory === "Specialty Items" && activeProject && (
        <SpecialtyTakeoffForm
          projectId={activeProject.id}
          defaultLaborRate={defaultLaborRate}
          sectionBreakdown={sectionBreakdown}
          onCommit={handleCommitTakeoff}
          onClose={() => setTakeoffCategory(null)}
        />
      )}

      {takeoffCategory === "Grounding" && activeProject && (
        <GroundingTakeoffForm
          projectId={activeProject.id}
          defaultLaborRate={defaultLaborRate}
          sectionBreakdown={sectionBreakdown}
          onCommit={handleCommitTakeoff}
          onClose={() => setTakeoffCategory(null)}
        />
      )}

      {showSavedAsm && activeProject && (
        <SavedAssembliesModal
          projectId={activeProject.id}
          defaultLaborRate={defaultLaborRate}
          sectionBreakdown={sectionBreakdown}
          onCommit={items => { handleCommitTakeoff(items); setShowSavedAsm(false); }}
          onClose={() => setShowSavedAsm(false)}
        />
      )}
      {showDbBackup && (
        <DatabaseBackupModal
          onClose={() => setShowDbBackup(false)}
        />
      )}
      {showProgramSetup && (
        <ProgramSetupModal
          onClose={() => setShowProgramSetup(false)}
          onSaved={() => { refreshSettings(); setShowProgramSetup(false); }}
        />
      )}
      {showChangeOrder && activeProject && (
        <ChangeOrderModal
          project={activeProject}
          defaultLaborRate={defaultLaborRate}
          onClose={() => setShowChangeOrder(false)}
          onCommitted={() => {
            setEditorKey(k => k + 1);
            refreshProjects();
          }}
          onOpenSubJob={async (id) => {
            setShowChangeOrder(false);
            await refreshProjects();
            handleOpenJob(id);
          }}
        />
      )}
      {showCommodity && (
        <CommoditySheetModal
          type={commodityModalType}
          onClose={() => setShowCommodity(false)}
          onUpdated={async (uploadedType) => {
            const pricing = await loadLivePricing(uploadedType);
            setLivePricing(pricing);
            setShowCommodity(false);
            // Auto-reprice active job if its commodity type matches what was just uploaded
            if (activeProject && (activeProject.commodity_type ?? "bid") === uploadedType) {
              const count = await repriceCommodityItems(activeProject.id, pricing);
              if (count > 0) {
                const updated = await getProject(activeProject.id);
                if (updated) setActiveProject(updated);
                setEditorRefreshTrigger(t => t + 1);
              }
            }
          }}
        />
      )}

      {zeroCostItems.length > 0 && (
        <ZeroCostDialog
          items={zeroCostItems}
          onResolve={(desc, asmId, resolution, newCost, quoteCat) =>
            handleZeroCostResolve(desc, asmId, resolution, newCost, quoteCat)
          }
          onDone={handleZeroCostDone}
        />
      )}

      {showCommodityAge && (
        <CommodityAgeDialog
          type={commodityAgeType}
          daysSince={commodityAgeDays}
          onClose={() => setShowCommodityAge(false)}
          onUploadNow={() => {
            setShowCommodityAge(false);
            setCommodityModalType(commodityAgeType);
            setShowCommodity(true);
          }}
        />
      )}

      {showRepricingPrompt && pendingOpenProject && activeProject && (
        <CommodityRepricingPrompt
          jobName={pendingOpenProject.name}
          type={(pendingOpenProject.commodity_type ?? "bid") as "bid" | "pco"}
          onReprice={() => handleRepricingConfirm(true)}
          onSkip={() => handleRepricingConfirm(false)}
        />
      )}

      {showProposalLetter && activeProject && (
        <ProposalLetterModal
          project={activeProject}
          onClose={() => setShowProposalLetter(false)}
        />
      )}

      {showPCOLetter && activeProject && (
        <PCOLetterModal
          project={activeProject}
          onClose={() => setShowPCOLetter(false)}
        />
      )}

      {modal === "exit" && (
        <ConfirmModal
          title="Exit Anmar Bid Pro"
          message="Are you sure you want to exit? All changes have been saved automatically."
          confirmLabel="Exit"
          onConfirm={handleExit}
          onCancel={() => setModal(null)}
        />
      )}

      <UpdateChecker />
    </div>
  );
}

function StatusCell({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.75)", fontFamily: "var(--font-mono)", ...style }}>
      {children}
    </span>
  );
}
