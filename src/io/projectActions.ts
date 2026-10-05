/**
 * Casos de uso de archivo: abrir, guardar, guardar como y cargar el ejemplo.
 * Unen pasarela (E/S) + validación + store, sin React, para poder probarlos.
 */
import sampleJson from '../../docs/fixtures/salon-madrid.json?raw';
import type { ProjectStore } from '../store/projectStore';
import type { FileGateway } from './fileGateway';
import { parseProject, serializeProject, type ProjectIssue } from './projectJson';

export type ActionResult =
  | { ok: true }
  | { ok: false; cancelled: true }
  | { ok: false; cancelled?: false; issues: ProjectIssue[] };

const CANCELLED: ActionResult = { ok: false, cancelled: true };
const failure = (message: string): ActionResult => ({ ok: false, issues: [{ path: '', message }] });
const errorMessage = (e: unknown): string => (e instanceof Error ? e.message : String(e));

export async function openProject(
  store: ProjectStore,
  gateway: FileGateway,
): Promise<ActionResult> {
  let opened;
  try {
    opened = await gateway.open();
  } catch (e) {
    return failure(errorMessage(e));
  }
  if (!opened) return CANCELLED;

  const parsed = parseProject(opened.projectJson);
  if (!parsed.ok) return { ok: false, issues: parsed.issues };
  store.getState().loadProject(parsed.project, opened.file, opened.assets);
  return { ok: true };
}

export function loadSample(store: ProjectStore): ActionResult {
  const parsed = parseProject(sampleJson);
  if (!parsed.ok) return { ok: false, issues: parsed.issues };
  store.getState().loadProject(parsed.project, null);
  return { ok: true };
}

export async function saveProjectAs(
  store: ProjectStore,
  gateway: FileGateway,
): Promise<ActionResult> {
  const { project } = store.getState();
  if (!project) return failure('No hay ningún proyecto abierto');
  try {
    const file = await gateway.saveAs(serializeProject(project), project.name);
    if (!file) return CANCELLED;
    store.getState().markSaved(file);
    return { ok: true };
  } catch (e) {
    return failure(errorMessage(e));
  }
}

export async function saveProject(
  store: ProjectStore,
  gateway: FileGateway,
): Promise<ActionResult> {
  const { project, file } = store.getState();
  if (!project) return failure('No hay ningún proyecto abierto');
  if (!file) return saveProjectAs(store, gateway);
  try {
    const saved = await gateway.save(serializeProject(project));
    if (!saved) return saveProjectAs(store, gateway);
    store.getState().markSaved(saved);
    return { ok: true };
  } catch (e) {
    return failure(errorMessage(e));
  }
}
