/** Colores del plano. Konva pinta en canvas y no lee variables CSS: se replican aquí. */
export const PLAN = {
  paper: '#f5f1e8',
  grid: '#e7e0d1',
  room: '#fbf8f1',
  roomStroke: '#d9d1c1',
  roomText: '#7c8687',
  wall: {
    fachada: '#1d2729',
    carga: '#0f1718',
    tabique: '#3f4c4e',
  },
  wallSelected: '#c4623d',
  opening: '#fbf8f1',
  window: '#2e5559',
  door: '#7c8687',
  fixture: {
    radiador: '#d98e73',
    toma_tv: '#2e5559',
    enchufe: '#2e5559',
    punto_luz: '#a8701a',
    columna: '#4a5658',
    espejo: '#8fb3b8',
  },
  itemStroke: '#4a5658',
  itemText: '#1d2729',
  selected: '#c4623d',
  zone: '#a8701a',
  dimension: '#4a5658',
  draft: '#c4623d',
  handle: '#ffffff',
} as const;

export const FONT = "'Segoe UI Variable Text', 'Segoe UI', system-ui, sans-serif";
