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
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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

    // AHORA insertar la fila default si no existe (después de la migración)
    conn.execute(
        "INSERT INTO project_settings (id, theme, focus_mode, auto_save_enabled, auto_save_interval_minutes, language, writing_style, spell_check_languages, updated_at)
         SELECT 'default', 'midnight', 'standard', 1, 5, 'es', 'creative', '[\"es\",\"en\"]', CURRENT_TIMESTAMP
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

    conn.execute("PRAGMA user_version = 2;", [])?;

    Ok(())
}
