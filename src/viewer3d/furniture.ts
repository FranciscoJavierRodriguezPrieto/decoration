/**
 * Muebles procedurales (CATALOGO_Y_ERGONOMIA §1): cada plantilla se construye
 * con cajas, cilindros, conos y esferas a partir de las medidas exactas del
 * mueble. Funciona sin modelos 3D. Puro.
 *
 * Coordenadas locales de three, en cm: origen en el centro de la huella y a
 * ras de la base del mueble; X a la derecha (vista en planta), Y arriba y
 * +Z hacia el FRENTE (en planta, el frente es +Y local; CLAUDE.md §4).
 */
import { chaiseWidth } from '../geometry/footprint';
import type { Item } from '../model/project';
import type { V3 } from './coords';

export type PartShape = 'box' | 'cylinder' | 'cone' | 'sphere';

export interface Part {
  shape: PartShape;
  /** box: ancho, alto, fondo · cylinder/cone: radio, alto, radio (abajo) · sphere: radio. */
  size: V3;
  /** Centro de la pieza. */
  pos: V3;
  color: string;
  /** Pieza de la huella extendida (asientos sacados, chaise): se pinta translúcida. */
  ghost?: boolean;
  /** Superficie que brilla (pantallas, cristal). */
  glossy?: boolean;
  emissive?: boolean;
}

export type TemplateName =
  | 'sofa'
  | 'sofa_chaise'
  | 'sofa_deslizante'
  | 'rinconera'
  | 'cama'
  | 'mesa'
  | 'silla'
  | 'armario'
  | 'mueble_bajo'
  | 'estanteria'
  | 'tv'
  | 'electrodomestico'
  | 'planta'
  | 'arbol'
  | 'alfombra'
  | 'caja';

const BY_CATEGORY: Record<string, TemplateName> = {
  sofa: 'sofa',
  sillon: 'sofa',
  cama: 'cama',
  mesa: 'mesa',
  silla: 'silla',
  armario: 'armario',
  mueble_bajo: 'mueble_bajo',
  estanteria: 'estanteria',
  tv: 'tv',
  electrodomestico: 'electrodomestico',
  planta: 'planta',
  arbol: 'arbol',
  alfombra: 'alfombra',
};

const TEMPLATES = new Set<string>([
  'sofa',
  'sofa_chaise',
  'sofa_deslizante',
  'rinconera',
  'cama',
  'mesa',
  'silla',
  'armario',
  'mueble_bajo',
  'estanteria',
  'tv',
  'electrodomestico',
  'planta',
  'arbol',
  'alfombra',
  'caja',
]);

export function templateOf(item: Pick<Item, 'category' | 'params'>): TemplateName {
  const p = item.params?.template;
  if (typeof p === 'string' && TEMPLATES.has(p)) return p as TemplateName;
  return BY_CATEGORY[item.category] ?? 'caja';
}

const DEFAULT_COLOR = '#c9bfae';

function num(item: Pick<Item, 'params'>, key: string, fallback: number): number {
  const v = item.params?.[key];
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : fallback;
}

/** Aclara (k > 0) u oscurece (k < 0) un color #rrggbb. */
export function shade(hex: string, k: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m?.[1]) return hex;
  const n = parseInt(m[1], 16);
  const ch = (s: number) => {
    const c = (n >> s) & 255;
    const v = k >= 0 ? c + (255 - c) * k : c * (1 + k);
    return Math.round(Math.max(0, Math.min(255, v)));
  };
  return `#${[16, 8, 0].map((s) => ch(s).toString(16).padStart(2, '0')).join('')}`;
}

const box = (
  w: number,
  h: number,
  d: number,
  x: number,
  y0: number,
  z: number,
  color: string,
  extra: Partial<Part> = {},
): Part => ({
  shape: 'box',
  size: [w, h, d],
  pos: [x, y0 + h / 2, z],
  color,
  ...extra,
});

const legs = (
  w: number,
  d: number,
  h: number,
  inset: number,
  side: number,
  color: string,
): Part[] =>
  [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([sx, sz]) =>
    box(
      side,
      h,
      side,
      (sx as number) * (w / 2 - inset),
      0,
      (sz as number) * (d / 2 - inset),
      color,
    ),
  );

