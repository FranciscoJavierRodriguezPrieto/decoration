/**
 * Esquemas zod del formato de proyecto PlanoCasa (ESPECIFICACION §10).
 *
 * Convenciones (CLAUDE.md §4, no cambiar sin ADR):
 *  - Longitudes en cm. Se admiten medios centímetros (p. ej. 42,5).
 *  - Origen arriba-izquierda, X a la derecha, Y hacia abajo.
 *  - x,y de Item/Fixture = CENTRO de la caja; rotation 0 = frente hacia +Y.
 *
 * Todos los objetos son `.strict()`: un archivo con claves desconocidas se rechaza
 * en vez de perder datos en silencio al guardarlo.
 */
import { z } from 'zod';

export const SCHEMA_VERSION = 1 as const;

// ---------------------------------------------------------------------------
// Primitivas
// ---------------------------------------------------------------------------

const isHalfCm = (n: number): boolean => Number.isInteger(n * 2);

/** Coordenada o medida en cm (múltiplo de 0,5). Puede ser negativa (coordenadas). */
export const Cm = z.number().finite().refine(isHalfCm, { message: 'Debe ser múltiplo de 0,5 cm' });

/** Medida estrictamente positiva en cm. */
export const PositiveCm = Cm.refine((n) => n > 0, { message: 'Debe ser mayor que 0' });

/** Medida no negativa en cm (alturas sobre el suelo, alféizares…). */
export const NonNegativeCm = Cm.refine((n) => n >= 0, { message: 'No puede ser negativa' });

/** Ángulo en grados, normalizado a [0, 360). */
export const Degrees = z.number().finite().gte(0).lt(360);

export const Id = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_.-]+$/, 'Solo letras, números, "_", "-" y "."');

export const IsoDateTime = z.string().datetime({ offset: true });

export const HexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color #rrggbb');

export const Point = z.object({ x: Cm, y: Cm }).strict();

/** Parámetros libres de plantilla (backHeight, chaiseSide, diagonalInch…). */
export const Params = z.record(
  z.string().min(1).max(64),
  z.union([z.number().finite(), z.string().max(256)]),
);

export const ExtendedFootprint = z.union([
  z.object({ w: PositiveCm, d: PositiveCm }).strict(),
  z.object({ shape: z.array(Point).min(3) }).strict(),
]);

// ---------------------------------------------------------------------------
// Nivel: muros, huecos, estancias, fijos y zonas
// ---------------------------------------------------------------------------

export const WallKind = z.enum(['tabique', 'fachada', 'carga']);

export const Wall = z
  .object({
    id: Id,
    a: Point,
    b: Point,
    thickness: PositiveCm,
    height: PositiveCm.optional(),
    kind: WallKind,
  })
  .strict()
  .refine((w) => w.a.x !== w.b.x || w.a.y !== w.b.y, {
    message: 'Un muro no puede tener longitud 0',
    path: ['b'],
  });

export const OpeningKind = z.enum(['puerta', 'ventana', 'balconera', 'hueco']);

export const Opening = z
  .object({
    id: Id,
    wallId: Id,
    offset: NonNegativeCm,
    width: PositiveCm,
    kind: OpeningKind,
    height: PositiveCm,
    sill: NonNegativeCm.optional(),
    hinge: z.enum(['izq', 'der']).optional(),
    swing: z.enum(['dentro', 'fuera', 'corredera']).optional(),
  })
  .strict();

export const Room = z
  .object({
    id: Id,
    name: z.string().min(1).max(120),
    polygon: z.array(Point).min(3),
    floorMaterial: z.string().max(64).optional(),
    wallColor: HexColor.optional(),
  })
  .strict();

export const FixtureKind = z.enum([
  'radiador',
  'toma_tv',
  'enchufe',
  'punto_luz',
  'columna',
  'espejo',
]);

export const Fixture = z
  .object({
    id: Id,
    kind: FixtureKind,
    wallId: Id.optional(),
    x: Cm,
    y: Cm,
    w: PositiveCm,
    d: PositiveCm,
    h: PositiveCm,
    z: NonNegativeCm.optional(),
  })
  .strict();

export const Zone = z
  .object({
    id: Id,
    label: z.string().min(1).max(120),
    x: Cm,
    y: Cm,
    w: PositiveCm,
    d: PositiveCm,
  })
  .strict();

export const Background = z
  .object({
    asset: z.string().min(1).max(255),
    page: z.number().int().positive().optional(),
    cmPerPx: z.number().finite().positive(),
    offset: z.object({ x: z.number().finite(), y: z.number().finite() }).strict(),
    rotation: z.number().finite().gte(-180).lte(180),
    opacity: z.number().finite().gte(0).lte(1),
  })
  .strict();

