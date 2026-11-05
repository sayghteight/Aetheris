//! Copias de seguridad centralizadas y snapshots de los proyectos.
//!
//! Antes, cada vez que se abria un proyecto se copiaba el archivo `.aer` a
//! `proyecto.aer.bak`, `proyecto.aer.bak.1`, `proyecto.aer.bak.2`... junto al
//! propio proyecto, lo que hacia crecer el numero de archivos sin limite y
//! dejaba el estado anterior disperso por el disco.
//!
//! Este modulo sustituye ese sistema por uno centralizado, con dos
//! responsabilidades separadas:
//!
//! * **Backup principal**: un unico archivo por proyecto que se actualiza
//!   solo (de forma atomica) con el estado mas reciente. No genera
//!   historiales.
//! * **Snapshots**: puntos de restauracion historicos que solo crea el
//!   usuario de forma explicita. Cada uno se conserva y nunca se
//!   sobrescribe.
//!
//! La estructura en disco es:
//!
//! ```text
//! {config}/aetheria/backups/
//! └── {id_del_proyecto}/
//!     ├── project_backup.aer      <- backup principal (se sobrescribe)
//!     ├── project.json            <- datos del proyecto y fechas
//!     └── snapshots/
//!         ├── snapshot_001/
//!         │   ├── project.aer
//!         │   └── snapshot.json
//!         └── snapshot_002/
//!             ├── project.aer
//!             └── snapshot.json
//! ```

use std::fs;
use std::path::{Path, PathBuf};

use rusqlite::{Connection, OpenFlags};
use serde::{Deserialize, Serialize};

/// Nombre del archivo de backup principal dentro de la carpeta del proyecto.
pub const MAIN_BACKUP_FILE: &str = "project_backup.aer";
/// Nombre del archivo de base de datos dentro de cada snapshot.
pub const SNAPSHOT_FILE: &str = "project.aer";
/// Nombre del archivo con los datos del proyecto.
pub const PROJECT_INFO_FILE: &str = "project.json";
/// Nombre del archivo con los datos de un snapshot.
pub const SNAPSHOT_INFO_FILE: &str = "snapshot.json";
/// Subcarpeta que agrupa los snapshots.
pub const SNAPSHOTS_DIR: &str = "snapshots";

/// Datos del proyecto abierto.
///
/// Permiten asociar los backups y snapshots a su carpeta propia y saber si
/// hay cambios en la base de datos que todavia no se han respaldado.
#[derive(Clone, Debug)]
pub struct ProjectContext {
    /// Identificador estable del proyecto (UUID de `project_metadata`).
    pub project_id: String,
    /// Titulo del proyecto, para identificar la carpeta a olho.
    pub title: String,
    /// Ruta del archivo `.aer` del proyecto.
    pub project_path: PathBuf,
    /// Carpeta raiz donde viven los backups de todos los proyectos.
    pub backups_root: PathBuf,
    /// Valor de `total_changes` de la conexion en el ultimo backup.
    pub last_backed_up_changes: u64,
}

impl ProjectContext {
    /// Contexto nuevo: todavia no se ha respaldado nada de este proyecto.
    pub fn new(project_id: String, title: String, project_path: PathBuf) -> Self {
        let backups_root = backups_root().unwrap_or_default();
        Self::with_root(project_id, title, project_path, backups_root)
    }

    /// Contexto con una raiz de backups concreta.
    ///
    /// Las pruebas la usan para no tocar la carpeta real del usuario.
    pub fn with_root(
        project_id: String,
        title: String,
        project_path: PathBuf,
        backups_root: PathBuf,
    ) -> Self {
        Self {
            project_id,
            title,
            project_path,
            backups_root,
            // Ningun valor real de `total_changes` podria coincidir con este,
            // asi que el primer ciclo de guardado se dispara siempre.
            last_backed_up_changes: u64::MAX,
        }
    }
}

/// Informacion de un snapshot, tal y como se muestra en la interfaz.
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotInfo {
    /// Identificador del snapshot (`snapshot_001`).
    pub id: String,
    /// Texto legible: numero y fecha de creacion.
    pub label: String,
    /// Fecha de creacion en ISO 8601.
    pub created_at: String,
    /// Tamano del archivo de base de datos, en bytes.
    pub size: u64,
    /// Ruta del archivo `.aer` del snapshot.
    pub path: String,
}

