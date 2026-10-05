import { describe, expect, it } from 'vitest';
import type { Item, Level, Opening, Wall } from '../model/project';
import {
  chaiseWidth,
  circlePoly,
  convexOverlap,
  doorSwingPolygon,
  extendedFootprint,
  faceStrip,
  itemFaceCenter,
  itemFootprint,
  itemFront,
  openingFace,
  openingProbe,
  openingSide,
  pointInPolygon,
  pointPolygonDistance,
  polyBox,
  polygonDistance,
} from './footprint';

const sq = (x: number, y: number, s: number) => [
  { x, y },
  { x: x + s, y },
  { x: x + s, y: y + s },
  { x, y: y + s },
];

const base: Pick<Item, 'x' | 'y' | 'w' | 'd' | 'rotation' | 'category'> = {
  x: 100,
  y: 100,
  w: 200,
  d: 90,
  rotation: 0,
  category: 'sofa',
};

describe('huellas', () => {
  it('rectángulo girado y círculo para árboles y mesas redondas', () => {
    expect(polyBox(itemFootprint(base))).toEqual({ minX: 0, minY: 55, maxX: 200, maxY: 145 });
    const r = polyBox(itemFootprint({ ...base, rotation: 90 }));
    expect(r.minX).toBeCloseTo(55);
    expect(r.maxY).toBeCloseTo(200);
    expect(itemFootprint({ ...base, w: 74, d: 74, category: 'arbol' })).toHaveLength(16);
    expect(itemFootprint({ ...base, params: { shape: 'redonda' } })).toHaveLength(16);
  });

  it('extendida: crece hacia el frente desde el respaldo', () => {
    expect(extendedFootprint(base)).toBeNull();
    const e = extendedFootprint({ ...base, extended: { w: 200, d: 150 } });
    expect(polyBox(e!)).toEqual({ minX: 0, minY: 55, maxX: 200, maxY: 205 });
    const s = extendedFootprint({
      ...base,
      extended: {
        shape: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 0, y: 10 },
        ],
      },
    });
    expect(s![1]).toEqual({ x: 110, y: 100 });
  });

  it('chaise: solo el módulo de su lado, visto de frente', () => {
    const item = {
      ...base,
      extended: { w: 200, d: 150 },
      params: { template: 'sofa_chaise', chaiseSide: 'izq' },
    };
    expect(chaiseWidth(item)).toBe(84);
    expect(chaiseWidth({ ...item, params: { chaiseWidth: 90 } })).toBe(90);
    const izq = polyBox(extendedFootprint(item)!);
    expect(izq.minX).toBeCloseTo(0);
    expect(izq.maxX).toBeCloseTo(84);
    const der = polyBox(
      extendedFootprint({ ...item, params: { ...item.params, chaiseSide: 'der' } })!,
    );
    expect(der.minX).toBeCloseTo(116);
    // Girado 180°, la izquierda vista de frente pasa al otro lado del plano.
    const g = polyBox(extendedFootprint({ ...item, rotation: 180 })!);
    expect(g.minX).toBeCloseTo(116);
    expect(g.minY).toBeCloseTo(-5);
  });

  it('frente, caras y franjas', () => {
    expect(itemFront({ rotation: 90 }).x).toBeCloseTo(-1);
    expect(itemFaceCenter(base, 'front')).toEqual({ x: 100, y: 145 });
    expect(itemFaceCenter(base, 'back')).toEqual({ x: 100, y: 55 });
    const strip = polyBox(faceStrip(base, 'back', 30, 1));
    expect(strip).toEqual({ minX: 1, minY: 25, maxX: 199, maxY: 55 });
  });
});

describe('SAT y distancias', () => {
  it('solape, contacto y separación', () => {
    expect(convexOverlap(sq(0, 0, 10), sq(5, 0, 10))).toBeCloseTo(5);
    expect(convexOverlap(sq(0, 0, 10), sq(10, 0, 10))).toBe(0);
    expect(convexOverlap(sq(0, 0, 10), sq(20, 0, 10))).toBe(0);
    expect(convexOverlap(circlePoly({ x: 0, y: 0 }, 10), sq(8, -5, 10))).toBeGreaterThan(1);
  });

  it('distancia entre polígonos y a un punto', () => {
    expect(polygonDistance(sq(0, 0, 10), sq(13, 0, 10))).toBeCloseTo(3);
    expect(polygonDistance(sq(0, 0, 10), sq(5, 5, 10))).toBe(0);
    expect(
      polygonDistance(sq(0, 0, 10), [
        { x: 13, y: -5 },
        { x: 13, y: 20 },
      ]),
    ).toBeCloseTo(3);
    expect(pointPolygonDistance({ x: 5, y: 5 }, sq(0, 0, 10))).toBe(0);
    expect(pointPolygonDistance({ x: 15, y: 5 }, sq(0, 0, 10))).toBe(5);
    expect(pointInPolygon({ x: 5, y: 5 }, sq(0, 0, 10))).toBe(true);
    expect(pointInPolygon({ x: 15, y: 5 }, sq(0, 0, 10))).toBe(false);
  });
});

describe('huecos', () => {
  const w: Wall = {
    id: 'w',
    a: { x: 0, y: 0 },
    b: { x: 400, y: 0 },
    thickness: 10,
    kind: 'tabique',
  };
  const door: Opening = {
    id: 'p',
    wallId: 'w',
    offset: 100,
    width: 80,
    kind: 'puerta',
    height: 203,
    hinge: 'izq',
    swing: 'dentro',
  };
  const room = (y0: number, y1: number, id: string) => ({
    id,
    name: id,
    polygon: [
      { x: 0, y: y0 },
      { x: 400, y: y0 },
      { x: 400, y: y1 },
      { x: 0, y: y1 },
    ],
  });
  const level = (rooms: Level['rooms']): Pick<Level, 'rooms' | 'walls'> => ({ rooms, walls: [w] });

  it('lado: la única estancia, la más pequeña, o el centro', () => {
    expect(openingSide(level([room(0, 300, 'abajo')]), w, door)).toBe(-1);
    expect(openingSide(level([room(-300, 0, 'arriba')]), w, door)).toBe(1);
    expect(openingSide(level([room(0, 300, 'grande'), room(-100, 0, 'chica')]), w, door)).toBe(1);
    expect([1, -1]).toContain(openingSide(level([]), w, door));
  });

  it('barrido, cara y punto delante', () => {
    expect(doorSwingPolygon(w, { ...door, kind: 'ventana' }, -1)).toBeNull();
    expect(doorSwingPolygon(w, { ...door, swing: 'corredera' }, -1)).toBeNull();
    const s = polyBox(doorSwingPolygon(w, door, -1)!);
    expect(s.minX).toBeCloseTo(100);
    expect(s.maxX).toBeCloseTo(180);
    expect(s.maxY).toBeCloseTo(80);
    expect(openingFace(w, door, -1)).toEqual([
      { x: 100, y: 5 },
      { x: 180, y: 5 },
    ]);
    expect(openingProbe(w, door, -1, 20)).toEqual({ x: 140, y: 25 });
  });
});