// ---------------------------------------------------------------------------
// Plantillas
// ---------------------------------------------------------------------------

function sofa(item: Item, color: string): Part[] {
  const { w, d, h } = item;
  const legH = Math.min(num(item, 'legHeight', 8), h * 0.2);
  const seatH = Math.min(num(item, 'seatHeight', 42), h * 0.75);
  const cushion = Math.min(num(item, 'cushionThickness', 12), seatH - legH - 2);
  const backH = Math.min(num(item, 'backHeight', h), h);
  const armH = Math.min(num(item, 'armHeight', Math.min(56, h * 0.8)), h);
  const armW = Math.min(num(item, 'armWidth', 18), w / 6);
  const backD = Math.min(22, d * 0.28);
  const fabric = color;
  const cushionColor = shade(color, 0.08);
  const inner = w - 2 * armW;
  const seatD = d - backD;
  const parts: Part[] = [
    ...legs(w, d, legH, 6, 5, '#3b3027'),
    box(w, seatH - cushion - legH, d, 0, legH, 0, shade(fabric, -0.08)),
    box(inner, cushion, seatD, 0, seatH - cushion, -d / 2 + backD + seatD / 2, cushionColor),
    box(inner, backH - legH, backD, 0, legH, -d / 2 + backD / 2, fabric),
    box(armW, armH - legH, d, -(w / 2 - armW / 2), legH, 0, fabric),
    box(armW, armH - legH, d, w / 2 - armW / 2, legH, 0, fabric),
  ];
  // Cojines de respaldo, uno por plaza (cada ~70 cm).
  const seats = Math.max(1, Math.round(inner / 70));
  const cw = inner / seats;
  for (let i = 0; i < seats; i++) {
    parts.push(
      box(
        cw - 3,
        Math.max(10, backH - seatH - 4),
        12,
        -inner / 2 + cw * (i + 0.5),
        seatH,
        -d / 2 + backD + 6,
        cushionColor,
      ),
    );
  }
  return parts;
}

/** Asientos deslizantes sacados o chaise: la parte que asoma, translúcida. */
function extendedParts(item: Item, color: string): Part[] {
  const ext = item.extended;
  if (!ext || !('w' in ext) || ext.d <= item.d) return [];
  const seatH = Math.min(num(item, 'seatHeight', 42), item.h * 0.75);
  const extra = ext.d - item.d;
  const z = item.d / 2 + extra / 2;
  if (templateOf(item) === 'sofa_chaise') {
    const cw = chaiseWidth(item);
    const side = item.params?.chaiseSide === 'der' ? 1 : -1;
    const x = side * (Math.max(item.w, ext.w) / 2 - cw / 2);
    return [box(cw, seatH, extra, x, 0, z, shade(color, 0.05), { ghost: true })];
  }
  return [box(ext.w - 4, seatH - 6, extra, 0, 0, z, shade(color, 0.05), { ghost: true })];
}

function cama(item: Item, color: string): Part[] {
  const { w, d } = item;
  const bedH = Math.min(num(item, 'bedH', item.h), 70);
  const headH = Math.max(bedH, num(item, 'headboardH', 110));
  const mattress = Math.min(22, bedH * 0.45);
  const head = 6;
  return [
    box(w, bedH - mattress, d - head, 0, 0, head / 2, shade(color, -0.1)),
    box(w - 4, mattress, d - head - 4, 0, bedH - mattress, head / 2, '#f3f0ea'),
    box(w, headH, head, 0, 0, -d / 2 + head / 2, color),
    box(Math.min(60, w / 2 - 6), 12, 35, -w / 4, bedH, -d / 2 + head + 22, '#ffffff'),
    box(Math.min(60, w / 2 - 6), 12, 35, w / 4, bedH, -d / 2 + head + 22, '#ffffff'),
    box(w - 2, 4, d * 0.45, 0, bedH, d / 2 - d * 0.225 - 2, shade(color, 0.25)),
  ];
}