/// Estado del sistema de copias de seguridad de un proyecto.
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct BackupStatus {
    /// Ruta de la carpeta que contiene los backups del proyecto.
    pub backup_dir: String,
    /// Ruta del archivo de backup principal.
    pub main_backup_path: String,
    /// Si el backup principal existe.
    pub main_backup_exists: bool,
    /// Fecha de la ultima actualizacion del backup principal.
    pub last_backup_at: Option<String>,
    /// Numero de snapshots guardados.
    pub snapshot_count: usize,
}

/// Resultado de la migracion de los backups del sistema antiguo.
#[derive(Serialize, Deserialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct LegacyMigration {
    /// Cuantos archivos `.bak` se han encontrado junto al proyecto.
    pub found: usize,
    /// Si se ha migrado alguno al backup principal.
    pub migrated: bool,
    /// Cuantos archivos se han eliminado del directorio del proyecto.
    pub removed: usize,
}

/// Raiz de todos los backups: `{config}/aetheria/backups`.
pub fn backups_root() -> Result<PathBuf, String> {
    let root = crate::commands::get_config_dir()?.join("backups");
    fs::create_dir_all(&root)
        .map_err(|e| format!("No se pudo crear la carpeta de copias de seguridad: {}", e))?;
    Ok(root)
}

/// Carpeta propia de un proyecto dentro de la raiz de backups.
pub fn project_backup_dir(ctx: &ProjectContext) -> Result<PathBuf, String> {
    let dir = ctx.backups_root.join(sanitize_id(&ctx.project_id));
    fs::create_dir_all(&dir)
        .map_err(|e| format!("No se pudo crear la carpeta de copias de seguridad: {}", e))?;
    Ok(dir)
}

/// Subcarpeta de snapshots de un proyecto.
pub fn snapshots_dir(ctx: &ProjectContext) -> Result<PathBuf, String> {
    let dir = project_backup_dir(ctx)?.join(SNAPSHOTS_DIR);
    fs::create_dir_all(&dir)
        .map_err(|e| format!("No se pudo crear la carpeta de snapshots: {}", e))?;
    Ok(dir)
}

/// Ruta del backup principal de un proyecto.
pub fn main_backup_path(ctx: &ProjectContext) -> Result<PathBuf, String> {
    Ok(project_backup_dir(ctx)?.join(MAIN_BACKUP_FILE))
}

/// Elimina del identificador cualquier caracter que no sea seguro en una
/// ruta, para que un id manipulado no pueda escapar de la carpeta de backups.
fn sanitize_id(id: &str) -> String {
    let clean: String = id
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect();
    if clean.is_empty() {
        "proyecto".to_string()
    } else {
        clean
    }
}

/// Valida que un identificador de snapshot no pueda salirse de su carpeta.
fn sanitize_snapshot_id(id: &str) -> Result<String, String> {
    let clean = sanitize_id(id);
    if clean != id || !id.starts_with("snapshot_") {
        return Err("El identificador del snapshot no es valido".to_string());
    }
    Ok(clean)
}

/// Fecha actual en ISO 8601 (UTC).
fn now_iso() -> String {
    chrono::Utc::now().to_rfc3339()
}

/// Escapa una ruta para incrustarla en una sentencia SQL.
fn sql_path(path: &Path) -> String {
    path.to_string_lossy().replace('\'', "''")
}

/// Copia consistente de la base de datos.
///
/// Se usa `VACUUM INTO`, que genera un archivo nuevo y compacto a partir de
/// una imagen coherente de la base de datos. A diferencia de copiar el
/// archivo a pelo, esto funciona igual con la base de datos en modo WAL y
/// nunca deja un archivo a medio escribir.
fn write_database_copy(conn: &Connection, dest: &Path) -> Result<(), String> {
    let parent = dest
        .parent()
        .ok_or("Ruta de copia de seguridad no valida".to_string())?;
    fs::create_dir_all(parent)
        .map_err(|e| format!("No se pudo crear la carpeta de la copia de seguridad: {}", e))?;

    let file_name = dest
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or("Ruta de copia de seguridad no valida".to_string())?;
    let tmp = parent.join(format!(".{}.tmp", file_name));
    let _ = fs::remove_file(&tmp);

    conn.execute_batch(&format!("VACUUM INTO '{}';", sql_path(&tmp)))
        .map_err(|e| format!("No se pudo generar la copia de seguridad: {}", e))?;

    replace_atomically(&tmp, dest)
}

