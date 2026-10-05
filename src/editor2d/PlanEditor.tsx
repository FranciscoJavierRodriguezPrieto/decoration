import { useEffect, useMemo } from 'react';
import { GRID_STEPS } from '../geometry/snap';
import type { Level, Project } from '../model/project';
import { BASE_VARIANT_ID } from '../model/project';
import { resolveVariantItems } from '../model/variants';
import { useUi } from '../store/hooks';
import { projectStore } from '../store/projectStore';
import { uiStore, type Tool } from '../store/uiStore';
import { t } from '../ui/i18n';
import { PlanCanvas } from './PlanCanvas';
import { PropertiesPanel } from './PropertiesPanel';

const TOOLS: { id: Tool; key: string; label: 'tool.select' | 'tool.wall' }[] = [
  { id: 'select', key: 'V', label: 'tool.select' },
  { id: 'wall', key: 'W', label: 'tool.wall' },
];

export function PlanEditor({ project, level }: { project: Project; level: Level }) {
  const tool = useUi((s) => s.tool);
  const grid = useUi((s) => s.grid);
  const selection = useUi((s) => s.selection);
  const variantId = project.activeVariantId;

  const items = useMemo(() => resolveVariantItems(project, variantId), [project, variantId]);
  const inherited = useMemo(() => {
    if (variantId === BASE_VARIANT_ID) return new Set<string>();
    const own = new Set(project.variants.find((v) => v.id === variantId)?.items.map((i) => i.id));
    return new Set(items.filter((i) => !own.has(i.id)).map((i) => i.id));
  }, [project, variantId, items]);

  // Atajos del editor (ESPECIFICACION §4.2).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const ui = uiStore.getState();
      const sel = ui.selection;
      const k = e.key.toLowerCase();
      if (k === 'v') ui.setTool('select');
      else if (k === 'w') ui.setTool('wall');
      else if (k === 'f') window.dispatchEvent(new Event('planocasa:fit'));
      else if (k === 'escape') ui.select(null);
      else if ((e.key === 'Delete' || e.key === 'Backspace') && sel?.kind === 'wall') {
        projectStore.getState().deleteWall(sel.levelId, sel.id);
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
          className="tool"
          onClick={() => window.dispatchEvent(new Event('planocasa:fit'))}
          title={`${t('tool.fit')} (F)`}
        >
          {t('tool.fit')} <kbd>F</kbd>
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
        {tool === 'wall' && <span className="plan__hint">{t('tool.wallHint')}</span>}
      </div>
      <div className="plan__body">
        <PlanCanvas
          level={level}
          variantId={variantId}
          items={items}
          inherited={inherited}
          fitKey={`${project.id}/${level.id}`}
        />
        <PropertiesPanel
          level={level}
          items={items}
          inherited={inherited}
          variantId={variantId}
          selection={selection}
        />
      </div>
    </div>
  );
}
