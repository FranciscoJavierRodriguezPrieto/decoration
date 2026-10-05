import { describe, expect, it } from 'vitest';
import { clone, loadFixture } from '../../tests/helpers';
import type { Level } from '../model/project';
import { ProjectSchema } from '../model/project';
import {
  addFixture,
  addOpening,
  centeredOffset,
  deleteFixture,
  deleteOpening,
  fixtureOnWall,
  levelIds,
  nearestWall,
  projectOnWall,
  updateFixture,
  updateOpening,
} from './openings';

const salon = loadFixture('salon-madrid.json');
const level = (): Level => clone(salon.levels[0]!);
const wall = (l: Level, id: string) => l.walls.find((w) => w.id === id)!;

const valid = (l: Level) => {
  const p = clone(salon);
  p.levels[0] = l;
  const r = ProjectSchema.safeParse(p);
  if (!r.success) expect.fail(r.error.issues.map((i) => i.message).join('\n'));
};

describe('proyección sobre muros', () => {
  it('proyecta y mide la distancia al eje', () => {
    const h = projectOnWall(wall(level(), 'w_sofa'), { x: 100, y: 20 });
    expect(h.t).toBe(100);
    expect(h.dist).toBe(20);
  });

  it('fuera del muro, la distancia se mide al extremo', () => {
    const h = projectOnWall(wall(level(), 'w_sofa'), { x: -30, y: 40 });
    expect(h.t).toBe(-30);
    expect(h.dist).toBe(50);
  });

  it('muro más cercano dentro del radio', () => {
    expect(nearestWall(level(), { x: 200, y: 8 }, 20)?.wall.id).toBe('w_sofa');
    expect(nearestWall(level(), { x: 445, y: 250 }, 20)?.wall.id).toBe('w_ventana');
    expect(nearestWall(level(), { x: 225, y: 250 }, 20)).toBeNull();
  });

  it('centra y ajusta el offset dentro del muro', () => {
    const w = wall(level(), 'w_sofa');
    expect(centeredOffset(w, 100, 80)).toBe(60);
    expect(centeredOffset(w, 10, 80)).toBe(0);
    expect(centeredOffset(w, 445, 80)).toBe(370);
  });

  it('lista los ids del nivel', () => {
    expect(levelIds(level())).toContain('radiador');
    expect(levelIds(level())).toContain('balcon');
  });
});

describe('huecos', () => {
  it('añade una puerta centrada con valores por defecto', () => {
    const { level: l, id } = addOpening(level(), 'w_tv', 100, 'puerta');
    const o = l.openings.find((x) => x.id === id)!;
    expect(id).toBe('puerta1');
    expect(o).toMatchObject({
      wallId: 'w_tv',
      offset: 59,
      width: 82,
      hinge: 'izq',
      swing: 'dentro',
    });
    valid(l);
  });

  it('añade una ventana con alféizar', () => {
    const { level: l, id } = addOpening(level(), 'w_sofa', 225, 'ventana', { width: 100 });
    expect(l.openings.find((x) => x.id === id)).toMatchObject({
      width: 100,
      sill: 90,
      offset: 175,
    });
    valid(l);
  });

  it('rechaza solapes, huecos más anchos que el muro y muros inexistentes', () => {
    expect(() => addOpening(level(), 'w_ventana', 100, 'ventana')).toThrow(/otro hueco/);
    expect(() => addOpening(level(), 'w_tv', 100, 'ventana', { width: 600 })).toThrow(/más ancho/);
    expect(() => addOpening(level(), 'nada', 10, 'puerta')).toThrow(/inexistente/);
  });

  it('mueve un hueco por el muro y lo ajusta a los extremos', () => {
    const l = updateOpening(level(), 'puerta_entrada', { offset: 1000 });
    expect(l.openings.find((o) => o.id === 'puerta_entrada')!.offset).toBe(410);
    valid(l);
  });

  it('mueve un hueco a otro muro', () => {
    const l = updateOpening(level(), 'puerta_entrada', { wallId: 'w_tv', offset: 20 });
    expect(l.openings.find((o) => o.id === 'puerta_entrada')!.wallId).toBe('w_tv');
    valid(l);
  });

  it('al convertir a ventana se le pone alféizar', () => {
    const l = updateOpening(level(), 'puerta_entrada', { kind: 'ventana' });
    expect(l.openings.find((o) => o.id === 'puerta_entrada')!.sill).toBe(90);
  });

  it('valida al cambiar', () => {
    expect(() => updateOpening(level(), 'nada', {})).toThrow(/inexistente/);
    expect(() => updateOpening(level(), 'ventana', { offset: 300 })).toThrow(/otro hueco/);
    expect(() => updateOpening(level(), 'ventana', { width: 900 })).toThrow(/más ancho/);
    expect(() => updateOpening(level(), 'ventana', { wallId: 'zz' })).toThrow(/Muro inexistente/);
  });

  it('borra un hueco', () => {
    expect(deleteOpening(level(), 'balcon').openings).toHaveLength(2);
    expect(() => deleteOpening(level(), 'nada')).toThrow();
  });
});

describe('elementos fijos', () => {
  it('un radiador en un muro horizontal queda pegado por dentro y con el largo en X', () => {
    const l = level();
    const f = fixtureOnWall(l, wall(l, 'w_sofa'), 200, 'radiador');
    expect(f).toMatchObject({ w: 80, d: 12, x: 200, wallId: 'w_sofa' });
    // Cara interior del tabique (5 cm) + medio radiador (6) + 1 de holgura
    expect(f.y).toBe(12);
  });

  it('en un muro vertical, el largo va en Y', () => {
    const l = level();
    const f = fixtureOnWall(l, wall(l, 'w_ventana'), 300, 'radiador');
    expect(f).toMatchObject({ w: 12, d: 80, y: 300 });
    expect(f.x).toBeLessThan(450);
  });

  it('añade, cambia y borra fijos', () => {
    const { level: l, id } = addFixture(level(), 'w_tv', 100, 'radiador');
    expect(id).toBe('radiador1');
    valid(l);
    const l2 = updateFixture(l, id, { h: 70, z: 10 });
    expect(l2.fixtures.find((f) => f.id === id)).toMatchObject({ h: 70, z: 10 });
    expect(deleteFixture(l2, id).fixtures).toHaveLength(3);
    expect(() => updateFixture(l, 'nada', {})).toThrow();
    expect(() => updateFixture(l, id, { wallId: 'zz' })).toThrow();
    expect(() => deleteFixture(l, 'nada')).toThrow();
    expect(() => addFixture(l, 'zz', 1, 'enchufe')).toThrow();
  });

  it('en un muro corto, el fijo no supera la longitud del muro', () => {
    const l = level();
    l.walls.push({
      id: 'corto',
      a: { x: 100, y: 100 },
      b: { x: 140, y: 100 },
      thickness: 10,
      kind: 'tabique',
    });
    const f = fixtureOnWall(l, wall(l, 'corto'), 0, 'radiador');
    expect(f.w).toBe(40);
    expect(f.x).toBe(120);
  });
});
