/**
 * Puerta de E/S de archivos. Dos implementaciones:
 *  - Tauri: comandos Rust (ZIP .planocasa, diálogo nativo, sin rutas en el front).
 *  - Navegador (`pnpm dev` sin Tauri): solo .json, con <input type=file> y descarga.
 * Ninguna hace peticiones de red.
 */
import { invoke } from '@tauri-apps/api/core';

export interface FileInfo {
  fileName: string;
  isPlanocasa: boolean;
}

export interface OpenedFile {
  file: FileInfo;
  projectJson: string;
  assets: string[];
}

export interface FileGateway {
  readonly kind: 'tauri' | 'browser';
  /** Muestra "Abrir". `null` si se cancela. */
  open(): Promise<OpenedFile | null>;
  /** Guarda en el archivo actual. `null` si aún no hay archivo. */
  save(projectJson: string): Promise<FileInfo | null>;
  /** Muestra "Guardar como". `null` si se cancela. */
  saveAs(projectJson: string, suggestedName: string): Promise<FileInfo | null>;
}

export const isTauri = (): boolean =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export const tauriGateway: FileGateway = {
  kind: 'tauri',
  open: () => invoke<OpenedFile | null>('open_project'),
  save: (projectJson) => invoke<FileInfo | null>('save_project', { projectJson }),
  saveAs: (projectJson, suggestedName) =>
    invoke<FileInfo | null>('save_project_as', { projectJson, suggestedName }),
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

function pickJsonFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
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
  return {
    kind: 'browser',
    async open() {
      const f = await pickJsonFile();
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
  };
}

export const defaultGateway = (): FileGateway =>
  isTauri() ? tauriGateway : createBrowserGateway();
