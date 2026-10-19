/**
 * Tipo de un plano importado deducido de sus primeros bytes, no de la extensión.
 * Espejo de `BackgroundKind::sniff` (src-tauri/core) para el modo navegador.
 */
export type BackgroundFileKind = 'pdf' | 'png' | 'jpg' | 'webp';

const startsWith = (b: Uint8Array, sig: readonly number[], at = 0): boolean =>
  b.length >= at + sig.length && sig.every((v, i) => b[at + i] === v);

const ascii = (s: string): number[] => [...s].map((c) => c.charCodeAt(0));

export function sniffBackground(bytes: Uint8Array): BackgroundFileKind | null {
  if (startsWith(bytes, ascii('%PDF-'))) return 'pdf';
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'jpg';
  if (startsWith(bytes, ascii('RIFF')) && startsWith(bytes, ascii('WEBP'), 8)) return 'webp';
  return null;
}

export const MIME: Record<Exclude<BackgroundFileKind, 'pdf'>, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
};

/** Tipo a partir del nombre del asset guardado (fondo-…pdf, …png…). */
export function kindFromAssetName(name: string): BackgroundFileKind | null {
  const ext = name.toLowerCase().split('.').pop();
  if (ext === 'pdf' || ext === 'png' || ext === 'webp') return ext;
  if (ext === 'jpg' || ext === 'jpeg') return 'jpg';
  return null;
}
