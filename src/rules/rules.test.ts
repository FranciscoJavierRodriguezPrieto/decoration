import { describe, expect, it } from 'vitest';
import type { Item, Level } from '../model/project';
import { RULES } from './config';
import { buildContext } from './context';
import { countBySeverity, evaluateRules } from './index';
import { clearanceNeeded, openingName, tvInches } from './local';
import { endpoints, solidWallPieces } from './passage';
import { DEFAULT_RULE_OPTIONS } from './types';

/**
 * Estancia de prueba de 400 × 300 (ejes), muros de 10:
 * puerta en el muro izquierdo (abre hacia dentro), balconera y ventana con
 * radiador en el derecho.
 */
function room(): Level {
  return {
    id: 'L',
    name: 'Prueba',
    elevation: 0,
    ceilingHeight: 250,
    walls: [
      { id: 'top', a: { x: 0, y: 0 }, b: { x: 400, y: 0 }, thickness: 10, kind: 'tabique' },
      { id: 'right', a: { x: 400, y: 0 }, b: { x: 400, y: 300 }, thickness: 10, kind: 'fachada' },
      { id: 'bottom', a: { x: 400, y: 300 }, b: { x: 0, y: 300 }, thickness: 10, kind: 'tabique' },
      { id: 'left', a: { x: 0, y: 300 }, b: { x: 0, y: 0 }, thickness: 10, kind: 'tabique' },
    ],
    openings: [
      {
        id: 'door',
        wallId: 'left',
        offset: 20,
        width: 80,
        kind: 'puerta',
        height: 203,
        hinge: 'izq',
        swing: 'dentro',
      },
      {
        id: 'balc',
        wallId: 'right',
        offset: 200,
        width: 80,
        kind: 'balconera',
        height: 210,
        sill: 0,
        swing: 'corredera',
      },
      {
        id: 'win',
        wallId: 'right',
        offset: 30,
        width: 120,
        kind: 'ventana',
        height: 120,
        sill: 90,
      },
    ],
    rooms: [
      {
        id: 'r',
        name: 'r',
        polygon: [
          { x: 0, y: 0 },
          { x: 400, y: 0 },
          { x: 400, y: 300 },
          { x: 0, y: 300 },
        ],
      },
    ],
    fixtures: [
      { id: 'rad', kind: 'radiador', wallId: 'right', x: 389, y: 90, w: 12, d: 120, h: 60, z: 15 },
    ],
    zones: [],
  };
}

let n = 0;
const item = (p: Partial<Item> & Pick<Item, 'x' | 'y' | 'w' | 'd'>): Item => ({
  id: p.id ?? `i${n++}`,
  name: p.name ?? p.id ?? 'Mueble',
  category: 'otro',
  h: 80,
  rotation: 0,
  status: 'tengo',
  ...p,
});

const rules = (items: Item[], opts = {}) => evaluateRules(room(), items, opts);
const only = (items: Item[], rule: string, opts = {}) =>
  rules(items, opts).filter((w) => w.rule === rule);

describe('estancia vacía', () => {
  it('no da avisos', () => {
    expect(rules([])).toEqual([]);
  });
});

describe('1. colisiones', () => {
  it('entre muebles, con tolerancia de 1 cm y respetando alturas', () => {
    const a = item({ id: 'a', x: 150, y: 150, w: 60, d: 60 });
    expect(only([a, item({ id: 'b', x: 200, y: 150, w: 60, d: 60 })], 'colision')).toHaveLength(1);
    expect(only([a, item({ id: 'b', x: 210.5, y: 150, w: 60, d: 60 })], 'colision')).toHaveLength(
      0,
    );
    // Una TV encima de su mueble no choca.
    expect(
      only([a, item({ id: 'tv', x: 150, y: 150, w: 60, d: 8, z: 80 })], 'colision'),
    ).toHaveLength(0);
    // Silla metida bajo la mesa: permitido.
    const mesa = item({ id: 'mesa', category: 'mesa', x: 150, y: 150, w: 120, d: 80, h: 75 });
    const silla = item({ id: 's', category: 'silla', x: 150, y: 100, w: 42, d: 42 });
    expect(only([mesa, silla], 'colision')).toHaveLength(0);
    // Alfombras y descartados no cuentan.
    expect(
      only([a, item({ x: 150, y: 150, w: 200, d: 150, h: 1, category: 'alfombra' })], 'colision'),
    ).toHaveLength(0);
    expect(
      only([a, item({ x: 150, y: 150, w: 60, d: 60, status: 'descartado' })], 'colision'),
    ).toHaveLength(0);
  });

  it('muros: se tolera hasta el eje, no atravesarlo', () => {
    expect(only([item({ id: 'a', x: 100, y: 30, w: 60, d: 60 })], 'colision')).toHaveLength(0);
    const w = only([item({ id: 'a', x: 100, y: 20, w: 60, d: 60 })], 'colision');
    expect(w[0]?.message).toMatch(/atraviesa un muro/);
  });

  it('tapar una puerta y chocar con una columna', () => {
    const lvl = room();
    lvl.fixtures.push({ id: 'col', kind: 'columna', x: 300, y: 250, w: 30, d: 30, h: 250 });
    const ws = evaluateRules(lvl, [
      item({ id: 'a', x: 0, y: 240, w: 60, d: 60 }),
      item({ id: 'b', x: 300, y: 240, w: 40, d: 40 }),
    ]);
    expect(ws.some((w) => w.message.includes('tapa el paso de la puerta'))).toBe(true);
    expect(ws.some((w) => w.message.includes('la columna'))).toBe(true);
  });
});

