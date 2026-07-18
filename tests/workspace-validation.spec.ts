import { test, expect } from '@playwright/test';

test.describe('Workspace Validation', () => {
  test('Create workspace with empty name', async ({ page }) => {
    await page.goto('/ws');
    
    // Might be redirected to /create if no workspaces exist, or we can explicitly go to /create
    await page.goto('/create');

    // Submit without filling name - button should be disabled
    const btn = page.locator('button:has-text("Create Workspace")');
    await expect(btn).toBeDisabled();
  });
});
