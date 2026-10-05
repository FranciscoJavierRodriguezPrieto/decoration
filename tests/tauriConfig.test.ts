/**
 * Guardas sobre src-tauri/tauri.conf.json. La ventana se quedó en blanco por dos
 * ajustes de seguridad incompatibles con el front (ver docs/adr/0002):
 *  - `freezePrototype` congela Object.prototype y una dependencia reasigna `toString`.
 *  - En desarrollo, el plugin de React inyecta un script en línea (preámbulo de HMR).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

interface Csp {
  [directive: string]: string;
}
interface TauriConf {
  app: { security: { freezePrototype?: boolean; csp: Csp; devCsp: Csp } };
}

const conf = JSON.parse(
  readFileSync(join(__dirname, '..', 'src-tauri', 'tauri.conf.json'), 'utf8'),
) as TauriConf;
const { security } = conf.app;

describe('tauri.conf.json · seguridad', () => {
  it('no congela Object.prototype (rompe dependencias y deja la ventana en blanco)', () => {
    expect(security.freezePrototype ?? false).toBe(false);
  });

  it('producción: sin scripts en línea ni red', () => {
    expect(security.csp['script-src']).toBe("'self'");
    expect(security.csp['default-src']).toBe("'self'");
    expect(security.csp['connect-src']).toBe('ipc: http://ipc.localhost');
  });

  it('desarrollo: permite el preámbulo de React y el HMR de Vite, nada más', () => {
    expect(security.devCsp['script-src']).toBe("'self' 'unsafe-inline'");
    expect(security.devCsp['connect-src']).toBe('ipc: http://ipc.localhost ws://localhost:1420');
  });

  it('nada en la CSP apunta a dominios externos', () => {
    const all = [...Object.values(security.csp), ...Object.values(security.devCsp)].join(' ');
    expect(all).not.toMatch(/https?:\/\/(?!ipc\.localhost|asset\.localhost)/);
  });
});
