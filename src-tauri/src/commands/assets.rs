//! Assets del proyecto: importar un plano de fondo (PDF o imagen) y leer assets.
//!
//! Igual que en `project.rs` (docs/adr/0002 y 0004), **el front nunca pasa rutas**:
//! el diálogo se abre aquí, los bytes importados se quedan en memoria (`StagedAssets`)
//! hasta el siguiente guardado y el front solo recibe un nombre de asset.

use std::collections::BTreeMap;
use std::fs;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;
use tauri::ipc::Response;
use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;

use planocasa_core::{self as core, BackgroundKind, Limits};

use super::project::CurrentFile;

/// Tamaño máximo de un plano importado. Un PDF del Catastro ronda 1–5 MB.
pub const MAX_IMPORT_BYTES: u64 = 50 * 1024 * 1024;

/// Assets importados que aún no están en ningún `.planocasa`.
#[derive(Default)]
pub struct StagedAssets(Mutex<BTreeMap<String, Vec<u8>>>);

impl StagedAssets {
    pub fn snapshot(&self) -> BTreeMap<String, Vec<u8>> {
        self.0.lock().map(|g| g.clone()).unwrap_or_default()
    }

    pub fn clear(&self) {
        if let Ok(mut g) = self.0.lock() {
            g.clear();
        }
    }

    fn get(&self, name: &str) -> Option<Vec<u8>> {
        self.0.lock().ok().and_then(|g| g.get(name).cloned())
    }

    /// Guarda los bytes con un nombre libre basado en `base` y devuelve ese nombre.
    fn insert(&self, base: &str, ext: &str, bytes: Vec<u8>) -> String {
        let Ok(mut g) = self.0.lock() else {
            return String::new();
        };
        let mut name = format!("{base}.{ext}");
        let mut n = 2;
        while g.contains_key(&name) {
            name = format!("{base}-{n}.{ext}");
            n += 1;
        }
        g.insert(name.clone(), bytes);
        name
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportedAsset {
    /// Nombre dentro de `assets/` (p. ej. "fondo-1760870000000.pdf").
    pub asset: String,
    /// Nombre del archivo original, solo para mostrarlo.
    pub file_name: String,
    /// "pdf" o "image".
    pub kind: &'static str,
}

fn millis() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or_default()
}

/// Muestra "Importar plano" y deja el archivo en memoria. `None` si se cancela.
#[tauri::command]
pub async fn import_background(
    app: AppHandle,
    staged: State<'_, StagedAssets>,
) -> Result<Option<ImportedAsset>, String> {
    let Some(picked) = app
        .dialog()
        .file()
        .set_title("Importar plano (PDF o imagen)")
        .add_filter("Plano", &["pdf", "png", "jpg", "jpeg", "webp"])
        .blocking_pick_file()
    else {
        return Ok(None);
    };
    let path = picked
        .into_path()
        .map_err(|_| "ruta no válida".to_string())?;

    let len = fs::metadata(&path).map_err(|e| e.to_string())?.len();
    if len > MAX_IMPORT_BYTES {
        return Err(format!(
            "El archivo pesa más de {} MB",
            MAX_IMPORT_BYTES / 1024 / 1024
        ));
    }
    let bytes = fs::read(&path).map_err(|e| e.to_string())?;
    let kind = BackgroundKind::sniff(&bytes).map_err(|e| e.to_string())?;
    let asset = staged.insert(&format!("fondo-{}", millis()), kind.ext(), bytes);

    Ok(Some(ImportedAsset {
        asset,
        file_name: path
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_default(),
        kind: if kind.is_pdf() { "pdf" } else { "image" },
    }))
}

/// Bytes de un asset: primero los importados sin guardar, luego el `.planocasa` abierto.
/// Se devuelven en binario (ArrayBuffer en el front), sin pasar por JSON.
#[tauri::command]
pub async fn read_asset(
    name: String,
    staged: State<'_, StagedAssets>,
    current: State<'_, CurrentFile>,
) -> Result<Response, String> {
    if !core::is_safe_asset_name(&name) {
        return Err(core::Error::UnsafeAssetName(name).to_string());
    }
    if let Some(bytes) = staged.get(&name) {
        return Ok(Response::new(bytes));
    }
    let path = current
        .get()
        .ok_or_else(|| core::Error::AssetNotFound(name.clone()).to_string())?;
    core::read_asset(&path, &name, Limits::default())
        .map(Response::new)
        .map_err(|e| e.to_string())
}

/// Empieza de cero (proyecto nuevo o ejemplo): olvida el archivo actual y lo importado.
#[tauri::command]
pub fn reset_session(staged: State<'_, StagedAssets>, current: State<'_, CurrentFile>) {
    staged.clear();
    current.clear();
}

#[cfg(test)]
mod tests {
    use super::StagedAssets;

    #[test]
    fn los_nombres_importados_no_se_pisan() {
        let s = StagedAssets::default();
        assert_eq!(s.insert("fondo-1", "pdf", vec![1]), "fondo-1.pdf");
        assert_eq!(s.insert("fondo-1", "pdf", vec![2]), "fondo-1-2.pdf");
        assert_eq!(s.get("fondo-1.pdf"), Some(vec![1]));
        assert_eq!(s.snapshot().len(), 2);
        s.clear();
        assert!(s.snapshot().is_empty());
    }
}
