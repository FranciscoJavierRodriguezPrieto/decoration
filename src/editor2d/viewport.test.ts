import { describe, expect, it } from 'vitest';
import { clampScale, fitView, MAX_SCALE, MIN_SCALE, zoomAt } from './viewport';

describe('viewport', () => {
  it('encaja el salón (450×500) centrado en un lienzo de 1000×600', () => {
    const v = fitView({ minX: 0, minY: 0, maxX: 450, maxY: 500 }, 1000, 600, 50);
    expect(v.scale).toBeCloseTo(1); // (600 - 100) / 500
    expect(v.x).toBeCloseTo((1000 - 450) / 2);
    expect(v.y).toBeCloseTo(50);
  });

  it('sin contenido o sin tamaño devuelve una vista por defecto', () => {
    expect(fitView(null, 800, 600)).toEqual({ scale: 1, x: 48, y: 48 });
    expect(fitView({ minX: 0, minY: 0, maxX: 1, maxY: 1 }, 0, 0).scale).toBe(1);
  });

  it('el zoom mantiene fijo el punto bajo el ratón', () => {
    const v = { scale: 1, x: 100, y: 50 };
    const z = zoomAt(v, { x: 300, y: 250 }, 2);
    // El punto del plano bajo el ratón era (200, 200) y lo sigue siendo.
    expect((300 - z.x) / z.scale).toBeCloseTo(200);
    expect((250 - z.y) / z.scale).toBeCloseTo(200);
  });

  it('limita la escala', () => {
    expect(clampScale(1000)).toBe(MAX_SCALE);
    expect(clampScale(0)).toBe(MIN_SCALE);
  });
});
