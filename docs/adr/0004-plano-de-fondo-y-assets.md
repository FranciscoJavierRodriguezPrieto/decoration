# ADR 0004 · Plano de fondo: assets en memoria hasta guardar y PDF con pdf.js

- Estado: aceptado
- Fecha: 2026-10-19
- Fase: 1 (ESPECIFICACION §3.2 y §9)

## Contexto

La fase 1 pide importar el plano de la vivienda (PDF del Catastro, de la inmobiliaria, un escaneo o una foto), calibrar su escala y calcar los muros encima. El archivo tiene que acabar dentro del `.planocasa` (`assets/`) y el front sigue sin poder tocar rutas (ADR 0002).

## Decisión

**E/S (Rust).** Tres comandos nuevos, ninguno acepta rutas:

- `import_background`: abre el diálogo nativo (PDF, PNG, JPG, WEBP; máximo 50 MB), comprueba el tipo por los **primeros bytes** (no por la extensión) y deja los bytes en memoria (`StagedAssets`) con un nombre `fondo-<ms>.<ext>`. Al front solo le llega ese nombre.
- `read_asset(name)`: devuelve los bytes en binario (`ipc::Response`, sin JSON): primero los de memoria y, si no, los del `.planocasa` abierto, validando el contenedor y el nombre (sin `..`, sin rutas absolutas).
- `reset_session`: proyecto nuevo o ejemplo; olvida el archivo actual y lo importado.

`save_project` y `save_project_as` reciben la lista de assets que **usa** el proyecto (`referencedAssets`: fondos de nivel e imágenes/modelos del catálogo). Se escriben los de memoria (sin recomprimir) y se copian del origen los demás; lo que ya no se usa se **poda**. Tras guardar un `.planocasa`, la memoria se vacía. Un `.json` no admite assets: guarda la posición y la escala del fondo, pero no la imagen (por eso el diálogo propone `.planocasa`); los importados siguen en memoria hasta guardar un `.planocasa`.

**Modelo.** No cambia: `Level.background` ya existía (schemaVersion 1). Transformación imagen → plano:

    plano = offset + giro(rotation) · (px · cmPerPx)

En un PDF, `px` son **puntos de la página a escala 1** (1/72"), así que la resolución con la que se pinta no afecta a los datos. `page` solo se guarda en PDF.

**Front.** `pdfjs-dist` 4.10 (Apache-2.0) cargado bajo demanda, con el worker servido desde la propia app (`worker-src 'self'`), `isEvalSupported: false` y sin `cMapUrl` ni `standardFontDataUrl`: no hace ninguna petición. La página se rasteriza con el lado mayor a 4096 px (≈350 ppp en A4). Las imágenes van por `blob:` (ya permitido en `img-src`).

Calibrar = escalar alrededor del primer punto (`calibrate`), con opción de **enderezar** la línea marcada a horizontal/vertical (`straighten`). Cada cambio del fondo es un paso de deshacer. Visibilidad y panel abierto son estado de UI, no del archivo.

## Alternativas

- Rasterizar el PDF a PNG en el front y mandarlo a Rust: duplica el tráfico, pierde calidad al acercar y no aprovecha el campo `page` ya previsto. Descartada.
- Base64 por JSON en vez de `ipc::Response`: un 33 % más de datos y más memoria. Descartada.
- `plugin-fs` con ámbito: misma objeción que en el ADR 0002.

## Pendiente (fase 1)

- Segundo par de puntos de comprobación con aviso si la escala se desvía > 2 % (§3.2.3).
- Comprobación de superficie con el Catastro (§3.2.6, necesita la fase 6).
- PDF con imágenes JPEG 2000 o fuentes CJK sin incrustar: pdf.js necesita sus `wasm`/`cmaps`; se empaquetarán si aparece algún plano real que los use.
