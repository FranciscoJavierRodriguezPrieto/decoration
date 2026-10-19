/**
 * Carga (y cachea) la imagen del plano de fondo de un nivel para el lienzo.
 * La caché vive fuera del proyecto: no es estado del modelo ni entra en el historial.
 */
import { useEffect, useState } from 'react';
import { loadBackground, type LoadedBackground } from '../import/loadBackground';
import { kindFromAssetName } from '../import/sniff';
import { appGateway } from '../io/fileGateway';

export type BackgroundImageState =
  | { status: 'none' }
  | { status: 'loading' }
  | { status: 'ready'; image: LoadedBackground }
  | { status: 'error'; message: string };

const cache = new Map<string, Promise<LoadedBackground>>();
const keyOf = (asset: string, page?: number) => `${asset}#${page ?? 1}`;

/** Carga un asset de fondo (con caché por asset y página). */
export function loadBackgroundAsset(asset: string, page?: number): Promise<LoadedBackground> {
  const key = keyOf(asset, page);
  let p = cache.get(key);
  if (!p) {
    const kind = kindFromAssetName(asset);
    p = kind
      ? appGateway()
          .readAsset(asset)
          .then((bytes) => loadBackground(bytes, kind, page))
      : Promise.reject(new Error(`Formato de plano no soportado: ${asset}`));
    // Un fallo no se queda en caché: se puede reintentar.
    p.catch(() => cache.delete(key));
    cache.set(key, p);
  }
  return p;
}

export function useBackgroundImage(
  background: { asset: string; page?: number | undefined } | undefined,
): BackgroundImageState {
  const asset = background?.asset;
  const page = background?.page;
  const [state, setState] = useState<BackgroundImageState>({ status: 'none' });

  useEffect(() => {
    if (!asset) {
      setState({ status: 'none' });
      return;
    }
    let alive = true;
    setState({ status: 'loading' });
    loadBackgroundAsset(asset, page).then(
      (image) => alive && setState({ status: 'ready', image }),
      (e: unknown) =>
        alive && setState({ status: 'error', message: e instanceof Error ? e.message : String(e) }),
    );
    return () => {
      alive = false;
    };
  }, [asset, page]);

  return state;
}
