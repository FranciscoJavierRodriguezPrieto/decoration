import { describe, expect, it } from 'vitest';
import es from './es.json';
import { formatNumber, t } from './index';

describe('i18n', () => {
  it('traduce e interpola variables', () => {
    expect(t('project.walls', { n: 4 })).toBe('4 muros');
    expect(t('items.title', { variant: 'M1' })).toBe('Muebles de «M1»');
  });

  it('deja intactas las variables que no se pasan', () => {
    expect(t('project.walls', {})).toBe('{n} muros');
    expect(t('app.name')).toBe('PlanoCasa');
  });

  it('no tiene textos vacíos', () => {
    for (const [k, v] of Object.entries(es)) expect(v.trim(), k).not.toBe('');
  });

  it('formatea números en español', () => {
    expect(formatNumber(22.5)).toBe('22,5');
    expect(formatNumber(85.4123)).toBe('85,41');
  });
});
