/**
 * Estado del proyecto abierto: zustand (vanilla) + immer + zundo (deshacer/rehacer).
 *
 * - El historial solo registra `project`; abrir un archivo lo vacía.
 * - Toda acción que cambia datos actualiza `updatedAt` con el reloj inyectado.
 * - `savedProject` guarda la referencia de lo último guardado: como immer comparte
 *   estructura y zundo restaura las mismas referencias, `dirty` vuelve a `false`
 *   si deshaces justo hasta lo guardado.
 */
import type { z } from 'zod';
import { temporal, type TemporalState } from 'zundo';
import { createStore, type StoreApi } from 'zustand/vanilla';
import { immer } from 'zustand/middleware/immer';
import type { Vec2 } from '../geometry/vec';
import * as openings from '../geometry/openings';
import * as walls from '../geometry/walls';
import type { FileInfo } from '../io/fileGateway';
import type { Level, Project, Wall } from '../model/project';
import {
  Fixture as FixtureSchema,
  Item as ItemSchema,
  Opening as OpeningSchema,
  Wall as WallSchema,
} from '../model/schemas';
import { resolveVariantItems } from '../model/variants';

export const HISTORY_LIMIT = 200;

/** Campos de un mueble editables desde el panel de propiedades. */
export const ItemPatch = ItemSchema.pick({
  name: true,
  x: true,
  y: true,
  w: true,
  d: true,
  h: true,
  rotation: true,
  color: true,
  status: true,
  seasonal: true,
})
  .partial()
  .strict();
export type ItemPatch = z.infer<typeof ItemPatch>;

/** Campos de un muro editables desde el panel de propiedades. */
export const WallPatch = WallSchema.innerType()
  .pick({ thickness: true, kind: true })
  .partial()
  .strict();
export type WallPatch = z.infer<typeof WallPatch>;

/** Campos editables de un hueco (todo salvo el id). */
export const OpeningPatch = OpeningSchema.omit({ id: true }).partial().strict();
export type OpeningPatch = z.infer<typeof OpeningPatch>;

/** Campos editables de un elemento fijo (todo salvo el id). */
export const FixturePatch = FixtureSchema.omit({ id: true }).partial().strict();
export type FixturePatch = z.infer<typeof FixturePatch>;

export interface ProjectState {
  project: Project | null;
  savedProject: Project | null;
  file: FileInfo | null;
  assets: string[];

  /** Carga un proyecto ya validado y vacía el historial. */
  loadProject(project: Project, file: FileInfo | null, assets?: string[]): void;
  closeProject(): void;
  /** Marca lo actual como guardado en `file`. No crea entrada de historial. */
  markSaved(file: FileInfo): void;

  renameProject(name: string): void;
  setActiveVariant(variantId: string): void;
  /** Cambia un mueble de la variante dada. Lanza si el parche no es válido. */
  updateItem(variantId: string, itemId: string, patch: ItemPatch): void;
  /**
   * Mueve o cambia un mueble tal como se ve en la variante. Si el mueble es
   * heredado (vive en la base), la variante guarda una copia sobrescrita y la
   * base no cambia (ESPECIFICACION §6).
   */
  editItemInVariant(variantId: string, itemId: string, patch: ItemPatch): void;

  // --- Edición del plano (fase 1) -----------------------------------------
  /** Mueve una esquina: todos los muros y estancias que la comparten. */
  moveVertex(levelId: string, from: Vec2, to: Vec2): void;
  setWallLength(levelId: string, wallId: string, length: number): void;
  updateWall(levelId: string, wallId: string, patch: WallPatch): void;
  /** Crea un muro y devuelve su id. */
  addWall(levelId: string, a: Vec2, b: Vec2, opts?: Pick<Wall, 'thickness' | 'kind'>): string;
  deleteWall(levelId: string, wallId: string): void;

  /** Crea un hueco centrado a `t` cm del inicio del muro. Devuelve su id. */
  addOpening(
    levelId: string,
    wallId: string,
    t: number,
    kind: openings.OpeningKind,
    overrides?: OpeningPatch,
  ): string;
  updateOpening(levelId: string, id: string, patch: OpeningPatch): void;
  deleteOpening(levelId: string, id: string): void;
  /** Crea un fijo pegado al muro, centrado a `t` cm de su inicio. Devuelve su id. */
  addFixture(levelId: string, wallId: string, t: number, kind: openings.FixtureKind): string;
  updateFixture(levelId: string, id: string, patch: FixturePatch): void;
  deleteFixture(levelId: string, id: string): void;
}

type HistoryState = Pick<ProjectState, 'project'>;
export type ProjectStore = StoreApi<ProjectState> & {
  temporal: StoreApi<TemporalState<HistoryState>>;
};

export const isDirty = (s: Pick<ProjectState, 'project' | 'savedProject'>): boolean =>
  s.project !== null && s.project !== s.savedProject;

