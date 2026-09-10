// ESLint flat configuration: recommended JS + typescript-eslint + React Hooks
// + React Fast Refresh rules, browser globals under src/, Node globals for
// scripts/ and *.config.* files, eslint-config-prettier applied last to turn
// off any rule that would conflict with Prettier formatting.
// Depends on: @eslint/js, typescript-eslint, eslint-plugin-react-hooks,
// eslint-plugin-react-refresh, globals, eslint-config-prettier.
// Depended on by: `npm run lint`, editor ESLint integrations.
import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: ['dist', 'dev-dist', 'node_modules', 'handoffs', 'playwright-report', 'test-results'],
  },
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    files: ['scripts/**/*.{ts,js,mjs}', '*.config.ts', '*.config.js', 'eslint.config.js'],
    languageOptions: {
      globals: globals.node,
    },
  },
  eslintConfigPrettier,
);
