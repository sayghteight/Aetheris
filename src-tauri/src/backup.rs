use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use chrono::Local;
use tauri::{AppHandle, State};

/// Track last backup time per project (in-memory, resets on restart)
/// This is a simple mechanism to avoid creating too many backups
static LAST_BACKUP_TIME: AtomicU64 = AtomicU64::new(0);

/// Minimum interval between automatic backups in seconds (default: 5 minutes)
const MIN_BACKUP_INTERVAL_SECS: u64 = 300;

#[derive(Serialize, Deserialize, Clone)]
pub struct BackupSettings {
    pub enabled: bool,
    pub folder_path: Option<String>,
    pub max_backups: i32,
    pub incremental: bool,
}

impl Default for BackupSettings {
    fn default() -> Self {
        Self {
            enabled: true,
            folder_path: None,
            max_backups: 25,
            incremental: false,
        }
    }
}

/// Returns the current timestamp as seconds since Unix epoch
fn current_timestamp_secs() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

/// Check if automatic backup should be created based on time interval
/// Returns true if enough time has passed since last auto-backup
pub fn should_create_auto_backup() -> bool {
    let now = current_timestamp_secs();
    let last = LAST_BACKUP_TIME.load(Ordering::SeqCst);

    // Always allow if never backed up or first time
    if last == 0 {
        return true;
    }

    now.saturating_sub(last) >= MIN_BACKUP_INTERVAL_SECS
}

/// Record that an auto-backup was just performed
pub fn record_auto_backup() {
    let now = current_timestamp_secs();
    LAST_BACKUP_TIME.store(now, Ordering::SeqCst);
}

