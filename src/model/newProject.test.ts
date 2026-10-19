import { describe, expect, it } from 'vitest';
import { readFixture } from '../../tests/helpers';
import { parseProject, serializeProject } from '../io/projectJson';
import { evaluateRules } from '../rules';
import { createEmptyProject, newProjectId, referencedAssets } from './newProject';
import type { Project } from './project';

const NOW = '2026-10-19T10:00:00.000Z';

describe('createEmptyProject', () => {
  it('es válido, se guarda y se vuelve a abrir igual', () => {
    const p = createEmptyProject('casa-1', NOW);
    expect(p.levels).toHaveLength(1);
    expect(p.levels[0]?.walls).toEqual([]);
    expect(p.activeVariantId).toBe('base');
    const again = parseProject(serializeProject(p));
    expect(again.ok && again.project).toEqual(p);
  });

  it('las reglas no fallan con un plano vacío', () => {
    const p = createEmptyProject('casa-1', NOW, 'Piso de Luis');
    expect(p.name).toBe('Piso de Luis');
    expect(evaluateRules(p.levels[0]!, [], {})).toEqual([]);
  });

  it('newProjectId cumple el formato de Id', () => {
    expect(newProjectId(new Date(Date.UTC(2026, 9, 19)))).toMatch(/^casa-[a-z0-9]+$/);
  });
});

describe('referencedAssets', () => {
  it('el salón de ejemplo no usa assets', () => {
    const r = parseProject(readFixture('salon-madrid.json'));
    expect(r.ok && referencedAssets(r.project)).toEqual([]);
  });

  it('recoge fondos, imágenes y modelos del catálogo, sin repetir', () => {
    const p: Project = createEmptyProject('casa-1', NOW);
    p.levels[0] = {
      ...p.levels[0]!,
      background: {
        asset: 'fondo-1.pdf',
        page: 1,
        cmPerPx: 1,
        offset: { x: 0, y: 0 },
        rotation: 0,
        opacity: 0.5,
      },
    };
    p.catalog.push({
      id: 'sofa',
      generic: false,
      category: 'sofa',
      currency: 'EUR',
      w: 200,
      d: 90,
      h: 80,
      template: 'sofa',
      images: ['sofa.jpg', 'fondo-1.pdf'],
      model3d: 'sofa.glb',
    });
    expect(referencedAssets(p)).toEqual(['fondo-1.pdf', 'sofa.glb', 'sofa.jpg']);
  });
});
