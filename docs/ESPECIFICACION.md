# PlanoCasa — Especificación funcional y técnica

> Documento de contexto del proyecto. Explica qué se construye, por qué y en qué orden. Complementa a `CLAUDE.md`, que tiene las reglas de trabajo.

---

## 1. Origen y objetivo

### 1.1 De dónde sale

El proyecto nace de rediseñar a mano un salón real de Madrid (piso de alquiler, pareja + perro). El trabajo se hizo así:

1. Medir la zona útil (2,30 × 4,50 m junto a la pared del sofá) y anotar los elementos fijos: pared de TV (cable), puerta de entrada, espejo, ventana con radiador, puerta al balcón.
2. Fijar los muebles que se conservan: sofá rojo 162 × 110 × 78, mesa de comedor con 4 sillas, mueble de TV, estantería metálica, cubo de madera con planta y el árbol de Navidad (en temporada) en la esquina de la ventana.
3. Generar **variantes** (M1–M4 con el sofá MOSCÚ y K1–K4 con el KANSAS), cada una con su **plano a escala** y su **vista 3D girable**.
4. Compararlas con reglas prácticas: paso libre, 10 cm entre radiador y respaldo, orientación a la tele, y que el rojo, el sofá nuevo y el árbol no caben seguidos en 450 cm.
5. Buscar productos reales que encajen en esas medidas y precio (tope 700 €, ideal ~500 €).

PlanoCasa convierte ese proceso en una herramienta de escritorio reutilizable para **cualquier vivienda**, sin subir nada a ningún sitio.

### 1.2 Objetivo

Que una persona sin conocimientos de CAD pueda, en menos de 30 minutos:

- tener el plano de su casa a escala (calcado de un PDF/imagen o dibujado a mano),
- colocar sus muebles actuales y otros candidatos del catálogo,
- crear varias distribuciones alternativas y compararlas en 2D y 3D,
- saber si un mueble **cabe y deja paso** antes de comprarlo,
- ver cuánto cuesta cada distribución.

### 1.3 Fuera de alcance (explícitamente)

- Servicios en la nube, cuentas, sincronización o colaboración en tiempo real.
- Renders fotorrealistas por trazado de rayos (se usa rasterizado con sombras).
- Cálculo estructural, instalaciones, presupuestos de obra o certificados.
- Scraping de tiendas o comparadores de precios automáticos.
- IA en la nube. Una IA local opcional queda en `docs/IDEAS.md`.

---

## 2. Usuarios y casos de uso

| ID | Caso de uso | Ejemplo real |
|---|---|---|
| CU-01 | Crear un proyecto desde el PDF del Catastro y calcar el perímetro | Piso nuevo antes de mudarse |
| CU-02 | Dibujar una estancia a mano con medidas tomadas con cinta métrica | Salón de 450 × 500 cm |
| CU-03 | Marcar elementos fijos: puertas, ventanas, radiadores, tomas de TV y enchufes | Ventana con radiador debajo, balcón |
| CU-04 | Colocar los muebles que ya se tienen (medidas propias) | Sofá rojo 162 × 110 × 78 |
| CU-05 | Añadir candidatos del catálogo con precio y enlace | MOSCÚ 236 × 85, 445 € + 90 € de envío |
| CU-06 | Duplicar la distribución en variantes y compararlas | M1…M4, K1…K4 |
| CU-07 | Recibir avisos: no hay paso, tapa el radiador, choca con el barrido de la puerta | "Solo 52 cm de paso hacia el balcón" |
| CU-08 | Recorrer la casa en 3D (órbita y primera persona) | Ver si la chaise tapa la ventana |
| CU-09 | Ver el presupuesto de cada variante frente a un tope | 535 € de 700 € |
| CU-10 | Exportar un PDF/PNG para enseñarlo, o llevar el proyecto a otro ordenador | Enseñárselo a la pareja o al casero |
| CU-11 | Elementos de temporada que se activan y desactivan | Árbol de Navidad |

---

## 3. Entrada del plano

### 3.1 Qué da realmente el Catastro (verificado)

