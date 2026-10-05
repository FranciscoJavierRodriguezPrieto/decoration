/**
 * Texto ⇄ Project. Puro y sin E/S: el ZIP y el disco los gestiona Rust
 * (src-tauri/core). Aquí solo se valida y se serializa de forma determinista.
 */
import { migrate, MigrationError } from '../model/migrations';
import { ProjectSchema, type Project } from '../model/project';

export interface ProjectIssue {
  /** Ruta legible, p. ej. "levels[0].openings[1].wallId". */
  path: string;
  message: string;
}

export type ParseResult = { ok: true; project: Project } | { ok: false; issues: ProjectIssue[] };

/** Límite defensivo: un project.json real ronda decenas de KB. */
export const MAX_PROJECT_JSON_BYTES = 20 * 1024 * 1024;

export function formatPath(path: readonly (string | number)[]): string {
  return path.reduce<string>(
    (acc, seg) => (typeof seg === 'number' ? `${acc}[${seg}]` : acc ? `${acc}.${seg}` : seg),
    '',
  );
}

/** Interpreta y valida el contenido de un project.json (de cualquier versión conocida). */
export function parseProject(text: string): ParseResult {
  if (text.length > MAX_PROJECT_JSON_BYTES) {
    return { ok: false, issues: [{ path: '', message: 'El archivo es demasiado grande' }] };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return { ok: false, issues: [{ path: '', message: `JSON no válido: ${detail}` }] };
  }

  let migrated: Record<string, unknown>;
  try {
    migrated = migrate(raw);
  } catch (e) {
    if (e instanceof MigrationError)
      return { ok: false, issues: [{ path: 'schemaVersion', message: e.message }] };
    throw e;
  }

  const result = ProjectSchema.safeParse(migrated);
  if (!result.success) {
    return {
      ok: false,
      issues: result.error.issues.map((i) => ({ path: formatPath(i.path), message: i.message })),
    };
  }
  return { ok: true, project: result.data };
}

/**
 * Serialización canónica: 2 espacios, LF final. El orden de claves lo fija el
 * esquema zod, así que guardar → abrir → guardar produce los mismos bytes.
 */
export function serializeProject(project: Project): string {
  return `${JSON.stringify(project, null, 2)}\n`;
}