export function createProjectStore(
  now: () => string = () => new Date().toISOString(),
): ProjectStore {
  const store = createStore<ProjectState>()(
    temporal(
      immer((set, get) => {
        /** Aplica una mutación al proyecto y sella `updatedAt`. */
        const mutate = (fn: (p: Project) => void): void => {
          if (!get().project) throw new Error('No hay ningún proyecto abierto');
          set((s) => {
            if (!s.project) return;
            fn(s.project);
            s.project.updatedAt = now();
          });
        };

        const levelIndex = (levelId: string): number => {
          const i = get().project?.levels.findIndex((l) => l.id === levelId) ?? -1;
          if (i < 0) throw new Error(`Nivel inexistente: "${levelId}"`);
          return i;
        };

        /** Sustituye un nivel por el resultado de una edición pura. */
        const editLevel = (levelId: string, fn: (l: Level) => Level): void => {
          const i = levelIndex(levelId);
          const current = get().project?.levels[i];
          if (!current) return;
          const next = fn(current);
          mutate((p) => {
            p.levels[i] = next;
          });
        };

        return {
          project: null,
          savedProject: null,
          file: null,
          assets: [],

          loadProject(project, file, assets = []) {
            set({ project, savedProject: project, file, assets });
            store.temporal.getState().clear();
          },

          closeProject() {
            set({ project: null, savedProject: null, file: null, assets: [] });
            store.temporal.getState().clear();
          },

          markSaved(file) {
            const { pause, resume } = store.temporal.getState();
            pause();
            set((s) => {
              s.file = file;
            });
            set({ savedProject: get().project });
            resume();
          },

          renameProject(name) {
            const clean = name.trim();
            if (!clean) throw new Error('El nombre no puede estar vacío');
            mutate((p) => {
              p.name = clean;
            });
          },

          setActiveVariant(variantId) {
            const p = get().project;
            if (!p?.variants.some((v) => v.id === variantId)) {
              throw new Error(`Variante inexistente: "${variantId}"`);
            }
            if (p.activeVariantId === variantId) return;
            mutate((draft) => {
              draft.activeVariantId = variantId;
            });
          },

          updateItem(variantId, itemId, patch) {
            const valid = ItemPatch.parse(patch);
            const p = get().project;
            const variant = p?.variants.find((v) => v.id === variantId);
            if (!variant?.items.some((i) => i.id === itemId)) {
              throw new Error(`No existe el mueble "${itemId}" en la variante "${variantId}"`);
            }
            mutate((draft) => {
              const item = draft.variants
                .find((v) => v.id === variantId)
                ?.items.find((i) => i.id === itemId);
              if (item) Object.assign(item, valid);
            });
          },

          editItemInVariant(variantId, itemId, patch) {
            const valid = ItemPatch.parse(patch);
            const p = get().project;
            if (!p) throw new Error('No hay ningún proyecto abierto');
            const variant = p.variants.find((v) => v.id === variantId);
            if (!variant) throw new Error(`Variante inexistente: "${variantId}"`);
            if (variant.items.some((i) => i.id === itemId)) {
              get().updateItem(variantId, itemId, valid);
              return;
            }
            const inherited = resolveVariantItems(p, variantId).find((i) => i.id === itemId);
            if (!inherited) {
              throw new Error(`No existe el mueble "${itemId}" en la variante "${variantId}"`);
            }
            mutate((draft) => {
              draft.variants
                .find((v) => v.id === variantId)
                ?.items.push({ ...inherited, ...valid });
            });
          },

          moveVertex(levelId, from, to) {
            editLevel(levelId, (l) => walls.moveVertex(l, from, to));
          },

          setWallLength(levelId, wallId, length) {
            editLevel(levelId, (l) => walls.setWallLength(l, wallId, length));
          },

          updateWall(levelId, wallId, patch) {
            const valid = WallPatch.parse(patch);
            editLevel(levelId, (l) => {
              if (!l.walls.some((w) => w.id === wallId)) {
                throw new Error(`Muro inexistente: "${wallId}"`);
              }
              return {
                ...l,
                walls: l.walls.map((w) => (w.id === wallId ? { ...w, ...valid } : w)),
              };
            });
          },

          addWall(levelId, a, b, opts) {
            let created = '';
            editLevel(levelId, (l) => {
              const r = walls.addWall(l, a, b, opts);
              created = r.id;
              return r.level;
            });
            return created;
          },

          deleteWall(levelId, wallId) {
            editLevel(levelId, (l) => walls.deleteWall(l, wallId));
          },

          addOpening(levelId, wallId, t, kind, overrides = {}) {
            const valid = OpeningPatch.parse(overrides);
            let created = '';
            editLevel(levelId, (l) => {
              const r = openings.addOpening(l, wallId, t, kind, valid);
              created = r.id;
              return r.level;
            });
            return created;
          },

          updateOpening(levelId, id, patch) {
            const valid = OpeningPatch.parse(patch);
            editLevel(levelId, (l) => openings.updateOpening(l, id, valid));
          },

          deleteOpening(levelId, id) {
            editLevel(levelId, (l) => openings.deleteOpening(l, id));
          },

          addFixture(levelId, wallId, t, kind) {
            let created = '';
            editLevel(levelId, (l) => {
              const r = openings.addFixture(l, wallId, t, kind);
              created = r.id;
              return r.level;
            });
            return created;
          },

          updateFixture(levelId, id, patch) {
            const valid = FixturePatch.parse(patch);
            editLevel(levelId, (l) => openings.updateFixture(l, id, valid));
          },

          deleteFixture(levelId, id) {
            editLevel(levelId, (l) => openings.deleteFixture(l, id));
          },
        };
      }),
      {
        limit: HISTORY_LIMIT,
        partialize: (s): HistoryState => ({ project: s.project }),
        // No registrar cambios que no tocan el proyecto (p. ej. markSaved).
        equality: (a, b) => a.project === b.project,
      },
    ),
  ) as ProjectStore;

  return store;
}

/** Store única de la app. */
export const projectStore = createProjectStore();
