use tauri_plugin_sql::{Migration, MigrationKind};
use tauri::Manager;
use std::path::PathBuf;
use std::io::{Read, Write};

const ASSEMBLIES_SEED: &str = include_str!("../assemblies_seed.sql");
const SAVED_ASSEMBLIES_SEED: &str = include_str!("../saved_assemblies_seed.sql");
const PRE_BUILT_SEED: &str = include_str!("../pre_built_assemblies_seed.sql");
const GROUNDING_SEED: &str = include_str!("../grounding_seed.sql");
const FIX_FIRE_ALARM_SQL: &str =
    "UPDATE assemblies SET category='Fire Alarm', subcategory='Wire'      WHERE CAST(item_number AS INTEGER) BETWEEN 3113 AND 3155      AND category='Conduit / Wire Feeders';";

/// The proposal template is embedded directly in the binary at compile time.
const TEMPLATE_VERSION: &str = "v2";
const DEFAULT_PROPOSAL_TEMPLATE: &[u8] =
    include_bytes!("../Proposal_Letter_Template.docx");

/// The PCO (change order) template — embedded the same way.
const PCO_TEMPLATE_VERSION: &str = "v1";
const DEFAULT_PCO_TEMPLATE: &[u8] =
    include_bytes!("../PCO_Template.docx");


fn app_data_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path().app_data_dir()
        .map_err(|e| format!("Cannot locate app data dir: {}", e))
}

fn db_path(data_dir: &std::path::Path) -> PathBuf {
    data_dir.join("anmarbidpro.db")
}

fn template_path(data_dir: &std::path::Path) -> PathBuf {
    data_dir.join("proposal_template.docx")
}

fn pco_template_path(data_dir: &std::path::Path) -> PathBuf {
    data_dir.join("pco_template.docx")
}

fn delete_db(data_dir: &std::path::Path) {
    let base = db_path(data_dir).to_string_lossy().to_string();
    for suffix in &["", "-shm", "-wal"] {
        let p = PathBuf::from(format!("{}{}", base, suffix));
        if p.exists() { let _ = std::fs::remove_file(&p); }
    }
}

/// Save the uploaded proposal template bytes to app data dir
#[tauri::command]
async fn save_proposal_template(app: tauri::AppHandle, data: Vec<u8>) -> Result<String, String> {
    let data_dir = app_data_dir(&app)?;
    std::fs::create_dir_all(&data_dir)
        .map_err(|e| format!("Cannot create app data dir: {}", e))?;
    let path = template_path(&data_dir);
    std::fs::write(&path, &data)
        .map_err(|e| format!("Failed to save template: {}", e))?;
    Ok(path.to_string_lossy().to_string())
}

/// Check whether a proposal template has been saved
#[tauri::command]
async fn has_proposal_template(app: tauri::AppHandle) -> Result<bool, String> {
    let data_dir = app_data_dir(&app)?;
    Ok(template_path(&data_dir).exists())
}

