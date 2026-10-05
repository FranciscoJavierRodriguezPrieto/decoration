import { describe, expect, it } from 'vitest';
import { clone, loadFixture } from '../../tests/helpers';
import { resolveVariantItems, variantChain } from './variants';

const salon = loadFixture('salon-madrid.json');

describe('variantChain', () => {
  it('va de la base a la variante', () => {
    expect(variantChain(salon, 'M1').map((v) => v.id)).toEqual(['base', 'M1']);
    expect(variantChain(salon, 'base').map((v) => v.id)).toEqual(['base']);
  });

  it('lanza si la variante no existe', () => {
    expect(() => variantChain(salon, 'X')).toThrow(/inexistente/);
  });

  it('lanza si hay un ciclo', () => {
    const p = clone(salon);
    p.variants[1]!.parentId = 'M2';
    p.variants[2]!.parentId = 'M1';
    expect(() => variantChain(p, 'M1')).toThrow(/Ciclo/);
  });

  it('lanza si la cadena no llega a la base', () => {
    const p = clone(salon);
    p.variants[1]!.parentId = 'huerfano';
    expect(() => variantChain(p, 'M1')).toThrow(/no desciende de la base/);
  });
});

describe('resolveVariantItems', () => {
  it('M1 = muebles de la base + los suyos', () => {
    const ids = resolveVariantItems(salon, 'M1').map((i) => i.id);
    expect(ids.slice(0, 3)).toEqual(['mueble_tv', 'tv', 'estanteria']);
    expect(ids).toContain('moscu');
    expect(ids).toHaveLength(3 + 10);
  });

  it('aplica removed y sobrescrituras en variantes encadenadas', () => {
    const p = clone(salon);
    p.variants.push({
      id: 'M1b',
      name: 'M1 sin estantería y con la TV movida',
      parentId: 'M1',
      removed: ['estanteria'],
      items: [{ ...clone(p.variants[0]!.items[1]!), x: 200 }],
    });
    const items = resolveVariantItems(p, 'M1b');
    expect(items.find((i) => i.id === 'estanteria')).toBeUndefined();
    expect(items.find((i) => i.id === 'tv')?.x).toBe(200);
    // La TV sobrescrita conserva su posición en el orden
    expect(items[1]?.id).toBe('tv');
  });
});
