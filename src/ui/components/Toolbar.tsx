import { t } from '../i18n';
import { Logo } from './Logo';

interface Props {
  hasProject: boolean;
  busy: boolean;
  canUndo: boolean;
  canRedo: boolean;
  fileName: string | null;
  dirty: boolean;
  onOpen(): void;
  onSave(): void;
  onSaveAs(): void;
  onUndo(): void;
  onRedo(): void;
  onSample(): void;
}

export function Toolbar(p: Props) {
  return (
    <header className="toolbar">
      <div className="toolbar__brand">
        <Logo />
        <span className="toolbar__name">{t('app.name')}</span>
        {p.hasProject && (
          <span className="toolbar__file" title={p.fileName ?? t('status.noFile')}>
            {p.dirty && <span className="dot" aria-label={t('status.unsaved')} />}
            {p.fileName ?? t('status.noFile')}
          </span>
        )}
      </div>

      <nav className="toolbar__actions" aria-label="Archivo">
        <button type="button" onClick={p.onOpen} disabled={p.busy} title="Ctrl+O">
          {t('toolbar.open')}
        </button>
        <button type="button" onClick={p.onSave} disabled={!p.hasProject || p.busy} title="Ctrl+S">
          {t('toolbar.save')}
        </button>
        <button
          type="button"
          onClick={p.onSaveAs}
          disabled={!p.hasProject || p.busy}
          title="Ctrl+Mayús+S"
        >
          {t('toolbar.saveAs')}
        </button>
        <span className="toolbar__sep" aria-hidden />
        <button type="button" onClick={p.onUndo} disabled={!p.canUndo} title="Ctrl+Z">
          {t('toolbar.undo')}
        </button>
        <button type="button" onClick={p.onRedo} disabled={!p.canRedo} title="Ctrl+Y">
          {t('toolbar.redo')}
        </button>
        <span className="toolbar__sep" aria-hidden />
        <button type="button" className="ghost" onClick={p.onSample} disabled={p.busy}>
          {t('toolbar.loadSample')}
        </button>
      </nav>
    </header>
  );
}
