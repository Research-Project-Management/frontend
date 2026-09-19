import pluginQuery from '@tanstack/eslint-plugin-query';
import tsParser from '@typescript-eslint/parser';
import reactHooks from 'eslint-plugin-react-hooks';

const eslintConfig = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'dist/**',
      'out/**',
      'public/**',
      '.turbo/**',
      '.playwright/**',
      'playwright-report/**',
      'test-results/**',
      'coverage/**',
      '*.tsbuildinfo',
    ],
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    ...pluginQuery.configs['flat/recommended'][0],
  },
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    rules: {
      '@tanstack/query/exhaustive-deps': 'warn',
      '@tanstack/query/no-rest-destructuring': 'warn',
      '@tanstack/query/stable-query-client': 'error',
      '@tanstack/query/no-unstable-deps': 'warn',
    },
  },
  {
    name: 'enforce-library-public-boundary',
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/features/library/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/features/library/**', '@/features/library/*'],
              message:
                'Direct imports from library internals are forbidden. Import from the Public API (@/features/library) instead.',
            },
          ],
        },
      ],
    },
  },
];

export default eslintConfig;