/// Perform token substitution on the docx template and open the result in Word.
/// tokens: array of [token, value] pairs — matches JS array-of-arrays serialization
#[tauri::command]
async fn generate_proposal_letter(
    app: tauri::AppHandle,
    tokens: Vec<Vec<String>>,
    output_name: String,
) -> Result<String, String> {
    let data_dir = app_data_dir(&app)?;
    let template = template_path(&data_dir);

    if !template.exists() {
        return Err("No proposal template found. Please upload one in Program Setup.".into());
    }

    let template_bytes = std::fs::read(&template)
        .map_err(|e| format!("Cannot read template: {}", e))?;

    let cursor = std::io::Cursor::new(template_bytes);
    let mut zip_in = zip::ZipArchive::new(cursor)
        .map_err(|e| format!("Template is not a valid docx: {}", e))?;

    let mut out_buf: Vec<u8> = Vec::new();
    {
        let out_cursor = std::io::Cursor::new(&mut out_buf);
        let mut zip_out = zip::ZipWriter::new(out_cursor);

        for i in 0..zip_in.len() {
            let mut entry = zip_in.by_index(i)
                .map_err(|e| format!("Zip read error: {}", e))?;
            let name = entry.name().to_string();
            let options = zip::write::FileOptions::default()
                .compression_method(entry.compression())
                .unix_permissions(entry.unix_mode().unwrap_or(0o644));

            zip_out.start_file(&name, options)
                .map_err(|e| format!("Zip write error: {}", e))?;

            let is_xml = name.ends_with(".xml") || name.ends_with(".rels");
            if is_xml {
                let mut content = String::new();
                entry.read_to_string(&mut content)
                    .map_err(|e| format!("Cannot read {}: {}", name, e))?;

                for pair in &tokens {
                    if pair.len() == 2 {
                        content = content.replace(&pair[0], &pair[1]);
                    }
                }

                zip_out.write_all(content.as_bytes())
                    .map_err(|e| format!("Cannot write {}: {}", name, e))?;
            } else {
                let mut buf = Vec::new();
                entry.read_to_end(&mut buf)
                    .map_err(|e| format!("Cannot read {}: {}", name, e))?;
                zip_out.write_all(&buf)
                    .map_err(|e| format!("Cannot write {}: {}", name, e))?;
            }
        }

        zip_out.finish()
            .map_err(|e| format!("Cannot finalize docx: {}", e))?;
    }

    let temp_dir = std::env::temp_dir();
    let safe_name = output_name.replace(['/', '\\', ':', '*', '?', '"', '<', '>', '|'], "_");
    let out_path = temp_dir.join(format!("{}.docx", safe_name));
    std::fs::write(&out_path, &out_buf)
        .map_err(|e| format!("Cannot write output file: {}", e))?;

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/c", "start", "", &out_path.to_string_lossy()])
            .spawn()
            .map_err(|e| format!("Cannot open Word: {}", e))?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&out_path)
            .spawn()
            .map_err(|e| format!("Cannot open file: {}", e))?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&out_path)
            .spawn()
            .map_err(|e| format!("Cannot open file: {}", e))?;
    }

    Ok(out_path.to_string_lossy().to_string())
}

/// Generate PCO letter — same zip substitution logic but uses pco_template.docx
#[tauri::command]
async fn generate_pco_letter(
    app: tauri::AppHandle,
    tokens: Vec<Vec<String>>,
    output_name: String,
) -> Result<String, String> {
    let data_dir = app_data_dir(&app)?;
    let template = pco_template_path(&data_dir);

    if !template.exists() {
        return Err("No PCO template found.".into());
    }

    let template_bytes = std::fs::read(&template)
        .map_err(|e| format!("Cannot read PCO template: {}", e))?;

    let cursor = std::io::Cursor::new(template_bytes);
    let mut zip_in = zip::ZipArchive::new(cursor)
        .map_err(|e| format!("PCO template is not a valid docx: {}", e))?;

    let mut out_buf: Vec<u8> = Vec::new();
    {
        let out_cursor = std::io::Cursor::new(&mut out_buf);
        let mut zip_out = zip::ZipWriter::new(out_cursor);

        for i in 0..zip_in.len() {
            let mut entry = zip_in.by_index(i)
                .map_err(|e| format!("Zip read error: {}", e))?;
            let name = entry.name().to_string();
            let options = zip::write::FileOptions::default()
                .compression_method(entry.compression())
                .unix_permissions(entry.unix_mode().unwrap_or(0o644));

            zip_out.start_file(&name, options)
                .map_err(|e| format!("Zip write error: {}", e))?;

            if name.ends_with(".xml") || name.ends_with(".rels") {
                let mut content = String::new();
                entry.read_to_string(&mut content)
                    .map_err(|e| format!("Cannot read {}: {}", name, e))?;
                for pair in &tokens {
                    if pair.len() == 2 {
                        content = content.replace(&pair[0], &pair[1]);
                    }
                }
                zip_out.write_all(content.as_bytes())
                    .map_err(|e| format!("Cannot write {}: {}", name, e))?;
            } else {
                let mut buf = Vec::new();
                entry.read_to_end(&mut buf)
                    .map_err(|e| format!("Cannot read {}: {}", name, e))?;
                zip_out.write_all(&buf)
                    .map_err(|e| format!("Cannot write {}: {}", name, e))?;
            }
        }

        zip_out.finish()
            .map_err(|e| format!("Cannot finalize PCO docx: {}", e))?;
    }

    let temp_dir = std::env::temp_dir();
    let safe_name = output_name.replace(['/', '\\', ':', '*', '?', '"', '<', '>', '|'], "_");
    let out_path = temp_dir.join(format!("{}.docx", safe_name));
    std::fs::write(&out_path, &out_buf)
        .map_err(|e| format!("Cannot write output file: {}", e))?;

    #[cfg(target_os = "windows")]
    { std::process::Command::new("cmd").args(["/c", "start", "", &out_path.to_string_lossy()]).spawn().map_err(|e| format!("Cannot open Word: {}", e))?; }
    #[cfg(target_os = "macos")]
    { std::process::Command::new("open").arg(&out_path).spawn().map_err(|e| format!("Cannot open file: {}", e))?; }
    #[cfg(target_os = "linux")]
    { std::process::Command::new("xdg-open").arg(&out_path).spawn().map_err(|e| format!("Cannot open file: {}", e))?; }

    Ok(out_path.to_string_lossy().to_string())
}

