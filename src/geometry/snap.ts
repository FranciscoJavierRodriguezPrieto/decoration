/** Imanes del editor 2D (ESPECIFICACION §3.4 y §4.2). Funciones puras. */
import { add, dist, length, normalize, roundHalf, roundPoint, scale, sub, type Vec2 } from './vec';

/** Pasos de rejilla admitidos (cm). */
export const GRID_STEPS = [1, 5, 10] as const;

/** Lleva un punto a la rejilla de `step` cm. */
export function snapToGrid(p: Vec2, step: number): Vec2 {
  if (step <= 0) return roundPoint(p);
  return {
    x: roundHalf(Math.round(p.x / step) * step),
    y: roundHalf(Math.round(p.y / step) * step),
  };
}

/**
 * Imán angular: si la dirección anchor→p está a menos de `toleranceDeg` de un
 * múltiplo de `stepDeg`, la endereza a ese ángulo conservando la longitud.
 */
export function snapAngle(anchor: Vec2, p: Vec2, stepDeg = 45, toleranceDeg = 7): Vec2 {
  const d = sub(p, anchor);
  const len = length(d);
  if (len === 0) return p;
  const ang = (Math.atan2(d.y, d.x) * 180) / Math.PI;
  const snapped = Math.round(ang / stepDeg) * stepDeg;
  if (Math.abs(ang - snapped) > toleranceDeg) return p;
  const r = (snapped * Math.PI) / 180;
  return add(anchor, { x: Math.cos(r) * len, y: Math.sin(r) * len });
}

/** Vértice existente más cercano a `p` dentro de `radius` cm, o `null`. */
export function snapToVertex(p: Vec2, vertices: readonly Vec2[], radius: number): Vec2 | null {
  let best: Vec2 | null = null;
  let bestD = radius;
  for (const v of vertices) {
    const d = dist(p, v);
    if (d <= bestD) {
      best = v;
      bestD = d;
    }
  }
  return best;
}

/** Punto a `len` cm de `anchor` en la dirección de `towards` (longitud tecleada). */
export function pointAtLength(anchor: Vec2, towards: Vec2, len: number): Vec2 {
  const dir = normalize(sub(towards, anchor));
  const d = dir.x === 0 && dir.y === 0 ? { x: 1, y: 0 } : dir;
  return roundPoint(add(anchor, scale(d, len)));
}

export interface SnapOptions {
  /** Paso de rejilla en cm (0 = sin rejilla). */
  grid: number;
  /** Vértices a los que engancharse. */
  vertices: readonly Vec2[];
  /** Radio de enganche a vértices, en cm (depende del zoom). */
  vertexRadius: number;
  /** Punto de anclaje para el imán angular (muro en curso). */
  anchor?: Vec2;
}

/** Imán combinado: vértice > ángulo > rejilla. Resultado en medios cm. */
export function snapPoint(p: Vec2, o: SnapOptions): Vec2 {
  const v = snapToVertex(p, o.vertices, o.vertexRadius);
  if (v) return roundPoint(v);
  if (o.anchor) {
    const a = snapAngle(o.anchor, p);
    if (a !== p) {
      // Conserva el ángulo y redondea la longitud a la rejilla.
      const len = length(sub(a, o.anchor));
      const step = o.grid > 0 ? o.grid : 0.5;
      return pointAtLength(o.anchor, a, Math.round(len / step) * step);
    }
  }
  return snapToGrid(p, o.grid);
}
