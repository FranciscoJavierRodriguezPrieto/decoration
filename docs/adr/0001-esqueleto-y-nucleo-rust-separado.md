# ADR 0001 · Esqueleto de la fase 0 y núcleo Rust separado

- Estado: aceptado
- Fecha: 2026-10-05

## Contexto

La fase 0 pide abrir y guardar `.planocasa` (ZIP) desde Rust, validar con zod y garantizar que abrir → guardar → reabrir no cambia nada.

## Decisión

1. **Workspace Cargo con dos crates** en `src-tauri/`:
   - `planocasa-core` (`src-tauri/core`): formato `.planocasa` sin dependencia de Tauri. Lectura con límites (anti zip-slip y anti bomba ZIP), escritura atómica (temporal + `fsync` + `rename`) y copia de assets sin recomprimir.
   - `planocasa` (app): comandos Tauri finos que llaman al núcleo.
   Motivo: el núcleo se prueba con `cargo test` en segundos y sin WebView ni GTK.
2. **Rust no interpreta `project.json`**: solo lo transporta como texto. La validación vive en un único sitio, los esquemas zod (`src/model`), y los tipos TS salen de `z.infer`.
3. **Esquemas `.strict()`**: una clave desconocida es un error, no se descarta en silencio. El único campo libre es `_comentario` (raíz), que la app conserva.
4. **Serialización canónica**: `JSON.stringify(p, null, 2) + "\n"` con el orden de claves del esquema. Guardar dos veces da los mismos bytes.
5. **Medidas múltiplo de 0,5 cm** validadas en el esquema (CLAUDE.md §4).
6. **zod 3** (no 4) y **React 18** (no 19), como fija CLAUDE.md §2.

## Alternativas

- Hacer el ZIP en JS (fflate) y usar `plugin-fs`: menos Rust, pero exige dar permisos de sistema de archivos al WebView. Descartado por seguridad (ver ADR 0002).
- Validar también en Rust con `serde`: doble fuente de verdad del esquema. Descartado.

## Consecuencias

- Todo cambio de formato toca solo `src/model` (+ migración y fixture), no Rust.
- Un `.json` plano se puede abrir y guardar (útil para fixtures y para editar a mano), pero no lleva assets.
