# ADR 0003 — Visor 3D procedural, sin @react-three/drei

- **Estado:** aceptada (fase 3)
- **Contexto:** CLAUDE.md §2 preveía three.js + @react-three/fiber + @react-three/drei. El visor tiene que funcionar sin red (principio 1) y la escena sale entera del modelo (principio 5).

## Decisión

1. **three + @react-three/fiber, sin drei.** De drei solo haría falta la órbita y la primera persona, que vienen en `three/examples` (`OrbitControls`, `PointerLockControls`). drei arrastra muchas dependencias y varias utilidades suyas cargan recursos de CDN (entornos HDR, fuentes); evitarlo elimina ese riesgo y una revisión de licencias.
2. **Todo procedural y puro.** Las piezas (muros troceados por huecos, hojas de puerta, muebles por plantilla, sol, cutaway, choque en primera persona) se calculan en módulos `.ts` sin React ni WebGL, con tests. Los componentes `.tsx` solo pintan esas listas.
3. **Texturas generadas** en un `<canvas>` (tarima, laminado, gres, hidráulico): nada que empaquetar ni licenciar.
4. **Carga diferida:** el visor es un chunk aparte (`React.lazy`); el arranque y el 2D no cargan three.js.

## Consecuencias

- Si más adelante hace falta algo de drei (p. ej. `Html` para etiquetas), se valora pieza a pieza y se anota aquí.
- Los modelos GLB por producto (fase 5) usarán `GLTFLoader` de `three/examples` leyendo bytes locales del `.planocasa`, nunca URLs.
