import { wallLength } from '../geometry/walls';
import type { Item, Level } from '../model/project';
import { projectStore } from '../store/projectStore';
import { uiStore, type Selection } from '../store/uiStore';
import { formatNumber, t, type MessageKey } from '../ui/i18n';
import { NumberField } from './NumberField';
import type { RuleWarning } from '../rules';
import { WarningsList } from './WarningsList';

const WALL_KINDS = ['tabique', 'fachada', 'carga'] as const;
const OPENING_KINDS = ['puerta', 'ventana', 'balconera', 'hueco'] as const;
const FIXTURE_KINDS = ['radiador', 'toma_tv', 'enchufe', 'punto_luz', 'columna', 'espejo'] as const;
const STATUSES = ['tengo', 'candidato', 'descartado'] as const;

export function PropertiesPanel({
  level,
  items,
  inherited,
  variantId,
  selection,
  warnings = [],
}: {
  level: Level;
  items: Item[];
  inherited: ReadonlySet<string>;
  variantId: string;
  selection: Selection;
  warnings?: readonly RuleWarning[];
}) {
  const store = projectStore.getState();
  const itemIds = new Set(items.map((i) => i.id));
  const help = (
    <aside className="props props--help">
      <WarningsList warnings={warnings} level={level} variantId={variantId} itemIds={itemIds} />
      <Help />
    </aside>
  );

  if (selection?.kind === 'wall') {
    const w = level.walls.find((x) => x.id === selection.id);
    if (!w) return help;
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

  if (selection?.kind === 'opening') {
    const o = level.openings.find((x) => x.id === selection.id);
    const w = o && level.walls.find((x) => x.id === o.wallId);
    if (!o || !w) return help;
    const edit = (patch: Parameters<typeof store.updateOpening>[2]) =>
      store.updateOpening(level.id, o.id, patch);
    const isDoor = o.kind === 'puerta' || o.kind === 'balconera';
    return (
      <aside className="props" aria-label={t('props.opening')}>
        <h2>{t(`openingKind.${o.kind}` as MessageKey)}</h2>
        <label className="field">
          <span>{t('props.kind')}</span>
          <select
            value={o.kind}
            onChange={(e) => edit({ kind: e.target.value as (typeof OPENING_KINDS)[number] })}
          >
            {OPENING_KINDS.map((k) => (
              <option key={k} value={k}>
                {t(`openingKind.${k}` as MessageKey)}
              </option>
            ))}
          </select>
        </label>
        <div className="field-row">
          <NumberField
            label={t('props.width')}
            unit="cm"
            min={20}
            value={o.width}
            onCommit={(n) => edit({ width: n })}
          />
          <NumberField
            label={t('props.offset')}
            unit="cm"
            min={0}
            value={o.offset}
            onCommit={(n) => edit({ offset: n })}
          />
        </div>
        <div className="field-row">
          <NumberField
            label={t('props.h')}
            unit="cm"
            min={20}
            value={o.height}
            onCommit={(n) => edit({ height: n })}
          />
          {o.kind !== 'puerta' && (
            <NumberField
              label={t('props.sill')}
              unit="cm"
              min={0}
              value={o.sill ?? 0}
              onCommit={(n) => edit({ sill: n })}
            />
          )}
        </div>
        {isDoor && (
          <div className="field-row">
            <label className="field">
              <span>{t('props.hinge')}</span>
              <select
                value={o.hinge ?? 'izq'}
                onChange={(e) => edit({ hinge: e.target.value as 'izq' | 'der' })}
              >
                <option value="izq">{t('hinge.izq')}</option>
                <option value="der">{t('hinge.der')}</option>
              </select>
            </label>
            <label className="field">
              <span>{t('props.swing')}</span>
              <select
                value={o.swing ?? 'dentro'}
                onChange={(e) =>
                  edit({ swing: e.target.value as 'dentro' | 'fuera' | 'corredera' })
                }
              >
                <option value="dentro">{t('swing.dentro')}</option>
                <option value="fuera">{t('swing.fuera')}</option>
                <option value="corredera">{t('swing.corredera')}</option>
              </select>
            </label>
          </div>
        )}
        <p className="props__meta">{t('props.onWall', { len: formatNumber(wallLength(w), 1) })}</p>
        <p className="props__tip">{t('props.openingTip')}</p>
        <button
          type="button"
          className="danger"
          onClick={() => {
            store.deleteOpening(level.id, o.id);
            uiStore.getState().select(null);
          }}
        >
          {t('props.delete')}
        </button>
      </aside>
    );
  }

  if (selection?.kind === 'fixture') {
    const f = level.fixtures.find((x) => x.id === selection.id);
    if (!f) return help;
    const edit = (patch: Parameters<typeof store.updateFixture>[2]) =>
      store.updateFixture(level.id, f.id, patch);
    return (
      <aside className="props" aria-label={t('props.fixture')}>
        <h2>{t(`fixtureKind.${f.kind}` as MessageKey)}</h2>
        <label className="field">
          <span>{t('props.kind')}</span>
          <select
            value={f.kind}
            onChange={(e) => edit({ kind: e.target.value as (typeof FIXTURE_KINDS)[number] })}
          >
            {FIXTURE_KINDS.map((k) => (
              <option key={k} value={k}>
                {t(`fixtureKind.${k}` as MessageKey)}
              </option>
            ))}
          </select>
        </label>
        <div className="field-row">
          <NumberField label="X" unit="cm" value={f.x} onCommit={(n) => edit({ x: n })} />
          <NumberField label="Y" unit="cm" value={f.y} onCommit={(n) => edit({ y: n })} />
        </div>
        <div className="field-row field-row--3">
          <NumberField
            label={t('props.w')}
            unit="cm"
            min={1}
            value={f.w}
            onCommit={(n) => edit({ w: n })}
          />
          <NumberField
            label={t('props.d')}
            unit="cm"
            min={1}
            value={f.d}
            onCommit={(n) => edit({ d: n })}
          />
          <NumberField
            label={t('props.h')}
            unit="cm"
            min={1}
            value={f.h}
            onCommit={(n) => edit({ h: n })}
          />
        </div>
        <NumberField
          label={t('props.z')}
          unit="cm"
          min={0}
          value={f.z ?? 0}
          onCommit={(n) => edit({ z: n })}
        />
        <p className="props__tip">{t('props.fixtureTip')}</p>
        <button
          type="button"
          className="danger"
          onClick={() => {
            store.deleteFixture(level.id, f.id);
            uiStore.getState().select(null);
          }}
        >
          {t('props.delete')}
        </button>
      </aside>
    );
  }

  if (selection?.kind === 'item') {
    const it = items.find((x) => x.id === selection.id);
    if (!it) return help;
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
        <WarningsList
          compact
          warnings={warnings.filter((w) => w.objects.includes(it.id))}
          level={level}
          variantId={variantId}
          itemIds={itemIds}
        />
        <p className="props__tip">{t('props.itemTip')}</p>
        <div className="field-row props__actions">
          <button
            type="button"
            onClick={() =>
              uiStore.getState().select({
                kind: 'item',
                variantId,
                id: store.duplicateItem(variantId, it.id),
              })
            }
            title="Ctrl+D"
          >
            {t('props.duplicate')}
          </button>
          <button
            type="button"
            className="danger"
            onClick={() => {
              store.removeItem(variantId, it.id);
              uiStore.getState().select(null);
            }}
            title={t('props.removeTip')}
          >
            {t('props.remove')}
          </button>
        </div>
      </aside>
    );
  }

  return help;
}

function Help() {
  return (
    <div className="help">
      <h2>{t('props.helpTitle')}</h2>
      <ul>
        <li>{t('help.select')}</li>
        <li>{t('help.vertex')}</li>
        <li>{t('help.wall')}</li>
        <li>{t('help.openings')}</li>
        <li>{t('help.items')}</li>
        <li>{t('help.pan')}</li>
        <li>{t('help.undo')}</li>
      </ul>
    </div>
  );
}