#[derive(Serialize, Deserialize, Clone)]
pub struct BackupInfo {
    pub name: String,
    pub path: String,
    pub created_at: String,
    pub size_bytes: u64,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct OldBackupInfo {
    pub name: String,
    pub path: String,
}

/// Get backup settings from project database
pub fn get_backup_settings(conn: &Connection) -> Result<BackupSettings, String> {
    let mut stmt = conn
        .prepare("SELECT enabled, folder_path, max_backups, incremental FROM backup_settings WHERE id = 'default' LIMIT 1;")
        .map_err(|e| e.to_string())?;

    let settings = stmt
        .query_row([], |row| {
            Ok(BackupSettings {
                enabled: row.get::<_, i32>(0)? != 0,
                folder_path: row.get(1)?,
                max_backups: row.get(2)?,
                incremental: row.get::<_, i32>(3)? != 0,
            })
        })
        .unwrap_or_else(|_| BackupSettings::default());

    Ok(settings)
}

/// Save backup settings to project database
pub fn save_backup_settings(conn: &Connection, settings: &BackupSettings) -> Result<BackupSettings, String> {
    conn.execute(
        "INSERT INTO backup_settings (id, enabled, folder_path, max_backups, incremental, updated_at)
         VALUES ('default', ?1, ?2, ?3, ?4, CURRENT_TIMESTAMP)
         ON CONFLICT(id) DO UPDATE SET
            enabled = excluded.enabled,
            folder_path = excluded.folder_path,
            max_backups = excluded.max_backups,
            incremental = excluded.incremental,
            updated_at = CURRENT_TIMESTAMP;",
        (
            if settings.enabled { 1 } else { 0 },
            &settings.folder_path,
            settings.max_backups,
            if settings.incremental { 1 } else { 0 },
        ),
    )
    .map_err(|e| format!("Error guardando configuración de backups: {}", e))?;

    Ok(settings.clone())
}

/// Get the backup folder path for a project
pub fn get_backup_folder(project_path: &Path, settings: &BackupSettings) -> Result<PathBuf, String> {
    let backup_folder = match &settings.folder_path {
        Some(path) => PathBuf::from(path),
        None => {
            // Default: backups/ subfolder next to the project file
            project_path
                .parent()
                .ok_or("No se pudo obtener el directorio del proyecto")?
                .join("backups")
        }
    };

    // Create folder if it doesn't exist
    if !backup_folder.exists() {
        fs::create_dir_all(&backup_folder)
            .map_err(|e| format!("No se pudo crear la carpeta de backups: {}", e))?;
    }

    Ok(backup_folder)
}

/// Generate backup filename with timestamp
pub fn generate_backup_name(project_path: &Path) -> String {
    let project_name = project_path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("proyecto");

    let timestamp = Local::now().format("%Y-%m-%d_%H-%M-%S");

    format!("{}_{}.aer.bak", project_name, timestamp)
}

/// Create a backup of the current project
pub fn create_backup(
    project_path: &Path,
    settings: &BackupSettings,
) -> Result<BackupInfo, String> {
    if !settings.enabled {
        return Err("Los backups están desactivados".to_string());
    }

    if !project_path.exists() {
        return Err("El archivo del proyecto no existe".to_string());
    }

    let backup_folder = get_backup_folder(project_path, settings)?;
    let backup_name = generate_backup_name(project_path);
    let backup_path = backup_folder.join(&backup_name);

    // Secure backup: write to temp file first, then rename
    let temp_dir = std::env::temp_dir();
    let temp_path = temp_dir.join(format!("{}.tmp", backup_name));

    // Copy to temp location
    fs::copy(project_path, &temp_path)
        .map_err(|e| format!("No se pudo crear el backup: {}", e))?;

    // Verify copy by checking file size
    let original_size = fs::metadata(project_path)
        .map_err(|e| format!("No se pudo verificar el archivo original: {}", e))?
        .len();
    let temp_size = fs::metadata(&temp_path)
        .map_err(|e| format!("No se pudo verificar el backup temporal: {}", e))?
        .len();

    if original_size != temp_size {
        fs::remove_file(&temp_path).ok();
        return Err("El backup no se copió correctamente".to_string());
    }

    // Move to final location (copy + delete, more reliable across filesystems)
    if let Err(e) = fs::copy(&temp_path, &backup_path) {
        fs::remove_file(&temp_path).ok();
        return Err(format!("No se pudo copiar el backup a su ubicación final: {}", e));
    }
    fs::remove_file(&temp_path).ok();

    // Rotation: delete old backups if needed
    rotate_backups(project_path, settings)?;

    let metadata = fs::metadata(&backup_path)
        .map_err(|e| format!("No se pudo obtener información del backup: {}", e))?;

    Ok(BackupInfo {
        name: backup_name,
        path: backup_path.to_string_lossy().to_string(),
        created_at: Local::now().to_rfc3339(),
        size_bytes: metadata.len(),
    })
}

/// Rotate backups, keeping only max_backups most recent
fn rotate_backups(project_path: &Path, settings: &BackupSettings) -> Result<(), String> {
    if settings.max_backups < 0 {
        return Ok(()); // Unlimited
    }

    let backup_folder = get_backup_folder(project_path, settings)?;
    let project_name = project_path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("proyecto");

    // Collect all backup files matching our pattern
    let mut backups: Vec<(PathBuf, chrono::DateTime<chrono::Local>)> = Vec::new();

    if let Ok(entries) = fs::read_dir(&backup_folder) {
        for entry in entries.filter_map(|e| e.ok()) {
            let path = entry.path();
            if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                // Match: projectname_YYYY-MM-DD_HH-MM-SS.aer.bak
                if name.starts_with(&format!("{}_", project_name)) && name.ends_with(".aer.bak") {
                    if let Ok(metadata) = entry.metadata() {
                        if let Ok(modified) = metadata.modified() {
                            let modified: chrono::DateTime<chrono::Local> = modified.into();
                            backups.push((path, modified));
                        }
                    }
                }
            }
        }
    }

    // Sort by modification time, newest first
    backups.sort_by(|a, b| b.1.cmp(&a.1));

    // Delete oldest if over limit
    let max = settings.max_backups as usize;
    for (path, _) in backups.into_iter().skip(max) {
        if let Err(e) = fs::remove_file(&path) {
            eprintln!("No se pudo eliminar backup antiguo {}: {}", path.display(), e);
        }
    }

