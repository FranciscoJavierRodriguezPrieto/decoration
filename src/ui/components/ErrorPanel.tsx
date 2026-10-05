import { useEffect, useRef } from 'react';
import type { ProjectIssue } from '../../io/projectJson';
import { t } from '../i18n';

const MAX_SHOWN = 12;

export function ErrorPanel({
  title,
  issues,
  onClose,
}: {
  title: string;
  issues: ProjectIssue[];
  onClose(): void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  const shown = issues.slice(0, MAX_SHOWN);
  return (
    <dialog ref={ref} className="error" onClose={onClose} aria-labelledby="error-title">
      <h2 id="error-title">{title}</h2>
      <ul>
        {shown.map((i, n) => (
          <li key={n}>
            {i.path && <code>{i.path}</code>} {i.message}
          </li>
        ))}
      </ul>
      {issues.length > MAX_SHOWN && <p>{t('error.more', { n: issues.length - MAX_SHOWN })}</p>}
      <form method="dialog">
        <button type="submit" className="primary" autoFocus>
          {t('error.dismiss')}
        </button>
      </form>
    </dialog>
  );
}
