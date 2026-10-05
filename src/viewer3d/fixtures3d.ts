/**
 * Huecos (hojas de puerta, cristales) y elementos fijos en 3D. Puro.
 */
import { openingSide } from '../geometry/footprint';
import { add, normalize, rotate, scale, sub, type Vec2 } from '../geometry/vec';
import { doorSwing, openingSegment, wallDir } from '../geometry/walls';
import type { Level } from '../model/project';
import { directionToY, type V3 } from './coords';
import { openingSpan } from './walls3d';

export interface SceneBox {
  key: string;
  /** Objeto del modelo al que pertenece (para seleccionar desde el 3D). */
  ref: string;
  center: V3;
  size: V3;
  rotY: number;
  color: string;
  kind: 'hoja' | 'cristal' | 'marco' | 'fijo' | 'espejo' | 'luz';
}

const FRAME = 5;

/** Cuánto se dibujan abiertas las puertas (0 = cerradas, 1 = a 90°). */
export const DOOR_OPEN = 0.75;

export function openingBoxes(level: Pick<Level, 'walls' | 'openings' | 'rooms'>): SceneBox[] {
  const out: SceneBox[] = [];
  for (const o of level.openings) {
    const wall = level.walls.find((w) => w.id === o.wallId);
    if (!wall || o.kind === 'hueco') continue;
    const [p0, p1] = openingSegment(wall, o);
    const mid = scale(add(p0, p1), 0.5);
    const d = wallDir(wall);
    const rotY = directionToY(d);
    const [bottom, top] = openingSpan(o);
    const glass = o.kind !== 'puerta';
    // Marco: dos jambas y un cabecero (y alféizar en ventanas).
    const jamb = (p: Vec2, i: number) =>
      out.push({
        key: `${o.id}:jamba${i}`,
        ref: o.id,
        center: [p.x, (bottom + top) / 2, p.y],
        size: [FRAME, top - bottom, wall.thickness + 2],
        rotY,
        color: '#efece6',
        kind: 'marco',
      });
    jamb(add(p0, scale(d, FRAME / 2)), 0);
    jamb(sub(p1, scale(d, FRAME / 2)), 1);
    out.push({
      key: `${o.id}:cabecero`,
      ref: o.id,
      center: [mid.x, top - FRAME / 2, mid.y],
      size: [o.width, FRAME, wall.thickness + 2],
      rotY,
      color: '#efece6',
      kind: 'marco',
    });
    if (o.kind === 'ventana') {
      out.push({
        key: `${o.id}:alfeizar`,
        ref: o.id,
        center: [mid.x, bottom + 1.5, mid.y],
        size: [o.width + 6, 3, wall.thickness + 6],
        rotY,
        color: '#e3ded4',
        kind: 'marco',
      });
    }
    const side = openingSide(level, wall, o);
    const swing = o.kind === 'ventana' ? null : doorSwing(wall, o, side);
    if (swing && o.swing !== 'corredera') {
      // Hoja entreabierta: entre la posición cerrada y la abierta a 90°.
      const closed = normalize(sub(o.hinge === 'der' ? p0 : p1, swing.hinge));
      const open = normalize(sub(swing.leafEnd, swing.hinge));
      const ang = Math.atan2(
        closed.x * open.y - closed.y * open.x,
        closed.x * open.x + closed.y * open.y,
      );
      const dir = rotate(closed, (ang * DOOR_OPEN * 180) / Math.PI);
      const c = add(swing.hinge, scale(dir, o.width / 2));
      out.push({
        key: `${o.id}:hoja`,
        ref: o.id,
        center: [c.x, (bottom + top - FRAME) / 2, c.y],
        size: [o.width - 2, top - bottom - FRAME - 1, 4],
        rotY: directionToY(dir),
        color: glass ? '#cfe3e8' : '#f4f1ea',
        kind: glass ? 'cristal' : 'hoja',
      });
    } else {
      out.push({
        key: `${o.id}:cristal`,
        ref: o.id,
        center: [mid.x, (bottom + top) / 2, mid.y],
        size: [o.width - 2 * FRAME, top - bottom - FRAME, 1.5],
        rotY,
        color: '#cfe3e8',
        kind: glass ? 'cristal' : 'hoja',
      });
    }
  }
  return out;
}

export function fixtureBoxes(level: Pick<Level, 'fixtures' | 'ceilingHeight'>): SceneBox[] {
  const out: SceneBox[] = [];
  for (const f of level.fixtures) {
    const z = f.z ?? 0;
    const base = { key: f.id, ref: f.id, rotY: 0 };
    switch (f.kind) {
      case 'radiador':
        out.push({
          ...base,
          center: [f.x, z + f.h / 2, f.y],
          size: [f.w, f.h, f.d],
          color: '#f2f1ec',
          kind: 'fijo',
        });
        break;
      case 'columna':
        out.push({
          ...base,
          center: [f.x, level.ceilingHeight / 2, f.y],
          size: [f.w, level.ceilingHeight, f.d],
          color: '#ebe7df',
          kind: 'fijo',
        });
        break;
      case 'espejo':
        out.push({
          ...base,
          center: [f.x, z + f.h / 2, f.y],
          size: [f.w, f.h, f.d],
          color: '#d9e6ea',
          kind: 'espejo',
        });
        break;
      case 'punto_luz':
        out.push({
          ...base,
          center: [f.x, level.ceilingHeight - 6, f.y],
          size: [14, 12, 14],
          color: '#fff4d6',
          kind: 'luz',
        });
        break;
      default:
        out.push({
          ...base,
          center: [f.x, z + Math.min(f.h, 10) / 2, f.y],
          size: [Math.max(f.w, 2), Math.min(f.h, 10), Math.max(f.d, 2)],
          color: '#fafafa',
          kind: 'fijo',
        });
    }
  }
  return out;
}
