import { describe, expect, it } from 'vitest';
import { clone, loadFixture } from '../../tests/helpers';
import type { Level, Wall } from '../model/project';
import { ProjectSchema } from '../model/project';
import { areaM2 } from './polygon';
import {
  addWall,
  centroid,
  clampOpenings,
  deleteWall,
  doorSwing,
  interiorSide,
  itemCorners,
  levelBounds,
  levelVertices,
  moveVertex,
  nextId,
  openingQuad,
  openingSegment,
  pointOnWall,
  setWallLength,
  wallLength,
  wallQuad,
} from './walls';

const salon = loadFixture('salon-madrid.json');
const level = (): Level => clone(salon.levels[0]!);
const wall = (id: string): Wall => level().walls.find((w) => w.id === id)!;

describe('muros', () => {
  it('longitud y punto sobre el eje', () => {
    expect(wallLength(wall('w_sofa'))).toBe(450);
    expect(pointOnWall(wall('w_ventana'), 40)).toEqual({ x: 450, y: 40 });
  });

  it('los vértices del salón son sus 4 esquinas', () => {
    expect(levelVertices(level())).toHaveLength(4);
  });

  it('quad sin uniones = rectángulo del grosor sobre el eje', () => {
    const w: Wall = {
      id: 'x',
      a: { x: 0, y: 0 },
      b: { x: 100, y: 0 },
      thickness: 10,
      kind: 'tabique',
    };
    expect(wallQuad(w)).toEqual([
      { x: 0, y: -5 },
      { x: 100, y: -5 },
      { x: 100, y: 5 },
      { x: 0, y: 5 },
    ]);
  });

  it('quad con uniones se alarga medio grosor del muro vecino', () => {
    const l = level();
    // w_sofa (10 cm) se une a w_entrada (10 cm) en x=0 y a la fachada (25 cm) en x=450.
    const q = wallQuad(l.walls[0]!, l.walls);
    expect(Math.min(...q.map((p) => p.x))).toBe(-5);
    expect(Math.max(...q.map((p) => p.x))).toBe(462.5);
    // La fachada solo se alarga medio tabique: no sobresale de la esquina.
    const f = wallQuad(l.walls[1]!, l.walls);
    expect(Math.min(...f.map((p) => p.y))).toBe(-5);
  });
});

describe('huecos', () => {
  it('segmento y rectángulo de recorte', () => {
    const w = wall('w_ventana');
    expect(openingSegment(w, { offset: 40, width: 160 })).toEqual([
      { x: 450, y: 40 },
      { x: 450, y: 200 },
    ]);
    const q = openingQuad(w, { offset: 40, width: 160 });
    expect(q).toHaveLength(4);
    expect(Math.max(...q.map((p) => p.x)) - Math.min(...q.map((p) => p.x))).toBe(26);
  });

  it('barrido de la puerta de entrada hacia dentro del salón', () => {
    const l = level();
    const w = l.walls.find((x) => x.id === 'w_entrada')!;
    const side = interiorSide(w, centroid(l.rooms[0]!.polygon));
    const s = doorSwing(w, { offset: 10, width: 90, hinge: 'izq', swing: 'dentro' }, side)!;
    expect(s.radius).toBe(90);
    expect(s.sweepDeg).toBeCloseTo(90);
    // La hoja abierta queda dentro del salón (x > 0).
    expect(s.leafEnd.x).toBeGreaterThan(0);
    expect(s.hinge).toEqual({ x: 0, y: 490 });
  });

  it('bisagra a la derecha y apertura hacia fuera', () => {
    const l = level();
    const w = l.walls.find((x) => x.id === 'w_entrada')!;
    const s = doorSwing(w, { offset: 10, width: 90, hinge: 'der', swing: 'fuera' }, 1)!;
    expect(s.hinge).toEqual({ x: 0, y: 400 });
    expect(s.sweepDeg).toBeCloseTo(90);
  });

  it('las correderas no tienen barrido', () => {
    expect(doorSwing(wall('w_tv'), { offset: 0, width: 80, swing: 'corredera' }, 1)).toBeNull();
  });

  it('lado interior según el centroide', () => {
    const w = wall('w_sofa'); // de (0,0) a (450,0); el salón está en +Y
    expect(interiorSide(w, { x: 225, y: 250 })).toBe(-1);
    expect(interiorSide(w, { x: 225, y: -250 })).toBe(1);
  });
});

