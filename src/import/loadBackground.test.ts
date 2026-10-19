import { describe, expect, it } from 'vitest';
import { clampPage, MAX_RENDER_SCALE, renderScale } from './loadBackground';

describe('renderScale', () => {
  it('un A4 apaisado (842 pt) se pinta a ~4096 px', () => {
    expect(renderScale(842, 595) * 842).toBeCloseTo(4096);
  });
  it('nunca baja de 1 ni sube del máximo', () => {
    expect(renderScale(20000, 100)).toBe(1);
    expect(renderScale(10, 10)).toBe(MAX_RENDER_SCALE);
    expect(renderScale(0, 0)).toBe(1);
  });
});

describe('clampPage', () => {
  it('limita a las páginas que hay', () => {
    expect(clampPage(undefined, 3)).toBe(1);
    expect(clampPage(0, 3)).toBe(1);
    expect(clampPage(5, 3)).toBe(3);
    expect(clampPage(2.4, 3)).toBe(2);
    expect(clampPage(2, 0)).toBe(1);
  });
});
