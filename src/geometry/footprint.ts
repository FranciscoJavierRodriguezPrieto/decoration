/**
 * Huellas en planta y pruebas geométricas entre polígonos convexos. Puro.
 *
 * Todas las huellas que generan estas funciones son convexas (rectángulos
 * girados, polígonos regulares, sectores de 90°), así que basta con el teorema
 * del eje separador (SAT) para saber si se solapan y cuánto.
 */
import type { Item, Level, Opening, Wall } from '../model/project';
import { add, distToSegment, dot, normalize, perp, rotate, scale, sub, type Vec2 } from './vec';
import { doorSwing, interiorSide, centroid, openingSegment, wallDir } from './walls';

export type Poly = Vec2[];

/** Rectángulo local (frente hacia +Y) → mundo. `cy` desplaza el centro en local. */
function localRect(
  item: Pick<Item, 'x' | 'y' | 'rotation'>,
  w: number,
  d: number,
  cx = 0,
  cy = 0,
): Poly {
  const hw = w / 2;
  const hd = d / 2;
  const local: Vec2[] = [
    { x: cx - hw, y: cy - hd },
    { x: cx + hw, y: cy - hd },
    { x: cx + hw, y: cy + hd },
    { x: cx - hw, y: cy + hd },
  ];
  return local.map((p) => add({ x: item.x, y: item.y }, rotate(p, item.rotation)));
}

/** Polígono regular de `n` lados inscrito en un círculo. */
export function circlePoly(c: Vec2, r: number, n = 16): Poly {
  return Array.from({ length: n }, (_, i) => {
    const a = (2 * Math.PI * i) / n;
    return { x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) };
  });
}

const isRound = (item: Pick<Item, 'category' | 'params'>): boolean =>
  item.category === 'arbol' ||
  item.params?.template === 'arbol' ||
  item.params?.shape === 'redonda';

/** Huella normal del mueble (los árboles y las mesas redondas, como círculo). */
export function itemFootprint(
  item: Pick<Item, 'x' | 'y' | 'w' | 'd' | 'rotation' | 'category' | 'params'>,
): Poly {
  if (isRound(item)) return circlePoly(item, Math.min(item.w, item.d) / 2);
  return localRect(item, item.w, item.d);
}

/** Ancho por defecto del módulo chaise cuando el producto no lo indica. */
export const chaiseWidth = (item: Pick<Item, 'w' | 'params'>): number => {
  const p = item.params?.chaiseWidth;
  return typeof p === 'number' && p > 0 ? Math.min(p, item.w) : Math.min(100, item.w * 0.42);
};

/**
 * Huella extendida (asientos deslizantes sacados, chaise, cama abatible…) o
 * `null` si el mueble no tiene. El respaldo no se mueve: lo extendido crece
 * hacia el frente. En una chaise solo crece el módulo de su lado, que se
 * indica visto de frente (`izq` = a la izquierda de quien mira el sofá = −X local).
 */
export function extendedFootprint(
  item: Pick<Item, 'x' | 'y' | 'w' | 'd' | 'rotation' | 'params' | 'extended'>,
): Poly | null {
  const ext = item.extended;
  if (!ext) return null;
  if ('shape' in ext) {
    return ext.shape.map((p) => add({ x: item.x, y: item.y }, rotate(p, item.rotation)));
  }
  const back = -item.d / 2;
  const cy = back + ext.d / 2;
  if (item.params?.template === 'sofa_chaise') {
    const cw = chaiseWidth(item);
    const side = item.params.chaiseSide === 'der' ? 1 : -1;
    const cx = side * (Math.max(item.w, ext.w) / 2 - cw / 2);
    return localRect(item, cw, ext.d, cx, cy);
  }
  return localRect(item, ext.w, ext.d, 0, cy);
}

/** Frente del mueble (vector unitario) y punto medio de su cara delantera/trasera. */
export function itemFront(item: Pick<Item, 'rotation'>): Vec2 {
  return rotate({ x: 0, y: 1 }, item.rotation);
}

export function itemFaceCenter(
  item: Pick<Item, 'x' | 'y' | 'd' | 'rotation'>,
  face: 'front' | 'back',
): Vec2 {
  const k = face === 'front' ? item.d / 2 : -item.d / 2;
  return add({ x: item.x, y: item.y }, scale(itemFront(item), k));
}

/** Franja de `depth` cm pegada a una cara del mueble, del mismo ancho. */
export function faceStrip(
  item: Pick<Item, 'x' | 'y' | 'w' | 'd' | 'rotation'>,
  face: 'front' | 'back',
  depth: number,
  inset = 0,
): Poly {
  const sign = face === 'front' ? 1 : -1;
  const cy = sign * (item.d / 2 + depth / 2);
  return localRect(item, Math.max(1, item.w - 2 * inset), depth, 0, cy);
}

// ---------------------------------------------------------------------------
// Pruebas entre polígonos
// ---------------------------------------------------------------------------

function axesOf(p: Poly): Vec2[] {
  return p.map((a, i) => normalize(perp(sub(p[(i + 1) % p.length] ?? a, a))));
}

function project(p: Poly, axis: Vec2): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (const v of p) {
    const k = dot(v, axis);
    if (k < min) min = k;
    if (k > max) max = k;
  }
  return [min, max];
}

/**
 * Profundidad mínima de solape entre dos polígonos convexos (cm). 0 si no se
 * solapan o solo se tocan. Es lo que habría que mover uno para separarlos.
 */
export function convexOverlap(a: Poly, b: Poly): number {
  let best = Infinity;
  for (const axis of [...axesOf(a), ...axesOf(b)]) {
    if (axis.x === 0 && axis.y === 0) continue;
    const [a0, a1] = project(a, axis);
    const [b0, b1] = project(b, axis);
    const o = Math.min(a1, b1) - Math.max(a0, b0);
    if (o <= 0) return 0;
    if (o < best) best = o;
  }
  return best === Infinity ? 0 : best;
}

