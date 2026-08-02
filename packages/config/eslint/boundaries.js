import boundaries from 'eslint-plugin-boundaries'

/**
 * Applique le graphe de dépendances de doc/01-architecture.md §4.
 * Une violation ici est une erreur d'architecture, pas un détail de style.
 *
 *   contracts → (rien, sauf zod)
 *   utils / tokens → (rien)
 *   api-client → contracts, utils
 *   core → contracts, api-client, utils        [aucun JSX, aucun react-dom / react-native]
 *   ui-web → core, contracts, tokens, utils    [jamais ui-native]
 *   ui-native → core, contracts, tokens, utils [jamais ui-web]
 *   apps/api → contracts, utils uniquement
 *   apps/web-* → tout sauf ui-native
 *   apps/mobile → tout sauf ui-web
 */
export default [
  {
    plugins: { boundaries },
    settings: {
      'boundaries/elements': [
        { type: 'contracts', pattern: 'packages/contracts/**' },
        { type: 'utils', pattern: 'packages/utils/**' },
        { type: 'tokens', pattern: 'packages/tokens/**' },
        { type: 'i18n', pattern: 'packages/i18n/**' },
        { type: 'api-client', pattern: 'packages/api-client/**' },
        { type: 'core', pattern: 'packages/core/**' },
        { type: 'ui-web', pattern: 'packages/ui-web/**' },
        { type: 'ui-native', pattern: 'packages/ui-native/**' },
        { type: 'app-api', pattern: 'apps/api/**' },
        { type: 'app-web', pattern: 'apps/web-*/**' },
        { type: 'app-mobile', pattern: 'apps/mobile/**' },
      ],
    },
    rules: {
      'boundaries/element-types': [
        'error',
        {
          default: 'disallow',
          rules: [
            { from: 'contracts', allow: [] },
            { from: 'utils', allow: [] },
            { from: 'tokens', allow: [] },
            { from: 'i18n', allow: ['contracts', 'utils'] },
            { from: 'api-client', allow: ['contracts', 'utils'] },
            { from: 'core', allow: ['contracts', 'api-client', 'utils'] },
            { from: 'ui-web', allow: ['core', 'contracts', 'tokens', 'utils', 'i18n'] },
            { from: 'ui-native', allow: ['core', 'contracts', 'tokens', 'utils', 'i18n'] },
            // Le backend ne connaît ni React, ni les tokens, ni le client HTTP.
            { from: 'app-api', allow: ['contracts', 'utils'] },
            {
              from: 'app-web',
              allow: ['contracts', 'utils', 'tokens', 'i18n', 'api-client', 'core', 'ui-web'],
            },
            {
              from: 'app-mobile',
              allow: ['contracts', 'utils', 'tokens', 'i18n', 'api-client', 'core', 'ui-native'],
            },
          ],
        },
      ],
    },
  },
  {
    // doc/06 §4 — `core` est headless : aucun rendu, aucune plateforme.
    files: ['packages/core/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'react-dom', message: '@shopnest/core est headless (doc/06 §4).' },
            { name: 'react-native', message: '@shopnest/core est headless (doc/06 §4).' },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/core/**/*.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'JSXElement',
          message:
            '@shopnest/core ne contient aucun JSX (doc/06 §4). Le rendu va dans ui-web ou ui-native.',
        },
      ],
    },
  },
]