- La **Sede Electrónica del Catastro** da, por referencia catastral (RC), la *consulta descriptiva y gráfica* en **PDF**: datos del inmueble (uso, superficie construida, año) y un plano/croquis con **la geometría básica y el perímetro**. **No incluye la distribución interior** (tabiques, puertas) ni medidas exactas de las estancias.
- Servicios web públicos:
  - **INSPIRE Buildings WFS** (`http://ovc.catastro.meh.es/INSPIRE/wfsBU.aspx`): consultas guardadas `GetBuildingByParcel`, `GetBuildingPartByParcel` y `GetOtherBuildingByParcel` por RC. Devuelve la huella del edificio y sus partes en GML, con sistemas de referencia EPSG:4326, 4258 y 25829–25831. Límite de 4 km² y 5.000 elementos por petición. No da la planta interior.
  - **OVCCallejero** (`Consulta_DNPRC` por RC): datos descriptivos como uso, superficie y año. *Validar el formato exacto de respuesta al implementarlo.*

**Conclusión de diseño:** el Catastro sirve como **plantilla de fondo y como comprobación de superficie**, no como plano automático. El flujo principal es *importar imagen/PDF → calibrar escala → calcar*.

### 3.2 Flujo "Importar plano" (fase 1)

1. El usuario elige un archivo: PDF (catastro, inmobiliaria, arquitecto), PNG/JPG (foto o escaneo) o, más adelante, DXF.
2. PDF: se renderiza la página elegida con `pdfjs-dist` a 300 ppp en un canvas que queda como **capa de fondo** del nivel. Se guarda en `assets/` del proyecto.
3. **Calibración:** el usuario marca dos puntos y escribe la distancia real ("este muro mide 450 cm"). La app calcula cm/píxel. Opcionalmente añade un segundo par de puntos para comprobar la escala y avisa si se desvía más de un 2 %.
4. **Enderezar:** rotación fina del fondo (±15°) para alinear los muros con los ejes.
5. **Calcar** con la herramienta de muros (§4) usando el fondo con opacidad regulable (0–100 %).
6. **Comprobación de superficie:** si hay datos del Catastro, se compara su superficie con la suma de las estancias calcadas y se avisa si la diferencia supera el 10 %. Es normal: la superficie construida incluye muros y zonas comunes.

### 3.3 Flujo "Consultar Catastro" (fase 3, opcional, con red)

- Botón con icono de red. Pide la RC de 20 caracteres y valida su formato y dígitos de control.
- Descarga la huella (WFS) y los datos descriptivos, y los guarda en el proyecto (`project.catastro`) para no volver a pedirlos.
- No envía nada más que la RC. Si falla o no hay red, muestra un mensaje y la app sigue funcionando.

### 3.4 Flujo "Dibujar a mano" (fase 1)

- **Habitación rectangular rápida:** ancho × fondo × alto → genera 4 muros.
- **Muro a muro:** clic-clic con longitud escrita por teclado ("450 ↵"), ángulos con imán a 0/45/90°, cierre automático del polígono.
- **Grosor de muro** por defecto: 10 cm para tabique y 25 cm para fachada, editables.
- **Altura de techo** por nivel (por defecto 250 cm).
- **Cotas automáticas** interiores y exteriores, editables: cambiar una cota mueve el muro.

---

## 4. Editor 2D

### 4.1 Capas (de abajo arriba)

1. Fondo (imagen/PDF calibrado)
2. Suelos / habitaciones (polígonos con nombre, color y área en m²)
3. Alfombras
4. Muros (relleno sólido, uniones limpias en L/T/X con clipper2)
5. Huecos: puertas (con arco de barrido) y ventanas (con alféizar)
6. Elementos fijos: radiadores, tomas de TV, enchufes, puntos de luz, columnas
7. Muebles
8. Cotas y textos
9. Avisos (resaltes rojos y naranjas del motor de reglas)
10. Zonas de trabajo (rectángulos discontinuos, como la "zona útil 230 cm" del salón)

Cada capa se puede mostrar, ocultar y bloquear.

### 4.2 Herramientas

