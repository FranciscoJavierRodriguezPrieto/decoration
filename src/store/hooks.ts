/** Hooks de React sobre la store única. Pegamento de UI: sin lógica. */
import type { TemporalState } from 'zundo';
import { useStore } from 'zustand';
import { projectStore, type ProjectState } from './projectStore';

type HistoryState = Pick<ProjectState, 'project'>;

export function useProject<T>(selector: (s: ProjectState) => T): T {
  return useStore(projectStore, selector);
}

export function useHistory<T>(selector: (s: TemporalState<HistoryState>) => T): T {
  return useStore(projectStore.temporal, selector);
}
