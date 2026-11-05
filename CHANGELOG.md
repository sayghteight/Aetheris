# Changelog

All notable changes to Aetheria are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.8] — November 5, 2026

### Added

#### ⚙️ Application settings
A new **application-level** settings section (not per novel), reachable from the library and
from the header of every novel:

- **Window** — fullscreen, resolution (presets, monitor size or a custom size), maximize/restore,
  center, always on top, resizable, and restoring the window size on startup.
- **Appearance** — the four themes (Midnight, Aurora, Noir and the new **Light**), interface
  language and interface zoom.
- **Writing** — font family, font size, line height, text alignment, word count visibility and
  centered writing mode with an adjustable cursor position. All of it persists between sessions.
- **Keyboard shortcuts** — shortcut recorder, conflict detection and restoring the defaults.
- **Behaviour** — autosave with a configurable interval, opening the last project on startup and
  confirming before closing.
- **Data** — open the data folder and reset the settings.

The window remembers its size and restores it on startup, and closing can ask for confirmation.

#### 💾 Centralized backups and snapshots
The old per-project `.bak` files are gone, replaced by a single backup system:

- **One main backup per project**, kept up to date automatically and written atomically. It lives
  in `AppData/Roaming/aetheria/backups/<project-id>/` and never creates extra copies.
- **Manual snapshots**, created only when you ask for them, each in its own folder, numbered and
  never overwritten.
- **Restoration** of any snapshot, with the previous state saved first so you can go back.
- **Automatic migration**: the `.bak` files left by the old system are migrated to the new one and
  then removed.
- Backups are written with `VACUUM INTO`, so the copy is always consistent, and the destination is
  replaced atomically so a failed write never destroys the last valid copy.

#### 🖱️ Custom context menu
The native WebView2 context menu is disabled at the native layer and replaced by an Aetheria
context menu with editing actions and a dedicated scope inside the editor. The operating system
spell checker is disabled as well.

#### 💬 Interactive mentions
Tooltips showing the entity card on hover, an insertion panel for mentions, and automatic
conversion of entity names into mention nodes when saving.

#### 🗂️ Library
- New **"Your library"** screen with a sticky header, live search, a shelf with 2:3 generated
  covers and a "Continue where you left off" card.
- **Project progress**: last edited scene and scenes written over the total.

#### 🎛️ Scrollbars
A single custom scrollbar for the whole application — thin, rounded, without arrows and following
the theme.

#### ⌨️ Shortcuts
- **Ctrl+S** now saves the active scene.
- **Ctrl+B / Ctrl+I / Ctrl+U** work as expected.
- Shortcuts are configurable and the configured ones actually fire.

### Fixed

- Configurable keyboard shortcuts **never ran**: the hook looked for `save` and `bold` instead of
  `onSave` and `onBold`.
- The **Aurora and Noir themes were never applied**: the `data-theme` attribute was removed instead
  of being set.
- Resolution, fullscreen, always on top, resizable, center, maximize and interface zoom were
  **blocked by the Tauri ACL** (the `core:window:allow-*` permissions were missing).
- The editor typography settings **were never saved**: the fields did not exist in the
  `project_settings` table and were silently discarded.
- On Windows, a maximized or fullscreen window ignored size changes.
- Opening the application settings used to freeze the app (a hook placed after a conditional
  return broke React's hook order).
- Opening a project could freeze the whole application (a re-entrant lock on the database mutex).

### Changed

- The editor writes with the default serif stack and honours the configured typography.
- The word count in the status bar and in the editor footer can be hidden.
- Autosave interval is configurable, from 700 ms to 1 minute.
- Theme and language moved from the novel settings to the application settings.

### Removed

- The Android project scaffolding, the obsolete permission schemas and the mobile entry point.
  **11.3 GB** freed in the build folder.

### Internal

- `AppSettings` struct in Rust with `camelCase` serialization, persisted in `app_settings.json`.
- `ProjectSettings` accepts missing fields (`#[serde(default)]`).
- New commands: `get_project_progress`, `get_app_data_dir`, `close_window`, `create_snapshot`,
  `list_snapshots`, `restore_snapshot` and `get_backup_status`.
- 11 automated tests covering the backup and snapshot system.

---

## [0.1.7] — September 20, 2026

See the [GitHub releases page](https://github.com/sayghteight/Aetheris/releases) for the full
history of previous versions.