describe('2. paso libre', () => {
  it('detecta un estrechamiento entre la puerta y la balconera', () => {
    // Pared de muebles de lado a lado dejando un hueco de 70 cm.
    const wallOfStuff = [
      item({ id: 'izq', x: 150, y: 100, w: 30, d: 200, h: 100 }),
      item({ id: 'der', x: 150, y: 280, w: 30, d: 10, h: 100 }),
    ];
    const ws = only(wallOfStuff, 'paso');
    expect(ws).toHaveLength(1);
    expect(ws[0]!.severity).toBe('aviso');
    expect(ws[0]!.objects).toEqual(expect.arrayContaining(['izq', 'der', 'door', 'balc']));
    expect(ws[0]!.message).toMatch(/Paso de 7\d cm entre la puerta de «r» y la balconera de «r»/);
  });

  it('menos de 60 es error y cerrado del todo también', () => {
    const narrow = [
      item({ id: 'izq', x: 150, y: 110, w: 30, d: 220, h: 100 }),
      item({ id: 'der', x: 150, y: 280, w: 30, d: 30, h: 100 }),
    ];
    expect(only(narrow, 'paso')[0]?.severity).toBe('error');
    const closed = [item({ id: 'muro', x: 150, y: 150, w: 30, d: 300, h: 100 })];
    const ws = only(closed, 'paso');
    expect(ws[0]?.message).toMatch(/cierran el paso/);
  });

  it('no culpa a los muebles de la arquitectura ni mide pegado a la puerta', () => {
    expect(only([item({ x: 300, y: 60, w: 60, d: 60 })], 'paso')).toEqual([]);
    // Los muebles altos colgados (z ≥ 120) no estorban.
    expect(only([item({ x: 150, y: 150, w: 30, d: 300, z: 150, h: 40 })], 'paso')).toEqual([]);
  });

  it('muro partido por los huecos y puntos de partida', () => {
    const lvl = room();
    const ctx = buildContext(lvl, [], DEFAULT_RULE_OPTIONS);
    const right = lvl.walls[1]!;
    expect(solidWallPieces(right, lvl.walls, ctx.openings)).toHaveLength(2);
    expect(solidWallPieces(lvl.walls[0]!, lvl.walls, ctx.openings)).toHaveLength(1);
    const eps = endpoints(
      ctx,
      lvl.rooms.map((r) => r.polygon),
    );
    expect(eps.map((e) => e.op.opening.id)).toEqual(['door', 'balc']);
    expect(eps[0]!.p).toEqual({ x: 25, y: 240 });
  });

  it('sin estancias usa el contorno del nivel', () => {
    const lvl = { ...room(), rooms: [] };
    const ws = evaluateRules(lvl, [item({ id: 'muro', x: 150, y: 150, w: 30, d: 300, h: 100 })]);
    expect(ws.some((w) => w.rule === 'paso')).toBe(true);
  });
});

describe('nombres de los huecos', () => {
  it('por estancia y numerados si se repiten', () => {
    const lvl = room();
    lvl.openings.push({
      id: 'door2',
      wallId: 'top',
      offset: 300,
      width: 80,
      kind: 'puerta',
      height: 203,
    });
    const ctx = buildContext(lvl, [], DEFAULT_RULE_OPTIONS);
    expect(openingName(ctx, lvl.openings[0]!)).toBe('la puerta de «r» 1');
    expect(openingName(ctx, lvl.openings[3]!)).toBe('la puerta de «r» 2');
    expect(openingName(ctx, lvl.openings[2]!)).toBe('la ventana de «r»');
    const bare = buildContext({ ...lvl, rooms: [] }, [], DEFAULT_RULE_OPTIONS);
    expect(openingName(bare, lvl.openings[2]!)).toBe('la ventana');
    expect(openingName(bare, lvl.openings[3]!)).toBe('la puerta 2');
  });
});

