# Ideas aparcadas

Cosas que no se implementan ahora, bien porque son de una fase posterior, bien porque chocan con los principios (red, nube, IA remota). Se apuntan para no perderlas.

| Idea | Por qué no ahora |
|---|---|
| IA local (modelo en el propio PC) que proponga distribuciones | Fuera de alcance de v1 (ESPECIFICACION §1.3). Solo si es 100 % local. |
| Detección asistida de muros sobre el fondo con OpenCV.js empaquetado | Fase 6. |
| Importar el DXF del FXCC del Catastro (capas `PS1…PS4` = plantas, `PG-LP` = perímetro) para crear el contorno de cada planta automáticamente | Fase 6 (DXF). Ya verificado con un FXCC real: el perímetro de la planta coincide con la superficie catastral. |
| Aviso al cerrar con cambios sin guardar | Fase 1 (necesita el evento de cierre de ventana de Tauri). |
| Autoguardado cada 60 s en `$APPDATA/planocasa/autosave/` | Fase 1 (ESPECIFICACION §11). |