/// Sustituye `dest` por `tmp` de forma segura.
///
/// En Windows `fs::rename` no pisa el destino si ya existe, asi que el
/// archivo antiguo se aparta a un temporal y se vuelve a poner en su sitio si
/// la operacion falla. Asi el destino conserva siempre una version valida.
pub fn replace_atomically(tmp: &Path, dest: &Path) -> Result<(), String> {
    let parent = dest
        .parent()
        .ok_or("Ruta de copia de seguridad no valida".to_string())?;
    let file_name = dest
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or("Ruta de copia de seguridad no valida".to_string())?;
    let old = parent.join(format!(".{}.old", file_name));
    let _ = fs::remove_file(&old);

    let had_dest = dest.exists();
    if had_dest {
        fs::rename(dest, &old).map_err(|e| {
            let _ = fs::remove_file(tmp);
            format!("No se pudo preparar el archivo de copia de seguridad: {}", e)
        })?;
    }

    match fs::rename(tmp, dest) {
        Ok(()) => {
            let _ = fs::remove_file(&old);
            Ok(())
        }
        Err(e) => {
            // Se restaura la version anterior del destino.
            if had_dest {
                let _ = fs::rename(&old, dest);
            }
            let _ = fs::remove_file(tmp);
            Err(format!("No se pudo escribir la copia de seguridad: {}", e))
        }
    }
}

/// Copia un archivo tal cual, sin tocar el destino si algo falla.
fn copy_file(source: &Path, dest: &Path) -> Result<(), String> {
    let parent = dest
        .parent()
        .ok_or("Ruta de copia de seguridad no valida".to_string())?;
    fs::create_dir_all(parent)
        .map_err(|e| format!("No se pudo crear la carpeta de la copia de seguridad: {}", e))?;

    let file_name = dest
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or("Ruta de copia de seguridad no valida".to_string())?;
    let tmp = parent.join(format!(".{}.tmp", file_name));
    let _ = fs::remove_file(&tmp);

    fs::copy(source, &tmp)
        .map_err(|e| format!("No se pudo copiar el archivo de copia de seguridad: {}", e))?;
    replace_atomically(&tmp, dest)
}

/// Actualiza el backup principal del proyecto con el estado actual.
///
/// Escribe siempre el mismo archivo: no se generan copias adicionales.
pub fn update_main_backup(conn: &Connection, ctx: &ProjectContext) -> Result<(), String> {
    let dir = project_backup_dir(ctx)?;
    let dest = dir.join(MAIN_BACKUP_FILE);
    write_database_copy(conn, &dest)?;
    write_project_info(&dir, ctx)?;
    Ok(())
}

/// Guarda los datos del proyecto junto a sus backups.
fn write_project_info(dir: &Path, ctx: &ProjectContext) -> Result<(), String> {
    #[derive(Serialize)]
    #[serde(rename_all = "camelCase")]
    struct ProjectInfo {
        project_id: String,
        title: String,
        project_path: String,
        updated_at: String,
    }

    let info = ProjectInfo {
        project_id: ctx.project_id.clone(),
        title: ctx.title.clone(),
        project_path: ctx.project_path.to_string_lossy().to_string(),
        updated_at: now_iso(),
    };

    let json = serde_json::to_string_pretty(&info)
        .map_err(|e| format!("No se pudieron preparar los datos del proyecto: {}", e))?;
    fs::write(dir.join(PROJECT_INFO_FILE), json)
        .map_err(|e| format!("No se pudo guardar los datos del proyecto: {}", e))
}

/// Siguiente numero correlativo de snapshot.
fn next_snapshot_index(snapshots: &Path) -> Result<u32, String> {
    let mut max_index = 0u32;

    if let Ok(entries) = fs::read_dir(snapshots) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if let Some(rest) = name.strip_prefix("snapshot_") {
                if let Ok(index) = rest.parse::<u32>() {
                    max_index = max_index.max(index);
                }
            }
        }
    }

    Ok(max_index + 1)
}

