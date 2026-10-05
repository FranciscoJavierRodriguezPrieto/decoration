/**
 * Regresión de formato (CLAUDE.md §5): todo fixture debe abrirse siempre, y
 * guardar → volver a abrir no debe cambiar nada (criterio de aceptación de la fase 0).
 */
import { describe, expect, it } from 'vitest';
import { parseProject, serializeProject } from '../src/io/projectJson';
import { listJsonFixtures, loadFixture, readFixture } from './helpers';

describe.each(listJsonFixtures())('fixture %s', (name) => {
  it('se abre y valida sin errores', () => {
    const r = parseProject(readFixture(name));
    if (!r.ok) expect.fail(r.issues.map((i) => `${i.path}: ${i.message}`).join('\n'));
  });

  it('guardar y volver a abrir conserva exactamente los datos originales', () => {
    const original: unknown = JSON.parse(readFixture(name));
    const saved = serializeProject(loadFixture(name));
    const reopened: unknown = JSON.parse(saved);
    expect(reopened).toStrictEqual(original);
  });

  it('la serialización es estable: guardar dos veces da los mismos bytes', () => {
    const first = serializeProject(loadFixture(name));
    const r = parseProject(first);
    if (!r.ok) expect.fail('no se pudo reabrir lo guardado');
    expect(serializeProject(r.project)).toBe(first);
  });
});

describe('salon-madrid.json (caso real)', () => {
  const p = loadFixture('salon-madrid.json');

  it('tiene la base y las 8 variantes M1–M4 y K1–K4', () => {
    expect(p.variants.map((v) => v.id)).toEqual([
      'base',
      'M1',
      'M2',
      'M3',
      'M4',
      'K1',
      'K2',
      'K3',
      'K4',
    ]);
    expect(p.activeVariantId).toBe('M1');
  });

  it('el salón mide 450 × 500 cm', () => {
    const level = p.levels[0];
    expect(level?.rooms[0]?.polygon).toEqual([
      { x: 0, y: 0 },
      { x: 450, y: 0 },
      { x: 450, y: 500 },
      { x: 0, y: 500 },
    ]);
  });

  it('conserva los medios centímetros (estantería en y = 482,5)', () => {
    const est = p.variants[0]?.items.find((i) => i.id === 'estanteria');
    expect(est?.y).toBe(482.5);
  });
});
