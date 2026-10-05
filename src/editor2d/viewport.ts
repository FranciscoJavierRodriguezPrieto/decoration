/** Transformación cm ⇄ píxeles del plano. Funciones puras. */
import type { Bounds } from '../geometry/walls';

export interface View {
  /** Píxeles por cm. */
  scale: number;
  /** Desplazamiento del origen del plano, en píxeles. */
  x: number;
  y: number;
}

export const MIN_SCALE = 0.05;
export const MAX_SCALE = 20;

export const clampScale = (s: number): number => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

/** Vista que encaja `bounds` en un lienzo de `width`×`height` con `margin` px. */
export function fitView(bounds: Bounds | null, width: number, height: number, margin = 48): View {
  if (!bounds || width <= 0 || height <= 0) return { scale: 1, x: margin, y: margin };
  const bw = Math.max(1, bounds.maxX - bounds.minX);
  const bh = Math.max(1, bounds.maxY - bounds.minY);
  const scale = clampScale(Math.min((width - 2 * margin) / bw, (height - 2 * margin) / bh));
  return {
    scale,
    x: (width - bw * scale) / 2 - bounds.minX * scale,
    y: (height - bh * scale) / 2 - bounds.minY * scale,
  };
}

/** Zoom manteniendo fijo el punto de pantalla `pointer`. */
export function zoomAt(view: View, pointer: { x: number; y: number }, factor: number): View {
  const scale = clampScale(view.scale * factor);
  const wx = (pointer.x - view.x) / view.scale;
  const wy = (pointer.y - view.y) / view.scale;
  return { scale, x: pointer.x - wx * scale, y: pointer.y - wy * scale };
}
