/**
 * Reglas "locales" (ESPECIFICACION §7, reglas 1 y 3–7 y sofá–mesa): se
 * evalúan objeto a objeto sin buscar caminos. Funciones puras.
 */
import {
  convexOverlap,
  faceStrip,
  itemFaceCenter,
  itemFront,
  openingFace,
  polygonDistance,
  type Poly,
} from '../geometry/footprint';
import { dist, dot, normalize, perp, sub, type Vec2 } from '../geometry/vec';
import { wallDir } from '../geometry/walls';
import type { Item } from '../model/project';
import { t, type MessageKey } from '../ui/i18n';
import { RULES, TUCK_PAIRS } from './config';
import {
  midpoint,
  polyCenter,
  verticalOverlap,
  type FixtureSolid,
  type ItemSolid,
  type OpeningInfo,
  type RuleContext,
} from './context';
import type { RuleId, RuleWarning, Severity } from './types';

const r0 = (n: number) => Math.round(n);
const r1 = (n: number) => Math.round(n * 10) / 10;
const fmt = (n: number) => String(n).replace('.', ',');

export function openingName(ctx: Pick<RuleContext, 'level'>, o: OpeningInfo['opening']): string {
  const label = t(`openingRef.${o.kind}` as MessageKey);
  const same = ctx.level.openings.filter((x) => x.kind === o.kind);
  if (same.length <= 1) return label;
  return t('rule.opening', { kind: label, n: same.indexOf(o) + 1 });
}

export const fixtureName = (f: FixtureSolid['fixture']): string =>
  t(`fixtureRef.${f.kind}` as MessageKey);

const quote = (i: Item) => `«${i.name}»`;

function warn(
  rule: RuleId,
  severity: Severity,
  objects: string[],
  message: string,
  areas: Poly[],
  anchor?: Vec2,
): RuleWarning {
  return {
    key: `${rule}:${objects.join('+')}`,
    rule,
    severity,
    objects,
    message,
    areas,
    anchor: anchor ?? polyCenter(areas.flat()),
  };
}

const tucks = (a: Item, b: Item) =>
  TUCK_PAIRS.some(
    ([x, y]) => (a.category === x && b.category === y) || (a.category === y && b.category === x),
  );

/** Huella a usar: la normal o, si `ext`, la extendida (solo muebles que la tienen). */
const shape = (s: ItemSolid, ext: boolean): Poly => (ext && s.ext ? s.ext : s.poly);

// ---------------------------------------------------------------------------
// 1. Colisiones
// ---------------------------------------------------------------------------

