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

    // Wait for document tab to load
    await expect(page.getByRole('tab', { name: /main\.tex/i })).toBeVisible({ timeout: 15000 });

    // 1. Verify continuous toolbar border-b alignment across sidebar, editor, and viewer
    const toolbarMetrics = await page.evaluate(() => {
      const filesHeader = document.querySelector('[role="tabpanel"] .border-b');
      const editorTabs = document.querySelector('[role="tablist"][aria-label*="document tabs" i]')?.closest('.border-b');
      const pdfToolbar = document.querySelector('[aria-label="PDF viewer controls" i]');

      return {
        filesBottom: filesHeader ? Math.round(filesHeader.getBoundingClientRect().bottom) : null,
        editorBottom: editorTabs ? Math.round(editorTabs.getBoundingClientRect().bottom) : null,
        pdfBottom: pdfToolbar ? Math.round(pdfToolbar.getBoundingClientRect().bottom) : null,
      };
    });
    console.log('TOOLBAR_METRICS:', toolbarMetrics);

    expect(toolbarMetrics.filesBottom).not.toBeNull();
    expect(toolbarMetrics.editorBottom).not.toBeNull();
    expect(toolbarMetrics.filesBottom).toBe(toolbarMetrics.editorBottom);
    if (toolbarMetrics.pdfBottom !== null) {
      expect(toolbarMetrics.pdfBottom).toBe(toolbarMetrics.editorBottom);
    }

    // 2. Verify CodeMirror 6 editor instance is mounted
    await expect(page.locator('.cm-editor')).toBeVisible({ timeout: 15000 });

    // 3. Verify Topbar controls (Compile, Review, File)
    await expect(page.locator('button:has-text("Recompile"), button:has-text("Compile")').first()).toBeVisible();
    await expect(page.locator('button:has-text("File"), [role="menuitem"]:has-text("File")').first()).toBeVisible();

    // 4. Verify SSOT: No redundant project-level share modal inside manuscript editor
    await editor.assertNoRedundantShareModal();
  });
});
