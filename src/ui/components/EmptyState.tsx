import { t } from '../i18n';
import { Logo } from './Logo';

export function EmptyState({ onOpen, onSample }: { onOpen(): void; onSample(): void }) {
  return (
    <section className="empty">
      <Logo size={72} />
      <h1>{t('empty.title')}</h1>
      <p>{t('empty.body')}</p>
      <div className="empty__actions">
        <button type="button" className="primary" onClick={onOpen}>
          {t('toolbar.open')}
        </button>
        <button type="button" onClick={onSample}>
          {t('toolbar.loadSample')}
        </button>
      </div>
      <p className="empty__tagline">{t('app.tagline')}</p>
    </section>
  );
}
