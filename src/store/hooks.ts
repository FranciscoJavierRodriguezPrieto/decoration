/** Hooks de React sobre las stores. Pegamento de UI: sin lógica. */
import type { TemporalState } from 'zundo';
import { useStore } from 'zustand';
import { projectStore, type ProjectState } from './projectStore';
import { uiStore, type UiState } from './uiStore';

type HistoryState = Pick<ProjectState, 'project'>;

export function useProject<T>(selector: (s: ProjectState) => T): T {
  return useStore(projectStore, selector);
}

export function useHistory<T>(selector: (s: TemporalState<HistoryState>) => T): T {
  return useStore(projectStore.temporal, selector);
}

export function useUi<T>(selector: (s: UiState) => T): T {
  return useStore(uiStore, selector);
}
