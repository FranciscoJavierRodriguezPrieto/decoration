/** Tipos del motor de reglas (ESPECIFICACION §7). */
import type { Poly } from '../geometry/footprint';
import type { Vec2 } from '../geometry/vec';

export type Severity = 'error' | 'aviso' | 'info';

export type RuleId =
  'colision' | 'paso' | 'puerta' | 'uso' | 'radiador' | 'ventana' | 'tv' | 'comedor' | 'sofa_mesa';

export interface RuleWarning {
  /** Clave estable (regla + objetos) para listas de React y para deduplicar. */
  key: string;
  rule: RuleId;
  severity: Severity;
  /** Ids de muebles, huecos, fijos o muros implicados (el primero es el principal). */
  objects: string[];
  message: string;
  /** Zonas a resaltar en el plano. */
  areas: Poly[];
  /** Dónde poner la etiqueta. */
  anchor: Vec2;
  /** Aparece solo con la huella extendida (asientos sacados, chaise…). */
  extended?: boolean;
}

export interface RuleOptions {
  /** Incluir muebles de temporada (árbol de Navidad…). Regla 9. */
  includeSeasonal: boolean;
  /** Evaluar también las huellas extendidas. Regla 8. */
  checkExtended: boolean;
}

export const DEFAULT_RULE_OPTIONS: RuleOptions = { includeSeasonal: false, checkExtended: true };
