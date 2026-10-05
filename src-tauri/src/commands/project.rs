//! Comandos de abrir y guardar proyectos.
//!
//! Decisión de seguridad (docs/adr/0002): **el front nunca pasa rutas**. Rust abre el
//! diálogo nativo, guarda la ruta elegida en `CurrentFile` y solo devuelve al front el
//! nombre del archivo. Así, aunque se inyectara código en el WebView, no podría leer ni
//! escribir rutas arbitrarias del disco.

use std::path::PathBuf;
use std::sync::Mutex;

use serde::Serialize;
use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;

use planocasa_core::{self as core, FileKind, PROJECT_EXT};

/// Ruta del proyecto abierto. Solo vive en Rust.
#[derive(Default)]
pub struct CurrentFile(Mutex<Option<PathBuf>>);

impl CurrentFile {
    fn get(&self) -> Option<PathBuf> {
        self.0.lock().map(|g| g.clone()).unwrap_or(None)
    }

    fn set(&self, path: PathBuf) {
        if let Ok(mut g) = self.0.lock() {
            *g = Some(path);
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileInfo {
    /// Solo el nombre (p. ej. "salon.planocasa"), nunca la ruta completa.
    pub file_name: String,
    /// `true` si es un ZIP `.planocasa`; `false` si es un `.json` plano.
    pub is_planocasa: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenedProjectDto {
    pub file: FileInfo,
    pub project_json: String,
    pub assets: Vec<String>,
}

fn file_info(path: &std::path::Path) -> FileInfo {
    FileInfo {
        file_name: path
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_default(),
        is_planocasa: FileKind::from_path(path).ok() == Some(FileKind::Planocasa),
    }
}

fn err(e: core::Error) -> String {
    e.to_string()
}

/// Muestra "Abrir" y devuelve el proyecto, o `None` si se cancela.
#[tauri::command]
pub async fn open_project(
    app: AppHandle,
    current: State<'_, CurrentFile>,
) -> Result<Option<OpenedProjectDto>, String> {
    // Los comandos async no corren en el hilo principal: el diálogo bloqueante es seguro aquí.
    let Some(picked) = app
        .dialog()
        .file()
        .set_title("Abrir proyecto")
        .add_filter("Proyecto PlanoCasa", &[PROJECT_EXT, "json"])
        .blocking_pick_file()
    else {
        return Ok(None);
    };
    let path = picked
        .into_path()
        .map_err(|_| "ruta no válida".to_string())?;

    let opened = core::open(&path).map_err(err)?;
    current.set(path.clone());
    Ok(Some(OpenedProjectDto {
        file: file_info(&path),
        project_json: opened.project_json,
        assets: opened.assets,
    }))
}

/// Guarda en el archivo actual. Devuelve `None` si aún no hay archivo (el front
/// debe llamar entonces a `save_project_as`).
#[tauri::command]
pub async fn save_project(
    project_json: String,
    current: State<'_, CurrentFile>,
) -> Result<Option<FileInfo>, String> {
    let Some(path) = current.get() else {
        return Ok(None);
    };
    core::save(&path, &project_json, Some(&path)).map_err(err)?;
    Ok(Some(file_info(&path)))
}

/// Muestra "Guardar como". Copia los assets del archivo actual, si lo hay.
#[tauri::command]
pub async fn save_project_as(
    app: AppHandle,
    project_json: String,
    suggested_name: String,
    current: State<'_, CurrentFile>,
) -> Result<Option<FileInfo>, String> {
    let Some(picked) = app
        .dialog()
        .file()
        .set_title("Guardar proyecto")
        .set_file_name(sanitize_file_name(&suggested_name))
        .add_filter("Proyecto PlanoCasa", &[PROJECT_EXT])
        .add_filter("JSON legible (sin assets)", &["json"])
        .blocking_save_file()
    else {
        return Ok(None);
    };
    let mut path = picked
        .into_path()
        .map_err(|_| "ruta no válida".to_string())?;
    if FileKind::from_path(&path).is_err() {
        path.set_extension(PROJECT_EXT);
    }

    let source = current.get();
    core::save(&path, &project_json, source.as_deref()).map_err(err)?;
    current.set(path.clone());
    Ok(Some(file_info(&path)))
}

/// Archivo abierto ahora mismo (para el título de la ventana).
#[tauri::command]
pub fn current_file(current: State<'_, CurrentFile>) -> Option<FileInfo> {
    current.get().as_deref().map(file_info)
}

/// Nombre de archivo sugerido a partir del nombre del proyecto.
fn sanitize_file_name(name: &str) -> String {
    let clean: String = name
        .chars()
        .map(|c| match c {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => '-',
            c if c.is_control() => '-',
            c => c,
        })
        .collect();
    let trimmed = clean.trim().trim_end_matches('.');
    let base = if trimmed.is_empty() {
        "proyecto"
    } else {
        trimmed
    };
    format!("{base}.{PROJECT_EXT}")
}

#[cfg(test)]
mod tests {
    use super::sanitize_file_name;

    #[test]
    fn nombres_de_archivo_validos_en_windows() {
        assert_eq!(
            sanitize_file_name("Salón Madrid — sofá nuevo"),
            "Salón Madrid — sofá nuevo.planocasa"
        );
        assert_eq!(sanitize_file_name("a/b:c*?"), "a-b-c--.planocasa");
        assert_eq!(sanitize_file_name("   "), "proyecto.planocasa");
        assert_eq!(sanitize_file_name("casa."), "casa.planocasa");
    }
}
