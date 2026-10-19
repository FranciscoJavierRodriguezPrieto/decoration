/**
 * Puerta de E/S de archivos. Dos implementaciones:
 *  - Tauri: comandos Rust (ZIP .planocasa, diálogo nativo, sin rutas en el front).
 *  - Navegador (`pnpm dev` sin Tauri): solo .json, con <input type=file> y descarga.
 * Ninguna hace peticiones de red.
 */
import { invoke } from '@tauri-apps/api/core';
import { sniffBackground } from '../import/sniff';

export interface FileInfo {
  fileName: string;
  isPlanocasa: boolean;
}

export interface OpenedFile {
  file: FileInfo;
  projectJson: string;
  assets: string[];
}

/** Plano importado: ya está en memoria del lado de E/S, a la espera de guardarse. */
export interface ImportedAsset {
  /** Nombre dentro de `assets/`. */
  asset: string;
  /** Nombre del archivo original (solo para mostrarlo). */
  fileName: string;
  kind: 'pdf' | 'image';
}

export interface FileGateway {
  readonly kind: 'tauri' | 'browser';
  /** Muestra "Abrir". `null` si se cancela. */
  open(): Promise<OpenedFile | null>;
  /**
   * Guarda en el archivo actual. `null` si aún no hay archivo.
   * `assets`: los que usa el proyecto (los demás se podan del `.planocasa`).
   */
  save(projectJson: string, assets: string[]): Promise<FileInfo | null>;
  /** Muestra "Guardar como". `null` si se cancela. */
  saveAs(projectJson: string, suggestedName: string, assets: string[]): Promise<FileInfo | null>;
  /** Muestra "Importar plano" (PDF o imagen). `null` si se cancela. */
  importBackground(): Promise<ImportedAsset | null>;
  /** Bytes de un asset (importado sin guardar o del archivo abierto). */
  readAsset(name: string): Promise<Uint8Array>;
  /** Proyecto nuevo o ejemplo: olvida el archivo actual y lo importado. */
  reset(): Promise<void>;
}

export const isTauri = (): boolean =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export const tauriGateway: FileGateway = {
  kind: 'tauri',
  open: () => invoke<OpenedFile | null>('open_project'),
  save: (projectJson, assets) => invoke<FileInfo | null>('save_project', { projectJson, assets }),
  saveAs: (projectJson, suggestedName, assets) =>
    invoke<FileInfo | null>('save_project_as', { projectJson, suggestedName, assets }),
  importBackground: () => invoke<ImportedAsset | null>('import_background'),
  readAsset: async (name) => new Uint8Array(await invoke<ArrayBuffer>('read_asset', { name })),
  reset: async () => {
    await invoke('reset_session');
  },
};

/** Nombre de archivo seguro para la descarga en modo navegador. */
export function toJsonFileName(name: string): string {
  const base = name
    .replace(/[<>:"/\\|?*]/g, '-')
    .split('')
    .map((c) => (c.charCodeAt(0) < 32 ? '-' : c))
    .join('')
    .trim()
    .replace(/\.+$/, '');
  return `${base || 'proyecto'}.json`;
}

/** Límite del plano importado (igual que en Rust). */
export const MAX_IMPORT_BYTES = 50 * 1024 * 1024;

function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.addEventListener('change', () => resolve(input.files?.[0] ?? null), { once: true });
    input.addEventListener('cancel', () => resolve(null), { once: true });
    input.click();
  });
}

function download(text: string, fileName: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export function createBrowserGateway(): FileGateway {
  let current: FileInfo | null = null;
  // Sin ZIP en el navegador: los planos importados viven solo en memoria.
  const assets = new Map<string, Uint8Array>();
  return {
    kind: 'browser',
    async open() {
      const f = await pickFile('.json,application/json');
      if (!f) return null;
      current = { fileName: f.name, isPlanocasa: false };
      return { file: current, projectJson: await f.text(), assets: [] };
    },
    async save(projectJson) {
      if (!current) return null;
      download(projectJson, current.fileName);
      return current;
    },
    async saveAs(projectJson, suggestedName) {
      current = { fileName: toJsonFileName(suggestedName), isPlanocasa: false };
      download(projectJson, current.fileName);
      return current;
    },
    async importBackground() {
      const f = await pickFile('.pdf,.png,.jpg,.jpeg,.webp');
      if (!f) return null;
      if (f.size > MAX_IMPORT_BYTES) throw new Error('El archivo pesa más de 50 MB');
      const bytes = new Uint8Array(await f.arrayBuffer());
      const kind = sniffBackground(bytes);
      if (!kind) throw new Error('Formato no soportado: usa PDF, PNG, JPG o WEBP');
      const asset = `fondo-${Date.now()}.${kind}`;
      assets.set(asset, bytes);
      return { asset, fileName: f.name, kind: kind === 'pdf' ? 'pdf' : 'image' };
    },
    async readAsset(name) {
      const bytes = assets.get(name);
      if (!bytes) throw new Error(`El proyecto no contiene el archivo ${name}`);
      return bytes;
    },
    async reset() {
      assets.clear();
    },
  };
}

export const defaultGateway = (): FileGateway =>
  isTauri() ? tauriGateway : createBrowserGateway();

let shared: FileGateway | null = null;
/** Pasarela única de la app (la usan las acciones de archivo y la carga de fondos). */
export const appGateway = (): FileGateway => (shared ??= defaultGateway());