#[tauri::command]
async fn get_database_path(app: tauri::AppHandle) -> Result<String, String> {
    app_data_dir(&app).map(|d| db_path(&d).to_string_lossy().to_string())
}

#[tauri::command]
async fn reset_database(app: tauri::AppHandle) -> Result<String, String> {
    let data_dir = app_data_dir(&app)?;
    delete_db(&data_dir);
    Ok("Database reset successfully.".to_string())
}

#[tauri::command]
async fn backup_database_dialog(app: tauri::AppHandle) -> Result<String, String> {
    use tauri_plugin_dialog::DialogExt;
    let data_dir = app_data_dir(&app)?;
    let src = db_path(&data_dir);
    let date = chrono::Local::now().format("%Y%m%d").to_string();
    let name = format!("AnmarBidPro_Backup_{}.db", date);
    match app.dialog().file()
        .set_title("Save Database Backup")
        .set_file_name(&name)
        .add_filter("SQLite Database", &["db"])
        .blocking_save_file()
    {
        Some(p) => {
            std::fs::copy(&src, p.to_string())
                .map_err(|e| format!("Backup failed: {}", e))?;
            Ok(format!("Backed up to: {}", p.to_string()))
        }
        None => Ok("cancelled".to_string()),
    }
}

#[tauri::command]
async fn save_csv_file(app: tauri::AppHandle, default_name: String, content: String) -> Result<String, String> {
    use tauri_plugin_dialog::DialogExt;
    match app.dialog().file()
        .set_title("Save CSV Export")
        .set_file_name(&default_name)
        .add_filter("CSV Spreadsheet", &["csv"])
        .add_filter("All Files", &["*"])
        .blocking_save_file()
    {
        Some(p) => {
            std::fs::write(p.to_string(), content.as_bytes())
                .map_err(|e| format!("Save failed: {}", e))?;
            Ok(format!("Saved to: {}", p.to_string()))
        }
        None => Ok("cancelled".to_string()),
    }
}

#[tauri::command]
async fn restore_database_dialog(app: tauri::AppHandle) -> Result<String, String> {
    use tauri_plugin_dialog::DialogExt;
    let data_dir = app_data_dir(&app)?;
    let dest = db_path(&data_dir);
    match app.dialog().file()
        .set_title("Select Backup File to Restore")
        .add_filter("SQLite Database", &["db"])
        .blocking_pick_file()
    {
        Some(p) => {
            let src = p.to_string();
            let header = std::fs::read(&src)
                .map_err(|e| format!("Cannot read file: {}", e))?;
            if header.len() < 16 || &header[0..16] != b"SQLite format 3\0" {
                return Err("Not a valid SQLite database.".into());
            }
            std::fs::copy(&src, &dest)
                .map_err(|e| format!("Restore failed: {}", e))?;
            Ok("Database restored. Please restart Anmar Bid Pro.".into())
        }
        None => Ok("cancelled".to_string()),
    }
}