function segmentsIntersect(p1: Vec2, p2: Vec2, q1: Vec2, q2: Vec2): boolean {
  const cross = (o: Vec2, a: Vec2, b: Vec2) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const d1 = cross(q1, q2, p1);
  const d2 = cross(q1, q2, p2);
  const d3 = cross(p1, p2, q1);
  const d4 = cross(p1, p2, q2);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

/** Distancia mínima entre dos polígonos convexos (0 si se tocan o solapan). */
export function polygonDistance(a: Poly, b: Poly): number {
  if (convexOverlap(a, b) > 0) return 0;
  let best = Infinity;
  for (let i = 0; i < a.length; i++) {
    const a0 = a[i] as Vec2;
    const a1 = a[(i + 1) % a.length] as Vec2;
    for (let j = 0; j < b.length; j++) {
      const b0 = b[j] as Vec2;
      const b1 = b[(j + 1) % b.length] as Vec2;
      if (segmentsIntersect(a0, a1, b0, b1)) return 0;
      best = Math.min(
        best,
        distToSegment(a0, b0, b1),
        distToSegment(a1, b0, b1),
        distToSegment(b0, a0, a1),
        distToSegment(b1, a0, a1),
      );
    }
  }
  return best;
}

/** Distancia de un punto a un polígono (0 si está dentro). */
export function pointPolygonDistance(p: Vec2, poly: Poly): number {
  if (pointInPolygon(p, poly)) return 0;
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i] as Vec2;
    const b = poly[(i + 1) % poly.length] as Vec2;
    best = Math.min(best, distToSegment(p, a, b));
  }
  return best;
}

/** Punto dentro de polígono (par-impar). Sirve también para cóncavos. */
export function pointInPolygon(p: Vec2, poly: readonly Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i] as Vec2;
    const b = poly[j] as Vec2;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

export interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function polyBox(p: readonly Vec2[]): Box {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const v of p) {
    if (v.x < minX) minX = v.x;
    if (v.y < minY) minY = v.y;
    if (v.x > maxX) maxX = v.x;
    if (v.y > maxY) maxY = v.y;
  }
  return { minX, minY, maxX, maxY };
}

// ---------------------------------------------------------------------------
// Huecos
// ---------------------------------------------------------------------------

/**
 * Lado hacia el que "entra" un hueco (+1 izquierda del muro, −1 derecha).
 * Se mira qué estancia hay a cada lado: si solo hay una, ese es el dentro
 * (la puerta de la calle abre hacia casa); si hay dos, la más pequeña (las
 * puertas suelen abrir hacia el dormitorio o el baño, no hacia el pasillo).
 * Sin estancias, se usa el centro del nivel, como hasta ahora.
 */
export function openingSide(level: Pick<Level, 'rooms' | 'walls'>, wall: Wall, o: Opening): 1 | -1 {
  const [p0, p1] = openingSegment(wall, o);
  const mid = scale(add(p0, p1), 0.5);
  const n = perp(wallDir(wall));
  const probe = (s: 1 | -1) => add(mid, scale(n, s * (wall.thickness / 2 + 20)));
  const roomAt = (p: Vec2) => {
    const hits = level.rooms.filter((r) => pointInPolygon(p, r.polygon));
    return hits.length ? Math.min(...hits.map((r) => Math.abs(shoelace(r.polygon)))) : null;
  };
  const left = roomAt(probe(1));
  const right = roomAt(probe(-1));
  if (left !== null && right === null) return 1;
  if (right !== null && left === null) return -1;
  if (left !== null && right !== null && left !== right) return left < right ? 1 : -1;
  const center = centroid(
    level.rooms.flatMap((r) => r.polygon).concat(level.walls.flatMap((w) => [w.a, w.b])),
  );
  return interiorSide(wall, center);
}

const shoelace = (p: readonly Vec2[]): number =>
  p.reduce((s, a, i) => {
    const b = p[(i + 1) % p.length] as Vec2;
    return s + a.x * b.y - b.x * a.y;
  }, 0) / 2;

/** Sector barrido por una puerta abatible como polígono convexo (o null si no barre). */
export function doorSwingPolygon(wall: Wall, o: Opening, side: 1 | -1, steps = 8): Poly | null {
  if (o.kind === 'ventana' || o.kind === 'hueco') return null;
  const s = doorSwing(wall, o, side);
  if (!s) return null;
  const pts: Poly = [s.hinge];
  for (let i = 0; i <= steps; i++) {
    const a = ((s.startDeg + (s.sweepDeg * i) / steps) * Math.PI) / 180;
    pts.push({ x: s.hinge.x + s.radius * Math.cos(a), y: s.hinge.y + s.radius * Math.sin(a) });
  }
  return pts;
}

/** Cara interior de un hueco: el segmento desplazado al paramento del lado `side`. */
export function openingFace(wall: Wall, o: Opening, side: 1 | -1): [Vec2, Vec2] {
  const [p0, p1] = openingSegment(wall, o);
  const n = scale(perp(wallDir(wall)), side * (wall.thickness / 2));
  return [add(p0, n), add(p1, n)];
}

/** Punto delante de un hueco, a `gap` cm del paramento, por el lado `side`. */
export function openingProbe(wall: Wall, o: Opening, side: 1 | -1, gap: number): Vec2 {
  const [p0, p1] = openingSegment(wall, o);
  const mid = scale(add(p0, p1), 0.5);
  return add(mid, scale(perp(wallDir(wall)), side * (wall.thickness / 2 + gap)));
}
