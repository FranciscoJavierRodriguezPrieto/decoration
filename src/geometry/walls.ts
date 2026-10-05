/**
 * Geometría de muros, huecos y muebles para el plano (CLAUDE.md §4).
 * Funciones puras: reciben el modelo y devuelven valores nuevos, sin mutar.
 */
import type { Item, Level, Opening, Wall } from '../model/project';
import type { Vec2 } from './vec';
import {
  add,
  dist,
  length,
  normalize,
  perp,
  rotate,
  roundHalf,
  roundPoint,
  samePoint,
  scale,
  sub,
} from './vec';

export const wallLength = (w: Pick<Wall, 'a' | 'b'>): number => length(sub(w.b, w.a));
export const wallDir = (w: Pick<Wall, 'a' | 'b'>): Vec2 => normalize(sub(w.b, w.a));

/** Todos los extremos de muro y vértices de estancia, sin duplicados. */
export function levelVertices(level: Pick<Level, 'walls' | 'rooms'>): Vec2[] {
  const out: Vec2[] = [];
  const push = (p: Vec2) => {
    if (!out.some((q) => samePoint(p, q))) out.push(p);
  };
  for (const w of level.walls) {
    push(w.a);
    push(w.b);
  }
  for (const r of level.rooms) r.polygon.forEach(push);
  return out;
}

/**
 * Cuánto hay que alargar el muro en su extremo `p` para cerrar la esquina:
 * medio grosor del muro más grueso que llega a ese punto (0 si no hay unión).
 */
function jointExtension(p: Vec2, wall: Wall, walls: readonly Wall[]): number {
  let ext = 0;
  for (const o of walls) {
    if (o.id !== wall.id && (samePoint(o.a, p) || samePoint(o.b, p))) {
      ext = Math.max(ext, o.thickness / 2);
    }
  }
  return ext;
}

/**
 * Polígono de 4 vértices que dibuja el muro con su grosor. En cada extremo
 * unido a otro muro se alarga medio grosor del otro para que las esquinas en L
 * y en T queden cerradas aunque los grosores sean distintos.
 */
export function wallQuad(wall: Wall, walls: readonly Wall[] = []): Vec2[] {
  const d = wallDir(wall);
  const n = scale(perp(d), wall.thickness / 2);
  const a = sub(wall.a, scale(d, jointExtension(wall.a, wall, walls)));
  const b = add(wall.b, scale(d, jointExtension(wall.b, wall, walls)));
  return [add(a, n), add(b, n), sub(b, n), sub(a, n)];
}

/** Punto a `offset` cm del inicio del muro, sobre su eje. */
export const pointOnWall = (wall: Wall, offset: number): Vec2 =>
  add(wall.a, scale(wallDir(wall), offset));

/** Segmento [inicio, fin] de un hueco sobre el eje de su muro. */
export function openingSegment(wall: Wall, o: Pick<Opening, 'offset' | 'width'>): [Vec2, Vec2] {
  return [pointOnWall(wall, o.offset), pointOnWall(wall, o.offset + o.width)];
}

/** Rectángulo del hueco (para "recortar" el muro en el dibujo). */
export function openingQuad(wall: Wall, o: Pick<Opening, 'offset' | 'width'>): Vec2[] {
  const [p0, p1] = openingSegment(wall, o);
  const n = scale(perp(wallDir(wall)), wall.thickness / 2 + 0.5);
  return [add(p0, n), add(p1, n), sub(p1, n), sub(p0, n)];
}

export interface DoorSwing {
  /** Bisagra (centro del arco). */
  hinge: Vec2;
  /** Extremo de la hoja abierta a 90°. */
  leafEnd: Vec2;
  radius: number;
  /** Ángulo inicial del arco en grados (horario, Y abajo) y barrido. */
  startDeg: number;
  sweepDeg: number;
}

