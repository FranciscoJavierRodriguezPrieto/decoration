/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Tauri espera un puerto fijo y no debe tapar los errores de Rust.
const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host ?? false,
    hmr: host ? { protocol: 'ws', host, port: 1421 } : undefined,
    watch: { ignored: ['**/src-tauri/**'] },
  },
  envPrefix: ['VITE_', 'TAURI_ENV_'],
  build: {
    // WebView2 (Windows) es Chromium moderno; WebKit en macOS/Linux, Safari 15+.
    target: process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome110' : 'safari15',
    minify: process.env.TAURI_ENV_DEBUG ? false : 'esbuild',
    sourcemap: Boolean(process.env.TAURI_ENV_DEBUG),
    // App local: un único bundle grande no penaliza (no hay red).
    chunkSizeWarningLimit: 1500,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: [
        'src/model/**',
        'src/geometry/**',
        'src/rules/**',
        'src/store/**',
        'src/io/**',
        'src/viewer3d/**/*.ts',
      ],
      // Pegamento con DOM/Tauri/React: lo cubren los e2e, no los unitarios.
      exclude: [
        '**/*.test.ts',
        'src/model/index.ts',
        'src/io/fileGateway.ts',
        'src/store/hooks.ts',
        // Texturas pintadas en un <canvas>: necesitan DOM.
        'src/viewer3d/materials.ts',
      ],
      thresholds: { lines: 90, functions: 90, branches: 85, statements: 90 },
    },
  },
});
