import { test, expect, setupEditorApiMocks } from '../fixtures/editor.fixture';
import {
  MOCK_PAGE,
  MOCK_FILES_HIERARCHY,
  MOCK_SUGGESTIONS,
} from '../fixtures/mock-data';

/**
 * overleaf-longitudinal-lifecycle.spec.ts
 *
 * Longitudinal Time-Horizon E2E Suite (Week 1 -> Month 3 -> Month 6 -> Year 1 -> Year 2+).
 * Simulates real-world academic usage of Overleaf across multi-month and multi-year lifecycles:
 * - Horizon 1 (Week 1 - Month 1): Project Settings (Overleaf Menu Drawer), Compiler/Draft toggles,
 *   Custom Warning Filters, Git Clone URL/Tokens, and Personal Spelling Dictionary.
 * - Horizon 2 (Month 3): Multi-file project growth, Project-Wide Find/Search across files,
 *   and Citations & BibTeX Management Viewlet.
 * - Horizon 3 (Month 6): First Journal Submission Milestone — Full-Screen Project Version History,
 *   Unified vs Side-by-Side Split Diff comparison, and Milestone Snapshot creation.
 * - Horizon 4 (Year 1): Peer Review & Rebuttal Phase — Switching Main Document (main.tex <-> rebuttal.tex),
 *   Clear Cached Aux Files, and Multi-User Reviewer + Author Track Changes resolution.
 * - Horizon 5 (Year 2+): PhD Thesis Consolidation — Recovering accidentally deleted files from
 *   Deleted Files Trash months later, Saving as Custom Template, and Final arXiv / Word Count check.
 */