function mesa(item: Item, color: string): Part[] {
  const { w, d, h } = item;
  const top = num(item, 'topThickness', 4);
  const round = item.params?.shape === 'redonda';
  if (round) {
    const r = Math.min(w, d) / 2;
    return [
      { shape: 'cylinder', size: [r, top, r], pos: [0, h - top / 2, 0], color },
      {
        shape: 'cylinder',
        size: [5, h - top, 5],
        pos: [0, (h - top) / 2, 0],
        color: shade(color, -0.25),
      },
      {
        shape: 'cylinder',
        size: [r * 0.45, 3, r * 0.45],
        pos: [0, 1.5, 0],
        color: shade(color, -0.25),
      },
    ];
  }
  const inset = num(item, 'legInset', 5) + 2.5;
  return [
    box(w, top, d, 0, h - top, 0, color),
    ...legs(w, d, h - top, inset, 5, shade(color, -0.2)),
  ];
}

function silla(item: Item, color: string): Part[] {
  const { w, d, h } = item;
  const seatH = Math.min(num(item, 'seatH', 45), h - 5);
  const backH = Math.max(seatH + 10, Math.min(num(item, 'backH', h), h));
  return [
    ...legs(w, d, seatH - 4, 3, 3.5, shade(color, -0.3)),
    box(w, 4, d, 0, seatH - 4, 0, color),
    box(w, backH - seatH, 3, 0, seatH, -d / 2 + 1.5, color),
  ];
}

function armario(item: Item, color: string): Part[] {
  const { w, d, h } = item;
  const plinth = num(item, 'plinth', 8);
  const doors = Math.max(1, Math.round(num(item, 'doors', w > 120 ? 3 : 2)));
  const parts: Part[] = [
    box(w, plinth, d - 4, 0, 0, -2, shade(color, -0.35)),
    box(w, h - plinth, d, 0, plinth, 0, color),
  ];
  for (let i = 1; i < doors; i++) {
    parts.push(
      box(
        0.6,
        h - plinth - 4,
        0.6,
        -w / 2 + (w / doors) * i,
        plinth + 2,
        d / 2 + 0.2,
        shade(color, -0.4),
      ),
    );
  }
  for (let i = 0; i < doors; i++) {
    const x = -w / 2 + (w / doors) * (i + 0.5) + (i % 2 === 0 ? 1 : -1) * (w / doors / 2 - 5);
    parts.push(box(1.5, 20, 1.5, x, plinth + (h - plinth) / 2 - 10, d / 2 + 1, '#8c8c8c'));
  }
  return parts;
}

function muebleBajo(item: Item, color: string): Part[] {
  const { w, d, h } = item;
  const fronts = Math.max(1, Math.round(w / 60));
  const parts: Part[] = [box(w, h - 6, d, 0, 6, 0, color), ...legs(w, d, 6, 4, 3, '#3b3027')];
  for (let i = 1; i < fronts; i++) {
    parts.push(
      box(0.6, h - 10, 0.6, -w / 2 + (w / fronts) * i, 8, d / 2 + 0.2, shade(color, -0.3)),
    );
  }
  return parts;
}

function estanteria(item: Item, color: string): Part[] {
  const { w, d, h } = item;
  const shelves = Math.max(2, Math.round(num(item, 'shelves', 5)));
  const t = 2;
  const parts: Part[] = [
    box(t, h, d, -w / 2 + t / 2, 0, 0, color),
    box(t, h, d, w / 2 - t / 2, 0, 0, color),
  ];
  for (let i = 0; i < shelves; i++) {
    const y = (i * (h - t)) / (shelves - 1);
    parts.push(box(w - 2 * t, t, d - 1, 0, y, 0, shade(color, 0.1)));
  }
  if (item.params?.open !== 0 && item.params?.open !== 'false') return parts;
  return [...parts, box(w, h, 1, 0, 0, -d / 2 + 0.5, shade(color, -0.1))];
}

function tv(item: Item): Part[] {
  const { w, d, h } = item;
  const thick = Math.min(d, 5);
  return [
    box(w, h, thick, 0, 0, 0, '#16191b'),
    box(w - 3, h - 3, 0.4, 0, 1.5, thick / 2 + 0.2, '#253238', { glossy: true, emissive: true }),
  ];
}

