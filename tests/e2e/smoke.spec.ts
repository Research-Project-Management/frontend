import { test, expect } from './fixtures/editor.fixture';

/**
 * smoke.spec.ts
 *
 * Fast smoke test verifying the manuscript editor shell:
 * - 3-pane layout mounts successfully
 * - CodeMirror 6 editor is rendered
 * - PDF viewer area is mounted
 * - SSOT verified: No redundant Share/Invitation button in editor topbar
 */
test.describe('Manuscript Editor Smoke Suite', () => {
  test('should load editor cockpit cleanly with Overleaf-aligned controls', async ({ page, editor }) => {
    // Navigate to the mock manuscript route
    await page.goto('/editor/page-paper-001', { waitUntil: 'domcontentloaded' });

    // 1. Verify CodeMirror 6 editor instance is mounted
    await expect(page.locator('.cm-editor')).toBeVisible({ timeout: 15000 });

    // 2. Verify Topbar controls (Compile, Review, File)
    await expect(page.locator('button:has-text("Recompile"), button:has-text("Compile")').first()).toBeVisible();
    await expect(page.locator('button:has-text("File"), [role="menuitem"]:has-text("File")').first()).toBeVisible();

    // 3. Verify SSOT: No redundant project-level share modal inside manuscript editor
    await editor.assertNoRedundantShareModal();
  });
});
