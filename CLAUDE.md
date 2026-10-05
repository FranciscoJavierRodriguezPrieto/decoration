# CLAUDE.md — PlanoCasa (nombre provisional)

App de escritorio **100 % local** para levantar el plano de una vivienda (desde un plano del Catastro, una imagen/PDF o a mano), amueblarla con un catálogo de productos reales y ver el resultado en **2D (plano a escala) y 3D (navegable)**, comparando varias distribuciones.

Lee este archivo entero antes de tocar código. La especificación completa está en `docs/ESPECIFICACION.md`, las reglas de catálogo y ergonomía en `docs/CATALOGO_Y_ERGONOMIA.md` y el caso de prueba real en `docs/fixtures/salon-madrid.json`.

---

## 1. Principios innegociables

1. **Local-first y offline.** Cero servidores propios, cero cuentas, cero telemetría, cero analytics, cero CDNs en runtime. Todas las librerías, fuentes, texturas y modelos van empaquetados en la app. La app debe funcionar con el cable de red desconectado.
2. **Única excepción de red: acciones explícitas del usuario**, siempre opcionales, desactivadas por defecto y señaladas en la UI con un icono de "sale a Internet":
   - Consultar datos públicos del Catastro por referencia catastral (solo se envía la RC, nunca datos del proyecto).
   - Abrir el enlace de un producto en el navegador del sistema.
   Ninguna otra petición saliente. Si una dependencia hace peticiones por su cuenta (fuentes de Google, analytics, update-checkers), se elimina o se parchea.
3. **Los datos son del usuario y portables.** Un proyecto es un único archivo `.planocasa` (ZIP con `project.json` + `assets/`) que se copia a otro ordenador y se abre igual. El catálogo se exporta/importa como `.planocasa-catalog` (ZIP con `catalog.json` + imágenes + modelos).
4. **Unidades: centímetros enteros** en todo el modelo de datos. Ángulos en grados. Conversión a metros solo en la UI.
5. **Una sola fuente de verdad.** El modelo de datos (JSON tipado) genera la vista 2D y la 3D; ninguna vista guarda estado geométrico propio.
6. **Nada de scraping de tiendas.** El catálogo se llena a mano, importando JSON/CSV o pegando medidas; un enlace a la tienda es solo un campo de texto.

## 2. Stack decidido

| Capa | Elección | Motivo |
|---|---|---|
| Shell escritorio | **Tauri 2** (Rust) | Binario de ~10 MB frente a ~150 MB de Electron, permisos por capacidades, WebView2 ya presente en Windows 10/11 |
| Front | **React 18 + TypeScript (strict) + Vite** | Ecosistema three.js maduro |
| Estado | **Zustand** + **zundo** (deshacer/rehacer) + **immer** | Sencillo, serializable |
| 2D | **react-konva** (Konva) | Arrastrar, rotar, snapping y miles de nodos con buen rendimiento |
| 3D | **three.js** vía **@react-three/fiber** (sin drei, ADR 0003) | Órbita, primera persona, sombras, GLTF |
| Geometría | **clipper2-js** (offsets/booleanas de muros), **polygon-clipping**, utilidades propias en `src/geometry` | Muros con grosor, huecos, áreas |
| PDF/imagen | **pdfjs-dist** (worker empaquetado) | Importar el PDF del Catastro como fondo calcable |
| DXF (fase 3) | **dxf-parser** | Planos de arquitecto |
| Persistencia | Sistema de archivos vía `@tauri-apps/plugin-fs` + `plugin-dialog`; catálogo en **SQLite** (`@tauri-apps/plugin-sql`) | Proyecto portable + catálogo consultable |
| Exportación | PNG (canvas), PDF (**jsPDF**), GLB (`GLTFExporter`) | Compartir sin subir nada |
| Validación | **zod** para todo JSON que entra o sale | Archivos de usuario no confiables |
| Tests | **Vitest** (unit), **Playwright** (e2e sobre `vite preview`) | |
| Calidad | ESLint + Prettier, `tsc --noEmit` en CI local | |

Plataformas: Windows 10/11 (principal; el usuario trabaja en `C:\Git`), macOS y Linux como secundarias.

## 3. Estructura de carpetas

