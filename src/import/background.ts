/**
 * Plano de fondo calcable (fase 1, ESPECIFICACION §9). Funciones puras.
 *
 * Transformación imagen → plano (docs/adr/0004):
 *
 *     plano = offset + giro(rotation) · (px · cmPerPx)
 *
 *  - `px`: píxeles de la imagen. En un PDF, puntos de la página a escala 1
 *    (1/72 de pulgada), independientes de la resolución con la que se pinte.
 *  - `offset`: dónde cae la esquina superior izquierda de la imagen, en cm.
 *  - `rotation`: grados en sentido horario visto en planta, igual que Konva.
 */
import type { z } from 'zod';
import { add, dist, rotate, scale, sub, type Vec2 } from '../geometry/vec';
import type { Bounds } from '../geometry/walls';
import type { Background as BackgroundSchema } from '../model/schemas';

export type Background = z.infer<typeof BackgroundSchema>;

/** Tamaño natural de la imagen en "px" (ver cabecera). */
export interface ImageSize {
  width: number;
  height: number;
}

export const DEFAULT_OPACITY = 0.5;
/** Ancho que se da a un plano recién importado si aún no hay muros: 10 m. */
export const DEFAULT_WIDTH_CM = 1000;
/** Escalas absurdas (un clic doble en el mismo punto) se rechazan. */
export const MIN_CM_PER_PX = 1e-4;
export const MAX_CM_PER_PX = 1e4;

/** Lleva un ángulo a (-180, 180]. */
export function normalizeAngle(deg: number): number {
  let a = deg % 360;
  if (a <= -180) a += 360;
  if (a > 180) a -= 360;
  return Object.is(a, -0) ? 0 : a;
}

export function imageToPlan(bg: Background, p: Vec2): Vec2 {
  return add(bg.offset, rotate(scale(p, bg.cmPerPx), bg.rotation));
}

export function planToImage(bg: Background, p: Vec2): Vec2 {
  return scale(rotate(sub(p, bg.offset), -bg.rotation), 1 / bg.cmPerPx);
}

/** Esquinas de la imagen en el plano: arriba-izq, arriba-der, abajo-der, abajo-izq. */
export function backgroundCorners(bg: Background, size: ImageSize): Vec2[] {
  return [
    { x: 0, y: 0 },
    { x: size.width, y: 0 },
    { x: size.width, y: size.height },
    { x: 0, y: size.height },
  ].map((p) => imageToPlan(bg, p));
}

export function backgroundBounds(bg: Background, size: ImageSize): Bounds {
  const c = backgroundCorners(bg, size);
  return {
    minX: Math.min(...c.map((p) => p.x)),
    minY: Math.min(...c.map((p) => p.y)),
    maxX: Math.max(...c.map((p) => p.x)),
    maxY: Math.max(...c.map((p) => p.y)),
  };
}

/** Unión de dos cajas (cualquiera puede faltar). */
export function unionBounds(a: Bounds | null, b: Bounds | null): Bounds | null {
  if (!a) return b;
  if (!b) return a;
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  };
}

/**
 * Fondo recién importado: semitransparente, sin girar y con una escala provisional
 * (el ancho de lo ya dibujado o 10 m) a la espera de calibrarlo.
 */
export function initialBackground(
  asset: string,
  size: ImageSize,
  drawn: Bounds | null,
  page?: number,
): Background {
  if (!(size.width > 0 && size.height > 0)) throw new Error('La imagen está vacía');
  const targetWidth = drawn ? Math.max(100, drawn.maxX - drawn.minX) : DEFAULT_WIDTH_CM;
  return {
    asset,
    ...(page !== undefined ? { page } : {}),
    cmPerPx: targetWidth / size.width,
    offset: drawn ? { x: drawn.minX, y: drawn.minY } : { x: 0, y: 0 },
    rotation: 0,
    opacity: DEFAULT_OPACITY,
  };
}

/**
 * Calibra la escala: `a` y `b` son dos puntos del plano marcados sobre el fondo tal
 * como se ve ahora, y `realCm` lo que mide de verdad esa distancia. El fondo se
 * escala alrededor de `a`, así que `a` no se mueve y `b` acaba a `realCm` de él.
 */
export function calibrate(bg: Background, a: Vec2, b: Vec2, realCm: number): Background {
  if (!(realCm > 0) || !Number.isFinite(realCm)) {
    throw new Error('La medida real tiene que ser mayor que 0');
  }
  const measured = dist(a, b);
  if (measured < 1e-6) throw new Error('Marca dos puntos distintos');
  const k = realCm / measured;
  const cmPerPx = bg.cmPerPx * k;
  if (!(cmPerPx >= MIN_CM_PER_PX && cmPerPx <= MAX_CM_PER_PX)) {
    throw new Error('Esa escala no tiene sentido; revisa los puntos y la medida');
  }
  return { ...bg, cmPerPx, offset: add(a, scale(sub(bg.offset, a), k)) };
}

/** Gira el fondo hasta `rotation` grados manteniendo fijo el punto del plano `pivot`. */
export function rotateAbout(bg: Background, pivot: Vec2, rotation: number): Background {
  const next = normalizeAngle(rotation);
  const delta = next - bg.rotation;
  return { ...bg, rotation: next, offset: add(pivot, rotate(sub(bg.offset, pivot), delta)) };
}

/** Centro de la imagen en el plano (pivote natural para girarla). */
export function backgroundCenter(bg: Background, size: ImageSize): Vec2 {
  return imageToPlan(bg, { x: size.width / 2, y: size.height / 2 });
}

/**
 * Endereza el fondo: gira alrededor de `a` lo justo para que la línea `a`→`b`
 * quede horizontal o vertical (la más cercana). Útil con planos escaneados torcidos.
 */
export function straighten(bg: Background, a: Vec2, b: Vec2): Background {
  if (dist(a, b) < 1e-6) throw new Error('Marca dos puntos distintos');
  const angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  const target = Math.round(angle / 90) * 90;
  return rotateAbout(bg, a, bg.rotation - (angle - target));
}

/** Mueve el fondo `delta` cm. */
export const moveBackground = (bg: Background, delta: Vec2): Background => ({
  ...bg,
  offset: add(bg.offset, delta),
});
