/**
 * Paso del plano (cm, X derecha, Y abajo) a three.js (CLAUDE.md §4):
 * X3 = x, Z3 = y, Y3 = altura. La escena trabaja en cm.
 */
import type { Vec2 } from '../geometry/vec';

export type V3 = [number, number, number];

export const toThree = (p: Vec2, height = 0): V3 => [p.x, height, p.y];

/**
 * Giro de un mueble en el plano (grados, horario visto desde arriba) a
 * rotación Y de three.js (radianes). En three, girar +φ sobre Y lleva
 * (x, z) a (x cos φ + z sin φ, −x sin φ + z cos φ); el giro horario del
 * plano es el contrario.
 */
export const planRotationToY = (deg: number): number => {
  const r = (-deg * Math.PI) / 180;
  return Object.is(r, -0) ? 0 : r;
};

/** Rotación Y que alinea el eje X local de una caja con la dirección (dx, dy) del plano. */
export const directionToY = (d: Vec2): number => {
  const r = Math.atan2(-d.y, d.x);
  return Object.is(r, -0) ? 0 : r;
};

/** Aplica una rotación Y de three a un punto local (x, z), para comprobar en tests. */
export function rotateY(x: number, z: number, phi: number): [number, number] {
  return [x * Math.cos(phi) + z * Math.sin(phi), -x * Math.sin(phi) + z * Math.cos(phi)];
}
