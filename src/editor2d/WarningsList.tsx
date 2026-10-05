import type { Level } from '../model/project';
import type { RuleWarning } from '../rules';
import { useUi } from '../store/hooks';
import { uiStore, type Selection } from '../store/uiStore';
import { t } from '../ui/i18n';
import { WARN } from './theme';

/** Selección a la que lleva un aviso: el primer mueble implicado, si no un hueco o fijo. */
export function selectionFor(
  w: RuleWarning,
  level: Level,
  variantId: string,
  itemIds: ReadonlySet<string>,
): Selection {
  const item = w.objects.find((id) => itemIds.has(id));
  if (item) return { kind: 'item', variantId, id: item };
  const op = w.objects.find((id) => level.openings.some((o) => o.id === id));
  if (op) return { kind: 'opening', levelId: level.id, id: op };
  const fx = w.objects.find((id) => level.fixtures.some((f) => f.id === id));
  if (fx) return { kind: 'fixture', levelId: level.id, id: fx };
  return null;
}

/** Lista de avisos del motor de reglas (ESPECIFICACION §7) con sus opciones. */
export function WarningsList({
  warnings,
  level,
  variantId,
  itemIds,
  compact = false,
}: {
  warnings: readonly RuleWarning[];
  level: Level;
  variantId: string;
  itemIds: ReadonlySet<string>;
  /** Solo la lista (en el panel de un mueble), sin cabecera ni opciones. */
  compact?: boolean;
}) {
  const seasonal = useUi((s) => s.includeSeasonal);
  const extended = useUi((s) => s.checkExtended);
  const show = useUi((s) => s.showWarnings);
  const ui = uiStore.getState();
  const errors = warnings.filter((w) => w.severity === 'error').length;
  const avisos = warnings.filter((w) => w.severity === 'aviso').length;

  return (
    <section className="warnings" aria-label={t('warnings.title')}>
      {!compact && (
        <>
          <h2>
            {t('warnings.title')}{' '}
            <span className="warnings__count">{t('warnings.count', { e: errors, a: avisos })}</span>
          </h2>
          <label className="check">
            <input
              type="checkbox"
              checked={show}
              onChange={(e) => ui.setRuleFlags({ showWarnings: e.target.checked })}
            />
            {t('warnings.show')}
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={seasonal}
              onChange={(e) => ui.setRuleFlags({ includeSeasonal: e.target.checked })}
            />
            {t('warnings.seasonal')}
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={extended}
              onChange={(e) => ui.setRuleFlags({ checkExtended: e.target.checked })}
            />
            {t('warnings.extended')}
          </label>
        </>
      )}
      {warnings.length === 0 && !compact && <p className="props__meta">{t('warnings.none')}</p>}
      <ul className="warnings__list">
        {warnings.map((w) => (
          <li key={w.key}>
            <button
              type="button"
              className={`warning warning--${w.severity}`}
              onClick={() => {
                const sel = selectionFor(w, level, variantId, itemIds);
                if (sel) ui.select(sel);
              }}
            >
              <span className="warning__dot" style={{ background: WARN[w.severity] }} aria-hidden />
              <span>
                <strong>{t(`severity.${w.severity}`)}.</strong> {w.message}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
