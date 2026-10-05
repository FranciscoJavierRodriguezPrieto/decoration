import { describe, expect, it } from 'vitest';
import { pointAtLength, snapAngle, snapPoint, snapToGrid, snapToVertex } from './snap';

describe('snapToGrid', () => {
  it('redondea a la rejilla', () => {
    expect(snapToGrid({ x: 12, y: 18 }, 5)).toEqual({ x: 10, y: 20 });
    expect(snapToGrid({ x: 104, y: 96 }, 10)).toEqual({ x: 100, y: 100 });
  });
  it('sin rejilla, a medio centímetro', () => {
    expect(snapToGrid({ x: 12.3, y: 18.8 }, 0)).toEqual({ x: 12.5, y: 19 });
  });
});

describe('snapAngle', () => {
  const o = { x: 0, y: 0 };
  it('endereza ángulos cercanos a 0/45/90°', () => {
    const p = snapAngle(o, { x: 100, y: 5 });
    expect(p.y).toBeCloseTo(0);
    expect(p.x).toBeCloseTo(Math.hypot(100, 5));
    const q = snapAngle(o, { x: 70, y: 72 });
    expect(q.x).toBeCloseTo(q.y);
  });
  it('respeta ángulos lejanos a un múltiplo', () => {
    const p = { x: 100, y: 40 };
    expect(snapAngle(o, p)).toBe(p);
  });
  it('vector nulo sin cambios', () => {
    expect(snapAngle(o, o)).toBe(o);
  });
});

describe('snapToVertex', () => {
  const vs = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
  ];
  it('engancha al más cercano dentro del radio', () => {
    expect(snapToVertex({ x: 96, y: 3 }, vs, 10)).toEqual({ x: 100, y: 0 });
  });
  it('null si no hay ninguno cerca', () => {
    expect(snapToVertex({ x: 50, y: 50 }, vs, 10)).toBeNull();
  });
});

describe('pointAtLength', () => {
  it('coloca el punto a la longitud tecleada en la dirección actual', () => {
    expect(pointAtLength({ x: 0, y: 0 }, { x: 3, y: 0 }, 450)).toEqual({ x: 450, y: 0 });
    expect(pointAtLength({ x: 10, y: 10 }, { x: 10, y: 10 }, 50)).toEqual({ x: 60, y: 10 });
  });
});

describe('snapPoint', () => {
  const vertices = [{ x: 450, y: 0 }];
  it('prioriza los vértices existentes', () => {
    expect(snapPoint({ x: 447, y: 2 }, { grid: 10, vertices, vertexRadius: 8 })).toEqual({
      x: 450,
      y: 0,
    });
  });
  it('con ancla, endereza el ángulo y redondea la longitud a la rejilla', () => {
    const p = snapPoint(
      { x: 203, y: 6 },
      { grid: 5, vertices: [], vertexRadius: 8, anchor: { x: 0, y: 0 } },
    );
    expect(p).toEqual({ x: 205, y: 0 });
  });
  it('sin ángulo cercano, cae a la rejilla', () => {
    expect(
      snapPoint(
        { x: 103, y: 41 },
        { grid: 5, vertices: [], vertexRadius: 8, anchor: { x: 0, y: 0 } },
      ),
    ).toEqual({ x: 105, y: 40 });
  });
});
