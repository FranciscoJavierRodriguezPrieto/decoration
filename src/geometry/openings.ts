/**
 * Huecos (puertas, ventanas…) y elementos fijos (radiadores, tomas…) sobre muros.
 * Funciones puras: devuelven un Level nuevo y validan antes de cambiar nada.
 */
import type { Fixture, Level, Opening, Wall } from '../model/project';
import { add, dot, perp, roundHalf, scale, sub, type Vec2 } from './vec';
import { centroid, interiorSide, nextId, pointOnWall, wallDir, wallLength } from './walls';

export type OpeningKind = Opening['kind'];
export type FixtureKind = Fixture['kind'];

/** Valores por defecto al crear un hueco (CATALOGO_Y_ERGONOMIA, ESPECIFICACION §4.2). */
export const OPENING_DEFAULTS: Record<
  OpeningKind,
  Pick<Opening, 'width' | 'height'> & Partial<Pick<Opening, 'sill' | 'hinge' | 'swing'>>
> = {
  puerta: { width: 82, height: 203, hinge: 'izq', swing: 'dentro' },
  ventana: { width: 120, height: 120, sill: 90 },
  balconera: { width: 80, height: 210, sill: 0, hinge: 'izq', swing: 'dentro' },
  hueco: { width: 80, height: 203 },
};

/** Medidas por defecto de los fijos (w = a lo largo del muro, d = fondo, h, z). */
export const FIXTURE_DEFAULTS: Record<
  FixtureKind,
  { len: number; depth: number; h: number; z: number }
> = {
  radiador: { len: 80, depth: 12, h: 60, z: 15 },
  toma_tv: { len: 10, depth: 2, h: 10, z: 30 },
  enchufe: { len: 8, depth: 2, h: 8, z: 30 },
  punto_luz: { len: 10, depth: 10, h: 2, z: 240 },
  columna: { len: 30, depth: 30, h: 250, z: 0 },
  espejo: { len: 80, depth: 2, h: 100, z: 100 },
};

/** Todos los ids de un nivel (los ids son únicos dentro del nivel). */
export function levelIds(level: Level): string[] {
  return [
    ...level.walls.map((w) => w.id),
    ...level.openings.map((o) => o.id),
    ...level.rooms.map((r) => r.id),
    ...level.fixtures.map((f) => f.id),
    ...level.zones.map((z) => z.id),
  ];
}

export interface WallHit {
  wall: Wall;
  /** Distancia desde el inicio del muro al pie de la perpendicular (sin limitar). */
  t: number;
  /** Distancia del punto al eje del muro. */
  dist: number;
}

/** Proyección de un punto sobre el eje de un muro. */
export function projectOnWall(wall: Wall, p: Vec2): WallHit {
  const d = wallDir(wall);
  const v = sub(p, wall.a);
  const t = dot(v, d);
  const len = wallLength(wall);
  const tc = Math.max(0, Math.min(len, t));
  const foot = add(wall.a, scale(d, tc));
  return { wall, t, dist: Math.hypot(p.x - foot.x, p.y - foot.y) };
}

/** Muro más cercano a `p` dentro de `maxDist` cm (o `null`). */
export function nearestWall(level: Pick<Level, 'walls'>, p: Vec2, maxDist: number): WallHit | null {
  let best: WallHit | null = null;
  for (const w of level.walls) {
    const h = projectOnWall(w, p);
    if (h.dist <= maxDist && (!best || h.dist < best.dist)) best = h;
  }
  return best;
}

/** Offset (inicio) para centrar un hueco de `width` en `t`, ajustado al muro. */
export function centeredOffset(wall: Wall, t: number, width: number): number {
  const len = wallLength(wall);
  return roundHalf(Math.max(0, Math.min(len - width, t - width / 2)));
}

function overlaps(level: Level, wallId: string, offset: number, width: number, exceptId?: string) {
  return level.openings.some(
    (o) =>
      o.wallId === wallId &&
      o.id !== exceptId &&
      offset < o.offset + o.width - 0.5 &&
      o.offset < offset + width - 0.5,
  );
}

const PREFIX: Record<OpeningKind, string> = {
  puerta: 'puerta',
  ventana: 'ventana',
  balconera: 'balconera',
  hueco: 'hueco',
};

