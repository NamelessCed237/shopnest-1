import reactHooks from 'eslint-plugin-react-hooks'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import base from './base.js'

/** doc/04 §8 — l'accessibilité est vérifiée en CI, pas laissée à la bonne volonté. */
export default [
  ...base,
  {
    files: ['**/*.tsx'],
    plugins: { 'react-hooks': reactHooks, 'jsx-a11y': jsxA11y },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.configs.recommended.rules,
      'react-hooks/exhaustive-deps': 'error',
      'jsx-a11y/no-autofocus': 'off',
    },
  },
]
