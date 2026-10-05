mod commands;

use commands::project::CurrentFile;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // El diálogo se usa solo desde Rust: el front nunca recibe permiso para él
        // ni para el sistema de archivos (ver docs/adr/0002).
        .plugin(tauri_plugin_dialog::init())
        .manage(CurrentFile::default())
        .invoke_handler(tauri::generate_handler![
            commands::project::open_project,
            commands::project::save_project,
            commands::project::save_project_as,
            commands::project::current_file,
        ])
        .run(tauri::generate_context!())
        .expect("error al arrancar PlanoCasa");
}