    Ok(())
}

/// List all backups in the backup folder
pub fn list_backups(project_path: &Path, settings: &BackupSettings) -> Result<Vec<BackupInfo>, String> {
    let backup_folder = get_backup_folder(project_path, settings)?;
    let project_name = project_path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("proyecto");

    let mut backups: Vec<BackupInfo> = Vec::new();

    if let Ok(entries) = fs::read_dir(&backup_folder) {
        for entry in entries.filter_map(|e| e.ok()) {
            let path = entry.path();
            if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                if name.starts_with(&format!("{}_", project_name)) && name.ends_with(".aer.bak") {
                    if let Ok(metadata) = entry.metadata() {
                        let modified: chrono::DateTime<chrono::Local> = metadata.modified()
                            .map(|t| t.into())
                            .unwrap_or_else(|_| chrono::Local::now());

                        backups.push(BackupInfo {
                            name: name.to_string(),
                            path: path.to_string_lossy().to_string(),
                            created_at: modified.to_rfc3339(),
                            size_bytes: metadata.len(),
                        });
                    }
                }
            }
        }
    }

    // Sort by creation time, newest first
    backups.sort_by(|a, b| b.created_at.cmp(&a.created_at));

    Ok(backups)
}

/// Delete a specific backup
pub fn delete_backup(backup_path: &Path) -> Result<(), String> {
    if backup_path.exists() {
        fs::remove_file(backup_path)
            .map_err(|e| format!("No se pudo eliminar el backup: {}", e))?;
    }
    Ok(())
}

/// Verify backup integrity by opening as SQLite
pub fn verify_backup(backup_path: &Path) -> Result<bool, String> {
    if !backup_path.exists() {
        return Err("El archivo de backup no existe".to_string());
    }

    // Try to open as SQLite database and do a simple query
    match Connection::open_with_flags(backup_path, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY) {
        Ok(conn) => {
            // Simple query to verify database is readable
            match conn.query_row("SELECT 1", [], |_| Ok(())) {
                Ok(_) => Ok(true),
                Err(e) => {
                    eprintln!("Backup verification failed: {}", e);
                    Ok(false)
                }
            }
        }
        Err(e) => {
            eprintln!("Backup open failed: {}", e);
            Ok(false)
        }
    }
}

/// Restore a backup, optionally creating a backup of current state first
pub fn restore_backup(
    project_path: &Path,
    backup_path: &Path,
    create_current_backup: bool,
    settings: &BackupSettings,
) -> Result<(), String> {
    if !backup_path.exists() {
        return Err("El archivo de backup no existe".to_string());
    }

    // Verify backup is valid
    if !verify_backup(backup_path)? {
        return Err("El archivo de backup está corrupto o no es válido".to_string());
    }

    // Create backup of current state if requested
    if create_current_backup && project_path.exists() {
        create_backup(project_path, settings)?;
    }

    // Secure restore: copy to temp, then replace
    let temp_dir = std::env::temp_dir();
    let temp_path = temp_dir.join("restore_temp.aer");

    fs::copy(backup_path, &temp_path)
        .map_err(|e| format!("No se pudo copiar el backup: {}", e))?;

    // Verify copy
    let backup_size = fs::metadata(backup_path)
        .map_err(|e| format!("No se pudo verificar el backup: {}", e))?
        .len();
    let temp_size = fs::metadata(&temp_path)
        .map_err(|e| format!("No se pudo verificar la copia temporal: {}", e))?
        .len();

    if backup_size != temp_size {
        fs::remove_file(&temp_path).ok();
        return Err("La copia del backup no es correcta".to_string());
    }

    // Replace project file
    fs::copy(&temp_path, project_path)
        .map_err(|e| format!("No se pudo restaurar el backup: {}", e))?;
    fs::remove_file(&temp_path).ok();

    Ok(())
}

