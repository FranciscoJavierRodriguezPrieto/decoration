import { describe, expect, it } from 'vitest';
import { migrate, MigrationError, type Migrator } from './index';

describe('migrate', () => {
  it('deja intacto un documento de la versión actual', () => {
    const doc = { schemaVersion: 1, name: 'x' };
    expect(migrate(doc)).toBe(doc);
  });

  it('rechaza lo que no es un objeto', () => {
    expect(() => migrate([])).toThrow(MigrationError);
    expect(() => migrate(null)).toThrow(MigrationError);
    expect(() => migrate('hola')).toThrow(MigrationError);
  });

  it('rechaza schemaVersion ausente o inválida', () => {
    expect(() => migrate({})).toThrow(/schemaVersion/);
    expect(() => migrate({ schemaVersion: 0 })).toThrow(/schemaVersion/);
    expect(() => migrate({ schemaVersion: 1.5 })).toThrow(/schemaVersion/);
  });

  it('rechaza proyectos de una versión más nueva', () => {
    expect(() => migrate({ schemaVersion: 99 })).toThrow(/más nueva/);
  });

  it('encadena migradores hasta la versión destino', () => {
    const steps: Record<number, Migrator> = {
      1: (d) => ({ ...d, schemaVersion: 2, a: true }),
      2: (d) => ({ ...d, schemaVersion: 3, b: true }),
    };
    expect(migrate({ schemaVersion: 1 }, steps, 3)).toEqual({ schemaVersion: 3, a: true, b: true });
  });

  it('falla si falta un paso', () => {
    expect(() => migrate({ schemaVersion: 1 }, {}, 2)).toThrow(/No hay migración/);
  });

  it('falla si un migrador no actualiza schemaVersion', () => {
    const steps: Record<number, Migrator> = { 1: (d) => ({ ...d }) };
    expect(() => migrate({ schemaVersion: 1 }, steps, 2)).toThrow(/no actualizó/);
  });
});
