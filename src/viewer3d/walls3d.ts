/**
 * Muros en 3D: cada muro se trocea en cajas macizas, dejando el hueco de las
 * puertas y ventanas (dintel encima, antepecho debajo). Puro.
 */
import type { Poly } from '../geometry/footprint';
import { add, dist, rotate, scale, sub, type Vec2 } from '../geometry/vec';
import { pointOnWall, wallDir, wallQuad } from '../geometry/walls';
import type { Level, Opening, Wall } from '../model/project';
import { directionToY, type V3 } from './coords';

export type WallPart = 'muro' | 'dintel' | 'antepecho';

export interface WallBox {
  key: string;
  wallId: string;
  part: WallPart;
  /** Centro de la caja en coordenadas de three (cm). */
  center: V3;
  /** Largo (a lo largo del muro), alto y grosor. */
  size: V3;
  rotY: number;
}

/** Cuánto se alarga el muro en cada extremo para cerrar las esquinas (como en el 2D). */
export function wallExtents(wall: Wall, walls: readonly Wall[]): [number, number] {
  const q = wallQuad(wall, walls);
  const n = scale(sub(q[0] as Vec2, q[3] as Vec2), 0.5);
  const a = sub(q[0] as Vec2, n);
  const b = sub(q[1] as Vec2, n);
  const len = dist(wall.a, wall.b);
  const d = wallDir(wall);
  const k = (p: Vec2) => (p.x - wall.a.x) * d.x + (p.y - wall.a.y) * d.y;
  return [Math.min(0, k(a)), Math.max(len, k(b))];
}

/** Altura inferior y superior del hueco de un vano. */
export function openingSpan(o: Opening): [number, number] {
  const bottom = o.kind === 'ventana' ? (o.sill ?? 90) : (o.sill ?? 0);
  return [bottom, bottom + o.height];
}

export function wallBoxes(level: Pick<Level, 'walls' | 'openings' | 'ceilingHeight'>): WallBox[] {
  const H = level.ceilingHeight;
  const out: WallBox[] = [];
  for (const wall of level.walls) {
    const [k0, k1] = wallExtents(wall, level.walls);
    const d = wallDir(wall);
    const rotY = directionToY(d);
    const box = (part: WallPart, from: number, to: number, y0: number, y1: number, i: number) => {
      if (to - from <= 0.01 || y1 - y0 <= 0.01) return;
      const mid = pointOnWall(wall, (from + to) / 2);
      out.push({
        key: `${wall.id}:${part}:${i}`,
        wallId: wall.id,
        part,
        center: [mid.x, (y0 + y1) / 2, mid.y],
        size: [to - from, y1 - y0, wall.thickness],
        rotY,
      });
    };
    const ops = level.openings
      .filter((o) => o.wallId === wall.id)
      .sort((a, b) => a.offset - b.offset);
    let from = k0;
    ops.forEach((o, i) => {
      const s = Math.max(k0, o.offset);
      const e = Math.min(k1, o.offset + o.width);
      box('muro', from, s, 0, H, i);
      const [bottom, top] = openingSpan(o);
      box('antepecho', s, e, 0, Math.min(bottom, H), i);
      box('dintel', s, e, Math.min(top, H), H, i);
      from = Math.max(from, e);
    });
    box('muro', from, k1, 0, H, ops.length);
  }
  return out;
}

/** Huella en planta de una caja de muro (para chocar en primera persona). */
export function boxFootprint(b: Pick<WallBox, 'center' | 'size' | 'rotY'>): Poly {
  const [cx, , cz] = b.center;
  const hw = b.size[0] / 2;
  const hd = b.size[2] / 2;
  // rotY de three = −giro en planta.
  const deg = (-b.rotY * 180) / Math.PI;
  return [
    { x: -hw, y: -hd },
    { x: hw, y: -hd },
    { x: hw, y: hd },
    { x: -hw, y: hd },
  ].map((p) => add({ x: cx, y: cz }, rotate(p, deg)));
}
