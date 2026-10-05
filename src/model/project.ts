/**
 * Esquema completo del proyecto: forma (schemas.ts) + integridad referencial.
 * Los tipos del modelo salen de aquí con `z.infer` (CLAUDE.md §5).
 */
import { z } from 'zod';
import type {
  CatalogItem as CatalogItemSchema,
  Fixture as FixtureSchema,
  Item as ItemSchema,
  Level as LevelSchema,
  Opening as OpeningSchema,
  Variant as VariantSchema,
  Wall as WallSchema,
} from './schemas';
import { ProjectShape } from './schemas';

export type Project = z.infer<typeof ProjectShape>;
export type Level = z.infer<typeof LevelSchema>;
export type Wall = z.infer<typeof WallSchema>;
export type Opening = z.infer<typeof OpeningSchema>;
export type Fixture = z.infer<typeof FixtureSchema>;
export type Variant = z.infer<typeof VariantSchema>;
export type Item = z.infer<typeof ItemSchema>;
export type CatalogItem = z.infer<typeof CatalogItemSchema>;

/** Id reservado de la variante base (siempre la primera). */
export const BASE_VARIANT_ID = 'base';

/** Tolerancia para comparar longitudes en cm (medio centímetro). */
const EPS_CM = 0.5;

const wallLength = (w: Wall): number => Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y);

function checkUnique(
  ctx: z.RefinementCtx,
  ids: readonly string[],
  path: (string | number)[],
  what: string,
): void {
  const seen = new Set<string>();
  ids.forEach((id, i) => {
    if (seen.has(id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [...path, i, 'id'],
        message: `Id de ${what} repetido: "${id}"`,
      });
    }
    seen.add(id);
  });
}

/** Comprueba referencias cruzadas que zod no puede expresar por campo. */
export function checkIntegrity(p: Project, ctx: z.RefinementCtx): void {
  // --- Niveles -------------------------------------------------------------
  checkUnique(
    ctx,
    p.levels.map((l) => l.id),
    ['levels'],
    'nivel',
  );

  p.levels.forEach((level, li) => {
    const base: (string | number)[] = ['levels', li];
    const all = [
      ...level.walls.map((e) => e.id),
      ...level.openings.map((e) => e.id),
      ...level.rooms.map((e) => e.id),
      ...level.fixtures.map((e) => e.id),
      ...level.zones.map((e) => e.id),
    ];
    const seen = new Set<string>();
    for (const id of all) {
      if (seen.has(id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: base,
          message: `Id repetido dentro del nivel "${level.id}": "${id}"`,
        });
      }
      seen.add(id);
    }

    const walls = new Map(level.walls.map((w) => [w.id, w]));

    level.openings.forEach((o, oi) => {
      const wall = walls.get(o.wallId);
      if (!wall) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [...base, 'openings', oi, 'wallId'],
          message: `El hueco "${o.id}" apunta a un muro inexistente: "${o.wallId}"`,
        });
        return;
      }
      if (o.offset + o.width > wallLength(wall) + EPS_CM) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [...base, 'openings', oi, 'width'],
          message: `El hueco "${o.id}" se sale del muro "${wall.id}"`,
        });
      }
    });

    level.fixtures.forEach((f, fi) => {
      if (f.wallId !== undefined && !walls.has(f.wallId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [...base, 'fixtures', fi, 'wallId'],
          message: `El elemento fijo "${f.id}" apunta a un muro inexistente: "${f.wallId}"`,
        });
      }
    });
  });

  // --- Catálogo ------------------------------------------------------------
  checkUnique(
    ctx,
    p.catalog.map((c) => c.id),
    ['catalog'],
    'catálogo',
  );
  const catalogIds = new Set(p.catalog.map((c) => c.id));

  // --- Variantes -----------------------------------------------------------
  checkUnique(
    ctx,
    p.variants.map((v) => v.id),
    ['variants'],
    'variante',
  );
  const variants = new Map(p.variants.map((v) => [v.id, v]));

  const first = p.variants[0];
  if (first && (first.id !== BASE_VARIANT_ID || first.parentId !== undefined)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['variants', 0],
      message: `La primera variante debe ser "${BASE_VARIANT_ID}" y no tener padre`,
    });
  }

  if (!variants.has(p.activeVariantId)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['activeVariantId'],
      message: `La variante activa no existe: "${p.activeVariantId}"`,
    });
  }

  p.variants.forEach((v, vi) => {
    const path: (string | number)[] = ['variants', vi];

    if (vi > 0) {
      if (v.id === BASE_VARIANT_ID) return; // ya lo informa checkUnique
      if (v.parentId === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [...path, 'parentId'],
          message: `La variante "${v.id}" necesita un padre`,
        });
      } else if (!variants.has(v.parentId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [...path, 'parentId'],
          message: `La variante "${v.id}" apunta a un padre inexistente: "${v.parentId}"`,
        });
      } else if (hasCycle(v.id, variants)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [...path, 'parentId'],
          message: `Ciclo de herencia en la variante "${v.id}"`,
        });
      }
    }

    checkUnique(
      ctx,
      v.items.map((it) => it.id),
      [...path, 'items'],
      'mueble',
    );

    v.items.forEach((it, ii) => {
      if (it.catalogId !== undefined && !catalogIds.has(it.catalogId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [...path, 'items', ii, 'catalogId'],
          message: `El mueble "${it.id}" apunta a un producto inexistente: "${it.catalogId}"`,
        });
      }
    });

    if (vi === 0 && v.removed.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [...path, 'removed'],
        message: 'La variante base no puede quitar muebles',
      });
    }
  });
}

function hasCycle(startId: string, variants: Map<string, Variant>): boolean {
  const visited = new Set<string>();
  let current: string | undefined = startId;
  while (current !== undefined) {
    if (visited.has(current)) return true;
    visited.add(current);
    current = variants.get(current)?.parentId;
  }
  return false;
}

/** Esquema que valida forma + integridad. Úsalo para todo JSON que entra. */
export const ProjectSchema = ProjectShape.superRefine(checkIntegrity);