/// Detect old-style backups (proyecto.aer.bak, .bak.2, etc.)
pub fn detect_old_backups(project_path: &Path) -> Result<Vec<OldBackupInfo>, String> {
    let parent = project_path
        .parent()
        .ok_or("No se pudo obtener el directorio del proyecto")?;

    let project_stem = project_path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("proyecto");

    let mut old_backups: Vec<OldBackupInfo> = Vec::new();

    if let Ok(entries) = fs::read_dir(parent) {
        for entry in entries.filter_map(|e| e.ok()) {
            let path = entry.path();
            if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                // Match .aer.bak, .aer.bak.2, .aer.bak.3, etc.
                if name.starts_with(&format!("{}.aer.bak", project_stem)) {
                    if let Ok(_metadata) = entry.metadata() {
                        old_backups.push(OldBackupInfo {
                            name: name.to_string(),
                            path: path.to_string_lossy().to_string(),
                        });
                    }
                }
            }
        }
    }

    // Sort by name (which includes the index)
    old_backups.sort_by(|a, b| a.name.cmp(&b.name));

    Ok(old_backups)
}

/// Migrate old backups to new backup folder
pub fn migrate_old_backups(
    project_path: &Path,
    old_backup_paths: Vec<String>,
    settings: &BackupSettings,
) -> Result<Vec<BackupInfo>, String> {
    let backup_folder = get_backup_folder(project_path, settings)?;
    let project_name = project_path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("proyecto");

    let mut migrated: Vec<BackupInfo> = Vec::new();

    for old_path_str in old_backup_paths {
        let old_path = Path::new(&old_path_str);
        if !old_path.exists() {
            continue;
        }

        // Generate new name with timestamp from file modification
        let modified: chrono::DateTime<chrono::Local> = fs::metadata(&old_path)
            .and_then(|m| m.modified())
            .map(|t| t.into())
            .unwrap_or_else(|_| chrono::Local::now());

        let timestamp = modified.format("%Y-%m-%d_%H-%M-%S");
        let new_name = format!("{}_{}.aer.bak", project_name, timestamp);
        let new_path = backup_folder.join(&new_name);

        // Copy to new location
        if let Err(e) = fs::copy(&old_path, &new_path) {
            eprintln!("No se pudo migrar {}: {}", old_path.display(), e);
            continue;
        }

        // Verify and add to list
        if let Ok(metadata) = fs::metadata(&new_path) {
            migrated.push(BackupInfo {
                name: new_name,
                path: new_path.to_string_lossy().to_string(),
                created_at: modified.to_rfc3339(),
                size_bytes: metadata.len(),
            });
        }
    }

    Ok(migrated)
}

// ─── Tauri Commands ──────────────────────────────────────────────────────────────

use crate::state::AppState;

#[tauri::command]
pub fn get_backup_settings_cmd(state: State<'_, AppState>) -> Result<BackupSettings, String> {
    let db_guard = state.db.lock().map_err(|_| "Error bloqueando estado")?;
    let conn = db_guard.as_ref().ok_or("No hay proyecto abierto")?;
    get_backup_settings(conn)
}

#[tauri::command]
pub fn update_backup_settings_cmd(
    state: State<'_, AppState>,
    settings: BackupSettings,
) -> Result<BackupSettings, String> {
    let db_guard = state.db.lock().map_err(|_| "Error bloqueando estado")?;
    let conn = db_guard.as_ref().ok_or("No hay proyecto abierto")?;
    save_backup_settings(conn, &settings)
}

#[tauri::command]
pub fn create_backup_cmd(
    state: State<'_, AppState>,
    project_path: String,
) -> Result<BackupInfo, String> {
    let path = Path::new(&project_path);
    let db_guard = state.db.lock().map_err(|_| "Error bloqueando estado")?;
    let conn = db_guard.as_ref().ok_or("No hay proyecto abierto")?;

    let settings = get_backup_settings(conn)?;
    create_backup(path, &settings)
}

