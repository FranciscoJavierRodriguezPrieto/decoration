/**
 * Bytes de un plano → imagen dibujable en el lienzo. Pegamento con el DOM:
 *  - PNG/JPG/WEBP: <img> desde un blob: (la CSP lo permite, no hay red).
 *  - PDF: pdf.js empaquetado, con su worker servido desde la propia app
 *    (`worker-src 'self'`), sin eval y sin descargar fuentes (docs/adr/0004).
 */
import { MIME, type BackgroundFileKind } from './sniff';

export interface LoadedBackground {
  /** Lo que pinta Konva. */
  source: HTMLImageElement | HTMLCanvasElement;
  /** Tamaño natural en "px" del modelo (en un PDF, puntos a escala 1). */
  width: number;
  height: number;
  /** Páginas del PDF (1 en una imagen). */
  pages: number;
}

/** Lado mayor con el que se rasteriza un PDF: nítido al acercar sin disparar la memoria. */
export const MAX_RENDER_PX = 4096;
export const MAX_RENDER_SCALE = 6;

/** Factor de rasterizado de una página de `w`×`h` puntos. Puro. */
export function renderScale(w: number, h: number, maxPx = MAX_RENDER_PX): number {
  const side = Math.max(w, h);
  if (!(side > 0)) return 1;
  return Math.max(1, Math.min(MAX_RENDER_SCALE, maxPx / side));
}

/** Página válida dentro de 1..pages. Puro. */
export const clampPage = (page: number | undefined, pages: number): number =>
  Math.min(Math.max(1, Math.round(page ?? 1)), Math.max(1, pages));

async function loadImage(bytes: Uint8Array, kind: Exclude<BackgroundFileKind, 'pdf'>) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: MIME[kind] }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, pages: 1 };
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function loadPdf(bytes: Uint8Array, page: number | undefined): Promise<LoadedBackground> {
  const pdfjs = await import('pdfjs-dist');
  const { default: workerSrc } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

  // pdf.js se queda con el buffer: se le pasa una copia.
  const doc = await pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false }).promise;
  try {
    const p = await doc.getPage(clampPage(page, doc.numPages));
    const base = p.getViewport({ scale: 1 });
    const viewport = p.getViewport({ scale: renderScale(base.width, base.height) });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No se pudo crear el lienzo para el PDF');
    // Los PDF no tienen fondo: se pinta blanco para que se vea como el papel.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await p.render({ canvasContext: ctx, viewport }).promise;
    return { source: canvas, width: base.width, height: base.height, pages: doc.numPages };
  } finally {
    void doc.destroy();
  }
}

export function loadBackground(
  bytes: Uint8Array,
  kind: BackgroundFileKind,
  page?: number,
): Promise<LoadedBackground> {
  return kind === 'pdf' ? loadPdf(bytes, page) : loadImage(bytes, kind);
}