/// Crea un snapshot manual del estado actual del proyecto.
///
/// Cada snapshot vive en su propia carpeta y nunca se sobrescribe.
pub fn create_snapshot(conn: &Connection, ctx: &ProjectContext) -> Result<SnapshotInfo, String> {
    let snapshots = snapshots_dir(ctx)?;
    let index = next_snapshot_index(&snapshots)?;
    let id = format!("snapshot_{:03}", index);
    let snapshot_dir = snapshots.join(&id);

    fs::create_dir_all(&snapshot_dir)
        .map_err(|e| format!("No se pudo crear la carpeta del snapshot: {}", e))?;

    let file = snapshot_dir.join(SNAPSHOT_FILE);
    write_database_copy(conn, &file)?;

    let created_at = now_iso();
    let size = fs::metadata(&file).map(|m| m.len()).unwrap_or(0);
    let info = SnapshotInfo {
        id: id.clone(),
        label: format!("{} · {}", id, format_snapshot_date(&created_at)),
        created_at,
        size,
        path: file.to_string_lossy().to_string(),
    };

    let json = serde_json::to_string_pretty(&info)
        .map_err(|e| format!("No se pudieron preparar los datos del snapshot: {}", e))?;
    fs::write(snapshot_dir.join(SNAPSHOT_INFO_FILE), json)
        .map_err(|e| format!("No se pudo guardar los datos del snapshot: {}", e))?;

    Ok(info)
}

/// Formatea una fecha ISO como `dd/mm/aaaa hh:mm`.
fn format_snapshot_date(iso: &str) -> String {
    chrono::DateTime::parse_from_rfc3339(iso)
        .map(|dt| {
            dt.with_timezone(&chrono::Local)
                .format("%d/%m/%Y %H:%M")
                .to_string()
        })
        .unwrap_or_else(|_| iso.to_string())
}

/// Lista los snapshots del proyecto, del mas reciente al mas antiguo.
pub fn list_snapshots(ctx: &ProjectContext) -> Result<Vec<SnapshotInfo>, String> {
    let snapshots = snapshots_dir(ctx)?;
    let mut list: Vec<SnapshotInfo> = Vec::new();

    let entries = fs::read_dir(&snapshots)
        .map_err(|e| format!("No se pudo leer la carpeta de snapshots: {}", e))?;

    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        if !name.starts_with("snapshot_") || !entry.path().is_dir() {
            continue;
        }

        let info_path = entry.path().join(SNAPSHOT_INFO_FILE);
        if let Ok(content) = fs::read_to_string(&info_path) {
            if let Ok(info) = serde_json::from_str::<SnapshotInfo>(&content) {
                list.push(info);
                continue;
            }
        }

        // Sin archivo de datos: se reconstruye a partir del contenido.
        let file = entry.path().join(SNAPSHOT_FILE);
        if file.exists() {
            let size = fs::metadata(&file).map(|m| m.len()).unwrap_or(0);
            let created_at = file
                .metadata()
                .and_then(|m| m.modified())
                .map(|t| {
                    let dt: chrono::DateTime<chrono::Utc> = t.into();
                    dt.to_rfc3339()
                })
                .unwrap_or_else(|_| now_iso());
            list.push(SnapshotInfo {
                id: name.clone(),
                label: format!("{} · {}", name, format_snapshot_date(&created_at)),
                created_at,
                size,
                path: file.to_string_lossy().to_string(),
            });
        }
    }

    // Del mas reciente al mas antiguo.
    list.sort_by(|a, b| b.id.cmp(&a.id));
    Ok(list)
}

/// Ruta del archivo `.aer` de un snapshot.
pub fn snapshot_file(ctx: &ProjectContext, snapshot_id: &str) -> Result<PathBuf, String> {
    let id = sanitize_snapshot_id(snapshot_id)?;
    let file = snapshots_dir(ctx)?.join(&id).join(SNAPSHOT_FILE);
    if !file.exists() {
        return Err("El snapshot no existe".to_string());
    }
    Ok(file)
}

/// Comprueba que un archivo es una base de datos valida y no esta danada.
pub fn validate_database(path: &Path) -> Result<(), String> {
    let conn = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY)
        .map_err(|e| format!("El archivo no es una base de datos valida: {}", e))?;

    let result: String = conn
        .query_row("PRAGMA quick_check;", [], |row| row.get(0))
        .map_err(|e| format!("El archivo esta danado: {}", e))?;

    if result != "ok" {
        return Err(format!("El archivo esta danado: {}", result));
    }

    Ok(())
}

