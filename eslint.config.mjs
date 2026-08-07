import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';
import pluginQuery from '@tanstack/eslint-plugin-query';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  // Next.js core rules
  ...compat.extends('next/core-web-vitals', 'next/typescript'),

  // TanStack Query recommended rules
  ...pluginQuery.configs['flat/recommended'],

  {
    rules: {
      // Enforce query keys array format (not strings)
      '@tanstack/query/exhaustive-deps': 'error',
      // Warn if queryFn is defined but no queryKey
      '@tanstack/query/no-rest-destructuring': 'warn',
      // Prevent infinite query re-renders from stable references
      '@tanstack/query/stable-query-client': 'error',
    },
  },
];

export default eslintConfig;
