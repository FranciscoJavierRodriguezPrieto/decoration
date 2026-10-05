import { describe, expect, it } from 'vitest';
import { loadFixture } from '../../tests/helpers';
import type { Item, Level } from '../model/project';
import { resolveVariantItems } from '../model/variants';
import { directionToY, planRotationToY, rotateY, toThree } from './coords';
import { wallsToFade } from './cutaway';
import { fixtureBoxes, openingBoxes } from './fixtures3d';
import { itemParts, shade, templateOf, type Part } from './furniture';
import { sunPosition } from './sun';
import { collides, EYE_HEIGHT, moveWithCollision, walkDelta } from './walk';
import { boxFootprint, openingSpan, wallBoxes, wallExtents } from './walls3d';

const salon = loadFixture('salon-madrid.json');
const level = salon.levels[0]!;

describe('coordenadas', () => {
  it('plano → three: X3 = x, Z3 = y, Y3 = altura', () => {
    expect(toThree({ x: 10, y: 20 }, 5)).toEqual([10, 5, 20]);
  });

  it('el frente local (+Z) gira como en el plano', () => {
    // 0° → frente hacia +Y del plano (+Z de three); 90° → −X; 180° → −Y; 270° → +X.
    const front = (deg: number) =>
      rotateY(0, 1, planRotationToY(deg)).map((v) => Math.round(v) + 0);
    expect(front(0)).toEqual([0, 1]);
    expect(front(90)).toEqual([-1, 0]);
    expect(front(180)).toEqual([0, -1]);
    expect(front(270)).toEqual([1, 0]);
    expect(planRotationToY(0)).toBe(0);
  });

  it('la caja de un muro se alinea con su dirección', () => {
    const along = (dx: number, dy: number) =>
      rotateY(1, 0, directionToY({ x: dx, y: dy })).map((v) => Math.round(v * 100) / 100);
    expect(along(1, 0)).toEqual([1, 0]);
    expect(along(0, 1)).toEqual([0, 1]);
    expect(along(-1, 0)).toEqual([-1, 0]);
    expect(directionToY({ x: 1, y: 0 })).toBe(0);
  });
});

describe('muros 3D', () => {
  const boxes = wallBoxes(level);

  it('trocea los muros alrededor de puertas y ventanas', () => {
    const ventana = boxes.filter((b) => b.wallId === 'w_ventana');
    // Muro con ventana (sill 90, alto 130) y balconera: 3 tramos + antepecho + 2 dinteles.
    expect(ventana.map((b) => b.part).sort()).toEqual([
      'antepecho',
      'dintel',
      'dintel',
      'muro',
      'muro',
      'muro',
    ]);
    const ante = ventana.find((b) => b.part === 'antepecho')!;
    expect(ante.size[0]).toBe(160);
    expect(ante.size[1]).toBe(90);
    expect(ante.center[1]).toBe(45);
    const dintel = ventana.find((b) => b.part === 'dintel' && b.size[0] === 160)!;
    expect(dintel.size[1]).toBe(250 - 220);
    // Muro sin huecos: una sola caja a toda altura.
    const sofa = boxes.filter((b) => b.wallId === 'w_sofa');
    expect(sofa).toHaveLength(1);
    expect(sofa[0]!.size[1]).toBe(250);
  });

  it('alarga los extremos para cerrar las esquinas', () => {
    const w = level.walls.find((x) => x.id === 'w_sofa')!;
    const [k0, k1] = wallExtents(w, level.walls);
    expect(k0).toBeLessThan(0);
    expect(k1).toBeGreaterThan(450);
  });

  it('altura de los huecos', () => {
    expect(
      openingSpan({ id: 'v', wallId: 'w', offset: 0, width: 80, kind: 'ventana', height: 120 }),
    ).toEqual([90, 210]);
    expect(
      openingSpan({ id: 'p', wallId: 'w', offset: 0, width: 80, kind: 'puerta', height: 203 }),
    ).toEqual([0, 203]);
  });

  it('huella en planta de una caja', () => {
    const fp = boxFootprint({
      center: [100, 0, 50],
      size: [200, 250, 10],
      rotY: directionToY({ x: 0, y: 1 }),
    });
    const xs = fp.map((p) => Math.round(p.x));
    const ys = fp.map((p) => Math.round(p.y));
    expect(Math.min(...xs)).toBe(95);
    expect(Math.max(...xs)).toBe(105);
    expect(Math.min(...ys)).toBe(-50);
    expect(Math.max(...ys)).toBe(150);
  });
});

