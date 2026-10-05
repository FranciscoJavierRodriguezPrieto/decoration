/**
 * Resolución de variantes: la base guarda todos sus muebles y cada variante solo
 * las diferencias (ESPECIFICACION §6). Funciones puras.
 */
import { BASE_VARIANT_ID, type Item, type Project, type Variant } from './project';

/** Cadena de herencia desde la base hasta `variantId` (ambas incluidas). */
export function variantChain(project: Project, variantId: string): Variant[] {
  const byId = new Map(project.variants.map((v) => [v.id, v]));
  const chain: Variant[] = [];
  const seen = new Set<string>();
  let current = byId.get(variantId);
  if (!current) throw new Error(`Variante inexistente: "${variantId}"`);

  while (current) {
    if (seen.has(current.id)) throw new Error(`Ciclo de herencia en "${current.id}"`);
    seen.add(current.id);
    chain.unshift(current);
    current = current.parentId !== undefined ? byId.get(current.parentId) : undefined;
  }

  if (chain[0]?.id !== BASE_VARIANT_ID) {
    throw new Error(`La variante "${variantId}" no desciende de la base`);
  }
  return chain;
}

/**
 * Muebles efectivos de una variante: se parte de la base y, en cada eslabón,
 * se quitan los `removed` y se añaden o sobrescriben los `items` por id.
 * Se conserva el orden: primero los heredados (en su sitio) y luego los nuevos.
 */
export function resolveVariantItems(project: Project, variantId: string): Item[] {
  const result = new Map<string, Item>();
  for (const v of variantChain(project, variantId)) {
    for (const id of v.removed) result.delete(id);
    for (const item of v.items) result.set(item.id, item);
  }
  return [...result.values()];
}
