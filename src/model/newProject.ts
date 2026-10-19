/**
 * Proyecto vacío ("Nuevo proyecto") y assets que usa un proyecto. Puro.
 */
import { BASE_VARIANT_ID, ProjectSchema, type Project } from './project';
import { SCHEMA_VERSION } from './schemas';

export const NEW_PROJECT_NAME = 'Mi casa';
/** Altura de techo por defecto en España (CTE: mínimo 250 cm en estancias). */
export const DEFAULT_CEILING_CM = 250;

/**
 * Proyecto con un nivel sin muros y la distribución base vacía, listo para importar
 * el plano de fondo o dibujar a mano. `id` y `now` se inyectan para poder probarlo.
 */
export function createEmptyProject(id: string, now: string, name = NEW_PROJECT_NAME): Project {
  return ProjectSchema.parse({
    schemaVersion: SCHEMA_VERSION,
    id,
    name,
    createdAt: now,
    updatedAt: now,
    units: 'cm',
    levels: [
      {
        id: 'L0',
        name: 'Planta',
        elevation: 0,
        ceilingHeight: DEFAULT_CEILING_CM,
        walls: [],
        openings: [],
        rooms: [],
        fixtures: [],
        zones: [],
      },
    ],
    variants: [{ id: BASE_VARIANT_ID, name: 'Base', items: [], removed: [] }],
    activeVariantId: BASE_VARIANT_ID,
    catalog: [],
  });
}

/** Id nuevo con el formato de `Id` (letras, números, "-"). */
export const newProjectId = (now: Date = new Date()): string =>
  `casa-${now.getTime().toString(36)}`;

/**
 * Nombres de assets (dentro de `assets/`) a los que apunta el proyecto: fondos de
 * nivel e imágenes y modelos del catálogo. Al guardar, el resto se poda.
 */
export function referencedAssets(project: Project): string[] {
  const names = new Set<string>();
  for (const level of project.levels) {
    if (level.background) names.add(level.background.asset);
  }
  for (const c of project.catalog) {
    for (const img of c.images ?? []) names.add(img);
    if (c.model3d) names.add(c.model3d);
  }
  return [...names].sort();
}
