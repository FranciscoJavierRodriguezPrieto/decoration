/**
 * Valores de las reglas en cm (docs/CATALOGO_Y_ERGONOMIA.md §3).
 * `min` por debajo = error; `rec` por debajo = aviso.
 */
export const RULES = {
  /** Solape que se tolera antes de llamarlo colisión (redondeos al arrastrar). */
  overlapTolerance: 1,
  /** Hasta aquí, que la hoja de una puerta toque algo es "no abre del todo" (aviso). */
  doorRub: 10,
  paso: { min: 60, rec: 80, cell: 5 },
  sofaMesa: { min: 30, rec: 40 },
  silla: { min: 60, rec: 75 },
  armarioAbatible: { extra: 10, rec: 90 },
  armarioCorredera: { min: 60, rec: 70 },
  electrodomestico: { min: 90, rec: 110 },
  radiador: { min: 10, rec: 15 },
  tv: { min: 1.2, recMin: 1.5, recMax: 2.5, maxAngle: 30 },
  ventana: { maxCover: 0.3, depth: 40 },
} as const;

/** Categorías que no estorban al paso ni chocan (se pisan). */
export const FLAT_CATEGORIES = new Set(['alfombra']);

/** Parejas que pueden solaparse en planta: las sillas se meten bajo la mesa. */
export const TUCK_PAIRS: readonly (readonly [string, string])[] = [['silla', 'mesa']];
