import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  server: {
    fs: {
      strict: false,
    },
  },
  resolve: {
    preserveSymlinks: true,
    alias: {
      '@': path.resolve(__dirname, './src'),
      '~': path.resolve(__dirname, './src'),
      'monaco-editor/esm/vs': path.resolve(__dirname, './node_modules/monaco-editor/esm/vs'),
    },
  },
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [path.resolve(__dirname, './tests/unit/setup.ts')],
    include: ['tests/unit/**/*.{test,spec}.{ts,tsx}'],
    passWithNoTests: true,
    pool: 'forks',
    forks: {
      singleFork: true,
    },
    isolate: false,
    testTimeout: 120000,
    hookTimeout: 120000,
    teardownTimeout: 120000,
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
    },
  },
});
