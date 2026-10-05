import { describe, expect, it } from 'vitest';
import { parseDimensions } from './parseDimensions';

describe('parseDimensions (CATALOGO §5)', () => {
  it.each([
    ['236x85x85', { w: 236, d: 85, h: 85 }],
    ['236 × 85 × 85 cm', { w: 236, d: 85, h: 85 }],
    ['236 X 85 X 85', { w: 236, d: 85, h: 85 }],
    ['L236 P85 H85', { w: 236, d: 85, h: 85 }],
    ['Ancho: 236 cm Fondo: 85 cm Alto: 85 cm', { w: 236, d: 85, h: 85 }],
    ['Alto: 85 cm · Ancho: 236 cm · Profundidad: 85 cm', { w: 236, d: 85, h: 85 }],
    ['2,36 m x 0,85 m', { w: 236, d: 85 }],
    ['2.36m x 0.85m x 0.85m', { w: 236, d: 85, h: 85 }],
    ['165x95x78', { w: 165, d: 95, h: 78 }],
    ['165 x 95', { w: 165, d: 95 }],
    ['42,5 x 40 x 85', { w: 42.5, d: 40, h: 85 }],
    ['1650 x 950 mm', { w: 165, d: 95 }],
  ])('%s', (input, expected) => {
    expect(parseDimensions(input)).toMatchObject(expected);
  });

  it('sin altura no inventa una', () => {
    expect(parseDimensions('165 x 95')?.h).toBeUndefined();
  });

  it('avisa si el fondo es mayor que el ancho (posible orden cambiado)', () => {
    expect(parseDimensions('85 x 236 x 85')?.warnings[0]).toMatch(/orden/);
  });

  it('avisa de medidas sospechosas', () => {
    expect(parseDimensions('2000 x 90')?.warnings.join()).toMatch(/10 m/);
    expect(parseDimensions('2 x 0,9')?.warnings.join()).toMatch(/metros/);
  });

  it('rechaza lo que no son medidas', () => {
    expect(parseDimensions('')).toBeNull();
    expect(parseDimensions('sofá bonito')).toBeNull();
    expect(parseDimensions('236')).toBeNull();
    expect(parseDimensions('1 x 2 x 3 x 4')).toBeNull();
    expect(parseDimensions('0 x 85')).toBeNull();
  });
});
