import { test, expect, setupEditorApiMocks } from '../fixtures/editor.fixture';
import {
  MOCK_PAGE,
  MOCK_FILES_HIERARCHY,
  MOCK_SUGGESTIONS,
  MOCK_COMPILE_WITH_WARNING,
} from '../fixtures/mock-data';

/**
 * overleaf-multi-user-and-case-studies.spec.ts
 *
 * Real Browser End-to-End (E2E) User & Multi-User Interaction Suite.
 * Simulates how real academic researchers and multi-author groups use Overleaf:
 * - Case Study 1: Code <-> Visual Mode switching & Visual Table Wizard insertion
 * - Case Study 2: Interactive Symbol Palette (Ω) search & live LaTeX insertion
 * - Case Study 3: Multi-file Explorer & rapid Multi-Tab switching with dirty state preservation
 * - Case Study 4: Multi-User Group Collaboration (Author + Peer Reviewer in concurrent browser contexts)
 * - Case Study 5: Live Compilation with TeX Live warnings & Log filter inspection
 */
test.describe('Overleaf Real-User & Multi-User Group E2E Suite', () => {
  const PAGE_ID = 'page-paper-001';

  test('Case Study 1: Seamless Code <-> Visual Mode Switching & Table Wizard Authoring', async ({
    page,
    editor,
  }) => {
    void editor;
    await page.goto(`/editor/${PAGE_ID}`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.cm-editor')).toBeVisible({ timeout: 30000 });

    // 1. Verify initial Code mode is active
    const codeModeRadio = page.locator('[role="radio"][aria-label="Code mode"]');
    const visualModeRadio = page.locator('[role="radio"][aria-label="Visual mode"]');
    await expect(codeModeRadio).toHaveAttribute('aria-checked', 'true');

    // 2. Switch to Visual Mode like a user who prefers WYSIWYG formatting
    await visualModeRadio.click();
    await expect(visualModeRadio).toHaveAttribute('aria-checked', 'true');

    // 3. Verify Visual Formatting Toolbar controls appear
    const insertTableBtn = page.locator('button[aria-label="Insert table"]');
    const insertMathBtn = page.locator('button[aria-label="Math formula"]');
    const boldBtn = page.locator('button[aria-label="Bold"]');
    await expect(insertTableBtn).toBeVisible();
    await expect(insertMathBtn).toBeVisible();
    await expect(boldBtn).toBeVisible();

    // 4. Open the Interactive Table Wizard from the Visual Toolbar
    await insertTableBtn.click();
    const tableDialog = page.locator('[role="dialog"]').filter({ hasText: /Insert Table|Table/i }).first();
    await expect(tableDialog).toBeVisible({ timeout: 8000 });

    // 5. Verify live generated LaTeX preview contains \begin{tabular} and click "Insert Table"
    await expect(tableDialog.locator('pre')).toContainText('\\begin{tabular}');
    const confirmInsertTableBtn = tableDialog.locator('button:has-text("Insert Table")');
    await confirmInsertTableBtn.click();
    await expect(tableDialog).not.toBeVisible();

    // 6. Switch back to Code Mode and verify both original manuscript and new table exist
    await codeModeRadio.click();
    await expect(codeModeRadio).toHaveAttribute('aria-checked', 'true');

    const editorContent = await page.locator('.cm-content').textContent();
    expect(editorContent).toContain('Introduction');
    expect(editorContent).toContain('\\begin{tabular}');
  });

  test('Case Study 2: Interactive LaTeX Symbol Palette (Ω) Search & Cursor Insertion', async ({
    page,
    editor,
  }) => {
    void editor;
    await page.goto(`/editor/${PAGE_ID}`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.cm-editor')).toBeVisible({ timeout: 30000 });

    // 1. Focus editor and place cursor in document
    const cmContent = page.locator('.cm-content');
    await cmContent.click();

    // 2. Click "Insert Symbol (Ω)" button in the toolbar
    const symbolBtn = page.locator('button[aria-label="Insert Symbol (Ω)"]');
    await expect(symbolBtn).toBeVisible();
    await symbolBtn.click();

    // 3. Verify LaTeX Symbol Palette modal opens
    const symbolDialog = page.locator('[role="dialog"]:has-text("LaTeX Symbol Palette")');
    await expect(symbolDialog).toBeVisible({ timeout: 8000 });

    // 4. Search for "alpha" in the symbol search input
    const searchInput = symbolDialog.locator('input[placeholder*="Search symbols"]');
    await searchInput.fill('alpha');

    // 5. Click the \alpha symbol button in the grid to insert \alpha
    const alphaSymbolTile = symbolDialog.locator('button[aria-label*="\\\\alpha"]').first();
    await expect(alphaSymbolTile).toBeVisible();
    await alphaSymbolTile.click();

    // 6. Close the modal with Escape and verify \alpha was inserted into CodeMirror
    await page.keyboard.press('Escape');
    await expect(symbolDialog).not.toBeVisible();

    const updatedText = await cmContent.textContent();
    expect(updatedText).toContain('\\alpha');
  });

  test('Case Study 3: Multi-File Project Explorer & Rapid Multi-Tab Switching Without Data Loss', async ({
    page,
    editor,
  }) => {
    void editor;
    const multiFiles = [
      ...MOCK_FILES_HIERARCHY,
      {
        id: 'page-methods-003',
        title: 'methodology.tex',
        projectId: 'proj-academic-001',
        isMain: false,
      },
    ];

    await page.route(/\/files(\?.*)?$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          files: multiFiles,
          success: true,
          data: { files: multiFiles },
        }),
      });
    });

    await page.route(/\/docs\/page-bib-002|\/pages\/page-bib-002/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          page: {
            id: 'page-bib-002',
            title: 'references.bib',
            docContent: '@article{einstein1935,\n  author = {Einstein, A. and Podolsky, B. and Rosen, N.},\n  year = {1935}\n}\n',
            projectId: 'proj-academic-001',
            isMain: false,
          },
          success: true,
        }),
      });
    });

    await page.goto(`/editor/${PAGE_ID}`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.cm-editor')).toBeVisible({ timeout: 30000 });

    // 1. User types new content into main.tex
    const cmContent = page.locator('.cm-content');
    await cmContent.click();
    await page.keyboard.type('\n% Unsaved multi-tab edit in main.tex\n', { delay: 5 });
    await expect(cmContent).toContainText('Unsaved multi-tab edit in main.tex');

    // 2. Verify File Tree displays main.tex and references.bib
    const bibFileBtn = page.getByRole('button', { name: /File references\.bib/i }).first();
    await expect(bibFileBtn).toBeVisible();
    await bibFileBtn.click();

    // 3. Switch back to main.tex tab and verify the unsaved edit is still intact
    const mainTab = page.getByRole('tab', { name: /Tab: main\.tex/i }).first();
    await expect(mainTab).toBeVisible();
    await mainTab.click();
    await expect(cmContent).toContainText('Unsaved multi-tab edit in main.tex');
  });

  test('Case Study 4: Multi-User Group Collaboration (Author + Peer Reviewer Concurrent Browser Sessions)', async ({
    browser,
  }) => {
    // Shared server-side state between Author (Browser Context A) and Reviewer (Browser Context B)
    let sharedDocContent = MOCK_PAGE.docContent;
    let sharedSuggestions = [...MOCK_SUGGESTIONS];

    const authorContext = await browser.newContext();
    const reviewerContext = await browser.newContext();

    const authorPage = await authorContext.newPage();
    const reviewerPage = await reviewerContext.newPage();

    try {
      await setupEditorApiMocks(authorPage);
      await setupEditorApiMocks(reviewerPage);

      // Connect both independent browser contexts to the shared manuscript & review state
      for (const p of [authorPage, reviewerPage]) {
        await p.route(/\/docs\/page-paper-001|\/pages\/page-paper-001/, async (route) => {
          if (route.request().method() === 'PATCH' || route.request().method() === 'PUT') {
            const body = route.request().postDataJSON();
            if (body?.docContent || body?.content) {
              sharedDocContent = body.docContent ?? body.content;
            }
          }
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              page: { ...MOCK_PAGE, docContent: sharedDocContent },
              success: true,
              data: { page: { ...MOCK_PAGE, docContent: sharedDocContent } },
            }),
          });
        });

        await p.route(/\/suggestions(\/.*)?(\?.*)?$/, async (route) => {
          const url = route.request().url();
          const method = route.request().method();

          if (method === 'POST' && url.includes('/accept')) {
            sharedSuggestions = sharedSuggestions.map((s) => ({
              ...s,
              status: 'accepted',
            }));
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({ success: true, data: sharedSuggestions[0] }),
            });
            return;
          }

          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              suggestions: sharedSuggestions,
              success: true,
              data: { suggestions: sharedSuggestions },
            }),
          });
        });
      }

      // 1. Both Author (Dr. Alan Turing) and Reviewer (Prof. Emmy Noether) open the manuscript simultaneously
      await Promise.all([
        authorPage.goto(`/editor/${PAGE_ID}`, { waitUntil: 'domcontentloaded' }),
        reviewerPage.goto(`/editor/${PAGE_ID}`, { waitUntil: 'domcontentloaded' }),
      ]);

      await expect(authorPage.locator('.cm-editor')).toBeVisible({ timeout: 30000 });
      await expect(reviewerPage.locator('.cm-editor')).toBeVisible({ timeout: 30000 });

      // 2. Reviewer opens the Review panel to inspect Track Changes suggestions
      await reviewerPage.locator('#sidebar-tab-review, button[aria-label*="Review"]').first().click();
      const reviewerSuggestionCard = reviewerPage.locator('#suggestion-sug-001');
      await expect(reviewerSuggestionCard).toBeVisible({ timeout: 10000 });
      await expect(reviewerSuggestionCard).toContainText('notable advantages');
      await expect(reviewerSuggestionCard).toContainText('provable exponential speedups');

      // 3. Author also opens the Review panel in their own browser window and sees Reviewer's suggestion
      await authorPage.locator('#sidebar-tab-review, button[aria-label*="Review"]').first().click();
      const authorSuggestionCard = authorPage.locator('#suggestion-sug-001');
      await expect(authorSuggestionCard).toBeVisible({ timeout: 10000 });

      // 4. Author clicks "Accept" on Prof. Emmy Noether's Track Change suggestion
      const acceptBtn = authorSuggestionCard.locator('button:has-text("Accept")');
      await expect(acceptBtn).toBeVisible();
      await acceptBtn.click();

      // 5. Verify shared state reflects the accepted Track Change across the group
      expect(sharedSuggestions[0].status).toBe('accepted');
    } finally {
      await authorContext.close();
      await reviewerContext.close();
    }
  });

  test('Case Study 5: Live Researcher Compilation & Log Filter Diagnostics Inspection', async ({
    page,
    editor,
  }) => {
    let compileCount = 0;
    await page.route(/\/compile(\?.*)?$/, async (route) => {
      compileCount += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_COMPILE_WITH_WARNING),
      });
    });

    await page.goto(`/editor/${PAGE_ID}`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.cm-editor')).toBeVisible({ timeout: 30000 });

    // 1. User types a new equation and triggers Recompile
    await editor.typeIntoEditor('\n\\begin{equation}\n  H|\\psi\\rangle = E|\\psi\\rangle\n\\end{equation}\n');
    await editor.recompile();

    // 2. Verify compile endpoint was invoked and right-hand compilation/preview pane is interactive
    await expect.poll(() => compileCount, { timeout: 10000 }).toBeGreaterThanOrEqual(1);
    await expect(editor.compileButton).toBeEnabled();

    // 3. Verify either the PDF preview or the Overleaf-style Log filter view is visible in the right pane
    const pdfOrLogsView = editor.pdfViewer.or(
      page.getByRole('tablist', { name: /Log filter categories/i }),
    );
    await expect(pdfOrLogsView.first()).toBeVisible({ timeout: 5000 });
  });

  test('Case Study 6: 3-User Research Group (Lead Author + Co-Author + Reviewer) with Track Changes View Modes', async ({
    browser,
  }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const contextC = await browser.newContext();

    const leadAuthorPage = await contextA.newPage();
    const coAuthorPage = await contextB.newPage();
    const reviewerPage = await contextC.newPage();

    try {
      await Promise.all([
        setupEditorApiMocks(leadAuthorPage),
        setupEditorApiMocks(coAuthorPage),
        setupEditorApiMocks(reviewerPage),
      ]);

      // 1. All 3 group members open the manuscript concurrently
      await Promise.all([
        leadAuthorPage.goto(`/editor/${PAGE_ID}`, { waitUntil: 'domcontentloaded' }),
        coAuthorPage.goto(`/editor/${PAGE_ID}`, { waitUntil: 'domcontentloaded' }),
        reviewerPage.goto(`/editor/${PAGE_ID}`, { waitUntil: 'domcontentloaded' }),
      ]);

      await expect(leadAuthorPage.locator('.cm-editor')).toBeVisible({ timeout: 30000 });
      await expect(coAuthorPage.locator('.cm-editor')).toBeVisible({ timeout: 30000 });
      await expect(reviewerPage.locator('.cm-editor')).toBeVisible({ timeout: 30000 });

      // 2. Co-Author (Browser B) switches to Visual Mode to edit in WYSIWYG while Lead Author (Browser A) works in Code Mode
      await coAuthorPage.locator('[role="radio"][aria-label="Visual mode"]').click();
      await expect(coAuthorPage.locator('[role="radio"][aria-label="Visual mode"]')).toHaveAttribute(
        'aria-checked',
        'true',
      );
      await expect(leadAuthorPage.locator('[role="radio"][aria-label="Code mode"]')).toHaveAttribute(
        'aria-checked',
        'true',
      );

      // 3. Reviewer (Browser C) opens Review Panel and switches Track Changes View Modes (Changes -> Clean -> Original)
      await reviewerPage.locator('#sidebar-tab-review, button[aria-label*="Review"]').first().click();
      const viewModeSelect = reviewerPage.locator('select[aria-label="Track changes view mode"]');
      await expect(viewModeSelect).toBeVisible({ timeout: 10000 });

      await viewModeSelect.selectOption('clean');
      await expect(viewModeSelect).toHaveValue('clean');

      await viewModeSelect.selectOption('original');
      await expect(viewModeSelect).toHaveValue('original');

      await viewModeSelect.selectOption('changes');
      await expect(viewModeSelect).toHaveValue('changes');
    } finally {
      await Promise.all([contextA.close(), contextB.close(), contextC.close()]);
    }
  });
});
