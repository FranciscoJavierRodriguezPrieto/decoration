/**
 * Motor de reglas ergonómicas (ESPECIFICACION §7). Puro: recibe el nivel y
 * los muebles resueltos de una distribución y devuelve los avisos ordenados
 * (errores primero).
 */
import type { Item, Level } from '../model/project';
import { t } from '../ui/i18n';
import { buildContext } from './context';
import {
  collisions,
  dining,
  doorSweeps,
  radiators,
  sofaTable,
  tv,
  clearanceZones,
  windows,
} from './local';
import { passages } from './passage';
import { DEFAULT_RULE_OPTIONS, type RuleOptions, type RuleWarning, type Severity } from './types';

export type { RuleOptions, RuleWarning, Severity } from './types';
export { DEFAULT_RULE_OPTIONS } from './types';

const ORDER: Record<Severity, number> = { error: 0, aviso: 1, info: 2 };

export function evaluateRules(
  level: Level,
  items: readonly Item[],
  options: Partial<RuleOptions> = {},
): RuleWarning[] {
  const ctx = buildContext(level, items, { ...DEFAULT_RULE_OPTIONS, ...options });
  const normal = [
    ...collisions(ctx),
    ...doorSweeps(ctx),
    ...clearanceZones(ctx),
    ...radiators(ctx),
    ...windows(ctx),
    ...tv(ctx),
    ...dining(ctx),
    ...sofaTable(ctx),
    ...passages(ctx),
  ];
  const extra: RuleWarning[] = [];
  if (ctx.options.checkExtended && ctx.items.some((s) => s.ext)) {
    // Regla 8: lo mismo con la huella extendida; solo lo que sea nuevo, como aviso.
    const seen = new Set(normal.map((w) => w.key));
    const names = new Map(ctx.items.map((s) => [s.item.id, s.item.name]));
    for (const w of [...collisions(ctx, true), ...doorSweeps(ctx, true), ...passages(ctx, true)]) {
      if (seen.has(w.key)) continue;
      const who = w.objects.find((id) => ctx.items.some((s) => s.item.id === id && s.ext));
      extra.push({
        ...w,
        key: `ext:${w.key}`,
        severity: w.severity === 'info' ? 'info' : 'aviso',
        extended: true,
        message: who
          ? t('rule.extended', { name: names.get(who) ?? who, msg: w.message })
          : w.message,
      });
    }
  }
  return [...normal, ...extra].sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);
}

export function countBySeverity(ws: readonly RuleWarning[]): Record<Severity, number> {
  const out: Record<Severity, number> = { error: 0, aviso: 0, info: 0 };
  for (const w of ws) out[w.severity]++;
  return out;
}