export function collisions(ctx: RuleContext, ext = false): RuleWarning[] {
  const out: RuleWarning[] = [];
  const tol = RULES.overlapTolerance;
  const { items } = ctx;
  for (let i = 0; i < items.length; i++) {
    const a = items[i] as ItemSolid;
    const pa = shape(a, ext);
    for (let j = i + 1; j < items.length; j++) {
      const b = items[j] as ItemSolid;
      if (ext && !a.ext && !b.ext) continue;
      if (tucks(a.item, b.item) || verticalOverlap(a, b) <= tol) continue;
      const pb = shape(b, ext);
      const o = convexOverlap(pa, pb);
      if (o > tol) {
        out.push(
          warn(
            'colision',
            'error',
            [a.item.id, b.item.id],
            t('rule.collision', {
              a: quote(a.item),
              b: quote(b.item),
              cm: r0(o),
            }),
            [pa, pb],
          ),
        );
      }
    }
    if (ext && !a.ext) continue;
    // Muros: se tolera hasta el eje (los muebles se apoyan en el paramento y
    // los planos dibujados a mano no siempre separan eje y cara).
    for (const w of ctx.walls) {
      const o = convexOverlap(pa, w.poly);
      if (o > w.wall.thickness / 2 + tol) {
        out.push(
          warn('colision', 'error', [a.item.id, w.wall.id], t('rule.wall', { a: quote(a.item) }), [
            pa,
          ]),
        );
      }
    }
    for (const op of ctx.openings) {
      if (op.opening.kind === 'ventana') continue;
      if (a.z0 >= op.opening.height) continue;
      const o = convexOverlap(pa, op.quad);
      if (o > op.wall.thickness / 2 + tol) {
        out.push(
          warn(
            'colision',
            'error',
            [a.item.id, op.opening.id],
            t('rule.doorway', {
              a: quote(a.item),
              b: openingName(ctx, op.opening),
            }),
            [pa, op.quad],
          ),
        );
      }
    }
    for (const f of ctx.fixtures) {
      if (!['columna', 'espejo'].includes(f.fixture.kind)) continue;
      if (verticalOverlap(a, f) <= tol) continue;
      const o = convexOverlap(pa, f.poly);
      if (o > tol) {
        out.push(
          warn(
            'colision',
            'error',
            [a.item.id, f.fixture.id],
            t('rule.collision', {
              a: quote(a.item),
              b: fixtureName(f.fixture),
              cm: r0(o),
            }),
            [pa, f.poly],
          ),
        );
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// 3. Barrido de puertas y huellas de uso (armarios, electrodomésticos)
// ---------------------------------------------------------------------------

export function doorSweeps(ctx: RuleContext, ext = false): RuleWarning[] {
  const out: RuleWarning[] = [];
  for (const op of ctx.openings) {
    if (!op.swing) continue;
    for (const s of ctx.items) {
      if (ext && !s.ext) continue;
      if (s.z0 >= op.opening.height) continue;
      const p = shape(s, ext);
      const o = convexOverlap(p, op.swing);
      if (o > RULES.overlapTolerance) {
        const rub = o <= RULES.doorRub;
        out.push(
          warn(
            'puerta',
            rub ? 'aviso' : 'error',
            [s.item.id, op.opening.id],
            t(rub ? 'rule.doorRub' : 'rule.door', {
              a: quote(s.item),
              b: openingName(ctx, op.opening),
              cm: r0(o),
            }),
            [op.swing, p],
          ),
        );
      }
    }
  }
  return out;
}

/** Fondo libre que necesita delante un mueble con puertas, o null si no aplica. */
export function clearanceNeeded(item: Item): { min: number; rec: number } | null {
  if (item.category === 'armario') {
    if (item.params?.doorType === 'corredera') return { ...RULES.armarioCorredera };
    const doors = typeof item.params?.doors === 'number' ? item.params.doors : 2;
    const leaf = item.w / Math.max(1, doors);
    return {
      min: r0(leaf + RULES.armarioAbatible.extra),
      rec: Math.max(RULES.armarioAbatible.rec, r0(leaf + RULES.armarioAbatible.extra)),
    };
  }
  if (item.category === 'electrodomestico') return { ...RULES.electrodomestico };
  return null;
}

/**
 * Hondo libre delante (o detrás) de un mueble: la primera profundidad,
 * en pasos de 2,5 cm, a la que una franja de su ancho toca algo.
 */
export function freeDepth(
  ctx: RuleContext,
  s: ItemSolid,
  face: 'front' | 'back',
  max: number,
  ignore: (other: ItemSolid) => boolean = () => false,
): number {
  const obstacles: Poly[] = [
    ...ctx.items
      .filter((o) => o !== s && !ignore(o) && verticalOverlap(o, s) > 0)
      .map((o) => o.poly),
    ...ctx.walls.map((w) => w.poly),
  ];
  for (let depth = 2.5; depth <= max; depth += 2.5) {
    const strip = faceStrip(s.item, face, depth, 1);
    if (obstacles.some((p) => convexOverlap(strip, p) > 0.5)) return depth - 2.5;
  }
  return max;
}

export function clearanceZones(ctx: RuleContext): RuleWarning[] {
  const out: RuleWarning[] = [];
  for (const s of ctx.items) {
    const need = clearanceNeeded(s.item);
    if (!need) continue;
    const free = freeDepth(ctx, s, 'front', need.rec);
    if (free >= need.rec) continue;
    out.push(
      warn(
        'uso',
        free < need.min ? 'error' : 'aviso',
        [s.item.id],
        t('rule.use', { a: quote(s.item), cm: fmt(r1(free)), min: need.min, rec: need.rec }),
        [faceStrip(s.item, 'front', need.rec)],
      ),
    );
  }
  return out;
}

// ---------------------------------------------------------------------------
// 4. Radiadores
// ---------------------------------------------------------------------------

export function radiators(ctx: RuleContext): RuleWarning[] {
  const out: RuleWarning[] = [];
  for (const f of ctx.fixtures) {
    if (f.fixture.kind !== 'radiador') continue;
    const wall = ctx.level.walls.find((w) => w.id === f.fixture.wallId);
    const along = wall
      ? wallDir(wall)
      : f.fixture.w >= f.fixture.d
        ? { x: 1, y: 0 }
        : { x: 0, y: 1 };
    const span = (p: Poly) => {
      const ks = p.map((v) => dot(v, along));
      return [Math.min(...ks), Math.max(...ks)] as const;
    };
    const [r0a, r0b] = span(f.poly);
    for (const s of ctx.items) {
      const [a0, a1] = span(s.poly);
      if (Math.min(a1, r0b) - Math.max(a0, r0a) <= 0) continue; // no está delante
      const d = polygonDistance(s.poly, f.poly);
      const overlapping = convexOverlap(s.poly, f.poly) > RULES.overlapTolerance;
      if (overlapping) {
        out.push(
          warn(
            'radiador',
            'error',
            [s.item.id, f.fixture.id],
            t('rule.radiatorOver', {
              a: quote(s.item),
              b: fixtureName(f.fixture),
            }),
            [s.poly, f.poly],
          ),
        );
      } else if (d < RULES.radiador.rec) {
        out.push(
          warn(
            'radiador',
            d < RULES.radiador.min ? 'error' : 'aviso',
            [s.item.id, f.fixture.id],
            t('rule.radiator', {
              a: quote(s.item),
              b: fixtureName(f.fixture),
              cm: fmt(r1(d)),
              min: RULES.radiador.min,
              rec: RULES.radiador.rec,
            }),
            [f.poly, s.poly],
            polyCenter(f.poly),
          ),
        );
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// 5. Ventanas tapadas por muebles altos
// ---------------------------------------------------------------------------

export function windows(ctx: RuleContext): RuleWarning[] {
  const out: RuleWarning[] = [];
  for (const op of ctx.openings) {
    if (op.opening.kind !== 'ventana') continue;
    const sill = op.opening.sill ?? 0;
    const [f0, f1] = openingFace(op.wall, op.opening, op.side);
    const dir = normalize(sub(f1, f0));
    const k0 = dot(f0, dir);
    const k1 = dot(f1, dir);
    const face: Poly = [f0, f1];
    for (const s of ctx.items) {
      if (s.z1 <= sill + 2) continue;
      if (polygonDistance(s.poly, face) > RULES.ventana.depth) continue;
      const ks = s.poly.map((v) => dot(v, dir));
      const covered = Math.min(Math.max(...ks), k1) - Math.max(Math.min(...ks), k0);
      const ratio = covered / op.opening.width;
      if (ratio <= RULES.ventana.maxCover) continue;
      out.push(
        warn(
          'ventana',
          'aviso',
          [s.item.id, op.opening.id],
          t('rule.window', {
            a: quote(s.item),
            b: openingName(ctx, op.opening),
            h: r0(s.z1),
            pct: r0(Math.min(1, ratio) * 100),
          }),
          [s.poly, op.quad],
        ),
      );
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// 6. Televisión
// ---------------------------------------------------------------------------

/** Diagonal de la TV en pulgadas (parámetro o deducida del ancho 16:9). */
export function tvInches(item: Item): number {
  const p = item.params?.diagonalInch;
  return typeof p === 'number' && p > 0 ? p : item.w / 2.214;
}

const angleBetween = (a: Vec2, b: Vec2): number => {
  const c = dot(normalize(a), normalize(b));
  return (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI;
};

export function tv(ctx: RuleContext): RuleWarning[] {
  const out: RuleWarning[] = [];
  const seats = ctx.items.filter((s) => s.item.category === 'sofa');
  for (const tvs of ctx.items.filter((s) => s.item.category === 'tv')) {
    const tvItem = tvs.item;
    const screen = { x: tvItem.x, y: tvItem.y };
    const tvFront = itemFront(tvItem);
    const candidates = seats
      .map((s) => {
        // Donde se sienta uno: un cuarto del fondo por delante del centro.
        const seat = midpoint({ x: s.item.x, y: s.item.y }, itemFaceCenter(s.item, 'front'));
        const toSeat = sub(seat, screen);
        const offAxis = angleBetween(tvFront, toSeat);
        const facing = angleBetween(itemFront(s.item), sub(screen, seat));
        return { s, seat, offAxis, facing, d: dist(seat, screen) };
      })
      .filter((c) => c.offAxis < 90 && c.facing < 90);
    // Asiento principal: el que mejor mira a la TV.
    const main = candidates.sort((a, b) => a.offAxis + a.facing - (b.offAxis + b.facing))[0];
    if (!main) continue;
    const inch = tvInches(tvItem);
    const diag = inch * 2.54;
    const m = (cm: number) => fmt(Math.round(cm / 10) / 10);
    const base = { a: quote(main.s.item), b: quote(tvItem), m: m(main.d), inch: r0(inch) };
    const line: Poly = [screen, main.seat];
    const objs = [main.s.item.id, tvItem.id];
    if (main.d < RULES.tv.min * diag) {
      out.push(
        warn('tv', 'aviso', objs, t('rule.tvClose', { ...base, min: m(RULES.tv.min * diag) }), [
          line,
        ]),
      );
    } else if (main.d < RULES.tv.recMin * diag) {
      out.push(
        warn('tv', 'info', objs, t('rule.tvNear', { ...base, min: m(RULES.tv.recMin * diag) }), [
          line,
        ]),
      );
    } else if (main.d > RULES.tv.recMax * diag) {
      out.push(
        warn('tv', 'info', objs, t('rule.tvFar', { ...base, max: m(RULES.tv.recMax * diag) }), [
          line,
        ]),
      );
    }
    if (main.offAxis > RULES.tv.maxAngle) {
      out.push(
        warn(
          'tv',
          'aviso',
          [...objs, 'angulo'],
          t('rule.tvAngle', {
            a: quote(main.s.item),
            b: quote(tvItem),
            deg: r0(main.offAxis),
            max: RULES.tv.maxAngle,
          }),
          [line],
        ),
      );
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// 7. Comedor: sitio para sacar las sillas · sofá ↔ mesa de centro
// ---------------------------------------------------------------------------

export function dining(ctx: RuleContext): RuleWarning[] {
  const out: RuleWarning[] = [];
  const tables = ctx.items.filter((s) => s.item.category === 'mesa');
  for (const chair of ctx.items.filter((s) => s.item.category === 'silla')) {
    const table = tables.find((tb) => {
      if (polygonDistance(chair.poly, tb.poly) > 30) return false;
      const toTable = sub({ x: tb.item.x, y: tb.item.y }, { x: chair.item.x, y: chair.item.y });
      return dot(itemFront(chair.item), toTable) > 0;
    });
    if (!table) continue;
    // Las demás sillas de la misma mesa no cuentan si están al lado (no detrás).
    const free = freeDepth(ctx, chair, 'back', RULES.silla.rec, (o) => o === table);
    if (free >= RULES.silla.rec) continue;
    out.push(
      warn(
        'comedor',
        free < RULES.silla.min ? 'error' : 'aviso',
        [chair.item.id, table.item.id],
        t('rule.dining', {
          a: quote(chair.item),
          cm: fmt(r1(free)),
          min: RULES.silla.min,
          rec: RULES.silla.rec,
        }),
        [faceStrip(chair.item, 'back', RULES.silla.rec)],
      ),
    );
  }
  return out;
}

export function sofaTable(ctx: RuleContext): RuleWarning[] {
  const out: RuleWarning[] = [];
  const low = ctx.items.filter((s) => s.item.category === 'mesa' && s.item.h <= 55);
  for (const sofa of ctx.items.filter((s) => s.item.category === 'sofa')) {
    const front = itemFaceCenter(sofa.item, 'front');
    const fwd = itemFront(sofa.item);
    for (const tb of low) {
      const toTable = sub({ x: tb.item.x, y: tb.item.y }, front);
      if (dot(fwd, toTable) <= 0) continue; // no está delante
      const lateral = Math.abs(dot(perp(fwd), toTable));
      if (lateral > sofa.item.w / 2) continue;
      const d = polygonDistance(sofa.poly, tb.poly);
      if (d >= RULES.sofaMesa.rec || d > 80) continue;
      out.push(
        warn(
          'sofa_mesa',
          d < RULES.sofaMesa.min ? 'aviso' : 'info',
          [sofa.item.id, tb.item.id],
          t('rule.sofaTable', {
            a: quote(sofa.item),
            b: quote(tb.item),
            cm: fmt(r1(d)),
            min: RULES.sofaMesa.min,
            rec: RULES.sofaMesa.rec,
          }),
          [sofa.poly, tb.poly],
        ),
      );
    }
  }
  return out;
}
