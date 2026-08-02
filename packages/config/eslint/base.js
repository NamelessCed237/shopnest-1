import js from '@eslint/js'
import tseslint from 'typescript-eslint'

/**
 * Config ESLint de base — voir doc/02-conventions.md.
 * Les règles ci-dessous sont des `error`, pas des `warn` : un warning est un lint ignoré.
 */
export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true },
    },
    rules: {
      // doc/02 §4 — `any` interdit, `unknown` + validation à la place
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      // Pas d'enum TypeScript
      'no-restricted-syntax': [
        'error',
        {
          selector: 'TSEnumDeclaration',
          message:
            "Pas d'enum TS (doc/02 §4). Utiliser une union de littéraux + `as const`.",
        },
      ],
      // doc/02 §5 — on ne masque jamais une erreur
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/require-await': 'error',
      // doc/02 §1.6 — immutabilité par défaut
      'prefer-const': 'error',
      'no-param-reassign': 'error',
      // doc/02 §2 — complexité
      complexity: ['error', { max: 12 }],
      'max-depth': ['error', 4],
      'max-lines-per-function': ['warn', { max: 80, skipBlankLines: true, skipComments: true }],
      // Divers
      'no-console': ['error', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always'],
    },
  },
  {
    files: ['**/*.spec.ts', '**/*.spec.tsx', '**/*.e2e.ts', '**/test/**'],
    rules: {
      'max-lines-per-function': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
    },
  },
  {
    ignores: ['dist/**', 'build/**', 'coverage/**', '.turbo/**', 'node_modules/**'],
  },
)
