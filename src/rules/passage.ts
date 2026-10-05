/**
 * Regla 2: paso libre entre puertas y balconeras de cada estancia.
 *
 * 1. Rejilla de 5 cm sobre la estancia. Cada celda guarda su holgura: la
 *    distancia exacta al obstáculo más cercano (muros sin los huecos de paso,
 *    radiadores, columnas y muebles).
 * 2. Desde cada puerta se busca el "camino más ancho" a las demás (Dijkstra
 *    que maximiza la holgura mínima del recorrido). El ancho de paso es
 *    2 × holgura + media celda (corrige que el centro de celda no caiga justo
 *    en el eje del pasillo).
 * 3. Se compara con la misma estancia vacía: si el cuello de botella ya está
 *    en la arquitectura (una puerta de 70, un pasillo estrecho), no es culpa
 *    de los muebles y no se avisa.
 *
 * Alrededor de cada puerta (45 cm) no se mide: lo que estorba ahí lo cubren
 * el barrido de la puerta y las colisiones.
 */
import {
  circlePoly,
  openingProbe,
  pointInPolygon,
  pointPolygonDistance,
  polyBox,
  type Box,
  type Poly,
} from '../geometry/footprint';
import { add, dist, perp, scale, type Vec2 } from '../geometry/vec';
import { pointOnWall, wallDir, wallQuad } from '../geometry/walls';
import type { Wall } from '../model/project';
import { t } from '../ui/i18n';
import { RULES } from './config';
import type { ItemSolid, OpeningInfo, RuleContext } from './context';
import { openingName } from './local';
import type { RuleWarning } from './types';

const EXEMPT_RADIUS = 45;
const PROBE_GAP = 20;
/** Más allá de esta holgura da igual: el paso ya es cómodo. */
const CAP = RULES.paso.rec / 2 + 15;
/** Altura por debajo de la cual un mueble estorba al pasar. */
const BODY_HEIGHT = 120;

export interface Endpoint {
  op: OpeningInfo;
  p: Vec2;
  room: number;
}

/** Muro partido en trozos macizos (sin las puertas, balconeras ni huecos de paso). */
export function solidWallPieces(
  wall: Wall,
  walls: readonly Wall[],
  openings: readonly OpeningInfo[],
): Poly[] {
  const full = wallQuad(wall, walls);
  const gaps = openings
    .filter((o) => o.wall.id === wall.id && o.opening.kind !== 'ventana')
    .map((o) => [o.opening.offset, o.opening.offset + o.opening.width] as const)
    .sort((a, b) => a[0] - b[0]);
  if (gaps.length === 0) return [full];
  const d = wallDir(wall);
  const n = scale(perp(d), wall.thickness / 2);
  const len = dist(wall.a, wall.b);
  // Extremos extendidos tal como los dibuja wallQuad (uniones limpias).
  const startExt = -dist(add(full[0] as Vec2, scale(n, -1)), wall.a);
  const endExt = len + dist(add(full[1] as Vec2, scale(n, -1)), wall.b);
  const pieces: Poly[] = [];
  let from = startExt;
  for (const [g0, g1] of gaps) {
    if (g0 > from) pieces.push(quadBetween(wall, from, g0, n));
    from = Math.max(from, g1);
  }
  if (endExt > from) pieces.push(quadBetween(wall, from, endExt, n));
  return pieces;
}

function quadBetween(wall: Wall, k0: number, k1: number, n: Vec2): Poly {
  const a = pointOnWall(wall, k0);
  const b = pointOnWall(wall, k1);
  return [add(a, n), add(b, n), add(b, scale(n, -1)), add(a, scale(n, -1))];
}

interface Grid {
  box: Box;
  nx: number;
  ny: number;
  cell: number;
  /** Holgura en cm; −1 = celda ocupada. */
  clear: Float32Array;
}

function buildGrid(box: Box, obstacles: readonly Poly[], cell: number, room: Poly): Grid {
  const nx = Math.max(1, Math.ceil((box.maxX - box.minX) / cell));
  const ny = Math.max(1, Math.ceil((box.maxY - box.minY) / cell));
  const clear = new Float32Array(nx * ny);
  const boxes = obstacles.map(polyBox);
  for (let j = 0; j < ny; j++) {
    const y = box.minY + (j + 0.5) * cell;
    for (let i = 0; i < nx; i++) {
      const x = box.minX + (i + 0.5) * cell;
      // Fuera de la estancia no se pasa (si no, el camino rodearía el edificio).
      if (!pointInPolygon({ x, y }, room)) {
        clear[j * nx + i] = -1;
        continue;
      }
      let best = CAP;
      for (let k = 0; k < obstacles.length; k++) {
        const b = boxes[k] as Box;
        if (x < b.minX - best || x > b.maxX + best || y < b.minY - best || y > b.maxY + best)
          continue;
        const d = pointPolygonDistance({ x, y }, obstacles[k] as Poly);
        if (d < best) best = d;
        if (best === 0) break;
      }
      clear[j * nx + i] = best === 0 ? -1 : best;
    }
  }
  return { box, nx, ny, cell, clear };
}

