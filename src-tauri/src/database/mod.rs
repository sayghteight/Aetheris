use rusqlite::{Connection, Result};

pub fn initialize_database(conn: &Connection) -> Result<()> {
    conn.execute("PRAGMA foreign_keys = ON;", [])?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS project_metadata (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            author TEXT,
            description TEXT,
            genre TEXT,
            synopsis TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS project_assets (
            id TEXT PRIMARY KEY,
            filename TEXT NOT NULL,
            mime_type TEXT NOT NULL,
            data BLOB NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS manuscript_nodes (
            id TEXT PRIMARY KEY,
            parent_id TEXT,
            title TEXT NOT NULL,
            type TEXT CHECK(type IN ('part', 'chapter', 'scene', 'folder')) NOT NULL,
            sort_order INTEGER NOT NULL,
            status TEXT CHECK(status IN ('draft', 'review', 'final')) DEFAULT 'draft',
            color TEXT,
            tags TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(parent_id) REFERENCES manuscript_nodes(id) ON DELETE CASCADE
        );",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS scene_contents (
            node_id TEXT PRIMARY KEY,
            content TEXT,
            plain_text TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(node_id) REFERENCES manuscript_nodes(id) ON DELETE CASCADE
        );",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS universe_entities (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            type TEXT CHECK(type IN ('character', 'location', 'item', 'race', 'organization', 'note', 'research')) NOT NULL,
            description TEXT,
            content TEXT,
            attributes TEXT,
            avatar_asset_id TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(avatar_asset_id) REFERENCES project_assets(id) ON DELETE SET NULL
        );",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS universe_state (
            id TEXT PRIMARY KEY,
            data TEXT NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS entity_relations (
            source_id TEXT,
            target_id TEXT,
            relation_type TEXT NOT NULL,
            description TEXT,
            PRIMARY KEY (source_id, target_id, relation_type),
            FOREIGN KEY(source_id) REFERENCES universe_entities(id) ON DELETE CASCADE,
            FOREIGN KEY(target_id) REFERENCES universe_entities(id) ON DELETE CASCADE
        );",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS custom_calendars (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            months_json TEXT NOT NULL,
            days_per_week INTEGER DEFAULT 7,
            era_name TEXT
        );",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS timeline_events (
            id TEXT PRIMARY KEY,
            scene_id TEXT,
            calendar_id TEXT,
            year INTEGER NOT NULL,
            month INTEGER NOT NULL,
            day INTEGER NOT NULL,
            hour INTEGER DEFAULT 0,
            minute INTEGER DEFAULT 0,
            title TEXT NOT NULL,
            description TEXT,
            FOREIGN KEY(scene_id) REFERENCES manuscript_nodes(id) ON DELETE SET NULL,
            FOREIGN KEY(calendar_id) REFERENCES custom_calendars(id) ON DELETE SET NULL
        );",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS commits (
            id TEXT PRIMARY KEY,
            parent_id TEXT,
            message TEXT,
            author TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        );",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS commit_changes (
            commit_id TEXT,
            node_id TEXT,
            patch TEXT,
            PRIMARY KEY (commit_id, node_id),
            FOREIGN KEY(commit_id) REFERENCES commits(id) ON DELETE CASCADE
        );",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS project_settings (
            id TEXT PRIMARY KEY,
            theme TEXT NOT NULL DEFAULT 'midnight',
            focus_mode TEXT NOT NULL DEFAULT 'standard',
            auto_save_enabled INTEGER NOT NULL DEFAULT 1,
            auto_save_interval_minutes INTEGER NOT NULL DEFAULT 5,
            language TEXT NOT NULL DEFAULT 'es',
            writing_style TEXT NOT NULL DEFAULT 'creative',
            spell_check_languages TEXT NOT NULL DEFAULT '[\"es\",\"en\"]',
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            centered_writing_mode INTEGER NOT NULL DEFAULT 0,
            centered_writing_position INTEGER NOT NULL DEFAULT 50
        );",
        [],
    )?;

    // IMPORTANTE: Hacer la migración ANTES del INSERT
    // Si la tabla existente no tiene la columna spell_check_languages, recrearla
    let column_count: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM pragma_table_info('project_settings') WHERE name = 'spell_check_languages';",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    if column_count == 0 {
        // La tabla existente no tiene la columna - Recrear
        conn.execute(
            "CREATE TABLE project_settings_new (
                id TEXT PRIMARY KEY,
                theme TEXT NOT NULL DEFAULT 'midnight',
                focus_mode TEXT NOT NULL DEFAULT 'standard',
                auto_save_enabled INTEGER NOT NULL DEFAULT 1,
                auto_save_interval_minutes INTEGER NOT NULL DEFAULT 5,
                language TEXT NOT NULL DEFAULT 'es',
                writing_style TEXT NOT NULL DEFAULT 'creative',
                spell_check_languages TEXT NOT NULL DEFAULT '[\"es\",\"en\"]',
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );",
            [],
        )?;

        // Copiar datos (sin la columna nueva, usará el DEFAULT)
        conn.execute(
            "INSERT INTO project_settings_new (id, theme, focus_mode, auto_save_enabled, auto_save_interval_minutes, language, writing_style, updated_at)
             SELECT id, theme, focus_mode, auto_save_enabled, auto_save_interval_minutes, language, writing_style, updated_at FROM project_settings;",
            [],
        )?;

        conn.execute("DROP TABLE project_settings;", [])?;
        conn.execute("ALTER TABLE project_settings_new RENAME TO project_settings;", [])?;
    }

    // Migración para centered_writing_mode y centered_writing_position
    let centered_column_count: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM pragma_table_info('project_settings') WHERE name = 'centered_writing_mode';",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    if centered_column_count == 0 {
        conn.execute(
            "ALTER TABLE project_settings ADD COLUMN centered_writing_mode INTEGER NOT NULL DEFAULT 0;",
            [],
        )?;
        conn.execute(
            "ALTER TABLE project_settings ADD COLUMN centered_writing_position INTEGER NOT NULL DEFAULT 50;",
            [],
        )?;
    }

    // AHORA insertar la fila default si no existe (después de la migración)
    conn.execute(
        "INSERT INTO project_settings (id, theme, focus_mode, auto_save_enabled, auto_save_interval_minutes, language, writing_style, spell_check_languages, updated_at, centered_writing_mode, centered_writing_position)
         SELECT 'default', 'midnight', 'standard', 1, 5, 'es', 'creative', '[\"es\",\"en\"]', CURRENT_TIMESTAMP, 0, 50
         WHERE NOT EXISTS (SELECT 1 FROM project_settings WHERE id = 'default');",
        [],
    )?;

    conn.execute(
        "CREATE VIRTUAL TABLE IF NOT EXISTS fts_index USING fts5(
            id,
            title,
            content,
            type
        );",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS workspace_state (
            id TEXT PRIMARY KEY DEFAULT 'default',
            data TEXT NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );",
        [],
    )?;

    // Migración 1 → 2: agregar columnas de metadatos a manuscript_nodes
    let has_synopsis: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM pragma_table_info('manuscript_nodes') WHERE name = 'synopsis';",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    if has_synopsis == 0 {
        // Recrear tabla con las nuevas columnas
        conn.execute(
            "CREATE TABLE manuscript_nodes_new (
                id TEXT PRIMARY KEY,
                parent_id TEXT,
                title TEXT NOT NULL,
                type TEXT CHECK(type IN ('part', 'chapter', 'scene', 'folder')) NOT NULL,
                sort_order INTEGER NOT NULL,
                status TEXT CHECK(status IN ('draft', 'review', 'final')) DEFAULT 'draft',
                color TEXT,
                tags TEXT,
                synopsis TEXT,
                writing_goals TEXT,
                author_notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(parent_id) REFERENCES manuscript_nodes(id) ON DELETE CASCADE
            );",
            [],
        )?;

        conn.execute(
            "INSERT INTO manuscript_nodes_new (id, parent_id, title, type, sort_order, status, color, tags, created_at, updated_at)
             SELECT id, parent_id, title, type, sort_order, status, color, tags, created_at, updated_at FROM manuscript_nodes;",
            [],
        )?;

        conn.execute("DROP TABLE manuscript_nodes;", [])?;
        conn.execute("ALTER TABLE manuscript_nodes_new RENAME TO manuscript_nodes;", [])?;
    }

    // ─── Universe Wiki Tables ─────────────────────────────────────────────────
    // Only create if they don't exist (user_version check handles upgrades)

    // Entry types enum table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS universe_entry_types (
            id TEXT PRIMARY KEY,
            name_es TEXT NOT NULL,
            name_en TEXT NOT NULL,
            icon TEXT NOT NULL,
            color TEXT NOT NULL
        );",
        [],
    )?;

    // Categories
    conn.execute(
        "CREATE TABLE IF NOT EXISTS universe_categories (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            icon TEXT,
            color TEXT,
            sort_order INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );",
        [],
    )?;

    // Entries
    conn.execute(
        "CREATE TABLE IF NOT EXISTS universe_entries (
            id TEXT PRIMARY KEY,
            category_id TEXT NOT NULL,
            entry_type TEXT NOT NULL,
            name TEXT NOT NULL,
            brief_description TEXT,
            icon TEXT,
            cover_image_id TEXT,
            layout TEXT DEFAULT '1-col',
            is_featured INTEGER DEFAULT 0,
            tags TEXT,
            metadata TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (category_id) REFERENCES universe_categories(id) ON DELETE CASCADE,
            FOREIGN KEY (entry_type) REFERENCES universe_entry_types(id)
        );",
        [],
    )?;

    // Blocks
    conn.execute(
        "CREATE TABLE IF NOT EXISTS universe_blocks (
            id TEXT PRIMARY KEY,
            entry_id TEXT NOT NULL,
            column_index INTEGER NOT NULL,
            block_order INTEGER NOT NULL,
            block_type TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (entry_id) REFERENCES universe_entries(id) ON DELETE CASCADE
        );",
        [],
    )?;

    // Relations
    conn.execute(
        "CREATE TABLE IF NOT EXISTS universe_relations (
            id TEXT PRIMARY KEY,
            source_entry_id TEXT NOT NULL,
            target_entry_id TEXT NOT NULL,
            relation_type TEXT NOT NULL,
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (source_entry_id) REFERENCES universe_entries(id) ON DELETE CASCADE,
            FOREIGN KEY (target_entry_id) REFERENCES universe_entries(id) ON DELETE CASCADE
        );",
        [],
    )?;

    // ─── Universe Wiki Seed Data ───────────────────────────────────────────────
    // Seed default entry types if table is empty
    let type_count: i32 = conn
        .query_row("SELECT COUNT(*) FROM universe_entry_types;", [], |row| row.get(0))
        .unwrap_or(0);

    if type_count == 0 {
        conn.execute(
            "INSERT INTO universe_entry_types (id, name_es, name_en, icon, color) VALUES
            ('character', 'Personaje', 'Character', 'user', '#e879f9'),
            ('location', 'Lugar', 'Location', 'map-pin', '#4ade80'),
            ('faction', 'Faccion', 'Faction', 'users', '#f59e0b'),
            ('kingdom', 'Reino', 'Kingdom', 'crown', '#a78bfa'),
            ('creature', 'Criatura', 'Creature', 'paw-print', '#f87171'),
            ('item', 'Objeto', 'Item', 'gem', '#38bdf8'),
            ('event', 'Evento', 'Event', 'calendar', '#fbbf24'),
            ('concept', 'Concepto', 'Concept', 'lightbulb', '#94a3b8'),
            ('other', 'Otro', 'Other', 'file-text', '#6ee7b7');",
            [],
        )?;
    }

    // Seed default categories if table is empty (always check, not tied to user_version)
    let cat_count: i32 = conn
        .query_row("SELECT COUNT(*) FROM universe_categories;", [], |row| row.get(0))
        .unwrap_or(0);

    if cat_count == 0 {
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO universe_categories (id, name, description, icon, color, sort_order, created_at, updated_at) VALUES
            ('cat-characters', 'Personajes', 'Definicion de perfiles, relaciones y motivaciones', 'user', '#e879f9', 0, ?1, ?2),
            ('cat-locations', 'Lugares', 'Organizacion de ubicaciones, ambientes y secretos', 'map-pin', '#4ade80', 1, ?1, ?2),
            ('cat-items', 'Objetos', 'Artefactos, reliquias y simbolos', 'gem', '#38bdf8', 2, ?1, ?2),
            ('cat-factions', 'Facciones', 'Grupos, organizaciones y alianzas', 'users', '#f59e0b', 3, ?1, ?2),
            ('cat-kingdoms', 'Reinos', 'Reinos, imperios y entidades politicas', 'crown', '#a78bfa', 4, ?1, ?2),
            ('cat-creatures', 'Criaturas', 'Bestias, monstruos y seres fantasticos', 'paw-print', '#f87171', 5, ?1, ?2),
            ('cat-events', 'Eventos', 'Sucesos historicos y momentos clave', 'calendar', '#fbbf24', 6, ?1, ?2),
            ('cat-concepts', 'Conceptos', 'Ideas, temas y elementos abstractos', 'lightbulb', '#94a3b8', 7, ?1, ?2);",
            [&now, &now],
        )?;
    }

    // ─── Migration: user_version 2 → 3 ────────────────────────────────────────
    // Check current user_version and migrate if needed
    let current_version: i32 = conn
        .query_row("PRAGMA user_version;", [], |row| row.get(0))
        .unwrap_or(2);

    if current_version < 3 {
        // Migrate legacy universe_state to new tables if they have data
        if let Err(e) = migrate_legacy_universe_if_needed(conn) {
            eprintln!("Warning: migration error: {}", e);
        }
    }

    conn.execute("PRAGMA user_version = 3;", [])?;

    Ok(())
}