describe('huecos y fijos', () => {
  it('marcos, hojas y cristales', () => {
    const b = openingBoxes(level);
    expect(b.filter((x) => x.ref === 'puerta_entrada').map((x) => x.kind)).toEqual([
      'marco',
      'marco',
      'marco',
      'hoja',
    ]);
    expect(b.filter((x) => x.ref === 'ventana').map((x) => x.kind)).toContain('cristal');
    expect(b.some((x) => x.key === 'ventana:alfeizar')).toBe(true);
    // La balconera abre: su hoja es de cristal.
    expect(b.find((x) => x.key === 'balcon:hoja')?.kind).toBe('cristal');
    // La hoja entreabierta queda dentro de la estancia (x > 0).
    const hoja = b.find((x) => x.key === 'puerta_entrada:hoja')!;
    expect(hoja.center[0]).toBeGreaterThan(0);
  });

  it('corredera, hueco de paso y bisagra a la derecha', () => {
    const lvl: Level = {
      ...level,
      openings: [
        {
          id: 'c',
          wallId: 'w_sofa',
          offset: 20,
          width: 80,
          kind: 'puerta',
          height: 203,
          swing: 'corredera',
        },
        { id: 'h', wallId: 'w_sofa', offset: 150, width: 80, kind: 'hueco', height: 203 },
        {
          id: 'd',
          wallId: 'w_sofa',
          offset: 300,
          width: 80,
          kind: 'puerta',
          height: 203,
          hinge: 'der',
        },
      ],
    };
    const b = openingBoxes(lvl);
    expect(b.find((x) => x.key === 'c:cristal')?.kind).toBe('hoja');
    expect(b.some((x) => x.ref === 'h')).toBe(false);
    expect(b.find((x) => x.key === 'd:hoja')!.center[2]).toBeGreaterThan(0);
    expect(openingBoxes({ ...lvl, walls: [] })).toEqual([]);
  });

  it('fijos: radiador, columna hasta el techo, espejo, luz y tomas', () => {
    const lvl = {
      ceilingHeight: 250,
      fixtures: [
        ...level.fixtures,
        { id: 'col', kind: 'columna' as const, x: 0, y: 0, w: 30, d: 30, h: 100 },
        { id: 'luz', kind: 'punto_luz' as const, x: 0, y: 0, w: 10, d: 10, h: 10 },
      ],
    };
    const b = fixtureBoxes(lvl);
    expect(b.find((x) => x.ref === 'radiador')!.center[1]).toBe(45);
    expect(b.find((x) => x.ref === 'col')!.size[1]).toBe(250);
    expect(b.find((x) => x.ref === 'espejo')!.kind).toBe('espejo');
    expect(b.find((x) => x.ref === 'luz')!.kind).toBe('luz');
    expect(b.find((x) => x.ref === 'toma_tv')!.size[1]).toBeLessThanOrEqual(10);
  });
});

describe('muebles procedurales', () => {
  const items = resolveVariantItems(salon, 'M1');
  const top = (parts: Part[]) =>
    Math.max(...parts.map((p) => p.pos[1] + (p.shape === 'sphere' ? p.size[0] : p.size[1] / 2)));
  const extent = (parts: Part[], axis: 0 | 2) =>
    Math.max(
      ...parts
        .filter((p) => p.shape === 'box' && !p.ghost)
        .map((p) => p.pos[axis] + p.size[axis] / 2),
    );

  it('plantilla por parámetro o por categoría', () => {
    expect(templateOf({ category: 'sofa', params: { template: 'sofa_chaise' } })).toBe(
      'sofa_chaise',
    );
    expect(templateOf({ category: 'sofa', params: { template: 'inventada' } })).toBe('sofa');
    expect(templateOf({ category: 'cosa' })).toBe('caja');
  });

  it('todos los muebles del salón respetan su caja (ancho, fondo y alto)', () => {
    for (const it of resolveVariantItems(salon, 'K1')) {
      const parts = itemParts(it);
      expect(parts.length, it.id).toBeGreaterThan(0);
      expect(top(parts), it.id).toBeLessThanOrEqual(it.h + 0.01);
      expect(extent(parts, 0), it.id).toBeLessThanOrEqual(it.w / 2 + 2);
      expect(extent(parts, 2), it.id).toBeLessThanOrEqual(it.d / 2 + 2);
    }
  });

  it('la chaise asoma por su lado y translúcida', () => {
    const moscu = items.find((i) => i.id === 'moscu')!;
    const ghost = itemParts(moscu).filter((p) => p.ghost);
    expect(ghost).toHaveLength(1);
    expect(ghost[0]!.pos[0]).toBeLessThan(0); // izquierda vista de frente = −X local
    expect(ghost[0]!.pos[2]).toBeGreaterThan(moscu.d / 2);
    const der = itemParts({ ...moscu, params: { ...moscu.params, chaiseSide: 'der' } }).find(
      (p) => p.ghost,
    )!;
    expect(der.pos[0]).toBeGreaterThan(0);
  });

  it('cada plantilla genera piezas', () => {
    const base: Item = {
      id: 'x',
      name: 'x',
      category: 'caja',
      x: 0,
      y: 0,
      w: 120,
      d: 60,
      h: 80,
      rotation: 0,
      status: 'tengo',
    };
    const cases: Partial<Item>[] = [
      { category: 'cama', w: 160, d: 200, h: 50 },
      { category: 'mesa', params: { shape: 'redonda' } },
      { category: 'silla', w: 42, d: 42, h: 85 },
      { category: 'armario', w: 150, h: 220, params: { doors: 3 } },
      { category: 'mueble_bajo', w: 180, h: 50 },
      { category: 'estanteria', h: 180, params: { open: 0 } },
      { category: 'tv', w: 123, d: 8, h: 71 },
      { category: 'electrodomestico', w: 60, d: 65, h: 185 },
      { category: 'electrodomestico', w: 60, d: 60, h: 85, color: '#ffffff' },
      { category: 'planta', w: 40, d: 40, h: 90 },
      { category: 'alfombra', h: 1 },
      { category: 'sofa', params: { template: 'sofa_deslizante' }, extended: { w: 120, d: 120 } },
      { category: 'sofa', extended: { w: 120, d: 50 } },
    ];
    for (const c of cases) {
      const parts = itemParts({ ...base, ...c });
      expect(parts.length, JSON.stringify(c)).toBeGreaterThan(0);
    }
    expect(
      itemParts({
        ...base,
        category: 'sofa',
        params: { template: 'sofa_deslizante' },
        extended: { w: 120, d: 120 },
      }).some((p) => p.ghost),
    ).toBe(true);
    expect(
      itemParts({ ...base, category: 'estanteria', params: { open: 0 } }).length,
    ).toBeGreaterThan(itemParts({ ...base, category: 'estanteria' }).length);
  });

  it('aclara y oscurece colores', () => {
    expect(shade('#808080', 0.5)).toBe('#c0c0c0');
    expect(shade('#808080', -0.5)).toBe('#404040');
    expect(shade('rojo', 0.2)).toBe('rojo');
  });
});