// ── Migration checksum patcher ─────────────────────────────────────────────
// Seed SQL files may be modified after a DB is created. This patches stored
// SHA-384 checksums to match current files so existing DBs keep working.
fn patch_migration_checksums(db_path: &str) {
    let conn = match rusqlite::Connection::open(db_path) {
        Ok(c) => c,
        Err(_) => return,
    };

    // Check if _sqlx_migrations table exists
    let table_exists: bool = conn.query_row(
        "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='_sqlx_migrations'",
        [],
        |row| row.get::<_, i64>(0),
    ).unwrap_or(0) > 0;

    if !table_exists { return; }

    // version -> current SHA-384 hex of our SQL files
    let checksums: &[(i64, &str)] = &[
        (2, "9f9e4d55d192fa94dc4597a8dc6fbe73bf29494069322cb82d0fd7ca114a3024ab4c9b8a0c1a1ad9a7d0f4f057aa2ef9"),
        (5, "2c86a58b0ed3a8df253b6a7f100314d4b3130573fdf0b28059200721a0cfb77241fb86ad401f3b1c95ac3a6b74d9e0d4"),
        (6, "0dc3e183a125f44c7f714da502587be818bfebe60542c682b42ca8a427f3a9840c8c208f08d755920dfc67a6b277f0ad"),
        (8, "2c8b84defe2403c764ab26fb35f9632ef741cb4d04c7af526fdcc85ca5ea68995f147906408d1462ff4733982823e1a5"),
    ];

    for (version, hex) in checksums {
        let new_bytes: Vec<u8> = (0..hex.len()).step_by(2)
            .map(|i| u8::from_str_radix(&hex[i..i+2], 16).unwrap_or(0))
            .collect();
        let current: Option<Vec<u8>> = conn.query_row(
            "SELECT checksum FROM _sqlx_migrations WHERE version = ?1",
            rusqlite::params![version],
            |row| row.get(0),
        ).ok();
        if let Some(cur) = current {
            if cur != new_bytes {
                let _ = conn.execute(
                    "UPDATE _sqlx_migrations SET checksum = ?1 WHERE version = ?2",
                    rusqlite::params![new_bytes, version],
                );
            }
        }
    }
}

