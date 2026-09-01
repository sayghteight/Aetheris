use crate::database::initialize_database;
use crate::state::AppState;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use serde_json;
use std::fs;
use std::path::{Path, PathBuf};
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

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct ProjectSettings {
    pub theme: String,
    pub focus_mode: String,
    pub auto_save_enabled: bool,
    pub auto_save_interval_minutes: i64,
    pub language: String,
    pub writing_style: String,
    pub spell_check_languages: Vec<String>,
    pub updated_at: Option<String>,
    pub centered_writing_mode: bool,
    pub centered_writing_position: i64,
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

fn backup_project_file(path: &Path) -> Result<Option<PathBuf>, String> {
    if !path.exists() {
        return Ok(None);
    }

    let mut backup_path = path.with_extension("aer.bak");
    let mut index = 1;
    while backup_path.exists() {
        backup_path = path.with_extension(format!("aer.bak.{}", index));
        index += 1;
    }

    fs::copy(path, &backup_path)
        .map(|_| Some(backup_path))
        .map_err(|e| format!("No se pudo crear una copia de seguridad del proyecto: {}", e))
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

    if file_path.exists() {
        let _backup_path = backup_project_file(file_path)?;
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

    // Almacenar conexión en el estado global
    let mut db_guard = state.db.lock().map_err(|_| "Error bloqueando estado")?;
    *db_guard = Some(conn);

    Ok(meta)
}

#[tauri::command]
pub fn open_project(
    state: State<'_, AppState>,
    path: String,
) -> Result<ProjectMetadata, String> {
    let file_path = Path::new(&path);

    if !file_path.exists() {
        return Err("El archivo del proyecto no existe".to_string());
    }

    if file_path.extension().map_or(true, |ext| ext != "aer") {
        return Err("El archivo no tiene extensión .aer válida".to_string());
    }

    if file_path.exists() {
        let _backup_path = backup_project_file(file_path)?;
    }

    let conn = Connection::open(file_path)
        .map_err(|e| format!("Error abriendo base de datos: {}", e))?;

    // Asegurar estructura
    initialize_database(&conn)
        .map_err(|e| format!("Error actualizando estructura de datos: {}", e))?;

    // Obtener metadatos
    let meta = {
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
        .map_err(|e| format!("No se encontraron metadatos de proyecto válidos: {}", e))?
    };

    // Ahora stmt ya no existe y podemos mover la conexión
    let mut db_guard = state.db.lock().map_err(|_| "Error bloqueando estado")?;
    *db_guard = Some(conn);

    Ok(meta)
}

#[tauri::command]
pub fn get_project_settings(state: State<'_, AppState>) -> Result<ProjectSettings, String> {
    let db_guard = state.db.lock().map_err(|_| "Error bloqueando estado")?;
    let conn = db_guard.as_ref().ok_ok_or("No hay proyecto abierto")?;

    let mut stmt = conn
        .prepare(
            "SELECT theme, focus_mode, auto_save_enabled, auto_save_interval_minutes, language, writing_style, spell_check_languages, updated_at, centered_writing_mode, centered_writing_position
             FROM project_settings WHERE id = 'default' LIMIT 1;",
        )
        .map_err(|e| e.to_string())?;

    let settings = stmt
        .query_row([], |row| {
            let spell_check_languages_json: String = row.get(6)?;
            let spell_check_languages: Vec<String> = serde_json::from_str(&spell_check_languages_json).unwrap_or_else(|_| vec!["es".to_string(), "en".to_string()]);
            Ok(ProjectSettings {
                theme: row.get(0)?,
                focus_mode: row.get(1)?,
                auto_save_enabled: row.get(2)?,
                auto_save_interval_minutes: row.get(3)?,
                language: row.get(4)?,
                writing_style: row.get(5)?,
                spell_check_languages,
                updated_at: row.get(7)?,
                centered_writing_mode: row.get(8)?,
                centered_writing_position: row.get(9)?,
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

    let spell_check_languages_json = serde_json::to_string(&settings.spell_check_languages).unwrap_or_else(|_| "[\"es\",\"en\"]".to_string());

    conn.execute(
        "INSERT INTO project_settings (id, theme, focus_mode, auto_save_enabled, auto_save_interval_minutes, language, writing_style, spell_check_languages, updated_at, centered_writing_mode, centered_writing_position)
         VALUES ('default', ?1, ?2, ?3, ?4, ?5, ?6, ?7, CURRENT_TIMESTAMP, ?8, ?9)
         ON CONFLICT(id) DO UPDATE SET
            theme = excluded.theme,
            focus_mode = excluded.focus_mode,
            auto_save_enabled = excluded.auto_save_enabled,
            auto_save_interval_minutes = excluded.auto_save_interval_minutes,
            language = excluded.language,
            writing_style = excluded.writing_style,
            spell_check_languages = excluded.spell_check_languages,
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
            &spell_check_languages_json,
            settings.centered_writing_mode,
            settings.centered_writing_position,
        ),
    )
    .map_err(|e| format!("Error guardando configuración: {}", e))?;

    Ok(settings)
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
    let mut db_guard = state.db.lock().map_err(|_| "Error bloqueando estado")?;
    *db_guard = None; // Cierra la conexión implícitamente al hacer drop
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
    pub sortOrder: i32,
    pub createdAt: String,
    pub updatedAt: String,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WikiEntryType {
    pub id: String,
    pub nameEs: String,
    pub nameEn: String,
    pub icon: String,
    pub color: String,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WikiEntry {
    pub id: String,
    pub categoryId: String,
    pub entryType: String,
    pub name: String,
    pub briefDescription: Option<String>,
    pub icon: Option<String>,
    pub coverImageId: Option<String>,
    pub layout: String,
    pub isFeatured: bool,
    pub tags: Vec<String>,
    pub metadata: serde_json::Value,
    pub createdAt: String,
    pub updatedAt: String,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WikiBlock {
    pub id: String,
    pub entryId: String,
    pub columnIndex: i32,
    pub blockOrder: i32,
    pub blockType: String,
    pub content: serde_json::Value,
    pub createdAt: String,
    pub updatedAt: String,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WikiRelation {
    pub id: String,
    pub sourceEntryId: String,
    pub targetEntryId: String,
    pub relationType: String,
    pub description: Option<String>,
    pub createdAt: String,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WikiData {
    pub categories: Vec<WikiCategory>,
    pub entryTypes: Vec<WikiEntryType>,
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
                sortOrder: row.get(5)?,
                createdAt: row.get(6)?,
                updatedAt: row.get(7)?,
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
                nameEs: row.get(1)?,
                nameEn: row.get(2)?,
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
                categoryId: row.get(1)?,
                entryType: row.get(2)?,
                name: row.get(3)?,
                briefDescription: row.get(4)?,
                icon: row.get(5)?,
                coverImageId: row.get(6)?,
                layout: row.get(7)?,
                isFeatured: row.get(8)?,
                tags,
                metadata,
                createdAt: row.get(11)?,
                updatedAt: row.get(12)?,
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
                entryId: row.get(1)?,
                columnIndex: row.get(2)?,
                blockOrder: row.get(3)?,
                blockType: row.get(4)?,
                content,
                createdAt: row.get(6)?,
                updatedAt: row.get(7)?,
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
                sourceEntryId: row.get(1)?,
                targetEntryId: row.get(2)?,
                relationType: row.get(3)?,
                description: row.get(4)?,
                createdAt: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(WikiData {
        categories,
        entryTypes: entry_types,
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
            &entry.categoryId,
            &entry.entryType,
            &entry.name,
            &entry.briefDescription,
            &entry.icon,
            &entry.coverImageId,
            &entry.layout,
            entry.isFeatured,
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
                block.columnIndex,
                block.blockOrder,
                &block.blockType,
                &content_json,
                &now,
                &now,
            ),
        )
        .map_err(|e| format!("Error creando bloque: {}", e))?;

        block.createdAt = now.clone();
        block.updatedAt = now.clone();
        created_blocks.push(block);
    }

    Ok(WikiEntryWithBlocks {
        entry: WikiEntry {
            createdAt: now.clone(),
            updatedAt: now,
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
            &entry.categoryId,
            &entry.entryType,
            &entry.name,
            &entry.briefDescription,
            &entry.icon,
            &entry.coverImageId,
            &entry.layout,
            entry.isFeatured,
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
                block.columnIndex,
                block.blockOrder,
                &block.blockType,
                &content_json,
                &now,
                &now,
            ),
        )
        .map_err(|e| format!("Error creando bloque: {}", e))?;

        block.createdAt = now.clone();
        block.updatedAt = now.clone();
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
                sourceEntryId: row.get(1)?,
                targetEntryId: row.get(2)?,
                relationType: row.get(3)?,
                description: row.get(4)?,
                createdAt: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(WikiEntryWithBlocks {
        entry: WikiEntry {
            updatedAt: now,
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
        sortOrder: sort_order,
        createdAt: now.clone(),
        updatedAt: now,
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
            sortOrder: row.get(5)?,
            createdAt: row.get(6)?,
            updatedAt: row.get(7)?,
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
        sourceEntryId: source_entry_id,
        targetEntryId: target_entry_id,
        relationType: relation_type,
        description,
        createdAt: now,
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
                categoryId: row.get(1)?,
                entryType: row.get(2)?,
                name: row.get(3)?,
                briefDescription: row.get(4)?,
                icon: row.get(5)?,
                coverImageId: row.get(6)?,
                layout: row.get(7)?,
                isFeatured: row.get(8)?,
                tags,
                metadata,
                createdAt: row.get(11)?,
                updatedAt: row.get(12)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(entries)
}