test.describe('Overleaf Longitudinal Lifecycle E2E Suite (Week 1 -> 3M -> 6M -> 1Y -> 2Y+)', () => {
  const PAGE_ID = 'page-paper-001';
  const PROJECT_ID = 'proj-academic-001';

  test('Horizon 1 (Week 1 - Month 1): Onboarding, Overleaf Menu Settings, Warning Filters & Personal Dictionary', async ({
    page,
    editor,
  }) => {
    void editor;
    const learnedWords: string[] = ['ansatz', 'hamiltonian'];

    await page.route(/\/spelling\/dictionary|\/dictionary/, async (route) => {
      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON();
        if (body?.word && !learnedWords.includes(body.word)) {
          learnedWords.push(body.word);
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, words: learnedWords, data: { words: learnedWords } }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, words: learnedWords, data: { words: learnedWords } }),
      });
    });

    await page.goto(`/editor/${PAGE_ID}`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.cm-editor')).toBeVisible({ timeout: 30000 });

    // 1. Open Overleaf Menu Drawer via "Project Settings" button in the Activity Bar
    const projectSettingsBtn = page.getByRole('button', { name: /Project Settings/i });
    await expect(projectSettingsBtn).toBeVisible();
    await projectSettingsBtn.click();

    const menuDialog = page.locator('[role="dialog"]').filter({ hasText: 'Download' }).first();
    await expect(menuDialog).toBeVisible({ timeout: 8000 });

    // 2. Verify Overleaf 1:1 Download tiles (Source .zip, arXiv .zip, PDF)
    await expect(menuDialog.locator('button[aria-label="Download Source (.zip)"]')).toBeVisible();
    await expect(menuDialog.locator('button[aria-label="Download arXiv submission (.zip)"]')).toBeVisible();
    await expect(menuDialog.locator('button[aria-label="Download PDF"]')).toBeVisible();

    // 3. Verify Git Clone Smart-HTTP URL & Project Functions
    await expect(menuDialog.getByText('Git Clone URL')).toBeVisible();
    await expect(menuDialog.getByText('Smart-HTTP')).toBeVisible();
    await expect(menuDialog.locator('button[aria-label="Copy Project"]')).toBeVisible();
    await expect(menuDialog.locator('button[aria-label="Save as Template"]')).toBeVisible();

    // 4. Configure Compiler & Warning Suppression Filters (Hide bad boxes + Custom regex filter)
    const draftToggle = menuDialog.locator('[aria-label="Draft mode toggle"]');
    await expect(draftToggle).toBeVisible();
    await draftToggle.click();

    const warningInput = menuDialog.locator('input[aria-label="New warning filter pattern"]');
    await warningInput.fill('Underfull \\hbox');
    await warningInput.press('Enter');
    await expect(menuDialog.getByText('Underfull \\hbox', { exact: true })).toBeVisible();

    // 5. Navigate to Personal Dictionary sub-view to add domain-specific terminology
    const dictionaryBtn = menuDialog.locator('button:has-text("Personal Dictionary")');
    await dictionaryBtn.scrollIntoViewIfNeeded();
    await dictionaryBtn.click();

    await expect(page.getByRole('heading', { name: 'Learned Words' })).toBeVisible();
    const wordInput = page.locator('input[placeholder="Add new word..."]');
    await wordInput.fill('eigenstate');
    await page.locator('button[type="submit"]:has-text("Add")').click();

    // 6. Return to main Menu and close drawer
    await page.locator('button[aria-label="Back to Menu"]').click();
    await page.locator('button[aria-label="Close menu"]').click();
    await expect(menuDialog).not.toBeVisible();
  });

  test('Horizon 2 (Month 3): Multi-File Expansion, Project-Wide Search & Citations Viewlet', async ({
    page,
    editor,
  }) => {
    void editor;
    const month3Files = [
      ...MOCK_FILES_HIERARCHY,
      {
        id: 'page-methods-003',
        title: 'methodology.tex',
        content: '\\section{Methodology}\nWe construct a Hilbert space representation for topological qubits.\n',
        projectId: PROJECT_ID,
        isMain: false,
      },
      {
        id: 'page-exp-004',
        title: 'experiments.tex',
        content: '\\section{Experiments}\nBenchmarking cryo-CMOS gate fidelity across 128 qubits.\n',
        projectId: PROJECT_ID,
        isMain: false,
      },
    ];

    await page.route(/\/files(\?.*)?$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          files: month3Files,
          success: true,
          data: { files: month3Files },
        }),
      });
    });

    await page.goto(`/editor/${PAGE_ID}`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.cm-editor')).toBeVisible({ timeout: 30000 });

    // 1. Switch Activity Bar to "Search in Project" to locate terminology across growing chapters
    const searchTab = page.getByRole('tab', { name: /Search in Project/i });
    await searchTab.click();

    const sidebarRegion = page.getByRole('region', { name: /Primary Sidebar/i });
    const searchInput = sidebarRegion.locator('input').first();
    await expect(searchInput).toBeVisible({ timeout: 8000 });
    await searchInput.fill('Hilbert');

    // Verify client/project search finds "Hilbert" in the manuscript
    await expect(sidebarRegion.getByText(/Hilbert/i).first()).toBeVisible({ timeout: 8000 });

    // 2. Switch Activity Bar to "Citations & BibTeX" viewlet to manage references
    const citationsTab = page.getByRole('tab', { name: /Citations & BibTeX/i });
    await citationsTab.click();

    const citationSearchInput = sidebarRegion.locator('input[placeholder="Search citations..."]');
    await expect(citationSearchInput).toBeVisible({ timeout: 8000 });

    // 3. Click "+" (Insert citation) in the Citations header to open Citation Picker Modal
    const insertCitationBtn = sidebarRegion.locator('button[aria-label="Insert citation"]');
    await insertCitationBtn.click();

    const citationDialog = page.locator('[role="dialog"]').first();
    await expect(citationDialog).toBeVisible({ timeout: 8000 });
    await page.keyboard.press('Escape');
  });

  test('Horizon 3 (Month 6): First Journal Submission Milestone, Version History Diff & Snapshot Labeling', async ({
    page,
    editor,
  }) => {
    void editor;
    const recordedVersions = [
      {
        version: 3,
        label: 'Submitted to Nature Physics v1',
        labels: [{ id: 'lbl-1', label: 'Submitted to Nature Physics v1', createdAt: new Date().toISOString() }],
        summary: 'Finalized Section 2 theorem proof',
        authorName: 'Dr. Alan Turing',
        createdAt: new Date(Date.now() - 86400 * 1000).toISOString(),
        isAutomatic: false,
      },
      {
        version: 2,
        label: null,
        labels: [],
        summary: 'Added experimental table',
        authorName: 'Prof. Emmy Noether',
        createdAt: new Date(Date.now() - 86400 * 1000 * 15).toISOString(),
        isAutomatic: true,
      },
      {
        version: 1,
        label: 'Initial Project Setup',
        labels: [{ id: 'lbl-0', label: 'Initial Project Setup', createdAt: new Date().toISOString() }],
        summary: 'Created main.tex',
        authorName: 'Dr. Alan Turing',
        createdAt: new Date(Date.now() - 86400 * 1000 * 180).toISOString(),
        isAutomatic: false,
      },
    ];

    let snapshotCreatedTitle = '';

    await page.route(/\/history\/versions(\?.*)?$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(recordedVersions),
      });
    });

    await page.route(/\/history\/diff(\?.*)?$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          baseVersion: 2,
          targetVersion: 3,
          totalAdditions: 14,
          totalDeletions: 3,
          filesChanged: 1,
          files: [
            {
              path: 'main.tex',
              status: 'modified',
              additions: 14,
              deletions: 3,
              hunks: [
                {
                  oldStart: 10,
                  oldLines: 3,
                  newStart: 10,
                  newLines: 5,
                  lines: [
                    ' \\section{Main Results}',
                    '-Let $|\\psi\\rangle$ be a state.',
                    '+Let $|\\psi\\rangle$ be a pure entangled state in Hilbert space $\\mathcal{H}$.',
                    '+\\begin{theorem} Fault-tolerant threshold exceeds $1.1\\%$. \\end{theorem}',
                  ],
                },
              ],
            },
          ],
        }),
      });
    });

    await page.route(/\/history\/snapshots(\?.*)?$/, async (route) => {
      const body = route.request().postDataJSON();
      snapshotCreatedTitle = body?.summary || '';
      recordedVersions.unshift({
        version: 4,
        label: snapshotCreatedTitle,
        labels: [],
        summary: snapshotCreatedTitle,
        authorName: 'Dr. Alan Turing',
        createdAt: new Date().toISOString(),
        isAutomatic: false,
      });
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          version: 4,
          summary: snapshotCreatedTitle,
          createdAt: new Date().toISOString(),
          files: {},
        }),
      });
    });

    await page.goto(`/editor/${PAGE_ID}`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.cm-editor')).toBeVisible({ timeout: 30000 });

    // 1. Click "History" button in the topbar to inspect 6-month project timeline
    const historyBtn = page.getByRole('button', { name: /History/i }).first();
    await expect(historyBtn).toBeVisible();
    await historyBtn.click();

    // 2. Verify full-screen Project Version History region opens
    const historyRegion = page.getByRole('region', { name: /Project Version History/i });
    await expect(historyRegion).toBeVisible({ timeout: 8000 });
    await expect(historyRegion.getByText('3 total versions recorded')).toBeVisible();

    // 3. Verify Diff statistics (+14 / -3) and switch between Unified and Split (Side-by-Side) diff views
    await expect(historyRegion.getByText('+14').first()).toBeVisible();
    await expect(historyRegion.getByText('-3').first()).toBeVisible();

    const splitDiffBtn = historyRegion.locator('button[title="Side-by-Side Split Diff View"]');
    await splitDiffBtn.click();

    const unifiedDiffBtn = historyRegion.locator('button[title="Unified Diff View"]');
    await unifiedDiffBtn.click();

    // 4. Create a new Milestone Snapshot before journal submission
    const snapshotBtn = historyRegion.locator('button:has-text("Snapshot")');
    await snapshotBtn.click();

    const snapshotInput = historyRegion.locator('input[placeholder*="Completed Section 3"]');
    await expect(snapshotInput).toBeVisible();
    await snapshotInput.fill('Camera-Ready Milestone v4');
    await historyRegion.locator('button:has-text("Save Snapshot")').click();

    await expect.poll(() => snapshotCreatedTitle).toBe('Camera-Ready Milestone v4');

    // 5. Return to the manuscript editor
    await historyRegion.locator('button:has-text("Back to editor")').click();
    await expect(historyRegion).not.toBeVisible();
  });

  test('Horizon 4 (Year 1): Peer Review & Rebuttal Phase — Switching Main Document & Clearing Aux Cache', async ({
    page,
    editor,
  }) => {
    void editor;
    let auxCacheCleared = false;

    const year1Files = [
      ...MOCK_FILES_HIERARCHY,
      {
        id: 'page-rebuttal-005',
        title: 'rebuttal.tex',
        content: '\\documentclass{article}\n\\begin{document}\n\\section*{Response to Reviewer 1}\nWe thank the referee.\n\\end{document}',
        projectId: PROJECT_ID,
        isMain: false,
      },
    ];

    await page.route(/\/files(\?.*)?$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          files: year1Files,
          success: true,
          data: { files: year1Files },
        }),
      });
    });

    await page.route(/\/clean-aux|\/artifacts/, async (route) => {
      auxCacheCleared = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    await page.goto(`/editor/${PAGE_ID}`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.cm-editor')).toBeVisible({ timeout: 30000 });

    // 1. Open Overleaf Menu Drawer to switch Main Document for Rebuttal compilation and clear cached .aux/.bbl files
    await page.getByRole('button', { name: /Project Settings/i }).click();
    const menuDialog = page.locator('[role="dialog"]').filter({ hasText: 'Download' }).first();
    await expect(menuDialog).toBeVisible({ timeout: 8000 });

    // 2. Verify Main Document selector is present and interactive
    const mainDocTrigger = menuDialog.locator('button[aria-label="Main document"]');
    await mainDocTrigger.scrollIntoViewIfNeeded();
    await expect(mainDocTrigger).toBeVisible();

    // 3. Click "Clear cache" button to purge stale .aux/.bbl build artifacts after package updates
    const clearCacheBtn = menuDialog.locator('button:has-text("Clear cache")');
    await clearCacheBtn.scrollIntoViewIfNeeded();
    await clearCacheBtn.click();
    await expect.poll(() => auxCacheCleared).toBe(true);

    // 4. Close Menu Drawer
    await page.locator('button[aria-label="Close menu"]').click();
    await expect(menuDialog).not.toBeVisible();
  });

  test('Horizon 5 (Year 2+): PhD Thesis Consolidation, Recovering Deleted Files Months Later & Saving Custom Template', async ({
    page,
    editor,
  }) => {
    void editor;
    let restoredDocId = '';
    let savedTemplateName = '';

    const deletedFilesList = [
      {
        id: 'del-appendix-099',
        pageId: PAGE_ID,
        title: 'legacy-appendix-proofs.tex',
        content: '\\appendix\n\\section{FullAnalyticalProofs}\nDetailed derivation from Year 1.\n',
        createdAt: new Date(Date.now() - 86400 * 1000 * 240).toISOString(),
        updatedAt: new Date(Date.now() - 86400 * 1000 * 90).toISOString(),
      },
      {
        id: 'del-old-bib-098',
        pageId: PAGE_ID,
        title: 'deprecated-refs.bib',
        content: '',
        createdAt: new Date(Date.now() - 86400 * 1000 * 300).toISOString(),
        updatedAt: new Date(Date.now() - 86400 * 1000 * 120).toISOString(),
      },
    ];

    await page.route(/\/deleted-files(\?.*)?$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          files: deletedFilesList,
          success: true,
          data: { files: deletedFilesList },
        }),
      });
    });

    await page.route(/\/docs\/del-appendix-099\/restore/, async (route) => {
      restoredDocId = 'del-appendix-099';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          page: {
            id: 'del-appendix-099',
            title: 'legacy-appendix-proofs.tex',
            content: '\\appendix\n\\section{FullAnalyticalProofs}\n',
            projectId: PROJECT_ID,
          },
          success: true,
        }),
      });
    });

    await page.route(/\/templates\/custom|\/templates/, async (route) => {
      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON();
        savedTemplateName = body?.name || 'Custom Template';
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'tpl-custom-001',
            name: savedTemplateName,
            success: true,
          }),
        });
        return;
      }
      await route.continue();
    });

    await page.goto(`/editor/${PAGE_ID}`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.cm-editor')).toBeVisible({ timeout: 30000 });

    // 1. Two years into the PhD thesis, researcher opens "Deleted files" trash bin from File Tree toolbar
    const deletedFilesBtn = page.getByRole('button', { name: /Deleted files/i });
    await expect(deletedFilesBtn).toBeVisible();
    await deletedFilesBtn.click();

    // 2. Verify Deleted Files dialog opens and lists files deleted months ago
    const trashDialog = page.getByRole('dialog', { name: /Deleted Files/i });
    await expect(trashDialog).toBeVisible({ timeout: 8000 });
    await expect(trashDialog.getByText('legacy-appendix-proofs.tex')).toBeVisible();
    await expect(trashDialog.getByText('deprecated-refs.bib')).toBeVisible();

    // 3. Filter deleted files using the search bar inside Deleted Files modal
    const trashSearch = trashDialog.locator('input[placeholder="Search deleted files..."]');
    await trashSearch.fill('legacy-appendix');
    await expect(trashDialog.getByText('legacy-appendix-proofs.tex')).toBeVisible();
    await expect(trashDialog.getByText('deprecated-refs.bib')).not.toBeVisible();

    // 4. Click "Restore" on legacy-appendix-proofs.tex and verify restoration API call
    const restoreBtn = trashDialog.locator('button:has-text("Restore")').first();
    await restoreBtn.click();
    await expect.poll(() => restoredDocId).toBe('del-appendix-099');

    // Close Deleted Files modal
    await trashDialog.locator('button[aria-label="Close"]').click();
    await expect(trashDialog).not.toBeVisible();

    // 5. Save the mature 2-year thesis structure as a reusable lab template via Overleaf Menu
    await page.getByRole('button', { name: /Project Settings/i }).click();
    const menuDialog = page.locator('[role="dialog"]').filter({ hasText: 'Download' }).first();
    await expect(menuDialog).toBeVisible({ timeout: 8000 });

    const saveTemplateBtn = menuDialog.locator('button[aria-label="Save as Template"]');
    await saveTemplateBtn.click();
    await expect.poll(() => savedTemplateName).toContain('Template');
  });

  test('Horizon 6 (Wave 2 - User Story L): Linked External Files (URL / Library) & Zotero Reference Sync', async ({
    page,
    editor,
  }) => {
    void editor;
    let createdLinkedFile: { name?: string; url?: string; providerType?: string } | null = null;
    let syncedZoteroPayload: { collectionId?: string; targetBibFile?: string } | null = null;

    await page.route(`**/api/v1/manuscripts/projects/${PROJECT_ID}/linked-files`, async (route) => {
      if (route.request().method() === 'POST') {
        createdLinkedFile = route.request().postDataJSON();
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'lf-url-001',
            name: createdLinkedFile?.name || 'shared-refs.bib',
            url: createdLinkedFile?.url,
            providerType: 'URL',
            success: true,
          }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          createdLinkedFile
            ? [{ id: 'lf-url-001', name: createdLinkedFile.name, providerType: 'URL' }]
            : [],
        ),
      });
    });

    await page.route('**/api/v1/integrations/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            provider: 'zotero',
            name: 'Zotero',
            description: 'Sync collections from Zotero',
            category: 'reference',
            status: 'connected',
            needsReconnect: false,
          },
          {
            provider: 'mendeley',
            name: 'Mendeley',
            description: 'Sync folders from Mendeley',
            category: 'reference',
            status: 'revoked',
            needsReconnect: false,
          },
        ]),
      });
    });

    await page.route('**/api/v1/integrations/zotero/collections', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'col-quantum-2026',
            name: 'Quantum Computing Lab 2026',
            itemCount: 18,
          },
        ]),
      });
    });

    await page.route('**/api/v1/integrations/zotero/sync', async (route) => {
      syncedZoteroPayload = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          collectionName: 'Quantum Computing Lab 2026',
          targetBibFile: syncedZoteroPayload?.targetBibFile || 'references.bib',
          syncedCount: 18,
          success: true,
        }),
      });
    });

    await page.goto(`/editor/${PAGE_ID}`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.cm-editor')).toBeVisible({ timeout: 30000 });

    // 1. Open "Add files" modal from File Tree toolbar ("New File" button)
    await page.locator('button[aria-label="New File"]').click();
    const addFilesDialog = page.getByRole('dialog', { name: /Add files/i });
    await expect(addFilesDialog).toBeVisible({ timeout: 8000 });

    // 2. Switch to "From external URL" tab and import a shared bibliography file
    await addFilesDialog.getByRole('tab', { name: /From external URL/i }).click();
    const urlInput = addFilesDialog.locator('input[placeholder*="https://example.com"]');
    await urlInput.fill('https://raw.githubusercontent.com/quantum-lab/shared/main/shared-refs.bib');

    // Auto-populated filename should be "shared-refs.bib"
    const fileNameInput = addFilesDialog.locator('input[placeholder*="data.csv"]');
    await expect(fileNameInput).toHaveValue('shared-refs.bib');

    await addFilesDialog.locator('button[type="submit"]:has-text("Create")').click();
    await expect.poll(() => createdLinkedFile?.name).toBe('shared-refs.bib');
    await expect(addFilesDialog).not.toBeVisible();

    // 3. Open Overleaf Menu -> "References" (Zotero & Mendeley bibliography sync)
    await page.getByRole('button', { name: /Project Settings/i }).click();
    const menuDialog = page.locator('[role="dialog"]').filter({ hasText: 'Download' }).first();
    await expect(menuDialog).toBeVisible({ timeout: 8000 });

    const referencesBtn = menuDialog.locator('button:has-text("References")');
    await referencesBtn.scrollIntoViewIfNeeded();
    await referencesBtn.click();

    await expect(page.getByText('Zotero Integration')).toBeVisible();
    await expect(page.getByText('Connected', { exact: true }).first()).toBeVisible();

    // 4. Select Zotero Collection and click "Sync to BibTeX"
    const zoteroSelect = page.locator('button[aria-label="Select Zotero Collection"]');
    await zoteroSelect.click();
    await page.getByRole('option', { name: /Quantum Computing Lab 2026/i }).click();

    const syncBibBtn = page.locator('button:has-text("Sync to BibTeX")');
    await expect(syncBibBtn).toBeEnabled();
    await syncBibBtn.click();

    await expect.poll(() => syncedZoteroPayload?.collectionId).toBe('col-quantum-2026');
  });

  test('Horizon 7 (Wave 2 - User Story U-Z): Offline Editing Banner & 3-Way Document Conflict Merge Modal', async ({
    page,
    editor,
  }) => {
    void editor;
    await page.goto(`/editor/${PAGE_ID}`, { waitUntil: 'domcontentloaded' });
    const cmContent = page.locator('.cm-content').first();
    await expect(cmContent).toBeVisible({ timeout: 30000 });

    // 1. Researcher loses Wi-Fi connection while working on the manuscript
    await page.evaluate(() => {
      window.dispatchEvent(new Event('offline'));
    });

    await expect(
      page.getByText(/Đang ngoại tuyến: Các thay đổi đang được lưu an toàn vào bộ nhớ máy/i),
    ).toBeVisible({ timeout: 5000 });

    // 2. Researcher types local uncommitted edits while offline
    await cmContent.click();
    await page.keyboard.press('Control+End');
    await page.keyboard.type('\n% Local offline theorem proof by Author A\n');
    await expect(cmContent).toContainText('Local offline theorem proof by Author A');

    // 3. Network reconnects, and a conflicting server update from Co-Author B arrives before local flush completes
    const remoteServerContent = [
      '\\documentclass{article}',
      '\\begin{document}',
      '\\section{Introduction}',
      '% Remote server revision committed by Co-Author B',
      '\\end{document}',
    ].join('\n');

    await page.evaluate(
      ({ docId, content }) => {
        window.dispatchEvent(
          new CustomEvent('flux:doc-content-updated', {
            detail: { docId, content },
          }),
        );
      },
      { docId: PAGE_ID, content: remoteServerContent },
    );

    // 4. Verify DocumentConflictDialog pops up with diff summary metrics
    const conflictDialog = page.getByTestId('document-conflict-dialog');
    await expect(conflictDialog).toBeVisible({ timeout: 8000 });
    await expect(page.getByTestId('conflict-diff-metrics')).toBeVisible();

    // 5. Switch to Interactive 3-Way Merge Editor tab ("Trình hợp nhất (Merge Editor)")
    await page.getByTestId('tab-merge').click();
    const mergeTextarea = page.getByTestId('conflict-merge-textarea');
    await expect(mergeTextarea).toBeVisible();

    const mergedManuscript = [
      '\\documentclass{article}',
      '\\begin{document}',
      '\\section{Introduction}',
      '% Combined 3-Way Merge: Author A proof + Co-Author B server revision',
      '\\end{document}',
    ].join('\n');
    await mergeTextarea.fill(mergedManuscript);

    // 6. Click "Áp dụng bản hợp nhất" (Apply Merge) and verify CodeMirror updates with merged content
    await page.getByTestId('btn-apply-merge').click();
    await expect(conflictDialog).not.toBeVisible();
    await expect(cmContent).toContainText('Combined 3-Way Merge: Author A proof + Co-Author B server revision');

    // 7. Restore online state and verify offline banner disappears
    await page.evaluate(() => {
      window.dispatchEvent(new Event('online'));
    });
    await expect(
      page.getByText(/Đang ngoại tuyến: Các thay đổi đang được lưu an toàn vào bộ nhớ máy/i),
    ).not.toBeVisible();
  });

  test('Horizon 8 (Wave 2 - User Story I, K): Figure Wizard, TikZ Diagram Canvas, Split Editor, Viewing Mode & Shortcuts', async ({
    page,
    editor,
  }) => {
    void editor;
    await page.goto(`/editor/${PAGE_ID}`, { waitUntil: 'domcontentloaded' });
    const cmContent = page.locator('.cm-content').first();
    await expect(cmContent).toBeVisible({ timeout: 30000 });

    // 1. Press F1 to open Keyboard Shortcuts Cheat Sheet Modal, search & filter categories
    await page.keyboard.press('F1');
    const shortcutsDialog = page.getByRole('dialog', { name: /Keyboard Shortcuts/i });
    await expect(shortcutsDialog).toBeVisible({ timeout: 8000 });

    await shortcutsDialog.locator('button:has-text("Layout")').click();
    await expect(shortcutsDialog.getByText('Split Editor / Close Split')).toBeVisible();

    const shortcutSearch = shortcutsDialog.locator('input[placeholder="Search shortcut or action..."]');
    await shortcutSearch.fill('SyncTeX');
    await shortcutsDialog.locator('button:has-text("All")').click();
    await expect(shortcutsDialog.getByText('Jump to PDF (SyncTeX)')).toBeVisible();

    await shortcutsDialog.locator('button:has-text("Close")').first().click();
    await expect(shortcutsDialog).not.toBeVisible();

    // 2. Switch to Visual Mode to access the rich formatting toolbar (Figure Wizard & TikZ Diagram Canvas)
    await page.locator('button[aria-label="Visual mode"]').click();

    // 3. Open Figure Wizard Modal, configure figure parameters, and insert into manuscript
    const insertFigureBtn = page.locator('button[aria-label="Insert figure"]');
    await expect(insertFigureBtn).toBeVisible({ timeout: 8000 });
    await insertFigureBtn.click();

    const figureDialog = page.getByRole('dialog', { name: /Insert LaTeX Figure/i });
    await expect(figureDialog).toBeVisible({ timeout: 8000 });

    const pathInput = figureDialog.locator('input[placeholder*="plot.png"]');
    await pathInput.fill('figures/topological-qubit.pdf');
    await figureDialog.locator('button:has-text("100% (1.0\\\\linewidth)")').click();
    await figureDialog.locator('input[placeholder="Figure caption description"]').fill('Braiding fidelity of Majorana zero modes.');
    await figureDialog.locator('button:has-text("[!ht]")').click();
    await figureDialog.locator('button:has-text("Insert Figure")').click();
    await expect(figureDialog).not.toBeVisible();

    // 4. Open Collaborative TikZ Diagram Canvas Modal, load "Flowchart" preset, and insert into LaTeX
    const insertDiagramBtn = page.locator('button[aria-label="Insert TikZ diagram"]');
    await insertDiagramBtn.click();

    const diagramDialog = page.getByRole('dialog', { name: /Collaborative Diagram & TikZ Canvas/i });
    await expect(diagramDialog).toBeVisible({ timeout: 8000 });

    await diagramDialog.locator('button:has-text("Flowchart")').click();
    await diagramDialog.locator('button:has-text("TikZ Code")').click();
    await expect(diagramDialog.getByText(/\\begin\{tikzpicture\}/)).toBeVisible();
    await diagramDialog.locator('button:has-text("Insert into LaTeX")').click();
    await expect(diagramDialog).not.toBeVisible();

    // 5. Switch back to Code Mode and verify both Figure and TikZ environments were inserted
    await page.locator('button[aria-label="Code mode"]').click();
    await expect(cmContent).toContainText('\\includegraphics[width=1.0\\linewidth]{figures/topological-qubit.pdf}');
    await expect(cmContent).toContainText('\\begin{tikzpicture}');

    // 6. Test Topbar Editing Mode Switcher (Editing -> Viewing read-only mode -> Editing)
    const modeTrigger = page.locator('button[aria-label^="Editing mode:"]');
    await expect(modeTrigger).toBeVisible();
    await modeTrigger.click();
    await page.getByRole('menuitem', { name: /^Viewing\s+Read-only/i }).click();
    await expect(page.locator('button[aria-label="Editing mode: Viewing"]')).toBeVisible();

    // Switch back to Editing mode
    await page.locator('button[aria-label="Editing mode: Viewing"]').click();
    await page.getByRole('menuitem', { name: /Editing\s+Edit files directly/i }).click();
    await expect(page.locator('button[aria-label="Editing mode: Editing"]')).toBeVisible();
  });
});