describe('sol', () => {
  it('a mediodía está al sur y alto; por la mañana al este', () => {
    const noon = sunPosition(12);
    expect(noon.azimuth).toBeCloseTo(180, 0);
    expect(noon.elevation).toBeGreaterThan(30);
    // Norte arriba del plano: el sur es +Y del plano → +Z de three.
    expect(noon.dir[2]).toBeGreaterThan(0);
    const morning = sunPosition(9);
    expect(morning.azimuth).toBeGreaterThan(90);
    expect(morning.azimuth).toBeLessThan(180);
    expect(morning.dir[0]).toBeGreaterThan(0); // este = +X
    expect(sunPosition(23).elevation).toBeLessThan(0);
  });

  it('girar el norte gira el sol', () => {
    const a = sunPosition(12, 0);
    const b = sunPosition(12, 90);
    // Con el norte a la derecha del plano, el sur queda a la izquierda (−X).
    expect(b.dir[0]).toBeLessThan(0);
    expect(Math.abs(b.dir[2])).toBeLessThan(Math.abs(a.dir[2]));
  });
});

describe('cutaway', () => {
  it('se transparentan los muros entre la cámara y el centro', () => {
    const f = wallsToFade(level.walls, { x: 225, y: 900 }, { x: 225, y: 250 });
    expect([...f]).toEqual(['w_tv']);
    const corner = wallsToFade(level.walls, { x: -300, y: 900 }, { x: 225, y: 250 });
    expect(corner.has('w_tv') || corner.has('w_entrada')).toBe(true);
    expect(wallsToFade(level.walls, { x: 225, y: 250 }, { x: 200, y: 250 }).size).toBe(0);
    const near = wallsToFade(level.walls, { x: 225, y: 520 }, { x: 225, y: 530 }, 60);
    expect(near.has('w_tv')).toBe(true);
  });
});

describe('primera persona', () => {
  const walls = wallBoxes(level)
    .filter((b) => b.part !== 'dintel')
    .map(boxFootprint);

  it('altura de ojos y avance según la cámara', () => {
    expect(EYE_HEIGHT).toBe(165);
    const fwd = walkDelta(0, { forward: 1, right: 0 }, 10);
    expect(fwd.x).toBeCloseTo(0);
    expect(fwd.y).toBeCloseTo(-10); // yaw 0 mira a −Z = arriba del plano
    const right = walkDelta(0, { forward: 0, right: 1 }, 10);
    expect(right.x).toBeCloseTo(10);
    expect(walkDelta(1, { forward: 0, right: 0 }, 10)).toEqual({ x: 0, y: 0 });
  });

  it('no atraviesa muros pero desliza a lo largo de ellos', () => {
    expect(collides({ x: 225, y: 250 }, walls)).toBe(false);
    expect(moveWithCollision({ x: 225, y: 40 }, { x: 0, y: -30 }, walls)).toEqual({
      x: 225,
      y: 40,
    });
    expect(moveWithCollision({ x: 225, y: 40 }, { x: 20, y: -30 }, walls)).toEqual({
      x: 245,
      y: 40,
    });
    expect(moveWithCollision({ x: 40, y: 250 }, { x: -30, y: 20 }, walls)).toEqual({
      x: 40,
      y: 270,
    });
    expect(moveWithCollision({ x: 225, y: 250 }, { x: 10, y: 10 }, walls)).toEqual({
      x: 235,
      y: 260,
    });
    // La puerta de entrada (x = 0, y 400–490) deja salir.
    expect(collides({ x: 0, y: 445 }, walls)).toBe(false);
  });
});
