/** Utilidades de polígonos en el plano XY (cm). Funciones puras. */

export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

/**
 * Área con signo (fórmula del lazo). Con Y hacia abajo, un recorrido horario
 * en pantalla da área positiva.
 */
export function signedArea(poly: readonly Vec2[]): number {
  let s = 0;
  poly.forEach((a, i) => {
    const b = poly[(i + 1) % poly.length] ?? a;
    s += a.x * b.y - b.x * a.y;
  });
  return s / 2;
}

/** Área en cm² (siempre ≥ 0). Menos de 3 vértices = 0. */
export function areaCm2(poly: readonly Vec2[]): number {
  return poly.length < 3 ? 0 : Math.abs(signedArea(poly));
}

/** Área en m². */
export const areaM2 = (poly: readonly Vec2[]): number => areaCm2(poly) / 10_000;
