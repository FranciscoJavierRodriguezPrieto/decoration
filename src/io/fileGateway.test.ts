import { describe, expect, it } from 'vitest';
import { isTauri, toJsonFileName } from './fileGateway';

describe('fileGateway', () => {
  it('fuera de Tauri no detecta Tauri', () => {
    expect(isTauri()).toBe(false);
  });

  it('genera nombres de archivo válidos en Windows', () => {
    expect(toJsonFileName('Salón Madrid — sofá nuevo')).toBe('Salón Madrid — sofá nuevo.json');
    expect(toJsonFileName('a/b:c*?')).toBe('a-b-c--.json');
    expect(toJsonFileName('  ')).toBe('proyecto.json');
    expect(toJsonFileName('casa...')).toBe('casa.json');
    expect(toJsonFileName('x\u0001y')).toBe('x-y.json');
  });
});
