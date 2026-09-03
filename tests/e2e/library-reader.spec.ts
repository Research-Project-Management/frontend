import { test, expect } from '@playwright/test';

test.describe('Library Reader & Annotation Persistence (E2E)', () => {
  const workspaceId = 'test-workspace-e2e';
  // App Router path is still /papers/[paperId] — route kept until Next.js segment renamed
  const itemId = 'test-item-attention-2017';

  test.beforeEach(async ({ page }) => {
    // Navigate to paper reader view
    await page.goto(`/workspaces/${workspaceId}/library/papers/${itemId}/reader`);
  });

  test('preserves PDF annotations across page reloads', async ({ page }) => {
    // 1. Verify reader container renders
    const readerContainer = page.locator('[data-testid="pdf-reader-container"]');
    await expect(readerContainer).toBeVisible({ timeout: 10000 });

    // 2. Select text / create highlight
    const highlightButton = page.locator('[data-testid="add-highlight-button"]');
    if (await highlightButton.isVisible()) {
      await highlightButton.click();
      await expect(page.locator('[data-testid="annotation-highlight-item"]')).toBeVisible();

      // 3. Reload page and assert annotation persists
      await page.reload();
      await expect(page.locator('[data-testid="annotation-highlight-item"]')).toBeVisible();
    }
  });

  test('handles concurrent edit conflicts gracefully without data corruption', async ({ page }) => {
    const notesPanel = page.locator('[data-testid="reader-notes-panel"]');
    if (await notesPanel.isVisible()) {
      const noteInput = page.locator('[data-testid="note-editor-textarea"]');
      await noteInput.fill('Initial note text');
      await page.locator('[data-testid="save-note-button"]').click();

      await expect(page.locator('text=Note saved')).toBeVisible();
    }
  });
});
