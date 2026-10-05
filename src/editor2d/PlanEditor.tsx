import { useEffect, useMemo } from 'react';
import { AddItemPanel } from '../catalog/AddItemPanel';
import { GRID_STEPS } from '../geometry/snap';
import { levelBounds } from '../geometry/walls';
import type { Level, Project } from '../model/project';
import { BASE_VARIANT_ID } from '../model/project';
import { resolveVariantItems } from '../model/variants';
import { useUi } from '../store/hooks';
import { projectStore } from '../store/projectStore';
import { uiStore, type Tool } from '../store/uiStore';
import { t, type MessageKey } from '../ui/i18n';
import { PlanCanvas } from './PlanCanvas';
import { PropertiesPanel } from './PropertiesPanel';
import { countBySeverity, evaluateRules } from '../rules';

const TOOLS: { id: Tool; key: string; label: MessageKey }[] = [
  { id: 'select', key: 'V', label: 'tool.select' },
  { id: 'wall', key: 'W', label: 'tool.wall' },
  { id: 'door', key: 'D', label: 'tool.door' },
  { id: 'window', key: 'N', label: 'tool.window' },
  { id: 'radiator', key: 'F', label: 'tool.radiator' },
];

const TOOL_KEYS: Record<string, Tool> = {
  v: 'select',
  w: 'wall',
  d: 'door',
  n: 'window',
  f: 'radiator',
};

const HINTS: Partial<Record<Tool, MessageKey>> = {
  wall: 'tool.wallHint',
  door: 'tool.placeHint',
  window: 'tool.placeHint',
  radiator: 'tool.placeHint',
};

