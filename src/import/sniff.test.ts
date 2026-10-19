import { describe, expect, it } from 'vitest';
import { kindFromAssetName, sniffBackground } from './sniff';

const bytes = (s: string | number[]) =>
  typeof s === 'string' ? new TextEncoder().encode(s) : new Uint8Array(s);

describe('sniffBackground', () => {
  it('reconoce PDF, PNG, JPG y WEBP por su firma', () => {
    expect(sniffBackground(bytes('%PDF-1.7\n'))).toBe('pdf');
    expect(sniffBackground(bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe('png');
    expect(sniffBackground(bytes([0xff, 0xd8, 0xff, 0xe1]))).toBe('jpg');
    expect(sniffBackground(bytes('RIFF\0\0\0\0WEBPVP8 '))).toBe('webp');
  });

  it('rechaza lo demás aunque se llame .png', () => {
    expect(sniffBackground(bytes('MZ\x90'))).toBeNull();
    expect(sniffBackground(bytes('RIFF\0\0\0\0WAVE'))).toBeNull();
    expect(sniffBackground(bytes([]))).toBeNull();
  });
});

describe('kindFromAssetName', () => {
  it('por extensión, sin distinguir mayúsculas', () => {
    expect(kindFromAssetName('fondo-1.pdf')).toBe('pdf');
    expect(kindFromAssetName('fondo.JPEG')).toBe('jpg');
    expect(kindFromAssetName('fondo.jpg')).toBe('jpg');
    expect(kindFromAssetName('a.webp')).toBe('webp');
    expect(kindFromAssetName('a.png')).toBe('png');
    expect(kindFromAssetName('modelo.glb')).toBeNull();
  });
});
