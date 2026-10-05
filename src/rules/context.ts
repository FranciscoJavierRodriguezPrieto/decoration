/**
 * Prepara lo que necesitan las reglas: huellas de muebles, muros, huecos y
 * fijos de un nivel, con su rango de alturas. Puro.
 */
import {
  doorSwingPolygon,
  extendedFootprint,
  itemFootprint,
  openingSide,
  type Poly,
} from '../geometry/footprint';
import { add, scale, sub, type Vec2 } from '../geometry/vec';
import { openingQuad, wallQuad } from '../geometry/walls';
import type { Fixture, Item, Level, Opening, Wall } from '../model/project';
import { FLAT_CATEGORIES } from './config';
import type { RuleOptions } from './types';

export interface ItemSolid {
  item: Item;
  poly: Poly;
  /** Huella extendida, si la tiene. */
  ext: Poly | null;
  z0: number;
  z1: number;
}

export interface WallSolid {
  wall: Wall;
  poly: Poly;
}

export interface OpeningInfo {
  opening: Opening;
  wall: Wall;
  side: 1 | -1;
  quad: Poly;
  swing: Poly | null;
}

export interface FixtureSolid {
  fixture: Fixture;
  poly: Poly;
  z0: number;
  z1: number;
}

export interface RuleContext {
  level: Level;
  items: ItemSolid[];
  walls: WallSolid[];
  openings: OpeningInfo[];
  fixtures: FixtureSolid[];
  options: RuleOptions;
}

export const isFlat = (item: Pick<Item, 'category' | 'h'>): boolean =>
  FLAT_CATEGORIES.has(item.category) || item.h <= 2;

export function fixturePoly(f: Pick<Fixture, 'x' | 'y' | 'w' | 'd'>): Poly {
  const hw = f.w / 2;
  const hd = f.d / 2;
  return [
    { x: f.x - hw, y: f.y - hd },
    { x: f.x + hw, y: f.y - hd },
    { x: f.x + hw, y: f.y + hd },
    { x: f.x - hw, y: f.y + hd },
  ];
}

export function buildContext(
  level: Level,
  items: readonly Item[],
  options: RuleOptions,
): RuleContext {
  const solids: ItemSolid[] = items
    .filter((i) => i.status !== 'descartado')
    .filter((i) => options.includeSeasonal || !i.seasonal)
    .filter((i) => !isFlat(i))
    .map((item) => {
      const z0 = item.z ?? 0;
      return { item, poly: itemFootprint(item), ext: extendedFootprint(item), z0, z1: z0 + item.h };
    });
  const walls = level.walls.map((wall) => ({ wall, poly: wallQuad(wall, level.walls) }));
  const openings: OpeningInfo[] = [];
  for (const opening of level.openings) {
    const wall = level.walls.find((w) => w.id === opening.wallId);
    if (!wall) continue;
    const side = openingSide(level, wall, opening);
    openings.push({
      opening,
      wall,
      side,
      quad: openingQuad(wall, opening),
      swing: doorSwingPolygon(wall, opening, side),
    });
  }
  const fixtures = level.fixtures.map((fixture) => {
    const z0 = fixture.z ?? 0;
    return { fixture, poly: fixturePoly(fixture), z0, z1: z0 + fixture.h };
  });
  return { level, items: solids, walls, openings, fixtures, options };
}

/** Centro de un polígono (media de vértices), para poner etiquetas. */
export function polyCenter(p: readonly Vec2[]): Vec2 {
  const s = p.reduce((acc, v) => add(acc, v), { x: 0, y: 0 });
  return scale(s, 1 / Math.max(1, p.length));
}

/** Rango vertical común de dos objetos (cm); ≤ 0 si no coinciden en altura. */
export const verticalOverlap = (a: { z0: number; z1: number }, b: { z0: number; z1: number }) =>
  Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0);

export const midpoint = (a: Vec2, b: Vec2): Vec2 => add(a, scale(sub(b, a), 0.5));