/// Estado actual del sistema de copias de seguridad del proyecto.
pub fn backup_status(ctx: &ProjectContext) -> Result<BackupStatus, String> {
    let dir = project_backup_dir(ctx)?;
    let main = dir.join(MAIN_BACKUP_FILE);
    let last_backup_at = fs::metadata(&main)
        .and_then(|m| m.modified())
        .map(|t| {
            let dt: chrono::DateTime<chrono::Utc> = t.into();
            dt.to_rfc3339()
        })
        .ok();

    let snapshot_count = list_snapshots(ctx)?.len();

    Ok(BackupStatus {
        backup_dir: dir.to_string_lossy().to_string(),
        main_backup_path: main.to_string_lossy().to_string(),
        main_backup_exists: main.exists(),
        last_backup_at,
        snapshot_count,
    })
}

/// Busca los archivos `.bak` que dejo el sistema antiguo junto al proyecto.
///
/// El sistema antiguo guardaba `proyecto.aer.bak`, `proyecto.aer.bak.1`,
/// `proyecto.aer.bak.2`... asi que se buscan todos los archivos que empiezan
/// por ese prefijo.
pub fn find_legacy_backups(project_path: &Path) -> Vec<PathBuf> {
    let dir = match project_path.parent() {
        Some(d) => d,
        None => return Vec::new(),
    };

    let stem = match project_path.file_stem().and_then(|s| s.to_str()) {
        Some(s) => s,
        None => return Vec::new(),
    };
    let extension = match project_path.extension().and_then(|e| e.to_str()) {
        Some(e) => e,
        None => return Vec::new(),
    };
    let prefix = format!("{}.{}.bak", stem, extension);

    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return Vec::new(),
    };

    let mut found: Vec<PathBuf> = entries
        .flatten()
        .map(|e| e.path())
        .filter(|p| {
            p.is_file()
                && p.file_name()
                    .and_then(|n| n.to_str())
                    .map(|n| n.starts_with(&prefix))
                    .unwrap_or(false)
        })
        .collect();

    // Del mas reciente al mas antiguo (por fecha de modificacion).
    found.sort_by_key(|p| {
        fs::metadata(p)
            .and_then(|m| m.modified())
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs())
            .unwrap_or(0)
    });
    found.reverse();
    found
}

