import { test, expect } from '@playwright/test';

test.describe('Auth Validation', () => {
  // Do not use the global authenticated state for these tests
  test.use({ storageState: { cookies: [], origins: [] } });

  test('Login form validations', async ({ page }) => {
    await page.goto('/login');

    // 1. Submit empty form
    await page.click('button[type="submit"]');
    // Ensure errors appear
    await expect(page.locator('text="Email is required"').or(page.locator('text="Required"'))).toBeVisible();

    // 2. Submit wrong password
    await page.fill('input[name="email"]', 'wrong@example.com');
    await page.fill('input[name="password"]', 'wrongpass123');
    await page.click('button[type="submit"]');

    // Toast or error message should appear
    await expect(page.locator('text="Invalid credentials"').or(page.locator('.toast'))).toBeVisible();
  });

  test('Register form validations', async ({ page }) => {
    await page.goto('/register');

    // 1. Submit empty form
    await page.click('button[type="submit"]');
    // Validation errors
    await expect(page.locator('text="Name is required"').or(page.locator('text="Required"'))).toBeVisible();

    // 2. Passwords do not match
    await page.fill('input[name="name"]', 'Test User');
    await page.fill('input[name="email"]', 'testuser123@example.com');
    
    const passInputs = await page.$$('input[type="password"]');
    if (passInputs.length >= 2) {
      await passInputs[0].fill('password123');
      await passInputs[1].fill('password124');
      await page.click('button[type="submit"]');
      await expect(page.locator('text="Password and confirm password do not match"').or(page.locator('text="match"'))).toBeVisible();
    }
  });
});
