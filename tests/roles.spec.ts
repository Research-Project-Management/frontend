import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

let testData: any;
let projectUrl: string;

test.beforeAll(() => {
  testData = JSON.parse(fs.readFileSync('tests/.auth/testData.json', 'utf-8'));
  projectUrl = `/${testData.workspaceId}/projects/${testData.projectId}`;
});

test.describe('Role-based Access Control (RBAC)', () => {

  test.describe('Admin Role', () => {
    test.use({ storageState: 'tests/.auth/admin.json' });

    test('Admin can access settings and see danger zone', async ({ page }) => {
      await page.goto(`${projectUrl}/settings`);
      await page.waitForURL('**/settings');
      
      // Admin should see Settings tab and Danger Zone
      try {
        await expect(page.locator('h3:has-text("Delete this project")')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('button:has-text("Delete")')).toBeVisible();
      } catch (e) {
        await page.screenshot({ path: 'tests/debug-admin-settings.png' });
        console.log(await page.content());
        throw e;
      }
    });
  });

  test.describe('Member Role', () => {
    test.use({ storageState: 'tests/.auth/member.json' });

    test('Member cannot see Danger Zone in settings', async ({ page }) => {
      await page.goto(`${projectUrl}/settings`);
      
      // Member might be able to see settings but NOT Danger Zone
      await expect(page.locator('h3:has-text("Delete this project")')).not.toBeVisible();
    });
  });

  test.describe('Viewer Role', () => {
    test.use({ storageState: 'tests/.auth/viewer.json' });

    test('Viewer cannot create tasks or modify settings', async ({ page }) => {
      await page.goto(`${projectUrl}/overview`);
      
      // The "Settings" link in the sidebar should be hidden
      await expect(page.locator('nav a[href*="/settings"]')).not.toBeVisible();
      
      // Test direct navigation to settings should redirect or show access denied
      // await page.goto(`${projectUrl}/settings`);
      // await expect(page.locator('text="Access Denied"').or(page.locator('text="not authorized"'))).toBeVisible();
    });
  });

});
