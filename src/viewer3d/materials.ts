/**
 * Materiales del visor generados en local (sin archivos ni red): las texturas
 * de suelo se pintan en un canvas al vuelo. ESPECIFICACION §5.
 */
import * as THREE from 'three';

export const FLOOR_MATERIALS = [
  'tarima_clara',
  'tarima',
  'laminado_gris',
  'gres',
  'hidraulico',
] as const;
export type FloorMaterial = (typeof FLOOR_MATERIALS)[number];

const cache = new Map<string, THREE.Texture>();

/** Generador pseudoaleatorio con semilla: la textura sale igual cada vez. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function planks(
  ctx: CanvasRenderingContext2D,
  size: number,
  base: [number, number, number],
  seed: number,
) {
  const r = rng(seed);
  const rows = 8;
  const h = size / rows;
  for (let i = 0; i < rows; i++) {
    let x = -r() * size * 0.5;
    while (x < size) {
      const len = size * (0.35 + r() * 0.4);
      const k = 0.93 + r() * 0.12;
      ctx.fillStyle = `rgb(${base.map((c) => Math.round(Math.min(255, c * k))).join(',')})`;
      ctx.fillRect(x, i * h, len, h);
      // Vetas.
      ctx.strokeStyle = 'rgba(80,50,20,0.08)';
      ctx.lineWidth = 1;
      for (let v = 0; v < 4; v++) {
        const y = i * h + r() * h;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.bezierCurveTo(
          x + len / 3,
          y + r() * 4 - 2,
          x + (2 * len) / 3,
          y + r() * 4 - 2,
          x + len,
          y,
        );
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(60,40,20,0.22)';
      ctx.strokeRect(x, i * h, len, h);
      x += len;
    }
  }
}

function tiles(
  ctx: CanvasRenderingContext2D,
  size: number,
  colors: string[],
  n: number,
  seed: number,
) {
  const r = rng(seed);
  const s = size / n;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      ctx.fillStyle = colors[Math.floor(r() * colors.length)] ?? '#ddd';
      ctx.fillRect(i * s, j * s, s, s);
    }
  }
  ctx.strokeStyle = 'rgba(120,110,100,0.5)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= n; i++) {
    ctx.beginPath();
    ctx.moveTo(i * s, 0);
    ctx.lineTo(i * s, size);
    ctx.moveTo(0, i * s);
    ctx.lineTo(size, i * s);
    ctx.stroke();
  }
}

/**
 * Textura de suelo. `repeatCm` es lo que mide la textura en el mundo real
 * (la escena va en cm).
 */
export function floorTexture(
  material: string | undefined,
): { map: THREE.Texture; repeatCm: number } | null {
  if (typeof document === 'undefined') return null;
  const key = material ?? 'tarima_clara';
  const repeatCm = key === 'gres' ? 180 : key === 'hidraulico' ? 120 : 160;
  const hit = cache.get(key);
  if (hit) return { map: hit, repeatCm };
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  switch (key) {
    case 'tarima':
      planks(ctx, size, [150, 104, 66], 7);
      break;
    case 'laminado_gris':
      planks(ctx, size, [176, 170, 160], 11);
      break;
    case 'gres':
      tiles(ctx, size, ['#d9d4cb', '#d4cec4', '#ddd8cf'], 3, 3);
      break;
    case 'hidraulico':
      tiles(ctx, size, ['#c9b79c', '#e8e1d3', '#9b6a52', '#e8e1d3'], 6, 5);
      break;
    default:
      planks(ctx, size, [226, 196, 152], 5);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  cache.set(key, tex);
  return { map: tex, repeatCm };
}
