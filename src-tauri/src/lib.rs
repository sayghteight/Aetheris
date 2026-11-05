mod state;
mod database;
mod domain;
mod commands;
mod export;
mod git;
mod backup;

use state::AppState;
use tauri::{Emitter, Manager};

/// Cada cuanto se revisa si el proyecto abierto tiene cambios sin respaldar.
const BACKUP_INTERVAL_SECS: u64 = 30;

/// Hilo que mantiene actualizado el backup principal del proyecto abierto.
///
/// El backup principal es un unico archivo que se sobrescribe: este hilo
/// comprueba si la base de datos ha cambiado desde la ultima copia y, si es
/// asi, la actualiza. Nunca genera archivos adicionales.
fn spawn_backup_worker(app: tauri::AppHandle) {
    std::thread::spawn(move || {
        loop {
            std::thread::sleep(std::time::Duration::from_secs(BACKUP_INTERVAL_SECS));

            let Some(state) = app.try_state::<AppState>() else {
                continue;
            };
            if let Err(err) = commands::flush_pending_backup(&state) {
                eprintln!("[aetheria] No se pudo actualizar la copia de seguridad: {err}");
            }
        }
    });
}

/// Desactiva el menu contextual nativo de WebView2 en Windows.
///
/// WebView2 incrusta su propio menu contextual (con las sugerencias del corrector
/// ortografico nativo) y no hay forma de configurarlo desde `tauri.conf.json`:
/// Tauri 2 no reenvia el `with_default_context_menus` de wry, que es la via que
/// wry usa internamente para llamar a
/// `ICoreWebView2Settings::SetAreDefaultContextMenusEnabled(false)`.
///
/// Por eso se llama directamente a la API COM desde `with_webview`. La cadena
/// `controller() -> CoreWebView2() -> Settings() -> SetAreDefaultContextMenusEnabled()`
/// se apoya en metodos inherentes de los tipos de `webview2-com`, asi que no hace
/// falta declarar ese crate como dependencia: ya forma parte del arbol (a traves
/// de tauri, en la misma version) y el inference de Rust resuelve los tipos sin
/// necesidad de nombrarlos.
#[cfg(target_os = "windows")]
fn disable_native_context_menu(app: &tauri::AppHandle) {
    use tauri::Manager;

    for (_, window) in app.webview_windows() {
        if let Err(err) = window.with_webview(|webview| unsafe {
            let controller = webview.controller();
            match controller.CoreWebView2() {
                Ok(core_webview) => match core_webview.Settings() {
                    Ok(settings) => {
                        if let Err(err) = settings.SetAreDefaultContextMenusEnabled(false) {
                            eprintln!("[aetheria] No se pudo desactivar el menu nativo: {err:?}");
                        }
                    }
                    Err(err) => eprintln!("[aetheria] ICoreWebView2Settings no disponible: {err:?}"),
                },
                Err(err) => eprintln!("[aetheria] ICoreWebView2 no disponible: {err:?}"),
            }
        }) {
            eprintln!("[aetheria] with_webview fallo: {err:?}");
        }
    }
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

pub fn run() {
    tauri::Builder::default()
        .manage(AppState::new())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            // Restaura el tamano de ventana guardado, si el usuario lo pidio.
            let app_settings = commands::read_app_settings();
            if app_settings.restore_window_on_start && !app_settings.window_fullscreen {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.set_size(tauri::LogicalSize::new(
                        f64::from(app_settings.window_width),
                        f64::from(app_settings.window_height),
                    ));
                }
            }

            // El menu contextual de WebView2 se desactiva en la capa nativa para
            // que nunca aparezca, ni siquiera antes de que React monte el menu
            // propio de Aetheris.
            #[cfg(target_os = "windows")]
            disable_native_context_menu(app.handle());

            // Copia de seguridad periodica del proyecto abierto.
            spawn_backup_worker(app.handle().clone());

            Ok(())
        })
        .on_window_event(|window, event| {
            // Si el usuario ha pedido confirmacion al cerrar, se bloquea el
            // cierre y se avisa al frontend para que lo pregunte.
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let app_settings = commands::read_app_settings();

                if app_settings.confirm_before_close
                    && !commands::ALLOW_CLOSE.load(std::sync::atomic::Ordering::Relaxed)
                {
                    api.prevent_close();
                    let _ = window.emit("aetheria://close-requested", ());
                }

                // Ultima copia de seguridad antes de que la app se cierre.
                if let Some(state) = window.try_state::<AppState>() {
                    let _ = commands::flush_pending_backup(&state);
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            commands::create_project,
            commands::open_project,
            commands::get_project_settings,
            commands::update_project_settings,
            commands::get_universe,
            commands::get_universe_data,
            commands::save_universe_data,
            commands::create_universe_entry,
            commands::update_universe_entry,
            commands::delete_universe_entry,
            commands::create_universe_category,
            commands::update_universe_category,
            commands::delete_universe_category,
            commands::create_universe_relation,
            commands::delete_universe_relation,
            commands::search_universe,
            commands::update_project_metadata,
            commands::close_project,
            commands::get_manuscript_nodes,
            commands::create_manuscript_node,
            commands::update_manuscript_node,
            commands::delete_manuscript_node,
            commands::get_scene_content,
            commands::update_scene_content,
            commands::reset_project,
            commands::get_recent_projects,
            commands::add_recent_project,
            commands::get_project_progress,
            commands::get_app_data_dir,
            commands::close_window,
            commands::create_snapshot,
            commands::list_snapshots,
            commands::restore_snapshot,
            commands::get_backup_status,
            commands::get_timeline_events,
            commands::create_timeline_event,
            commands::update_timeline_event,
            commands::delete_timeline_event,
            commands::get_calendars,
            commands::create_calendar,
            commands::update_calendar,
            commands::delete_calendar,
            commands::get_workspace_state,
            commands::save_workspace_state,
            commands::get_app_settings,
            commands::save_app_settings,
            commands::export_manuscript,
            commands::export_preview,
            commands::save_exported_file,
            commands::merge_scenes,
            commands::split_scene_at_cursor,
            commands::split_scene_by_selection,
            commands::search_all,
            git::get_git_tags,
            commands::upload_asset,
            commands::get_asset,
            commands::get_all_assets,
            commands::delete_asset,
            commands::get_tab_state,
            commands::save_tab_state,
            commands::get_character_tracking,
            commands::rebuild_character_tracking,
            commands::get_chapters_info,
            commands::get_scenes_for_character,
            commands::get_lore_for_scene,
            commands::auto_convert_mentions,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

