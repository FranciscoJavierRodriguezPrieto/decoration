/**
 * Migraciones del formato de archivo (CLAUDE.md §5).
 *
 * Cada cambio de formato:
 *  1. sube SCHEMA_VERSION en schemas.ts,
 *  2. añade aquí un migrador `vN -> vN+1` (función pura sobre JSON sin validar),
 *  3. añade un fixture de la versión anterior en docs/fixtures/ y un test.
 */
import { SCHEMA_VERSION } from '../schemas';

export type Migrator = (raw: Record<string, unknown>) => Record<string, unknown>;

/** `MIGRATIONS[n]` transforma un documento de la versión `n` a la `n + 1`. */
export const MIGRATIONS: Readonly<Record<number, Migrator>> = {
  // 1: (raw) => ({ ...raw, schemaVersion: 2, ... }),
};

export class MigrationError extends Error {
  override name = 'MigrationError';
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Lleva un documento de cualquier versión conocida a la actual.
 * No valida el contenido: eso lo hace `ProjectSchema` después.
 */
export function migrate(
  raw: unknown,
  migrations: Readonly<Record<number, Migrator>> = MIGRATIONS,
  target: number = SCHEMA_VERSION,
): Record<string, unknown> {
  if (!isRecord(raw)) throw new MigrationError('El archivo no contiene un objeto JSON');

  const version = raw['schemaVersion'];
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new MigrationError('Falta "schemaVersion" o no es un entero válido');
  }
  if (version > target) {
    throw new MigrationError(
      `El proyecto es de una versión más nueva (${version}) que esta app (${target}). Actualiza PlanoCasa.`,
    );
  }

  let doc = raw;
  for (let v = version; v < target; v++) {
    const step = migrations[v];
    if (!step) throw new MigrationError(`No hay migración de la versión ${v} a la ${v + 1}`);
    doc = step(doc);
    if (doc['schemaVersion'] !== v + 1) {
      throw new MigrationError(`La migración ${v}→${v + 1} no actualizó schemaVersion`);
    }
  }
  return doc;
}
