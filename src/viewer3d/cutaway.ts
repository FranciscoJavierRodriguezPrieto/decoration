/**
 * Corte "cutaway" de la vista órbita (ESPECIFICACION §5): los muros que
 * quedan entre la cámara y el centro de la casa se vuelven transparentes
 * para ver dentro. Puro.
 */
import type { Vec2 } from '../geometry/vec';
import type { Wall } from '../model/project';

const cross = (o: Vec2, a: Vec2, b: Vec2) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

function crosses(p1: Vec2, p2: Vec2, q1: Vec2, q2: Vec2): boolean {
  const d1 = cross(q1, q2, p1);
  const d2 = cross(q1, q2, p2);
  const d3 = cross(p1, p2, q1);
  const d4 = cross(p1, p2, q2);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

/**
 * Ids de los muros que tapan la vista: los que corta el segmento cámara→objetivo
 * (en planta) o están a menos de `margin` cm de la cámara.
 */
export function wallsToFade(
  walls: readonly Wall[],
  camera: Vec2,
  target: Vec2,
  margin = 0,
): Set<string> {
  const out = new Set<string>();
  for (const w of walls) {
    if (crosses(camera, target, w.a, w.b)) out.add(w.id);
    else if (margin > 0) {
      const ab = { x: w.b.x - w.a.x, y: w.b.y - w.a.y };
      const l2 = ab.x * ab.x + ab.y * ab.y;
      const t =
        l2 === 0
          ? 0
          : Math.max(0, Math.min(1, ((camera.x - w.a.x) * ab.x + (camera.y - w.a.y) * ab.y) / l2));
      const px = w.a.x + ab.x * t - camera.x;
      const py = w.a.y + ab.y * t - camera.y;
      if (Math.hypot(px, py) < margin) out.add(w.id);
    }
  }
  return out;
}