/**
 * Barrido de una puerta abatible. `hinge` izq/der visto desde dentro de la
 * estancia (el lado hacia el que abre con swing = 'dentro').
 * Convención: "dentro" = lado izquierdo del muro según su sentido a→b
 * (en un contorno recorrido en sentido horario, el interior queda a la derecha;
 * por eso se usa el `side` explícito: +1 izquierda, −1 derecha).
 */
export function doorSwing(
  wall: Wall,
  o: Pick<Opening, 'offset' | 'width' | 'hinge' | 'swing'>,
  side: 1 | -1,
): DoorSwing | null {
  if (o.swing === 'corredera') return null;
  const [p0, p1] = openingSegment(wall, o);
  const d = wallDir(wall);
  const into = scale(perp(d), side * (o.swing === 'fuera' ? -1 : 1));
  const hingeAtStart = (o.hinge ?? 'izq') === 'izq';
  const hinge = hingeAtStart ? p0 : p1;
  const closed = hingeAtStart ? p1 : p0;
  const leafEnd = add(hinge, scale(into, o.width));
  const a0 = angleDeg(sub(closed, hinge));
  const a1 = angleDeg(sub(leafEnd, hinge));
  let sweep = a1 - a0;
  if (sweep > 180) sweep -= 360;
  if (sweep < -180) sweep += 360;
  return {
    hinge,
    leafEnd,
    radius: o.width,
    startDeg: sweep >= 0 ? a0 : a1,
    sweepDeg: Math.abs(sweep),
  };
}

const angleDeg = (v: Vec2): number => (Math.atan2(v.y, v.x) * 180) / Math.PI;

/**
 * Lado interior de un muro: +1 si el centro de la estancia queda a la
 * izquierda del sentido a→b (perp), −1 si queda a la derecha.
 */
export function interiorSide(wall: Wall, roomCentroid: Vec2): 1 | -1 {
  const mid = scale(add(wall.a, wall.b), 0.5);
  const n = perp(wallDir(wall));
  const v = sub(roomCentroid, mid);
  return n.x * v.x + n.y * v.y >= 0 ? 1 : -1;
}

/** Centroide simple (media de vértices). */
export function centroid(points: readonly Vec2[]): Vec2 {
  if (points.length === 0) return { x: 0, y: 0 };
  const s = points.reduce((acc, p) => add(acc, p), { x: 0, y: 0 });
  return scale(s, 1 / points.length);
}

