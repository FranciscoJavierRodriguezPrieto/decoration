/**
 * Interpreta medidas pegadas de una tienda (CATALOGO_Y_ERGONOMIA §5).
 * Acepta, entre otras:
 *   "236x85x85", "236 × 85 × 85 cm", "L236 P85 H85",
 *   "Ancho: 236 cm Fondo: 85 cm Alto: 85 cm", "2,36 m x 0,85 m".
 * Por defecto el orden es ancho × fondo × alto. Resultado en cm (medio cm).
 */

export interface Dimensions {
  w: number;
  d: number;
  h?: number;
  /** Avisos para pedir confirmación en la UI (no impiden usar el resultado). */
  warnings: string[];
}

const NUM = String.raw`(\d+(?:[.,]\d+)?)`;

const toNumber = (s: string): number => Number(s.replace(',', '.'));
const half = (n: number): number => Math.round(n * 2) / 2;

/** Convierte a cm según la unidad escrita (cm por defecto; m y mm también). */
function toCm(value: number, unit: string | undefined, fallback: 'cm' | 'm' | 'mm'): number {
  const u = (unit ?? fallback).toLowerCase();
  if (u === 'm') return value * 100;
  if (u === 'mm') return value / 10;
  return value;
}

/** Busca "etiqueta: número [unidad]" para ancho/fondo/alto en cualquier orden. */
function parseLabelled(text: string): Partial<Record<'w' | 'd' | 'h', number>> | null {
  const labels: Record<'w' | 'd' | 'h', string> = {
    w: String.raw`(?:ancho|anchura|largo|longitud|l|a|w)`,
    d: String.raw`(?:fondo|profundidad|prof\.?|p|f|d)`,
    h: String.raw`(?:alto|altura|h)`,
  };
  const out: Partial<Record<'w' | 'd' | 'h', number>> = {};
  for (const key of ['w', 'd', 'h'] as const) {
    const re = new RegExp(String.raw`\b${labels[key]}\s*[:=.]?\s*${NUM}\s*(cm|mm|m)?\b`, 'i');
    const m = re.exec(text);
    if (m?.[1]) out[key] = toCm(toNumber(m[1]), m[2], 'cm');
  }
  return out.w !== undefined && out.d !== undefined ? out : null;
}

export function parseDimensions(input: string): Dimensions | null {
  const text = input.trim();
  if (!text) return null;

  const labelled = parseLabelled(text);
  let w: number;
  let d: number;
  let h: number | undefined;

  if (labelled?.w !== undefined && labelled.d !== undefined) {
    w = labelled.w;
    d = labelled.d;
    h = labelled.h;
  } else {
    // Números separados por x, ×, *, / o espacios, con unidad opcional detrás de cada uno.
    const re = new RegExp(String.raw`${NUM}\s*(cm|mm|m)?(?![\d.,])`, 'gi');
    const parts: { v: number; unit?: string }[] = [];
    for (const m of text.matchAll(re)) {
      if (m[1]) parts.push({ v: toNumber(m[1]), ...(m[2] ? { unit: m[2] } : {}) });
    }
    if (parts.length < 2 || parts.length > 3) return null;
    // Si solo el último lleva unidad ("236 x 85 x 85 cm"), vale para todos.
    const lastUnit = parts.at(-1)?.unit;
    const fallback: 'cm' | 'm' | 'mm' =
      lastUnit && parts.every((p) => p.unit === undefined || p.unit === lastUnit)
        ? (lastUnit.toLowerCase() as 'cm' | 'm' | 'mm')
        : 'cm';
    const [a, b, c] = parts.map((p) => toCm(p.v, p.unit, fallback));
    if (a === undefined || b === undefined) return null;
    w = a;
    d = b;
    h = c;
  }

  if (!(w > 0) || !(d > 0) || (h !== undefined && !(h > 0))) return null;
  const warnings: string[] = [];
  if (d > w)
    warnings.push('El fondo es mayor que el ancho: comprueba el orden (ancho × fondo × alto).');
  if (Math.max(w, d, h ?? 0) > 1000) warnings.push('Alguna medida supera 10 m: ¿está en cm?');
  if (Math.min(w, d) < 5) warnings.push('Alguna medida es menor de 5 cm: ¿estaba en metros?');
  return { w: half(w), d: half(d), ...(h !== undefined ? { h: half(h) } : {}), warnings };
}
