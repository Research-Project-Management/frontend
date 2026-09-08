import pluginQuery from '@tanstack/eslint-plugin-query';
import tsParser from '@typescript-eslint/parser';
import reactHooks from 'eslint-plugin-react-hooks';

const eslintConfig = [
  {
    ignores: [
      '.next/**',
      '.next*/**',
      'node_modules/**',
      'dist/**',
      'out/**',
      'public/**',
      '.playwright/**',
      'playwright-report/**',
      'test-results/**',
      '*flux-next-cache*/**',
      '**/*flux-next-cache*/**',
      'C:/**',
      '**/C:/**',
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
];

export default eslintConfig;