// Helper function to migrate legacy universe data
fn migrate_legacy_universe_if_needed(conn: &Connection) -> Result<(), String> {
    use serde_json;

    // Check if we already migrated (check if new tables have data)
    let entry_count: i32 = conn
        .query_row("SELECT COUNT(*) FROM universe_entries;", [], |row| row.get(0))
        .unwrap_or(0);

    if entry_count > 0 {
        // Already migrated
        return Ok(());
    }

    // Check if there's legacy data to migrate
    let legacy_data: Option<String> = conn
        .query_row(
            "SELECT data FROM universe_state WHERE id = 'default' LIMIT 1;",
            [],
            |row| row.get(0),
        )
        .ok();

    if let Some(data) = legacy_data {
        if data.is_empty() || data == "[]" {
            return Ok(());
        }

        #[derive(serde::Deserialize)]
        struct LegacyEntry {
            id: String,
            name: String,
            #[serde(rename = "type")]
            entry_type: String,
            #[serde(rename = "parentId")]
            parent_id: Option<String>,
            content: String,
            #[serde(rename = "createdAt")]
            created_at: Option<String>,
        }

        #[derive(serde::Deserialize)]
        struct LegacyCategory {
            id: String,
            name: String,
            description: String,
            
            entries: Vec<LegacyEntry>,
        }

        if let Ok(categories) = serde_json::from_str::<Vec<LegacyCategory>>(&data) {
            for (idx, cat) in categories.iter().enumerate() {
                let category_id = cat.id.clone();

                // Insert category
                conn.execute(
                    "INSERT INTO universe_categories (id, name, description, sort_order) VALUES (?1, ?2, ?3, ?4);",
                    (&category_id, &cat.name, &cat.description, idx as i32),
                )
                .map_err(|e| format!("Error migrando categoría: {}", e))?;

                // Map legacy type to new entry type
                let legacy_type_to_entry_type = |t: &str| -> &str {
                    match t {
                        "folder" => "other",
                        "character" | "character_entry" => "character",
                        "location" | "location_entry" => "location",
                        "item" | "item_entry" => "item",
                        "race" => "character",
                        "organization" | "faction_entry" => "faction",
                        "note" => "concept",
                        "research" => "concept",
                        _ => "other",
                    }
                };

                // Create a default category entry type
                let default_entry_type = match cat.name.to_lowercase().as_str() {
                    n if n.contains("personaje") || n.contains("character") => "character",
                    n if n.contains("lugar") || n.contains("location") || n.contains("place") => "location",
                    n if n.contains("objeto") || n.contains("item") || n.contains("object") => "item",
                    n if n.contains("organizac") || n.contains("faction") || n.contains("guild") => "faction",
                    n if n.contains("criatura") || n.contains("creature") || n.contains("monster") => "creature",
                    n if n.contains("reino") || n.contains("kingdom") || n.contains("empire") => "kingdom",
                    n if n.contains("evento") || n.contains("event") => "event",
                    _ => "other",
                };

                for entry in &cat.entries {
                    let entry_id = entry.id.clone();
                    let entry_type = if entry.entry_type == "folder" {
                        "other".to_string()
                    } else if entry.entry_type == "entry" {
                        default_entry_type.to_string()
                    } else {
                        legacy_type_to_entry_type(&entry.entry_type).to_string()
                    };

                    let layout = "1-col";
                    let created_at = entry.created_at.clone().unwrap_or_else(|| chrono::Utc::now().to_rfc3339());

                    // Insert entry
                    conn.execute(
                        "INSERT INTO universe_entries (id, category_id, entry_type, name, brief_description, layout, created_at, updated_at)
                         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8);",
                        (&entry_id, &category_id, &entry_type, &entry.name, &entry.content, layout, &created_at, &created_at),
                    )
                    .map_err(|e| format!("Error migrando entrada: {}", e))?;

                    // If entry has content, create a rich-text block
                    if !entry.content.is_empty() {
                        let block_id = uuid::Uuid::new_v4().to_string();
                        let block_content = serde_json::json!({
                            "type": "rich-text",
                            "html": entry.content
                        }).to_string();

                        conn.execute(
                            "INSERT INTO universe_blocks (id, entry_id, column_index, block_order, block_type, content, created_at, updated_at)
                             VALUES (?1, ?2, 0, 0, 'rich-text', ?3, ?4, ?5);",
                            (&block_id, &entry_id, &block_content, &created_at, &created_at),
                        )
                        .map_err(|e| format!("Error migrando bloque: {}", e))?;
                    }
                }
            }
        }
    }

    Ok(())
}
