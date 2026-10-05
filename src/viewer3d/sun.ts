/**
 * Posición del sol para la luz direccional (ESPECIFICACION §5). Modelo solar
 * sencillo (declinación + ángulo horario), suficiente para ver por qué
 * ventana entra la luz a cada hora. Puro.
 */
import { rotate, type Vec2 } from '../geometry/vec';
import type { V3 } from './coords';

/** Madrid. */
export const DEFAULT_LATITUDE = 40.4;

export interface Sun {
  /** Vector unitario hacia el sol en coordenadas de three. */
  dir: V3;
  /** Altura sobre el horizonte en grados (negativa = de noche). */
  elevation: number;
  /** Acimut en grados desde el norte, en sentido horario. */
  azimuth: number;
}

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/**
 * @param hour hora solar (12 = mediodía solar).
 * @param northDeg hacia dónde está el norte en el plano: grados en sentido
 *   horario desde "arriba" (−Y). 0 = el norte arriba del plano.
 * @param dayOfYear 1–365 (por defecto, mediados de octubre).
 */
export function sunPosition(
  hour: number,
  northDeg = 0,
  dayOfYear = 290,
  latitude = DEFAULT_LATITUDE,
): Sun {
  const decl = rad(23.44) * Math.sin(rad((360 / 365) * (dayOfYear - 81)));
  const lat = rad(latitude);
  const h = rad(15 * (hour - 12));
  const sinEl = Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(h);
  const el = Math.asin(Math.max(-1, Math.min(1, sinEl)));
  // Acimut desde el norte, horario.
  const y = -Math.sin(h) * Math.cos(decl);
  const x = Math.sin(decl) * Math.cos(lat) - Math.cos(decl) * Math.sin(lat) * Math.cos(h);
  let az = deg(Math.atan2(y, x));
  if (az < 0) az += 360;
  const north: Vec2 = rotate({ x: 0, y: -1 }, northDeg);
  const horiz = rotate(north, az);
  const c = Math.cos(el);
  return { dir: [horiz.x * c, Math.sin(el), horiz.y * c], elevation: deg(el), azimuth: az };
}
