//! Formato de archivo `.planocasa` (CLAUDE.md §1.3):
//!
//! ```text
//! mi-casa.planocasa  (ZIP)
//! ├─ project.json      ← obligatorio, UTF-8
//! └─ assets/…          ← fondos, fotos, modelos GLB (opcionales)
//! ```
//!
//! Este crate no sabe nada del contenido de `project.json`: lo valida el front con zod.
//! Aquí solo se garantiza que el contenedor es seguro (sin zip-slip ni bombas) y que el
//! guardado es atómico (temporal + renombrado), para no corromper nunca un proyecto.

use std::collections::BTreeSet;
use std::fs::{self, File};
use std::io::{self, BufReader, BufWriter, Read, Seek, Write};
use std::path::{Path, PathBuf};

use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipArchive, ZipWriter};

pub const PROJECT_JSON: &str = "project.json";
pub const ASSETS_PREFIX: &str = "assets/";
pub const PROJECT_EXT: &str = "planocasa";

/// Límites defensivos frente a archivos maliciosos o corruptos.
#[derive(Debug, Clone, Copy)]
pub struct Limits {
    pub max_project_json: u64,
    pub max_asset: u64,
    pub max_total: u64,
    pub max_entries: usize,
}

impl Default for Limits {
    fn default() -> Self {
        Self {
            max_project_json: 20 * 1024 * 1024,
            max_asset: 100 * 1024 * 1024,
            max_total: 1024 * 1024 * 1024,
            max_entries: 10_000,
        }
    }
}

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("error de disco: {0}")]
    Io(#[from] io::Error),
    #[error("el archivo no es un ZIP válido: {0}")]
    Zip(#[from] zip::result::ZipError),
    #[error("el archivo no contiene project.json")]
    MissingProjectJson,
    #[error("project.json no está en UTF-8")]
    NotUtf8,
    #[error("entrada no permitida dentro del proyecto: {0}")]
    UnsafeEntry(String),
    #[error("el proyecto supera el límite de tamaño ({0})")]
    TooLarge(String),
    #[error("extensión no soportada: usa .planocasa o .json")]
    UnsupportedExtension,
}

pub type Result<T> = std::result::Result<T, Error>;

/// Resultado de abrir un proyecto.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OpenedProject {
    /// Contenido de `project.json`, sin validar.
    pub project_json: String,
    /// Nombres de los assets (relativos a `assets/`), ordenados.
    pub assets: Vec<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FileKind {
    /// ZIP `.planocasa`.
    Planocasa,
    /// JSON plano (fixtures, exportación legible). No admite assets.
    Json,
}

impl FileKind {
    pub fn from_path(path: &Path) -> Result<Self> {
        match path
            .extension()
            .and_then(|e| e.to_str())
            .map(str::to_ascii_lowercase)
            .as_deref()
        {
            Some(PROJECT_EXT) => Ok(Self::Planocasa),
            Some("json") => Ok(Self::Json),
            _ => Err(Error::UnsupportedExtension),
        }
    }
}

/// Un nombre de asset es seguro si es relativo, sin `..`, sin unidades ni rutas UNC,
/// sin barras invertidas y sin caracteres de control.
pub fn is_safe_asset_name(name: &str) -> bool {
    !name.is_empty()
        && name.len() <= 255
        && !name.starts_with('/')
        && !name.contains('\\')
        && !name.contains(':')
        && !name.chars().any(char::is_control)
        && name
            .split('/')
            .all(|seg| !seg.is_empty() && seg != "." && seg != "..")
}

/// Abre un `.planocasa` o un `.json`.
pub fn open(path: &Path) -> Result<OpenedProject> {
    open_with_limits(path, Limits::default())
}

pub fn open_with_limits(path: &Path, limits: Limits) -> Result<OpenedProject> {
    match FileKind::from_path(path)? {
        FileKind::Json => {
            let len = fs::metadata(path)?.len();
            if len > limits.max_project_json {
                return Err(Error::TooLarge(PROJECT_JSON.into()));
            }
            let bytes = fs::read(path)?;
            let project_json = String::from_utf8(bytes).map_err(|_| Error::NotUtf8)?;
            Ok(OpenedProject {
                project_json,
                assets: Vec::new(),
            })
        }
        FileKind::Planocasa => read_zip(BufReader::new(File::open(path)?), limits),
    }
}

/// Lee y valida un contenedor `.planocasa` desde cualquier lector.
pub fn read_zip<R: Read + Seek>(reader: R, limits: Limits) -> Result<OpenedProject> {
    let mut archive = ZipArchive::new(reader)?;
    if archive.len() > limits.max_entries {
        return Err(Error::TooLarge("demasiadas entradas".into()));
    }

    let mut project_json: Option<String> = None;
    let mut assets = BTreeSet::new();
    let mut total: u64 = 0;

    for i in 0..archive.len() {
        let mut entry = archive.by_index(i)?;
        let name = entry.name().to_owned();

        if entry.is_dir() {
            // Solo se toleran los directorios "assets/" y sus subcarpetas.
            if name == ASSETS_PREFIX
                || name
                    .strip_prefix(ASSETS_PREFIX)
                    .and_then(|r| r.strip_suffix('/'))
                    .is_some_and(is_safe_asset_name)
            {
                continue;
            }
            return Err(Error::UnsafeEntry(name));
        }

        total = total.saturating_add(entry.size());
        if total > limits.max_total {
            return Err(Error::TooLarge("total".into()));
        }

        if name == PROJECT_JSON {
            if entry.size() > limits.max_project_json {
                return Err(Error::TooLarge(PROJECT_JSON.into()));
            }
            // Se limita la lectura real además del tamaño declarado (bombas ZIP).
            let mut buf = Vec::new();
            (&mut entry)
                .take(limits.max_project_json + 1)
                .read_to_end(&mut buf)?;
            if buf.len() as u64 > limits.max_project_json {
                return Err(Error::TooLarge(PROJECT_JSON.into()));
            }
            project_json = Some(String::from_utf8(buf).map_err(|_| Error::NotUtf8)?);
        } else if let Some(asset) = name.strip_prefix(ASSETS_PREFIX) {
            if !is_safe_asset_name(asset) {
                return Err(Error::UnsafeEntry(name));
            }
            if entry.size() > limits.max_asset {
                return Err(Error::TooLarge(name));
            }
            assets.insert(asset.to_owned());
        } else {
            return Err(Error::UnsafeEntry(name));
        }
    }

    let project_json = project_json.ok_or(Error::MissingProjectJson)?;
    Ok(OpenedProject {
        project_json,
        assets: assets.into_iter().collect(),
    })
}

/// Escribe un `.planocasa` en `writer`, copiando los assets de `assets_from` sin
/// recomprimirlos (si es un `.planocasa`).
pub fn write_zip<W: Write + Seek>(
    writer: W,
    project_json: &str,
    assets_from: Option<&Path>,
) -> Result<W> {
    let mut zip = ZipWriter::new(writer);
    let opts = SimpleFileOptions::default()
        .compression_method(CompressionMethod::Deflated)
        .unix_permissions(0o644);

    zip.start_file(PROJECT_JSON, opts)?;
    zip.write_all(project_json.as_bytes())?;

    if let Some(src) = assets_from {
        if FileKind::from_path(src).ok() == Some(FileKind::Planocasa) && src.exists() {
            // Valida el origen antes de copiar nada.
            let file = File::open(src)?;
            read_zip(BufReader::new(&file), Limits::default())?;
            let mut archive = ZipArchive::new(BufReader::new(File::open(src)?))?;
            for i in 0..archive.len() {
                let entry = archive.by_index_raw(i)?;
                if entry.is_file() && entry.name().starts_with(ASSETS_PREFIX) {
                    zip.raw_copy_file(entry)?;
                }
            }
        }
    }

    Ok(zip.finish()?)
}

/// Guarda de forma atómica: escribe en un temporal del mismo directorio, hace
/// `fsync` y renombra encima del destino. Si algo falla, el original queda intacto.
///
/// - `.planocasa`: ZIP con `project.json` + assets copiados de `assets_from`.
/// - `.json`: solo el JSON (los assets no caben en un JSON plano).
pub fn save(path: &Path, project_json: &str, assets_from: Option<&Path>) -> Result<()> {
    let kind = FileKind::from_path(path)?;
    let tmp = temp_path_for(path);

    let result = (|| -> Result<()> {
        let file = File::create(&tmp)?;
        let file = match kind {
            FileKind::Json => {
                let mut w = BufWriter::new(file);
                w.write_all(project_json.as_bytes())?;
                w.into_inner().map_err(|e| e.into_error())?
            }
            FileKind::Planocasa => write_zip(BufWriter::new(file), project_json, assets_from)?
                .into_inner()
                .map_err(|e| e.into_error())?,
        };
        file.sync_all()?;
        drop(file);
        // En Windows `rename` sustituye el destino (MoveFileExW + REPLACE_EXISTING).
        fs::rename(&tmp, path)?;
        Ok(())
    })();

    if result.is_err() {
        let _ = fs::remove_file(&tmp);
    }
    result
}

fn temp_path_for(path: &Path) -> PathBuf {
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| "proyecto".into());
    path.with_file_name(format!(".{name}.{}.tmp", std::process::id()))
}

#[cfg(test)]
mod tests;
