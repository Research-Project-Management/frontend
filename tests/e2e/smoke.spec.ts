import { test, expect } from '@playwright/test';

test.describe('E2E Smoke Tests: Public Authentication & Layouts', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test('Login page renders cleanly with interactive inputs', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/login', { waitUntil: 'domcontentloaded' });

    // Heading verification (allow hydration time on dev server)
    const heading = page.getByRole('heading', { name: /Sign in to Flux/i });
    await expect(heading).toBeVisible({ timeout: 15000 });

    // Form inputs verification
    const emailInput = page.locator('input#email');
    const passwordInput = page.locator('input#password');
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();

    // Sign in CTA button verification
    const submitBtn = page.getByRole('button', { name: /Sign in/i });
    await expect(submitBtn).toBeVisible();

    // Links to registration and password reset
    const registerLink = page.getByRole('link', { name: /Sign up/i });
    const forgotLink = page.getByRole('link', { name: /Forgot password/i });
    await expect(registerLink).toBeVisible();
    await expect(forgotLink).toBeVisible();

    // Form validation check: submitting invalid credentials
    await emailInput.fill('invalid-email');
    await submitBtn.click();

    // No uncaught JavaScript crashes
    expect(errors.filter((e) => !e.includes('ResizeObserver'))).toHaveLength(0);
  });

  test('Registration page renders with required fields', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/register', { waitUntil: 'domcontentloaded' });

    const heading = page.getByRole('heading', { name: /Create your account/i });
    await expect(heading).toBeVisible({ timeout: 15000 });

    const nameInput = page.getByLabel(/Full name/i);
    const emailInput = page.getByLabel(/Email/i);
    await expect(nameInput).toBeVisible();
    await expect(emailInput).toBeVisible();

    expect(errors.filter((e) => !e.includes('ResizeObserver'))).toHaveLength(0);
  });

  test('Forgot password page renders email recovery input', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/forgot-password', { waitUntil: 'domcontentloaded' });

    // Expect email input for recovery
    const emailInput = page.getByLabel(/Email/i);
    await expect(emailInput).toBeVisible({ timeout: 15000 });

    expect(errors.filter((e) => !e.includes('ResizeObserver'))).toHaveLength(0);
  });

  test('Unauthenticated navigation safely redirects to login without crashing', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/_some_random_missing_route_404', { waitUntil: 'domcontentloaded' });
    
    // Unauthenticated visitor is safely routed to login
    await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
    const heading = page.getByRole('heading', { name: /Sign in to Flux/i });
    await expect(heading).toBeVisible({ timeout: 15000 });

    expect(errors.filter((e) => !e.includes('ResizeObserver'))).toHaveLength(0);
  });
});
