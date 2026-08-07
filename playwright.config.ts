import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:2915',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'setup',
      testMatch: 'setup/global.setup.ts',
    },
    {
      name: 'chromium',
      testMatch: '**/*.spec.ts',
      use: { 
        ...devices['Desktop Chrome'],
        storageState: 'tests/e2e/.auth/owner.json',
      },
      dependencies: ['setup'],
    },
  ],
});