/** Crea un hueco centrado en `t` cm del inicio del muro. */
export function addOpening(
  level: Level,
  wallId: string,
  t: number,
  kind: OpeningKind,
  overrides: Partial<Omit<Opening, 'id' | 'wallId' | 'kind' | 'offset'>> = {},
): { level: Level; id: string } {
  const wall = level.walls.find((w) => w.id === wallId);
  if (!wall) throw new Error(`Muro inexistente: "${wallId}"`);
  const spec = { ...OPENING_DEFAULTS[kind], ...overrides };
  const len = wallLength(wall);
  if (spec.width > len) throw new Error('El hueco es más ancho que el muro');
  const offset = centeredOffset(wall, t, spec.width);
  if (overlaps(level, wallId, offset, spec.width)) {
    throw new Error('Ya hay otro hueco en esa parte del muro');
  }
  const id = nextId(PREFIX[kind], levelIds(level));
  const opening: Opening = { id, wallId, kind, offset, ...spec };
  return { level: { ...level, openings: [...level.openings, opening] }, id };
}

export type OpeningPatch = Partial<Omit<Opening, 'id'>>;

/** Cambia un hueco (incluido moverlo a otro muro). Rechaza solapes y huecos que no caben. */
export function updateOpening(level: Level, id: string, patch: OpeningPatch): Level {
  const o = level.openings.find((x) => x.id === id);
  if (!o) throw new Error(`Hueco inexistente: "${id}"`);
  const next: Opening = { ...o, ...patch };
  const wall = level.walls.find((w) => w.id === next.wallId);
  if (!wall) throw new Error(`Muro inexistente: "${next.wallId}"`);
  const len = wallLength(wall);
  if (next.width > len + 0.5) throw new Error('El hueco es más ancho que el muro');
  next.offset = roundHalf(Math.max(0, Math.min(len - next.width, next.offset)));
  if (overlaps(level, next.wallId, next.offset, next.width, id)) {
    throw new Error('Ya hay otro hueco en esa parte del muro');
  }
  if (next.kind === 'ventana' && next.sill === undefined) next.sill = OPENING_DEFAULTS.ventana.sill;
  return { ...level, openings: level.openings.map((x) => (x.id === id ? next : x)) };
}

export function deleteOpening(level: Level, id: string): Level {
  if (!level.openings.some((o) => o.id === id)) throw new Error(`Hueco inexistente: "${id}"`);
  return { ...level, openings: level.openings.filter((o) => o.id !== id) };
}

/**
 * Coloca un fijo pegado a la cara interior de un muro, centrado en `t`.
 * El modelo guarda cajas sin giro: si el muro es más horizontal, el largo va en X.
 */
export function fixtureOnWall(
  level: Level,
  wall: Wall,
  t: number,
  kind: FixtureKind,
): Omit<Fixture, 'id'> {
  const def = FIXTURE_DEFAULTS[kind];
  const len = Math.min(def.len, wallLength(wall));
  const tc = Math.max(len / 2, Math.min(wallLength(wall) - len / 2, t));
  const axisPoint = pointOnWall(wall, tc);
  const pts = level.rooms.flatMap((r) => r.polygon);
  const center = pts.length > 0 ? centroid(pts) : add(axisPoint, perp(wallDir(wall)));
  const side = interiorSide(wall, center);
  const n = scale(perp(wallDir(wall)), side);
  const c = add(axisPoint, scale(n, wall.thickness / 2 + def.depth / 2 + 1));
  const d = wallDir(wall);
  const horizontal = Math.abs(d.x) >= Math.abs(d.y);
  return {
    kind,
    wallId: wall.id,
    x: roundHalf(c.x),
    y: roundHalf(c.y),
    w: horizontal ? len : def.depth,
    d: horizontal ? def.depth : len,
    h: def.h,
    z: def.z,
  };
}

export function addFixture(
  level: Level,
  wallId: string,
  t: number,
  kind: FixtureKind,
): { level: Level; id: string } {
  const wall = level.walls.find((w) => w.id === wallId);
  if (!wall) throw new Error(`Muro inexistente: "${wallId}"`);
  const id = nextId(kind === 'radiador' ? 'radiador' : kind, levelIds(level));
  const fixture: Fixture = { id, ...fixtureOnWall(level, wall, t, kind) };
  return { level: { ...level, fixtures: [...level.fixtures, fixture] }, id };
}

export type FixturePatch = Partial<Omit<Fixture, 'id'>>;

export function updateFixture(level: Level, id: string, patch: FixturePatch): Level {
  const f = level.fixtures.find((x) => x.id === id);
  if (!f) throw new Error(`Elemento fijo inexistente: "${id}"`);
  const next: Fixture = { ...f, ...patch };
  if (next.wallId !== undefined && !level.walls.some((w) => w.id === next.wallId)) {
    throw new Error(`Muro inexistente: "${next.wallId}"`);
  }
  return { ...level, fixtures: level.fixtures.map((x) => (x.id === id ? next : x)) };
}

export function deleteFixture(level: Level, id: string): Level {
  if (!level.fixtures.some((f) => f.id === id))
    throw new Error(`Elemento fijo inexistente: "${id}"`);
  return { ...level, fixtures: level.fixtures.filter((f) => f.id !== id) };
}
