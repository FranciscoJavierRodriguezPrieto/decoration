import { describe, expect, it } from 'vitest';
import {
  add,
  dist,
  distToSegment,
  dot,
  length,
  normalize,
  perp,
  rotate,
  roundHalf,
  roundPoint,
  samePoint,
  scale,
  sub,
  vec,
} from './vec';

describe('vec', () => {
  it('operaciones básicas', () => {
    expect(add(vec(1, 2), vec(3, 4))).toEqual({ x: 4, y: 6 });
    expect(sub(vec(3, 4), vec(1, 2))).toEqual({ x: 2, y: 2 });
    expect(scale(vec(1, -2), 3)).toEqual({ x: 3, y: -6 });
    expect(length(vec(3, 4))).toBe(5);
    expect(dist(vec(0, 0), vec(3, 4))).toBe(5);
    expect(dot(vec(1, 2), vec(3, 4))).toBe(11);
  });

  it('normaliza y trata el vector nulo', () => {
    expect(normalize(vec(10, 0))).toEqual({ x: 1, y: 0 });
    expect(normalize(vec(0, 0))).toEqual({ x: 0, y: 0 });
  });

  it('perpendicular a la izquierda en pantalla', () => {
    expect(perp(vec(1, 0))).toEqual({ x: 0, y: -1 });
  });

  it('rotación horaria con Y hacia abajo (convención de CLAUDE.md §4)', () => {
    // El frente (0,1) girado 90° mira a −X.
    const r = rotate(vec(0, 1), 90);
    expect(r.x).toBeCloseTo(-1);
    expect(r.y).toBeCloseTo(0);
    const r180 = rotate(vec(0, 1), 180);
    expect(r180.y).toBeCloseTo(-1);
  });

  it('redondeo a medio centímetro sin −0', () => {
    expect(roundHalf(42.26)).toBe(42.5);
    expect(roundHalf(42.24)).toBe(42);
    expect(Object.is(roundHalf(-0.1), 0)).toBe(true);
    expect(roundPoint(vec(0.74, 1.26))).toEqual({ x: 0.5, y: 1.5 });
  });

  it('igualdad con tolerancia', () => {
    expect(samePoint(vec(0, 0), vec(0.3, 0.3))).toBe(true);
    expect(samePoint(vec(0, 0), vec(1, 0))).toBe(false);
  });

  it('distancia a un segmento', () => {
    expect(distToSegment(vec(5, 3), vec(0, 0), vec(10, 0))).toBe(3);
    expect(distToSegment(vec(-4, 3), vec(0, 0), vec(10, 0))).toBe(5);
    expect(distToSegment(vec(3, 4), vec(0, 0), vec(0, 0))).toBe(5);
  });
});
