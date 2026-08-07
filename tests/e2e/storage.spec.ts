import { test, expect } from '@playwright/test';
import fs from 'fs';

let testData: { workspaceId: string; projectId: string };
let storageUrl: string;

test.beforeAll(() => {
  testData = JSON.parse(fs.readFileSync('tests/.auth/testData.json', 'utf-8'));
  storageUrl = `/${testData.workspaceId}/storage`;
});

test.describe('Workspace Storage & File Management (Phase 7)', () => {
  test.use({ storageState: 'tests/.auth/owner.json' });

  test('Should perform Folder creation, Star, Rename, Trash, and Restore operations', async ({ page }) => {
    // Register console and error listeners for debugging
    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
    page.on('pageerror', err => console.error('BROWSER ERROR:', err.stack || err.message));

    // Access storage page
    console.log('Navigating to Storage:', storageUrl);
    await page.goto(storageUrl);
    await page.waitForURL(`**${storageUrl}`);

    // Verify header or page indicator
    await expect(page.locator('aside span:has-text("Storage")')).toBeVisible();
    await expect(page.locator('h1:has-text("Home")').first()).toBeVisible();

    // 1. Create a new folder
    console.log('Creating new folder...');
    const newFolderBtn = page.locator('button:has-text("New Folder")');
    await expect(newFolderBtn).toBeVisible();
    await newFolderBtn.click();

    // Fill folder name
    const folderInput = page.locator('#folder-name');
    await expect(folderInput).toBeVisible();
    await folderInput.fill('Playwright Folder');

    const submitFolderBtn = page.locator('button:has-text("Create Folder")');
    await expect(submitFolderBtn).toBeEnabled();
    await submitFolderBtn.click();

    // Verify folder appeared
    const folderRow = page.locator('span:has-text("Playwright Folder")');
    await expect(folderRow).toBeVisible({ timeout: 15000 });

    // 2. Star folder
    console.log('Starring folder...');
    const folderItem = page.locator('div.grid-cols-12:has(span:has-text("Playwright Folder"))');
    await folderItem.hover();

    const moreBtn = folderItem.locator('button:has(svg.lucide-ellipsis-vertical, svg.lucide-more-vertical)');
    await moreBtn.click({ force: true });

    const starBtn = page.getByRole('menuitem', { name: 'Star', exact: true });
    await starBtn.click();

    // Verify starred state (star icon is visible in name cell)
    const starIcon = folderItem.locator('svg.lucide-star');
    await expect(starIcon).toBeVisible({ timeout: 10000 });

    // 3. Rename folder
    console.log('Renaming folder...');
    await folderItem.hover();
    await moreBtn.click({ force: true });

    const renameMenuBtn = page.getByRole('menuitem', { name: 'Rename', exact: true });
    await renameMenuBtn.click();

    const renameInput = page.locator('#name'); // Let's check rename dialog ID
    await expect(renameInput).toBeVisible();
    await renameInput.fill('Renamed Playwright Folder');

    const saveRenameBtn = page.locator('button:has-text("Save")');
    await expect(saveRenameBtn).toBeEnabled();
    await saveRenameBtn.click();

    // Verify renamed folder appears
    const renamedFolderRow = page.locator('span:has-text("Renamed Playwright Folder")');
    await expect(renamedFolderRow).toBeVisible({ timeout: 15000 });

    // 4. Trash folder
    console.log('Trashing folder...');
    const renamedFolderItem = page.locator('div.grid-cols-12:has(span:has-text("Renamed Playwright Folder"))');
    await renamedFolderItem.hover();
    await renamedFolderItem.locator('button:has(svg.lucide-ellipsis-vertical, svg.lucide-more-vertical)').click({ force: true });

    const deleteMenuBtn = page.getByRole('menuitem', { name: 'Delete', exact: true });
    await deleteMenuBtn.click();

    const confirmDeleteBtn = page.locator('button:has-text("Delete")');
    await expect(confirmDeleteBtn).toBeVisible();
    await confirmDeleteBtn.click();

    // Verify folder disappeared from list
    await expect(renamedFolderRow).not.toBeVisible({ timeout: 10000 });

    // 5. Check Trash Page & Restore
    console.log('Navigating to Trash...');
    const trashLink = page.locator('aside a:has-text("Trash")');
    await trashLink.click();
    await page.waitForURL('**/storage/trash');

    const trashedFolderRow = page.locator('span:has-text("Renamed Playwright Folder")');
    await expect(trashedFolderRow).toBeVisible({ timeout: 10000 });

    // Restore folder
    console.log('Restoring folder...');
    const trashedFolderItem = page.locator('div.grid-cols-12:has(span:has-text("Renamed Playwright Folder"))');
    await trashedFolderItem.hover();
    await trashedFolderItem.locator('button:has(svg.lucide-ellipsis-vertical, svg.lucide-more-vertical)').click({ force: true });

    const restoreBtn = page.getByRole('menuitem', { name: 'Restore', exact: true });
    await restoreBtn.click();

    // Verify folder is gone from Trash
    await expect(trashedFolderRow).not.toBeVisible({ timeout: 10000 });

    // 6. Navigate back to My Files and verify folder is back
    console.log('Verifying restoration in My Files...');
    const myFilesLink = page.locator('aside a:has-text("My Drive")');
    await myFilesLink.click();
    await page.waitForURL('**/storage/my-files');

    const restoredFolderRow = page.locator('span:has-text("Renamed Playwright Folder")');
    await expect(restoredFolderRow).toBeVisible({ timeout: 10000 });

    console.log('Storage Phase 7 E2E Test Completed Successfully!');
  });
});