describe('3. puertas y huellas de uso', () => {
  it('la hoja de la puerta choca o roza', () => {
    // Puerta en el muro izquierdo, offset 20 desde (0,300): y 280..200, barre x 0..80.
    const hit = only([item({ id: 'a', x: 40, y: 240, w: 40, d: 40 })], 'puerta');
    expect(hit[0]?.severity).toBe('error');
    const rub = only([item({ id: 'a', x: 94, y: 240, w: 40, d: 40 })], 'puerta');
    expect(rub[0]?.severity).toBe('aviso');
    expect(rub[0]?.message).toMatch(/no abre del todo/);
  });

  it('armarios y electrodomésticos necesitan fondo delante', () => {
    expect(clearanceNeeded(item({ x: 0, y: 0, w: 100, d: 60, category: 'armario' }))).toEqual({
      min: 60,
      rec: 90,
    });
    expect(
      clearanceNeeded(
        item({ x: 0, y: 0, w: 200, d: 60, category: 'armario', params: { doors: 2 } }),
      ),
    ).toEqual({ min: 110, rec: 110 });
    expect(
      clearanceNeeded(
        item({ x: 0, y: 0, w: 200, d: 60, category: 'armario', params: { doorType: 'corredera' } }),
      ),
    ).toEqual({ min: 60, rec: 70 });
    expect(clearanceNeeded(item({ x: 0, y: 0, w: 60, d: 60, category: 'sofa' }))).toBeNull();
    const armario = item({ id: 'arm', category: 'armario', x: 250, y: 35, w: 100, d: 60, h: 200 });
    expect(only([armario], 'uso')).toEqual([]);
    const sofa = item({ id: 'sofa', x: 250, y: 140, w: 100, d: 60 });
    const ws = only([armario, sofa], 'uso');
    expect(ws[0]?.severity).toBe('error');
    const lav = item({ id: 'lav', category: 'electrodomestico', x: 250, y: 35, w: 60, d: 60 });
    expect(only([lav, item({ x: 250, y: 190, w: 60, d: 60 })], 'uso')[0]?.severity).toBe('aviso');
  });
});

describe('4. radiador', () => {
  it('distancia a la trasera y tapado', () => {
    const at = (x: number) => item({ id: 's', x, y: 90, w: 120, d: 60, rotation: 90 });
    // Radiador de x 383 a 395; el mueble girado 90° ocupa x ± 30.
    expect(only([at(348)], 'radiador')[0]?.severity).toBe('error');
    expect(only([at(340)], 'radiador')[0]?.severity).toBe('aviso');
    expect(only([at(330)], 'radiador')).toEqual([]);
    expect(only([at(360)], 'radiador')[0]?.message).toMatch(/tapa el radiador/);
    // Fuera de su largo no cuenta.
    expect(only([item({ x: 360, y: 250, w: 40, d: 40 })], 'radiador')).toEqual([]);
  });

  it('radiador sin muro: se orienta por su lado largo', () => {
    const lvl = room();
    lvl.fixtures = [{ id: 'rad', kind: 'radiador', x: 200, y: 20, w: 100, d: 12, h: 60 }];
    const ws = evaluateRules(lvl, [item({ x: 200, y: 60, w: 100, d: 50 })]);
    expect(ws.some((w) => w.rule === 'radiador')).toBe(true);
  });
});

describe('5. ventana', () => {
  it('mueble alto delante tapa más del 30 %', () => {
    const alto = item({ id: 'k', x: 360, y: 90, w: 120, d: 60, h: 105, rotation: 90 });
    const ws = only([alto], 'ventana');
    expect(ws[0]?.message).toMatch(/tapa el 100 % de la ventana/);
    expect(only([{ ...alto, h: 85 }], 'ventana')).toEqual([]);
    expect(only([{ ...alto, x: 250 }], 'ventana')).toEqual([]);
    expect(only([{ ...alto, y: 165, w: 40, rotation: 0 }], 'ventana')).toEqual([]);
  });
});

