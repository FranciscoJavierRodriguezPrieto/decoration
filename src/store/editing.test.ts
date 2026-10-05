import { beforeEach, describe, expect, it } from 'vitest';
import { loadFixture } from '../../tests/helpers';
import { parseProject, serializeProject } from '../io/projectJson';
import { resolveVariantItems } from '../model/variants';
import { createProjectStore, isDirty, type ProjectStore } from './projectStore';
import { createUiStore } from './uiStore';

let store: ProjectStore;
const s = () => store.getState();
const level = () => s().project!.levels[0]!;
const wall = (id: string) => level().walls.find((w) => w.id === id)!;
const history = () => store.temporal.getState();

beforeEach(() => {
  store = createProjectStore(() => '2026-10-05T13:00:00.000Z');
  s().loadProject(loadFixture('salon-madrid.json'), null);
});

const stillValid = () => {
  const r = parseProject(serializeProject(s().project!));
  if (!r.ok) expect.fail(r.issues.map((i) => `${i.path}: ${i.message}`).join('\n'));
};

describe('edición de muros', () => {
  it('mover una esquina es un único paso de deshacer', () => {
    s().moveVertex('L0', { x: 450, y: 0 }, { x: 470, y: 0 });
    expect(wall('w_sofa').b).toEqual({ x: 470, y: 0 });
    expect(wall('w_ventana').a).toEqual({ x: 470, y: 0 });
    expect(history().pastStates).toHaveLength(1);
    history().undo();
    expect(wall('w_sofa').b).toEqual({ x: 450, y: 0 });
    expect(isDirty(s())).toBe(false);
    stillValid();
  });

  it('cambiar la longitud', () => {
    s().setWallLength('L0', 'w_sofa', 420);
    expect(wall('w_sofa').b).toEqual({ x: 420, y: 0 });
    stillValid();
  });

  it('cambiar grosor y tipo valida el parche', () => {
    s().updateWall('L0', 'w_tv', { thickness: 15, kind: 'carga' });
    expect(wall('w_tv')).toMatchObject({ thickness: 15, kind: 'carga' });
    expect(() => s().updateWall('L0', 'w_tv', { thickness: 0 })).toThrow();
    expect(() => s().updateWall('L0', 'nada', { thickness: 10 })).toThrow(/inexistente/);
    stillValid();
  });

  it('añadir y borrar muros', () => {
    const id = s().addWall('L0', { x: 230, y: 0 }, { x: 230, y: 230 });
    expect(wall(id).kind).toBe('tabique');
    s().deleteWall('L0', 'w_ventana');
    expect(level().walls.map((w) => w.id)).toEqual(['w_sofa', 'w_tv', 'w_entrada', id]);
    expect(level().openings.map((o) => o.id)).toEqual(['puerta_entrada']);
    stillValid();
    history().undo();
    history().undo();
    expect(level().walls).toHaveLength(4);
  });

  it('nivel inexistente', () => {
    expect(() => s().moveVertex('X', { x: 0, y: 0 }, { x: 1, y: 1 })).toThrow(/Nivel inexistente/);
  });
});

describe('huecos y fijos', () => {
  it('añadir, cambiar y borrar una puerta, con deshacer', () => {
    const id = s().addOpening('L0', 'w_tv', 100, 'puerta');
    expect(level().openings.find((o) => o.id === id)?.kind).toBe('puerta');
    s().updateOpening('L0', id, { width: 72, hinge: 'der', swing: 'fuera' });
    expect(level().openings.find((o) => o.id === id)).toMatchObject({ width: 72, hinge: 'der' });
    stillValid();
    s().deleteOpening('L0', id);
    expect(level().openings.some((o) => o.id === id)).toBe(false);
    history().undo();
    expect(level().openings.some((o) => o.id === id)).toBe(true);
  });

  it('valida los parches de huecos', () => {
    expect(() => s().updateOpening('L0', 'ventana', { width: -5 })).toThrow();
    expect(() => s().updateOpening('L0', 'ventana', { id: 'x' } as never)).toThrow();
  });

  it('añadir, cambiar y borrar un radiador', () => {
    const id = s().addFixture('L0', 'w_tv', 200, 'radiador');
    s().updateFixture('L0', id, { w: 100 });
    expect(level().fixtures.find((f) => f.id === id)?.w).toBe(100);
    stillValid();
    expect(() => s().updateFixture('L0', id, { w: 0 })).toThrow();
    s().deleteFixture('L0', id);
    expect(level().fixtures.some((f) => f.id === id)).toBe(false);
  });
});

