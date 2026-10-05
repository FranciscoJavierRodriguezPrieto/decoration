/**
 * Aceptación de la fase 2 (ESPECIFICACION §9): las 8 distribuciones del salón
 * dan los avisos del análisis manual y ninguno falso.
 *  - Sofá bajo la ventana (M1, M3, M4, K1, K3, K4): pegado al radiador.
 *  - Comedor junto al balcón (M2, K2): la balconera no abre del todo.
 *  - KANSAS bajo la ventana (K3, K4): su respaldo de 105 tapa la ventana.
 *  - K1: al sacar los asientos del KANSAS chocan con el rojo.
 *  - M3/K3: la silla de cabecera queda a 9 cm del rojo.
 */
import { describe, expect, it } from 'vitest';
import { resolveVariantItems } from '../src/model/variants';
import { evaluateRules } from '../src/rules';
import { loadFixture } from './helpers';

const salon = loadFixture('salon-madrid.json');
const level = salon.levels[0]!;
const summary = (variantId: string, opts = {}) =>
  evaluateRules(level, resolveVariantItems(salon, variantId), opts)
    .filter((w) => w.severity !== 'info')
    .map((w) => `${w.severity}:${w.rule}:${w.objects.join('+')}${w.extended ? ':ext' : ''}`)
    .sort();

const EXPECTED: Record<string, string[]> = {
  base: [],
  M1: ['error:radiador:rojo+radiador'],
  M2: ['aviso:puerta:silla4+balcon'],
  M3: ['error:comedor:silla3+mesa', 'error:radiador:moscu+radiador'],
  M4: ['error:radiador:moscu+radiador'],
  K1: ['aviso:colision:kansas+rojo:ext', 'error:radiador:rojo+radiador'],
  K2: ['aviso:puerta:silla4+balcon'],
  K3: [
    'aviso:ventana:kansas+ventana',
    'error:comedor:silla3+mesa',
    'error:radiador:kansas+radiador',
  ],
  K4: ['aviso:ventana:kansas+ventana', 'error:radiador:kansas+radiador'],
};

describe('reglas sobre salon-madrid.json', () => {
  for (const [variant, expected] of Object.entries(EXPECTED)) {
    it(`${variant}`, () => {
      expect(summary(variant)).toEqual(expected);
    });
  }

  it('el árbol de Navidad solo cuenta con la temporada activada (tapa el radiador en M2)', () => {
    expect(summary('M2', { includeSeasonal: true })).toContain('error:radiador:arbol+radiador');
  });

  it('la distancia a la TV es solo una nota', () => {
    const ws = evaluateRules(level, resolveVariantItems(salon, 'M1'));
    expect(ws.find((w) => w.rule === 'tv')?.severity).toBe('info');
  });
});