describe('6. televisión', () => {
  const tv = item({
    id: 'tv',
    name: 'TV',
    category: 'tv',
    x: 200,
    y: 285,
    w: 123,
    d: 8,
    h: 71,
    z: 50,
    rotation: 180,
    params: { diagonalInch: 55 },
  });
  const sofa = (y: number, x = 200, rotation = 0) =>
    item({ id: 'sofa', name: 'Sofá', category: 'sofa', x, y, w: 200, d: 90, rotation });

  it('pulgadas de parámetro o del ancho', () => {
    expect(tvInches(tv)).toBe(55);
    expect(tvInches({ ...tv, params: {} })).toBeCloseTo(55.6, 0);
  });

  it('cerca, algo cerca, bien y lejos', () => {
    expect(only([tv, sofa(150)], 'tv')[0]?.severity).toBe('aviso');
    expect(only([tv, sofa(80)], 'tv')[0]?.message).toMatch(/algo cerca/);
    expect(only([tv, sofa(40)], 'tv')).toEqual([]);
    const lvl = room();
    const far = evaluateRules(lvl, [{ ...tv, params: { diagonalInch: 32 } }, sofa(40)]);
    expect(far.find((w) => w.rule === 'tv')?.message).toMatch(/lejos/);
  });

  it('ángulo fuera del eje y sin sofá que mire', () => {
    const ws = only([{ ...tv, x: 330 }, sofa(40, 100)], 'tv');
    expect(ws.some((w) => /del eje/.test(w.message))).toBe(true);
    expect(only([tv, sofa(40, 200, 180)], 'tv')).toEqual([]);
  });
});

describe('7. comedor y mesa de centro', () => {
  const mesa = item({ id: 'mesa', category: 'mesa', x: 200, y: 200, w: 120, d: 80, h: 75 });
  const silla = (y: number) =>
    item({ id: 'silla', name: 'Silla', category: 'silla', x: 200, y, w: 42, d: 42 });

  it('espacio detrás de la silla', () => {
    expect(only([mesa, silla(145)], 'comedor')).toEqual([]);
    const ws = only(
      [mesa, silla(145), item({ id: 'tope', x: 200, y: 90, w: 100, d: 20 })],
      'comedor',
    );
    expect(ws[0]?.severity).toBe('error');
    expect(
      only([mesa, silla(145), item({ x: 200, y: 44, w: 100, d: 20 })], 'comedor')[0]?.severity,
    ).toBe('aviso');
    // Una silla que no mira a la mesa no cuenta.
    expect(
      only(
        [mesa, { ...silla(145), rotation: 180 }, item({ x: 200, y: 90, w: 100, d: 20 })],
        'comedor',
      ),
    ).toEqual([]);
  });

  it('sofá y mesa de centro', () => {
    const sofa = item({ id: 'sofa', category: 'sofa', x: 200, y: 50, w: 200, d: 80 });
    const centro = (y: number) =>
      item({ id: 'c', category: 'mesa', x: 200, y, w: 100, d: 50, h: 45 });
    expect(only([sofa, centro(130)], 'sofa_mesa')[0]?.severity).toBe('aviso');
    expect(only([sofa, centro(150)], 'sofa_mesa')[0]?.severity).toBe('info');
    expect(only([sofa, centro(170)], 'sofa_mesa')).toEqual([]);
    expect(only([sofa, { ...centro(130), x: 340 }], 'sofa_mesa')).toEqual([]);
  });
});

describe('8 y 9. huella extendida y temporada', () => {
  it('solo avisa de lo que pasa al extender', () => {
    const sofa = item({
      id: 'k',
      name: 'KANSAS',
      category: 'sofa',
      x: 200,
      y: 50,
      w: 200,
      d: 80,
      extended: { w: 200, d: 140 },
    });
    const mesa = item({ id: 'm', x: 200, y: 140, w: 60, d: 40 });
    const ws = rules([sofa, mesa]).filter((w) => w.extended);
    expect(ws[0]?.severity).toBe('aviso');
    expect(ws[0]?.message).toMatch(/^Con «KANSAS» extendido: /);
    expect(rules([sofa, mesa], { checkExtended: false }).some((w) => w.extended)).toBe(false);
  });

  it('los de temporada solo cuentan si se piden', () => {
    const a = item({ id: 'a', x: 150, y: 150, w: 60, d: 60 });
    const arbol = item({
      id: 't',
      category: 'arbol',
      x: 160,
      y: 150,
      w: 74,
      d: 74,
      h: 180,
      seasonal: true,
    });
    expect(only([a, arbol], 'colision')).toEqual([]);
    expect(only([a, arbol], 'colision', { includeSeasonal: true })).toHaveLength(1);
  });

  it('ordena por gravedad y cuenta', () => {
    const ws = rules([
      item({ id: 'a', x: 150, y: 150, w: 60, d: 60 }),
      item({ id: 'b', x: 160, y: 150, w: 60, d: 60 }),
      item({ id: 's', x: 340, y: 90, w: 120, d: 60, rotation: 90 }),
    ]);
    expect(ws[0]?.severity).toBe('error');
    expect(countBySeverity(ws)).toEqual({ error: 1, aviso: 1, info: 0 });
    expect(RULES.paso.min).toBe(60);
  });
});
