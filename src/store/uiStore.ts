/**
 * Estado de la interfaz (no es parte del proyecto ni del historial):
 * nivel visible, selección, herramienta activa y pestaña.
 */
import { createStore } from 'zustand/vanilla';

export type Tool = 'select' | 'wall';
export type Tab = 'plano' | 'muebles';
export type Selection =
  | { kind: 'wall'; levelId: string; id: string }
  | { kind: 'item'; variantId: string; id: string }
  | null;

export interface UiState {
  levelId: string | null;
  selection: Selection;
  tool: Tool;
  tab: Tab;
  /** Paso de la rejilla de imán, en cm. */
  grid: number;

  setLevel(levelId: string | null): void;
  select(selection: Selection): void;
  setTool(tool: Tool): void;
  setTab(tab: Tab): void;
  setGrid(grid: number): void;
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

    setLevel: (levelId) => set({ levelId, selection: null }),
    select: (selection) => set({ selection }),
    setTool: (tool) => set({ tool, selection: null }),
    setTab: (tab) => set({ tab }),
    setGrid: (grid) => set({ grid: grid > 0 ? grid : 1 }),
    reset: (levelId = null) => set({ levelId, selection: null, tool: 'select', tab: 'plano' }),
  }));
}

export const uiStore = createUiStore();
