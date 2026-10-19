import { describe, expect, it } from 'vitest';
import { dist } from '../geometry/vec';
import { Background as BackgroundSchema } from '../model/schemas';
import {
  backgroundBounds,
  backgroundCenter,
  backgroundCorners,
  calibrate,
  imageToPlan,
  initialBackground,
  moveBackground,
  normalizeAngle,
  planToImage,
  rotateAbout,
  straighten,
  unionBounds,
  type Background,
} from './background';

const bg = (patch: Partial<Background> = {}): Background => ({
  asset: 'fondo.png',
  cmPerPx: 2,
  offset: { x: 100, y: 50 },
  rotation: 0,
  opacity: 0.5,
  ...patch,
});

const close = (a: { x: number; y: number }, b: { x: number; y: number }) => {
  expect(a.x).toBeCloseTo(b.x, 6);
  expect(a.y).toBeCloseTo(b.y, 6);
};

describe('transformación imagen ⇄ plano', () => {
  it('sin giro: escala y desplaza', () => {
    close(imageToPlan(bg(), { x: 10, y: 20 }), { x: 120, y: 90 });
  });

  it('el giro es horario visto en planta (Y abajo), como Konva', () => {
    // El borde superior de la imagen (+X) pasa a apuntar hacia abajo (+Y).
    close(imageToPlan(bg({ rotation: 90 }), { x: 10, y: 0 }), { x: 100, y: 70 });
  });

  it('planToImage deshace imageToPlan', () => {
    const b = bg({ rotation: 33, cmPerPx: 0.7 });
    const p = { x: 123.4, y: -56.7 };
    close(planToImage(b, imageToPlan(b, p)), p);
  });
});

describe('cajas', () => {
  it('esquinas y caja de una imagen girada 90°', () => {
    const b = bg({ rotation: 90, offset: { x: 0, y: 0 }, cmPerPx: 1 });
    const c = backgroundCorners(b, { width: 200, height: 100 });
    close(c[1]!, { x: 0, y: 200 });
    const box = backgroundBounds(b, { width: 200, height: 100 });
    expect(box.minX).toBeCloseTo(-100);
    expect(box.maxX).toBeCloseTo(0);
    expect(box.maxY).toBeCloseTo(200);
  });

  it('unionBounds tolera cajas ausentes', () => {
    const a = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
    const b = { minX: -5, minY: 2, maxX: 3, maxY: 20 };
    expect(unionBounds(null, null)).toBeNull();
    expect(unionBounds(a, null)).toBe(a);
    expect(unionBounds(null, b)).toBe(b);
    expect(unionBounds(a, b)).toEqual({ minX: -5, minY: 0, maxX: 10, maxY: 20 });
  });

  it('centro de la imagen', () => {
    close(backgroundCenter(bg(), { width: 100, height: 50 }), { x: 200, y: 100 });
  });
});

describe('fondo inicial', () => {
  it('sin nada dibujado: 10 m de ancho en el origen, y valida con el esquema', () => {
    const b = initialBackground('fondo-1.pdf', { width: 842, height: 595 }, null, 1);
    expect(b.cmPerPx * 842).toBeCloseTo(1000);
    expect(b.offset).toEqual({ x: 0, y: 0 });
    expect(b.page).toBe(1);
    expect(BackgroundSchema.safeParse(b).success).toBe(true);
  });

  it('con muros: ocupa su ancho y arranca en su esquina', () => {
    const b = initialBackground(
      'f.png',
      { width: 1000, height: 800 },
      { minX: -10, minY: 5, maxX: 440, maxY: 500 },
    );
    expect(b.cmPerPx * 1000).toBeCloseTo(450);
    expect(b.offset).toEqual({ x: -10, y: 5 });
    expect(b.page).toBeUndefined();
  });

  it('una imagen vacía es un error', () => {
    expect(() => initialBackground('f.png', { width: 0, height: 10 }, null)).toThrow();
  });
});

