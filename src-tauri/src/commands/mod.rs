use crate::backup::{self, BackupStatus, ProjectContext, SnapshotInfo};
use crate::database::initialize_database;
use crate::state::AppState;
use rusqlite::{Connection, OpenFlags};
use serde::{Deserialize, Serialize};
use serde_json;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::Ordering;
use tauri::State;
use uuid::Uuid;

#[derive(Serialize, Deserialize, Clone)]
pub struct ProjectMetadata {
    pub id: String,
    pub title: String,
    pub author: Option<String>,
    pub description: Option<String>,
    pub genre: Option<String>,
    pub synopsis: Option<String>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(default)]
pub struct ProjectSettings {
    pub theme: String,
    pub focus_mode: String,
    pub auto_save_enabled: bool,
    pub auto_save_interval_minutes: i64,
    pub language: String,
    pub writing_style: String,
    pub updated_at: Option<String>,
    pub centered_writing_mode: bool,
    pub centered_writing_position: i64,
}

/// Valores por defecto de los ajustes de la novela.
///
/// El struct acepta `#[serde(default)]`: los ajustes que ya no existen en la
/// base de datos (tema, idioma, estilo) se completan con estos valores en vez
/// de fallar la deserializacion, de modo que el cliente puede enviar solo los
/// campos que de verdad usa.
///
/// Los ajustes de aplicacion (tema, tipografia, corrector ortografico) no
/// estan aqui: viven en el store de la aplicacion, en `app_settings.json`.
impl Default for ProjectSettings {
    fn default() -> Self {
        Self {
            theme: "midnight".to_string(),
            focus_mode: "standard".to_string(),
            auto_save_enabled: true,
            auto_save_interval_minutes: 5,
            language: "es".to_string(),
            writing_style: "creative".to_string(),
            updated_at: None,
            centered_writing_mode: false,
            centered_writing_position: 50,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UniverseEntry {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub entry_type: String,
    #[serde(rename = "parentId")]
    pub parent_id: Option<String>,
    pub content: String,
    #[serde(rename = "createdAt")]
    pub created_at: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UniverseCategory {
    pub id: String,
    pub name: String,
    pub description: String,
    pub entries: Vec<UniverseEntry>,
}

/// Lee el identificador del proyecto sin abrirlo en modo escritura.
///
/// Se usa para asociar los backups al proyecto correcto antes de que exista
/// una conexion activa.
fn peek_project_id(file_path: &Path) -> Option<String> {
    let conn = Connection::open_with_flags(file_path, OpenFlags::SQLITE_OPEN_READ_ONLY).ok()?;
    conn.query_row("SELECT id FROM project_metadata LIMIT 1;", [], |row| {
        row.get::<_, String>(0)
    })
    .ok()
}

/// Lee los metadatos del proyecto de una conexion abierta.
fn read_project_metadata(conn: &Connection) -> Result<ProjectMetadata, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, title, author, description, genre, synopsis, created_at, updated_at
             FROM project_metadata
             LIMIT 1;",
        )
        .map_err(|e| e.to_string())?;

    stmt.query_row([], |row| {
        Ok(ProjectMetadata {
            id: row.get(0)?,
            title: row.get(1)?,
            author: row.get(2)?,
            description: row.get(3)?,
            genre: row.get(4)?,
            synopsis: row.get(5)?,
            created_at: row.get(6)?,
            updated_at: row.get(7)?,
        })
    })
    .map_err(|e| format!("No se encontraron metadatos de proyecto válidos: {}", e))
}

/// Actualiza el backup principal si la base de datos ha cambiado.
///
/// Devuelve `true` cuando se ha escrito una copia nueva. La comparacion usa
/// `total_changes` de la conexion: cuenta las filas insertadas, modificadas
/// o borradas desde que se abrio el proyecto, asi que basta con compararlo
/// con el valor del ultimo backup para saber si hay cambios pendientes.
pub fn flush_pending_backup(state: &AppState) -> Result<bool, String> {
    let ctx = {
        let guard = state.project.lock().map_err(|_| "Error bloqueando estado")?;
        match guard.clone() {
            Some(ctx) => ctx,
            None => return Ok(false),
        }
    };

    let changes = {
        let guard = state.db.lock().map_err(|_| "Error bloqueando estado")?;
        match guard.as_ref() {
            Some(conn) => conn.total_changes(),
            None => return Ok(false),
        }
    };

    if changes == ctx.last_backed_up_changes {
        return Ok(false);
    }

    {
        let guard = state.db.lock().map_err(|_| "Error bloqueando estado")?;
        let conn = guard.as_ref().ok_or("No hay proyecto abierto")?;
        backup::update_main_backup(conn, &ctx)?;
        let new_changes = conn.total_changes();

        // El guardia de `db` se suelta antes de pedir `project`: los dos mutexes
        // nunca se toman a la vez, asi que no puede haber interbloqueo.
        let mut project = state.project.lock().map_err(|_| "Error bloqueando estado")?;
        if let Some(current) = project.as_mut() {
            current.last_backed_up_changes = new_changes;
        }
    }

    Ok(true)
}

/// Crea un snapshot manual del estado actual del proyecto.
#[tauri::command]
pub fn create_snapshot(state: State<'_, AppState>) -> Result<SnapshotInfo, String> {
    let ctx = {
        let guard = state.project.lock().map_err(|_| "Error bloqueando estado")?;
        guard
            .clone()
            .ok_or("No hay proyecto abierto".to_string())?
    };

    let (info, changes) = {
        let guard = state.db.lock().map_err(|_| "Error bloqueando estado")?;
        let conn = guard.as_ref().ok_or("No hay proyecto abierto")?;
        let info = backup::create_snapshot(conn, &ctx)?;
        (info, conn.total_changes())
    };

    // El estado actual ya esta guardado en el snapshot: se da por respaldado.
    {
        let mut project = state.project.lock().map_err(|_| "Error bloqueando estado")?;
        if let Some(current) = project.as_mut() {
            current.last_backed_up_changes = changes;
        }
    }

    Ok(info)
}

/// Lista los snapshots manuales del proyecto abierto.
#[tauri::command]
pub fn list_snapshots(state: State<'_, AppState>) -> Result<Vec<SnapshotInfo>, String> {
    let ctx = {
        let guard = state.project.lock().map_err(|_| "Error bloqueando estado")?;
        guard
            .clone()
            .ok_or("No hay proyecto abierto".to_string())?
    };

    backup::list_snapshots(&ctx)
}

/// Estado del sistema de copias de seguridad del proyecto abierto.
#[tauri::command]
pub fn get_backup_status(state: State<'_, AppState>) -> Result<BackupStatus, String> {
    let ctx = {
        let guard = state.project.lock().map_err(|_| "Error bloqueando estado")?;
        guard
            .clone()
            .ok_or("No hay proyecto abierto".to_string())?
    };

    backup::backup_status(&ctx)
}

/// Restaura un snapshot sobre el proyecto abierto.
///
/// Antes de sobrescribir el proyecto se crea un snapshot del estado actual,
/// para que el usuario pueda volver atras si se arrepiente de la
/// restauracion.
#[tauri::command]
pub fn restore_snapshot(
    state: State<'_, AppState>,
    snapshot_id: String,
) -> Result<ProjectMetadata, String> {
    restore_snapshot_impl(&state, &snapshot_id)
}

/// Logica de la restauracion, separada del comando para poder probarla.
pub fn restore_snapshot_impl(
    state: &AppState,
    snapshot_id: &str,
) -> Result<ProjectMetadata, String> {
    let ctx = {
        let guard = state.project.lock().map_err(|_| "Error bloqueando estado")?;
        guard
            .clone()
            .ok_or("No hay proyecto abierto".to_string())?
    };

    let source = backup::snapshot_file(&ctx, snapshot_id)?;
    // El snapshot debe ser una base de datos valida antes de tocar nada.
    backup::validate_database(&source)?;

    // Punto de retorno: el estado actual se guarda como snapshot.
    {
        let guard = state.db.lock().map_err(|_| "Error bloqueando estado")?;
        let conn = guard.as_ref().ok_or("No hay proyecto abierto")?;
        backup::create_snapshot(conn, &ctx)?;
    }

    // Se cierra la conexion para poder sustituir el archivo del proyecto.
    {
        let mut guard = state.db.lock().map_err(|_| "Error bloqueando estado")?;
        *guard = None;
    }

    backup::replace_atomically(&source, &ctx.project_path)?;

    let conn = Connection::open(&ctx.project_path)
        .map_err(|e| format!("Error abriendo el proyecto restaurado: {}", e))?;
    initialize_database(&conn)
        .map_err(|e| format!("Error actualizando estructura de datos: {}", e))?;
    let meta = read_project_metadata(&conn)?;

    {
        let mut guard = state.db.lock().map_err(|_| "Error bloqueando estado")?;
        *guard = Some(conn);
    }

    // El backup principal pasa a reflejar el estado restaurado.
    {
        let mut project = state.project.lock().map_err(|_| "Error bloqueando estado")?;
        if let Some(current) = project.as_mut() {
            current.last_backed_up_changes = u64::MAX;
        }
    }
    let _ = flush_pending_backup(state);

    Ok(meta)
}

#[tauri::command]
pub fn create_project(
    state: State<'_, AppState>,
    path: String,
    title: String,
    author: String,
    genre: Option<String>,
    synopsis: Option<String>,
) -> Result<ProjectMetadata, String> {
    let file_path = Path::new(&path);

    // Validar extensión
    if file_path.extension().map_or(true, |ext| ext != "aer") {
        return Err("La extensión del archivo debe ser .aer".to_string());
    }

    // Si el archivo ya existia, su estado anterior se conserva en el sistema
    // nuevo de copias de seguridad antes de sobrescribirlo.
    if file_path.exists() {
        if let Some(existing_id) = peek_project_id(file_path) {
            let previous = ProjectContext::new(
                existing_id,
                title.clone(),
                file_path.to_path_buf(),
            );
            let _ = backup::migrate_legacy_backups(&previous);
            if let Ok(conn) =
                Connection::open_with_flags(file_path, OpenFlags::SQLITE_OPEN_READ_ONLY)
            {
                let _ = backup::update_main_backup(&conn, &previous);
            }
        }
    }

    // Conectar/Crear base de datos
    let conn = Connection::open(file_path)
        .map_err(|e| format!("No se pudo crear el archivo del proyecto: {}", e))?;

    // Inicializar tablas
    initialize_database(&conn)
        .map_err(|e| format!("Error inicializando la estructura de datos: {}", e))?;

    // Crear metadatos iniciales
    let project_id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO project_metadata (id, title, author, description, genre, synopsis) VALUES (?1, ?2, ?3, ?4, ?5, ?6);",
        (&project_id, &title, &author, &"", &genre, &synopsis),
    )
    .map_err(|e| format!("Error guardando metadatos iniciales: {}", e))?;

    let meta = ProjectMetadata {
        id: project_id,
        title,
        author: Some(author),
        description: Some("".to_string()),
        genre,
        synopsis,
        created_at: Some(chrono::Utc::now().to_rfc3339()),
        updated_at: Some(chrono::Utc::now().to_rfc3339()),
    };

    // Almacenar conexión en el estado global.
    //
    // El bloque es importante: el guardia del mutex se suelta al cerrarlo, y
    // `flush_pending_backup` vuelve a pedir ese mismo mutex. Si el guardia
    // siguiera vivo, el hilo se quedaria esperando para siempre.
    {
        let mut db_guard = state.db.lock().map_err(|_| "Error bloqueando estado")?;
        *db_guard = Some(conn);
    }

    // El proyecto queda asociado a su carpeta de copias de seguridad y se
    // guarda una primera copia del estado recien creado.
    let ctx = ProjectContext::new(
        meta.id.clone(),
        meta.title.clone(),
        file_path.to_path_buf(),
    );
    {
        let mut project = state.project.lock().map_err(|_| "Error bloqueando estado")?;
        *project = Some(ctx.clone());
    }
    let _ = flush_pending_backup(&state);

    Ok(meta)
}

#[tauri::command]
pub fn open_project(
    state: State<'_, AppState>,
    path: String,
) -> Result<ProjectMetadata, String> {
    open_project_impl(&state, &path)
}

/// Logica de apertura de un proyecto, separada del comando para poder probarla.
pub fn open_project_impl(state: &AppState, path: &str) -> Result<ProjectMetadata, String> {
    let file_path = Path::new(path);

    if !file_path.exists() {
        return Err("El archivo del proyecto no existe".to_string());
    }

    if file_path.extension().map_or(true, |ext| ext != "aer") {
        return Err("El archivo no tiene extensión .aer válida".to_string());
    }

    let conn = Connection::open(file_path)
        .map_err(|e| format!("Error abriendo base de datos: {}", e))?;

    // Asegurar estructura
    initialize_database(&conn)
        .map_err(|e| format!("Error actualizando estructura de datos: {}", e))?;

    // Obtener metadatos
    let meta = read_project_metadata(&conn)?;

    // El proyecto queda asociado a su carpeta de copias de seguridad.
    let ctx = ProjectContext::new(
        meta.id.clone(),
        meta.title.clone(),
        file_path.to_path_buf(),
    );
    {
        let mut project = state.project.lock().map_err(|_| "Error bloqueando estado")?;
        *project = Some(ctx.clone());
    }

    // Los backups que dejo el sistema antiguo se migran al nuevo sistema y
    // sus archivos `.bak` se eliminan.
    let _ = backup::migrate_legacy_backups(&ctx);

    // Ahora stmt ya no existe y podemos mover la conexión.
    //
    // El guardia del mutex se suelta al cerrar el bloque: `flush_pending_backup`
    // vuelve a pedir ese mismo mutex y, si siguiera vivo, la aplicacion se
    // quedaria esperando para siempre.
    {
        let mut db_guard = state.db.lock().map_err(|_| "Error bloqueando estado")?;
        *db_guard = Some(conn);
    }

    // Primera copia del backup principal con el estado recien abierto.
    let _ = flush_pending_backup(state);

    Ok(meta)
}

#[tauri::command]
pub fn get_project_settings(state: State<'_, AppState>) -> Result<ProjectSettings, String> {
    let db_guard = state.db.lock().map_err(|_| "Error bloqueando estado")?;
    let conn = db_guard.as_ref().ok_ok_or("No hay proyecto abierto")?;

    let mut stmt = conn
        .prepare(
            "SELECT theme, focus_mode, auto_save_enabled, auto_save_interval_minutes, language, writing_style, updated_at, centered_writing_mode, centered_writing_position
             FROM project_settings WHERE id = 'default' LIMIT 1;",
        )
        .map_err(|e| e.to_string())?;

    let settings = stmt
        .query_row([], |row| {
            Ok(ProjectSettings {
                theme: row.get(0)?,
                focus_mode: row.get(1)?,
                auto_save_enabled: row.get(2)?,
                auto_save_interval_minutes: row.get(3)?,
                language: row.get(4)?,
                writing_style: row.get(5)?,
                updated_at: row.get(6)?,
                centered_writing_mode: row.get(7)?,
                centered_writing_position: row.get(8)?,
            })
        })
        .unwrap_or_else(|_| ProjectSettings::default());

    Ok(settings)
}

#[tauri::command]
pub fn update_project_settings(
    state: State<'_, AppState>,
    settings: ProjectSettings,
) -> Result<ProjectSettings, String> {
    let db_guard = state.db.lock().map_err(|_| "Error bloqueando estado")?;
    let conn = db_guard.as_ref().ok_ok_or("No hay proyecto abierto")?;

    conn.execute(
        "INSERT INTO project_settings (id, theme, focus_mode, auto_save_enabled, auto_save_interval_minutes, language, writing_style, updated_at, centered_writing_mode, centered_writing_position)
         VALUES ('default', ?1, ?2, ?3, ?4, ?5, ?6, CURRENT_TIMESTAMP, ?7, ?8)
         ON CONFLICT(id) DO UPDATE SET
            theme = excluded.theme,
            focus_mode = excluded.focus_mode,
            auto_save_enabled = excluded.auto_save_enabled,
            auto_save_interval_minutes = excluded.auto_save_interval_minutes,
            language = excluded.language,
            writing_style = excluded.writing_style,
            updated_at = CURRENT_TIMESTAMP,
            centered_writing_mode = excluded.centered_writing_mode,
            centered_writing_position = excluded.centered_writing_position;",
        (
            &settings.theme,
            &settings.focus_mode,
            settings.auto_save_enabled,
            settings.auto_save_interval_minutes,
            &settings.language,
            &settings.writing_style,
            settings.centered_writing_mode,
            settings.centered_writing_position,
        ),
    )
    .map_err(|e| format!("Error guardando configuración: {}", e))?;

    Ok(settings)
}

// ─── Personal Dictionary Commands ───────────────────────────────────────────────
// Palabras que el corrector ortografico no debe marcar como error.

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct PersonalDictionaryWord {
    pub word: String,
    pub language: String,
    pub created_at: String,
}

/// Lista las palabras del diccionario personal de la novela.
#[tauri::command]
pub fn get_personal_dictionary(
    state: State<'_, AppState>,
) -> Result<Vec<PersonalDictionaryWord>, String> {
    let db_guard = state.db.lock().map_err(|_| "Error bloqueando estado")?;
    let conn = db_guard.as_ref().ok_or("No hay proyecto abierto")?;
    get_personal_dictionary_impl(conn)
}

/// Anade una palabra al diccionario personal de la novela.
///
/// La palabra se guarda tal cual, pero la busqueda no distingue mayusculas:
/// "Aelthirion" y "aelthirion" son la misma entrada.
#[tauri::command]
pub fn add_personal_dictionary_word(
    state: State<'_, AppState>,
    word: String,
    language: Option<String>,
) -> Result<(), String> {
    let db_guard = state.db.lock().map_err(|_| "Error bloqueando estado")?;
    let conn = db_guard.as_ref().ok_or("No hay proyecto abierto")?;
    let language = language.unwrap_or_else(|| "es".to_string());
    add_personal_dictionary_word_impl(conn, &word, &language)
}

/// Elimina una palabra del diccionario personal de la novela.
#[tauri::command]
pub fn remove_personal_dictionary_word(
    state: State<'_, AppState>,
    word: String,
) -> Result<(), String> {
    let db_guard = state.db.lock().map_err(|_| "Error bloqueando estado")?;
    let conn = db_guard.as_ref().ok_or("No hay proyecto abierto")?;
    remove_personal_dictionary_word_impl(conn, &word)
}

fn get_personal_dictionary_impl(
    conn: &Connection,
) -> Result<Vec<PersonalDictionaryWord>, String> {
    let mut stmt = conn
        .prepare("SELECT word, language, created_at FROM personal_dictionary ORDER BY word;")
        .map_err(|e| e.to_string())?;

    let words = stmt
        .query_map([], |row| {
            Ok(PersonalDictionaryWord {
                word: row.get(0)?,
                language: row.get(1)?,
                created_at: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|row| row.ok())
        .collect();

    Ok(words)
}

fn add_personal_dictionary_word_impl(
    conn: &Connection,
    word: &str,
    language: &str,
) -> Result<(), String> {
    let clean = word.trim();
    if clean.is_empty() {
        return Err("La palabra no puede estar vacia".to_string());
    }

    conn.execute(
        "INSERT INTO personal_dictionary (word, language) VALUES (?1, ?2)
         ON CONFLICT(word) DO UPDATE SET word = excluded.word;",
        (clean, language),
    )
    .map_err(|e| format!("Error guardando la palabra: {}", e))?;

    Ok(())
}

fn remove_personal_dictionary_word_impl(conn: &Connection, word: &str) -> Result<(), String> {
    conn.execute("DELETE FROM personal_dictionary WHERE word = ?1;", [word.trim()])
        .map_err(|e| format!("Error eliminando la palabra: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn get_universe_data(state: State<'_, AppState>) -> Result<Vec<UniverseCategory>, String> {
    let db_guard = state.db.lock().map_err(|_| "Error bloqueando estado")?;
    let conn = db_guard.as_ref().ok_or("No hay proyecto abierto")?;

    let mut stmt = conn
        .prepare("SELECT data FROM universe_state WHERE id = 'default' LIMIT 1;")
        .map_err(|e| e.to_string())?;

    let payload = stmt
        .query_row([], |row| row.get::<_, String>(0))
        .unwrap_or_else(|_| "[]".to_string());

    let data = serde_json::from_str(&payload).unwrap_or_default();
    Ok(data)
}

#[tauri::command]
pub fn save_universe_data(
    state: State<'_, AppState>,
    data: Vec<UniverseCategory>,
) -> Result<Vec<UniverseCategory>, String> {
    let db_guard = state.db.lock().map_err(|_| "Error bloqueando estado")?;
    let conn = db_guard.as_ref().ok_or("No hay proyecto abierto")?;

    let payload = serde_json::to_string(&data).map_err(|e| format!("Error serializando universo: {}", e))?;

    conn.execute(
        "INSERT INTO universe_state (id, data, updated_at)
         VALUES ('default', ?1, CURRENT_TIMESTAMP)
         ON CONFLICT(id) DO UPDATE SET
            data = excluded.data,
            updated_at = CURRENT_TIMESTAMP;",
        [&payload],
    )
    .map_err(|e| format!("Error guardando universo: {}", e))?;

    Ok(data)
}

#[tauri::command]
pub fn update_project_metadata(
    state: State<'_, AppState>,
    title: String,
    author: String,
    description: String,
    genre: Option<String>,
    synopsis: Option<String>,
) -> Result<ProjectMetadata, String> {
    let db_guard = state.db.lock().map_err(|_| "Error bloqueando estado")?;
    let conn = db_guard.as_ref().ok_ok_or("No hay proyecto abierto")?;

    conn.execute(
        "UPDATE project_metadata SET title = ?1, author = ?2, description = ?3, genre = ?4, synopsis = ?5, updated_at = CURRENT_TIMESTAMP WHERE id = (SELECT id FROM project_metadata LIMIT 1);",
        (&title, &author, &description, &genre, &synopsis),
    )
    .map_err(|e| format!("Error actualizando metadatos: {}", e))?;

    let mut stmt = conn
        .prepare(
            "SELECT id, title, author, description, genre, synopsis, created_at, updated_at FROM project_metadata LIMIT 1;",
        )
        .map_err(|e| e.to_string())?;

    let metadata = stmt
        .query_row([], |row| {
            Ok(ProjectMetadata {
                id: row.get(0)?,
                title: row.get(1)?,
                author: row.get(2)?,
                description: row.get(3)?,
                genre: row.get(4)?,
                synopsis: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })
        .map_err(|e| format!("No se pudieron recuperar los metadatos: {}", e))?;

    Ok(metadata)
}

#[tauri::command]
pub fn close_project(state: State<'_, AppState>) -> Result<(), String> {
    // Ultima copia de seguridad antes de soltar la base de datos.
    let _ = flush_pending_backup(&state);

    let mut db_guard = state.db.lock().map_err(|_| "Error bloqueando estado")?;
    *db_guard = None; // Cierra la conexión implícitamente al hacer drop
    drop(db_guard);

    let mut project = state.project.lock().map_err(|_| "Error bloqueando estado")?;
    *project = None;
    Ok(())
}

use crate::domain::ManuscriptNode;

#[tauri::command]
pub fn get_manuscript_nodes(state: State<'_, AppState>) -> Result<Vec<ManuscriptNode>, String> {
    let db_guard = state.db.lock().map_err(|_| "Error bloqueando estado")?;
    let conn = db_guard.as_ref().ok_ok_or("No hay proyecto abierto")?;

    let mut stmt = conn
        .prepare("SELECT id, parent_id, title, type, sort_order, status, color, tags, synopsis, writing_goals, author_notes, created_at, updated_at FROM manuscript_nodes ORDER BY sort_order ASC;")
        .map_err(|e| e.to_string())?;

    let node_iter = stmt
        .query_map([], |row| {
            Ok(ManuscriptNode {
                id: row.get(0)?,
                parent_id: row.get(1)?,
                title: row.get(2)?,
                r#type: row.get(3)?,
                sort_order: row.get(4)?,
                status: row.get(5)?,
                color: row.get(6)?,
                tags: row.get(7)?,
                synopsis: row.get(8)?,
                writing_goals: row.get(9)?,
                author_notes: row.get(10)?,
                created_at: row.get(11)?,
                updated_at: row.get(12)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut nodes = Vec::new();
    for node in node_iter {
        nodes.push(node.map_err(|e| e.to_string())?);
    }

    Ok(nodes)
}

#[tauri::command]
pub fn create_manuscript_node(
    state: State<'_, AppState>,
    parent_id: Option<String>,
    title: String,
    node_type: String,
) -> Result<ManuscriptNode, String> {
    let db_guard = state.db.lock().map_err(|_| "Error bloqueando estado")?;
    let conn = db_guard.as_ref().ok_ok_or("No hay proyecto abierto")?;

    let id = Uuid::new_v4().to_string();
    
    // Obtener el siguiente número de orden
    let sort_order: i32 = conn
        .query_row(
            "SELECT COALESCE(MAX(sort_order), 0) + 1 FROM manuscript_nodes WHERE parent_id IS ?1;",
            [&parent_id],
            |row| row.get(0),
        )
        .unwrap_or(1);

    conn.execute(
        "INSERT INTO manuscript_nodes (id, parent_id, title, type, sort_order) VALUES (?1, ?2, ?3, ?4, ?5);",
        (&id, &parent_id, &title, &node_type, &sort_order),
    )
    .map_err(|e| format!("Error creando nodo: {}", e))?;

    // Si es una escena, inicializar su contenido vacío
    if node_type == "scene" {
        conn.execute(
            "INSERT INTO scene_contents (node_id, content, plain_text) VALUES (?1, ?2, ?3);",
            (&id, &"", &""),
        )
        .map_err(|e| format!("Error inicializando escena: {}", e))?;
    }

    Ok(ManuscriptNode {
        id,
        parent_id,
        title,
        r#type: node_type,
        sort_order,
        status: "draft".to_string(),
        color: None,
        tags: None,
        synopsis: None,
        writing_goals: None,
        author_notes: None,
        created_at: Some(chrono::Utc::now().to_rfc3339()),
        updated_at: Some(chrono::Utc::now().to_rfc3339()),
    })
}

#[tauri::command]
pub fn update_manuscript_node(
    state: State<'_, AppState>,
    id: String,
    title: String,
    status: String,
    color: Option<String>,
    tags: Option<String>,
    synopsis: Option<String>,
    writing_goals: Option<String>,
    author_notes: Option<String>,
) -> Result<ManuscriptNode, String> {
    let db_guard = state.db.lock().map_err(|_| "Error bloqueando estado")?;
    let conn = db_guard.as_ref().ok_ok_or("No hay proyecto abierto")?;

    conn.execute(
        "UPDATE manuscript_nodes SET title = ?1, status = ?2, color = ?3, tags = ?4, synopsis = ?5, writing_goals = ?6, author_notes = ?7, updated_at = CURRENT_TIMESTAMP WHERE id = ?8;",
        (&title, &status, &color, &tags, &synopsis, &writing_goals, &author_notes, &id),
    )
    .map_err(|e| format!("Error actualizando nodo: {}", e))?;

    let mut stmt = conn
        .prepare("SELECT id, parent_id, title, type, sort_order, status, color, tags, synopsis, writing_goals, author_notes, created_at, updated_at FROM manuscript_nodes WHERE id = ?1;")
        .map_err(|e| e.to_string())?;

    let node = stmt
        .query_row([&id], |row| {
            Ok(ManuscriptNode {
                id: row.get(0)?,
                parent_id: row.get(1)?,
                title: row.get(2)?,
                r#type: row.get(3)?,
                sort_order: row.get(4)?,
                status: row.get(5)?,
                color: row.get(6)?,
                tags: row.get(7)?,
                synopsis: row.get(8)?,
                writing_goals: row.get(9)?,
                author_notes: row.get(10)?,
                created_at: row.get(11)?,
                updated_at: row.get(12)?,
            })
        })
        .map_err(|e| format!("Nodo no encontrado: {}", e))?;

    Ok(node)
}

#[tauri::command]
pub fn delete_manuscript_node(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let db_guard = state.db.lock().map_err(|_| "Error bloqueando estado")?;
    let conn = db_guard.as_ref().ok_ok_or("No hay proyecto abierto")?;

    conn.execute("DELETE FROM manuscript_nodes WHERE id = ?1;", [&id])
        .map_err(|e| format!("Error eliminando nodo: {}", e))?;

    Ok(())
}

fn normalize_scene_text(raw_content: &str, plain_text: &str) -> String {
    let plain_text = plain_text.trim();
    if !plain_text.is_empty() {
        return plain_text.to_string();
    }

    let trimmed = raw_content.trim();
    if trimmed.is_empty() || trimmed == "{}" {
        return String::new();
    }

    if let Ok(value) = serde_json::from_str::<serde_json::Value>(trimmed) {
        let mut texts = Vec::new();
        collect_text_values(&value, &mut texts);
        let normalized = texts.join("\n").trim().to_string();
        if !normalized.is_empty() {
            return normalized;
        }
    }

    trimmed.to_string()
}

fn collect_text_values(value: &serde_json::Value, texts: &mut Vec<String>) {
    match value {
        serde_json::Value::Array(items) => {
            for item in items {
                collect_text_values(item, texts);
            }
        }
        serde_json::Value::Object(map) => {
            if let Some(text) = map.get("text").and_then(|value| value.as_str()) {
                if !text.trim().is_empty() {
                    texts.push(text.trim().to_string());
                }
            }

            if let Some(children) = map.get("children") {
                collect_text_values(children, texts);
            } else {
                for (_, child) in map.iter() {
                    if child.is_array() || child.is_object() {
                        collect_text_values(child, texts);
                    }
                }
            }
        }
        _ => {}
    }
}

#[tauri::command]
pub fn get_scene_content(state: State<'_, AppState>, node_id: String) -> Result<Option<String>, String> {
    let db_guard = state.db.lock().map_err(|_| "Error bloqueando estado")?;
    let conn = db_guard.as_ref().ok_ok_or("No hay proyecto abierto")?;

    let mut stmt = conn
        .prepare("SELECT content FROM scene_contents WHERE node_id = ?1 LIMIT 1;")
        .map_err(|e| e.to_string())?;

    let content: Option<String> = stmt
        .query_row([&node_id], |row| row.get(0))
        .ok();

    Ok(content)
}

#[tauri::command]
pub fn update_scene_content(
    state: State<'_, AppState>,
    node_id: String,
    content: String,
    plain_text: String,
) -> Result<(), String> {
    let db_guard = state.db.lock().map_err(|_| "Error bloqueando estado")?;
    let conn = db_guard.as_ref().ok_ok_or("No hay proyecto abierto")?;

    let normalized_text = normalize_scene_text(&content, &plain_text);

    // Store raw Lexical content in `content` and normalized plain text in `plain_text`.
    conn.execute(
        "INSERT INTO scene_contents (node_id, content, plain_text, updated_at)
         VALUES (?1, ?2, ?3, CURRENT_TIMESTAMP)
         ON CONFLICT(node_id) DO UPDATE SET
            content = excluded.content,
            plain_text = excluded.plain_text,
            updated_at = CURRENT_TIMESTAMP;",
        (&node_id, &content, &normalized_text),
    )
    .map_err(|e| format!("Error actualizando contenido de escena: {}", e))?;

    // Update FTS5 index using normalized plain text for search.
    let _ = conn.execute("DELETE FROM fts_index WHERE id = ?1;", [&node_id]);

    if let Err(err) = conn.execute(
        "INSERT INTO fts_index (id, title, content, type)
         VALUES (?1, (SELECT title FROM manuscript_nodes WHERE id = ?1), ?2, 'scene');",
        (&node_id, &normalized_text),
    ) {
        eprintln!("No se pudo actualizar el índice de búsqueda: {}", err);
    }

    // Update character tracking for this scene
    update_character_tracking_for_scene(conn, &node_id, &content)?;

    Ok(())
}

// Helper function to update character tracking for a single scene
fn update_character_tracking_for_scene(conn: &Connection, scene_id: &str, content: &str) -> Result<(), String> {
    // Get all characters
    let mut char_stmt = conn
        .prepare("SELECT id, name FROM universe_entries WHERE entry_type = 'character';")
        .map_err(|e| e.to_string())?;

    let characters: Vec<(String, String)> = char_stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    if characters.is_empty() {
        return Ok(());
    }

    let character_names: Vec<String> = characters.iter().map(|(_, name)| name.clone()).collect();

    // Get scene's parent chapter
    let parent_id: Option<String> = conn
        .query_row(
            "SELECT parent_id FROM manuscript_nodes WHERE id = ?1;",
            [scene_id],
            |row| row.get(0),
        )
        .ok();

    // Find the chapter ID
    let chapter_id = if let Some(ref p_id) = parent_id {
        let is_chapter: Option<String> = conn
            .query_row(
                "SELECT id FROM manuscript_nodes WHERE id = ?1 AND type = 'chapter';",
                [p_id],
                |row| row.get(0),
            )
            .ok();

        if let Some(ch_id) = is_chapter {
            ch_id
        } else {
            // Parent might be a part, get the chapter parent
            conn.query_row(
                "SELECT parent_id FROM manuscript_nodes WHERE id = ?1 AND type = 'chapter';",
                [p_id],
                |row| row.get(0),
            )
            .ok()
            .unwrap_or_else(|| p_id.clone())
        }
    } else {
        scene_id.to_string()
    };

    // Delete existing appearances for this scene
    conn.execute(
        "DELETE FROM character_appearances WHERE scene_id = ?1;",
        [scene_id],
    )
    .map_err(|e| format!("Error deleting old appearances: {}", e))?;

    // Extract character mentions from content
    let matched_indices = extract_entity_references_from_content(content, &character_names);

    // Get part_id if exists
    let part_id: Option<String> = conn
        .query_row(
            "SELECT parent_id FROM manuscript_nodes WHERE id = ?1 AND type = 'part';",
            [&chapter_id],
            |row| row.get(0),
        )
        .ok();

    // Insert new appearances
    for matched in matched_indices {
        if matched.starts_with("match_") {
            if let Ok(idx) = matched.replace("match_", "").parse::<usize>() {
                if idx < characters.len() {
                    let (char_id, _char_name) = &characters[idx];
                    let id = Uuid::new_v4().to_string();
                    let now = chrono::Utc::now().to_rfc3339();

                    conn.execute(
                        "INSERT INTO character_appearances (id, character_id, scene_id, chapter_id, part_id, updated_at)
                         VALUES (?1, ?2, ?3, ?4, ?5, ?6);",
                        (&id, char_id, scene_id, &chapter_id, &part_id, &now),
                    ).map_err(|e| format!("Error inserting appearance: {}", e))?;
                }
            }
        }
    }

    Ok(())
}

#[tauri::command]
pub fn merge_scenes(
    state: State<'_, AppState>,
    source_ids: Vec<String>,
    target_id: String,
) -> Result<ManuscriptNode, String> {
    let mut db_guard = state.db.lock().map_err(|_| "Error bloqueando estado")?;
    let conn = db_guard.as_mut().ok_or("No hay proyecto abierto")?;

    // Get target node info
    let target: ManuscriptNode = conn
        .query_row(
            "SELECT id, parent_id, title, type, sort_order, status, color, tags, synopsis, writing_goals, author_notes, created_at, updated_at
             FROM manuscript_nodes WHERE id = ?1;",
            [&target_id],
            |row| {
                Ok(ManuscriptNode {
                    id: row.get(0)?,
                    parent_id: row.get(1)?,
                    title: row.get(2)?,
                    r#type: row.get(3)?,
                    sort_order: row.get(4)?,
                    status: row.get(5)?,
                    color: row.get(6)?,
                    tags: row.get(7)?,
                    synopsis: row.get(8)?,
                    writing_goals: row.get(9)?,
                    author_notes: row.get(10)?,
                    created_at: row.get(11)?,
                    updated_at: row.get(12)?,
                })
            },
        )
        .map_err(|e| format!("Nodo objetivo no encontrado: {}", e))?;

    // Get target's original content first
    let (target_content, target_plain_text): (Option<String>, Option<String>) = conn
        .query_row(
            "SELECT content, plain_text FROM scene_contents WHERE node_id = ?1;",
            [&target_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .ok()
        .unwrap_or((None, None));

    // Start with target content
    let mut merged_content = target_content.unwrap_or_default();
    let mut merged_plain_text = target_plain_text.unwrap_or_default();

    // Append all source contents
    for source_id in source_ids.iter() {
        let content: Option<String> = conn
            .query_row(
                "SELECT content FROM scene_contents WHERE node_id = ?1;",
                [source_id],
                |row| row.get(0),
            )
            .ok();

        let plain_text: Option<String> = conn
            .query_row(
                "SELECT plain_text FROM scene_contents WHERE node_id = ?1;",
                [source_id],
                |row| row.get(0),
            )
            .ok();

        if let Some(content) = content {
            if !merged_content.is_empty() {
                merged_content.push('\n');
                merged_plain_text.push_str("\n\n");
            }
            merged_content.push_str(&content);
            if let Some(pt) = plain_text {
                merged_plain_text.push_str(&pt);
            }
        }
    }

    // Update target with merged content
    conn.execute(
        "INSERT INTO scene_contents (node_id, content, plain_text, updated_at)
         VALUES (?1, ?2, ?3, CURRENT_TIMESTAMP)
         ON CONFLICT(node_id) DO UPDATE SET
            content = excluded.content,
            plain_text = excluded.plain_text,
            updated_at = CURRENT_TIMESTAMP;",
        (&target_id, &merged_content, &merged_plain_text),
    )
    .map_err(|e| format!("Error actualizando contenido fusionado: {}", e))?;

    // Update FTS index
    let _ = conn.execute("DELETE FROM fts_index WHERE id = ?1;", [&target_id]);
    let _ = conn.execute(
        "INSERT INTO fts_index (id, title, content, type)
         VALUES (?1, ?2, ?3, 'scene');",
        (&target_id, &target.title, &merged_plain_text),
    );

    // Delete source nodes and their contents
    for source_id in &source_ids {
        if source_id != &target_id {
            conn.execute("DELETE FROM scene_contents WHERE node_id = ?1;", [source_id])
                .map_err(|e| format!("Error eliminando contenido source: {}", e))?;
            conn.execute("DELETE FROM manuscript_nodes WHERE id = ?1;", [source_id])
                .map_err(|e| format!("Error eliminando nodo source: {}", e))?;
        }
    }

    // Return updated target
    Ok(target)
}

#[tauri::command]
pub fn split_scene_at_cursor(
    state: State<'_, AppState>,
    node_id: String,
    cursor_position: usize,
) -> Result<Vec<ManuscriptNode>, String> {
    let mut db_guard = state.db.lock().map_err(|_| "Error bloqueando estado")?;
    let conn = db_guard.as_mut().ok_or("No hay proyecto abierto")?;

    // Get original content and metadata
    let (content, plain_text): (Option<String>, Option<String>) = conn
        .query_row(
            "SELECT content, plain_text FROM scene_contents WHERE node_id = ?1;",
            [&node_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|e| format!("Contenido no encontrado: {}", e))?;

    let original_node: ManuscriptNode = conn
        .query_row(
            "SELECT id, parent_id, title, type, sort_order, status, color, tags, synopsis, writing_goals, author_notes, created_at, updated_at
             FROM manuscript_nodes WHERE id = ?1;",
            [&node_id],
            |row| {
                Ok(ManuscriptNode {
                    id: row.get(0)?,
                    parent_id: row.get(1)?,
                    title: row.get(2)?,
                    r#type: row.get(3)?,
                    sort_order: row.get(4)?,
                    status: row.get(5)?,
                    color: row.get(6)?,
                    tags: row.get(7)?,
                    synopsis: row.get(8)?,
                    writing_goals: row.get(9)?,
                    author_notes: row.get(10)?,
                    created_at: row.get(11)?,
                    updated_at: row.get(12)?,
                })
            },
        )
        .map_err(|e| format!("Nodo no encontrado: {}", e))?;

    let parent_id = original_node.parent_id.clone();
    let base_sort_order = original_node.sort_order;

    // Split the plain text at cursor position
    let text = plain_text.unwrap_or_default();
    let (first_text, second_text) = text.split_at(cursor_position.min(text.len()));

    // Create first scene with original ID and content
    let first_content = if let Some(ref c) = content {
        let first_c: String = c.chars().take(cursor_position.min(c.len())).collect();
        first_c
    } else {
        String::new()
    };

    conn.execute(
        "INSERT INTO scene_contents (node_id, content, plain_text, updated_at)
         VALUES (?1, ?2, ?3, CURRENT_TIMESTAMP)
         ON CONFLICT(node_id) DO UPDATE SET
            content = excluded.content,
            plain_text = excluded.plain_text,
            updated_at = CURRENT_TIMESTAMP;",
        (&node_id, &first_content, first_text),
    )
    .map_err(|e| format!("Error actualizando primera escena: {}", e))?;

    // Create second scene
    let second_id = Uuid::new_v4().to_string();
    let second_title = format!("{} (2)", original_node.title);

    conn.execute(
        "INSERT INTO manuscript_nodes (id, parent_id, title, type, sort_order, status, color, tags, synopsis, writing_goals, author_notes, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);",
        (
            &second_id,
            &parent_id,
            &second_title,
            &original_node.r#type,
            base_sort_order + 1,
            &original_node.status,
            &original_node.color,
            &original_node.tags,
            &original_node.synopsis,
            &original_node.writing_goals,
            &original_node.author_notes,
        ),
    )
    .map_err(|e| format!("Error creando segunda escena: {}", e))?;

    let second_content = if let Some(ref c) = content {
        let second_c: String = c.chars().skip(cursor_position).collect();
        second_c
    } else {
        String::new()
    };

    conn.execute(
        "INSERT INTO scene_contents (node_id, content, plain_text, updated_at)
         VALUES (?1, ?2, ?3, CURRENT_TIMESTAMP);",
        (&second_id, &second_content, second_text),
    )
    .map_err(|e| format!("Error creando contenido segunda escena: {}", e))?;

    // Update FTS for both
    let _ = conn.execute("DELETE FROM fts_index WHERE id = ?1;", [&node_id]);
    let _ = conn.execute(
        "INSERT INTO fts_index (id, title, content, type) VALUES (?1, ?2, ?3, 'scene');",
        (&node_id, &original_node.title, first_text),
    );
    let _ = conn.execute(
        "INSERT INTO fts_index (id, title, content, type) VALUES (?1, ?2, ?3, 'scene');",
        (&second_id, &second_title, second_text),
    );

    // Return both nodes
    let second_node = ManuscriptNode {
        id: second_id,
        parent_id,
        title: second_title,
        r#type: original_node.r#type.clone(),
        sort_order: base_sort_order + 1,
        status: original_node.status.clone(),
        color: original_node.color.clone(),
        tags: original_node.tags.clone(),
        synopsis: original_node.synopsis.clone(),
        writing_goals: original_node.writing_goals.clone(),
        author_notes: original_node.author_notes.clone(),
        created_at: original_node.created_at.clone(),
        updated_at: original_node.updated_at.clone(),
    };

    Ok(vec![original_node, second_node])
}

#[tauri::command]
pub fn split_scene_by_selection(
    state: State<'_, AppState>,
    node_id: String,
    start: usize,
    end: usize,
) -> Result<Vec<ManuscriptNode>, String> {
    let mut db_guard = state.db.lock().map_err(|_| "Error bloqueando estado")?;
    let conn = db_guard.as_mut().ok_or("No hay proyecto abierto")?;

    // Get original content and metadata
    let (content, plain_text): (Option<String>, Option<String>) = conn
        .query_row(
            "SELECT content, plain_text FROM scene_contents WHERE node_id = ?1;",
            [&node_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|e| format!("Contenido no encontrado: {}", e))?;

    let original_node: ManuscriptNode = conn
        .query_row(
            "SELECT id, parent_id, title, type, sort_order, status, color, tags, synopsis, writing_goals, author_notes, created_at, updated_at
             FROM manuscript_nodes WHERE id = ?1;",
            [&node_id],
            |row| {
                Ok(ManuscriptNode {
                    id: row.get(0)?,
                    parent_id: row.get(1)?,
                    title: row.get(2)?,
                    r#type: row.get(3)?,
                    sort_order: row.get(4)?,
                    status: row.get(5)?,
                    color: row.get(6)?,
                    tags: row.get(7)?,
                    synopsis: row.get(8)?,
                    writing_goals: row.get(9)?,
                    author_notes: row.get(10)?,
                    created_at: row.get(11)?,
                    updated_at: row.get(12)?,
                })
            },
        )
        .map_err(|e| format!("Nodo no encontrado: {}", e))?;

    let parent_id = original_node.parent_id.clone();
    let base_sort_order = original_node.sort_order;

    let text = plain_text.unwrap_or_default();
    let start_idx = start.min(text.len());
    let end_idx = end.min(text.len());

    let (before_text, rest) = text.split_at(start_idx);
    let (selected_text, after_text) = rest.split_at(end_idx.saturating_sub(start_idx));

    // First scene (before selection)
    let first_content = if let Some(ref c) = content {
        let first_c: String = c.chars().take(start_idx).collect();
        first_c
    } else {
        String::new()
    };

    conn.execute(
        "INSERT INTO scene_contents (node_id, content, plain_text, updated_at)
         VALUES (?1, ?2, ?3, CURRENT_TIMESTAMP)
         ON CONFLICT(node_id) DO UPDATE SET
            content = excluded.content,
            plain_text = excluded.plain_text,
            updated_at = CURRENT_TIMESTAMP;",
        (&node_id, &first_content, before_text),
    )
    .map_err(|e| format!("Error actualizando primera escena: {}", e))?;

    // Second scene (selection)
    let second_id = Uuid::new_v4().to_string();
    let second_title = format!("{} (2)", original_node.title);

    conn.execute(
        "INSERT INTO manuscript_nodes (id, parent_id, title, type, sort_order, status, color, tags, synopsis, writing_goals, author_notes, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);",
        (
            &second_id,
            &parent_id,
            &second_title,
            &original_node.r#type,
            base_sort_order + 1,
            &original_node.status,
            &original_node.color,
            &original_node.tags,
            &original_node.synopsis,
            &original_node.writing_goals,
            &original_node.author_notes,
        ),
    )
    .map_err(|e| format!("Error creando segunda escena: {}", e))?;

    let second_content = if let Some(ref c) = content {
        let second_c: String = c.chars().skip(start_idx).take(end_idx - start_idx).collect();
        second_c
    } else {
        String::new()
    };

    conn.execute(
        "INSERT INTO scene_contents (node_id, content, plain_text, updated_at)
         VALUES (?1, ?2, ?3, CURRENT_TIMESTAMP);",
        (&second_id, &second_content, selected_text),
    )
    .map_err(|e| format!("Error creando contenido segunda escena: {}", e))?;

    // Third scene (after selection) - if there's content after
    let third_id = if !after_text.is_empty() {
        let id = Uuid::new_v4().to_string();
        let third_title = format!("{} (3)", original_node.title);

        conn.execute(
            "INSERT INTO manuscript_nodes (id, parent_id, title, type, sort_order, status, color, tags, synopsis, writing_goals, author_notes, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);",
            (
                &id,
                &parent_id,
                &third_title,
                &original_node.r#type,
                base_sort_order + 2,
                &original_node.status,
                &original_node.color,
                &original_node.tags,
                &original_node.synopsis,
                &original_node.writing_goals,
                &original_node.author_notes,
            ),
        )
        .map_err(|e| format!("Error creando tercera escena: {}", e))?;

        let third_content = if let Some(ref c) = content {
            let third_c: String = c.chars().skip(end_idx).collect();
            third_c
        } else {
            String::new()
        };

        conn.execute(
            "INSERT INTO scene_contents (node_id, content, plain_text, updated_at)
             VALUES (?1, ?2, ?3, CURRENT_TIMESTAMP);",
            (&id, &third_content, after_text),
        )
        .map_err(|e| format!("Error creando contenido tercera escena: {}", e))?;

        Some(ManuscriptNode {
            id: id.clone(),
            parent_id: parent_id.clone(),
            title: third_title,
            r#type: original_node.r#type.clone(),
            sort_order: base_sort_order + 2,
            status: original_node.status.clone(),
            color: original_node.color.clone(),
            tags: original_node.tags.clone(),
            synopsis: original_node.synopsis.clone(),
            writing_goals: original_node.writing_goals.clone(),
            author_notes: original_node.author_notes.clone(),
            created_at: original_node.created_at.clone(),
            updated_at: original_node.updated_at.clone(),
        })
    } else {
        None
    };

    // Update FTS
    let _ = conn.execute("DELETE FROM fts_index WHERE id = ?1;", [&node_id]);
    let _ = conn.execute(
        "INSERT INTO fts_index (id, title, content, type) VALUES (?1, ?2, ?3, 'scene');",
        (&node_id, &original_node.title, before_text),
    );
    let _ = conn.execute(
        "INSERT INTO fts_index (id, title, content, type) VALUES (?1, ?2, ?3, 'scene');",
        (&second_id, &second_title, selected_text),
    );
    if let Some(ref third) = third_id {
        let _ = conn.execute(
            "INSERT INTO fts_index (id, title, content, type) VALUES (?1, ?2, ?3, 'scene');",
            (&third.id, &third.title, after_text),
        );
    }

    // Return nodes
    let second_node = ManuscriptNode {
        id: second_id,
        parent_id,
        title: second_title,
        r#type: original_node.r#type.clone(),
        sort_order: base_sort_order + 1,
        status: original_node.status.clone(),
        color: original_node.color.clone(),
        tags: original_node.tags.clone(),
        synopsis: original_node.synopsis.clone(),
        writing_goals: original_node.writing_goals.clone(),
        author_notes: original_node.author_notes.clone(),
        created_at: original_node.created_at.clone(),
        updated_at: original_node.updated_at.clone(),
    };

    let mut result = vec![original_node, second_node];
    if let Some(third) = third_id {
        result.push(third);
    }

    Ok(result)
}

// Extensión rápida para retornar un String customizado en lugar de Option para manejar errores
trait OptionExt<T> {
    fn ok_ok_or(self, err: &str) -> Result<T, String>;
}
impl<T> OptionExt<T> for Option<T> {
    fn ok_ok_or(self, err: &str) -> Result<T, String> {
        self.ok_or_else(|| err.to_string())
    }
}

#[tauri::command]
pub fn reset_project(state: State<'_, AppState>) -> Result<(), String> {
    let conn = state.db.lock().map_err(|_| "Error bloqueando estado")?;
    let conn = conn.as_ref().ok_or("No hay proyecto abierto")?;

    // Resetear project_settings a defaults
    conn.execute(
        "DELETE FROM project_settings WHERE id = 'default';",
        [],
    ).map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO project_settings (id, theme, focus_mode, auto_save_enabled, auto_save_interval_minutes, language, writing_style, spell_check_languages, updated_at, centered_writing_mode, centered_writing_position)
         VALUES ('default', 'midnight', 'standard', 1, 5, 'es', 'creative', '[\"es\",\"en\"]', CURRENT_TIMESTAMP, 0, 50);",
        [],
    ).map_err(|e| e.to_string())?;

    // Limpiar manuscript_nodes (CASCADE elimina scene_contents)
    conn.execute("DELETE FROM manuscript_nodes;", []).map_err(|e| e.to_string())?;

    // Limpiar universe_entities (CASCADE elimina entity_relations)
    conn.execute("DELETE FROM universe_entities;", []).map_err(|e| e.to_string())?;

    // Limpiar timeline
    conn.execute("DELETE FROM timeline_events;", []).map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM custom_calendars;", []).map_err(|e| e.to_string())?;

    // Limpiar commits
    conn.execute("DELETE FROM commit_changes;", []).map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM commits;", []).map_err(|e| e.to_string())?;

    // Rebuild FTS index
    conn.execute("DELETE FROM fts_index;", []).map_err(|e| e.to_string())?;

    Ok(())
}

#[derive(Serialize, Deserialize, Clone)]
pub struct RecentProject {
    pub path: String,
    pub title: String,
    pub author: Option<String>,
    pub genre: Option<String>,
    pub last_opened: String,
}

/// Ajustes de la aplicacion (no de la novela).
///
/// Se guardan en `app_settings.json`, dentro del directorio de configuracion,
/// para que apliquen a toda la aplicacion con independencia del proyecto
/// abierto.
#[derive(Serialize, Deserialize, Clone)]
#[serde(default, rename_all = "camelCase")]
pub struct AppSettings {
    /// Tema de la interfaz: midnight | aurora | noir | light
    pub theme: String,
    /// Idioma de la interfaz: es | en
    pub language: String,
    /// Ancho de la ventana en pixeles logicos.
    pub window_width: u32,
    /// Alto de la ventana en pixeles logicos.
    pub window_height: u32,
    /// Si la ventana se abre maximizada.
    pub window_maximized: bool,
    /// Si la ventana esta en pantalla completa.
    pub window_fullscreen: bool,
    /// Si se restaura el tamano guardado al arrancar.
    pub restore_window_on_start: bool,
    /// Si se abre el ultimo proyecto al arrancar.
    pub open_last_project_on_start: bool,
    /// Si se pide confirmacion antes de cerrar la aplicacion.
    pub confirm_before_close: bool,
    /// Zoom de la interfaz (1 = 100 %).
    pub interface_zoom: f64,
    /// Si la ventana se mantiene siempre encima.
    pub always_on_top: bool,
    /// Si la ventana se puede redimensionar.
    pub resizable: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme: "midnight".to_string(),
            language: "es".to_string(),
            window_width: 1280,
            window_height: 800,
            window_maximized: false,
            window_fullscreen: false,
            restore_window_on_start: true,
            open_last_project_on_start: false,
            confirm_before_close: false,
            interface_zoom: 1.0,
            always_on_top: false,
            resizable: true,
        }
    }
}

fn get_app_settings_path() -> Result<PathBuf, String> {
    Ok(get_config_dir()?.join("app_settings.json"))
}

/// Lee los ajustes de la aplicacion del disco.
///
/// Un fichero ausente o corrupto no debe impedir abrir la app: en ese caso se
/// devuelven los valores por defecto.
///
/// La escritura la hace el comando generico `save_app_settings` con la clave
/// `app_settings`, que deja el fichero en esta misma ruta.
pub fn read_app_settings() -> AppSettings {
    let path = match get_app_settings_path() {
        Ok(path) => path,
        Err(_) => return AppSettings::default(),
    };

    if !path.exists() {
        return AppSettings::default();
    }

    fs::read_to_string(&path)
        .ok()
        .and_then(|contents| serde_json::from_str::<AppSettings>(&contents).ok())
        .unwrap_or_default()
}

/// Ruta de la carpeta de datos de la aplicacion.
///
/// La usa el dialogo de ajustes para poder abrirla en el explorador.
#[tauri::command]
pub fn get_app_data_dir() -> Result<String, String> {
    Ok(get_config_dir()?.to_string_lossy().to_string())
}

/// Permite el cierre de la ventana aunque este protegido.
///
/// El manejador de `CloseRequested` bloquea el cierre cuando el usuario ha
/// activado la confirmacion; esta marca lo deja pasar.
#[tauri::command]
pub fn close_window(window: tauri::Window) {
    ALLOW_CLOSE.store(true, Ordering::Relaxed);
    let _ = window.close();
}

/// Marca de cierre autorizado (ver `close_window`).
pub static ALLOW_CLOSE: std::sync::atomic::AtomicBool =
    std::sync::atomic::AtomicBool::new(false);

/// Progreso de escritura de un proyecto cerrado.
///
/// La biblioteca lo usa para la tarjeta "Continuar donde lo dejaste": cuantas
/// escenas lleva escritas y en cual se estaba trabajando la ultima vez.
#[derive(Serialize, Deserialize, Clone, Default)]
pub struct ProjectProgress {
    /// Titulo de la ultima escena en la que se estaba trabajando.
    pub last_scene_title: Option<String>,
    /// Numero total de escenas del manuscrito.
    pub scenes_total: u32,
    /// Escenas que ya tienen contenido.
    pub scenes_written: u32,
}

#[tauri::command]
pub fn get_project_progress(path: String) -> Result<ProjectProgress, String> {
    let file_path = Path::new(&path);
    if !file_path.exists() {
        return Err("El archivo del proyecto no existe".to_string());
    }

    // Solo lectura: la biblioteca nunca debe modificar un proyecto que esta
    // cerrado. Si el fichero tiene un WAL pendiente, SQLite no puede abrirlo
    // en solo lectura, asi que se reintenta con una conexion normal (que
    // tampoco altera los datos).
    let conn = Connection::open_with_flags(file_path, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY)
        .or_else(|_| Connection::open(file_path))
        .map_err(|e| format!("Error abriendo el proyecto: {}", e))?;

    let scenes_total: u32 = conn
        .query_row(
            "SELECT COUNT(*) FROM manuscript_nodes WHERE type = 'scene';",
            [],
            |row| row.get::<_, i64>(0),
        )
        .unwrap_or(0) as u32;

    let scenes_written: u32 = conn
        .query_row(
            "SELECT COUNT(*) FROM scene_contents sc
             JOIN manuscript_nodes mn ON mn.id = sc.node_id
             WHERE mn.type = 'scene'
               AND sc.content IS NOT NULL
               AND TRIM(sc.content) != '';",
            [],
            |row| row.get::<_, i64>(0),
        )
        .unwrap_or(0) as u32;

    // El estado del workspace vive dentro del propio proyecto, asi que permite
    // recuperar la escena en la que se estaba trabajando.
    let active_scene_id = conn
        .query_row(
            "SELECT data FROM workspace_state WHERE id = 'default' LIMIT 1;",
            [],
            |row| row.get::<_, String>(0),
        )
        .ok()
        .and_then(|data| serde_json::from_str::<WorkspaceState>(&data).ok())
        .and_then(|workspace| workspace.active_scene_id);

    let last_scene_title = active_scene_id.and_then(|scene_id| {
        conn.query_row(
            "SELECT title FROM manuscript_nodes WHERE id = ?1;",
            [&scene_id],
            |row| row.get::<_, String>(0),
        )
        .ok()
    });

    Ok(ProjectProgress {
        last_scene_title,
        scenes_total,
        scenes_written,
    })
}

pub fn get_config_dir() -> Result<PathBuf, String> {
    let config_dir = dirs::config_dir()
        .ok_or("No se pudo encontrar el directorio de configuración")?
        .join("aetheria");

    if !config_dir.exists() {
        fs::create_dir_all(&config_dir)
            .map_err(|e| format!("No se pudo crear el directorio de configuración: {}", e))?;
    }

    Ok(config_dir)
}

fn get_recent_projects_path() -> Result<PathBuf, String> {
    Ok(get_config_dir()?.join("recent_projects.json"))
}

#[tauri::command]
pub fn get_recent_projects() -> Result<Vec<RecentProject>, String> {
    let path = get_recent_projects_path()?;

    if !path.exists() {
        return Ok(Vec::new());
    }

    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Error leyendo proyectos recientes: {}", e))?;

    let projects: Vec<RecentProject> = serde_json::from_str(&content)
        .unwrap_or_default();

    // Filtrar proyectos que ya no existen
    let existing: Vec<RecentProject> = projects
        .into_iter()
        .filter(|p| Path::new(&p.path).exists())
        .collect();

    Ok(existing)
}

#[tauri::command]
pub fn add_recent_project(
    path: String,
    title: String,
    author: Option<String>,
    genre: Option<String>,
) -> Result<(), String> {
    let recent_path = get_recent_projects_path()?;

    let mut projects: Vec<RecentProject> = if recent_path.exists() {
        let content = fs::read_to_string(&recent_path)
            .map_err(|e| format!("Error leyendo proyectos recientes: {}", e))?;
        serde_json::from_str(&content).unwrap_or_default()
    } else {
        Vec::new()
    };

    // Eliminar si ya existe
    projects.retain(|p| p.path != path);

    // Agregar al inicio
    projects.insert(0, RecentProject {
        path,
        title,
        author,
        genre,
        last_opened: chrono::Utc::now().to_rfc3339(),
    });

    // Mantener solo los últimos 10
    projects.truncate(10);

    let content = serde_json::to_string_pretty(&projects)
        .map_err(|e| format!("Error serializando proyectos recientes: {}", e))?;

    fs::write(&recent_path, content)
        .map_err(|e| format!("Error guardando proyectos recientes: {}", e))?;

    Ok(())
}

// Timeline commands

#[derive(Serialize, Deserialize, Clone)]
pub struct TimelineEvent {
    pub id: String,
    pub scene_id: Option<String>,
    pub calendar_id: Option<String>,
    pub year: i32,
    pub month: i32,
    pub day: i32,
    pub hour: i32,
    pub minute: i32,
    pub title: String,
    pub description: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct CustomCalendar {
    pub id: String,
    pub name: String,
    pub months_json: String,
    pub days_per_week: i32,
    pub era_name: Option<String>,
}

#[tauri::command]
pub fn get_timeline_events(state: State<'_, AppState>) -> Result<Vec<TimelineEvent>, String> {
    let db_guard = state.db.lock().map_err(|_| "Error bloqueando estado")?;
    let conn = db_guard.as_ref().ok_or("No hay proyecto abierto")?;

    let mut stmt = conn
        .prepare("SELECT id, scene_id, calendar_id, year, month, day, hour, minute, title, description FROM timeline_events ORDER BY year ASC, month ASC, day ASC, hour ASC, minute ASC;")
        .map_err(|e| e.to_string())?;

    let events = stmt
        .query_map([], |row| {
            Ok(TimelineEvent {
                id: row.get(0)?,
                scene_id: row.get(1)?,
                calendar_id: row.get(2)?,
                year: row.get(3)?,
                month: row.get(4)?,
                day: row.get(5)?,
                hour: row.get(6)?,
                minute: row.get(7)?,
                title: row.get(8)?,
                description: row.get(9)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(events)
}

#[tauri::command]
pub fn create_timeline_event(
    state: State<'_, AppState>,
    scene_id: Option<String>,
    calendar_id: Option<String>,
    year: i32,
    month: i32,
    day: i32,
    hour: i32,
    minute: i32,
    title: String,
    description: Option<String>,
) -> Result<TimelineEvent, String> {
    let db_guard = state.db.lock().map_err(|_| "Error bloqueando estado")?;
    let conn = db_guard.as_ref().ok_or("No hay proyecto abierto")?;

    let id = Uuid::new_v4().to_string();

    conn.execute(
        "INSERT INTO timeline_events (id, scene_id, calendar_id, year, month, day, hour, minute, title, description) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10);",
        (&id, &scene_id, &calendar_id, &year, &month, &day, &hour, &minute, &title, &description),
    )
    .map_err(|e| format!("Error creando evento: {}", e))?;

    Ok(TimelineEvent {
        id,
        scene_id,
        calendar_id,
        year,
        month,
        day,
        hour,
        minute,
        title,
        description,
    })
}

#[tauri::command]
pub fn update_timeline_event(
    state: State<'_, AppState>,
    id: String,
    year: i32,
    month: i32,
    day: i32,
    hour: i32,
    minute: i32,
    title: String,
    description: Option<String>,
) -> Result<TimelineEvent, String> {
    let db_guard = state.db.lock().map_err(|_| "Error bloqueando estado")?;
    let conn = db_guard.as_ref().ok_or("No hay proyecto abierto")?;

    conn.execute(
        "UPDATE timeline_events SET year = ?1, month = ?2, day = ?3, hour = ?4, minute = ?5, title = ?6, description = ?7 WHERE id = ?8;",
        (&year, &month, &day, &hour, &minute, &title, &description, &id),
    )
    .map_err(|e| format!("Error actualizando evento: {}", e))?;

    let mut stmt = conn
        .prepare("SELECT id, scene_id, calendar_id, year, month, day, hour, minute, title, description FROM timeline_events WHERE id = ?1;")
        .map_err(|e| e.to_string())?;

    let event = stmt
        .query_row([&id], |row| {
            Ok(TimelineEvent {
                id: row.get(0)?,
                scene_id: row.get(1)?,
                calendar_id: row.get(2)?,
                year: row.get(3)?,
                month: row.get(4)?,
                day: row.get(5)?,
                hour: row.get(6)?,
                minute: row.get(7)?,
                title: row.get(8)?,
                description: row.get(9)?,
            })
        })
        .map_err(|e| format!("Evento no encontrado: {}", e))?;

    Ok(event)
}

#[tauri::command]
pub fn delete_timeline_event(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let db_guard = state.db.lock().map_err(|_| "Error bloqueando estado")?;
    let conn = db_guard.as_ref().ok_or("No hay proyecto abierto")?;

    conn.execute("DELETE FROM timeline_events WHERE id = ?1;", [&id])
        .map_err(|e| format!("Error eliminando evento: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn get_calendars(state: State<'_, AppState>) -> Result<Vec<CustomCalendar>, String> {
    let db_guard = state.db.lock().map_err(|_| "Error bloqueando estado")?;
    let conn = db_guard.as_ref().ok_or("No hay proyecto abierto")?;

    let mut stmt = conn
        .prepare("SELECT id, name, months_json, days_per_week, era_name FROM custom_calendars;")
        .map_err(|e| e.to_string())?;

    let calendars = stmt
        .query_map([], |row| {
            Ok(CustomCalendar {
                id: row.get(0)?,
                name: row.get(1)?,
                months_json: row.get(2)?,
                days_per_week: row.get(3)?,
                era_name: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(calendars)
}

#[tauri::command]
pub fn create_calendar(
    state: State<'_, AppState>,
    name: String,
    months_json: String,
    days_per_week: i32,
    era_name: Option<String>,
) -> Result<CustomCalendar, String> {
    let db_guard = state.db.lock().map_err(|_| "Error bloqueando estado")?;
    let conn = db_guard.as_ref().ok_or("No hay proyecto abierto")?;

    let id = Uuid::new_v4().to_string();

    conn.execute(
        "INSERT INTO custom_calendars (id, name, months_json, days_per_week, era_name) VALUES (?1, ?2, ?3, ?4, ?5);",
        (&id, &name, &months_json, &days_per_week, &era_name),
    )
    .map_err(|e| format!("Error creando calendario: {}", e))?;

    Ok(CustomCalendar {
        id,
        name,
        months_json,
        days_per_week,
        era_name,
    })
}

#[tauri::command]
pub fn update_calendar(
    state: State<'_, AppState>,
    id: String,
    name: String,
    months_json: String,
    days_per_week: i32,
    era_name: Option<String>,
) -> Result<CustomCalendar, String> {
    let db_guard = state.db.lock().map_err(|_| "Error bloqueando estado")?;
    let conn = db_guard.as_ref().ok_or("No hay proyecto abierto")?;

    conn.execute(
        "UPDATE custom_calendars SET name = ?1, months_json = ?2, days_per_week = ?3, era_name = ?4 WHERE id = ?5;",
        (&name, &months_json, &days_per_week, &era_name, &id),
    )
    .map_err(|e| format!("Error actualizando calendario: {}", e))?;

    Ok(CustomCalendar {
        id,
        name,
        months_json,
        days_per_week,
        era_name,
    })
}

#[tauri::command]
pub fn delete_calendar(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let db_guard = state.db.lock().map_err(|_| "Error bloqueando estado")?;
    let conn = db_guard.as_ref().ok_or("No hay proyecto abierto")?;

    // Eliminar el calendario
    conn.execute("DELETE FROM custom_calendars WHERE id = ?1;", [&id])
        .map_err(|e| format!("Error eliminando calendario: {}", e))?;

    Ok(())
}

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct WorkspaceState {
    pub sidebar_expanded: bool,
    pub right_panel_expanded: bool,
    pub sidebar_width: i32,
    pub right_panel_width: i32,
    pub active_view: String,
    pub active_scene_id: Option<String>,
    pub expanded_node_ids: Vec<String>,
    pub tree_scroll_position: i32,
    pub editor_scroll_position: i32,
}

#[tauri::command]
pub fn get_workspace_state(state: State<'_, AppState>) -> Result<WorkspaceState, String> {
    let db_guard = state.db.lock().map_err(|_| "Error bloqueando estado")?;
    let conn = db_guard.as_ref().ok_or("No hay proyecto abierto")?;

    let mut stmt = conn
        .prepare("SELECT data FROM workspace_state WHERE id = 'default' LIMIT 1;")
        .map_err(|e| e.to_string())?;

    let payload = stmt
        .query_row([], |row| row.get::<_, String>(0))
        .unwrap_or_else(|_| "{}".to_string());

    Ok(serde_json::from_str(&payload).unwrap_or_else(|_| WorkspaceState {
        sidebar_expanded: true,
        right_panel_expanded: true,
        sidebar_width: 256,
        right_panel_width: 320,
        active_view: "manuscript".to_string(),
        active_scene_id: None,
        expanded_node_ids: vec![],
        tree_scroll_position: 0,
        editor_scroll_position: 0,
    }))
}

#[tauri::command]
pub fn save_workspace_state(state: State<'_, AppState>, data: WorkspaceState) -> Result<(), String> {
    let db_guard = state.db.lock().map_err(|_| "Error bloqueando estado")?;
    let conn = db_guard.as_ref().ok_or("No hay proyecto abierto")?;

    let payload = serde_json::to_string(&data).map_err(|e| format!("Error serializando: {}", e))?;

    conn.execute(
        "INSERT INTO workspace_state (id, data, updated_at)
         VALUES ('default', ?1, CURRENT_TIMESTAMP)
         ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = CURRENT_TIMESTAMP;",
        [&payload],
    )
    .map_err(|e| format!("Error guardando estado: {}", e))?;

    Ok(())
}

// ─── Lore Master Commands ─────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LoreEntity {
    pub id: String,
    pub name: String,
    pub entry_type: String,
    pub brief_description: Option<String>,
    pub category_name: String,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LoreRelation {
    pub source_id: String,
    pub source_name: String,
    pub target_id: String,
    pub target_name: String,
    pub relation_type: String,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct EntityAppearance {
    pub chapter_title: String,
    pub scene_title: String,
    pub scene_id: String,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LoreForScene {
    pub characters: Vec<LoreEntity>,
    pub locations: Vec<LoreEntity>,
    pub factions: Vec<LoreEntity>,
    pub items: Vec<LoreEntity>,
    pub events: Vec<LoreEntity>,
    pub relations: Vec<LoreRelation>,
    pub previous_appearances: std::collections::HashMap<String, Vec<EntityAppearance>>,
}

/// Extract plain text from JSON content (Lexical format)
fn extract_text_from_json_content(content: &str) -> String {
    let text = if let Ok(json) = serde_json::from_str::<serde_json::Value>(content) {
        extract_plain_text_recursive(&json)
    } else {
        content.to_string()
    };
    text.trim().to_string()
}

fn extract_plain_text_recursive(value: &serde_json::Value) -> String {
    match value {
        serde_json::Value::String(s) => s.clone(),
        serde_json::Value::Array(arr) => {
            let mut result = String::new();
            for v in arr {
                let text = extract_plain_text_recursive(v);
                if !result.is_empty() && !text.is_empty() {
                    result.push(' ');
                }
                result.push_str(&text);
            }
            result
        }
        serde_json::Value::Object(obj) => {
            let mut result = String::new();
            for (key, val) in obj {
                if key == "text" || key == "content" || key == "html" {
                    let text = extract_plain_text_recursive(val);
                    if !result.is_empty() && !text.is_empty() {
                        result.push(' ');
                    }
                    result.push_str(&text);
                }
                if key == "children" {
                    let text = extract_plain_text_recursive(val);
                    if !result.is_empty() && !text.is_empty() {
                        result.push(' ');
                    }
                    result.push_str(&text);
                }
            }
            result
        }
        _ => String::new(),
    }
}

/// Find entity names in scene text using word boundary matching
fn find_entities_in_text(text: &str, entity_names: &[(String, String)]) -> Vec<String> {
    let text_lower = text.to_lowercase();
    let mut found_ids = Vec::new();

    for (id, name) in entity_names {
        let name_lower = name.to_lowercase();
        if text_lower.contains(&name_lower) {
            // Check word boundaries
            if let Some(pos) = text_lower.find(&name_lower) {
                let before = if pos > 0 { &text_lower[..pos] } else { "" };
                let after_pos = pos + name_lower.len();
                let after = if after_pos < text_lower.len() { &text_lower[after_pos..] } else { "" };

                let valid_before = before.is_empty() || !before.chars().last().map(|c| c.is_alphanumeric()).unwrap_or(false);
                let valid_after = after.is_empty() || !after.chars().next().map(|c| c.is_alphanumeric()).unwrap_or(false);

                if valid_before && valid_after {
                    found_ids.push(id.clone());
                }
            }
        }
    }

    found_ids
}

/// Convert plain text entity names in HTML content to mention nodes
/// Only replaces text that is NOT inside existing HTML tags or attributes
fn convert_text_to_mentions(html: &str, entities: &[(String, String, String, Option<String>)]) -> String {
    // Sort entities by name length (longest first) to avoid partial replacements
    let mut sorted_entities = entities.to_vec();
    sorted_entities.sort_by(|a, b| b.1.len().cmp(&a.1.len()));

    let mut result = html.to_string();

    for entity in &sorted_entities {
        let (id, name, entry_type, _) = entity;
        // Build the mention HTML span
        let mention_html = format!(
            r#"<span data-character-mention data-id="{}" data-name="{}" data-type="{}">@{}</span>"#,
            id, name, entry_type, name
        );

        // Split HTML by tags to process only text nodes
        let parts: Vec<&str> = result.split(|c| c == '<').collect();
        let mut new_parts: Vec<String> = Vec::with_capacity(parts.len());

        for (i, part) in parts.iter().enumerate() {
            if i == 0 {
                // First part is before any tag, process it
                let processed = replace_text_with_mention(part, name, mention_html.as_str());
                new_parts.push(processed);
            } else if part.starts_with('/') || part.starts_with("span") || part.starts_with("data-character-mention") {
                // This is a closing tag or our mention tag, keep as-is
                new_parts.push(format!("<{}", part));
            } else if part.find('>').is_some() {
                // This is an opening tag, keep as-is
                new_parts.push(format!("<{}", part));
            } else {
                // This might be a text node fragment
                let processed = replace_text_with_mention(part, name, mention_html.as_str());
                new_parts.push(processed);
            }
        }

        result = new_parts.join("");
    }

    result
}

/// Replace plain text name with mention HTML, respecting word boundaries
fn replace_text_with_mention(text: &str, name: &str, mention_html: &str) -> String {
    let regex_pattern = format!(
        r"(?i)(?<![\w@])({})(?![@>\w])",
        regex::escape(name)
    );

    let re = match regex::Regex::new(&regex_pattern) {
        Ok(r) => r,
        Err(_) => return text.to_string(),
    };

    re.replace_all(text, mention_html).to_string()
}

#[tauri::command]
pub fn auto_convert_mentions(state: State<'_, AppState>, content: String) -> Result<String, String> {
    let db_guard = state.db.lock().map_err(|_| "Error locking state")?;
    let conn = db_guard.as_ref().ok_or("No project open")?;

    // Get all universe entries
    let mut entry_stmt = conn
        .prepare(
            "SELECT e.id, e.name, e.entry_type, e.brief_description, COALESCE(c.name, 'Other') as category_name
             FROM universe_entries e
             LEFT JOIN universe_categories c ON e.category_id = c.id
             ORDER BY LENGTH(e.name) DESC;",
        )
        .map_err(|e| e.to_string())?;

    let entries: Vec<(String, String, String, Option<String>)> = entry_stmt
        .query_map([], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    let result = convert_text_to_mentions(&content, &entries);

    Ok(result)
}

#[tauri::command]
pub fn get_lore_for_scene(state: State<'_, AppState>, scene_id: String) -> Result<LoreForScene, String> {
    let db_guard = state.db.lock().map_err(|_| "Error locking state")?;
    let conn = db_guard.as_ref().ok_or("No project open")?;

    // Get scene content
    let content: Option<String> = conn
        .query_row(
            "SELECT content FROM scene_contents WHERE node_id = ?1;",
            [&scene_id],
            |row| row.get(0),
        )
        .ok();

    let scene_text = content
        .map(|c| extract_text_from_json_content(&c))
        .unwrap_or_default();

    // Get all universe entries organized by type
    let mut entry_stmt = conn
        .prepare(
            "SELECT e.id, e.name, e.entry_type, e.brief_description, COALESCE(c.name, 'Other') as category_name
             FROM universe_entries e
             LEFT JOIN universe_categories c ON e.category_id = c.id
             ORDER BY e.name ASC;",
        )
        .map_err(|e| e.to_string())?;

    let entries: Vec<(String, String, String, Option<String>, String)> = entry_stmt
        .query_map([], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    // Build entity name lookup by type
    let entity_names: Vec<(String, String)> = entries.iter().map(|(id, name, _, _, _)| (id.clone(), name.clone())).collect();

    // Find which entities are mentioned in this scene
    let mentioned_ids = find_entities_in_text(&scene_text, &entity_names);
    let mentioned_set: std::collections::HashSet<String> = mentioned_ids.iter().cloned().collect();

    // Group mentioned entities by type
    let mut characters: Vec<LoreEntity> = Vec::new();
    let mut locations: Vec<LoreEntity> = Vec::new();
    let mut factions: Vec<LoreEntity> = Vec::new();
    let mut items: Vec<LoreEntity> = Vec::new();
    let mut events: Vec<LoreEntity> = Vec::new();

    for (id, name, entry_type, brief_desc, cat_name) in &entries {
        if mentioned_set.contains(id) {
            let entity = LoreEntity {
                id: id.clone(),
                name: name.clone(),
                entry_type: entry_type.clone(),
                brief_description: brief_desc.clone(),
                category_name: cat_name.clone(),
            };

            match entry_type.as_str() {
                "character" | "race" => characters.push(entity),
                "location" => locations.push(entity),
                "faction" | "organization" | "kingdom" => factions.push(entity),
                "item" => items.push(entity),
                "event" => events.push(entity),
                _ => items.push(entity),
            }
        }
    }

    // Get relations between mentioned entities
    let mut relations: Vec<LoreRelation> = Vec::new();
    if !mentioned_ids.is_empty() {
        // One placeholder per id, repeated for the source and target IN clauses
        let query = format!(
            "SELECT r.source_entry_id, COALESCE(s.name, 'Unknown'), r.target_entry_id, COALESCE(t.name, 'Unknown'), r.relation_type
             FROM universe_relations r
             LEFT JOIN universe_entries s ON r.source_entry_id = s.id
             LEFT JOIN universe_entries t ON r.target_entry_id = t.id
             WHERE r.source_entry_id IN ({}) OR r.target_entry_id IN ({})",
            mentioned_ids.iter().map(|_| "?".to_string()).collect::<Vec<_>>().join(","),
            mentioned_ids.iter().map(|_| "?".to_string()).collect::<Vec<_>>().join(",")
        );

        let mut rel_stmt = conn.prepare(&query).map_err(|e| e.to_string())?;
        // Pass IDs twice: once for source, once for target
        let mut params: Vec<&dyn rusqlite::ToSql> = Vec::new();
        for id in &mentioned_ids {
            params.push(id as &dyn rusqlite::ToSql);
            params.push(id as &dyn rusqlite::ToSql);
        }
        let rel_results: Vec<(String, String, String, String, String)> = rel_stmt
            .query_map(params.as_slice(), |row| {
                Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?))
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();

        for (src_id, src_name, tgt_id, tgt_name, rel_type) in rel_results {
            // Only include if both entities are in the scene
            if mentioned_set.contains(&src_id) && mentioned_set.contains(&tgt_id) {
                relations.push(LoreRelation {
                    source_id: src_id,
                    source_name: src_name,
                    target_id: tgt_id,
                    target_name: tgt_name,
                    relation_type: rel_type,
                });
            }
        }
    }

    // Get previous appearances for each mentioned entity (using character_appearances for characters)
    let mut previous_appearances: std::collections::HashMap<String, Vec<EntityAppearance>> = std::collections::HashMap::new();

    for entity_id in &mentioned_ids {
        // Check if this entity is a character
        let is_character: bool = entries.iter()
            .find(|(id, _, et, _, _)| id == entity_id && (et == "character" || et == "race"))
            .is_some();

        if is_character {
            let mut app_stmt = conn
                .prepare(
                    "SELECT DISTINCT m.title as chapter_title, s.title as scene_title, s.id as scene_id
                     FROM character_appearances ca
                     JOIN manuscript_nodes s ON ca.scene_id = s.id
                     JOIN manuscript_nodes m ON ca.chapter_id = m.id
                     WHERE ca.character_id = ?1 AND ca.scene_id != ?2
                     ORDER BY m.sort_order DESC, s.sort_order DESC
                     LIMIT 5;",
                )
                .map_err(|e| e.to_string())?;

            let appearances: Vec<EntityAppearance> = app_stmt
                .query_map([entity_id, &scene_id], |row| {
                    Ok(EntityAppearance {
                        chapter_title: row.get(0)?,
                        scene_title: row.get(1)?,
                        scene_id: row.get(2)?,
                    })
                })
                .map_err(|e| e.to_string())?
                .filter_map(|r| r.ok())
                .collect();

            if !appearances.is_empty() {
                previous_appearances.insert(entity_id.clone(), appearances);
            }
        }
    }

    Ok(LoreForScene {
        characters,
        locations,
        factions,
        items,
        events,
        relations,
        previous_appearances,
    })
}

// ─── App Settings (local, outside project file) ──────────────────────────────

#[tauri::command]
pub fn get_app_settings(key: String) -> Result<Option<String>, String> {
    let config_dir = get_config_dir()?;
    let file_path = config_dir.join(format!("{}.json", key));

    if !file_path.exists() {
        return Ok(None);
    }

    let content = fs::read_to_string(&file_path)
        .map_err(|e| format!("Error leyendo configuración: {}", e))?;

    Ok(Some(content))
}

#[tauri::command]
pub fn save_app_settings(key: String, value: String) -> Result<(), String> {
    let config_dir = get_config_dir()?;
    let file_path = config_dir.join(format!("{}.json", key));

    fs::write(&file_path, &value)
        .map_err(|e| format!("Error guardando configuración: {}", e))?;

    Ok(())
}

// ─── Search Commands ─────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone)]
pub struct SearchResult {
    pub id: String,
    pub title: String,
    pub snippet: String,
    pub rank: f64,
    #[serde(rename = "resultType")]
    pub result_type: String,  // "scene" | "universe"
    pub category: Option<String>,  // e.g. "character", "location" — null for scenes
    #[serde(rename = "categoryId")]
    pub category_id: Option<String>,  // category identifier for universe navigation
}

// Helper: extract plain text snippet from JSON block content
fn extract_snippet_from_content(content_json: &str, query: &str) -> String {
    // Try to parse as JSON and extract text
    if let Ok(value) = serde_json::from_str::<serde_json::Value>(content_json) {
        let texts = extract_text_from_json(&value);
        let all_text = texts.join(" ");
        if !all_text.is_empty() && all_text.to_lowercase().contains(&query.to_lowercase()) {
            let query_lower = query.to_lowercase();
            if let Some(pos) = all_text.to_lowercase().find(&query_lower) {
                // Get char indices instead of byte indices
                let chars: Vec<char> = all_text.chars().collect();
                let start = pos.saturating_sub(40).min(chars.len());
                let end = (pos + query.len() + 60).min(chars.len());
                let snippet: String = chars[start..end].iter().collect();
                let prefix = if start > 0 { "…" } else { "" };
                let suffix = if end < chars.len() { "…" } else { "" };
                return format!("{}{}{}", prefix, snippet, suffix);
            }
        }
        // Truncate to 150 chars safely
        let chars: Vec<char> = all_text.chars().collect();
        if chars.len() > 150 {
            return format!("{}…", chars[..150].iter().collect::<String>());
        }
        if !all_text.is_empty() {
            return all_text;
        }
    }
    // Fallback: treat as plain text, but first clean any HTML
    let cleaned = strip_html_tags(content_json);
    let chars: Vec<char> = cleaned.chars().collect();
    if chars.len() > 150 {
        format!("{}…", chars[..150].iter().collect::<String>())
    } else {
        cleaned
    }
}

// Strip HTML tags from text
fn strip_html_tags(html: &str) -> String {
    let mut result = String::new();
    let mut in_tag = false;
    for c in html.chars() {
        match c {
            '<' => in_tag = true,
            '>' => in_tag = false,
            _ => {
                if !in_tag {
                    result.push(c);
                }
            }
        }
    }
    result.trim().to_string()
}

// Helper: recursively extract text from JSON values
fn extract_text_from_json(value: &serde_json::Value) -> Vec<String> {
    let mut texts = Vec::new();
    match value {
        serde_json::Value::String(s) => {
            if !s.trim().is_empty() {
                texts.push(s.trim().to_string());
            }
        }
        serde_json::Value::Array(arr) => {
            for item in arr {
                texts.extend(extract_text_from_json(item));
            }
        }
        serde_json::Value::Object(obj) => {
            // Check common text fields
            let text_keys = ["text", "html", "content", "value", "attribution"];
            for key in text_keys {
                if let Some(v) = obj.get(key) {
                    texts.extend(extract_text_from_json(v));
                }
            }
            // Also check children for nested structures
            if let Some(children) = obj.get("children") {
                texts.extend(extract_text_from_json(children));
            }
        }
        _ => {}
    }
    texts
}

// Escape special FTS5 characters for safe querying
fn escape_fts_query(query: &str) -> String {
    query
        .replace('"', " ")
        .replace('*', " ")
        .replace('(', " ")
        .replace(')', " ")
        .replace(':', " ")
        .replace('^', " ")
        .replace('-', " ")
        .replace('+', " ")
        .replace("  ", " ")
        .trim()
        .to_string()
}

// Get parent chapter title for a scene
fn get_scene_parent_title(conn: &Connection, scene_id: &str) -> Option<String> {
    let parent_id: Option<String> = conn
        .query_row(
            "SELECT parent_id FROM manuscript_nodes WHERE id = ?1;",
            [scene_id],
            |row| row.get(0),
        )
        .ok()?;

    if let Some(pid) = parent_id {
        conn.query_row(
            "SELECT title FROM manuscript_nodes WHERE id = ?1;",
            [pid],
            |row| row.get(0),
        )
        .ok()
    } else {
        None
    }
}

#[tauri::command]
pub fn search_all(state: State<'_, AppState>, query: String) -> Result<Vec<SearchResult>, String> {
    let db_guard = state.db.lock().map_err(|_| "Error bloqueando estado")?;
    let conn = db_guard.as_ref().ok_or("No hay proyecto abierto")?;

    if query.trim().is_empty() {
        return Ok(Vec::new());
    }

    let mut all_results: Vec<SearchResult> = Vec::new();

    // ── Search manuscripts (FTS5) ─────────────────────────────────────────────
    // Escape special FTS5 characters and wrap in quotes for phrase search
    let fts_query = format!("\"{}\"", escape_fts_query(&query));

    // Only try FTS search if the query is valid
    if !fts_query.is_empty() && fts_query.len() > 2 {
        if let Ok(mut stmt) = conn.prepare(
            "SELECT id, title, bm25(fts_index) as rank
             FROM fts_index
             WHERE fts_index MATCH ?1 AND type = 'scene'
             ORDER BY rank
             LIMIT 50;",
        ) {
            let rows: Vec<(String, String, f64)> = stmt
                .query_map([&fts_query], |row| {
                    Ok((row.get(0)?, row.get(1)?, row.get(2)?))
                })
                .map_err(|e| e.to_string())
                .ok()
                .map(|m| m.filter_map(|r| r.ok()).collect::<Vec<_>>())
                .unwrap_or_default();

            for (scene_id, title, rank) in rows {
                let snippet = conn
                    .query_row(
                        "SELECT snippet(fts_index, 2, '<mark>', '</mark>', '…', 30) FROM fts_index WHERE id = ?1 AND type = 'scene';",
                        [&scene_id],
                        |row| row.get::<_, String>(0),
                    )
                    .unwrap_or_else(|_| title.clone());

                let chapter_title = get_scene_parent_title(conn, &scene_id);
                let full_snippet = if let Some(ch) = chapter_title {
                    format!("{} › {}", ch, snippet)
                } else {
                    snippet
                };

                all_results.push(SearchResult {
                    id: scene_id,
                    title,
                    snippet: full_snippet,
                    rank,
                    result_type: "scene".to_string(),
                    category: None,
                    category_id: None,
                });
            }
        }
    }

    // ── Search universe (new tables + legacy JSON) ───────────────────────────

    // Search in new universe tables first
    let search_pattern = format!("%{}%", query.to_lowercase());

    if let Ok(mut universe_stmt) = conn.prepare(
        "SELECT e.id, e.name, e.entry_type, e.brief_description, c.name as category_name, c.id as category_id
         FROM universe_entries e
         LEFT JOIN universe_categories c ON e.category_id = c.id
         WHERE LOWER(e.name) LIKE ?1 OR LOWER(e.brief_description) LIKE ?1
         ORDER BY e.name ASC
         LIMIT 30;",
    ) {
        let universe_rows: Vec<(String, String, String, Option<String>, Option<String>, Option<String>)> = universe_stmt
            .query_map([&search_pattern], |row| {
                Ok((
                    row.get(0)?,
                    row.get(1)?,
                    row.get(2)?,
                    row.get(3)?,
                    row.get(4)?,
                    row.get(5)?,
                ))
            })
            .ok()
            .map(|m| m.filter_map(|r| r.ok()).collect())
            .unwrap_or_default();

        for (id, name, _entry_type, brief_desc, cat_name, cat_id) in universe_rows {
            let snippet = brief_desc.unwrap_or_default();
            let chars: Vec<char> = snippet.chars().collect();
            let final_snippet = if chars.len() > 150 {
                format!("{}…", chars[..150].iter().collect::<String>())
            } else {
                snippet
            };

            all_results.push(SearchResult {
                id,
                title: name,
                snippet: final_snippet,
                rank: 0.0,
                result_type: "universe".to_string(),
                category: cat_name,
                category_id: cat_id,
            });
        }
    }

    // Also search in universe blocks content for richer results
    if let Ok(mut blocks_stmt) = conn.prepare(
        "SELECT e.id, e.name, c.name as category_name, c.id as category_id, b.content
         FROM universe_entries e
         LEFT JOIN universe_categories c ON e.category_id = c.id
         LEFT JOIN universe_blocks b ON e.id = b.entry_id
         WHERE b.content LIKE ?1 AND LOWER(e.name) NOT LIKE ?1
         ORDER BY e.name ASC
         LIMIT 20;",
    ) {
        let block_rows: Vec<(String, String, Option<String>, Option<String>, String)> = blocks_stmt
            .query_map([&search_pattern], |row| {
                Ok((
                    row.get(0)?,
                    row.get(1)?,
                    row.get(2)?,
                    row.get(3)?,
                    row.get(4)?,
                ))
            })
            .ok()
            .map(|m| m.filter_map(|r| r.ok()).collect())
            .unwrap_or_default();

        for (id, name, cat_name, cat_id, content) in block_rows {
            // Try to extract a snippet from the JSON content
            let snippet = extract_snippet_from_content(&content, &query);
            all_results.push(SearchResult {
                id,
                title: name,
                snippet,
                rank: 1.0,
                result_type: "universe".to_string(),
                category: cat_name,
                category_id: cat_id,
            });
        }
    }

    // Search legacy universe_state JSON (for data not yet migrated)
    let universe_payload: Option<String> = conn
        .query_row(
            "SELECT data FROM universe_state WHERE id = 'default' LIMIT 1;",
            [],
            |row| row.get(0),
        )
        .ok();

    if let Some(payload) = universe_payload {
        // Use serde_json::Value for flexible parsing of potentially malformed legacy data
        if let Ok(json_value) = serde_json::from_str::<serde_json::Value>(&payload) {
            let query_lower = query.to_lowercase();

            // Handle both array format and object format
            let categories_array = if json_value.is_array() {
                json_value.as_array().cloned().unwrap_or_default()
            } else if let Some(arr) = json_value.get("categories").and_then(|v| v.as_array()) {
                arr.clone()
            } else if let Some(arr) = json_value.get("entries").and_then(|v| v.as_array()) {
                arr.clone()
            } else {
                Vec::new()
            };

            for category_val in categories_array {
                let cat_name = category_val.get("name")
                    .and_then(|v| v.as_str())
                    .unwrap_or("Sin categoría")
                    .to_string();
                let cat_id = category_val.get("id")
                    .and_then(|v| v.as_str())
                    .map(String::from);

                let entries_array = category_val.get("entries")
                    .and_then(|v| v.as_array())
                    .cloned()
                    .unwrap_or_default();

                for entry_val in entries_array {
                    let entry_name = entry_val.get("name")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string();

                    if entry_name.to_lowercase().contains(&query_lower) {
                        let content_val = entry_val.get("content");
                        let snippet = content_val
                            .and_then(|v| v.as_str())
                            .map(|s| {
                                let chars: Vec<char> = s.chars().collect();
                                if chars.len() > 150 {
                                    format!("{}…", chars[..150].iter().collect::<String>())
                                } else {
                                    s.to_string()
                                }
                            })
                            .unwrap_or_default();

                        let entry_id = entry_val.get("id")
                            .and_then(|v| v.as_str())
                            .unwrap_or("unknown")
                            .to_string();

                        all_results.push(SearchResult {
                            id: entry_id,
                            title: entry_name,
                            snippet,
                            rank: 0.5,
                            result_type: "universe".to_string(),
                            category: Some(cat_name.clone()),
                            category_id: cat_id.clone(),
                        });
                    }
                }
            }
        }
    }

    // Sort all results by rank
    all_results.sort_by(|a, b| a.rank.partial_cmp(&b.rank).unwrap_or(std::cmp::Ordering::Equal));

    Ok(all_results)
}

// ─── Export Commands ──────────────────────────────────────────────────────────

use crate::export::{ExportManuscript, ExportPart, ExportChapter, ExportScene, ExportOptions, export_as_html, export_as_markdown, export_as_docx, export_as_pdf, export_as_txt, export_preview_as_html, export_preview_as_markdown, export_preview_as_txt};

fn build_export_manuscript(conn: &Connection, scene_ids: Option<Vec<String>>) -> Result<ExportManuscript, String> {
    use crate::domain::ManuscriptNode;

    // Get project metadata
    let mut meta_stmt = conn
        .prepare("SELECT title, author FROM project_metadata LIMIT 1;")
        .map_err(|e| e.to_string())?;

    let (title, author): (String, Option<String>) = meta_stmt
        .query_row([], |row| Ok((row.get(0)?, row.get(1)?)))
        .map_err(|e| format!("Error obteniendo metadatos: {}", e))?;

    // Get all nodes
    let mut nodes_stmt = conn
        .prepare("SELECT id, parent_id, title, type, synopsis FROM manuscript_nodes ORDER BY sort_order ASC;")
        .map_err(|e| e.to_string())?;

    let nodes: Vec<ManuscriptNode> = nodes_stmt
        .query_map([], |row| {
            Ok(ManuscriptNode {
                id: row.get(0)?,
                parent_id: row.get(1)?,
                title: row.get(2)?,
                r#type: row.get(3)?,
                synopsis: row.get(4)?,
                sort_order: 0,
                status: String::new(),
                color: None,
                tags: None,
                writing_goals: None,
                author_notes: None,
                created_at: None,
                updated_at: None,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    // Build hierarchy: parts -> chapters -> scenes
    let mut parts: Vec<ExportPart> = Vec::new();

    // Helper: recursively collect parts from a node (which could be a folder, part, or chapter)
    fn collect_parts(node: &ManuscriptNode, all_nodes: &[ManuscriptNode], conn: &Connection, scene_ids: &Option<Vec<String>>) -> Result<Vec<ExportPart>, String> {
        let mut parts = Vec::new();

        // Helper to check if a scene should be included
        let include_scene = |scene_id: &str| -> bool {
            match scene_ids {
                Some(ids) => ids.is_empty() || ids.contains(&scene_id.to_string()),
                None => true,
            }
        };

        // Direct chapters under this node
        let chapters: Vec<ExportChapter> = all_nodes
            .iter()
            .filter(|n| n.parent_id.as_ref() == Some(&node.id) && n.r#type == "chapter")
            .map(|chapter| {
                let scenes = all_nodes
                    .iter()
                    .filter(|s| s.parent_id.as_ref() == Some(&chapter.id) && s.r#type == "scene" && include_scene(&s.id))
                    .map(|scene| build_scene(scene, conn))
                    .filter_map(|r| r.ok())
                    .collect();
                ExportChapter {
                    title: chapter.title.clone(),
                    scenes,
                }
            })
            .collect();

        // If this node is a folder, recurse into child folders
        let child_parts: Vec<ExportPart> = if node.r#type == "folder" {
            all_nodes
                .iter()
                .filter(|n| n.parent_id.as_ref() == Some(&node.id) && n.r#type == "folder")
                .flat_map(|child_folder| collect_parts(child_folder, all_nodes, conn, scene_ids).unwrap_or_default())
                .collect()
        } else {
            Vec::new()
        };

        // If this node has chapters or is a folder with chapters, create a part
        if !chapters.is_empty() || !child_parts.is_empty() {
            let part = ExportPart {
                title: node.title.clone(),
                chapters,
            };
            parts.push(part);
        }

        parts.extend(child_parts);
        Ok(parts)
    }

    // Helper to check if a scene should be included
    let include_scene = |scene_id: &str| -> bool {
        match &scene_ids {
            Some(ids) => ids.is_empty() || ids.contains(&scene_id.to_string()),
            None => true,
        }
    };

    for node in &nodes {
        match node.r#type.as_str() {
            "part" | "folder" => {
                // part and folder both create export parts
                if let Ok(mut p) = collect_parts(&node, &nodes, conn, &scene_ids) {
                    parts.append(&mut p);
                }
            }
            "chapter" => {
                // Orphan chapter (no parent or parent is not a part/folder) - create a default part
                let parent_is_part_or_folder = node.parent_id
                    .as_ref()
                    .and_then(|pid| nodes.iter().find(|n| &n.id == pid))
                    .map(|n| n.r#type == "part" || n.r#type == "folder")
                    .unwrap_or(false);
                if !parent_is_part_or_folder {
                    let part = ExportPart {
                        title: "Sin parte".to_string(),
                        chapters: vec![build_chapter(&node, &nodes, conn, &scene_ids)?],
                    };
                    parts.push(part);
                }
            }
            "scene" => {
                // Scene without a valid parent - this is unusual but handle it
                if node.parent_id.is_none() && include_scene(&node.id) {
                    let scene = build_scene(&node, conn)?;
                    let chapter = ExportChapter {
                        title: "Sin capítulo".to_string(),
                        scenes: vec![scene],
                    };
                    let part = ExportPart {
                        title: "Sin parte".to_string(),
                        chapters: vec![chapter],
                    };
                    parts.push(part);
                }
            }
            _ => {}
        }
    }

    Ok(ExportManuscript { title, author, parts })
}

fn build_chapter(chapter_node: &ManuscriptNode, all_nodes: &[ManuscriptNode], conn: &Connection, scene_ids: &Option<Vec<String>>) -> Result<ExportChapter, String> {
    let include_scene = |scene_id: &str| -> bool {
        match scene_ids {
            Some(ids) => ids.is_empty() || ids.contains(&scene_id.to_string()),
            None => true,
        }
    };

    let mut scenes: Vec<ExportScene> = Vec::new();

    for node in all_nodes {
        if node.parent_id.as_ref() == Some(&chapter_node.id) && node.r#type == "scene" && include_scene(&node.id) {
            scenes.push(build_scene(node, conn)?);
        }
    }

    Ok(ExportChapter {
        title: chapter_node.title.clone(),
        scenes,
    })
}

fn build_scene(scene_node: &ManuscriptNode, conn: &Connection) -> Result<ExportScene, String> {
    let mut stmt = conn
        .prepare("SELECT content FROM scene_contents WHERE node_id = ?1;")
        .map_err(|e| e.to_string())?;

    let content: String = stmt
        .query_row([&scene_node.id], |row| row.get(0))
        .unwrap_or_default();

    Ok(ExportScene {
        id: scene_node.id.clone(),
        title: scene_node.title.clone(),
        content,
        synopsis: scene_node.synopsis.clone(),
        author_notes: scene_node.author_notes.clone(),
    })
}

#[tauri::command]
pub fn export_manuscript(state: State<'_, AppState>, format: String, scene_ids: Option<Vec<String>>) -> Result<Vec<u8>, String> {
    let db_guard = state.db.lock().map_err(|_| "Error bloqueando estado")?;
    let conn = db_guard.as_ref().ok_or("No hay proyecto abierto")?;

    let manuscript = build_export_manuscript(conn, scene_ids)?;

    match format.as_str() {
        "html" => Ok(export_as_html(&manuscript).into_bytes()),
        "markdown" => Ok(export_as_markdown(&manuscript).into_bytes()),
        "docx" => Ok(export_as_docx(&manuscript)),
        "pdf" => Ok(export_as_pdf(&manuscript)),
        "txt" => Ok(export_as_txt(&manuscript).into_bytes()),
        _ => Err(format!("Formato no soportado: {}", format)),
    }
}

#[tauri::command]
pub fn export_preview(state: State<'_, AppState>, format: String, scene_ids: Option<Vec<String>>, options: ExportOptions) -> Result<Vec<u8>, String> {
    let db_guard = state.db.lock().map_err(|_| "Error bloqueando estado")?;
    let conn = db_guard.as_ref().ok_or("No hay proyecto abierto")?;

    let manuscript = build_export_manuscript(conn, scene_ids)?;

    match format.as_str() {
        "html" => Ok(export_preview_as_html(&manuscript, &options).into_bytes()),
        "markdown" => Ok(export_preview_as_markdown(&manuscript, &options).into_bytes()),
        "txt" => Ok(export_preview_as_txt(&manuscript, &options).into_bytes()),
        _ => Err(format!("Formato no soportado para preview: {}", format)),
    }
}

#[tauri::command]
pub fn save_exported_file(path: String, data: Vec<u8>) -> Result<(), String> {
    fs::write(&path, &data)
        .map_err(|e| format!("Error guardando archivo: {}", e))?;
    Ok(())
}

// ─── Universe Wiki Commands ──────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WikiCategory {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub sort_order: i32,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WikiEntryType {
    pub id: String,
    pub name_es: String,
    pub name_en: String,
    pub icon: String,
    pub color: String,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WikiEntry {
    pub id: String,
    pub category_id: String,
    pub entry_type: String,
    pub name: String,
    pub brief_description: Option<String>,
    pub icon: Option<String>,
    pub cover_image_id: Option<String>,
    pub layout: String,
    pub is_featured: bool,
    pub tags: Vec<String>,
    pub metadata: serde_json::Value,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WikiBlock {
    pub id: String,
    pub entry_id: String,
    pub column_index: i32,
    pub block_order: i32,
    pub block_type: String,
    pub content: serde_json::Value,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WikiRelation {
    pub id: String,
    pub source_entry_id: String,
    pub target_entry_id: String,
    pub relation_type: String,
    pub description: Option<String>,
    pub created_at: String,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WikiData {
    pub categories: Vec<WikiCategory>,
    pub entry_types: Vec<WikiEntryType>,
    pub entries: Vec<WikiEntry>,
    pub blocks: Vec<WikiBlock>,
    pub relations: Vec<WikiRelation>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WikiEntryWithBlocks {
    pub entry: WikiEntry,
    pub blocks: Vec<WikiBlock>,
    pub relations: Vec<WikiRelation>,
}

#[tauri::command]
pub fn get_universe(state: State<'_, AppState>) -> Result<WikiData, String> {
    let db_guard = state.db.lock().map_err(|_| "Error bloqueando estado")?;
    let conn = db_guard.as_ref().ok_or("No hay proyecto abierto")?;

    // Get categories
    let mut cat_stmt = conn
        .prepare("SELECT id, name, description, icon, color, sort_order, created_at, updated_at FROM universe_categories ORDER BY sort_order ASC;")
        .map_err(|e| e.to_string())?;

    let categories: Vec<WikiCategory> = cat_stmt
        .query_map([], |row| {
            Ok(WikiCategory {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                icon: row.get(3)?,
                color: row.get(4)?,
                sort_order: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    // Get entry types
    let mut type_stmt = conn
        .prepare("SELECT id, name_es, name_en, icon, color FROM universe_entry_types;")
        .map_err(|e| e.to_string())?;

    let entry_types: Vec<WikiEntryType> = type_stmt
        .query_map([], |row| {
            Ok(WikiEntryType {
                id: row.get(0)?,
                name_es: row.get(1)?,
                name_en: row.get(2)?,
                icon: row.get(3)?,
                color: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    // Get entries
    let mut entry_stmt = conn
        .prepare("SELECT id, category_id, entry_type, name, brief_description, icon, cover_image_id, layout, is_featured, tags, metadata, created_at, updated_at FROM universe_entries ORDER BY name ASC;")
        .map_err(|e| e.to_string())?;

    let entries: Vec<WikiEntry> = entry_stmt
        .query_map([], |row| {
            let tags_str: Option<String> = row.get(9)?;
            let tags: Vec<String> = tags_str
                .and_then(|s| serde_json::from_str(&s).ok())
                .unwrap_or_default();
            let metadata_str: Option<String> = row.get(10)?;
            let metadata: serde_json::Value = metadata_str
                .and_then(|s| serde_json::from_str(&s).ok())
                .unwrap_or(serde_json::Value::Null);

            Ok(WikiEntry {
                id: row.get(0)?,
                category_id: row.get(1)?,
                entry_type: row.get(2)?,
                name: row.get(3)?,
                brief_description: row.get(4)?,
                icon: row.get(5)?,
                cover_image_id: row.get(6)?,
                layout: row.get(7)?,
                is_featured: row.get(8)?,
                tags,
                metadata,
                created_at: row.get(11)?,
                updated_at: row.get(12)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    // Get blocks
    let mut block_stmt = conn
        .prepare("SELECT id, entry_id, column_index, block_order, block_type, content, created_at, updated_at FROM universe_blocks ORDER BY block_order ASC;")
        .map_err(|e| e.to_string())?;

    let blocks: Vec<WikiBlock> = block_stmt
        .query_map([], |row| {
            let content_str: String = row.get(5)?;
            let content: serde_json::Value = serde_json::from_str(&content_str)
                .unwrap_or(serde_json::Value::Null);

            Ok(WikiBlock {
                id: row.get(0)?,
                entry_id: row.get(1)?,
                column_index: row.get(2)?,
                block_order: row.get(3)?,
                block_type: row.get(4)?,
                content,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    // Get relations
    let mut rel_stmt = conn
        .prepare("SELECT id, source_entry_id, target_entry_id, relation_type, description, created_at FROM universe_relations;")
        .map_err(|e| e.to_string())?;

    let relations: Vec<WikiRelation> = rel_stmt
        .query_map([], |row| {
            Ok(WikiRelation {
                id: row.get(0)?,
                source_entry_id: row.get(1)?,
                target_entry_id: row.get(2)?,
                relation_type: row.get(3)?,
                description: row.get(4)?,
                created_at: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(WikiData {
        categories,
        entry_types: entry_types,
        entries,
        blocks,
        relations,
    })
}

#[tauri::command]
pub fn create_universe_entry(
    state: State<'_, AppState>,
    entry: WikiEntry,
    blocks: Vec<WikiBlock>,
) -> Result<WikiEntryWithBlocks, String> {
    let db_guard = state.db.lock().map_err(|_| "Error bloqueando estado")?;
    let conn = db_guard.as_ref().ok_or("No hay proyecto abierto")?;

    let now = chrono::Utc::now().to_rfc3339();
    let tags_json = serde_json::to_string(&entry.tags).unwrap_or_else(|_| "[]".to_string());
    let metadata_json = serde_json::to_string(&entry.metadata).unwrap_or_else(|_| "{}".to_string());

    conn.execute(
        "INSERT INTO universe_entries (id, category_id, entry_type, name, brief_description, icon, cover_image_id, layout, is_featured, tags, metadata, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13);",
        (
            &entry.id,
            &entry.category_id,
            &entry.entry_type,
            &entry.name,
            &entry.brief_description,
            &entry.icon,
            &entry.cover_image_id,
            &entry.layout,
            entry.is_featured,
            &tags_json,
            &metadata_json,
            &now,
            &now,
        ),
    )
    .map_err(|e| format!("Error creando entrada: {}", e))?;

    let mut created_blocks = Vec::new();
    for mut block in blocks {
        block.id = Uuid::new_v4().to_string();
        let content_json = serde_json::to_string(&block.content).unwrap_or_else(|_| "{}".to_string());

        conn.execute(
            "INSERT INTO universe_blocks (id, entry_id, column_index, block_order, block_type, content, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8);",
            (
                &block.id,
                &entry.id,
                block.column_index,
                block.block_order,
                &block.block_type,
                &content_json,
                &now,
                &now,
            ),
        )
        .map_err(|e| format!("Error creando bloque: {}", e))?;

        block.created_at = now.clone();
        block.updated_at = now.clone();
        created_blocks.push(block);
    }

    Ok(WikiEntryWithBlocks {
        entry: WikiEntry {
            created_at: now.clone(),
            updated_at: now,
            ..entry
        },
        blocks: created_blocks,
        relations: vec![],
    })
}

#[tauri::command]
pub fn update_universe_entry(
    state: State<'_, AppState>,
    entry: WikiEntry,
    blocks: Vec<WikiBlock>,
) -> Result<WikiEntryWithBlocks, String> {
    let db_guard = state.db.lock().map_err(|_| "Error bloqueando estado")?;
    let conn = db_guard.as_ref().ok_or("No hay proyecto abierto")?;

    let now = chrono::Utc::now().to_rfc3339();
    let tags_json = serde_json::to_string(&entry.tags).unwrap_or_else(|_| "[]".to_string());
    let metadata_json = serde_json::to_string(&entry.metadata).unwrap_or_else(|_| "{}".to_string());

    conn.execute(
        "UPDATE universe_entries SET category_id = ?2, entry_type = ?3, name = ?4, brief_description = ?5, icon = ?6, cover_image_id = ?7, layout = ?8, is_featured = ?9, tags = ?10, metadata = ?11, updated_at = ?12 WHERE id = ?1;",
        (
            &entry.id,
            &entry.category_id,
            &entry.entry_type,
            &entry.name,
            &entry.brief_description,
            &entry.icon,
            &entry.cover_image_id,
            &entry.layout,
            entry.is_featured,
            &tags_json,
            &metadata_json,
            &now,
        ),
    )
    .map_err(|e| format!("Error actualizando entrada: {}", e))?;

    // Delete existing blocks and recreate
    conn.execute("DELETE FROM universe_blocks WHERE entry_id = ?1;", [&entry.id])
        .map_err(|e| format!("Error eliminando bloques: {}", e))?;

    let mut created_blocks = Vec::new();
    for mut block in blocks {
        block.id = Uuid::new_v4().to_string();
        let content_json = serde_json::to_string(&block.content).unwrap_or_else(|_| "{}".to_string());

        conn.execute(
            "INSERT INTO universe_blocks (id, entry_id, column_index, block_order, block_type, content, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8);",
            (
                &block.id,
                &entry.id,
                block.column_index,
                block.block_order,
                &block.block_type,
                &content_json,
                &now,
                &now,
            ),
        )
        .map_err(|e| format!("Error creando bloque: {}", e))?;

        block.created_at = now.clone();
        block.updated_at = now.clone();
        created_blocks.push(block);
    }

    // Get relations for this entry
    let mut rel_stmt = conn
        .prepare("SELECT id, source_entry_id, target_entry_id, relation_type, description, created_at FROM universe_relations WHERE source_entry_id = ?1 OR target_entry_id = ?1;")
        .map_err(|e| e.to_string())?;

    let relations: Vec<WikiRelation> = rel_stmt
        .query_map([&entry.id], |row| {
            Ok(WikiRelation {
                id: row.get(0)?,
                source_entry_id: row.get(1)?,
                target_entry_id: row.get(2)?,
                relation_type: row.get(3)?,
                description: row.get(4)?,
                created_at: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(WikiEntryWithBlocks {
        entry: WikiEntry {
            updated_at: now,
            ..entry
        },
        blocks: created_blocks,
        relations,
    })
}

#[tauri::command]
pub fn delete_universe_entry(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let db_guard = state.db.lock().map_err(|_| "Error bloqueando estado")?;
    let conn = db_guard.as_ref().ok_or("No hay proyecto abierto")?;

    // Blocks and relations are deleted via CASCADE
    conn.execute("DELETE FROM universe_entries WHERE id = ?1;", [&id])
        .map_err(|e| format!("Error eliminando entrada: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn create_universe_category(
    state: State<'_, AppState>,
    name: String,
    description: Option<String>,
    icon: Option<String>,
    color: Option<String>,
) -> Result<WikiCategory, String> {
    let db_guard = state.db.lock().map_err(|_| "Error bloqueando estado")?;
    let conn = db_guard.as_ref().ok_or("No hay proyecto abierto")?;

    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    let sort_order: i32 = conn
        .query_row("SELECT COALESCE(MAX(sort_order), 0) + 1 FROM universe_categories;", [], |row| row.get(0))
        .unwrap_or(0);

    conn.execute(
        "INSERT INTO universe_categories (id, name, description, icon, color, sort_order, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8);",
        (&id, &name, &description, &icon, &color, sort_order, &now, &now),
    )
    .map_err(|e| format!("Error creando categoría: {}", e))?;

    Ok(WikiCategory {
        id,
        name,
        description,
        icon,
        color,
        sort_order: sort_order,
        created_at: now.clone(),
        updated_at: now,
    })
}

#[tauri::command]
pub fn update_universe_category(
    state: State<'_, AppState>,
    id: String,
    name: String,
    description: Option<String>,
    icon: Option<String>,
    color: Option<String>,
) -> Result<WikiCategory, String> {
    let db_guard = state.db.lock().map_err(|_| "Error bloqueando estado")?;
    let conn = db_guard.as_ref().ok_or("No hay proyecto abierto")?;

    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE universe_categories SET name = ?2, description = ?3, icon = ?4, color = ?5, updated_at = ?6 WHERE id = ?1;",
        (&id, &name, &description, &icon, &color, &now),
    )
    .map_err(|e| format!("Error actualizando categoría: {}", e))?;

    let mut stmt = conn
        .prepare("SELECT id, name, description, icon, color, sort_order, created_at, updated_at FROM universe_categories WHERE id = ?1;")
        .map_err(|e| e.to_string())?;

    stmt.query_row([&id], |row| {
        Ok(WikiCategory {
            id: row.get(0)?,
            name: row.get(1)?,
            description: row.get(2)?,
            icon: row.get(3)?,
            color: row.get(4)?,
            sort_order: row.get(5)?,
            created_at: row.get(6)?,
            updated_at: row.get(7)?,
        })
    })
    .map_err(|e| format!("Categoría no encontrada: {}", e))
}

#[tauri::command]
pub fn delete_universe_category(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let db_guard = state.db.lock().map_err(|_| "Error bloqueando estado")?;
    let conn = db_guard.as_ref().ok_or("No hay proyecto abierto")?;

    // Entries are deleted via CASCADE
    conn.execute("DELETE FROM universe_categories WHERE id = ?1;", [&id])
        .map_err(|e| format!("Error eliminando categoría: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn create_universe_relation(
    state: State<'_, AppState>,
    source_entry_id: String,
    target_entry_id: String,
    relation_type: String,
    description: Option<String>,
) -> Result<WikiRelation, String> {
    let db_guard = state.db.lock().map_err(|_| "Error bloqueando estado")?;
    let conn = db_guard.as_ref().ok_or("No hay proyecto abierto")?;

    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO universe_relations (id, source_entry_id, target_entry_id, relation_type, description, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6);",
        (&id, &source_entry_id, &target_entry_id, &relation_type, &description, &now),
    )
    .map_err(|e| format!("Error creando relación: {}", e))?;

    Ok(WikiRelation {
        id,
        source_entry_id: source_entry_id,
        target_entry_id: target_entry_id,
        relation_type: relation_type,
        description,
        created_at: now,
    })
}

#[tauri::command]
pub fn delete_universe_relation(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let db_guard = state.db.lock().map_err(|_| "Error bloqueando estado")?;
    let conn = db_guard.as_ref().ok_or("No hay proyecto abierto")?;

    conn.execute("DELETE FROM universe_relations WHERE id = ?1;", [&id])
        .map_err(|e| format!("Error eliminando relación: {}", e))?;

    Ok(())
}

// ─── Asset Commands ─────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone)]
pub struct ProjectAsset {
    pub id: String,
    pub filename: String,
    pub mime_type: String,
    pub data: Vec<u8>,
    pub created_at: String,
}

#[tauri::command]
pub fn upload_asset(
    state: State<'_, AppState>,
    filename: String,
    mime_type: String,
    data: Vec<u8>,
) -> Result<ProjectAsset, String> {
    let db_guard = state.db.lock().map_err(|_| "Error bloqueando estado")?;
    let conn = db_guard.as_ref().ok_or("No hay proyecto abierto")?;

    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO project_assets (id, filename, mime_type, data, created_at) VALUES (?1, ?2, ?3, ?4, ?5);",
        (&id, &filename, &mime_type, &data, &now),
    )
    .map_err(|e| format!("Error guardando asset: {}", e))?;

    Ok(ProjectAsset {
        id,
        filename,
        mime_type,
        data,
        created_at: now,
    })
}

#[tauri::command]
pub fn get_asset(state: State<'_, AppState>, id: String) -> Result<Option<ProjectAsset>, String> {
    let db_guard = state.db.lock().map_err(|_| "Error bloqueando estado")?;
    let conn = db_guard.as_ref().ok_or("No hay proyecto abierto")?;

    let mut stmt = conn
        .prepare("SELECT id, filename, mime_type, data, created_at FROM project_assets WHERE id = ?1;")
        .map_err(|e| e.to_string())?;

    let result = stmt.query_row([&id], |row| {
        Ok(ProjectAsset {
            id: row.get(0)?,
            filename: row.get(1)?,
            mime_type: row.get(2)?,
            data: row.get(3)?,
            created_at: row.get(4)?,
        })
    });

    match result {
        Ok(asset) => Ok(Some(asset)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(format!("Error consultando asset: {}", e)),
    }
}

#[tauri::command]
pub fn get_all_assets(state: State<'_, AppState>) -> Result<Vec<ProjectAsset>, String> {
    let db_guard = state.db.lock().map_err(|_| "Error bloqueando estado")?;
    let conn = db_guard.as_ref().ok_or("No hay proyecto abierto")?;

    let mut stmt = conn
        .prepare("SELECT id, filename, mime_type, data, created_at FROM project_assets ORDER BY created_at DESC;")
        .map_err(|e| e.to_string())?;

    let assets = stmt
        .query_map([], |row| {
            Ok(ProjectAsset {
                id: row.get(0)?,
                filename: row.get(1)?,
                mime_type: row.get(2)?,
                data: row.get(3)?,
                created_at: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(assets)
}

#[tauri::command]
pub fn delete_asset(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let db_guard = state.db.lock().map_err(|_| "Error bloqueando estado")?;
    let conn = db_guard.as_ref().ok_or("No hay proyecto abierto")?;

    conn.execute("DELETE FROM project_assets WHERE id = ?1;", [&id])
        .map_err(|e| format!("Error eliminando asset: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn search_universe(state: State<'_, AppState>, query: String) -> Result<Vec<WikiEntry>, String> {
    let db_guard = state.db.lock().map_err(|_| "Error bloqueando estado")?;
    let conn = db_guard.as_ref().ok_or("No hay proyecto abierto")?;

    if query.trim().is_empty() {
        return Ok(vec![]);
    }

    let search_pattern = format!("%{}%", query.to_lowercase());

    let mut stmt = conn
        .prepare(
            "SELECT DISTINCT e.id, e.category_id, e.entry_type, e.name, e.brief_description, e.icon, e.cover_image_id, e.layout, e.is_featured, e.tags, e.metadata, e.created_at, e.updated_at
             FROM universe_entries e
             LEFT JOIN universe_blocks b ON e.id = b.entry_id
             WHERE LOWER(e.name) LIKE ?1 OR LOWER(e.brief_description) LIKE ?1 OR LOWER(b.content) LIKE ?1
             ORDER BY e.name ASC
             LIMIT 50;",
        )
        .map_err(|e| e.to_string())?;

    let entries: Vec<WikiEntry> = stmt
        .query_map([&search_pattern], |row| {
            let tags_str: Option<String> = row.get(9)?;
            let tags: Vec<String> = tags_str
                .and_then(|s| serde_json::from_str(&s).ok())
                .unwrap_or_default();
            let metadata_str: Option<String> = row.get(10)?;
            let metadata: serde_json::Value = metadata_str
                .and_then(|s| serde_json::from_str(&s).ok())
                .unwrap_or(serde_json::Value::Null);

            Ok(WikiEntry {
                id: row.get(0)?,
                category_id: row.get(1)?,
                entry_type: row.get(2)?,
                name: row.get(3)?,
                brief_description: row.get(4)?,
                icon: row.get(5)?,
                cover_image_id: row.get(6)?,
                layout: row.get(7)?,
                is_featured: row.get(8)?,
                tags,
                metadata,
                created_at: row.get(11)?,
                updated_at: row.get(12)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(entries)
}

// ─── Tab State Commands ─────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone)]
pub struct TabData {
    pub id: String,
    pub tab_type: String,
    pub title: String,
    pub icon: Option<String>,
    pub resource_id: Option<String>,
    pub is_modified: bool,
    pub state: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct RecentlyClosedTab {
    pub tab: TabData,
    pub closed_at: i64,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct TabState {
    pub tabs: Vec<TabData>,
    pub active_tab_id: Option<String>,
    pub recently_closed_tabs: Vec<RecentlyClosedTab>,
}

#[tauri::command]
pub fn get_tab_state() -> Result<TabState, String> {
    let config_dir = get_config_dir()?;
    let file_path = config_dir.join("tab_state.json");

    if !file_path.exists() {
        return Ok(TabState {
            tabs: vec![],
            active_tab_id: None,
            recently_closed_tabs: vec![],
        });
    }

    let content = fs::read_to_string(&file_path)
        .map_err(|e| format!("Error reading tab state: {}", e))?;

    serde_json::from_str(&content)
        .map_err(|e| format!("Error parsing tab state: {}", e))
}

#[tauri::command]
pub fn save_tab_state(data: TabState) -> Result<(), String> {
    let config_dir = get_config_dir()?;
    let file_path = config_dir.join("tab_state.json");

    let content = serde_json::to_string_pretty(&data)
        .map_err(|e| format!("Error serializing tab state: {}", e))?;

    fs::write(&file_path, content)
        .map_err(|e| format!("Error saving tab state: {}", e))
}

// ─── Character Tracking Commands ─────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone)]
pub struct CharacterTrackingData {
    pub character_id: String,
    pub character_name: String,
    pub character_status: String,  // "alive", "dead", "missing"
    pub total_appearances: i32,
    pub chapter_ids: Vec<String>,
    pub scene_ids: Vec<String>,
    pub first_chapter_index: i32,
    pub last_chapter_index: i32,
    pub first_appearance: Option<String>,
    pub last_appearance: Option<String>,
    pub appearance_percentage: f64,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ChapterInfo {
    pub id: String,
    pub title: String,
    pub sort_order: i32,
    pub part_id: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct SceneInfo {
    pub id: String,
    pub title: String,
    pub sort_order: i32,
    pub parent_id: String,
}

fn extract_entity_references_from_content(content: &str, character_names: &[String]) -> Vec<String> {
    // Extract entity references from scene content using plain-text matching
    // This is a fallback when no explicit reference system exists
    let mut entity_ids = Vec::new();

    // Try to parse as JSON and extract text
    let text = if let Ok(json) = serde_json::from_str::<serde_json::Value>(content) {
        extract_plain_text_from_json(&json)
    } else {
        // Fallback to raw content
        content.to_string()
    };

    // Match character names in the text
    for (i, name) in character_names.iter().enumerate() {
        let name_lower = name.to_lowercase();
        let text_lower = text.to_lowercase();

        // Simple word boundary matching
        if text_lower.contains(&name_lower) {
            // Only add if it's a reasonably standalone mention
            // This avoids matching "Kael" in "Kaelord" etc.
            let start = text_lower.find(&name_lower);
            if let Some(pos) = start {
                let before = if pos > 0 { &text_lower[..pos] } else { "" };
                let after_pos = pos + name_lower.len();
                let after = if after_pos < text_lower.len() { &text_lower[after_pos..] } else { "" };

                // Check for word boundaries (before and after should be non-alphanumeric or empty)
                let valid_before = before.is_empty() || !before.chars().last().map(|c| c.is_alphanumeric()).unwrap_or(false);
                let valid_after = after.is_empty() || !after.chars().next().map(|c| c.is_alphanumeric()).unwrap_or(false);

                if valid_before && valid_after {
                    // Get the actual character ID from the names list
                    // We use index because character_names corresponds to character_ids
                    entity_ids.push(format!("match_{}", i));
                }
            }
        }
    }

    entity_ids
}

fn extract_plain_text_from_json(value: &serde_json::Value) -> String {
    match value {
        serde_json::Value::String(s) => s.clone(),
        serde_json::Value::Array(arr) => {
            let mut result = String::new();
            for v in arr {
                let text = extract_plain_text_from_json(v);
                if !result.is_empty() && !text.is_empty() {
                    result.push(' ');
                }
                result.push_str(&text);
            }
            result
        }
        serde_json::Value::Object(obj) => {
            // Check for text fields in Lexical nodes
            let mut result = String::new();
            for (key, val) in obj {
                if key == "text" || key == "content" || key == "html" {
                    let text = extract_plain_text_from_json(val);
                    if !result.is_empty() && !text.is_empty() {
                        result.push(' ');
                    }
                    result.push_str(&text);
                }
                if key == "children" {
                    let text = extract_plain_text_from_json(val);
                    if !result.is_empty() && !text.is_empty() {
                        result.push(' ');
                    }
                    result.push_str(&text);
                }
            }
            result
        }
        _ => String::new(),
    }
}

#[tauri::command]
pub fn get_character_tracking(state: State<'_, AppState>) -> Result<Vec<CharacterTrackingData>, String> {
    let db_guard = state.db.lock().map_err(|_| "Error locking state")?;
    let conn = db_guard.as_ref().ok_or("No project open")?;

    // Get all characters (entries with entry_type = 'character')
    let mut char_stmt = conn
        .prepare("SELECT id, name, metadata FROM universe_entries WHERE entry_type = 'character' ORDER BY name ASC;")
        .map_err(|e| e.to_string())?;

    let characters: Vec<(String, String, String)> = char_stmt
        .query_map([], |row| {
            let id: String = row.get(0)?;
            let name: String = row.get(1)?;
            let metadata_str: Option<String> = row.get(2)?;
            // Extract status from metadata JSON
            let status = if let Some(meta) = metadata_str {
                if let Ok(meta_json) = serde_json::from_str::<serde_json::Value>(&meta) {
                    meta_json.get("status")
                        .and_then(|v| v.as_str())
                        .unwrap_or("alive")
                        .to_string()
                } else {
                    "alive".to_string()
                }
            } else {
                "alive".to_string()
            };
            Ok((id, name, status))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    // Get all chapters
    let mut chapter_stmt = conn
        .prepare("SELECT id, title, sort_order, parent_id FROM manuscript_nodes WHERE type = 'chapter' ORDER BY sort_order ASC;")
        .map_err(|e| e.to_string())?;

    let chapters: Vec<ChapterInfo> = chapter_stmt
        .query_map([], |row| {
            Ok(ChapterInfo {
                id: row.get(0)?,
                title: row.get(1)?,
                sort_order: row.get(2)?,
                part_id: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    let total_chapters = chapters.len() as f64;

    // Get all appearances
    let mut appear_stmt = conn
        .prepare("SELECT character_id, scene_id, chapter_id, updated_at FROM character_appearances;")
        .map_err(|e| e.to_string())?;

    let appearances: Vec<(String, String, String, String)> = appear_stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    // Build tracking data for each character
    let mut tracking_data = Vec::new();

    for (char_id, char_name, char_status) in characters {
        // Filter appearances for this character
        let char_appearances: Vec<(String, String, String, String)> = appearances
            .iter()
            .filter(|(c_id, _, _, _)| c_id == &char_id)
            .cloned()
            .collect();

        let total = char_appearances.len() as i32;
        let mut chapter_ids: Vec<String> = char_appearances
            .iter()
            .map(|(_, _, ch_id, _)| ch_id.clone())
            .collect();
        chapter_ids.sort();
        chapter_ids.dedup();

        let mut scene_ids: Vec<String> = char_appearances
            .iter()
            .map(|(_, sc_id, _, _)| sc_id.clone())
            .collect();
        scene_ids.sort();

        // Calculate chapter indices
        let mut chapter_indices: Vec<i32> = Vec::new();
        for ch_id in &chapter_ids {
            if let Some(ch) = chapters.iter().find(|c| &c.id == ch_id) {
                chapter_indices.push(ch.sort_order);
            }
        }
        chapter_indices.sort();

        let first_chapter_index = chapter_indices.first().copied().unwrap_or(-1);
        let last_chapter_index = chapter_indices.last().copied().unwrap_or(-1);

        // Get first and last appearance dates
        let mut appear_with_dates: Vec<(String, String, String, String)> = char_appearances
            .iter()
            .filter(|(_, _, _, date)| !date.is_empty())
            .cloned()
            .collect();
        appear_with_dates.sort_by(|a, b| b.3.cmp(&a.3)); // Sort by date desc to get newest first

        let first_appearance = appear_with_dates.last().map(|(_, _, _, d)| d.clone());
        let last_appearance = appear_with_dates.first().map(|(_, _, _, d)| d.clone());

        // Calculate appearance percentage
        let appearance_percentage = if total_chapters > 0.0 {
            (chapter_ids.len() as f64 / total_chapters) * 100.0
        } else {
            0.0
        };

        tracking_data.push(CharacterTrackingData {
            character_id: char_id,
            character_name: char_name,
            character_status: char_status,
            total_appearances: total,
            chapter_ids,
            scene_ids,
            first_chapter_index,
            last_chapter_index,
            first_appearance,
            last_appearance,
            appearance_percentage,
        });
    }

    Ok(tracking_data)
}

#[tauri::command]
pub fn rebuild_character_tracking(state: State<'_, AppState>) -> Result<Vec<CharacterTrackingData>, String> {
    let db_guard = state.db.lock().map_err(|_| "Error locking state")?;
    let conn = db_guard.as_ref().ok_or("No project open")?;

    // Clear existing appearances
    conn.execute("DELETE FROM character_appearances;", [])
        .map_err(|e| format!("Error clearing appearances: {}", e))?;

    // Get all characters with their names
    let mut char_stmt = conn
        .prepare("SELECT id, name, metadata FROM universe_entries WHERE entry_type = 'character';")
        .map_err(|e| e.to_string())?;

    let characters: Vec<(String, String, String)> = char_stmt
        .query_map([], |row| {
            let id: String = row.get(0)?;
            let name: String = row.get(1)?;
            let metadata_str: Option<String> = row.get(2)?;
            let status = if let Some(meta) = metadata_str {
                if let Ok(meta_json) = serde_json::from_str::<serde_json::Value>(&meta) {
                    meta_json.get("status")
                        .and_then(|v| v.as_str())
                        .unwrap_or("alive")
                        .to_string()
                } else {
                    "alive".to_string()
                }
            } else {
                "alive".to_string()
            };
            Ok((id, name, status))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    let character_names: Vec<String> = characters.iter().map(|(_, name, _)| name.clone()).collect();

    // Get all scenes with their chapter parents
    let mut scene_stmt = conn
        .prepare(
            "SELECT m.id, m.parent_id FROM manuscript_nodes m WHERE m.type = 'scene';"
        )
        .map_err(|e| e.to_string())?;

    let scenes: Vec<(String, Option<String>)> = scene_stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    // For each scene, get its content and find character mentions
    let mut new_appearances = Vec::new();

    for (scene_id, parent_id) in scenes {
        // Get scene content
        let content: Option<String> = conn
            .query_row(
                "SELECT content FROM scene_contents WHERE node_id = ?1;",
                [&scene_id],
                |row| row.get(0),
            )
            .ok();

        if let Some(content) = content {
            // Get matched character indices (format: "match_N")
            let matched_indices = extract_entity_references_from_content(&content, &character_names);

            // Convert indices back to character IDs
            for matched in matched_indices {
                if matched.starts_with("match_") {
                    if let Ok(idx) = matched.replace("match_", "").parse::<usize>() {
                        if idx < characters.len() {
                            let (char_id, _char_name, _char_status) = &characters[idx];

                            // Find the chapter ID
                            let chapter_id = if let Some(p_id) = &parent_id {
                                // Check if parent is a chapter
                                let is_chapter: Option<String> = conn
                                    .query_row(
                                        "SELECT id FROM manuscript_nodes WHERE id = ?1 AND type = 'chapter';",
                                        [p_id],
                                        |row| row.get(0),
                                    )
                                    .ok();

                                if let Some(ch_id) = is_chapter {
                                    ch_id
                                } else {
                                    // Parent might be a part, get the chapter parent
                                    let chapter_id: Option<String> = conn
                                        .query_row(
                                            "SELECT parent_id FROM manuscript_nodes WHERE id = ?1 AND type = 'chapter';",
                                            [p_id],
                                            |row| row.get(0),
                                        )
                                        .ok();
                                    chapter_id.unwrap_or_else(|| p_id.clone())
                                }
                            } else {
                                scene_id.clone() // Use scene_id as fallback
                            };

                            // Get part_id if exists
                            let part_id: Option<String> = conn
                                .query_row(
                                    "SELECT parent_id FROM manuscript_nodes WHERE id = ?1 AND type = 'part';",
                                    [&chapter_id],
                                    |row| row.get(0),
                                )
                                .ok();

                            new_appearances.push((char_id.clone(), scene_id.clone(), chapter_id.clone(), part_id));
                        }
                    }
                }
            }
        }
    }

    // Insert new appearances (deduplicated)
    let mut inserted = std::collections::HashSet::new();
    for (char_id, scene_id, chapter_id, part_id) in new_appearances {
        let key = format!("{}_{}", char_id, scene_id);
        if !inserted.contains(&key) {
            inserted.insert(key);
            let id = Uuid::new_v4().to_string();
            let now = chrono::Utc::now().to_rfc3339();

            conn.execute(
                "INSERT INTO character_appearances (id, character_id, scene_id, chapter_id, part_id, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6);",
                (&id, &char_id, &scene_id, &chapter_id, &part_id, &now),
            ).map_err(|e| format!("Error inserting appearance: {}", e))?;
        }
    }

    // Return updated tracking data
    drop(char_stmt);
    drop(scene_stmt);
    drop(db_guard);

    get_character_tracking(state)
}

#[tauri::command]
pub fn get_chapters_info(state: State<'_, AppState>) -> Result<Vec<ChapterInfo>, String> {
    let db_guard = state.db.lock().map_err(|_| "Error locking state")?;
    let conn = db_guard.as_ref().ok_or("No project open")?;

    let mut stmt = conn
        .prepare("SELECT id, title, sort_order, parent_id FROM manuscript_nodes WHERE type = 'chapter' ORDER BY sort_order ASC;")
        .map_err(|e| e.to_string())?;

    let chapters = stmt
        .query_map([], |row| {
            Ok(ChapterInfo {
                id: row.get(0)?,
                title: row.get(1)?,
                sort_order: row.get(2)?,
                part_id: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(chapters)
}

#[tauri::command]
pub fn get_scenes_for_character(state: State<'_, AppState>, character_id: String) -> Result<Vec<SceneInfo>, String> {
    let db_guard = state.db.lock().map_err(|_| "Error locking state")?;
    let conn = db_guard.as_ref().ok_or("No project open")?;

    let mut stmt = conn
        .prepare(
            "SELECT m.id, m.title, m.sort_order, m.parent_id
             FROM manuscript_nodes m
             INNER JOIN character_appearances ca ON m.id = ca.scene_id
             WHERE ca.character_id = ?1
             ORDER BY m.sort_order ASC;",
        )
        .map_err(|e| e.to_string())?;

    let scenes = stmt
        .query_map([&character_id], |row| {
            Ok(SceneInfo {
                id: row.get(0)?,
                title: row.get(1)?,
                sort_order: row.get(2)?,
                parent_id: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(scenes)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Estado con un proyecto abierto en una carpeta temporal.
    fn estado_de_prueba(root: &Path) -> (AppState, PathBuf) {
        let project = root.join("proyecto.aer");
        let conn = Connection::open(&project).unwrap();
        conn.execute(
            "CREATE TABLE IF NOT EXISTS project_metadata (
                id TEXT PRIMARY KEY, title TEXT, author TEXT, description TEXT,
                genre TEXT, synopsis TEXT, created_at TEXT, updated_at TEXT);",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO project_metadata
                (id, title, author, description, genre, synopsis, created_at, updated_at)
             VALUES ('proj-1', 'Proyecto de prueba', '', '', '', '', '', '');",
            [],
        )
        .unwrap();
        conn.execute("CREATE TABLE IF NOT EXISTS escenas (id TEXT);", [])
            .unwrap();
        conn.execute("INSERT INTO escenas VALUES ('a');", []).unwrap();

        let state = AppState::new();
        {
            let mut db = state.db.lock().unwrap();
            *db = Some(conn);
        }
        {
            let mut project_guard = state.project.lock().unwrap();
            *project_guard = Some(ProjectContext::with_root(
                "proj-1".to_string(),
                "Proyecto de prueba".to_string(),
                project.clone(),
                root.join("backups"),
            ));
        }

        (state, project)
    }

    #[test]
    fn el_backup_automatico_solo_escribe_cuando_hay_cambios() {
        let root = std::env::temp_dir().join(format!("aetheria-flush-{}", Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();
        let (state, _project) = estado_de_prueba(&root);

        // Al abrir el proyecto el estado actual aun no esta respaldado: el
        // primer ciclo escribe el backup principal.
        assert!(flush_pending_backup(&state).unwrap());

        let main = {
            let guard = state.project.lock().unwrap();
            backup::main_backup_path(guard.as_ref().unwrap()).unwrap()
        };
        assert!(main.exists(), "el backup principal debe existir");

        // Sin cambios nuevos no se vuelve a escribir.
        assert!(!flush_pending_backup(&state).unwrap());

        // Tras una escritura si hay backup nuevo.
        {
            let db = state.db.lock().unwrap();
            db.as_ref()
                .unwrap()
                .execute("INSERT INTO escenas VALUES ('b');", [])
                .unwrap();
        }
        assert!(flush_pending_backup(&state).unwrap());

        // Y de nuevo, sin cambios, no se escribe.
        assert!(!flush_pending_backup(&state).unwrap());
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn restaurar_un_snapshot_devuelve_el_proyecto_a_su_estado_anterior() {
        let root = std::env::temp_dir().join(format!("aetheria-restore-{}", Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();
        let (state, project) = estado_de_prueba(&root);

        // Se crea un snapshot del estado actual.
        let snapshot = {
            let guard = state.db.lock().unwrap();
            let conn = guard.as_ref().unwrap();
            backup::create_snapshot(conn, state.project.lock().unwrap().as_ref().unwrap()).unwrap()
        };

        // Se cambia el contenido del proyecto.
        {
            let guard = state.db.lock().unwrap();
            guard
                .as_ref()
                .unwrap()
                .execute("UPDATE escenas SET id = 'cambiado';", [])
                .unwrap();
        }
        assert_eq!(leer_escenas(&project), vec!["cambiado"]);

        // Se restaura el snapshot.
        restore_snapshot_impl(&state, &snapshot.id).unwrap();
        assert_eq!(
            leer_escenas(&project),
            vec!["a"],
            "el proyecto vuelve al estado del snapshot"
        );

        // El estado anterior tambien queda guardado, por si hay que volver atras.
        let lista = {
            let guard = state.project.lock().unwrap();
            backup::list_snapshots(guard.as_ref().unwrap()).unwrap()
        };
        assert_eq!(lista.len(), 2, "se conserva el snapshot restaurado y el de seguridad");
        let _ = fs::remove_dir_all(&root);
    }

    /// Lee los identificadores de la tabla `escenas`.
    fn leer_escenas(path: &Path) -> Vec<String> {
        let conn = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY).unwrap();
        let mut stmt = conn.prepare("SELECT id FROM escenas;").unwrap();
        let ids = stmt
            .query_map([], |row| row.get::<_, String>(0))
            .unwrap()
            .map(|r| r.unwrap())
            .collect();
        ids
    }

    #[test]
    fn abrir_un_proyecto_no_se_queda_bloqueado() {
        let root = std::env::temp_dir().join(format!("aetheria-open-{}", Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();
        let project = root.join("proyecto.aer");

        // Base de datos de proyecto valida.
        {
            let conn = Connection::open(&project).unwrap();
            conn.execute(
                "CREATE TABLE IF NOT EXISTS project_metadata (
                    id TEXT PRIMARY KEY, title TEXT, author TEXT, description TEXT,
                    genre TEXT, synopsis TEXT, created_at TEXT, updated_at TEXT);",
                [],
            )
            .unwrap();
            conn.execute(
                "INSERT INTO project_metadata
                    (id, title, author, description, genre, synopsis, created_at, updated_at)
                 VALUES (?1, 'Novela', '', '', '', '', '', '');",
                [Uuid::new_v4().to_string()],
            )
            .unwrap();
        }

        let state = std::sync::Arc::new(AppState::new());
        let ruta = project.to_string_lossy().to_string();

        // La apertura se ejecuta en un hilo aparte con un tiempo maximo: si el
        // mutex queda bloqueado, el test falla en lugar de colgarse.
        let (tx, rx) = std::sync::mpsc::channel();
        let estado_del_hilo = std::sync::Arc::clone(&state);
        std::thread::spawn(move || {
            let resultado = open_project_impl(&estado_del_hilo, &ruta);
            let _ = tx.send(resultado);
        });

        let respuesta = rx.recv_timeout(std::time::Duration::from_secs(20));
        assert!(
            respuesta.is_ok(),
            "abrir el proyecto se ha quedado bloqueado (deadlock)"
        );

        let meta = respuesta.unwrap().unwrap();
        assert_eq!(meta.title, "Novela");

        // El proyecto queda asociado a su carpeta de copias de seguridad.
        let guard = state.project.lock().unwrap();
        let ctx = guard.as_ref().unwrap();
        assert!(backup::main_backup_path(ctx).unwrap().exists());
        let carpeta = backup::project_backup_dir(ctx).unwrap();
        drop(guard);

        let _ = fs::remove_dir_all(&root);
        let _ = fs::remove_dir_all(&carpeta);
    }

    /// El frontend consume el wiki en camelCase. Los campos de Rust son
    /// snake_case y el nombre en JSON lo decide `rename_all = "camelCase"`,
    /// asi que un renombrado accidental romperia el contrato en silencio.
    #[test]
    fn el_wiki_se_sigue_serializando_en_camel_case() {
        let data = WikiData {
            categories: vec![WikiCategory {
                id: "cat-1".into(),
                name: "Personajes".into(),
                description: None,
                icon: None,
                color: None,
                sort_order: 1,
                created_at: "2026-01-01".into(),
                updated_at: "2026-01-02".into(),
            }],
            entry_types: vec![WikiEntryType {
                id: "type-1".into(),
                name_es: "Personaje".into(),
                name_en: "Character".into(),
                icon: "user".into(),
                color: "#fff".into(),
            }],
            entries: vec![WikiEntry {
                id: "entry-1".into(),
                category_id: "cat-1".into(),
                entry_type: "type-1".into(),
                name: "Ana".into(),
                brief_description: Some("Protagonista".into()),
                icon: None,
                cover_image_id: None,
                layout: "1-col".into(),
                is_featured: true,
                tags: vec![],
                metadata: serde_json::Value::Null,
                created_at: "2026-01-01".into(),
                updated_at: "2026-01-02".into(),
            }],
            blocks: vec![WikiBlock {
                id: "block-1".into(),
                entry_id: "entry-1".into(),
                column_index: 0,
                block_order: 0,
                block_type: "rich-text".into(),
                content: serde_json::Value::Null,
                created_at: "2026-01-01".into(),
                updated_at: "2026-01-02".into(),
            }],
            relations: vec![WikiRelation {
                id: "rel-1".into(),
                source_entry_id: "entry-1".into(),
                target_entry_id: "entry-2".into(),
                relation_type: "ally".into(),
                description: None,
                created_at: "2026-01-01".into(),
            }],
        };

        let json = serde_json::to_value(&data).unwrap();

        // Categorias
        let categoria = &json["categories"][0];
        assert_eq!(categoria["sortOrder"], 1);
        assert_eq!(categoria["createdAt"], "2026-01-01");
        assert_eq!(categoria["updatedAt"], "2026-01-02");

        // Tipos de entrada
        assert_eq!(json["entryTypes"][0]["nameEs"], "Personaje");
        assert_eq!(json["entryTypes"][0]["nameEn"], "Character");

        // Entradas
        let entrada = &json["entries"][0];
        assert_eq!(entrada["categoryId"], "cat-1");
        assert_eq!(entrada["entryType"], "type-1");
        assert_eq!(entrada["briefDescription"], "Protagonista");
        assert_eq!(entrada["coverImageId"], serde_json::Value::Null);
        assert_eq!(entrada["isFeatured"], true);
        assert_eq!(entrada["createdAt"], "2026-01-01");
        assert_eq!(entrada["updatedAt"], "2026-01-02");

        // Bloques
        let bloque = &json["blocks"][0];
        assert_eq!(bloque["entryId"], "entry-1");
        assert_eq!(bloque["columnIndex"], 0);
        assert_eq!(bloque["blockOrder"], 0);
        assert_eq!(bloque["blockType"], "rich-text");
        assert_eq!(bloque["createdAt"], "2026-01-01");
        assert_eq!(bloque["updatedAt"], "2026-01-02");

        // Relaciones
        let relacion = &json["relations"][0];
        assert_eq!(relacion["sourceEntryId"], "entry-1");
        assert_eq!(relacion["targetEntryId"], "entry-2");
        assert_eq!(relacion["relationType"], "ally");
        assert_eq!(relacion["createdAt"], "2026-01-01");

        // Ninguna clave en snake_case debe filtrarse al JSON.
        let texto = json.to_string();
        for clave_prohibida in [
            "sort_order",
            "created_at",
            "updated_at",
            "name_es",
            "name_en",
            "category_id",
            "entry_type",
            "brief_description",
            "cover_image_id",
            "is_featured",
            "entry_id",
            "column_index",
            "block_order",
            "block_type",
            "source_entry_id",
            "target_entry_id",
            "relation_type",
            "entry_types",
        ] {
            assert!(
                !texto.contains(clave_prohibida),
                "el JSON del wiki no debe exponer '{}'",
                clave_prohibida
            );
        }
    }

    /// El diccionario personal guarda las palabras que el usuario anade para
    /// que el corrector no las marque, y las devuelve ordenadas.
    #[test]
    fn el_diccionario_personal_guarda_y_lista_las_palabras() {
        let root = std::env::temp_dir().join(format!("aetheria-dict-{}", Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();
        let (state, _project) = estado_de_prueba(&root);

        {
            let db = state.db.lock().unwrap();
            let conn = db.as_ref().unwrap();
            conn.execute(
                "CREATE TABLE IF NOT EXISTS personal_dictionary (
                    word TEXT PRIMARY KEY,
                    language TEXT NOT NULL DEFAULT 'es',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP);",
                [],
            )
            .unwrap();
        }

        {
            let db = state.db.lock().unwrap();
            let conn = db.as_ref().unwrap();

            add_personal_dictionary_word_impl(conn, "Aelthirion", "es").unwrap();
            add_personal_dictionary_word_impl(conn, "  Valquiria  ", "es").unwrap();

            // Anadir dos veces la misma palabra no la duplica.
            add_personal_dictionary_word_impl(conn, "Aelthirion", "es").unwrap();

            let palabras = get_personal_dictionary_impl(conn).unwrap();
            assert_eq!(palabras.len(), 2);
            assert_eq!(palabras[0].word, "Aelthirion");
            assert_eq!(palabras[1].word, "Valquiria");
            assert_eq!(palabras[0].language, "es");

            // Una palabra vacia se rechaza.
            assert!(add_personal_dictionary_word_impl(conn, "   ", "es").is_err());

            remove_personal_dictionary_word_impl(conn, "Aelthirion").unwrap();
            let palabras = get_personal_dictionary_impl(conn).unwrap();
            assert_eq!(palabras.len(), 1);
            assert_eq!(palabras[0].word, "Valquiria");
        }

        let _ = fs::remove_dir_all(&root);
    }
}
