# EstimatePro

A Windows desktop estimating application built with **Tauri 2.10.3**, **React 19.2**, and **SQLite** via `@tauri-apps/plugin-sql`.

---

## Features

- **Projects / Estimates** — create, edit, and track estimates with draft → sent → approved / rejected workflow
- **Line Items** — category, description, qty, unit, unit cost, markup %, per-line totals
- **Auto-save** — project header fields debounce-save automatically; line items save on every change
- **Totals footer** — live subtotal, tax, and grand total recalculated on every keystroke
- **Settings** — company name, phone, email, default tax rate, default markup, currency symbol
- **SQLite storage** — database lives at `%APPDATA%\com.estimatepro.app\estimatepro.db` (Windows)
- **Schema migrations** — handled by the Tauri SQL plugin via `lib.rs`

---

## Tech Stack

| Layer        | Technology                              | Version     |
|--------------|-----------------------------------------|-------------|
| Desktop shell| Tauri                                   | 2.10.3      |
| Frontend     | React                                   | 19.2.0      |
| Build tool   | Vite                                    | 6.x         |
| Language     | TypeScript                              | 5.x         |
| Database     | SQLite via `@tauri-apps/plugin-sql`     | 2.2.0       |
| Icons        | lucide-react                            | 0.511.0     |
| ID generation| uuid                                    | 11.x        |

---

## Prerequisites

### Windows

1. **Rust** (stable toolchain)
   ```powershell
   winget install Rustlang.Rustup
   rustup default stable
   ```

2. **Node.js 20+**
   ```powershell
   winget install OpenJS.NodeJS.LTS
   ```

3. **Microsoft C++ Build Tools** (required by Tauri on Windows)
   - Install [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
   - Select: **Desktop development with C++**

4. **WebView2 Runtime** — already pre-installed on Windows 10 (1803+) and Windows 11.
   If missing: https://developer.microsoft.com/en-us/microsoft-edge/webview2/

---

## Getting Started

```bash
# 1. Clone / unzip the project
cd estimator-app

# 2. Install Node dependencies
npm install

# 3. Run in development mode (hot-reload)
npm run tauri dev

# 4. Build a production installer
npm run tauri build
```

The production installer (`.msi` / `.exe`) will be output to:
```
src-tauri/target/release/bundle/
```

---

## Project Structure

```
estimator-app/
├── src/                         # React frontend
│   ├── main.tsx                 # React entry point
│   ├── App.tsx                  # Root component, routing, global state
│   ├── styles/
│   │   └── global.css           # Design system tokens & base styles
│   ├── hooks/
│   │   └── db.ts                # All SQLite queries + TypeScript types
│   ├── components/
│   │   ├── Sidebar.tsx          # Navigation sidebar
│   │   └── NewProjectModal.tsx  # Create project dialog
│   └── pages/
│       ├── Dashboard.tsx        # Summary stats + recent projects table
│       ├── ProjectEditor.tsx    # Full line-item editor
│       └── SettingsPage.tsx     # App settings form
│
├── src-tauri/                   # Rust / Tauri backend
│   ├── src/
│   │   ├── main.rs              # Windows entry point
│   │   └── lib.rs               # Plugin registration + migrations
│   ├── capabilities/
│   │   └── default.json         # Tauri 2 permission grants
│   ├── Cargo.toml               # Rust dependencies
│   ├── build.rs                 # Tauri build script
│   └── tauri.conf.json          # App config (name, window, bundle)
│
├── index.html                   # HTML shell
├── vite.config.ts               # Vite config
├── package.json
└── tsconfig.json
```

---

## Database

The database is managed entirely through `@tauri-apps/plugin-sql`.

### Location (Windows)
```
%APPDATA%\com.estimatepro.app\estimatepro.db
```

### Schema

```sql
-- Projects / Estimates
CREATE TABLE projects (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    client      TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    status      TEXT NOT NULL DEFAULT 'draft',  -- draft|sent|approved|rejected
    tax_rate    REAL NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Line items (cascade delete with project)
CREATE TABLE line_items (
    id          TEXT PRIMARY KEY,
    project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    category    TEXT NOT NULL DEFAULT 'Labor',
    description TEXT NOT NULL,
    qty         REAL NOT NULL DEFAULT 1,
    unit        TEXT NOT NULL DEFAULT 'ea',
    unit_cost   REAL NOT NULL DEFAULT 0,
    markup_pct  REAL NOT NULL DEFAULT 0,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Key/value settings store
CREATE TABLE settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
```

### Migrations

Migrations are defined in `src-tauri/src/lib.rs` and are automatically run by the plugin at startup:

```rust
let migrations = vec![
    Migration {
        version: 1,
        description: "create_initial_schema",
        sql: "...",
        kind: MigrationKind::Up,
    },
];
```

To add a future migration, append a new `Migration` with `version: 2`, etc.

---

## How the SQL Plugin Path Works

The path `sqlite:estimatepro.db` (relative, no leading `/`) is resolved by the plugin to:

| Platform | Resolved path                                           |
|----------|---------------------------------------------------------|
| Windows  | `%APPDATA%\{identifier}\estimatepro.db`                 |
| macOS    | `~/Library/Application Support/{identifier}/...`        |
| Linux    | `~/.config/{identifier}/...`                            |

Where `{identifier}` = `com.estimatepro.app` (set in `tauri.conf.json`).

An **absolute path** (e.g. `sqlite:/some/path/db.sqlite`) bypasses this and writes wherever specified.

---

## Customization

### Adding a new line item category
Edit `src/pages/ProjectEditor.tsx`:
```ts
const CATEGORIES = ["Labor", "Material", "Equipment", "Subcontractor", "Overhead", "Other", "YourNew"];
```

### Adding a new setting key
1. Add a seed row in the migration SQL in `lib.rs`
2. Add the field to `FIELDS` array in `src/pages/SettingsPage.tsx`

### Changing window size
Edit `src-tauri/tauri.conf.json`:
```json
"width": 1400,
"height": 900,
"minWidth": 1000,
"minHeight": 700
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `sql plugin not found` | Ensure `tauri-plugin-sql` is in `Cargo.toml` with `features = ["sqlite"]` |
| `permission denied` errors | Check `capabilities/default.json` includes `sql:allow-execute`, `sql:allow-select`, `sql:allow-load` |
| DB not found / not created | Confirm the `identifier` in `tauri.conf.json` matches; check `%APPDATA%` manually |
| White screen on startup | Run `npm run tauri dev` and check the Vite dev server is on port 1420 |
| Build fails on Windows | Ensure Visual C++ Build Tools are installed with the C++ workload |

---

## License

MIT
