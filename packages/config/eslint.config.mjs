import tsParser from '@typescript-eslint/parser'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import pluginImport from 'eslint-plugin-import-x'
import eslintConfigPrettier from 'eslint-config-prettier'

const tsRecommended = tsPlugin.configs['strict-type-checked']
const tsStylistic = tsPlugin.configs['stylistic-type-checked']

export default [
  { ignores: ['**/dist/**', '**/.next/**', '**/node_modules/**', '**/*.d.ts'] },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'],
    plugins: {
      '@typescript-eslint': tsPlugin,
      'import-x': pluginImport,
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      ...(tsRecommended?.rules ?? {}),
      ...(tsStylistic?.rules ?? {}),

      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      'import-x/order': [
        'error',
        {
          groups: [
            ['builtin', 'external'],
            ['internal', 'parent', 'sibling', 'index'],
          ],
          'newlines-between': 'always',
          alphabetize: { order: 'asc' },
        },
      ],

      'import-x/no-duplicates': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  eslintConfigPrettier,
]
