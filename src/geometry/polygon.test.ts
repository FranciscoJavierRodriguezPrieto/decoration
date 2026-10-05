import { describe, expect, it } from 'vitest';
import { areaCm2, areaM2, signedArea } from './polygon';

const salon = [
  { x: 0, y: 0 },
  { x: 450, y: 0 },
  { x: 450, y: 500 },
  { x: 0, y: 500 },
];

describe('polígonos', () => {
  it('área del salón de 450 × 500 = 22,5 m²', () => {
    expect(areaCm2(salon)).toBe(225_000);
    expect(areaM2(salon)).toBe(22.5);
  });

  it('el signo depende del sentido de recorrido y el área no', () => {
    const reversed = [...salon].reverse();
    expect(signedArea(salon)).toBe(-signedArea(reversed));
    expect(areaCm2(reversed)).toBe(225_000);
  });

  it('polígono en L (contorno del piso 2 del Catastro, ~85 m²)', () => {
    // Perímetro de la planta PS3 del FXCC, girado 18° y pasado a cm.
    const piso2 = [
      { x: 836, y: 0 },
      { x: 68, y: 21 },
      { x: 0, y: 776 },
      { x: 1410, y: 776 },
      { x: 1431, y: 362 },
      { x: 840, y: 369 },
      { x: 839, y: 264 },
    ];
    expect(areaM2(piso2)).toBeCloseTo(85.4, 0);
  });

  it('degenerados dan 0', () => {
    expect(areaCm2([])).toBe(0);
    expect(
      areaCm2([
        { x: 1, y: 1 },
        { x: 2, y: 2 },
      ]),
    ).toBe(0);
  });
});