const cellOf = (g: Grid, p: Vec2): number => {
  const i = Math.floor((p.x - g.box.minX) / g.cell);
  const j = Math.floor((p.y - g.box.minY) / g.cell);
  if (i < 0 || j < 0 || i >= g.nx || j >= g.ny) return -1;
  return j * g.nx + i;
};

const centerOf = (g: Grid, c: number): Vec2 => ({
  x: g.box.minX + ((c % g.nx) + 0.5) * g.cell,
  y: g.box.minY + (Math.floor(c / g.nx) + 0.5) * g.cell,
});

/** Celda libre más cercana a `p` (las puertas pueden quedar pegadas a un mueble). */
function freeCellNear(g: Grid, p: Vec2): number {
  const c0 = cellOf(g, p);
  if (c0 >= 0 && (g.clear[c0] ?? -1) >= 0) return c0;
  for (let r = 1; r <= 4; r++) {
    for (let dj = -r; dj <= r; dj++) {
      for (let di = -r; di <= r; di++) {
        const c = cellOf(g, { x: p.x + di * g.cell, y: p.y + dj * g.cell });
        if (c >= 0 && (g.clear[c] ?? -1) >= 0) return c;
      }
    }
  }
  return -1;
}

/** Montículo binario de máximos sobre pares (valor, celda). */
class MaxHeap {
  private v: number[] = [];
  private c: number[] = [];
  get size() {
    return this.v.length;
  }
  push(value: number, cell: number) {
    const { v, c } = this;
    let i = v.length;
    v.push(value);
    c.push(cell);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if ((v[p] as number) >= value) break;
      v[i] = v[p] as number;
      c[i] = c[p] as number;
      i = p;
    }
    v[i] = value;
    c[i] = cell;
  }
  pop(): [number, number] {
    const { v, c } = this;
    const top: [number, number] = [v[0] as number, c[0] as number];
    const lv = v.pop() as number;
    const lc = c.pop() as number;
    if (v.length > 0) {
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        if (l >= v.length) break;
        const r = l + 1;
        const m = r < v.length && (v[r] as number) > (v[l] as number) ? r : l;
        if ((v[m] as number) <= lv) break;
        v[i] = v[m] as number;
        c[i] = c[m] as number;
        i = m;
      }
      v[i] = lv;
      c[i] = lc;
    }
    return top;
  }
}

/**
 * Camino más ancho desde `src`: para cada celda, la mejor holgura mínima
 * alcanzable y la celda donde está ese cuello de botella.
 */
export function widestFrom(g: Grid, src: number, exempt: Uint8Array) {
  const n = g.nx * g.ny;
  const best = new Float32Array(n).fill(-1);
  const neck = new Int32Array(n).fill(-1);
  const val = (c: number) => (exempt[c] ? Infinity : (g.clear[c] as number));
  const heap = new MaxHeap();
  best[src] = val(src);
  neck[src] = exempt[src] ? -1 : src;
  heap.push(best[src] as number, src);
  const dirs = [-1, 1, -g.nx, g.nx, -g.nx - 1, -g.nx + 1, g.nx - 1, g.nx + 1];
  while (heap.size) {
    const [b, u] = heap.pop();
    if (b < (best[u] as number)) continue;
    const ui = u % g.nx;
    for (const dlt of dirs) {
      const v = u + dlt;
      if (v < 0 || v >= n) continue;
      const vi = v % g.nx;
      if (Math.abs(vi - ui) > 1) continue; // salto de fila
      if ((g.clear[v] as number) < 0) continue;
      const cv = val(v);
      const cand = Math.min(b, cv);
      if (cand > (best[v] as number)) {
        best[v] = cand;
        neck[v] = cv < b ? v : (neck[u] as number);
        heap.push(cand, v);
      }
    }
  }
  return { best, neck };
}

/**
 * La estancia vacía solo depende del nivel (muros, huecos, fijos), no de los
 * muebles: se calcula una vez por objeto Level (el store no lo recrea si no
 * cambia), así arrastrar muebles solo recalcula la parte amueblada.
 */
const EMPTY = new WeakMap<object, Map<string, unknown>>();
function emptyCache(level: object): Map<string, unknown> {
  let m = EMPTY.get(level);
  if (!m) {
    m = new Map();
    EMPTY.set(level, m);
  }
  return m;
}
function memo<T>(cache: Map<string, unknown>, key: string, make: () => T): T {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key) as T;
}

const widthOf = (clearance: number, cell: number) => 2 * clearance + cell / 2;

/** Puntos de partida: delante de cada puerta, balconera o hueco, dentro de una estancia. */
export function endpoints(ctx: RuleContext, rooms: readonly Poly[]): Endpoint[] {
  const out: Endpoint[] = [];
  for (const op of ctx.openings) {
    if (op.opening.kind === 'ventana') continue;
    for (const side of [1, -1] as const) {
      const p = openingProbe(op.wall, op.opening, side, PROBE_GAP);
      const room = rooms.findIndex((r) => pointInPolygon(p, r));
      if (room >= 0) out.push({ op, p, room });
    }
  }
  return out;
}

