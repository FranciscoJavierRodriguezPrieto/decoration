fn main() {
    // Declara los comandos propios para que solo se puedan invocar si una
    // capacidad (capabilities/*.json) los permite de forma explícita.
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "open_project",
            "save_project",
            "save_project_as",
            "current_file",
            "import_background",
            "read_asset",
            "reset_session",
        ]),
    ))
    .expect("fallo al ejecutar tauri-build");
}