```
planocasa/
├─ src-tauri/                 # Rust: comandos de E/S, zip, SQLite, consulta Catastro opcional
│  ├─ core/                   # crate planocasa-core: formato .planocasa (ZIP) sin Tauri, con tests
│  ├─ src/commands/{project,catalog,catastro,export}.rs
│  └─ capabilities/default.json   # permisos mínimos: core + comandos propios (ADR 0002)
├─ src/
│  ├─ model/          # tipos TS + esquemas zod (Project, Level, Wall, Opening, Item, CatalogItem…)
│  ├─ geometry/       # puro y testeado: muros, polígonos, colisiones, holguras, snapping
│  ├─ store/          # zustand: projectStore, catalogStore, uiStore (+ zundo)
│  ├─ io/             # texto⇄Project (projectJson), pasarela de archivos, casos de uso abrir/guardar
│  ├─ editor2d/       # Konva: capas Fondo, Habitaciones, Muros, Huecos, Muebles, Cotas, Avisos
│  ├─ viewer3d/       # r3f: builders procedurales, materiales, cámaras, iluminación
│  ├─ catalog/        # UI y lógica del catálogo, plantillas paramétricas
│  ├─ import/         # pdf/imagen + calibración, Catastro, DXF, JSON
│  ├─ export/         # png, pdf, glb, json
│  ├─ rules/          # motor de reglas ergonómicas (docs/CATALOGO_Y_ERGONOMIA.md)
│  └─ ui/             # layout, paneles, atajos
├─ assets/            # texturas, modelos GLB y fuentes empaquetadas (licencias en assets/LICENSES.md)
├─ docs/
└─ tests/
```

## 4. Modelo de coordenadas (no cambiar sin ADR)

- Plano XY en cm, **origen en la esquina superior izquierda** del nivel, **X hacia la derecha, Y hacia abajo** (igual que el canvas 2D).
- En 3D: `X3 = x`, `Z3 = y`, `Y3 = altura`. Suelo en `Y3 = 0`.
- Rotación de muebles en grados, sentido horario visto en planta. 0° = el **frente** del mueble mira hacia +Y ("abajo" en el plano) y el respaldo queda en −Y; 90° = frente hacia −X; 180° = frente hacia −Y; 270° = frente hacia +X.
- `x, y` de un mueble o fijo = **centro** de su caja; `w` = ancho de frente y `d` = fondo, ambos sin rotar. La rotación se aplica sobre el centro. Se admiten medios centímetros (p. ej. 42,5).
- El lado de la chaise (`chaiseSide`) se indica **visto de frente**, como en las tiendas.
- Muros = segmentos (eje) + grosor; los huecos (puertas/ventanas) se referencian por `wallId` + `offset` desde el inicio del muro.

## 5. Convenciones de código

- TypeScript `strict`, sin `any`; los tipos del modelo salen de `z.infer` de los esquemas zod.
- `src/geometry` y `src/rules` son **funciones puras** con tests unitarios (cobertura ≥ 90 %).
- Componentes React pequeños; nada de lógica geométrica dentro de componentes.
- Todo texto visible en **español** (i18n preparado con claves desde el principio: `src/ui/i18n/es.json`).
- Commits en español, formato Conventional Commits (`feat(editor2d): …`).
- Toda migración del formato de archivo incrementa `schemaVersion` y añade un migrador en `src/model/migrations/`.
- Nunca romper la apertura de proyectos antiguos: test de regresión con `docs/fixtures/*.json`.

## 6. Cómo trabajar en este repo (para Claude)

- Antes de implementar una funcionalidad, localízala en la hoja de ruta de `docs/ESPECIFICACION.md` §9 y respeta su fase; no adelantes fases sin pedirlo.
- Para cualquier cambio de modelo de datos: actualiza esquema zod → tipos → migración → fixture → tests, en ese orden.
- Verifica siempre con `pnpm typecheck && pnpm test` y, si tocas UI, `pnpm e2e`.
- Usa `docs/fixtures/salon-madrid.json` como caso de aceptación: debe abrirse, verse en 2D y 3D y pasar las reglas sin avisos falsos.
- Si una decisión cambia arquitectura, stack o formato de archivo, escribe un ADR corto en `docs/adr/NNNN-titulo.md`.
- Si añades una dependencia, comprueba que no hace peticiones de red en runtime y anota su licencia.
- No introduzcas servicios en la nube, IA remota, cuentas ni sincronización. Si una idea lo necesita, apúntala en `docs/IDEAS.md` y no la implementes.

## 7. Comandos

```bash
pnpm install
pnpm tauri dev        # desarrollo (app de escritorio)
pnpm dev              # solo el front en el navegador (modo .json, sin ZIP)
pnpm typecheck
pnpm lint
pnpm test             # vitest
pnpm test:coverage    # vitest + umbrales de cobertura
pnpm test:rust        # cargo test del núcleo .planocasa
pnpm check            # todo lo anterior: lo que corre la CI
pnpm e2e              # playwright (pendiente: se añade con la fase 1)
pnpm tauri build      # instalador (.msi/.exe en Windows)
```

## 8. Definición de hecho

Una tarea está terminada cuando:
1. compila sin warnings de TS,
2. tiene tests de la lógica nueva,
3. el fixture del salón sigue abriendo y renderizando igual,
4. funciona sin red (probado con la red desactivada),
5. deshacer/rehacer funciona para la acción nueva,
6. los textos nuevos están en `es.json`.

## 9. Flujo de Git

- `main` siempre compila y pasa `pnpm check`. No se hace commit directo a `main`.
- Cada cambio va en su rama desde `main`: `feat/…`, `fix/…`, `docs/…`, `chore/…`, `refactor/…`, `test/…`.
- Pull request a `main` con la CI en verde; fusión con *squash*. Después se borra la rama.
