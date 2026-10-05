import { t } from '../i18n';

export function StatusBar({
  gatewayKind,
  hasProject,
  dirty,
  fileName,
}: {
  gatewayKind: 'tauri' | 'browser';
  hasProject: boolean;
  dirty: boolean;
  fileName: string | null;
}) {
  return (
    <footer className="status" role="status">
      <span className="status__offline">{t('status.offline')}</span>
      {gatewayKind === 'browser' && <span className="status__warn">{t('status.browserMode')}</span>}
      {hasProject && (
        <>
          <span>{fileName ? t('status.file', { name: fileName }) : t('status.noFile')}</span>
          <span className={dirty ? 'status__dirty' : 'status__clean'}>
            {dirty ? t('status.unsaved') : t('status.saved')}
          </span>
        </>
      )}
    </footer>
  );
}
