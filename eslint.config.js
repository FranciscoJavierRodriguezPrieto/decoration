import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'src-tauri/target', 'src-tauri/gen', 'node_modules'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.strict],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      // Principio local-first: nada de fetch/XHR/WebSocket desde el front.
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: 'Prohibido: la app no hace peticiones de red (CLAUDE.md §1).' },
        { name: 'XMLHttpRequest', message: 'Prohibido: la app no hace peticiones de red.' },
        { name: 'WebSocket', message: 'Prohibido: la app no hace peticiones de red.' },
      ],
    },
  },
  {
    // En los tests, `!` documenta que el fixture tiene ese elemento.
    files: ['**/*.test.ts', 'tests/**/*.ts'],
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
  },
);
