import { describe, expect, it } from 'vitest';
import { loadFixture } from '../../tests/helpers';
import { ProjectSchema, type Item } from './project';
import { addItemToVariant, allItemIds, removeItemFromVariant, slugify } from './variantEdits';
import { resolveVariantItems } from './variants';

const salon = loadFixture('salon-madrid.json');
const sofa: Omit<Item, 'id'> = {
  name: 'Sofá rojo',
  category: 'sofa',
  x: 200,
  y: 60,
  w: 165,
  d: 95,
  h: 78,
  rotation: 0,
  status: 'tengo',
};

const ok = (p: unknown) => {
  const r = ProjectSchema.safeParse(p);
  if (!r.success) expect.fail(r.error.issues.map((i) => i.message).join('\n'));
};

describe('slugify', () => {
  it('quita tildes y símbolos', () => {
    expect(slugify('Sofá rojo')).toBe('sofa_rojo');
    expect(slugify('  TV 55"  ')).toBe('tv_55');
    expect(slugify('¡!')).toBe('mueble');
  });
});

describe('añadir', () => {
  it('añade con id legible y único en todo el proyecto', () => {
    const { project, id } = addItemToVariant(salon, 'M1', sofa);
    expect(id).toBe('sofa_rojo');
    expect(resolveVariantItems(project, 'M1').some((i) => i.id === id)).toBe(true);
    expect(resolveVariantItems(project, 'M2').some((i) => i.id === id)).toBe(false);
    ok(project);
    const again = addItemToVariant(project, 'M2', sofa);
    expect(again.id).toBe('sofa_rojo_1');
  });

  it('no reutiliza ids de la base ni de removed', () => {
    const { id } = addItemToVariant(salon, 'M1', { ...sofa, name: 'TV' });
    expect(id).not.toBe('tv');
    expect(allItemIds(salon)).toContain('tv');
  });

  it('variante inexistente', () => {
    expect(() => addItemToVariant(salon, 'ZZ', sofa)).toThrow();
  });
});

describe('quitar', () => {
  it('un mueble propio desaparece de la variante', () => {
    const p = removeItemFromVariant(salon, 'M1', 'moscu');
    expect(resolveVariantItems(p, 'M1').some((i) => i.id === 'moscu')).toBe(false);
    expect(p.variants[1]!.removed).toEqual([]);
    ok(p);
  });

  it('un mueble heredado se apunta en removed y la base no cambia', () => {
    const p = removeItemFromVariant(salon, 'M1', 'tv');
    expect(p.variants[1]!.removed).toEqual(['tv']);
    expect(p.variants[0]!.items.some((i) => i.id === 'tv')).toBe(true);
    expect(resolveVariantItems(p, 'M1').some((i) => i.id === 'tv')).toBe(false);
    expect(resolveVariantItems(p, 'K1').some((i) => i.id === 'tv')).toBe(true);
    ok(p);
  });

  it('en la base se borra de verdad', () => {
    const p = removeItemFromVariant(salon, 'base', 'tv');
    expect(p.variants[0]!.items.some((i) => i.id === 'tv')).toBe(false);
    ok(p);
  });

  it('errores', () => {
    expect(() => removeItemFromVariant(salon, 'M1', 'nada')).toThrow(/No existe/);
    expect(() => removeItemFromVariant(salon, 'ZZ', 'tv')).toThrow();
  });
});
