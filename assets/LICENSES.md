# Licencias de assets empaquetados

Todo asset que se empaquete con la app (texturas, modelos, fuentes, iconos) debe ser propio, CC0 o con licencia compatible, y registrarse aquí.

| Archivo | Origen | Licencia |
|---|---|---|
| `src-tauri/icons/*` | Propio (generado para PlanoCasa) | MIT, como el proyecto |

No se empaquetan fuentes: la UI usa la fuente del sistema (Segoe UI en Windows).

## Dependencias de runtime añadidas en la fase 1

| Paquete | Versión | Licencia | Red en runtime |
|---|---|---|---|
| konva | 9.3 | MIT | No |
| react-konva | 18.2 | MIT | No |

## Dependencias de runtime añadidas en la fase 3 (visor 3D)

| Paquete | Versión | Licencia | Red en runtime |
|---|---|---|---|
| three | 0.186 | MIT | No (los cargadores solo leen lo que se les pasa; no se usa ninguno remoto) |
| @react-three/fiber | 8.18 | MIT | No |

Las texturas de suelo no son archivos: se pintan en un `<canvas>` al vuelo (`src/viewer3d/materials.ts`).
