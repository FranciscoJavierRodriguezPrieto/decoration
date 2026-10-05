import { useMemo, useState } from 'react';
import { projectStore } from '../store/projectStore';
import { uiStore } from '../store/uiStore';
import { formatNumber, t, type MessageKey } from '../ui/i18n';
import { GENERIC_CATALOG, GROUP_ORDER, searchCatalog, type GenericItem } from './generic';
import { parseDimensions } from './parseDimensions';

const CATEGORIES = [
  'sofa',
  'mesa',
  'silla',
  'cama',
  'armario',
  'mueble_bajo',
  'estanteria',
  'tv',
  'electrodomestico',
  'planta',
  'alfombra',
  'mascota',
  'otro',
] as const;

const cm = (n: number) => formatNumber(n, 1);

/** Panel lateral para añadir muebles del catálogo genérico o con medidas propias. */
export function AddItemPanel({
  variantId,
  fallbackCenter,
}: {
  variantId: string;
  fallbackCenter: { x: number; y: number };
}) {
  const [query, setQuery] = useState('');
  const [name, setName] = useState('');
  const [dims, setDims] = useState('');
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('sofa');
  const [status, setStatus] = useState<'tengo' | 'candidato'>('tengo');
  const parsed = useMemo(() => parseDimensions(dims), [dims]);
  const results = useMemo(() => searchCatalog(query), [query]);

  const place = (item: Parameters<ReturnType<typeof projectStore.getState>['addItem']>[1]) => {
    try {
      const id = projectStore.getState().addItem(variantId, item);
      uiStore.getState().select({ kind: 'item', variantId, id });
    } catch (e) {
      uiStore.getState().flash(e instanceof Error ? e.message : String(e));
    }
  };
  const center = () => uiStore.getState().viewCenter ?? fallbackCenter;

  const addGeneric = (g: GenericItem) => {
    const c = center();
    place({
      name: g.name,
      category: g.category,
      x: c.x,
      y: c.y,
      w: g.w,
      d: g.d,
      h: g.h,
      rotation: 0,
      color: g.color,
      status: 'candidato',
      params: { template: g.template, ...(g.params ?? {}) },
      ...(g.extended ? { extended: g.extended } : {}),
    });
  };

  const addCustom = () => {
    if (!parsed || !name.trim()) return;
    const c = center();
    place({
      name: name.trim(),
      category,
      x: c.x,
      y: c.y,
      w: parsed.w,
      d: parsed.d,
      h: parsed.h ?? 80,
      rotation: 0,
      status,
    });
    setName('');
    setDims('');
  };

  return (
    <aside className="props add-item" aria-label={t('add.title')}>
      <div className="add-item__head">
        <h2>{t('add.title')}</h2>
        <button type="button" onClick={() => uiStore.getState().setAdding(false)}>
          {t('add.close')}
        </button>
      </div>

      <section className="add-item__custom">
        <h3>{t('add.custom')}</h3>
        <label className="field">
          <span>{t('add.name')}</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('add.namePh')}
          />
        </label>
        <label className="field">
          <span>{t('add.dims')}</span>
          <input
            value={dims}
            onChange={(e) => setDims(e.target.value)}
            placeholder="165 x 95 x 78"
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') addCustom();
            }}
          />
        </label>
        {dims && (
          <p className={parsed ? 'add-item__parsed' : 'add-item__parsed add-item__parsed--bad'}>
            {parsed
              ? t('add.parsed', {
                  w: cm(parsed.w),
                  d: cm(parsed.d),
                  h: parsed.h !== undefined ? cm(parsed.h) : '80',
                })
              : t('add.unparsed')}
          </p>
        )}
        {parsed?.warnings.map((w) => (
          <p key={w} className="add-item__warn">
            {w}
          </p>
        ))}
        <div className="field-row">
          <label className="field">
            <span>{t('add.category')}</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as typeof category)}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`category.${c}` as MessageKey)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{t('items.status')}</span>
            <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
              <option value="tengo">{t('status.tengo')}</option>
              <option value="candidato">{t('status.candidato')}</option>
            </select>
          </label>
        </div>
        <button
          type="button"
          className="primary"
          disabled={!parsed || !name.trim()}
          onClick={addCustom}
        >
          {t('add.addCustom')}
        </button>
      </section>

      <section className="add-item__catalog">
        <h3>{t('add.generic')}</h3>
        <input
          className="add-item__search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
          placeholder={t('add.search')}
          aria-label={t('add.search')}
        />
        {GROUP_ORDER.map((g) => {
          const list = results.filter((i) => i.group === g);
          if (list.length === 0) return null;
          return (
            <div key={g} className="add-item__group">
              <h4>{t(`group.${g}` as MessageKey)}</h4>
              <ul>
                {list.map((i) => (
                  <li key={i.key}>
                    <button type="button" onClick={() => addGeneric(i)}>
                      <span className="swatch" style={{ background: i.color }} aria-hidden />
                      <span className="add-item__name">{i.name}</span>
                      <span className="add-item__size">
                        {cm(i.w)} × {cm(i.d)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
        {results.length === 0 && <p className="props__meta">{t('add.none')}</p>}
        <p className="props__meta">{t('add.count', { n: GENERIC_CATALOG.length })}</p>
      </section>
    </aside>
  );
}
