import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import astroPlugin from 'eslint-plugin-astro'
import prettierConfig from 'eslint-config-prettier'

export default tseslint.config(
  js.configs.recommended,

  // Type-aware linting solo para TS/TSX puros. Los <script> dentro de .astro
  // usan astro-eslint-parser, que no soporta parserOptions.project; ahí se
  // aplican las reglas no-typed del plugin astro/recommended.
  {
    files: ['**/*.{ts,tsx}'],
    extends: [...tseslint.configs.strictTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },

  // .astro: las reglas TS las maneja eslint-plugin-astro (no se puede usar
  // strictTypeChecked porque el parser embebido no expone parserOptions.project).
  ...astroPlugin.configs.recommended,

  // Prettier al último: desactiva reglas de formato que Prettier ya gestiona
  prettierConfig,

  // Ignora artefactos de build y dependencias
  {
    ignores: ['dist/', '.astro/', '.vercel/', 'node_modules/'],
  },
)