| Herramienta | Atajo | Comportamiento |
|---|---|---|
| Seleccionar / mover | V | Arrastre con imán a muros (respaldo pegado a pared), a otros muebles y a la rejilla (1/5/10 cm) |
| Rotar | R | Pasos de 90°; con Shift, 15°; valor numérico en el panel |
| Muro | W | Ver §3.4 |
| Habitación | H | Rectángulo o polígono → crea muros y suelo |
| Puerta | D | Se engancha al muro; ancho 72/82/92 cm, sentido de apertura y lado de bisagras |
| Ventana | N | Ancho, altura de alféizar y altura del hueco |
| Elemento fijo | F | Radiador, toma, enchufe… |
| Medir | M | Distancia libre entre dos puntos o entre dos objetos (mínima entre bordes) |
| Zona | Z | Rectángulo de referencia con etiqueta |
| Duplicar | Ctrl+D | |
| Deshacer / rehacer | Ctrl+Z / Ctrl+Y | Historial de al menos 200 pasos |

### 4.3 Panel de propiedades

Para un mueble: nombre, producto de catálogo enlazado, ancho/fondo/alto, x/y/rotación, color o acabado, variante de orientación (chaise a izquierda o derecha), estado (*tengo*, *candidato*, *descartado*), precio y "visible solo en temporada".

### 4.4 Representación

- Los sofás muestran el respaldo con una banda más oscura en el lado trasero y la chaise o los asientos extendidos con transparencia y línea discontinua (para que se vea la "huella extendida").
- Los muebles con partes móviles (cajones, puertas de armario, asientos deslizantes, cama abatible) tienen una **huella de uso** dibujada en discontinua que también cuenta para las reglas.
- Escala gráfica y flecha de norte (opcional, sale del Catastro o se pone a mano).

---

## 5. Visor 3D

- **Generado al vuelo** a partir del modelo: muros extruidos con huecos recortados, suelo, techo opcional (oculto en vista órbita) y rodapié.
- **Cámaras:**
  - *Órbita* (por defecto): con el muro más cercano a la cámara oculto o semitransparente ("cutaway") para ver dentro.
  - *Primera persona:* altura de ojos de 165 cm, WASD + ratón, colisión con muros.
  - *Planta:* ortográfica cenital.
- **Muebles:**
  - **Paramétricos procedurales** por defecto (como en el salón): un sofá son base + cojín de asiento + respaldo de altura `bh` + brazos de 56 cm. Funciona sin modelos 3D y respeta las medidas exactas del catálogo.
  - **GLB opcional** por producto, importado por el usuario, escalado automáticamente a las medidas del catálogo con su caja contenedora.
- **Iluminación:** hemisférica + sol direccional que entra por las ventanas (orientación de la ventana y hora del día ajustables) + sombras PCF suaves.
- **Materiales:** biblioteca local de suelos (tarima, gres, laminado), pinturas de pared (color libre) y tejidos (color libre). Texturas propias o CC0, empaquetadas.
- **Rendimiento:** 60 fps con 300 muebles en un portátil con gráfica integrada. Instancing para sillas repetidas y geometrías compartidas.

---

## 6. Variantes (escenarios)

- Un proyecto tiene **una base** (muros, huecos, fijos y muebles que no cambian) y **N variantes** que guardan solo las diferencias: muebles añadidos, quitados o movidos.
- Vista **comparar**: 2, 4 u 8 variantes en cuadrícula, cada una con su mini plano, su miniatura 3D, su presupuesto y su número de avisos. Así se replican M1–M4 y K1–K4.
- Puntuación opcional de cada variante (0–5) y notas libres.
- Promocionar una variante a base.

---

## 7. Motor de reglas (avisos)

Reglas declarativas en `src/rules/` con sus valores en `docs/CATALOGO_Y_ERGONOMIA.md`. Cada regla devuelve `{ id, severidad: 'error'|'aviso'|'info', objetos, mensaje, geometria }`.

Reglas mínimas para la fase 2:

1. **Colisión** entre muebles, o entre un mueble y un muro, un hueco o un fijo (error).
2. **Paso libre** entre obstáculos en las rutas puerta↔puerta y puerta↔ventana, calculado con un mapa de ocupación de rejilla de 5 cm y búsqueda del camino más ancho: menos de 60 cm es error y de 60 a 80 cm es aviso.
3. **Barrido de puertas** (abatibles, cajones, armarios) libre.
4. **Radiador:** al menos 10 cm entre el radiador y la trasera del mueble, y nada encima.
5. **Ventana:** aviso si un mueble más alto que el alféizar la tapa más de un 30 %.
6. **TV:** distancia del asiento principal entre 1,2 y 2,5 veces la diagonal (configurable) y ángulo de visión ≤ 30° desde el eje.
7. **Comedor:** 75 cm libres detrás de cada silla para poder sacarla.
8. **Huella extendida:** las reglas 1–3 se evalúan también con chaises, asientos deslizantes y camas abatibles **extendidos**, con un aviso distinto ("al sacar los asientos…").
9. **Elementos de temporada:** las reglas se pueden evaluar con o sin ellos.

---

## 8. Catálogo de productos

Ver `docs/CATALOGO_Y_ERGONOMIA.md` para categorías, plantillas paramétricas y medidas por defecto.

- Base de datos local SQLite con dos tipos de entrada:
  - **Genéricos** (vienen con la app): "Sofá 3 plazas 210 × 90", "Cama 150 × 190", "Frigorífico combi 60 × 65 × 185"…
  - **Productos reales** (los mete el usuario): marca, modelo, tienda, URL, precio, gastos de envío, medidas, medidas extendidas, color, notas, fotos locales y GLB opcional.
- Alta rápida: pegar texto con medidas ("236 x 85 x 85 cm") y que se interpreten ancho × fondo × alto.
- Importar y exportar CSV/JSON.
- Filtros: categoría, ancho máximo ("que quepa en 240"), precio máximo, *tengo / candidato*, tienda.
- **"¿Dónde cabe?"**: al elegir un producto, se resaltan las posiciones de la planta donde cabe sin errores (barrido por rejilla de 10 cm y rotaciones de 0/90/180/270°).

---

## 9. Hoja de ruta

| Fase | Contenido | Criterio de aceptación |
|---|---|---|
| **0. Esqueleto** (1–2 semanas) | Tauri + React + TS + Vite; stores; modelo zod; abrir y guardar `.planocasa`; i18n; CI local | Abre `salon-madrid.json`, lo guarda y lo vuelve a abrir sin diferencias |
| **1. Plano 2D** | Muros, habitaciones, huecos, fijos, cotas, importar PDF/imagen y calibrar, deshacer | Reproducir el salón a partir de una foto del plano en menos de 15 minutos |
| **2. Muebles + reglas** | Catálogo genérico, colocar, rotar, imanes, huella extendida, reglas 1–9 | Las 8 variantes del salón dan los mismos avisos que el análisis manual (radiador, paso al balcón en M2/K2) |
| **3. 3D** | Muros con huecos, procedurales, órbita y cutaway, primera persona, sol | Las vistas del salón coinciden con las del prototipo HTML |
| **4. Variantes + presupuesto** | Variantes por diferencias, vista comparar, presupuesto y tope | Cuadrícula M1–M4 / K1–K4 con sus precios (MOSCÚ 535 €, KANSAS 477 € con envío) |
| **5. Catálogo real + exportación** | Productos del usuario, fotos, GLB, CSV, "¿Dónde cabe?", PDF/PNG/GLB | PDF de una variante con plano, vista 3D y lista de compra |
| **6. Extras** | Catastro (WFS + DNPRC), DXF, varias plantas, plantillas de estancias | Proyecto creado desde una RC real |

---

## 10. Modelo de datos (resumen)

El esquema completo se define con zod en `src/model/`. Ejemplo en `docs/fixtures/salon-madrid.json`.

