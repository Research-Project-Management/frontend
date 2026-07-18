import { defineConfig } from 'vitest/config';

import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/unit/setup.ts'],
    // @ts-ignore - type definitions might be out of sync
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
    exclude: ['**/node_modules/**', '**/dist/**', 'tests/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['app/**/*.{ts,tsx}'],
      exclude: ['app/routes/**', 'app/components/ui/**']
    }
  }
});