export const Level = z
  .object({
    id: Id,
    name: z.string().min(1).max(120),
    elevation: Cm,
    ceilingHeight: PositiveCm,
    background: Background.optional(),
    walls: z.array(Wall),
    openings: z.array(Opening),
    rooms: z.array(Room),
    fixtures: z.array(Fixture),
    zones: z.array(Zone),
  })
  .strict();

// ---------------------------------------------------------------------------
// Muebles y variantes
// ---------------------------------------------------------------------------

export const ItemStatus = z.enum(['tengo', 'candidato', 'descartado']);

export const Item = z
  .object({
    id: Id,
    catalogId: Id.optional(),
    name: z.string().min(1).max(120),
    category: z.string().min(1).max(64),
    x: Cm,
    y: Cm,
    w: PositiveCm,
    d: PositiveCm,
    h: PositiveCm,
    rotation: Degrees,
    z: NonNegativeCm.optional(),
    params: Params.optional(),
    extended: ExtendedFootprint.optional(),
    color: HexColor.optional(),
    status: ItemStatus,
    seasonal: z.boolean().optional(),
  })
  .strict();

export const Variant = z
  .object({
    id: Id,
    name: z.string().min(1).max(120),
    notes: z.string().max(4000).optional(),
    score: z.number().int().min(0).max(5).optional(),
    parentId: Id.optional(),
    items: z.array(Item),
    removed: z.array(Id),
  })
  .strict();

// ---------------------------------------------------------------------------
// Catálogo
// ---------------------------------------------------------------------------

export const Template = z.enum([
  'sofa',
  'sofa_chaise',
  'sofa_deslizante',
  'rinconera',
  'cama',
  'mesa',
  'silla',
  'armario',
  'mueble_bajo',
  'estanteria',
  'tv',
  'electrodomestico',
  'planta',
  'arbol',
  'alfombra',
  'caja',
]);

export const Currency = z.literal('EUR');

export const CatalogItem = z
  .object({
    id: Id,
    generic: z.boolean(),
    category: z.string().min(1).max(64),
    brand: z.string().max(120).optional(),
    model: z.string().max(120).optional(),
    store: z.string().max(120).optional(),
    url: z.string().url().max(2048).optional(),
    price: z.number().finite().nonnegative().optional(),
    shipping: z.number().finite().nonnegative().optional(),
    currency: Currency,
    w: PositiveCm,
    d: PositiveCm,
    h: PositiveCm,
    seatHeight: PositiveCm.optional(),
    extended: z.object({ w: PositiveCm, d: PositiveCm }).strict().optional(),
    template: Template,
    params: Params.optional(),
    images: z.array(z.string().max(255)).optional(),
    model3d: z.string().max(255).optional(),
    notes: z.string().max(4000).optional(),
    tags: z.array(z.string().max(64)).optional(),
  })
  .strict();

// ---------------------------------------------------------------------------
// Proyecto
// ---------------------------------------------------------------------------

export const Catastro = z
  .object({
    rc: z
      .string()
      .regex(/^[0-9A-Z]{14}([0-9]{4}[A-Z]{2})?$/, 'Referencia catastral de 14 o 20 caracteres'),
    superficieM2: z.number().finite().positive().optional(),
    uso: z.string().max(120).optional(),
    anio: z.number().int().min(1000).max(3000).optional(),
    huellaGeoJSON: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const Budget = z
  .object({
    objetivo: z.number().finite().nonnegative(),
    tope: z.number().finite().nonnegative(),
    moneda: Currency,
  })
  .strict()
  .refine((b) => b.objetivo <= b.tope, {
    message: 'El objetivo no puede superar el tope',
    path: ['objetivo'],
  });

/** Forma del proyecto sin comprobaciones cruzadas (ver `ProjectSchema`). */
export const ProjectShape = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    id: Id,
    name: z.string().min(1).max(200),
    createdAt: IsoDateTime,
    updatedAt: IsoDateTime,
    units: z.literal('cm'),
    catastro: Catastro.optional(),
    levels: z.array(Level).min(1),
    variants: z.array(Variant).min(1),
    activeVariantId: Id,
    budget: Budget.optional(),
    catalog: z.array(CatalogItem),
    /** Comentario libre para quien edite el JSON a mano. La app lo conserva y no lo usa. */
    _comentario: z.string().max(4000).optional(),
  })
  .strict();
