import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

let testData: { workspaceId: string; projectId: string };
let libraryUrl: string;

test.beforeAll(() => {
  testData = JSON.parse(fs.readFileSync('tests/.auth/testData.json', 'utf-8')) as { workspaceId: string; projectId: string };
  libraryUrl = `/${testData.workspaceId}/library`;
});

test.describe('Library & Catalog Items System', () => {
  test.use({ storageState: 'tests/.auth/owner.json' });

  test('Should perform full Collection, Item Upload, and Notes operations', async ({ page }) => {
    // Register console and error listeners for debugging
    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
    page.on('pageerror', err => console.error('BROWSER ERROR:', err.stack || err.message));

    // Mock direct S3/R2 upload to bypass CORS issues on localhost
    await page.route('**/*.cloudflarestorage.com/**', async (route) => {
      if (route.request().method() === 'PUT') {
        console.log('MOCKING R2 UPLOAD PUT request:', route.request().url());
        await route.fulfill({
          status: 200,
          contentType: 'application/octet-stream',
          body: 'mock r2 upload success',
        });
      } else {
        await route.continue();
      }
    });

    // Mock backend R2 proxy fetch to return the dummy PDF content
    await page.route('**/api/files/r2/**', async (route) => {
      console.log('MOCKING R2 PROXY GET request:', route.request().url());
      await route.fulfill({
        status: 200,
        contentType: 'application/pdf',
        body: fs.readFileSync('tests/fixtures/sample.pdf'),
      });
    });

    // 1. Access the library page
    console.log('Navigating to Library:', libraryUrl);
    await page.goto(libraryUrl);
    await page.waitForURL(`**${libraryUrl}`);

    // Verify empty state or sidebar header
    await expect(page.locator('aside span:has-text("Library")')).toBeVisible();

    // 2. Create a new collection
    console.log('Creating a new Collection...');
    const plusBtn = page.locator('button[title="New collection"]');
    await expect(plusBtn).toBeVisible();
    await plusBtn.click();

    // Fill collection details
    const nameInput = page.locator('#col-name');
    await expect(nameInput).toBeVisible();
    await nameInput.fill('QA Machine Learning');

    const descTextarea = page.locator('#col-desc');
    await descTextarea.fill('Auto-created collection for testing');

    // Click submit
    const createBtn = page.locator('button:has-text("Create Collection")');
    await expect(createBtn).toBeEnabled();
    await createBtn.click();

    // Verify collection created and visible in sidebar
    const collectionLink = page.locator('aside a:has-text("QA Machine Learning")');
    await expect(collectionLink).toBeVisible({ timeout: 10000 });

    // 3. Navigate to Collection page
    console.log('Navigating to collection details page...');
    await collectionLink.click();
    await page.waitForURL(`**/library/*`);

    // Verify Breadcrumb and Empty State
    await expect(page.locator('div:has-text("QA Machine Learning")').first()).toBeVisible();
    await expect(page.locator('h2:has-text("No papers in")')).toBeVisible();

    // 4. Add new item via New dropdown → Add file
    console.log('Opening Add Item Dialog...');
    // Click "New" dropdown trigger in Topbar
    await page.locator('button:has-text("New")').click();
    // Click "Add file" menu item
    await page.locator('[role="menuitem"]:has-text("Add file")').click();

    // Upload dummy PDF file
    console.log('Uploading sample.pdf...');
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.locator('text=Drop PDF here or click to browse').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles('tests/fixtures/sample.pdf');

    // Wait for upload completion — title is auto-filled from PDF, then expand metadata
    await expect(page.locator('#item-title')).toBeVisible({ timeout: 15000 });
    await page.locator('#item-title').clear();
    await page.locator('#item-title').fill('Playwright Test Item');
    await page.locator('#item-authors').clear();
    await page.locator('#item-authors').fill('Playwright, Gemini Antigravity');
    await page.locator('#item-year').fill('2026');

    // Click "Add to Library" submit button in dialog
    const submitItemBtn = page.locator('[role="dialog"] button:has-text("Add to Library")');
    await expect(submitItemBtn).toBeEnabled();
    await submitItemBtn.click();

    // Verify item appears in list
    const paperTitleCell = page.locator('table td:has-text("Playwright Test Item")');
    await expect(paperTitleCell).toBeVisible({ timeout: 15000 });

    // 5. Navigate to Item Reader
    console.log('Navigating to Item Reader...');
    await paperTitleCell.dblclick();
    // 6. Open Notes panel and verify adding a note
    console.log('Opening Notes sidebar panel...');
    const notesTabBtn = page.locator('button:has(svg.lucide-sticky-note)');
    await expect(notesTabBtn).toBeVisible({ timeout: 15000 });
    await notesTabBtn.click();

    // Type a note
    const noteTextarea = page.locator('textarea[placeholder="Capture a thought while reading..."]');
    await expect(noteTextarea).toBeVisible();
    await noteTextarea.fill('This is a test note created by Playwright.');

    // Save note
    const saveNoteBtn = page.locator('button:has-text("Add note")');
    await expect(saveNoteBtn).toBeEnabled();
    await saveNoteBtn.click();

    // Verify note is saved and displayed in the sidebar notes list
    const savedNoteText = page.locator('p:has-text("This is a test note created by Playwright.")');
    await expect(savedNoteText).toBeVisible({ timeout: 10000 });

    console.log('Library & Catalog Items E2E Test Completed Successfully!');
  });
});