describe('muebles en variantes', () => {
  it('mover un mueble propio de la variante lo cambia en sitio', () => {
    s().editItemInVariant('M1', 'moscu', { x: 240 });
    expect(s().project!.variants[1]!.items.find((i) => i.id === 'moscu')!.x).toBe(240);
  });

  it('mover un mueble heredado crea una sobrescritura y no toca la base', () => {
    s().editItemInVariant('M1', 'tv', { x: 300 });
    const base = s().project!.variants[0]!.items.find((i) => i.id === 'tv')!;
    expect(base.x).toBe(260);
    const m1 = s().project!.variants[1]!;
    expect(m1.items.find((i) => i.id === 'tv')!.x).toBe(300);
    expect(resolveVariantItems(s().project!, 'M1').find((i) => i.id === 'tv')!.x).toBe(300);
    // Las demás variantes siguen viendo la TV de la base.
    expect(resolveVariantItems(s().project!, 'K1').find((i) => i.id === 'tv')!.x).toBe(260);
    stillValid();
  });

  it('errores', () => {
    expect(() => s().editItemInVariant('ZZ', 'tv', { x: 1 })).toThrow(/Variante/);
    expect(() => s().editItemInVariant('M1', 'nada', { x: 1 })).toThrow(/No existe/);
    expect(() => s().editItemInVariant('M1', 'tv', { x: 1.2 })).toThrow();
    s().closeProject();
    expect(() => s().editItemInVariant('M1', 'tv', { x: 1 })).toThrow(/ningún proyecto/);
  });
});

describe('altas y bajas de muebles', () => {
  const sofa = {
    name: 'Sofá rojo',
    category: 'sofa',
    x: 200,
    y: 60,
    w: 165,
    d: 95,
    h: 78,
    rotation: 0,
    status: 'tengo' as const,
  };

  it('añadir, duplicar y quitar con deshacer', () => {
    const id = s().addItem('M1', sofa);
    const copy = s().duplicateItem('M1', id);
    const items = resolveVariantItems(s().project!, 'M1');
    expect(items.find((i) => i.id === copy)).toMatchObject({ x: 220, y: 80, w: 165 });
    stillValid();
    s().removeItem('M1', 'tv');
    expect(resolveVariantItems(s().project!, 'M1').some((i) => i.id === 'tv')).toBe(false);
    history().undo();
    expect(resolveVariantItems(s().project!, 'M1').some((i) => i.id === 'tv')).toBe(true);
  });

  it('valida el mueble y los ids', () => {
    expect(() => s().addItem('M1', { ...sofa, w: 0 })).toThrow();
    expect(() => s().duplicateItem('M1', 'nada')).toThrow(/No existe/);
    s().closeProject();
    expect(() => s().addItem('M1', sofa)).toThrow(/ningún proyecto/);
    expect(() => s().duplicateItem('M1', 'x')).toThrow(/ningún proyecto/);
    expect(() => s().removeItem('M1', 'x')).toThrow(/ningún proyecto/);
  });
});

describe('uiStore', () => {
  it('cambia de nivel, herramienta y pestaña limpiando la selección', () => {
    const ui = createUiStore();
    ui.getState().select({ kind: 'wall', levelId: 'L0', id: 'w_sofa' });
    ui.getState().setTool('wall');
    expect(ui.getState().selection).toBeNull();
    ui.getState().select({ kind: 'item', variantId: 'M1', id: 'tv' });
    ui.getState().setLevel('L0');
    expect(ui.getState().selection).toBeNull();
    ui.getState().setTab('muebles');
    ui.getState().setGrid(0);
    expect(ui.getState().grid).toBe(1);
    ui.getState().flash('Aviso');
    expect(ui.getState().message).toBe('Aviso');
    ui.getState().flash(null);
    ui.getState().reset('L1');
    expect(ui.getState()).toMatchObject({ levelId: 'L1', tool: 'select', tab: 'plano' });
  });
});