export function PlanEditor({ project, level }: { project: Project; level: Level }) {
  const tool = useUi((s) => s.tool);
  const grid = useUi((s) => s.grid);
  const selection = useUi((s) => s.selection);
  const message = useUi((s) => s.message);
  const adding = useUi((s) => s.adding);
  const showWarnings = useUi((s) => s.showWarnings);
  const includeSeasonal = useUi((s) => s.includeSeasonal);
  const checkExtended = useUi((s) => s.checkExtended);
  const hint = HINTS[tool];

  // Los avisos se borran solos a los 3 s.
  useEffect(() => {
    if (!message) return;
    const id = window.setTimeout(() => uiStore.getState().flash(null), 3000);
    return () => window.clearTimeout(id);
  }, [message]);
  const variantId = project.activeVariantId;

  const items = useMemo(() => resolveVariantItems(project, variantId), [project, variantId]);
  const inherited = useMemo(() => {
    if (variantId === BASE_VARIANT_ID) return new Set<string>();
    const own = new Set(project.variants.find((v) => v.id === variantId)?.items.map((i) => i.id));
    return new Set(items.filter((i) => !own.has(i.id)).map((i) => i.id));
  }, [project, variantId, items]);

  // Motor de reglas: se recalcula al cambiar el nivel, los muebles o las opciones.
  const warnings = useMemo(
    () => evaluateRules(level, items, { includeSeasonal, checkExtended }),
    [level, items, includeSeasonal, checkExtended],
  );
  const counts = countBySeverity(warnings);

  const fallbackCenter = useMemo(() => {
    const b = levelBounds(level);
    if (!b) return { x: 200, y: 200 };
    return { x: Math.round((b.minX + b.maxX) / 2), y: Math.round((b.minY + b.maxY) / 2) };
  }, [level]);

  // Atajos del editor (ESPECIFICACION §4.2).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return;
      const ui = uiStore.getState();
      const sel = ui.selection;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd' && sel?.kind === 'item') {
        e.preventDefault();
        const id = projectStore.getState().duplicateItem(sel.variantId, sel.id);
        ui.select({ kind: 'item', variantId: sel.variantId, id });
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      const toolKey = TOOL_KEYS[k];
      if (toolKey) ui.setTool(toolKey);
      else if (k === '0') window.dispatchEvent(new Event('planocasa:fit'));
      else if (k === 'm') ui.setAdding(!ui.adding);
      else if (k === 'escape') {
        if (ui.adding) ui.setAdding(false);
        else if (ui.tool !== 'select') ui.setTool('select');
        else ui.select(null);
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && sel) {
        const store = projectStore.getState();
        if (sel.kind === 'wall') store.deleteWall(sel.levelId, sel.id);
        else if (sel.kind === 'opening') store.deleteOpening(sel.levelId, sel.id);
        else if (sel.kind === 'fixture') store.deleteFixture(sel.levelId, sel.id);
        else store.removeItem(sel.variantId, sel.id);
        ui.select(null);
      } else if (k === 'r' && sel?.kind === 'item') {
        const it = items.find((i) => i.id === sel.id);
        if (it) {
          const step = e.shiftKey ? 15 : 90;
          projectStore
            .getState()
            .editItemInVariant(sel.variantId, it.id, { rotation: (it.rotation + step) % 360 });
        }
      } else if (e.key.startsWith('Arrow') && sel?.kind === 'item') {
        const it = items.find((i) => i.id === sel.id);
        if (!it) return;
        e.preventDefault();
        const s = e.shiftKey ? 10 : 1;
        const dx = e.key === 'ArrowLeft' ? -s : e.key === 'ArrowRight' ? s : 0;
        const dy = e.key === 'ArrowUp' ? -s : e.key === 'ArrowDown' ? s : 0;
        projectStore
          .getState()
          .editItemInVariant(sel.variantId, it.id, { x: it.x + dx, y: it.y + dy });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [items]);

  return (
    <div className="plan">
      <div className="plan__tools" role="toolbar" aria-label={t('tool.title')}>
        {TOOLS.map((tl) => (
          <button
            key={tl.id}
            type="button"
            aria-pressed={tool === tl.id}
            className={tool === tl.id ? 'tool tool--on' : 'tool'}
            onClick={() => uiStore.getState().setTool(tl.id)}
            title={`${t(tl.label)} (${tl.key})`}
          >
            {t(tl.label)} <kbd>{tl.key}</kbd>
          </button>
        ))}
        <span className="plan__sep" aria-hidden />
        <button
          type="button"
          aria-pressed={adding}
          className={adding ? 'tool tool--on' : 'tool'}
          onClick={() => uiStore.getState().setAdding(!adding)}
          title={`${t('tool.addItem')} (M)`}
        >
          {t('tool.addItem')} <kbd>M</kbd>
        </button>
        <span className="plan__sep" aria-hidden />
        <button
          type="button"
          className="tool"
          onClick={() => window.dispatchEvent(new Event('planocasa:fit'))}
          title={`${t('tool.fit')} (0)`}
        >
          {t('tool.fit')} <kbd>0</kbd>
        </button>
        <label className="plan__grid">
          {t('tool.grid')}
          <select value={grid} onChange={(e) => uiStore.getState().setGrid(Number(e.target.value))}>
            {GRID_STEPS.map((g) => (
              <option key={g} value={g}>
                {g} cm
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className={`tool warnings-badge${counts.error ? ' warnings-badge--error' : counts.aviso ? ' warnings-badge--aviso' : ''}`}
          aria-pressed={showWarnings}
          onClick={() => uiStore.getState().setRuleFlags({ showWarnings: !showWarnings })}
          title={t('warnings.show')}
        >
          {t('warnings.count', { e: counts.error, a: counts.aviso })}
        </button>
        {hint && <span className="plan__hint">{t(hint)}</span>}
      </div>
      {message && (
        <div className="plan__toast" role="alert">
          {message}
        </div>
      )}
      <div className="plan__body">
        <PlanCanvas
          level={level}
          variantId={variantId}
          items={items}
          inherited={inherited}
          fitKey={`${project.id}/${level.id}`}
          warnings={showWarnings ? warnings : []}
        />
        {adding ? (
          <AddItemPanel variantId={variantId} fallbackCenter={fallbackCenter} />
        ) : (
          <PropertiesPanel
            level={level}
            items={items}
            inherited={inherited}
            variantId={variantId}
            selection={selection}
            warnings={warnings}
          />
        )}
      </div>
    </div>
  );
}
