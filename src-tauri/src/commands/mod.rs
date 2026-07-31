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
            "SELECT theme, focus_mode, auto_save_enabled, auto_save_interval_minutes, language, writing_style, spell_check_languages, updated_at
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
        "INSERT INTO project_settings (id, theme, focus_mode, auto_save_enabled, auto_save_interval_minutes, language, writing_style, spell_check_languages, updated_at)
         VALUES ('default', ?1, ?2, ?3, ?4, ?5, ?6, ?7, CURRENT_TIMESTAMP)
         ON CONFLICT(id) DO UPDATE SET
            theme = excluded.theme,
            focus_mode = excluded.focus_mode,
            auto_save_enabled = excluded.auto_save_enabled,
            auto_save_interval_minutes = excluded.auto_save_interval_minutes,
            language = excluded.language,
            writing_style = excluded.writing_style,
            spell_check_languages = excluded.spell_check_languages,
            updated_at = CURRENT_TIMESTAMP;",
        (
            &settings.theme,
            &settings.focus_mode,
            settings.auto_save_enabled,
            settings.auto_save_interval_minutes,
            &settings.language,
            &settings.writing_style,
            &spell_check_languages_json,
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

    // Concatenate all scene contents
    let mut merged_content = String::new();
    let mut merged_plain_text = String::new();

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

    // Delete source nodes
    for source_id in &source_ids {
        if source_id != &target_id {
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
        "INSERT INTO fTS_index (id, title, content, type) VALUES (?1, ?2, ?3, 'scene');",
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
        "INSERT INTO project_settings (id, theme, focus_mode, auto_save_enabled, auto_save_interval_minutes, language, writing_style, spell_check_languages, updated_at)
         VALUES ('default', 'midnight', 'standard', 1, 5, 'es', 'creative', '[\"es\",\"en\"]', CURRENT_TIMESTAMP);",
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

// ─── Export Commands ──────────────────────────────────────────────────────────

use crate::export::{ExportManuscript, ExportPart, ExportChapter, ExportScene, export_as_html, export_as_markdown, export_as_docx, export_as_pdf};

fn build_export_manuscript(conn: &Connection) -> Result<ExportManuscript, String> {
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

    for node in &nodes {
        match node.r#type.as_str() {
            "part" => {
                let part = build_part(&node, &nodes, conn)?;
                parts.push(part);
            }
            "chapter" => {
                // Orphan chapter (no part) - create a default part
                if node.parent_id.is_none() {
                    let part = ExportPart {
                        title: "Sin parte".to_string(),
                        chapters: vec![build_chapter(&node, &nodes, conn)?],
                    };
                    parts.push(part);
                }
            }
            "scene" => {
                // Double orphan - add to a default part
                if node.parent_id.is_none() {
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

fn build_part(part_node: &ManuscriptNode, all_nodes: &[ManuscriptNode], conn: &Connection) -> Result<ExportPart, String> {
    let mut chapters: Vec<ExportChapter> = Vec::new();

    for node in all_nodes {
        if node.parent_id.as_ref() == Some(&part_node.id) && node.r#type == "chapter" {
            chapters.push(build_chapter(node, all_nodes, conn)?);
        }
    }

    Ok(ExportPart {
        title: part_node.title.clone(),
        chapters,
    })
}

fn build_chapter(chapter_node: &ManuscriptNode, all_nodes: &[ManuscriptNode], conn: &Connection) -> Result<ExportChapter, String> {
    let mut scenes: Vec<ExportScene> = Vec::new();

    for node in all_nodes {
        if node.parent_id.as_ref() == Some(&chapter_node.id) && node.r#type == "scene" {
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
        .prepare("SELECT plain_text FROM scene_contents WHERE node_id = ?1;")
        .map_err(|e| e.to_string())?;

    let content: String = stmt
        .query_row([&scene_node.id], |row| row.get(0))
        .unwrap_or_default();

    Ok(ExportScene {
        id: scene_node.id.clone(),
        title: scene_node.title.clone(),
        content,
        synopsis: scene_node.synopsis.clone(),
    })
}

#[tauri::command]
pub fn export_manuscript(state: State<'_, AppState>, format: String) -> Result<Vec<u8>, String> {
    let db_guard = state.db.lock().map_err(|_| "Error bloqueando estado")?;
    let conn = db_guard.as_ref().ok_or("No hay proyecto abierto")?;

    let manuscript = build_export_manuscript(conn)?;

    match format.as_str() {
        "html" => Ok(export_as_html(&manuscript).into_bytes()),
        "markdown" => Ok(export_as_markdown(&manuscript).into_bytes()),
        "docx" => Ok(export_as_docx(&manuscript)),
        "pdf" => Ok(export_as_pdf(&manuscript)),
        _ => Err(format!("Formato no soportado: {}", format)),
    }
}

#[tauri::command]
pub fn save_exported_file(path: String, data: Vec<u8>) -> Result<(), String> {
    fs::write(&path, &data)
        .map_err(|e| format!("Error guardando archivo: {}", e))?;
    Ok(())
}