```ts
Project {
  schemaVersion: 1
  id: string; name: string; createdAt: string; updatedAt: string
  units: 'cm'
  catastro?: { rc: string; superficieM2?: number; uso?: string; anio?: number; huellaGeoJSON?: object }
  levels: Level[]
  variants: Variant[]          // la primera es 'base'
  activeVariantId: string
  budget?: { objetivo: number; tope: number; moneda: 'EUR' }
  catalog: CatalogItem[]       // copia de los productos usados, para que el archivo sea autosuficiente
}
// Coordenadas: x,y de Item/Fixture = CENTRO; rotation 0 = frente hacia +Y (ver CLAUDE.md §4)

Level { id; name; elevation: number; ceilingHeight: number
  background?: { asset: string; page?: number; cmPerPx: number; offset: {x,y}; rotation: number; opacity: number }
  walls: Wall[]; openings: Opening[]; rooms: Room[]; fixtures: Fixture[]; zones: Zone[] }

Wall     { id; a:{x,y}; b:{x,y}; thickness; height?; kind: 'tabique'|'fachada'|'carga' }
Opening  { id; wallId; offset; width; kind: 'puerta'|'ventana'|'balconera'|'hueco'
           height; sill?: number; hinge?: 'izq'|'der'; swing?: 'dentro'|'fuera'|'corredera' }
Room     { id; name; polygon:{x,y}[]; floorMaterial?; wallColor? }
Fixture  { id; kind: 'radiador'|'toma_tv'|'enchufe'|'punto_luz'|'columna'|'espejo'
           wallId?; x; y; w; d; h; z? }
Zone     { id; label; x; y; w; d }

Variant  { id; name; notes?; score?; parentId?: string
           items: Item[]          // en la base, todos; en las demás, los que añaden o sobrescriben
           removed: string[] }    // ids de items de la base que esta variante quita

Item     { id; catalogId?: string; name; category
           x; y; w; d; h; rotation; z?: number
           params?: Record<string, number|string>   // p. ej. { backHeight: 97, chaiseSide: 'izq', chaiseLen: 146 }
           extended?: { w; d } | { shape: {x,y}[] }  // huella con chaise o asientos sacados
           color?; status: 'tengo'|'candidato'|'descartado'; seasonal?: boolean }

CatalogItem { id; generic: boolean; category; brand?; model?; store?; url?
              price?; shipping?; currency: 'EUR'
              w; d; h; seatHeight?; extended?: {w; d}
              template: 'sofa'|'sofa_chaise'|'cama'|'mesa'|'silla'|'armario'|'caja'|'tv'|'electrodomestico'|'planta'|'arbol'|'alfombra'|…
              params?: Record<string, number|string>
              images?: string[]; model3d?: string; notes?: string; tags?: string[] }
```

---

## 11. Requisitos no funcionales

- **Privacidad:** CSP de Tauri `default-src 'self'`; capacidades `fs` limitadas a las rutas elegidas por el usuario y a `$APPDATA/planocasa`; sin el plugin `http` salvo el comando Rust del Catastro, que tiene un dominio en lista blanca.
- **Robustez:** autoguardado cada 60 s en `$APPDATA/planocasa/autosave/` con las últimas 10 copias; el guardado es atómico (escribe en un temporal y luego renombra).
- **Rendimiento:** abrir un proyecto en menos de 1 s; el 2D a 60 fps arrastrando; las reglas en menos de 50 ms por cambio (en un worker si hace falta).
- **Accesibilidad:** todo se puede hacer con el teclado en el 2D (mover con flechas, 1 cm o 10 cm con Shift) y los avisos no dependen solo del color.
- **Portabilidad:** `.planocasa` es un ZIP con un JSON legible; se puede abrir y arreglar a mano.
- **Licencias:** todo asset empaquetado es propio, CC0 o compatible, y queda registrado en `assets/LICENSES.md`.

## 12. Riesgos y decisiones abiertas

| Riesgo o duda | Mitigación |
|---|---|
| El usuario espera que el Catastro dé la distribución interior | Explicarlo en la UI: "El Catastro da el perímetro. Calca los tabiques encima." |
| Calcar a mano es tedioso | Fase 6: detección asistida de muros sobre el fondo (OpenCV.js empaquetado, todo local) |
| Las medidas de las tiendas no son fiables (p. ej. "225 cm" que en realidad es la cama) | Campos separados para medida cerrada y medida extendida, más una nota "verificado en tienda" |
| Tauri en Linux depende de WebKitGTK, que da menos rendimiento con WebGL | Windows es la plataforma principal; en Linux, probar y documentar |
| Los GLB de terceros pueden pesar mucho | Límite de 20 MB por modelo y LOD/decimado al importar |
