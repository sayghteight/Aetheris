mod state;
mod database;
mod domain;
mod commands;

use state::AppState;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState::new())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            greet,
            commands::create_project,
            commands::open_project,
            commands::get_project_settings,
            commands::update_project_settings,
            commands::get_universe_data,
            commands::save_universe_data,
            commands::update_project_metadata,
            commands::close_project,
            commands::get_manuscript_nodes,
            commands::create_manuscript_node,
            commands::get_scene_content,
            commands::update_scene_content,
            commands::reset_project,
            commands::get_recent_projects,
            commands::add_recent_project,
            commands::get_timeline_events,
            commands::create_timeline_event,
            commands::update_timeline_event,
            commands::delete_timeline_event,
            commands::get_calendars,
            commands::create_calendar,
            commands::update_calendar,
            commands::delete_calendar,
            commands::get_workspace_state,
            commands::save_workspace_state
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

