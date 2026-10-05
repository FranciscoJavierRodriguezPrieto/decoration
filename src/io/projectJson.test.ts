import { describe, expect, it } from 'vitest';
import { readFixture } from '../../tests/helpers';
import { formatPath, MAX_PROJECT_JSON_BYTES, parseProject, serializeProject } from './projectJson';

describe('parseProject', () => {
  it('informa de JSON mal formado', () => {
    const r = parseProject('{ no es json');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues[0]?.message).toMatch(/JSON no válido/);
  });

  it('informa de versiones no soportadas', () => {
    const r = parseProject(JSON.stringify({ schemaVersion: 42 }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues[0]?.path).toBe('schemaVersion');
  });

  it('devuelve rutas legibles en los errores de validación', () => {
    const doc = JSON.parse(readFixture('salon-madrid.json')) as {
      levels: { openings: { wallId: string }[] }[];
    };
    doc.levels[0]!.openings[1]!.wallId = 'nada';
    const r = parseProject(JSON.stringify(doc));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.map((i) => i.path)).toContain('levels[0].openings[1].wallId');
  });

  it('rechaza archivos desmesurados sin intentar parsearlos', () => {
    const r = parseProject(' '.repeat(MAX_PROJECT_JSON_BYTES + 1));
    expect(r.ok).toBe(false);
  });
});

describe('serializeProject', () => {
  it('usa 2 espacios y termina en salto de línea LF', () => {
    const r = parseProject(readFixture('salon-madrid.json'));
    if (!r.ok) expect.fail();
    const text = serializeProject(r.project);
    expect(text.startsWith('{\n  "schemaVersion": 1,')).toBe(true);
    expect(text.endsWith('}\n')).toBe(true);
    expect(text).not.toContain('\r');
  });
});

describe('formatPath', () => {
  it('formatea índices y claves', () => {
    expect(formatPath(['levels', 0, 'walls', 2, 'a', 'x'])).toBe('levels[0].walls[2].a.x');
    expect(formatPath([])).toBe('');
  });
});
