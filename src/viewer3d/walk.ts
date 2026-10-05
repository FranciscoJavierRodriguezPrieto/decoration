/**
 * Movimiento en primera persona con choque contra los muros (ESPECIFICACION §5):
 * si el paso completo choca, se intenta deslizar por cada eje. Puro.
 */
import { pointPolygonDistance, type Poly } from '../geometry/footprint';
import type { Vec2 } from '../geometry/vec';

export const EYE_HEIGHT = 165;
export const BODY_RADIUS = 20;

export const collides = (p: Vec2, obstacles: readonly Poly[], radius = BODY_RADIUS): boolean =>
  obstacles.some((o) => pointPolygonDistance(p, o) < radius);

export function moveWithCollision(
  from: Vec2,
  delta: Vec2,
  obstacles: readonly Poly[],
  radius = BODY_RADIUS,
): Vec2 {
  const full = { x: from.x + delta.x, y: from.y + delta.y };
  if (!collides(full, obstacles, radius)) return full;
  const onlyX = { x: from.x + delta.x, y: from.y };
  if (delta.x !== 0 && !collides(onlyX, obstacles, radius)) return onlyX;
  const onlyY = { x: from.x, y: from.y + delta.y };
  if (delta.y !== 0 && !collides(onlyY, obstacles, radius)) return onlyY;
  return from;
}

/** Dirección de avance en planta a partir del giro de la cámara (yaw de three). */
export function walkDelta(
  yaw: number,
  keys: { forward: number; right: number },
  distance: number,
): Vec2 {
  // En three la cámara mira a −Z con yaw 0; en planta, −Z es −Y (arriba).
  const fx = -Math.sin(yaw);
  const fy = -Math.cos(yaw);
  const rx = Math.cos(yaw);
  const ry = -Math.sin(yaw);
  const x = fx * keys.forward + rx * keys.right;
  const y = fy * keys.forward + ry * keys.right;
  const l = Math.hypot(x, y);
  return l === 0 ? { x: 0, y: 0 } : { x: (x / l) * distance, y: (y / l) * distance };
}
