/**
 * Estado de la interfaz (no es parte del proyecto ni del historial):
 * nivel visible, selección, herramienta activa y pestaña.
 */
import { createStore } from 'zustand/vanilla';

export type Tool = 'select' | 'wall' | 'door' | 'window' | 'radiator';
export type Tab = 'plano' | 'muebles';
export type Selection =
  | { kind: 'wall'; levelId: string; id: string }
  | { kind: 'item'; variantId: string; id: string }
  | { kind: 'opening'; levelId: string; id: string }
  | { kind: 'fixture'; levelId: string; id: string }
  | null;

export interface UiState {
  levelId: string | null;
  selection: Selection;
  tool: Tool;
  tab: Tab;
  /** Paso de la rejilla de imán, en cm. */
  grid: number;
  /** Mensaje breve para el usuario (p. ej. "Ya hay otro hueco ahí"). */
  message: string | null;
  /** Panel de añadir mueble abierto. */
  adding: boolean;
  /** Centro de la vista del plano en cm (donde aparecen los muebles nuevos). */
  viewCenter: { x: number; y: number } | null;

  setLevel(levelId: string | null): void;
  select(selection: Selection): void;
  setTool(tool: Tool): void;
  setTab(tab: Tab): void;
  setGrid(grid: number): void;
  /** Muestra un aviso breve; `null` lo quita. */
  flash(message: string | null): void;
  setAdding(adding: boolean): void;
  setViewCenter(c: { x: number; y: number } | null): void;
  /** Vuelve al estado inicial (al abrir o cerrar un proyecto). */
  reset(levelId?: string | null): void;
}

export function createUiStore() {
  return createStore<UiState>()((set) => ({
    levelId: null,
    selection: null,
    tool: 'select',
    tab: 'plano',
    grid: 5,
    message: null,
    adding: false,
    viewCenter: null,

    setLevel: (levelId) => set({ levelId, selection: null }),
    select: (selection) => set(selection ? { selection, adding: false } : { selection }),
    setTool: (tool) => set({ tool, selection: null }),
    setTab: (tab) => set({ tab }),
    setGrid: (grid) => set({ grid: grid > 0 ? grid : 1 }),
    flash: (message) => set({ message }),
    setAdding: (adding) => set(adding ? { adding, selection: null, tool: 'select' } : { adding }),
    setViewCenter: (viewCenter) => set({ viewCenter }),
    reset: (levelId = null) =>
      set({ levelId, selection: null, tool: 'select', tab: 'plano', adding: false }),
  }));
}

export const uiStore = createUiStore();
