# ADR 0002 · El front nunca maneja rutas de archivo

- Estado: aceptado
- Fecha: 2026-10-05

## Contexto

ESPECIFICACION §11 pide capacidades `fs` limitadas a las rutas elegidas por el usuario. Con `plugin-fs` + `plugin-dialog` desde JS, el WebView necesita permiso para leer y escribir rutas; si alguna vez se inyectara código (p. ej. un SVG o un GLB malicioso en el futuro), podría pedir rutas arbitrarias dentro de ese ámbito.

## Decisión

- El diálogo nativo se abre **desde Rust** (`tauri-plugin-dialog`, API Rust bloqueante en comandos `async`, fuera del hilo principal).
- Rust guarda la ruta elegida en un estado interno (`CurrentFile`) y al front solo le devuelve el **nombre** del archivo.
- Comandos expuestos: `open_project`, `save_project`, `save_project_as`, `current_file`. Ninguno acepta una ruta como argumento.
- Los comandos se declaran en `build.rs` (`AppManifest`) y la capacidad `default.json` los permite uno a uno. El front no tiene `fs`, `dialog`, `http` ni `shell`.
- CSP: `default-src 'self'`, `connect-src` solo IPC de Tauri. Sin red.
- En desarrollo (`devCsp`) se permite además `'unsafe-inline'` en `script-src` (preámbulo de React Refresh) y `ws://localhost:1420` (HMR de Vite). En producción no.
- `freezePrototype` **desactivado**: congela `Object.prototype` y una dependencia del front reasigna `toString`, lo que dejaba la ventana en blanco (fix 2026-10-05). Lo vigila `tests/tauriConfig.test.ts`.

## Alternativa

`plugin-fs` con ámbito dinámico (`allow_file` tras el diálogo). Funciona, pero amplía la superficie del WebView sin ganar nada en esta fase.

## Consecuencias

- Para leer assets (fondos, fotos) en la fase 1 hará falta un comando `read_asset(name)` que solo lea dentro del `.planocasa` abierto, o el protocolo `asset:` con ámbito limitado al directorio temporal de extracción. Se decidirá en esa fase con otro ADR.
- La consulta al Catastro (fase 6) será otro comando Rust con un único dominio en lista blanca.
