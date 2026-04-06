#!/usr/bin/env python3
"""Pre-flight check — run before packaging any build. Usage: python preflight_check.py"""
import os, re, json, hashlib, sys

src   = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'src')
tauri = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'src-tauri')
issues = []

def fail(msg): issues.append(msg)

# 1 - Capabilities has SQL + dialog permissions
cap = json.load(open(os.path.join(tauri, 'capabilities', 'default.json')))
perms = cap.get('permissions', [])
for p in ['sql:default', 'sql:allow-load', 'sql:allow-select', 'sql:allow-execute',
          'dialog:allow-save', 'dialog:allow-open']:
    if p not in perms:
        fail(f"capabilities missing: {p}")

# 2 - No ALTER TABLE ADD COLUMN IF NOT EXISTS (unsupported in bundled SQLite)
lib = open(os.path.join(tauri, 'src', 'lib.rs')).read()
if re.search(r'ALTER TABLE\s+\w+\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS', lib):
    fail("lib.rs: ALTER TABLE ADD COLUMN IF NOT EXISTS is invalid in bundled SQLite")

# 3 - Migration 1 checksum constant matches actual SQL
m1  = re.search(r'version: 1,\s+description: "[^"]+",\s+sql: "([^"]+)"', lib, re.DOTALL)
cst = re.search(r'MIGRATION_1_CHECKSUM.*?"([a-f0-9]{64})"', lib)
if m1 and cst:
    actual = hashlib.sha256(m1.group(1).encode()).hexdigest()
    if actual != cst.group(1):
        fail(f"Migration 1 checksum mismatch (update MIGRATION_1_CHECKSUM in lib.rs)")

# 4 - All lucide icons used in JSX are imported
KNOWN = {
    "AlertCircle","Archive","ArrowLeft","BarChart2","Bell","BookOpen","Building",
    "Cable","CheckCircle","ChevronDown","ChevronRight","ChevronUp","Clock",
    "Database","DollarSign","Edit","FileCheck","FilePlus","FileText","FolderOpen",
    "GitBranch","Globe","Hash","HelpCircle","Layers","Lightbulb","List","LogOut",
    "Mail","Package","Percent","Phone","Plus","PlusCircle","Printer","RefreshCw",
    "RotateCcw","Save","Search","Send","Settings","Shield","Sliders","Trash2",
    "TrendingUp","Upload","Users","X","XCircle","Zap",
}
for root, dirs, files in os.walk(src):
    for fname in sorted(files):
        if not fname.endswith(".tsx"): continue
        c = open(os.path.join(root, fname)).read()
        imp = re.search(r'import\s*\{([^}]+)\}\s*from\s*"lucide-react"', c, re.DOTALL)
        if not imp: continue
        imported = set(i.strip() for i in imp.group(1).split(",") if i.strip())
        used     = set(re.findall(r'<([A-Z][a-zA-Z0-9]+)\s+size=', c))
        missing  = used - imported
        if missing:
            fail(f"{fname}: icons used but not imported: {missing}")
        risky = imported - KNOWN
        if risky:
            fail(f"{fname}: unverified lucide icons (may not exist): {risky}")

# 5 - App.tsx imports everything it uses from db.ts
app    = open(os.path.join(src, "App.tsx")).read()
db_src = open(os.path.join(src, "hooks", "db.ts")).read()
db_exports  = set(re.findall(r'^export async function (\w+)', db_src, re.MULTILINE))
db_exports |= set(re.findall(r'^export function (\w+)', db_src, re.MULTILINE))
db_imp_m = re.search(r'import\s*\{([^}]+)\}\s*from\s*"./hooks/db"', app, re.DOTALL)
if db_imp_m:
    db_imported = set(i.strip().replace("type ", "").split(" as ")[0].strip()
                      for i in db_imp_m.group(1).split(",") if i.strip())
    for fn in db_exports:
        if re.search(r'\b' + fn + r'\b', app) and fn not in db_imported:
            fail(f"App.tsx uses \'{fn}\' from db.ts but does not import it")

# 6 - MenuBar: every onXxx used in JSX body is in the destructured params
mb       = open(os.path.join(src, "components", "MenuBar.tsx")).read()
params_m = re.search(r'export default function MenuBar\(\{([^}]*)\}', mb, re.DOTALL)
if params_m:
    destructured = set(re.findall(r'\b(\w+)\b', params_m.group(1)))
    body_start   = mb.find("{", params_m.end())
    body         = mb[body_start:]
    used = set(re.findall(r'\b(on[A-Z]\w+)\b', body))
    builtin = {"onClick","onChange","onMouseEnter","onMouseLeave","onMouseDown","onMouseUp"}
    missing = used - destructured - builtin
    if missing:
        fail(f"MenuBar.tsx: used in JSX but not destructured: {missing}")

# 7 - Brace balance in all source files
for root, dirs, files in os.walk(src):
    for fname in sorted(files):
        if not fname.endswith((".tsx", ".ts")): continue
        c = open(os.path.join(root, fname)).read()
        o, cl = c.count("{"), c.count("}")
        if o != cl:
            fail(f"{fname}: unbalanced braces {o}/{cl}")

# Report
print()
print("=" * 60)
if issues:
    print(f"FAILED — {len(issues)} issue(s) found — fix before packaging:")
    print("=" * 60)
    for i in issues: print(f"  • {i}")
else:
    print("✅  All checks passed — safe to package")
    print("=" * 60)
print()
sys.exit(1 if issues else 0)
