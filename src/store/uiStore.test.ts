import { describe, expect, it } from 'vitest';
import { createUiStore } from './uiStore';

describe('uiStore · plano de fondo', () => {
  it('el panel de fondo y el de añadir mueble se excluyen', () => {
    const ui = createUiStore();
    ui.getState().setAdding(true);
    ui.getState().setBackgroundPanel(true);
    expect(ui.getState().adding).toBe(false);
    expect(ui.getState().backgroundPanel).toBe(true);
    ui.getState().setAdding(true);
    expect(ui.getState().backgroundPanel).toBe(false);
  });

  it('calibrar: dos puntos y el tercero vuelve a empezar', () => {
    const ui = createUiStore();
    const s = () => ui.getState();
    s().setTool('calibrate');
    s().addCalibrationPoint({ x: 0, y: 0 });
    expect(s().calibration).toEqual({ a: { x: 0, y: 0 }, b: null });
    s().addCalibrationPoint({ x: 100, y: 0 });
    expect(s().calibration.b).toEqual({ x: 100, y: 0 });
    s().addCalibrationPoint({ x: 5, y: 5 });
    expect(s().calibration).toEqual({ a: { x: 5, y: 5 }, b: null });
    s().clearCalibration();
    expect(s().calibration).toEqual({ a: null, b: null });
  });

  it('cambiar de herramienta o cerrar el panel cancela la calibración', () => {
    const ui = createUiStore();
    const s = () => ui.getState();
    s().setBackgroundPanel(true);
    s().setTool('calibrate');
    s().addCalibrationPoint({ x: 1, y: 1 });
    s().setBackgroundPanel(false);
    expect(s().tool).toBe('select');
    expect(s().calibration.a).toBeNull();

    s().setTool('calibrate');
    s().addCalibrationPoint({ x: 1, y: 1 });
    s().setTool('wall');
    expect(s().calibration.a).toBeNull();

    // Cerrar el panel con otra herramienta activa no la cambia.
    s().setBackgroundPanel(true);
    s().setBackgroundPanel(false);
    expect(s().tool).toBe('wall');
  });

  it('reset vuelve a mostrar el fondo y cierra el panel', () => {
    const ui = createUiStore();
    ui.getState().setShowBackground(false);
    ui.getState().setBackgroundPanel(true);
    ui.getState().reset('L0');
    expect(ui.getState().showBackground).toBe(true);
    expect(ui.getState().backgroundPanel).toBe(false);
    expect(ui.getState().levelId).toBe('L0');
  });
});