describe('calibrar', () => {
  it('la pared marcada pasa a medir lo real y el primer punto no se mueve', () => {
    const b = bg({ rotation: 17 });
    // Dos extremos de una pared tal como se ven ahora sobre el fondo.
    const pa = imageToPlan(b, { x: 40, y: 40 });
    const pb = imageToPlan(b, { x: 240, y: 40 }); // 200 px → hoy 400 cm
    const c = calibrate(b, pa, pb, 350);

    expect(c.cmPerPx).toBeCloseTo(1.75);
    close(imageToPlan(c, { x: 40, y: 40 }), pa);
    expect(dist(imageToPlan(c, { x: 40, y: 40 }), imageToPlan(c, { x: 240, y: 40 }))).toBeCloseTo(
      350,
    );
    expect(c.rotation).toBe(17);
  });

  it('caso del salón: plano a 1:100 escaneado a 100 ppp, pared de 450 cm', () => {
    // A 1:100 y 100 ppp, 450 cm de pared = 4,5 cm de papel = 177,17 px.
    const px = (4.5 / 2.54) * 100;
    const b = initialBackground('salon.png', { width: 1169, height: 827 }, null);
    const c = calibrate(b, imageToPlan(b, { x: 0, y: 0 }), imageToPlan(b, { x: px, y: 0 }), 450);
    expect(c.cmPerPx).toBeCloseTo(2.54, 6);
  });

  it('rechaza medidas y puntos imposibles', () => {
    const p = { x: 0, y: 0 };
    expect(() => calibrate(bg(), p, { x: 10, y: 0 }, 0)).toThrow(/mayor que 0/);
    expect(() => calibrate(bg(), p, { x: 10, y: 0 }, Number.NaN)).toThrow();
    expect(() => calibrate(bg(), p, p, 100)).toThrow(/distintos/);
    expect(() => calibrate(bg(), p, { x: 1e-3, y: 0 }, 1e9)).toThrow(/escala/);
  });
});

describe('girar, enderezar y mover', () => {
  it('normalizeAngle', () => {
    expect(normalizeAngle(0)).toBe(0);
    expect(normalizeAngle(190)).toBe(-170);
    expect(normalizeAngle(-180)).toBe(180);
    expect(normalizeAngle(540)).toBe(180);
    expect(normalizeAngle(-360)).toBe(0);
  });

  it('rotateAbout deja quieto el pivote', () => {
    const b = bg();
    const size = { width: 300, height: 200 };
    const center = backgroundCenter(b, size);
    const r = rotateAbout(b, center, 30);
    expect(r.rotation).toBe(30);
    close(backgroundCenter(r, size), center);
  });

  it('straighten pone recta una pared torcida 3°', () => {
    const b = bg({ rotation: 3 });
    const a = imageToPlan(b, { x: 0, y: 0 });
    const c = imageToPlan(b, { x: 100, y: 0 }); // pared horizontal en el papel
    const s = straighten(b, a, c);
    expect(s.rotation).toBeCloseTo(0, 6);
    close(imageToPlan(s, { x: 0, y: 0 }), a);
  });

  it('straighten elige la vertical si la línea está más cerca de ella', () => {
    const b = bg({ rotation: 0 });
    const s = straighten(b, { x: 0, y: 0 }, { x: 5, y: 100 });
    const a2 = imageToPlan(s, planToImage(b, { x: 0, y: 0 }));
    const b2 = imageToPlan(s, planToImage(b, { x: 5, y: 100 }));
    expect(b2.x - a2.x).toBeCloseTo(0, 6);
    expect(() => straighten(b, { x: 1, y: 1 }, { x: 1, y: 1 })).toThrow();
  });

  it('moveBackground', () => {
    expect(moveBackground(bg(), { x: -100, y: 10 }).offset).toEqual({ x: 0, y: 60 });
  });
});