#[tauri::command]
pub fn get_backups_cmd(
    state: State<'_, AppState>,
    project_path: String,
) -> Result<Vec<BackupInfo>, String> {
    let path = Path::new(&project_path);
    let db_guard = state.db.lock().map_err(|_| "Error bloqueando estado")?;
    let conn = db_guard.as_ref().ok_or("No hay proyecto abierto")?;

    let settings = get_backup_settings(conn)?;
    list_backups(path, &settings)
}

#[tauri::command]
pub fn delete_backup_cmd(backup_path: String) -> Result<(), String> {
    let path = Path::new(&backup_path);
    delete_backup(path)
}

#[tauri::command]
pub fn restore_backup_cmd(
    state: State<'_, AppState>,
    project_path: String,
    backup_path: String,
    create_current_backup: bool,
) -> Result<(), String> {
    let proj_path = Path::new(&project_path);
    let bak_path = Path::new(&backup_path);

    let db_guard = state.db.lock().map_err(|_| "Error bloqueando estado")?;
    let conn = db_guard.as_ref().ok_or("No hay proyecto abierto")?;

    let settings = get_backup_settings(conn)?;
    restore_backup(proj_path, bak_path, create_current_backup, &settings)
}

#[tauri::command]
pub fn verify_backup_cmd(backup_path: String) -> Result<bool, String> {
    let path = Path::new(&backup_path);
    verify_backup(path)
}

#[tauri::command]
pub fn detect_old_backups_cmd(project_path: String) -> Result<Vec<OldBackupInfo>, String> {
    let path = Path::new(&project_path);
    detect_old_backups(path)
}

#[tauri::command]
pub fn migrate_old_backups_cmd(
    state: State<'_, AppState>,
    project_path: String,
    old_backup_paths: Vec<String>,
) -> Result<Vec<BackupInfo>, String> {
    let proj_path = Path::new(&project_path);

    let db_guard = state.db.lock().map_err(|_| "Error bloqueando estado")?;
    let conn = db_guard.as_ref().ok_or("No hay proyecto abierto")?;

    let settings = get_backup_settings(conn)?;
    migrate_old_backups(proj_path, old_backup_paths, &settings)
}

#[tauri::command]
pub fn pick_backup_folder_cmd(app: AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;

    let folder = app.dialog().file().blocking_pick_folder();

    Ok(folder.map(|p| p.to_string()))
}

#[tauri::command]
pub fn open_backup_folder_cmd(project_path: String) -> Result<(), String> {
    let path = Path::new(&project_path);
    let parent = path.parent().ok_or("No se pudo obtener el directorio")?;
    let backup_folder = parent.join("backups");

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(backup_folder)
            .spawn()
            .map_err(|e| format!("No se pudo abrir la carpeta: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(backup_folder)
            .spawn()
            .map_err(|e| format!("No se pudo abrir la carpeta: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(backup_folder)
            .spawn()
            .map_err(|e| format!("No se pudo abrir la carpeta: {}", e))?;
    }

    Ok(())
}

/// Command to create an automatic backup (called from auto-save)
/// This respects the incremental backup settings and time intervals
#[tauri::command]
pub fn create_auto_backup_cmd(
    state: State<'_, AppState>,
    project_path: String,
) -> Result<Option<BackupInfo>, String> {
    let path = Path::new(&project_path);
    let db_guard = state.db.lock().map_err(|_| "Error bloqueando estado")?;
    let conn = db_guard.as_ref().ok_or("No hay proyecto abierto")?;

    let settings = get_backup_settings(conn)?;

    // Check if backups are enabled
    if !settings.enabled {
        return Ok(None);
    }

    // For incremental mode, check if enough time has passed
    if settings.incremental && !should_create_auto_backup() {
        return Ok(None);
    }

    // Create the backup
    match create_backup(path, &settings) {
        Ok(backup_info) => {
            // Record that we created a backup (for incremental mode)
            record_auto_backup();
            Ok(Some(backup_info))
        }
        Err(e) => Err(e),
    }
}