describe('muebles', () => {
  it('esquinas sin giro y con giro de 90°', () => {
    const it0 = { x: 100, y: 50, w: 200, d: 80, rotation: 0 };
    expect(itemCorners(it0)[0]).toEqual({ x: 0, y: 10 });
    const c = itemCorners({ ...it0, rotation: 90 });
    const xs = c.map((p) => p.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(80);
  });
});

describe('caja envolvente', () => {
  it('incluye el grosor de los muros', () => {
    const b = levelBounds(level())!;
    expect(b.minX).toBe(-5);
    expect(b.maxX).toBe(462.5);
  });
  it('null si el nivel está vacío', () => {
    expect(levelBounds({ walls: [], rooms: [], zones: [] })).toBeNull();
  });
});

describe('ediciones', () => {
  it('mover una esquina arrastra los dos muros y la estancia', () => {
    const l = moveVertex(level(), { x: 450, y: 0 }, { x: 480, y: 0 });
    expect(l.walls.find((w) => w.id === 'w_sofa')!.b).toEqual({ x: 480, y: 0 });
    expect(l.walls.find((w) => w.id === 'w_ventana')!.a).toEqual({ x: 480, y: 0 });
    expect(l.rooms[0]!.polygon[1]).toEqual({ x: 480, y: 0 });
  });

  it('el resultado sigue siendo un proyecto válido', () => {
    const p = clone(salon);
    p.levels[0] = moveVertex(p.levels[0]!, { x: 450, y: 500 }, { x: 430.3, y: 520.8 });
    expect(ProjectSchema.safeParse(p).success).toBe(true);
  });

  it('mover un vértice encima de otro elimina el muro degenerado', () => {
    const l = moveVertex(level(), { x: 450, y: 0 }, { x: 0, y: 0 });
    expect(l.walls.some((w) => w.id === 'w_sofa')).toBe(false);
  });

  it('cambiar la longitud de un muro mueve su extremo b', () => {
    const l = setWallLength(level(), 'w_sofa', 400);
    expect(l.walls.find((w) => w.id === 'w_sofa')!.b).toEqual({ x: 400, y: 0 });
    expect(l.walls.find((w) => w.id === 'w_ventana')!.a).toEqual({ x: 400, y: 0 });
  });

  it('valida la longitud y el muro', () => {
    expect(() => setWallLength(level(), 'nada', 100)).toThrow(/inexistente/);
    expect(() => setWallLength(level(), 'w_sofa', 0)).toThrow(/mayor que 0/);
  });

  it('acortar un muro reajusta sus huecos', () => {
    // La balconera está en w_ventana, offset 370 + 80 = 450 de 500.
    const l = setWallLength(level(), 'w_ventana', 400);
    const b = l.openings.find((o) => o.id === 'balcon')!;
    expect(b.offset + b.width).toBeLessThanOrEqual(400);
    expect(b.width).toBe(80);
  });

  it('clampOpenings estrecha los huecos más anchos que el muro y quita los huérfanos', () => {
    const l = level();
    l.openings[1]!.width = 900;
    l.openings[0]!.wallId = 'borrado';
    const c = clampOpenings(l);
    expect(c.openings.find((o) => o.id === 'ventana')!.width).toBe(500);
    expect(c.openings.some((o) => o.id === 'puerta_entrada')).toBe(false);
  });

  it('añadir un muro con id libre', () => {
    const { level: l, id } = addWall(level(), { x: 200, y: 0 }, { x: 200, y: 230.2 });
    expect(id).toBe('w1');
    expect(l.walls.at(-1)).toEqual({
      id: 'w1',
      a: { x: 200, y: 0 },
      b: { x: 200, y: 230 },
      thickness: 10,
      kind: 'tabique',
    });
    expect(() => addWall(level(), { x: 0, y: 0 }, { x: 0.2, y: 0 })).toThrow(/corto/);
  });

  it('nextId salta los usados', () => {
    expect(nextId('w', ['w1', 'w2', 'x'])).toBe('w3');
  });

  it('borrar un muro quita sus huecos y suelta los fijos', () => {
    const l = deleteWall(level(), 'w_ventana');
    expect(l.walls).toHaveLength(3);
    expect(l.openings.map((o) => o.id)).toEqual(['puerta_entrada']);
    expect(l.fixtures.find((f) => f.id === 'radiador')!.wallId).toBeUndefined();
    expect(l.fixtures.find((f) => f.id === 'espejo')!.wallId).toBe('w_entrada');
    expect(() => deleteWall(level(), 'nada')).toThrow();
  });

  it('el área se recalcula tras mover una esquina', () => {
    const l = moveVertex(level(), { x: 450, y: 500 }, { x: 450, y: 400 });
    // Trapecio: (450·500 + 450·400)/2 = 202 500 cm²
    expect(areaM2(l.rooms[0]!.polygon)).toBeCloseTo(20.25);
  });
});
