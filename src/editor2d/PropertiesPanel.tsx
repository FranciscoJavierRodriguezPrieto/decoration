import { wallLength } from '../geometry/walls';
import type { Item, Level } from '../model/project';
import { projectStore } from '../store/projectStore';
import { uiStore, type Selection } from '../store/uiStore';
import { formatNumber, t, type MessageKey } from '../ui/i18n';
import { NumberField } from './NumberField';

const WALL_KINDS = ['tabique', 'fachada', 'carga'] as const;
const STATUSES = ['tengo', 'candidato', 'descartado'] as const;

export function PropertiesPanel({
  level,
  items,
  inherited,
  variantId,
  selection,
}: {
  level: Level;
  items: Item[];
  inherited: ReadonlySet<string>;
  variantId: string;
  selection: Selection;
}) {
  const store = projectStore.getState();

  if (selection?.kind === 'wall') {
    const w = level.walls.find((x) => x.id === selection.id);
    if (!w) return <Help />;
    const openings = level.openings.filter((o) => o.wallId === w.id).length;
    return (
      <aside className="props" aria-label={t('props.wall')}>
        <h2>{t('props.wall')}</h2>
        <NumberField
          label={t('props.length')}
          unit="cm"
          min={1}
          value={Math.round(wallLength(w) * 10) / 10}
          onCommit={(n) => store.setWallLength(level.id, w.id, n)}
        />
        <NumberField
          label={t('props.thickness')}
          unit="cm"
          min={1}
          value={w.thickness}
          onCommit={(n) => store.updateWall(level.id, w.id, { thickness: n })}
        />
        <label className="field">
          <span>{t('props.kind')}</span>
          <select
            value={w.kind}
            onChange={(e) =>
              store.updateWall(level.id, w.id, {
                kind: e.target.value as (typeof WALL_KINDS)[number],
              })
            }
          >
            {WALL_KINDS.map((k) => (
              <option key={k} value={k}>
                {t(`wallKind.${k}` as MessageKey)}
              </option>
            ))}
          </select>
        </label>
        <p className="props__meta">
          {t('props.from', { x: formatNumber(w.a.x, 1), y: formatNumber(w.a.y, 1) })}
          <br />
          {t('props.to', { x: formatNumber(w.b.x, 1), y: formatNumber(w.b.y, 1) })}
          {openings > 0 && (
            <>
              <br />
              {t('props.openingsOnWall', { n: openings })}
            </>
          )}
        </p>
        <p className="props__tip">{t('props.wallTip')}</p>
        <button
          type="button"
          className="danger"
          onClick={() => {
            store.deleteWall(level.id, w.id);
            uiStore.getState().select(null);
          }}
        >
          {t('props.deleteWall')}
        </button>
      </aside>
    );
  }

  if (selection?.kind === 'item') {
    const it = items.find((x) => x.id === selection.id);
    if (!it) return <Help />;
    const edit = (patch: Parameters<typeof store.editItemInVariant>[2]) =>
      store.editItemInVariant(variantId, it.id, patch);
    const rot = (delta: number) => edit({ rotation: (((it.rotation + delta) % 360) + 360) % 360 });
    return (
      <aside className="props" aria-label={t('props.item')}>
        <h2>{it.name}</h2>
        {inherited.has(it.id) && <p className="props__note">{t('props.inheritedNote')}</p>}
        <div className="field-row">
          <NumberField label="X" unit="cm" value={it.x} onCommit={(n) => edit({ x: n })} />
          <NumberField label="Y" unit="cm" value={it.y} onCommit={(n) => edit({ y: n })} />
        </div>
        <div className="field-row field-row--rot">
          <NumberField
            label={t('props.rotation')}
            unit="°"
            min={0}
            value={it.rotation}
            onCommit={(n) => edit({ rotation: ((n % 360) + 360) % 360 })}
          />
          <button type="button" onClick={() => rot(-90)} title={t('props.rotateLeft')}>
            ↺
          </button>
          <button type="button" onClick={() => rot(90)} title={t('props.rotateRight')}>
            ↻
          </button>
        </div>
        <div className="field-row field-row--3">
          <NumberField
            label={t('props.w')}
            unit="cm"
            min={1}
            value={it.w}
            onCommit={(n) => edit({ w: n })}
          />
          <NumberField
            label={t('props.d')}
            unit="cm"
            min={1}
            value={it.d}
            onCommit={(n) => edit({ d: n })}
          />
          <NumberField
            label={t('props.h')}
            unit="cm"
            min={1}
            value={it.h}
            onCommit={(n) => edit({ h: n })}
          />
        </div>
        <label className="field">
          <span>{t('items.status')}</span>
          <select
            value={it.status}
            onChange={(e) => edit({ status: e.target.value as (typeof STATUSES)[number] })}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`status.${s}`)}
              </option>
            ))}
          </select>
        </label>
        <p className="props__tip">{t('props.itemTip')}</p>
      </aside>
    );
  }

  return <Help />;
}

function Help() {
  return (
    <aside className="props props--help">
      <h2>{t('props.helpTitle')}</h2>
      <ul>
        <li>{t('help.select')}</li>
        <li>{t('help.vertex')}</li>
        <li>{t('help.wall')}</li>
        <li>{t('help.pan')}</li>
        <li>{t('help.undo')}</li>
      </ul>
    </aside>
  );
}
