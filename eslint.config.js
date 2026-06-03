import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import astroPlugin from 'eslint-plugin-astro'
import prettierConfig from 'eslint-config-prettier'

export default tseslint.config(
  js.configs.recommended,

  // TypeScript strict (sin type-checking por ahora; activar strictTypeChecked en Fase 2
  // cuando el proyecto esté completamente tipado)
  ...tseslint.configs.strict,

  // Soporte para archivos .astro
  ...astroPlugin.configs.recommended,

  // Prettier al último: desactiva reglas de formato que Prettier ya gestiona
  prettierConfig,

  // Reglas personalizadas
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },

  // Ignora artefactos de build y dependencias
  {
    ignores: ['dist/', '.astro/', '.vercel/', 'node_modules/'],
  },
)
