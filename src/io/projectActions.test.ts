import { beforeEach, describe, expect, it } from 'vitest';
import { readFixture } from '../../tests/helpers';
import { createProjectStore, isDirty, type ProjectStore } from '../store/projectStore';
import type { FileGateway, FileInfo, OpenedFile } from './fileGateway';
import { loadSample, openProject, saveProject, saveProjectAs } from './projectActions';

/** Pasarela en memoria que imita a la de Tauri. */
class FakeGateway implements FileGateway {
  readonly kind = 'tauri' as const;
  disk = new Map<string, string>();
  current: string | null = null;
  nextOpen: string | null = null;
  nextSaveAs: string | null = null;
  fail = false;

  async open(): Promise<OpenedFile | null> {
    if (this.fail) throw new Error('disco roto');
    if (!this.nextOpen) return null;
    const text = this.disk.get(this.nextOpen);
    if (text === undefined) throw new Error('no existe');
    this.current = this.nextOpen;
    return { file: this.info(this.current), projectJson: text, assets: ['a.png'] };
  }
  async save(json: string): Promise<FileInfo | null> {
    if (this.fail) throw new Error('disco lleno');
    if (!this.current) return null;
    this.disk.set(this.current, json);
    return this.info(this.current);
  }
  async saveAs(json: string): Promise<FileInfo | null> {
    if (!this.nextSaveAs) return null;
    this.current = this.nextSaveAs;
    this.disk.set(this.current, json);
    return this.info(this.current);
  }
  private info(name: string): FileInfo {
    return { fileName: name, isPlanocasa: name.endsWith('.planocasa') };
  }
}

let store: ProjectStore;
let gw: FakeGateway;

beforeEach(() => {
  store = createProjectStore(() => '2026-10-05T12:00:00.000Z');
  gw = new FakeGateway();
  gw.disk.set('salon.planocasa', readFixture('salon-madrid.json'));
});

describe('abrir', () => {
  it('abre, valida y carga con sus assets', async () => {
    gw.nextOpen = 'salon.planocasa';
    expect(await openProject(store, gw)).toEqual({ ok: true });
    expect(store.getState().project?.id).toBe('salon-madrid');
    expect(store.getState().assets).toEqual(['a.png']);
    expect(store.getState().file?.fileName).toBe('salon.planocasa');
  });

  it('cancelar no cambia nada', async () => {
    expect(await openProject(store, gw)).toEqual({ ok: false, cancelled: true });
    expect(store.getState().project).toBeNull();
  });

  it('un archivo inválido devuelve los errores y no carga nada', async () => {
    gw.disk.set('malo.json', '{"schemaVersion":1}');
    gw.nextOpen = 'malo.json';
    const r = await openProject(store, gw);
    expect(r.ok).toBe(false);
    if (!r.ok && !r.cancelled) expect(r.issues.length).toBeGreaterThan(0);
    expect(store.getState().project).toBeNull();
  });

  it('los errores de E/S se devuelven como mensaje', async () => {
    gw.fail = true;
    gw.nextOpen = 'salon.planocasa';
    const r = await openProject(store, gw);
    expect(r).toEqual({ ok: false, issues: [{ path: '', message: 'disco roto' }] });
  });
});

describe('guardar', () => {
  it('ACEPTACIÓN fase 0: abrir → guardar → reabrir da los mismos datos', async () => {
    gw.nextOpen = 'salon.planocasa';
    await openProject(store, gw);
    expect(await saveProject(store, gw)).toEqual({ ok: true });

    const original: unknown = JSON.parse(readFixture('salon-madrid.json'));
    const saved: unknown = JSON.parse(gw.disk.get('salon.planocasa')!);
    expect(saved).toStrictEqual(original);

    const other = createProjectStore();
    gw.nextOpen = 'salon.planocasa';
    await openProject(other, gw);
    expect(other.getState().project).toStrictEqual(store.getState().project);
  });

  it('guardar deja el estado limpio', async () => {
    gw.nextOpen = 'salon.planocasa';
    await openProject(store, gw);
    store.getState().renameProject('Piso 2');
    expect(isDirty(store.getState())).toBe(true);
    await saveProject(store, gw);
    expect(isDirty(store.getState())).toBe(false);
    expect(gw.disk.get('salon.planocasa')).toContain('"name": "Piso 2"');
  });

  it('sin archivo, "Guardar" hace "Guardar como"', async () => {
    loadSample(store);
    gw.nextSaveAs = 'nuevo.planocasa';
    expect(await saveProject(store, gw)).toEqual({ ok: true });
    expect(store.getState().file?.fileName).toBe('nuevo.planocasa');
    expect(gw.disk.has('nuevo.planocasa')).toBe(true);
  });

  it('cancelar "Guardar como" deja el proyecto con cambios', async () => {
    loadSample(store);
    store.getState().renameProject('X');
    expect(await saveProjectAs(store, gw)).toEqual({ ok: false, cancelled: true });
    expect(isDirty(store.getState())).toBe(true);
  });

  it('los fallos de disco se informan y no marcan como guardado', async () => {
    gw.nextOpen = 'salon.planocasa';
    await openProject(store, gw);
    store.getState().renameProject('X');
    gw.fail = true;
    const r = await saveProject(store, gw);
    expect(r).toEqual({ ok: false, issues: [{ path: '', message: 'disco lleno' }] });
    expect(isDirty(store.getState())).toBe(true);
  });

  it('sin proyecto no se guarda', async () => {
    expect((await saveProject(store, gw)).ok).toBe(false);
    expect((await saveProjectAs(store, gw)).ok).toBe(false);
  });
});

describe('ejemplo', () => {
  it('carga el salón de Madrid sin archivo asociado', () => {
    expect(loadSample(store)).toEqual({ ok: true });
    expect(store.getState().project?.variants).toHaveLength(9);
    expect(store.getState().file).toBeNull();
  });
});
