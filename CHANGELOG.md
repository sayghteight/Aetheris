# Changelog

All notable changes to Aetheria are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.2.0] — November 22, 2026

### Added

- **End User Licence (EULA).** The application now asks for acceptance of the terms of use the
  first time it is opened, in Spanish or English, and it cannot be used until they are accepted.
  The acceptance is stored with the application settings, together with the version of the
  document, so a new version of the licence is accepted again. The text can be read at any
  time from the application settings, in the new **Legal** section.
- The licence lives in `src/content/eula.es.md` and `src/content/eula.en.md` and is packaged with
  the application, exactly like the changelog: what the user reads is the same document that
  is published in the repository.

### Changed

- The version is now **0.2.0** in `package.json`, `package-lock.json`, `Cargo.toml`, `Cargo.lock`,
  `tauri.conf.json` and `src/utils/version.ts`.
- The **About** panel has a new **Dedication** section for the people whose ideas became features
  of Aetheria, and for the whole community of CultoDePapel.com, with a link to the site. Each
  person has their own card with a personal dedication. The credits now link to the end user
  licence as well, and they mention TipTap instead of the editor the application no longer uses.
- **Text revisions in Manuscripts.** A scene can now save as many revisions as the writer needs.
  Each revision is an independent copy of the text at the moment it was saved, so creating a new
  one never overwrites the previous ones. Revisions are numbered per scene, can be given an
  optional name to tell them apart, and are kept in the project database, so they survive
  closing and reopening the application.
- The revision history is available from the editor itself: **Save revision** stores the current
  text (the pending changes are saved first, so the copy is exactly what is on screen) and
  **History** lists the saved revisions, which can be opened in read-only mode.
- **Differences between revisions, like in git.** A revision can now be viewed as a diff: what was
  removed is shown in red and struck through, what was added or changed in blue, word by word. The
  diff can be taken against the current text of the scene —what has changed since that revision—
  or against the previous revision —what that revision changed—. A summary shows how many words
  were added and removed.
- Revisions can also be **restored** and **deleted** from the history. Restoring a revision brings
  its text back as the working text, so the writer can continue from that approach; the text that
  is being replaced can optionally be saved as a new revision first, so nothing is lost. Deleting a
  revision removes it from the history without renumbering the remaining ones, and the revision
  whose content matches the text currently in the scene is marked as the current text.

### Internal

- New `scene_revisions` table in the project database: each row is an immutable copy of the
  content of a scene, with its own numbering per scene, an optional label, the word count and
  the plain-text version of the text. The live text of the scene stays in `scene_contents`:
  the revisions are history, not a checkpoint.
- New commands: `create_scene_revision`, `list_scene_revisions`, `get_scene_revision`,
  `restore_scene_revision` and `delete_scene_revision`.
- New `revisionStore` (Zustand) for the state of the history, and the `RevisionsControl` component
  in the editor of Manuscripts, with its translations in English and Spanish.
- The export pipeline resolves the content of a scene through a single entry point
  (`resolve_scene_content`) that already accepts a revision, so choosing which revision of each
  chapter is used when exporting will not require rewriting the exporter.

---

## [0.1.9] — November 5, 2026

### Added

- **Own spell checker for the editor.** Aetheria now checks spelling while you
  write, with its own Hunspell engine (`typo-js`) and Spanish and English
  dictionaries. The mistakes are underlined directly on the text —as real editor
  decorations, not as a duplicated layer— and the context menu offers the
  suggested corrections, plus the option of adding the word to your personal
  dictionary.
- The dictionaries are loaded on demand in a separate chunk (~1.4 MB), so they
  cost nothing until the spell checker is actually used.

### Changed

- The version is now **0.1.9** in `package.json`, `package-lock.json`, `Cargo.toml`, `Cargo.lock`,
  `tauri.conf.json` and `src/utils/version.ts`.

### Fixed

- The changelog next to the version number now works in the distributed app. It
  used to run `git log` against the repository path embedded in the binary,
  which only existed on the development machine, so the panel came up empty
  for users. It now reads the bundled `CHANGELOG.md` and lets you browse the
  previous versions.
- The version selector only lists versions that actually document changes. The
  older releases that only pointed to GitHub are no longer shown, because
  there was nothing to read in them.
- Links inside the changelog open in the user's browser. Clicking one used to
  navigate the application window instead of leaving the app.
- The repository links now point to the renamed repository, `sayghteight/Aetheris`.
- The changelog panel was tidied up: it now has its own scrollbar (the content was
  being cut off), the header stays fixed while reading, the version selector is
  a segmented control, the current version is marked as such, and the scroll
  returns to the top when you switch versions.

### Internal

- **All 28 compiler warnings are gone.** `cargo check` now finishes with zero warnings and zero
  errors.
- The wiki structs (`WikiCategory`, `WikiEntryType`, `WikiEntry`, `WikiBlock`, `WikiRelation` and
  `WikiData`) now use `snake_case` field names, like the rest of the codebase. **The JSON sent to
  the frontend does not change**: the conversion to `camelCase` is done by
  `#[serde(rename_all = "camelCase")]`, which was already in place.
- New regression test `el_wiki_se_sigue_serializando_en_camel_case` asserts the exact JSON keys of
  the wiki payloads, so a future rename cannot break the contract silently.
- The lore relations query no longer builds an unused list of SQL placeholders.
- The legacy universe migration still parses `parentId` (now `_parent_id`), even though the old
  folder hierarchy is flattened during the migration.
- Removed dead code: the `SceneContent` and `CharacterAppearance` structs and the `get_current_tag`
  git helper.
- 12 automated tests.

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

No changes are documented for this version. See the
[list of published versions](https://github.com/sayghteight/Aetheris/tags)
for the full history.
