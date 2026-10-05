import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { areaM2 } from '../../geometry/polygon';
import type { Item, Project } from '../../model/project';
import { BASE_VARIANT_ID } from '../../model/project';
import { resolveVariantItems } from '../../model/variants';
import { projectStore } from '../../store/projectStore';
import { formatNumber, t } from '../i18n';

const cm = (n: number) => formatNumber(n, 1);

export function ProjectView({ project }: { project: Project }) {
  const active = project.variants.find((v) => v.id === project.activeVariantId);
  const items = useMemo(() => resolveVariantItems(project, project.activeVariantId), [project]);
  const baseIds = useMemo(
    () => new Set(project.variants[0]?.items.map((i) => i.id) ?? []),
    [project],
  );
  const ownIds = useMemo(() => new Set(active?.items.map((i) => i.id) ?? []), [active]);

  return (
    <div className="project">
      <aside className="sidebar">
        <ProjectName key={project.name} name={project.name} />

        <section className="card">
          <h2>{t('project.levels')}</h2>
          {project.levels.map((l) => {
            const area = l.rooms.reduce((s, r) => s + areaM2(r.polygon), 0);
            return (
              <div key={l.id} className="level">
                <div className="level__head">
                  <strong>{l.name}</strong>
                  <span className="num">{t('project.area', { area: formatNumber(area) })}</span>
                </div>
                <div className="level__meta">
                  <span>{t('project.walls', { n: l.walls.length })}</span>
                  <span>{t('project.openings', { n: l.openings.length })}</span>
                  <span>{t('project.fixtures', { n: l.fixtures.length })}</span>
                  <span>{t('project.ceiling', { h: l.ceilingHeight })}</span>
                </div>
              </div>
            );
          })}
        </section>

        <section className="card">
          <h2>{t('project.variants')}</h2>
          <ul className="variants" role="listbox" aria-label={t('project.variants')}>
            {project.variants.map((v) => {
              const selected = v.id === project.activeVariantId;
              return (
                <li key={v.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={selected ? 'variant variant--active' : 'variant'}
                    onClick={() => projectStore.getState().setActiveVariant(v.id)}
                  >
                    <span className="variant__name">
                      {v.id === BASE_VARIANT_ID ? t('variant.base') : v.name}
                    </span>
                    <span className="variant__meta">
                      {t('variant.items', { n: v.items.length })}
                      {v.score !== undefined && <Score n={v.score} />}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <p className="sidebar__foot">{t('project.catalog', { n: project.catalog.length })}</p>
      </aside>

      <section className="content">
        <header className="content__head">
          <h1>{t('items.title', { variant: active?.name ?? project.activeVariantId })}</h1>
          {active?.notes && <p className="notes">{active.notes}</p>}
        </header>
        <table className="items">
          <thead>
            <tr>
              <th>{t('items.name')}</th>
              <th className="num">{t('items.size')}</th>
              <th className="num">{t('items.position')}</th>
              <th className="num">{t('items.rotation')}</th>
              <th>{t('items.status')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <ItemRow
                key={it.id}
                item={it}
                inherited={
                  baseIds.has(it.id) && !ownIds.has(it.id) && active?.id !== BASE_VARIANT_ID
                }
              />
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function ItemRow({ item, inherited }: { item: Item; inherited: boolean }) {
  return (
    <tr className={inherited ? 'items__row--inherited' : undefined}>
      <td>
        <span className="swatch" style={{ background: item.color ?? 'var(--line)' }} aria-hidden />
        {item.name}
        {inherited && <span className="tag">{t('items.inherited')}</span>}
        {item.seasonal && <span className="tag tag--season">{t('items.seasonal')}</span>}
      </td>
      <td className="num">
        {cm(item.w)} × {cm(item.d)} × {cm(item.h)}
      </td>
      <td className="num">
        {cm(item.x)}, {cm(item.y)}
      </td>
      <td className="num">{item.rotation}°</td>
      <td>
        <span className={`pill pill--${item.status}`}>{t(`status.${item.status}`)}</span>
      </td>
    </tr>
  );
}

function Score({ n }: { n: number }) {
  return (
    <span
      className="score"
      aria-label={t('variant.score', { n })}
      title={t('variant.score', { n })}
    >
      {'●'.repeat(n)}
      <span className="score__off">{'●'.repeat(5 - n)}</span>
    </span>
  );
}

/** Nombre editable: se confirma con Intro o al salir del campo (un paso de deshacer). */
function ProjectName({ name }: { name: string }) {
  const [value, setValue] = useState(name);
  const cancelled = useRef(false);
  const commit = () => {
    const clean = value.trim();
    if (!cancelled.current && clean && clean !== name) projectStore.getState().renameProject(clean);
    else setValue(name);
    cancelled.current = false;
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') cancelled.current = true;
    if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur();
  };
  return (
    <label className="project-name">
      <span>{t('project.name')}</span>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={onKey}
        maxLength={200}
      />
    </label>
  );
}
