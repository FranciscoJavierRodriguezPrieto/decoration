# Catálogo genérico, plantillas paramétricas y reglas ergonómicas

Todas las medidas están en **cm** con el formato **ancho × fondo × alto**. El ancho se mide de frente, el fondo de delante atrás y el alto desde el suelo. Son valores por defecto habituales en el mercado español y el usuario puede editarlos todos.

---

## 1. Plantillas paramétricas 3D

Cada plantilla genera su malla 3D y su huella 2D a partir de unos pocos parámetros. Si un producto no tiene GLB, se usa su plantilla.

| Plantilla | Parámetros (valor por defecto) | Construcción 3D |
|---|---|---|
| `sofa` | backHeight 74, armHeight 56, armWidth 18, seatHeight 42, legHeight 8, cushionThickness 12 | base + cojines + respaldo + 2 brazos |
| `sofa_chaise` | lo de `sofa` + chaiseSide `izq`/`der`, chaiseDepth (fondo total), reversible | sofá + módulo chaise sin respaldo en el lado elegido |
| `sofa_deslizante` | lo de `sofa` + slideExtra 40–60, seatsCount 2–3 | igual que sofa; la huella extendida es el fondo + slideExtra |
| `rinconera` | ladoA, ladoB, depth | dos sofás unidos en L |
| `cama` | mattressW, mattressL, headboardH 110, bedH 50 | somier + colchón + cabecero |
| `mesa` | topThickness 4, legInset 5, shape `rect`/`redonda`/`ovalada` | tablero + 4 patas o pie central |
| `silla` | seatH 45, backH 90 | asiento + respaldo + patas |
| `armario` | doors 2–4, doorType `abatible`/`corredera`, plinth 8 | cuerpo + puertas; huella de uso por tipo de puerta |
| `mueble_bajo` | drawers, doors | caja + frentes |
| `estanteria` | shelves 5, open true/false | laterales + baldas |
| `tv` | diagonalInch | panel 16:9 (ancho = 2,214 cm × pulgadas; alto = 1,245 cm × pulgadas) + peana o anclaje a pared |
| `electrodomestico` | type, doorSide | caja con frontal y tiradores |
| `planta` | potH, foliageR | maceta + esfera o cono |
| `arbol` | height 180, radius 37 | 3 conos + estrella + bolas (árbol de Navidad del salón) |
| `alfombra` | shape | plano de 1 cm |
| `caja` | — | caja genérica (comodín) |

## 2. Catálogo genérico de serie

### Salón
| Elemento | Medidas | Notas |
|---|---|---|
| Sofá 2 plazas | 160 × 90 × 85 | |
| Sofá 3 plazas | 210 × 92 × 85 | |
| Sofá 3 plazas XL | 235 × 95 × 90 | |
| Sofá chaise longue | 240 × 90 (chaise 150–160) × 88 | reversible |
| Sofá asientos deslizantes | 230 × 95 (extendido 155) × 100 | respaldos reclinables más altos |
| Rinconera | 260 × 200 × 85 | |
| Sillón | 80 × 85 × 95 | |
| Puff | 50 × 50 × 42 | |
| Mesa de centro | 110 × 60 × 42 | |
| Mueble TV | 140–180 × 40 × 45–55 | |
| TV 55" | 123 × 8 × 71 | ~123 × 78 con peana |
| TV 65" | 145 × 8 × 83 | |
| Estantería | 80 × 35 × 180 | |
| Alfombra | 160 × 230 / 200 × 290 | |

### Comedor
| Elemento | Medidas | Comensales |
|---|---|---|
| Mesa rectangular | 120 × 80 × 75 | 4 |
| Mesa rectangular | 160 × 90 × 75 | 6 |
| Mesa extensible | 140 (190) × 90 × 75 | 6–8 |
| Mesa redonda | Ø 100–110 × 75 | 4 |
| Silla | 45 × 52 × 85 | |
| Aparador | 160 × 45 × 80 | |

### Dormitorio
| Elemento | Medidas (colchón) | Huella aproximada con cama |
|---|---|---|
| Cama individual | 90 × 190 | 100 × 205 |
| Cama 105 | 105 × 190 | 115 × 205 |
| Cama de matrimonio 135 | 135 × 190 | 145 × 205 |
| Cama 150 | 150 × 190 / 200 | 160 × 210 |
| Cama 160 | 160 × 200 | 170 × 215 |
| Cama 180 | 180 × 200 | 190 × 215 |
| Mesita de noche | 45 × 40 × 50 | |
| Cómoda | 100 × 45 × 80 | |
| Armario 2 puertas | 100 × 60 × 200 | |
| Armario 3 puertas | 150 × 60 × 220 | |
| Armario corredera | 200 × 65 × 230 | |
| Escritorio | 120 × 60 × 75 | |
| Silla de escritorio | 60 × 60 × 100 | radio de giro de 50 |