function obstaclesOf(ctx: RuleContext, items: readonly ItemSolid[], ext: boolean): Poly[] {
  const walls = ctx.walls.flatMap((w) => solidWallPieces(w.wall, ctx.level.walls, ctx.openings));
  const fixtures = ctx.fixtures
    .filter((f) => ['radiador', 'columna'].includes(f.fixture.kind))
    .map((f) => f.poly);
  const furniture = items
    .filter((s) => s.z0 < BODY_HEIGHT)
    .flatMap((s) => (ext && s.ext ? [s.poly, s.ext] : [s.poly]));
  return [...walls, ...fixtures, ...furniture];
}

export function passages(ctx: RuleContext, ext = false): RuleWarning[] {
  const cell = RULES.paso.cell;
  const rooms: Poly[] = ctx.level.rooms.length
    ? ctx.level.rooms.map((r) => r.polygon)
    : [boundsPoly(ctx)];
  const eps = endpoints(ctx, rooms);
  let empty: Poly[] | null = null;
  const cache = emptyCache(ctx.level);
  const furnished = obstaclesOf(ctx, ctx.items, ext);
  if (ext && !ctx.items.some((s) => s.ext)) return [];
  const found = new Map<string, RuleWarning>();

  rooms.forEach((room, ri) => {
    const mine = eps.filter((e) => e.room === ri);
    if (mine.length < 2) return;
    const b = polyBox(room);
    const box = { minX: b.minX - 15, minY: b.minY - 15, maxX: b.maxX + 15, maxY: b.maxY + 15 };
    const gE = memo(cache, `g${ri}`, () =>
      buildGrid(box, (empty ??= obstaclesOf(ctx, [], false)), cell, room),
    );
    const gF = buildGrid(box, furnished, cell, room);
    const exempt = new Uint8Array(gE.nx * gE.ny);
    for (let c = 0; c < exempt.length; c++) {
      const p = centerOf(gE, c);
      if (mine.some((e) => dist(e.p, p) <= EXEMPT_RADIUS)) exempt[c] = 1;
    }
    mine.forEach((a, ai) => {
      const sE = freeCellNear(gE, a.p);
      const sF = freeCellNear(gF, a.p);
      if (sE < 0) return;
      const wE = memo(cache, `w${ri}:${ai}`, () => widestFrom(gE, sE, exempt));
      const wF = sF >= 0 ? widestFrom(gF, sF, exempt) : null;
      mine.forEach((bp, bi) => {
        if (bi <= ai || bp.op.opening.id === a.op.opening.id) return;
        const tE = freeCellNear(gE, bp.p);
        if (tE < 0 || (wE.best[tE] as number) < 0) return; // ni vacía se llega
        const tF = freeCellNear(gF, bp.p);
        const names = { from: openingName(ctx, a.op.opening), to: openingName(ctx, bp.op.opening) };
        const objects = [a.op.opening.id, bp.op.opening.id];
        const reach = wF && tF >= 0 ? (wF.best[tF] as number) : -1;
        if (reach < 0) {
          const key = `paso:${objects.join('+')}`;
          found.set(key, {
            key,
            rule: 'paso',
            severity: 'error',
            objects,
            message: t('rule.passageBlocked', names),
            areas: [circlePoly(a.p, 20), circlePoly(bp.p, 20)],
            anchor: a.p,
          });
          return;
        }
        if (!Number.isFinite(reach)) return;
        const emptyReach = wE.best[tE] as number;
        const width = widthOf(reach, cell);
        if (width >= RULES.paso.rec) return;
        if (Number.isFinite(emptyReach) && reach >= emptyReach - 1) return; // culpa del edificio
        const neckCell = wF?.neck[tF] ?? -1;
        if (neckCell < 0) return;
        const at = centerOf(gF, neckCell);
        const near = ctx.items
          .filter((s) => s.z0 < BODY_HEIGHT)
          .filter((s) => pointPolygonDistance(at, ext && s.ext ? s.ext : s.poly) <= reach + cell)
          .map((s) => s.item.id);
        const key = `paso:${Math.round(at.x / 10)}:${Math.round(at.y / 10)}`;
        const prev = found.get(key);
        if (prev) {
          if (!prev.objects.includes(a.op.opening.id)) prev.objects.push(a.op.opening.id);
          if (!prev.objects.includes(bp.op.opening.id)) prev.objects.push(bp.op.opening.id);
          return;
        }
        found.set(key, {
          key,
          rule: 'paso',
          severity: width < RULES.paso.min ? 'error' : 'aviso',
          objects: [...near, ...objects],
          message: t('rule.passage', {
            ...names,
            cm: Math.round(width),
            min: RULES.paso.min,
            rec: RULES.paso.rec,
          }),
          areas: [circlePoly(at, Math.max(reach, 4))],
          anchor: at,
        });
      });
    });
  });
  return [...found.values()];
}

function boundsPoly(ctx: RuleContext): Poly {
  const b = polyBox(ctx.walls.flatMap((w) => w.poly));
  return [
    { x: b.minX, y: b.minY },
    { x: b.maxX, y: b.minY },
    { x: b.maxX, y: b.maxY },
    { x: b.minX, y: b.maxY },
  ];
}
