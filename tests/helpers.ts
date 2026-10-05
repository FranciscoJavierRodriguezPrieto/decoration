import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseProject } from '../src/io/projectJson';
import type { Project } from '../src/model/project';

export const FIXTURES_DIR = join(__dirname, '..', 'docs', 'fixtures');

export const readFixture = (name: string): string => readFileSync(join(FIXTURES_DIR, name), 'utf8');

export const listJsonFixtures = (): string[] =>
  readdirSync(FIXTURES_DIR).filter((f) => f.endsWith('.json'));

/** Carga un fixture válido o lanza con los errores legibles. */
export function loadFixture(name: string): Project {
  const r = parseProject(readFixture(name));
  if (!r.ok) throw new Error(r.issues.map((i) => `${i.path}: ${i.message}`).join('\n'));
  return r.project;
}

/** Copia profunda mutable para construir casos de error. */
export const clone = <T>(v: T): T => structuredClone(v);
