/**
 * Panel del plano de fondo: importar un PDF o una imagen, calibrar su escala con una
 * pared conocida, ajustarlo (giro, transparencia, página) y calcar encima.
 * Toda la geometría está en src/import/background.ts; aquí solo hay gestos y textos.
 */
import { useEffect, useState } from 'react';
import { dist, type Vec2 } from '../geometry/vec';
import { levelBounds } from '../geometry/walls';
import {
  backgroundCenter,
  calibrate,
  initialBackground,
  rotateAbout,
  straighten,
  type Background,
} from '../import/background';
import { appGateway } from '../io/fileGateway';
import type { Level } from '../model/project';
import { useUi } from '../store/hooks';
import { projectStore } from '../store/projectStore';
import { uiStore } from '../store/uiStore';
import { formatNumber, t } from '../ui/i18n';
import { NumberField, parseNumber } from './NumberField';
import { loadBackgroundAsset, useBackgroundImage } from './useBackgroundImage';

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function BackgroundPanel({ level }: { level: Level }) {
  const bg = level.background;
  const tool = useUi((s) => s.tool);
  const showBackground = useUi((s) => s.showBackground);
  const calibration = useUi((s) => s.calibration);
  const state = useBackgroundImage(bg);
  const image = state.status === 'ready' ? state.image : null;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onImport = async () => {
    setBusy(true);
    setError(null);
    try {
      const imported = await appGateway().importBackground();
      if (!imported) return;
      const page = imported.kind === 'pdf' ? 1 : undefined;
      const loaded = await loadBackgroundAsset(imported.asset, page);
      projectStore
        .getState()
        .setBackground(
          level.id,
          initialBackground(imported.asset, loaded, levelBounds(level), page),
        );
      const ui = uiStore.getState();
      ui.setShowBackground(true);
      ui.setTool('calibrate');
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };

  const set = (next: Background | null) => {
    try {
      projectStore.getState().setBackground(level.id, next);
    } catch (e) {
      setError(message(e));
    }
  };

  return (
    <aside className="props bg-panel" aria-label={t('bg.title')}>
      <div className="add-item__head">
        <h2>{t('bg.title')}</h2>
        <button type="button" onClick={() => uiStore.getState().setBackgroundPanel(false)}>
          {t('add.close')}
        </button>
      </div>

      {error && (
        <p className="add-item__warn" role="alert">
          {error}
        </p>
      )}

      {!bg ? (
        <>
          <p className="props__meta">{t('bg.intro')}</p>
          <button type="button" className="primary" disabled={busy} onClick={onImport}>
            {busy ? t('bg.loading') : t('bg.import')}
          </button>
          <ol className="bg-panel__steps">
            <li>{t('bg.step1')}</li>
            <li>{t('bg.step2')}</li>
            <li>{t('bg.step3')}</li>
          </ol>
          <p className="props__tip">{t('bg.formats')}</p>
        </>
      ) : (
        <>
          {state.status === 'loading' && <p className="props__meta">{t('bg.loading')}</p>}
          {state.status === 'error' && (
            <p className="add-item__warn">{t('bg.loadError', { error: state.message })}</p>
          )}

          <section className="bg-panel__section">
            <h3>{t('bg.scaleTitle')}</h3>
            {tool === 'calibrate' ? (
              <Calibrator bg={bg} a={calibration.a} b={calibration.b} onApply={set} />
            ) : (
              <>
                <button
                  type="button"
                  className="primary"
                  onClick={() => uiStore.getState().setTool('calibrate')}
                >
                  {t('bg.calibrate')}
                </button>
                <p className="props__tip">{t('bg.calibrateTip')}</p>
              </>
            )}
            {image && (
              <p className="props__meta">
                {t('bg.size', {
                  w: formatNumber((image.width * bg.cmPerPx) / 100, 2),
                  h: formatNumber((image.height * bg.cmPerPx) / 100, 2),
                })}
              </p>
            )}
          </section>

          <section className="bg-panel__section">
            <h3>{t('bg.adjustTitle')}</h3>
            <label className="bg-panel__check">
              <input
                type="checkbox"
                checked={showBackground}
                onChange={(e) => uiStore.getState().setShowBackground(e.target.checked)}
              />
              {t('bg.show')}
            </label>
            <OpacitySlider value={bg.opacity} onCommit={(opacity) => set({ ...bg, opacity })} />
            <div className="field-row">
              <NumberField
                label={t('bg.rotation')}
                value={bg.rotation}
                unit="°"
                onCommit={(n) => {
                  if (!image) throw new Error('sin imagen');
                  set(rotateAbout(bg, backgroundCenter(bg, image), n));
                }}
              />
              {bg.page !== undefined && image && image.pages > 1 && (
                <NumberField
                  label={t('bg.page', { n: image.pages })}
                  value={bg.page}
                  min={1}
                  onCommit={(n) => {
                    const page = Math.round(n);
                    if (page > image.pages) throw new Error('página inexistente');
                    set({ ...bg, page });
                  }}
                />
              )}
            </div>
            <p className="props__tip">{t('bg.moveTip')}</p>
          </section>

          <section className="bg-panel__section">
            <h3>{t('bg.traceTitle')}</h3>
            <p className="props__tip">{t('bg.traceTip')}</p>
            <button type="button" onClick={() => uiStore.getState().setTool('wall')}>
              {t('bg.drawWalls')}
            </button>
          </section>

          <div className="props__actions bg-panel__actions">
            <button type="button" disabled={busy} onClick={onImport}>
              {busy ? t('bg.loading') : t('bg.replace')}
            </button>
            <button type="button" className="danger" onClick={() => set(null)}>
              {t('bg.remove')}
            </button>
          </div>
        </>
      )}
    </aside>
  );
}

/** Pasos de la calibración: primer punto, segundo punto y medida real. */
function Calibrator({
  bg,
  a,
  b,
  onApply,
}: {
  bg: Background;
  a: Vec2 | null;
  b: Vec2 | null;
  onApply(next: Background): void;
}) {
  const [text, setText] = useState('');
  const [straight, setStraight] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setText('');
    setError(null);
  }, [a, b]);

  const cancel = () => uiStore.getState().setTool('select');

  if (!a || !b) {
    return (
      <>
        <p className="props__note" role="status">
          {a ? t('bg.pickSecond') : t('bg.pickFirst')}
        </p>
        <button type="button" onClick={cancel}>
          {t('bg.cancel')}
        </button>
      </>
    );
  }

  const apply = () => {
    const real = parseNumber(text);
    if (real === null) {
      setError(t('bg.badNumber'));
      return;
    }
    try {
      let next = calibrate(bg, a, b, real);
      if (straight) next = straighten(next, a, b);
      onApply(next);
      const ui = uiStore.getState();
      ui.setTool('select');
      ui.flash(t('bg.calibrated', { n: formatNumber(real, 1) }));
      window.dispatchEvent(new Event('planocasa:fit'));
    } catch (e) {
      setError(message(e));
    }
  };

  return (
    <>
      <p className="props__meta">{t('bg.measuredNow', { n: formatNumber(dist(a, b), 1) })}</p>
      <label className="field">
        <span>{t('bg.realLength')}</span>
        <span className="field__input">
          <input
            autoFocus
            inputMode="decimal"
            value={text}
            placeholder="350"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') apply();
              if (e.key === 'Escape') cancel();
            }}
          />
          <span className="field__unit">cm</span>
        </span>
      </label>
      <label className="bg-panel__check">
        <input type="checkbox" checked={straight} onChange={(e) => setStraight(e.target.checked)} />
        {t('bg.straighten')}
      </label>
      {error && <p className="add-item__warn">{error}</p>}
      <div className="field-row">
        <button type="button" className="primary" onClick={apply}>
          {t('bg.apply')}
        </button>
        <button type="button" onClick={cancel}>
          {t('bg.cancel')}
        </button>
      </div>
      <p className="props__tip">{t('bg.repick')}</p>
    </>
  );
}

/** Transparencia: se mueve en vivo y se guarda al soltar (un paso de deshacer). */
function OpacitySlider({ value, onCommit }: { value: number; onCommit(v: number): void }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  const commit = () => {
    if (v !== value) onCommit(v);
  };
  return (
    <label className="field">
      <span>{t('bg.opacity', { n: Math.round(v * 100) })}</span>
      <input
        type="range"
        min={0.1}
        max={1}
        step={0.05}
        value={v}
        onChange={(e) => setV(Number(e.target.value))}
        onPointerUp={commit}
        onKeyUp={commit}
        onBlur={commit}
        onKeyDown={(e) => e.stopPropagation()}
      />
    </label>
  );
}
