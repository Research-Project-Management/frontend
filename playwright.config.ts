import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'list',
  timeout: 60000,
  use: {
    baseURL: 'http://127.0.0.1:2915',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'smoke',
      testMatch: '**/smoke.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    {
      name: 'setup',
      testMatch: 'setup/global.setup.ts',
    },
    {
      name: 'chromium',
      testMatch: 'features/**/*.spec.ts',
      use: { 
        ...devices['Desktop Chrome'],
        channel: 'chrome',
        storageState: 'tests/e2e/.auth/owner.json',
      },
      dependencies: ['setup'],
    },
  ],
});
