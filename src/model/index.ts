/**
 * API pública del modelo. Los esquemas zod se exportan agrupados en `schemas`
 * (p. ej. `schemas.Item`) y los tipos con su nombre (p. ej. `Item`), para que el
 * mismo identificador no signifique dos cosas.
 */
export * as schemas from './schemas';
export { SCHEMA_VERSION } from './schemas';
export * from './project';
export * from './variants';
export { migrate, MigrationError, MIGRATIONS } from './migrations';
