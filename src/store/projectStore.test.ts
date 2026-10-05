import { beforeEach, describe, expect, it } from 'vitest';
import { parseProject, serializeProject } from '../io/projectJson';
import { clone, loadFixture, readFixture } from '../../tests/helpers';
import { createProjectStore, HISTORY_LIMIT, isDirty, type ProjectStore } from './projectStore';

const FILE = { fileName: 'salon.planocasa', isPlanocasa: true };

let store: ProjectStore;
let tick = 0;
const clock = () => `2026-10-05T10:00:${String(++tick % 60).padStart(2, '0')}.000Z`;

const project = () => store.getState().project!;
const history = () => store.temporal.getState();

beforeEach(() => {
  tick = 0;
  store = createProjectStore(clock);
  store.getState().loadProject(loadFixture('salon-madrid.json'), FILE, ['fondo.png']);
});

describe('carga', () => {
  it('carga sin historial y sin cambios pendientes', () => {
    expect(project().name).toBe('Salón Madrid — sofá nuevo');
    expect(store.getState().assets).toEqual(['fondo.png']);
    expect(history().pastStates).toHaveLength(0);
    expect(isDirty(store.getState())).toBe(false);
  });

  it('abrir → guardar sin tocar nada da exactamente el mismo archivo', () => {
    const original: unknown = JSON.parse(readFixture('salon-madrid.json'));
    expect(JSON.parse(serializeProject(project()))).toStrictEqual(original);
  });

  it('cerrar vacía el estado y el historial', () => {
    store.getState().renameProject('X');
    store.getState().closeProject();
    expect(store.getState().project).toBeNull();
    expect(store.getState().file).toBeNull();
    expect(history().pastStates).toHaveLength(0);
    expect(isDirty(store.getState())).toBe(false);
  });
});

describe('acciones', () => {
  it('renombrar recorta espacios, sella updatedAt y marca cambios', () => {
    store.getState().renameProject('  Piso 2  ');
    expect(project().name).toBe('Piso 2');
    expect(project().updatedAt).toBe('2026-10-05T10:00:01.000Z');
    expect(isDirty(store.getState())).toBe(true);
  });

  it('no permite nombres vacíos', () => {
    expect(() => store.getState().renameProject('   ')).toThrow(/vacío/);
  });

  it('cambia la variante activa y valida que exista', () => {
    store.getState().setActiveVariant('K1');
    expect(project().activeVariantId).toBe('K1');
    expect(() => store.getState().setActiveVariant('Z9')).toThrow(/inexistente/);
  });

  it('activar la variante que ya está activa no genera historial', () => {
    store.getState().setActiveVariant('M1');
    expect(history().pastStates).toHaveLength(0);
  });

  it('mueve un mueble', () => {
    store.getState().updateItem('M1', 'moscu', { x: 230, rotation: 90 });
    const moscu = project().variants[1]!.items.find((i) => i.id === 'moscu')!;
    expect(moscu.x).toBe(230);
    expect(moscu.rotation).toBe(90);
    expect(moscu.y).toBe(42.5);
  });

  it('rechaza parches inválidos o campos no editables', () => {
    expect(() => store.getState().updateItem('M1', 'moscu', { x: 230.2 })).toThrow();
    expect(() => store.getState().updateItem('M1', 'moscu', { rotation: 400 })).toThrow();
    expect(() =>
      store.getState().updateItem('M1', 'moscu', { id: 'otro' } as unknown as { x: number }),
    ).toThrow();
    expect(history().pastStates).toHaveLength(0);
  });

  it('rechaza muebles o variantes inexistentes', () => {
    expect(() => store.getState().updateItem('M1', 'nada', { x: 1 })).toThrow(/No existe/);
    expect(() => store.getState().updateItem('ZZ', 'moscu', { x: 1 })).toThrow(/No existe/);
  });

  it('sin proyecto, las acciones fallan', () => {
    store.getState().closeProject();
    expect(() => store.getState().renameProject('x')).toThrow(/ningún proyecto/);
    expect(() => store.getState().setActiveVariant('M1')).toThrow();
  });

  it('el resultado de las acciones sigue siendo un proyecto válido', () => {
    store.getState().renameProject('Piso 2');
    store.getState().setActiveVariant('K3');
    store.getState().updateItem('K3', 'kansas', { x: 300, status: 'tengo', color: '#123456' });
    const r = parseProject(serializeProject(project()));
    if (!r.ok) expect.fail(r.issues.map((i) => i.message).join());
  });
});

describe('deshacer / rehacer', () => {
  it('deshace y rehace en orden', () => {
    store.getState().renameProject('A');
    store.getState().renameProject('B');
    history().undo();
    expect(project().name).toBe('A');
    history().undo();
    expect(project().name).toBe('Salón Madrid — sofá nuevo');
    history().redo();
    expect(project().name).toBe('A');
  });

  it('deshacer hasta lo guardado limpia el indicador de cambios', () => {
    store.getState().updateItem('M1', 'moscu', { x: 100 });
    expect(isDirty(store.getState())).toBe(true);
    history().undo();
    expect(isDirty(store.getState())).toBe(false);
  });

  it('guardar no crea entrada de historial y deja el estado limpio', () => {
    store.getState().renameProject('A');
    store.getState().markSaved({ fileName: 'nuevo.planocasa', isPlanocasa: true });
    expect(history().pastStates).toHaveLength(1);
    expect(isDirty(store.getState())).toBe(false);
    expect(store.getState().file?.fileName).toBe('nuevo.planocasa');
    history().undo();
    expect(isDirty(store.getState())).toBe(true);
  });

  it(`conserva como mínimo ${HISTORY_LIMIT} pasos`, () => {
    for (let i = 0; i < HISTORY_LIMIT + 10; i++) {
      store.getState().updateItem('M1', 'moscu', { x: 100 + i });
    }
    expect(history().pastStates).toHaveLength(HISTORY_LIMIT);
  });

  it('no muta el proyecto cargado (inmutabilidad)', () => {
    const loaded = clone(project());
    const ref = project();
    store.getState().updateItem('M1', 'moscu', { x: 1 });
    expect(ref).toStrictEqual(loaded);
  });
});
