/**
 * Altas y bajas de muebles en una distribución (ESPECIFICACION §6). Puro.
 *
 * - Añadir: el mueble se guarda en la variante indicada con un id único en
 *   todo el proyecto (así nunca "sobrescribe" sin querer a uno de la base).
 * - Quitar: si el mueble es propio de la variante, se borra; si lo hereda de
 *   la base (o de un padre), la variante lo apunta en `removed` y la base no cambia.
 */
import { nextId } from '../geometry/walls';
import { BASE_VARIANT_ID, type Item, type Project } from './project';
import { resolveVariantItems, variantChain } from './variants';

/** Id legible a partir del nombre ("Sofá rojo" → "sofa_rojo"). */
export function slugify(name: string): string {
  const s = name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return s || 'mueble';
}

export function allItemIds(project: Project): string[] {
  return project.variants.flatMap((v) => [...v.items.map((i) => i.id), ...v.removed]);
}

export function addItemToVariant(
  project: Project,
  variantId: string,
  item: Omit<Item, 'id'>,
): { project: Project; id: string } {
  if (!project.variants.some((v) => v.id === variantId)) {
    throw new Error(`Variante inexistente: "${variantId}"`);
  }
  const used = allItemIds(project);
  const base = slugify(item.name);
  const id = used.includes(base) ? nextId(`${base}_`, used) : base;
  return {
    id,
    project: {
      ...project,
      variants: project.variants.map((v) =>
        v.id === variantId ? { ...v, items: [...v.items, { ...item, id }] } : v,
      ),
    },
  };
}

export function removeItemFromVariant(
  project: Project,
  variantId: string,
  itemId: string,
): Project {
  const chain = variantChain(project, variantId);
  const variant = chain.at(-1);
  if (!variant) throw new Error(`Variante inexistente: "${variantId}"`);
  if (!resolveVariantItems(project, variantId).some((i) => i.id === itemId)) {
    throw new Error(`No existe el mueble "${itemId}" en la variante "${variantId}"`);
  }
  const inherited =
    variant.id !== BASE_VARIANT_ID &&
    chain.slice(0, -1).some((v) => v.items.some((i) => i.id === itemId));
  return {
    ...project,
    variants: project.variants.map((v) => {
      if (v.id !== variantId) return v;
      return {
        ...v,
        items: v.items.filter((i) => i.id !== itemId),
        removed: inherited && !v.removed.includes(itemId) ? [...v.removed, itemId] : v.removed,
      };
    }),
  };
}