### Cocina y lavado (módulos estándar de 60)
| Elemento | Medidas |
|---|---|
| Frigorífico combi | 60 × 65 × 185–200 |
| Frigorífico americano | 91 × 72 × 178 |
| Lavadora | 60 × 60 × 85 |
| Secadora | 60 × 60 × 85 (o en columna sobre la lavadora) |
| Lavavajillas | 60 × 60 × 82 (45 de ancho el compacto) |
| Horno | 60 × 55 × 60 |
| Placa | 60 × 52 |
| Módulo bajo | 30/40/60/80 × 60 × 85 (encimera 90) |
| Módulo alto | 30/40/60/80 × 35 × 70 (a 145 del suelo) |
| Microondas | 50 × 40 × 30 |

### Baño
| Elemento | Medidas |
|---|---|
| Inodoro | 37 × 65 × 80 |
| Lavabo con mueble | 60–80 × 45 × 85 |
| Plato de ducha | 80 × 120 / 90 × 140 |
| Bañera | 70 × 160 / 75 × 170 |

### Mascotas y varios
| Elemento | Medidas |
|---|---|
| Cama de perro M | 80 × 60 × 20 |
| Cama de perro L | 100 × 75 × 25 |
| Comedero | 40 × 25 |
| Árbol de Navidad 180 | Ø 75 × 180 |
| Cubo de madera con planta | 40 × 30 × 40 + planta |

## 3. Valores para las reglas (configurables)

| Regla | Mínimo (error) | Recomendado (aviso por debajo) |
|---|---|---|
| Paso general | 60 | 80–90 |
| Paso principal (entrada ↔ estancias) | 75 | 90–100 |
| Entre sofá y mesa de centro | 30 | 40–45 |
| Detrás de una silla de comedor | 60 | 75–90 |
| Laterales y pie de cama | 50 | 60–70 |
| Frente a un armario abatible | ancho de la hoja + 10 | 90 |
| Frente a un armario de correderas | 60 | 70 |
| Frente a cajones | fondo del cajón + 30 | 90 |
| Frente al horno, el lavavajillas o la lavadora | 90 | 110–120 |
| Pasillo de cocina (entre frentes) | 90 | 110–120 |
| Radiador ↔ trasera del mueble | 10 | 15 |
| Delante de un radiador (si es un mueble bajo) | 10 | — |
| Distancia a la TV | 1,2 × diagonal | 1,5–2,5 × diagonal |
| Ángulo de visión de la TV | — | ≤ 30° desde el eje |
| Ventana tapada por un mueble alto | — | ≤ 30 % de su ancho |

Conversión de la diagonal: `cm = pulgadas × 2,54`. Por ejemplo, una TV de 55" mide unos 140 cm de diagonal, así que lo recomendado son 1,7–3,5 m.

## 4. Formato de importación CSV del catálogo

```csv
categoria,marca,modelo,tienda,url,precio,envio,ancho,fondo,alto,ancho_ext,fondo_ext,plantilla,parametros,estado,notas
sofa,,MOSCU,Atrapamuebles,https://www.atrapamuebles.com/...,445,90,236,85,85,236,146,sofa_chaise,"chaiseSide=izq;reversible=1;arcon=1",candidato,"Cama, arcón, 2 puffs"
sofa,,KANSAS XL,Atrapamuebles,https://www.atrapamuebles.com/...,399,78,235,80,105,235,140,sofa_deslizante,"backHeight=97;slideExtra=60",candidato,"Desenfundable, hecho en España"
sofa,,Sofá rojo,,,0,0,162,110,78,,,sofa,,tengo,
```

> El `fondo_ext` de 140 del KANSAS es una estimación de ejemplo (80 + 60 de deslizamiento). Hay que verificarlo con la ficha del producto.

## 5. Interpretar medidas pegadas

Hay que aceptar entradas como `236x85x85`, `236 × 85 × 85 cm`, `L236 P85 H85`, `Ancho: 236 cm Fondo: 85 cm Alto: 85 cm` o `2,36 m x 0,85 m`. Por defecto se interpretan como ancho × fondo × alto y la UI pide confirmación cuando hay ambigüedad (por ejemplo, si el segundo valor es mayor que el primero en un sofá).