/** Esquinas de la caja de un mueble ya girada (orden: tras-izq, tras-der, frente-der, frente-izq). */
export function itemCorners(item: Pick<Item, 'x' | 'y' | 'w' | 'd' | 'rotation'>): Vec2[] {
  const hw = item.w / 2;
  const hd = item.d / 2;
  // En local, el frente mira a +Y y el respaldo a −Y (CLAUDE.md §4).
  const local: Vec2[] = [
    { x: -hw, y: -hd },
    { x: hw, y: -hd },
    { x: hw, y: hd },
    { x: -hw, y: hd },
  ];
  return local.map((p) => add({ x: item.x, y: item.y }, rotate(p, item.rotation)));
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Caja envolvente de muros, estancias y zonas de un nivel (con margen de grosor). */
export function levelBounds(level: Pick<Level, 'walls' | 'rooms' | 'zones'>): Bounds | null {
  const pts: Vec2[] = [];
  for (const w of level.walls) pts.push(...wallQuad(w, level.walls));
  for (const r of level.rooms) pts.push(...r.polygon);
  for (const z of level.zones) pts.push({ x: z.x, y: z.y }, { x: z.x + z.w, y: z.y + z.d });
  if (pts.length === 0) return null;
  return {
    minX: Math.min(...pts.map((p) => p.x)),
    minY: Math.min(...pts.map((p) => p.y)),
    maxX: Math.max(...pts.map((p) => p.x)),
    maxY: Math.max(...pts.map((p) => p.y)),
  };
}

// ---------------------------------------------------------------------------
// Ediciones de nivel (devuelven un Level nuevo)
// ---------------------------------------------------------------------------

/**
 * Mueve un vértice: todos los extremos de muro y vértices de estancia que
 * coinciden con `from` pasan a `to`. Así una esquina compartida se mueve entera
 * y el contorno sigue cerrado. Después reajusta los huecos que se salgan.
 */
export function moveVertex(level: Level, from: Vec2, to: Vec2): Level {
  const t = roundPoint(to);
  const mv = (p: Vec2): Vec2 => (samePoint(p, from) ? t : p);
  const walls = level.walls
    .map((w) => ({ ...w, a: mv(w.a), b: mv(w.b) }))
    .filter((w) => !samePoint(w.a, w.b));
  const rooms = level.rooms.map((r) => ({ ...r, polygon: r.polygon.map(mv) }));
  return clampOpenings({ ...level, walls, rooms });
}

/**
 * Cambia la longitud de un muro manteniendo su inicio `a` y su dirección:
 * mueve el vértice `b` (y lo que esté unido a él).
 */
export function setWallLength(level: Level, wallId: string, len: number): Level {
  const w = level.walls.find((x) => x.id === wallId);
  if (!w) throw new Error(`Muro inexistente: "${wallId}"`);
  if (!(len > 0)) throw new Error('La longitud debe ser mayor que 0');
  const target = add(w.a, scale(wallDir(w), roundHalf(len)));
  return moveVertex(level, w.b, target);
}

/** Mantiene cada hueco dentro de su muro (offset y ancho). Quita los de muros borrados. */
export function clampOpenings(level: Level): Level {
  const walls = new Map(level.walls.map((w) => [w.id, w]));
  const openings: Opening[] = [];
  for (const o of level.openings) {
    const w = walls.get(o.wallId);
    if (!w) continue;
    const len = Math.floor(wallLength(w) * 2) / 2;
    const width = Math.min(o.width, len);
    const offset = Math.max(0, Math.min(o.offset, roundHalf(len - width)));
    if (width <= 0) continue;
    openings.push(width === o.width && offset === o.offset ? o : { ...o, width, offset });
  }
  return { ...level, openings };
}

/** Id libre con prefijo (`w1`, `w2`…). */
export function nextId(prefix: string, used: Iterable<string>): string {
  const set = new Set(used);
  let i = 1;
  while (set.has(`${prefix}${i}`)) i++;
  return `${prefix}${i}`;
}

/** Añade un muro de `a` a `b`. Devuelve el nivel nuevo y el id creado. */
export function addWall(
  level: Level,
  a: Vec2,
  b: Vec2,
  opts: Pick<Wall, 'thickness' | 'kind'> = { thickness: 10, kind: 'tabique' },
): { level: Level; id: string } {
  const pa = roundPoint(a);
  const pb = roundPoint(b);
  if (dist(pa, pb) < 1) throw new Error('El muro es demasiado corto');
  const used = [
    ...level.walls.map((w) => w.id),
    ...level.openings.map((o) => o.id),
    ...level.rooms.map((r) => r.id),
    ...level.fixtures.map((f) => f.id),
    ...level.zones.map((z) => z.id),
  ];
  const id = nextId('w', used);
  const wall: Wall = { id, a: pa, b: pb, thickness: opts.thickness, kind: opts.kind };
  return { level: { ...level, walls: [...level.walls, wall] }, id };
}

/** Borra un muro y lo que cuelga de él (huecos; los fijos pierden el enganche). */
export function deleteWall(level: Level, wallId: string): Level {
  if (!level.walls.some((w) => w.id === wallId)) throw new Error(`Muro inexistente: "${wallId}"`);
  return {
    ...level,
    walls: level.walls.filter((w) => w.id !== wallId),
    openings: level.openings.filter((o) => o.wallId !== wallId),
    fixtures: level.fixtures.map((f) => {
      if (f.wallId !== wallId) return f;
      const { wallId: _drop, ...rest } = f;
      void _drop;
      return rest;
    }),
  };
}
