/**
 * Estado de la interfaz (no es parte del proyecto ni del historial):
 * nivel visible, selección, herramienta activa y pestaña.
 */
import { createStore } from 'zustand/vanilla';
import type { Vec2 } from '../geometry/vec';

/** `calibrate`: marcar dos puntos sobre el plano de fondo para fijar su escala. */
export type Tool = 'select' | 'wall' | 'door' | 'window' | 'radiator' | 'calibrate';
export type Tab = 'plano' | 'tres' | 'muebles';
export type View3DMode = 'orbita' | 'primera' | 'planta';

export interface View3D {
  mode: View3DMode;
  /** Hora solar para la luz del sol (6–21). */
  hour: number;
  /** Hacia dónde cae el norte en el plano, en grados horarios desde arriba. */
  north: number;
}
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
  /** Avisos del motor de reglas: si se dibujan y con qué opciones (reglas 8 y 9). */
  showWarnings: boolean;
  view3d: View3D;
  includeSeasonal: boolean;
  checkExtended: boolean;
  /** Panel del plano de fondo abierto (excluye al de añadir mueble). */
  backgroundPanel: boolean;
  /** Mostrar el plano de fondo en el lienzo. */
  showBackground: boolean;
  /** Puntos marcados con la herramienta Calibrar (en cm del plano). */
  calibration: { a: Vec2 | null; b: Vec2 | null };

  setLevel(levelId: string | null): void;
  select(selection: Selection): void;
  setTool(tool: Tool): void;
  setTab(tab: Tab): void;
  setGrid(grid: number): void;
  /** Muestra un aviso breve; `null` lo quita. */
  flash(message: string | null): void;
  setAdding(adding: boolean): void;
  setBackgroundPanel(open: boolean): void;
  setShowBackground(show: boolean): void;
  /** Añade un punto de calibración (el tercero vuelve a empezar). */
  addCalibrationPoint(p: Vec2): void;
  clearCalibration(): void;
  setViewCenter(c: { x: number; y: number } | null): void;
  setView3d(patch: Partial<View3D>): void;
  setRuleFlags(
    flags: Partial<Pick<UiState, 'showWarnings' | 'includeSeasonal' | 'checkExtended'>>,
  ): void;
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
    showWarnings: true,
    view3d: { mode: 'orbita', hour: 17, north: 0 },
    includeSeasonal: false,
    checkExtended: true,
    backgroundPanel: false,
    showBackground: true,
    calibration: { a: null, b: null },

    setLevel: (levelId) => set({ levelId, selection: null }),
    select: (selection) => set(selection ? { selection, adding: false } : { selection }),
    setTool: (tool) => set({ tool, selection: null, calibration: { a: null, b: null } }),
    setTab: (tab) => set({ tab }),
    setGrid: (grid) => set({ grid: grid > 0 ? grid : 1 }),
    flash: (message) => set({ message }),
    setAdding: (adding) =>
      set(
        adding ? { adding, backgroundPanel: false, selection: null, tool: 'select' } : { adding },
      ),
    setBackgroundPanel: (open) =>
      set(
        open
          ? { backgroundPanel: true, adding: false, selection: null }
          : (s) => ({
              backgroundPanel: false,
              ...(s.tool === 'calibrate'
                ? { tool: 'select' as const, calibration: { a: null, b: null } }
                : {}),
            }),
      ),
    setShowBackground: (showBackground) => set({ showBackground }),
    addCalibrationPoint: (p) =>
      set((s) => ({
        calibration:
          !s.calibration.a || s.calibration.b ? { a: p, b: null } : { a: s.calibration.a, b: p },
      })),
    clearCalibration: () => set({ calibration: { a: null, b: null } }),
    setViewCenter: (viewCenter) => set({ viewCenter }),
    setRuleFlags: (flags) => set(flags),
    setView3d: (patch) => set((s) => ({ view3d: { ...s.view3d, ...patch } })),
    reset: (levelId = null) =>
      set({
        levelId,
        selection: null,
        tool: 'select',
        tab: 'plano',
        adding: false,
        backgroundPanel: false,
        showBackground: true,
        calibration: { a: null, b: null },
      }),
  }));
}

export const uiStore = createUiStore();
