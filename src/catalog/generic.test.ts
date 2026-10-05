import { describe, expect, it } from 'vitest';
import { Item, Template } from '../model/schemas';
import { GENERIC_CATALOG, GROUP_ORDER, searchCatalog } from './generic';

describe('catálogo genérico', () => {
  it('claves únicas y grupos conocidos', () => {
    const keys = GENERIC_CATALOG.map((i) => i.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const i of GENERIC_CATALOG) expect(GROUP_ORDER).toContain(i.group);
  });

  it('cada entrada produce un mueble válido según el esquema', () => {
    for (const g of GENERIC_CATALOG) {
      expect(Template.safeParse(g.template).success, g.key).toBe(true);
      const r = Item.safeParse({
        id: g.key,
        name: g.name,
        category: g.category,
        x: 0,
        y: 0,
        w: g.w,
        d: g.d,
        h: g.h,
        rotation: 0,
        status: 'candidato',
        color: g.color,
        ...(g.extended ? { extended: g.extended } : {}),
        ...(g.params ? { params: { template: g.template, ...g.params } } : {}),
      });
      expect(r.success, g.key).toBe(true);
    }
  });

  it('busca sin tildes ni mayúsculas', () => {
    expect(searchCatalog('SOFA').length).toBeGreaterThanOrEqual(6);
    expect(searchCatalog('frigorifico').map((i) => i.key)).toEqual(['combi', 'americano']);
    expect(searchCatalog('  ')).toHaveLength(GENERIC_CATALOG.length);
    expect(searchCatalog('xyz')).toEqual([]);
  });

  it('entiende sinónimos y varias palabras', () => {
    expect(searchCatalog('nevera').map((i) => i.key)).toEqual(['combi', 'americano']);
    expect(searchCatalog('tele').length).toBeGreaterThanOrEqual(2);
    expect(searchCatalog('wc').map((i) => i.name)).toEqual(['Inodoro']);
    expect(searchCatalog('cama 150').map((i) => i.name)).toEqual(['Cama 150']);
  });
});