fn migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "create_initial_schema",
            sql: "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, name TEXT NOT NULL, client TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'draft', tax_rate REAL NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))); CREATE TABLE IF NOT EXISTS line_items (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE, category TEXT NOT NULL DEFAULT 'Miscellaneous Items', description TEXT NOT NULL, qty REAL NOT NULL DEFAULT 1, unit TEXT NOT NULL DEFAULT 'ea', unit_cost REAL NOT NULL DEFAULT 0, markup_pct REAL NOT NULL DEFAULT 0, labor_hours REAL NOT NULL DEFAULT 0, labor_rate REAL NOT NULL DEFAULT 85, assembly_id INTEGER, sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now'))); CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL); INSERT OR IGNORE INTO settings (key, value) VALUES ('company_name','Anmar Electric'),('company_phone',''),('company_email',''),('default_tax_rate','0'),('default_markup','20'),('currency_symbol','$'),('labor_rate','85.00');",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "seed_assemblies_catalog",
            sql: ASSEMBLIES_SEED,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "expand_projects_table",
            sql: "ALTER TABLE projects ADD COLUMN address TEXT NOT NULL DEFAULT ''; ALTER TABLE projects ADD COLUMN contact_name TEXT NOT NULL DEFAULT ''; ALTER TABLE projects ADD COLUMN contact_phone TEXT NOT NULL DEFAULT ''; ALTER TABLE projects ADD COLUMN contact_email TEXT NOT NULL DEFAULT ''; ALTER TABLE projects ADD COLUMN notes TEXT NOT NULL DEFAULT ''; ALTER TABLE projects ADD COLUMN bid_number TEXT NOT NULL DEFAULT ''; ALTER TABLE projects ADD COLUMN square_footage REAL NOT NULL DEFAULT 0;",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "custom_assemblies",
            sql: "CREATE TABLE IF NOT EXISTS custom_assemblies (id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL DEFAULT 'Custom', description TEXT NOT NULL DEFAULT '', items TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "seed_saved_assemblies",
            sql: SAVED_ASSEMBLIES_SEED,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 6,
            description: "seed_pre_built_assemblies",
            sql: PRE_BUILT_SEED,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 7,
            description: "fix_fire_alarm_category",
            sql: FIX_FIRE_ALARM_SQL,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 8,
            description: "seed_grounding_category",
            sql: GROUNDING_SEED,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 9,
            description: "delete_empty_saved_assemblies",
            sql: "DELETE FROM custom_assemblies WHERE json_array_length(items) = 0 OR items = '[]' OR items IS NULL OR items = '';",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 10,
            description: "add_actual_bid_price_to_projects",
            sql: "ALTER TABLE projects ADD COLUMN actual_bid_price REAL NOT NULL DEFAULT 0;",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 11,
            description: "add_labor_unit_to_line_items",
            sql: "ALTER TABLE line_items ADD COLUMN labor_unit TEXT NOT NULL DEFAULT 'E';",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 12,
            description: "backfill_labor_unit_from_assemblies",
            sql: "UPDATE line_items SET labor_unit = COALESCE(\
                (SELECT CASE a.labor_unit \
                    WHEN 'E' THEN 'E' WHEN 'C' THEN 'C' WHEN 'M' THEN 'M' \
                    WHEN 'L' THEN 'LF' WHEN 'c' THEN 'C' ELSE 'E' END \
                 FROM assemblies a WHERE a.id = line_items.assembly_id), \
                line_items.labor_unit) \
            WHERE assembly_id IS NOT NULL;",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 13,
            description: "fix_price_unit_from_assemblies",
            sql: "UPDATE line_items SET unit = COALESCE(\
                (SELECT CASE a.price_unit \
                    WHEN 'E' THEN 'E' WHEN 'C' THEN 'C' WHEN 'M' THEN 'M' \
                    WHEN 'L' THEN 'LF' WHEN 'P' THEN 'ls' WHEN 'c' THEN 'C' ELSE 'E' END \
                 FROM assemblies a WHERE a.id = line_items.assembly_id), \
                line_items.unit) \
            WHERE assembly_id IS NOT NULL;",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 14,
            description: "add_commodity_type_to_projects",
            sql: "ALTER TABLE projects ADD COLUMN commodity_type TEXT NOT NULL DEFAULT 'bid';",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 15,
            description: "fix_commodity_type_for_change_orders",
            sql: "UPDATE projects SET commodity_type = 'pco' WHERE description LIKE 'Change Order for:%';",
            kind: MigrationKind::Up,
        },
    ]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Patch migration checksums BEFORE the SQL plugin runs migrations.
    // This ensures existing databases with old seed checksums are updated
    // to match the current SQL files, preventing checksum mismatch errors.
    if let Some(data_dir) = dirs::data_dir() {
        let db_path = data_dir
            .join("com.anmarbidpro.app")
            .join("anmarbidpro.db");
        if db_path.exists() {
            patch_migration_checksums(db_path.to_str().unwrap_or(""));
        }
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:anmarbidpro.db", migrations())
                .build(),
        )
        .setup(|app| {
            if let Ok(data_dir) = app.path().app_data_dir() {
                let _ = std::fs::create_dir_all(&data_dir);
                // Proposal template
                let tmpl_path    = data_dir.join("proposal_template.docx");
                let version_path = data_dir.join("proposal_template.version");
                let installed_ver = std::fs::read_to_string(&version_path).unwrap_or_default();
                if !tmpl_path.exists() || installed_ver.trim() != TEMPLATE_VERSION {
                    if std::fs::write(&tmpl_path, DEFAULT_PROPOSAL_TEMPLATE).is_ok() {
                        let _ = std::fs::write(&version_path, TEMPLATE_VERSION);
                    }
                }
                // PCO template
                let pco_path    = data_dir.join("pco_template.docx");
                let pco_ver_path = data_dir.join("pco_template.version");
                let pco_installed = std::fs::read_to_string(&pco_ver_path).unwrap_or_default();
                if !pco_path.exists() || pco_installed.trim() != PCO_TEMPLATE_VERSION {
                    if std::fs::write(&pco_path, DEFAULT_PCO_TEMPLATE).is_ok() {
                        let _ = std::fs::write(&pco_ver_path, PCO_TEMPLATE_VERSION);
                    }
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_database_path,
            reset_database,
            backup_database_dialog,
            restore_database_dialog,
            save_csv_file,
            save_proposal_template,
            has_proposal_template,
            generate_proposal_letter,
            generate_pco_letter,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Anmar Bid Pro");
}
