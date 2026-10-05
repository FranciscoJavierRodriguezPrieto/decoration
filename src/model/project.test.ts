import { describe, expect, it } from 'vitest';
import { clone, loadFixture } from '../../tests/helpers';
import { ProjectSchema, type Project } from './project';

const valid = loadFixture('salon-madrid.json');

/** Devuelve los mensajes de error de validar `p` (vacío si es válido). */
function errorsOf(p: unknown): string[] {
  const r = ProjectSchema.safeParse(p);
  return r.success ? [] : r.error.issues.map((i) => i.message);
}

function mutate(fn: (p: Project) => void): Project {
  const p = clone(valid);
  fn(p);
  return p;
}

describe('ProjectSchema · forma', () => {
  it('acepta el fixture', () => {
    expect(errorsOf(valid)).toEqual([]);
  });

  it('rechaza claves desconocidas (no se pierden datos en silencio)', () => {
    expect(errorsOf({ ...clone(valid), sorpresa: 1 })).not.toEqual([]);
  });

  it('rechaza medidas que no son múltiplo de 0,5 cm', () => {
    const p = mutate((p) => {
      p.variants[0]!.items[0]!.w = 140.3;
    });
    expect(errorsOf(p)).toContain('Debe ser múltiplo de 0,5 cm');
  });

  it('rechaza medidas no positivas', () => {
    const p = mutate((p) => {
      p.variants[0]!.items[0]!.d = 0;
    });
    expect(errorsOf(p)).toContain('Debe ser mayor que 0');
  });

  it('rechaza rotaciones fuera de [0, 360)', () => {
    const p = mutate((p) => {
      p.variants[0]!.items[0]!.rotation = 360;
    });
    expect(errorsOf(p)).not.toEqual([]);
  });

  it('rechaza muros de longitud 0', () => {
    const p = mutate((p) => {
      const w = p.levels[0]!.walls[0]!;
      w.b = { ...w.a };
    });
    expect(errorsOf(p)).toContain('Un muro no puede tener longitud 0');
  });

  it('rechaza un presupuesto con objetivo mayor que el tope', () => {
    const p = mutate((p) => {
      p.budget = { objetivo: 800, tope: 700, moneda: 'EUR' };
    });
    expect(errorsOf(p)).toContain('El objetivo no puede superar el tope');
  });

  it('rechaza una versión de esquema distinta', () => {
    expect(errorsOf({ ...clone(valid), schemaVersion: 2 })).not.toEqual([]);
  });

  it('rechaza colores que no son #rrggbb', () => {
    const p = mutate((p) => {
      p.variants[0]!.items[0]!.color = 'rojo';
    });
    expect(errorsOf(p)).toContain('Color #rrggbb');
  });

  it('valida el formato de la referencia catastral', () => {
    const ok = mutate((p) => {
      p.catastro = { rc: '1234567AB1234C0001DE' };
    });
    const ko = mutate((p) => {
      p.catastro = { rc: 'no-es-una-rc' };
    });
    expect(errorsOf(ok)).toEqual([]);
    expect(errorsOf(ko)).not.toEqual([]);
  });
});

describe('ProjectSchema · integridad referencial', () => {
  it('detecta un hueco en un muro inexistente', () => {
    const p = mutate((p) => {
      p.levels[0]!.openings[0]!.wallId = 'no_existe';
    });
    expect(errorsOf(p).join()).toMatch(/muro inexistente/);
  });

  it('detecta un hueco que se sale del muro', () => {
    const p = mutate((p) => {
      p.levels[0]!.openings[0]!.offset = 450;
    });
    expect(errorsOf(p).join()).toMatch(/se sale del muro/);
  });

  it('acepta un hueco que llega justo al final del muro', () => {
    const p = mutate((p) => {
      const o = p.levels[0]!.openings[0]!; // w_entrada mide 500
      o.offset = 410;
      o.width = 90;
    });
    expect(errorsOf(p)).toEqual([]);
  });

  it('detecta un fijo enganchado a un muro inexistente', () => {
    const p = mutate((p) => {
      p.levels[0]!.fixtures[0]!.wallId = 'fantasma';
    });
    expect(errorsOf(p).join()).toMatch(/elemento fijo/);
  });

  it('detecta ids repetidos dentro de un nivel', () => {
    const p = mutate((p) => {
      p.levels[0]!.zones[0]!.id = 'w_sofa';
    });
    expect(errorsOf(p).join()).toMatch(/Id repetido dentro del nivel/);
  });

  it('detecta niveles, variantes y productos repetidos', () => {
    const p = mutate((p) => {
      p.levels.push(clone(p.levels[0]!));
      p.variants[2]!.id = 'M1';
      p.catalog.push(clone(p.catalog[0]!));
    });
    const msg = errorsOf(p).join('\n');
    expect(msg).toMatch(/Id de nivel repetido/);
    expect(msg).toMatch(/Id de variante repetido/);
    expect(msg).toMatch(/Id de catálogo repetido/);
  });

  it('detecta muebles repetidos en una variante', () => {
    const p = mutate((p) => {
      const items = p.variants[1]!.items;
      items.push(clone(items[0]!));
    });
    expect(errorsOf(p).join()).toMatch(/Id de mueble repetido/);
  });

  it('exige que la primera variante sea la base sin padre', () => {
    const p = mutate((p) => {
      p.variants[0]!.parentId = 'M1';
    });
    expect(errorsOf(p).join()).toMatch(/primera variante/);
  });

  it('detecta una variante activa inexistente', () => {
    const p = mutate((p) => {
      p.activeVariantId = 'Z9';
    });
    expect(errorsOf(p).join()).toMatch(/variante activa no existe/);
  });

  it('exige padre en las variantes que no son la base', () => {
    const p = mutate((p) => {
      delete p.variants[1]!.parentId;
    });
    expect(errorsOf(p).join()).toMatch(/necesita un padre/);
  });

  it('detecta un padre inexistente', () => {
    const p = mutate((p) => {
      p.variants[1]!.parentId = 'nada';
    });
    expect(errorsOf(p).join()).toMatch(/padre inexistente/);
  });

  it('detecta ciclos de herencia', () => {
    const p = mutate((p) => {
      p.variants[1]!.parentId = 'M2';
      p.variants[2]!.parentId = 'M1';
    });
    expect(errorsOf(p).join()).toMatch(/Ciclo de herencia/);
  });

  it('detecta muebles que apuntan a productos inexistentes', () => {
    const p = mutate((p) => {
      p.variants[1]!.items[0]!.catalogId = 'cat-fantasma';
    });
    expect(errorsOf(p).join()).toMatch(/producto inexistente/);
  });

  it('impide que la base quite muebles', () => {
    const p = mutate((p) => {
      p.variants[0]!.removed = ['tv'];
    });
    expect(errorsOf(p).join()).toMatch(/base no puede quitar/);
  });
});
