/** Vectores 2D en cm (X derecha, Y abajo). Funciones puras. */
import type { Vec2 } from './polygon';

export type { Vec2 };

export const vec = (x: number, y: number): Vec2 => ({ x, y });
export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Vec2, k: number): Vec2 => ({ x: a.x * k, y: a.y * k });
export const length = (a: Vec2): number => Math.hypot(a.x, a.y);
export const dist = (a: Vec2, b: Vec2): number => length(sub(a, b));
export const dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y;

/** Vector unitario; el vector nulo devuelve (0, 0). */
export function normalize(a: Vec2): Vec2 {
  const l = length(a);
  return l === 0 ? { x: 0, y: 0 } : { x: a.x / l, y: a.y / l };
}

/** Perpendicular a la izquierda en pantalla (Y abajo): (x, y) → (y, −x). */
export const perp = (a: Vec2): Vec2 => ({ x: a.y, y: -a.x });

/** Giro horario en planta (Y abajo), en grados. */
export function rotate(a: Vec2, deg: number): Vec2 {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return { x: a.x * c - a.y * s, y: a.x * s + a.y * c };
}

/** Redondea a medio centímetro (resolución del modelo, CLAUDE.md §4). */
export const roundHalf = (n: number): number => {
  const r = Math.round(n * 2) / 2;
  return Object.is(r, -0) ? 0 : r;
};

export const roundPoint = (p: Vec2): Vec2 => ({ x: roundHalf(p.x), y: roundHalf(p.y) });

/** Igualdad con tolerancia (por defecto 0,5 cm). */
export const samePoint = (a: Vec2, b: Vec2, eps = 0.5): boolean => dist(a, b) <= eps;

/** Distancia de `p` al segmento `ab`. */
export function distToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const ab = sub(b, a);
  const l2 = dot(ab, ab);
  if (l2 === 0) return dist(p, a);
  const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / l2));
  return dist(p, add(a, scale(ab, t)));
}