function electrodomestico(item: Item, color: string): Part[] {
  const { w, d, h } = item;
  const c = color === DEFAULT_COLOR ? '#eceeee' : color;
  const parts: Part[] = [box(w, h, d, 0, 0, 0, c)];
  if (h > 120) {
    // Frigorífico: dos puertas y tiradores.
    parts.push(box(w - 2, 0.6, 0.6, 0, h * 0.62, d / 2 + 0.2, shade(c, -0.25)));
    parts.push(box(1.5, 30, 2, w / 2 - 6, h * 0.62 - 35, d / 2 + 1, '#9aa0a3'));
    parts.push(box(1.5, 20, 2, w / 2 - 6, h * 0.62 + 10, d / 2 + 1, '#9aa0a3'));
  } else {
    // Lavadora o lavavajillas: ojo de buey o panel.
    parts.push({
      shape: 'cylinder',
      size: [w * 0.3, 2, w * 0.3],
      pos: [0, h * 0.45, d / 2 + 0.5],
      color: '#9aa7ad',
      glossy: true,
    });
  }
  return parts;
}

function planta(item: Item, color: string): Part[] {
  const { w, d, h } = item;
  const r = Math.min(w, d) / 2;
  const potH = Math.min(num(item, 'potH', h * 0.45), h * 0.8);
  // La copa cabe en el alto del mueble y apoya sobre la maceta.
  const foliage = Math.max(3, Math.min(num(item, 'foliageR', r * 1.1), (h - potH) / 1.6, r * 1.4));
  return [
    { shape: 'cylinder', size: [r * 0.95, potH, r * 0.75], pos: [0, potH / 2, 0], color },
    {
      shape: 'sphere',
      size: [foliage, foliage, foliage],
      pos: [0, h - foliage, 0],
      color: '#4f7a45',
    },
  ];
}

function arbol(item: Item): Part[] {
  const h = num(item, 'height', item.h);
  const r = num(item, 'radius', Math.min(item.w, item.d) / 2);
  const green = '#2f5b3a';
  const trunk = h * 0.12;
  return [
    {
      shape: 'cylinder',
      size: [r * 0.35, trunk, r * 0.4],
      pos: [0, trunk / 2, 0],
      color: '#7a2e24',
    },
    { shape: 'cone', size: [r, h * 0.42, r], pos: [0, trunk + h * 0.21, 0], color: green },
    {
      shape: 'cone',
      size: [r * 0.78, h * 0.36, r * 0.78],
      pos: [0, trunk + h * 0.38, 0],
      color: shade(green, 0.06),
    },
    {
      shape: 'cone',
      size: [r * 0.52, h * 0.3, r * 0.52],
      pos: [0, trunk + h * 0.58, 0],
      color: shade(green, 0.12),
    },
    { shape: 'sphere', size: [5, 5, 5], pos: [0, h - 5, 0], color: '#e8b923', emissive: true },
    ...[0, 1, 2, 3, 4, 5].map((i): Part => {
      const a = (i / 6) * Math.PI * 2;
      const y = trunk + h * (0.15 + 0.1 * (i % 3));
      const rr = r * (0.85 - 0.18 * (i % 3));
      return {
        shape: 'sphere',
        size: [3.5, 3.5, 3.5],
        pos: [Math.cos(a) * rr, y, Math.sin(a) * rr],
        color: i % 2 ? '#b8322a' : '#d8b04a',
        glossy: true,
      };
    }),
  ];
}

/** Piezas del mueble en coordenadas locales. */
export function itemParts(item: Item): Part[] {
  const color = item.color ?? DEFAULT_COLOR;
  const tpl = templateOf(item);
  switch (tpl) {
    case 'sofa':
    case 'sofa_deslizante':
    case 'sofa_chaise':
    case 'rinconera':
      return [...sofa(item, color), ...extendedParts(item, color)];
    case 'cama':
      return cama(item, color);
    case 'mesa':
      return mesa(item, color);
    case 'silla':
      return silla(item, color);
    case 'armario':
      return armario(item, color);
    case 'mueble_bajo':
      return muebleBajo(item, color);
    case 'estanteria':
      return estanteria(item, color);
    case 'tv':
      return tv(item);
    case 'electrodomestico':
      return electrodomestico(item, color);
    case 'planta':
      return planta(item, color);
    case 'arbol':
      return arbol(item);
    case 'alfombra':
      return [box(item.w, Math.min(item.h, 1.5), item.d, 0, 0, 0, color)];
    case 'caja':
      return [box(item.w, item.h, item.d, 0, 0, 0, color)];
  }
}