/// Migra los backups del sistema antiguo y elimina los archivos `.bak`.
///
/// El backup mas reciente se copia al sistema nuevo (si todavia no hay uno)
/// y solo se borra despues de comprobar que la copia esta a salvo. El resto
/// de `.bak` se eliminan: son copias del mismo archivo que ya vive en el
/// backup principal.
pub fn migrate_legacy_backups(ctx: &ProjectContext) -> Result<LegacyMigration, String> {
    let legacy = find_legacy_backups(&ctx.project_path);
    let mut report = LegacyMigration {
        found: legacy.len(),
        ..Default::default()
    };

    if legacy.is_empty() {
        return Ok(report);
    }

    let main = main_backup_path(ctx)?;

    // Si aun no hay backup principal, se conserva el `.bak` mas reciente.
    if !main.exists() {
        if let Some(newest) = legacy.first() {
            copy_file(newest, &main)?;
            // Se comprueba que la copia esta a salvo antes de borrar el original.
            let source_size = fs::metadata(newest).map(|m| m.len()).unwrap_or(0);
            let dest_size = fs::metadata(&main).map(|m| m.len()).unwrap_or(0);
            if source_size == dest_size && dest_size > 0 {
                report.migrated = true;
            } else {
                let _ = fs::remove_file(&main);
                return Err(
                    "No se pudo migrar la copia de seguridad anterior; se conserva el original"
                        .to_string(),
                );
            }
        }
    }

    // Los `.bak` ya estan migrados (o son redundantes): se eliminan.
    for path in &legacy {
        if fs::remove_file(path).is_ok() {
            report.removed += 1;
        }
    }

    Ok(report)
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::params;

    /// Crea un directorio temporal para la prueba.
    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "aetheria-backup-test-{}-{}",
            name,
            uuid::Uuid::new_v4()
        ));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    /// Crea una base de datos de proyecto con una tabla y un dato.
    fn create_project_db(path: &Path) -> Connection {
        let conn = Connection::open(path).unwrap();
        conn.execute(
            "CREATE TABLE IF NOT EXISTS project_metadata (id TEXT PRIMARY KEY, title TEXT);",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO project_metadata (id, title) VALUES (?1, ?2);",
            params!["proj-1", "Novela de prueba"],
        )
        .unwrap();
        conn
    }

    /// Contexto de prueba con su propia raiz de backups.
    fn test_context(root: &Path, project_path: &Path) -> ProjectContext {
        ProjectContext::with_root(
            "proj-1".to_string(),
            "Novela de prueba".to_string(),
            project_path.to_path_buf(),
            root.join("backups"),
        )
    }

    #[test]
    fn el_backup_principal_es_un_unico_archivo_que_se_actualiza() {
        let root = temp_dir("main");
        let project = root.join("proyecto.aer");
        let conn = create_project_db(&project);
        let ctx = test_context(&root, &project);

        update_main_backup(&conn, &ctx).unwrap();
        let main = main_backup_path(&ctx).unwrap();
        assert!(main.exists(), "el backup principal debe existir");

        // Un segundo guardado no crea archivos nuevos: solo actualiza el mismo.
        conn.execute("UPDATE project_metadata SET title = 'Otro titulo';", [])
            .unwrap();
        update_main_backup(&conn, &ctx).unwrap();

        let dir = project_backup_dir(&ctx).unwrap();
        let aer_files: Vec<_> = fs::read_dir(&dir)
            .unwrap()
            .flatten()
            .filter(|e| e.path().extension().map_or(false, |x| x == "aer"))
            .collect();
        assert_eq!(
            aer_files.len(),
            1,
            "solo debe existir el backup principal, no Copies acumuladas"
        );

        // El contenido esta actualizado.
        let copy = Connection::open_with_flags(&main, OpenFlags::SQLITE_OPEN_READ_ONLY).unwrap();
        let title: String = copy
            .query_row("SELECT title FROM project_metadata;", [], |r| r.get(0))
            .unwrap();
        assert_eq!(title, "Otro titulo");
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn no_se_generan_ficheros_bak_al_guardar() {
        let root = temp_dir("nobak");
        let project = root.join("proyecto.aer");
        let conn = create_project_db(&project);
        let ctx = test_context(&root, &project);

        for _ in 0..3 {
            update_main_backup(&conn, &ctx).unwrap();
        }

        let leftovers: Vec<_> = find_legacy_backups(&project);
        assert!(
            leftovers.is_empty(),
            "no debe quedar ningun archivo .bak junto al proyecto"
        );
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn los_snapshots_no_se_sobrescriben_y_se_listan() {
        let root = temp_dir("snapshots");
        let project = root.join("proyecto.aer");
        let conn = create_project_db(&project);
        let ctx = test_context(&root, &project);

        let first = create_snapshot(&conn, &ctx).unwrap();
        let second = create_snapshot(&conn, &ctx).unwrap();

        assert_ne!(first.id, second.id, "cada snapshot tiene su identificador");
        assert!(snapshot_file(&ctx, &first.id).unwrap().exists());
        assert!(snapshot_file(&ctx, &second.id).unwrap().exists());

        let list = list_snapshots(&ctx).unwrap();
        assert_eq!(list.len(), 2, "los dos snapshots se conservan");

        // El mas reciente aparece primero.
        assert_eq!(list[0].id, second.id);
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn restaurar_un_snapshot_recupera_el_estudio_anterior() {
        let root = temp_dir("restore");
        let project = root.join("proyecto.aer");
        let conn = create_project_db(&project);
        let ctx = test_context(&root, &project);

        // Estado inicial: titulo "Novela de prueba".
        let snapshot = create_snapshot(&conn, &ctx).unwrap();

        // Se cambia el contenido del proyecto.
        conn.execute("UPDATE project_metadata SET title = 'Titulo nuevo';", [])
            .unwrap();
        assert_eq!(read_title(&project), "Titulo nuevo");

        // Se cierra la conexion: en Windows no se puede sustituir un archivo
        // que sigue abierto (es lo que hace el comando de restauracion).
        drop(conn);

        // Se restaura el snapshot sobre el proyecto.
        let source = snapshot_file(&ctx, &snapshot.id).unwrap();
        replace_atomically(&source, &project).unwrap();

        assert_eq!(
            read_title(&project),
            "Novela de prueba",
            "el proyecto vuelve al estado del snapshot"
        );
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn un_snapshot_danado_no_se_restaura() {
        let root = temp_dir("invalid");
        let project = root.join("proyecto.aer");
        let _conn = create_project_db(&project);
        let ctx = test_context(&root, &project);

        let dir = snapshots_dir(&ctx).unwrap().join("snapshot_001");
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join(SNAPSHOT_FILE), b"esto no es una base de datos").unwrap();

        let file = snapshot_file(&ctx, "snapshot_001").unwrap();
        assert!(
            validate_database(&file).is_err(),
            "un archivo invalido debe rechazarse"
        );
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn los_backups_antiguos_se_migran_y_se_eliminan() {
        let root = temp_dir("legacy");
        let project = root.join("proyecto.aer");
        let _conn = create_project_db(&project);
        let ctx = test_context(&root, &project);

        // Se simula el sistema antiguo: dos archivos `.bak`.
        let bak1 = root.join("proyecto.aer.bak");
        let bak2 = root.join("proyecto.aer.bak.1");
        fs::copy(&project, &bak1).unwrap();
        fs::copy(&project, &bak2).unwrap();
        assert_eq!(find_legacy_backups(&project).len(), 2);

        let report = migrate_legacy_backups(&ctx).unwrap();
        assert_eq!(report.found, 2);
        assert!(report.migrated, "el backup mas reciente se migra");
        assert_eq!(report.removed, 2, "los .bak se eliminan");

        assert!(
            find_legacy_backups(&project).is_empty(),
            "no debe quedar ningun .bak junto al proyecto"
        );
        assert!(main_backup_path(&ctx).unwrap().exists());
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn cada_proyecto_tiene_su_propia_carpeta() {
        let root = temp_dir("isolation");
        let project_a = root.join("a.aer");
        let project_b = root.join("b.aer");
        let conn_a = create_project_db(&project_a);
        let _conn_b = create_project_db(&project_b);

        let ctx_a = test_context(&root, &project_a);
        let ctx_b = ProjectContext::with_root(
            "proj-2".to_string(),
            "Otro proyecto".to_string(),
            project_b.clone(),
            root.join("backups"),
        );

        update_main_backup(&conn_a, &ctx_a).unwrap();
        create_snapshot(&conn_a, &ctx_a).unwrap();

        assert!(!main_backup_path(&ctx_b).unwrap().exists());
        assert!(list_snapshots(&ctx_b).unwrap().is_empty());
        assert_eq!(list_snapshots(&ctx_a).unwrap().len(), 1);
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn un_error_de_escritura_no_destruye_la_ultima_copia_valida() {
        let root = temp_dir("atomic");
        let project = root.join("proyecto.aer");
        let conn = create_project_db(&project);
        let ctx = test_context(&root, &project);

        update_main_backup(&conn, &ctx).unwrap();
        let main = main_backup_path(&ctx).unwrap();
        assert!(main.exists());

        // Se intenta una sustitucion cuyo archivo de origen no existe: la
        // operacion falla y el destino conserva su contenido anterior.
        let missing = root.join("no-existe.tmp");
        assert!(
            replace_atomically(&missing, &main).is_err(),
            "la sustitucion debe fallar"
        );

        // La ultima copia valida sigue ahi, intacta y utilizable.
        validate_database(&main).unwrap();
        assert_eq!(read_title(&main), "Novela de prueba");

        // Y no quedan archivos temporales a medias.
        let leftovers: Vec<_> = fs::read_dir(main.parent().unwrap())
            .unwrap()
            .flatten()
            .filter(|e| {
                e.path()
                    .file_name()
                    .and_then(|n| n.to_str())
                    .map_or(false, |n| n.starts_with('.') && n.ends_with(".tmp"))
            })
            .collect();
        assert!(leftovers.is_empty(), "no deben quedar temporales sin limpiar");
        let _ = fs::remove_dir_all(&root);
    }

    /// Lee el titulo del proyecto desde su archivo.
    fn read_title(path: &Path) -> String {
        let conn = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY).unwrap();
        conn.query_row("SELECT title FROM project_metadata;", [], |r| r.get(0))
            .unwrap()
    }
}
