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
import type { FileInfo } from '../io/fileGateway';
import type { Project } from '../model/project';
import { Item as ItemSchema } from '../model/schemas';

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
