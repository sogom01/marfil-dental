export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Máximo 100 caracteres en la línea del subject
    'header-max-length': [2, 'always', 100],
  },
}
