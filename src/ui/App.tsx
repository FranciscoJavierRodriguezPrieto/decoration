import { useCallback, useEffect, useMemo, useState } from 'react';
import { defaultGateway } from '../io/fileGateway';
import {
  loadSample,
  openProject,
  saveProject,
  saveProjectAs,
  type ActionResult,
} from '../io/projectActions';
import type { ProjectIssue } from '../io/projectJson';
import { useHistory, useProject } from '../store/hooks';
import { isDirty, projectStore } from '../store/projectStore';
import { EmptyState } from './components/EmptyState';
import { ErrorPanel } from './components/ErrorPanel';
import { ProjectView } from './components/ProjectView';
import { StatusBar } from './components/StatusBar';
import { Toolbar } from './components/Toolbar';
import { t, type MessageKey } from './i18n';

interface ErrorState {
  title: MessageKey;
  issues: ProjectIssue[];
}

export function App() {
  const gateway = useMemo(defaultGateway, []);
  const project = useProject((s) => s.project);
  const file = useProject((s) => s.file);
  const dirty = useProject(isDirty);
  const canUndo = useHistory((s) => s.pastStates.length > 0);
  const canRedo = useHistory((s) => s.futureStates.length > 0);
  const [error, setError] = useState<ErrorState | null>(null);
  const [busy, setBusy] = useState(false);

  const run = useCallback(
    async (title: MessageKey, action: () => ActionResult | Promise<ActionResult>) => {
      setBusy(true);
      try {
        const r = await action();
        if (!r.ok && !r.cancelled) setError({ title, issues: r.issues });
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const onOpen = useCallback(
    () => run('error.title', () => openProject(projectStore, gateway)),
    [run, gateway],
  );
  const onSave = useCallback(
    () => run('error.saveTitle', () => saveProject(projectStore, gateway)),
    [run, gateway],
  );
  const onSaveAs = useCallback(
    () => run('error.saveTitle', () => saveProjectAs(projectStore, gateway)),
    [run, gateway],
  );
  const onSample = useCallback(() => run('error.title', () => loadSample(projectStore)), [run]);
  const onUndo = useCallback(() => projectStore.temporal.getState().undo(), []);
  const onRedo = useCallback(() => projectStore.temporal.getState().redo(), []);

  // Atajos de teclado (ESPECIFICACION §4.2).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || busy) return;
      const k = e.key.toLowerCase();
      const map: Record<string, (() => void) | undefined> = {
        o: onOpen,
        s: e.shiftKey ? onSaveAs : onSave,
        z: e.shiftKey ? onRedo : onUndo,
        y: onRedo,
      };
      const fn = map[k];
      if (!fn) return;
      // Deshacer/rehacer del propio campo de texto tiene prioridad.
      if ((k === 'z' || k === 'y') && e.target instanceof HTMLInputElement) return;
      e.preventDefault();
      fn();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onOpen, onSave, onSaveAs, onUndo, onRedo]);

  // Título de la ventana: "• salon.planocasa — PlanoCasa".
  useEffect(() => {
    const name = file?.fileName ?? project?.name;
    document.title = name ? `${dirty ? '• ' : ''}${name} — ${t('app.name')}` : t('app.name');
  }, [file, project, dirty]);

  return (
    <div className="app">
      <Toolbar
        hasProject={project !== null}
        busy={busy}
        canUndo={canUndo}
        canRedo={canRedo}
        fileName={file?.fileName ?? null}
        dirty={dirty}
        onOpen={onOpen}
        onSave={onSave}
        onSaveAs={onSaveAs}
        onUndo={onUndo}
        onRedo={onRedo}
        onSample={onSample}
      />
      <main className="app__main">
        {project ? (
          <ProjectView project={project} />
        ) : (
          <EmptyState onOpen={onOpen} onSample={onSample} />
        )}
      </main>
      <StatusBar
        gatewayKind={gateway.kind}
        hasProject={project !== null}
        dirty={dirty}
        fileName={file?.fileName ?? null}
      />
      {error && (
        <ErrorPanel title={t(error.title)} issues={error.issues} onClose={() => setError(null)} />
      )}
    </div>
  );
}
