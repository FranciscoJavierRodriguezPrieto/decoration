# PlanoCasa

App de escritorio **100 % local** para levantar el plano de una vivienda, amueblarla con muebles reales y comparar distribuciones en 2D y 3D. Sin nube, sin cuentas, sin telemetría.

> Estado: **fase 0 (esqueleto)**. Abre y guarda proyectos `.planocasa`, valida el formato, deshace/rehace y lista las distribuciones. El editor 2D llega en la fase 1 y el 3D en la fase 3 (ver [hoja de ruta](docs/ESPECIFICACION.md#9-hoja-de-ruta)).

## Lenguajes y piezas

| Parte | Lenguaje / herramienta | Para qué |
|---|---|---|
| Ventana de escritorio y disco | **Rust** + [Tauri 2](https://tauri.app) | Abrir/guardar el ZIP `.planocasa`, diálogos nativos, instalador `.msi`/`.exe` |
| Interfaz | **TypeScript** (strict) + React 18 + Vite | Toda la UI |
| Modelo de datos | zod | Valida todo archivo que entra; los tipos TS salen de los esquemas |
| Estado | zustand + immer + zundo | Proyecto abierto con deshacer/rehacer (200 pasos) |
| 2D (fase 1) / 3D (fase 3) | Konva / three.js + react-three-fiber | Plano a escala y vista navegable |
| Tests | Vitest, `cargo test` (Playwright en la fase 1) | |

## Instalar sin compilar nada

1. GitHub → **Actions** → **Instalador Windows** → el último run en verde → artefacto `planocasa-windows-x64`.
2. Descomprime y ejecuta `PlanoCasa_x.y.z_x64-setup.exe` (o el `.msi`).
3. El instalador no está firmado: Windows SmartScreen mostrará "Windows protegió su PC" → **Más información** → **Ejecutar de todas formas**.

Para generar uno nuevo: Actions → Instalador Windows → **Run workflow**, o sube una etiqueta `vX.Y.Z` (crea además un Release borrador).

## Requisitos para desarrollar (Windows)

1. **Rust** con la toolchain MSVC: instala [rustup](https://rustup.rs) y, si te lo pide, *Visual Studio Build Tools* con "Desarrollo para el escritorio con C++".
2. **Node.js 22 LTS** y **pnpm**: `corepack enable` (pnpm viene con Node vía corepack).
3. **WebView2**: ya viene con Windows 10/11.

Comprueba: `rustc -V`, `node -v`, `pnpm -v`.

## Arrancar

```powershell
cd C:\Git\decoration
pnpm install
pnpm tauri dev
```

La primera compilación de Rust tarda unos minutos; las siguientes, segundos. En la ventana pulsa **Abrir ejemplo** o abre `docs\fixtures\salon-madrid.json` con **Abrir…**, y luego **Guardar como…** para crear tu primer `.planocasa`.

Solo el front en el navegador (sin Rust, sin ZIP): `pnpm dev` → <http://localhost:1420>.

## Comprobar antes de subir

```powershell
pnpm check   # typecheck + lint + formato + vitest + cargo test
```

## Formato de archivo

Un proyecto es un único `.planocasa`: un ZIP con `project.json` (legible y editable a mano) y `assets/` (fondos, fotos, modelos). Se copia a otro ordenador y se abre igual. El esquema está en [`src/model/schemas.ts`](src/model/schemas.ts) y el caso real de aceptación en [`docs/fixtures/salon-madrid.json`](docs/fixtures/salon-madrid.json).

## Flujo de trabajo

`main` siempre verde. Cada cambio en su rama (`feat/…`, `fix/…`, `docs/…`) y pull request con la CI en verde. Detalle en [CLAUDE.md §9](CLAUDE.md#9-flujo-de-git).

## Documentación

- [CLAUDE.md](CLAUDE.md): principios, stack, convenciones y comandos.
- [docs/ESPECIFICACION.md](docs/ESPECIFICACION.md): qué se construye y en qué orden.
- [docs/CATALOGO_Y_ERGONOMIA.md](docs/CATALOGO_Y_ERGONOMIA.md): medidas, plantillas y reglas.
- [docs/adr/](docs/adr/): decisiones de arquitectura.

## Privacidad del repositorio

El repo es público. Las descargas del Catastro (`parcelas/`) y cualquier `.planocasa` personal están en `.gitignore` y **no se suben**.
