import { test, expect } from '../fixtures/editor.fixture';
import {
  MOCK_PAGE,
  MOCK_FILES_HIERARCHY,
} from '../fixtures/mock-data';

/**
 * overleaf-library-evolution.spec.ts
 *
 * Evolutionary E2E Suite for connecting Manuscript Editor (Overleaf-parity) with Reference Library (/library).
 *
 * Wave 1 (Stages 1 -> 3):
 * - Stage 1 (US-LIB-01 -> US-LIB-03): Manual .bib parsing, In-Document citation tracking,
 *   and Live Academic Identifier (DOI / arXiv) resolution inside 3-Column Citation Cockpit.
 * - Stage 2 (US-LIB-04 -> US-LIB-06): Unified Workspace Library (/library <-> /editor),
 *   switching In Document <-> Library tabs, 3-Column Cockpit inspection (Abstract, DOI, BibTeX),
 *   and One-Click Citation Insertion with Overleaf-parity Auto-Sync into references.bib.
 * - Stage 3 (US-LIB-07 -> US-LIB-09): Real-time Unresolved Citation detection (\cite{missing_key}),
 *   Authoritative BibTeX Validation (Duplicate Keys & Incomplete Metadata warnings),
 *   and Project-Wide Safe Citekey Refactoring (RenameCitationModal across .tex and .bib).
 */
test.describe('Library <-> Editor Evolutionary E2E Suite — Wave 1 (Stages 1 to 3)', () => {
  const PAGE_ID = 'page-paper-001';
  const PROJECT_ID = 'proj-academic-001';

  const INITIAL_BIB_CONTENT = `@article{einstein1935can,
  title = {Can Quantum-Mechanical Description of Physical Reality Be Considered Complete?},
  author = {Einstein, Albert and Podolsky, Boris and Rosen, Nathan},
  year = {1935},
  journal = {Physical Review},
  volume = {47},
  pages = {777--780},
  doi = {10.1103/PhysRev.47.777}
}
`;

  const WORKSPACE_LIBRARY_ITEMS = [
    {
      id: 'lib-item-vaswani-2017',
      citationKey: 'vaswani2017attention',
      itemType: 'conferencePaper',
      title: 'Attention Is All You Need',
      authors: ['Ashish Vaswani', 'Noam Shazeer', 'Niki Parmar', 'Jakob Uszkoreit'],
      year: 2017,
      journal: 'Advances in Neural Information Processing Systems (NeurIPS)',
      publicationTitle: 'Advances in Neural Information Processing Systems (NeurIPS)',
      doi: '10.48550/arXiv.1706.03762',
      url: 'https://arxiv.org/abs/1706.03762',
      abstract:
        'The dominant sequence transduction models are based on complex recurrent or convolutional neural networks that include an encoder and a decoder. The best performing models also connect the encoder and decoder through an attention mechanism. We propose a new simple network architecture, the Transformer, based solely on attention mechanisms, dispensing with recurrence and convolutions entirely.',
    },
    {
      id: 'lib-item-kitaev-2003',
      citationKey: 'kitaev2003fault',
      itemType: 'journalArticle',
      title: 'Fault-tolerant quantum computation by anyons',
      authors: ['A. Yu. Kitaev'],
      year: 2003,
      journal: 'Annals of Physics',
      publicationTitle: 'Annals of Physics',
      doi: '10.1016/S0003-4916(02)00018-0',
      abstract:
        'A two-dimensional quantum system with anyonic excitations can be considered as a quantum computer. Unitary transformations can be performed by moving the excitations around each other.',
    },
  ];

  test('Stage 1 (US-LIB-01 & US-LIB-02): .bib Parsing, In-Document Citations & Live DOI Identifier Resolution', async ({
    page,
    editor,
  }) => {
    void editor;

    const stage1Latex = `\\documentclass{article}
\\begin{document}
\\section{Introduction}
Quantum entanglement was scrutinized by Einstein et al. \\cite{einstein1935can}.
\\bibliographystyle{plain}
\\bibliography{references}
\\end{document}
`;

    await page.route(/\/docs\/page-paper-001|\/pages\/page-paper-001/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          page: { ...MOCK_PAGE, content: stage1Latex, docContent: stage1Latex },
          success: true,
          data: { page: { ...MOCK_PAGE, content: stage1Latex, docContent: stage1Latex } },
        }),
      });
    });

    await page.route(/\/files(\?.*)?$/, async (route) => {
      const filesWithBib = MOCK_FILES_HIERARCHY.map((f) =>
        f.title === 'references.bib'
          ? { ...f, content: INITIAL_BIB_CONTENT }
          : { ...f, content: stage1Latex }
      );
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          files: filesWithBib,
          success: true,
          data: { files: filesWithBib },
        }),
      });
    });

    // Mock live DOI resolution endpoint (/api/v1/manuscripts/projects/:projectId/citations/resolve)
    let resolvedDoiIdentifier = '';
    await page.route(/\/citations\/resolve/, async (route) => {
      const body = route.request().postDataJSON();
      resolvedDoiIdentifier = body?.identifier || '';
      const resolvedEntry = {
        key: 'lecun2015deep',
        type: 'article',
        title: 'Deep learning',
        author: 'LeCun, Yann and Bengio, Yoshua and Hinton, Geoffrey',
        year: '2015',
        journal: 'Nature',
        doi: '10.1038/nature14539',
        rawBibtex: `@article{lecun2015deep,\n  title={Deep learning},\n  author={LeCun, Yann and Bengio, Yoshua and Hinton, Geoffrey},\n  journal={Nature},\n  volume={521},\n  pages={436--444},\n  year={2015},\n  doi={10.1038/nature14539}\n}`,
      };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          entry: resolvedEntry,
          appendedToFile: 'references.bib',
          data: { entry: resolvedEntry, appendedToFile: 'references.bib' },
        }),
      });
    });

    await page.goto(`/editor/${PAGE_ID}`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.cm-editor')).toBeVisible({ timeout: 30000 });

    // 1. Open Citations Sidebar Viewlet
    const citationsActivityBtn = page.locator('button[aria-label="Citations & BibTeX"]').first();
    await expect(citationsActivityBtn).toBeVisible();
    await citationsActivityBtn.click();

    // 2. Verify In-Document citation from references.bib is parsed and displayed
    await expect(page.getByText('einstein1935can').first()).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByText(/Can Quantum-Mechanical Description of Physical Reality Be Considered Complete/i).first()
    ).toBeVisible();

    // 3. Open 3-Column Citation Cockpit via "Insert citation" (+) button
    const insertCitationBtn = page.locator('button[aria-label="Insert citation"]').first();
    await expect(insertCitationBtn).toBeVisible();
    await insertCitationBtn.click();

    const pickerModal = page.locator('[role="dialog"]').filter({ hasText: 'Insert Citation' }).first();
    await expect(pickerModal).toBeVisible({ timeout: 8000 });

    // 4. Enter a live DOI into the Cockpit search bar and verify Academic Identifier detection
    const searchInput = pickerModal.locator('input[placeholder="Search title, author, key, DOI..."]');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('10.1038/nature14539');

    await expect(pickerModal.getByText('Academic identifier')).toBeVisible();
    const resolveBtn = pickerModal.getByRole('button', { name: 'Resolve' });
    await expect(resolveBtn).toBeVisible();
    await resolveBtn.click();

    // 5. Verify DOI was resolved via backend and selected in Column 3 Inspector
    await expect.poll(() => resolvedDoiIdentifier).toBe('10.1038/nature14539');
    await expect(pickerModal.getByText('@lecun2015deep')).toBeVisible({ timeout: 8000 });
    await expect(pickerModal.getByRole('heading', { name: 'Deep learning' })).toBeVisible();

    // 6. Click "Insert Citation" in Cockpit footer and verify \cite{lecun2015deep} is inserted into main.tex
    const confirmInsertBtn = pickerModal.getByRole('button', { name: /Insert Citation/i });
    await confirmInsertBtn.click();
    await expect(pickerModal).not.toBeVisible();

    await expect(page.locator('.cm-content')).toContainText('\\cite{lecun2015deep}');
  });

  test('Stage 2 (US-LIB-04, US-LIB-05 & US-LIB-06): Unified Workspace Library, 3-Column Inspector & Auto-Sync to references.bib', async ({
    page,
    editor,
  }) => {
    void editor;

    let currentBibContent = INITIAL_BIB_CONTENT;
    const syncedBibUpdates: string[] = [];

    // Mock Workspace Library items endpoint (/api/v1/projects/:projectId/library/items & /api/v1/library/items)
    await page.route(/\/library\/items(\?.*)?$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          items: WORKSPACE_LIBRARY_ITEMS,
          total: WORKSPACE_LIBRARY_ITEMS.length,
          data: {
            items: WORKSPACE_LIBRARY_ITEMS,
            total: WORKSPACE_LIBRARY_ITEMS.length,
          },
        }),
      });
    });

    await page.route(/\/files(\?.*)?$/, async (route) => {
      const filesWithBib = MOCK_FILES_HIERARCHY.map((f) =>
        f.title === 'references.bib'
          ? { ...f, content: currentBibContent }
          : { ...f, content: MOCK_PAGE.content }
      );
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          files: filesWithBib,
          success: true,
          data: { files: filesWithBib },
        }),
      });
    });

    // Capture updates to references.bib (page-bib-002) when Auto-Sync triggers
    await page.route(/\/docs\/page-bib-002|\/pages\/page-bib-002/, async (route) => {
      if (route.request().method() === 'PATCH' || route.request().method() === 'PUT' || route.request().method() === 'POST') {
        const payload = route.request().postDataJSON();
        const updatedText = payload?.content || payload?.docContent || '';
        if (updatedText) {
          currentBibContent = updatedText;
          syncedBibUpdates.push(updatedText);
        }
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          page: { id: 'page-bib-002', title: 'references.bib', content: currentBibContent },
        }),
      });
    });

    await page.goto(`/editor/${PAGE_ID}`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.cm-editor')).toBeVisible({ timeout: 30000 });

    // 1. Open Citations Sidebar Viewlet
    await page.locator('button[aria-label="Citations & BibTeX"]').first().click();

    // 2. Switch Bottom Navigation from "In Document" to "Library"
    const bottomNav = page.locator('nav[aria-label="Citations scope"]');
    await expect(bottomNav).toBeVisible();
    await bottomNav.getByRole('button', { name: 'Library' }).click();

    // 3. Verify papers from Flux's native /library appear in the Editor's Library tab
    await expect(page.getByText('vaswani2017attention').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Attention Is All You Need').first()).toBeVisible();
    await expect(page.getByText('kitaev2003fault').first()).toBeVisible();

    // 4. Open 3-Column Citation Cockpit and filter by "Workspace Library" in Column 1
    await page.locator('button[aria-label="Insert citation"]').first().click();
    const pickerModal = page.locator('[role="dialog"]').filter({ hasText: 'Insert Citation' }).first();
    await expect(pickerModal).toBeVisible({ timeout: 8000 });

    const workspaceLibTreeItem = pickerModal.getByRole('treeitem', { name: /Workspace Library/i });
    await expect(workspaceLibTreeItem).toBeVisible();
    await workspaceLibTreeItem.click();

    // 5. Select "Attention Is All You Need" in Column 2 and inspect Column 3 (Details & Inspector)
    const vaswaniCard = pickerModal.locator('[role="option"]').filter({ hasText: 'Attention Is All You Need' }).first();
    await expect(vaswaniCard).toBeVisible();
    await vaswaniCard.click();

    // Verify Column 3 metadata: citekey, DOI link, expandable Abstract, and BibTeX source
    await expect(pickerModal.getByText('@vaswani2017attention')).toBeVisible();
    await expect(pickerModal.getByText('DOI: 10.48550/arXiv.1706.03762')).toBeVisible();
    await expect(pickerModal.getByRole('heading', { name: 'Abstract' })).toBeVisible();

    const readMoreBtn = pickerModal.getByRole('button', { name: 'Read more' });
    await expect(readMoreBtn).toBeVisible();
    await readMoreBtn.click();
    await expect(pickerModal.getByRole('button', { name: 'Show less' })).toBeVisible();

    await expect(pickerModal.locator('pre code')).toContainText('vaswani2017attention');

    // 6. Click "Insert Citation" -> Verify \cite{vaswani2017attention} is inserted AND synced to references.bib
    await pickerModal.getByRole('button', { name: /Insert Citation/i }).click();
    await expect(pickerModal).not.toBeVisible();

    await expect(page.locator('.cm-content')).toContainText('\\cite{vaswani2017attention}');
    await expect(page.getByText(/Synced @vaswani2017attention to references\.bib/i)).toBeVisible({
      timeout: 8000,
    });
  });

  test('Stage 3 (US-LIB-07, US-LIB-08 & US-LIB-09): Unresolved Citations, Authoritative Validation & Project-Wide Citekey Refactoring', async ({
    page,
    editor,
  }) => {
    void editor;

    const stage3Latex = `\\documentclass{article}
\\begin{document}
\\section{Quantum Error Correction}
Foundational EPR analysis \\cite{einstein1935can} and future fault-tolerant scaling \\cite{preskill2026megaqubit}.
\\end{document}
`;

    await page.route(/\/docs\/page-paper-001|\/pages\/page-paper-001/, async (route) => {
      if (route.request().method() === 'PATCH' || route.request().method() === 'PUT') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          page: { ...MOCK_PAGE, content: stage3Latex, docContent: stage3Latex },
          success: true,
          data: { page: { ...MOCK_PAGE, content: stage3Latex, docContent: stage3Latex } },
        }),
      });
    });

    await page.route(/\/files(\?.*)?$/, async (route) => {
      const filesWithBib = MOCK_FILES_HIERARCHY.map((f) =>
        f.title === 'references.bib'
          ? { ...f, content: INITIAL_BIB_CONTENT }
          : { ...f, content: stage3Latex }
      );
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          files: filesWithBib,
          success: true,
          data: { files: filesWithBib },
        }),
      });
    });

    // Mock authoritative BibTeX validation endpoint (/api/v1/manuscripts/projects/:projectId/citations/validate)
    await page.route(/\/citations\/validate/, async (route) => {
      const validationPayload = {
        isValid: false,
        totalEntries: 3,
        duplicateKeys: ['einstein1935can'],
        syntaxErrors: [],
        missingFieldWarnings: [
          {
            key: 'draft2025preprint',
            missingFields: ['year', 'journal'],
          },
        ],
      };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...validationPayload,
          success: true,
          data: validationPayload,
        }),
      });
    });

    await page.goto(`/editor/${PAGE_ID}`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.cm-editor')).toBeVisible({ timeout: 30000 });

    // 1. Open Citations Sidebar (In Document tab)
    await page.locator('button[aria-label="Citations & BibTeX"]').first().click();

    // 2. Verify Authoritative BibTeX Validation Banner (Duplicate Keys & Incomplete Metadata)
    await expect(page.getByText('Duplicate Keys (1)')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Incomplete Metadata (1)')).toBeVisible();
    await expect(page.getByText(/draft2025preprint.*missing year, journal/i)).toBeVisible();

    // 3. Verify Real-time Unresolved Citations detection for \cite{preskill2026megaqubit}
    await expect(page.getByText('Unresolved Citations (1)')).toBeVisible();
    const unresolvedRow = page.locator('[aria-label="Unresolved key preskill2026megaqubit, search reference"]');
    await expect(unresolvedRow).toBeVisible();

    // Click "Find" on the unresolved citation -> opens CitationPickerModal pre-filled with "preskill2026megaqubit"
    await unresolvedRow.getByRole('button', { name: 'Find' }).click();
    const pickerModal = page.locator('[role="dialog"]').filter({ hasText: 'Insert Citation' }).first();
    await expect(pickerModal).toBeVisible({ timeout: 8000 });
    const pickerSearch = pickerModal.locator('input[placeholder="Search title, author, key, DOI..."]');
    await expect(pickerSearch).toHaveValue('preskill2026megaqubit');
    await pickerModal.locator('button[aria-label="Close"]').click();
    await expect(pickerModal).not.toBeVisible();

    // 4. Project-Wide Citekey Refactoring via RenameCitationModal
    // Open CitationPickerModal, select @einstein1935can, and click "Rename Key" in Column 3 Quick Actions
    await page.locator('button[aria-label="Insert citation"]').first().click();
    await expect(pickerModal).toBeVisible({ timeout: 8000 });
    const einsteinCard = pickerModal
      .locator('[role="option"]')
      .filter({ hasText: 'Can Quantum-Mechanical Description' })
      .first();
    await expect(einsteinCard).toBeVisible();
    await einsteinCard.click();

    const renameKeyBtn = pickerModal.locator('button[aria-label="Rename citation key"]');
    await expect(renameKeyBtn).toBeVisible();
    await renameKeyBtn.click();

    const renameModal = page
      .locator('[role="dialog"]')
      .filter({ hasText: 'Đổi tên khóa trích dẫn (Refactor Citekey)' })
      .first();
    await expect(renameModal).toBeVisible({ timeout: 8000 });
    await expect(renameModal.getByText('@einstein1935can')).toBeVisible();

    const newKeyInput = renameModal.locator('input[placeholder*="vaswani2017attention"]');
    await expect(newKeyInput).toBeVisible();

    // Test invalid key (contains spaces) -> shows error and disables submit button
    await newKeyInput.fill('einstein 1935 invalid');
    const confirmRenameBtn = renameModal.getByRole('button', { name: 'Xác nhận đổi tên' });
    await expect(confirmRenameBtn).toBeDisabled();

    // Enter valid new citekey "einstein1935epr" and confirm refactoring
    await newKeyInput.fill('einstein1935epr');
    await expect(confirmRenameBtn).toBeEnabled();
    await confirmRenameBtn.click();

    await expect(renameModal).not.toBeVisible();
    await expect(page.locator('.cm-content')).toContainText('\\cite{einstein1935epr}');
  });

  test('Stage 4 (US-LIB-11, US-LIB-12 & US-LIB-13): Collection Tree Filtering in Cockpit & Overleaf Menu Reference Integrations (Zotero/Mendeley Sync)', async ({
    page,
    editor,
  }) => {
    void editor;

    const collectionsPayload = [
      {
        id: 'col-qec-001',
        name: 'Quantum Error Correction',
        parentId: null,
        itemCount: 1,
      },
      {
        id: 'col-llm-002',
        name: 'Large Language Models',
        parentId: null,
        itemCount: 1,
      },
    ];

    const libraryItemsWithCollections = [
      {
        ...WORKSPACE_LIBRARY_ITEMS[0],
        collectionId: 'col-llm-002',
        collectionIds: ['col-llm-002'],
      },
      {
        ...WORKSPACE_LIBRARY_ITEMS[1],
        collectionId: 'col-qec-001',
        collectionIds: ['col-qec-001'],
      },
    ];

    await page.route(/\/library\/collections(\?.*)?$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          collections: collectionsPayload,
          data: { collections: collectionsPayload },
        }),
      });
    });

    await page.route(/\/library\/items(\?.*)?$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          items: libraryItemsWithCollections,
          total: libraryItemsWithCollections.length,
          data: {
            items: libraryItemsWithCollections,
            total: libraryItemsWithCollections.length,
          },
        }),
      });
    });

    // Mock Zotero / Mendeley integrations status and remote collections for ProjectReferencesTab
    await page.route(/\/integrations\/status|\/integrations$/, async (route) => {
      const list = [
        {
          provider: 'zotero',
          status: 'connected',
          accountLabel: 'alan.turing@zotero.org',
          connectedAt: new Date().toISOString(),
          needsReconnect: false,
        },
        {
          provider: 'mendeley',
          status: 'disconnected',
          needsReconnect: false,
        },
      ];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          integrations: list,
          data: list,
        }),
      });
    });

    await page.route(/\/integrations\/zotero\/collections/, async (route) => {
      const zoteroCols = [
        { id: 'zot-col-topological', name: 'Topological Qubits Lab', itemCount: 14 },
      ];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          collections: zoteroCols,
          data: zoteroCols,
        }),
      });
    });

    let syncedZoteroPayload: Record<string, unknown> | null = null;
    await page.route(/\/integrations\/zotero\/sync/, async (route) => {
      syncedZoteroPayload = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          syncedCount: 14,
          targetBibFile: 'references.bib',
          data: { syncedCount: 14, targetBibFile: 'references.bib' },
        }),
      });
    });

    await page.goto(`/editor/${PAGE_ID}`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.cm-editor')).toBeVisible({ timeout: 30000 });

    // 1. Open Citations Sidebar -> Open 3-Column Citation Cockpit
    await page.locator('button[aria-label="Citations & BibTeX"]').first().click();
    await page.locator('button[aria-label="Insert citation"]').first().click();

    const pickerModal = page.locator('[role="dialog"]').filter({ hasText: 'Insert Citation' }).first();
    await expect(pickerModal).toBeVisible({ timeout: 8000 });

    // 2. Verify Collections Tree in Column 1 ("Quantum Error Correction" & "Large Language Models")
    const qecTreeItem = pickerModal.getByRole('treeitem', { name: /Quantum Error Correction/i });
    const llmTreeItem = pickerModal.getByRole('treeitem', { name: /Large Language Models/i });
    await expect(qecTreeItem).toBeVisible({ timeout: 8000 });
    await expect(llmTreeItem).toBeVisible();

    // 3. Click "Quantum Error Correction" collection -> filters Column 2 to only Kitaev (2003)
    await qecTreeItem.click();
    await expect(
      pickerModal.locator('[role="option"]').filter({ hasText: 'Fault-tolerant quantum computation by anyons' })
    ).toBeVisible();
    await expect(
      pickerModal.locator('[role="option"]').filter({ hasText: 'Attention Is All You Need' })
    ).toHaveCount(0);

    // 4. Click "Large Language Models" collection -> filters Column 2 to only Vaswani (2017)
    await llmTreeItem.click();
    await expect(
      pickerModal.locator('[role="option"]').filter({ hasText: 'Attention Is All You Need' })
    ).toBeVisible();
    await expect(
      pickerModal.locator('[role="option"]').filter({ hasText: 'Fault-tolerant quantum computation by anyons' })
    ).toHaveCount(0);

    await pickerModal.locator('button[aria-label="Close"]').click();
    await expect(pickerModal).not.toBeVisible();

    // 5. Open Overleaf Menu Drawer -> Navigate to "References" (ProjectReferencesTab)
    await page.getByRole('button', { name: /Project Settings/i }).click();
    const menuDrawer = page.locator('[role="dialog"]').filter({ hasText: 'Download' }).first();
    await expect(menuDrawer).toBeVisible({ timeout: 8000 });

    const referencesNavBtn = menuDrawer.locator('button').filter({ hasText: 'References' }).first();
    await referencesNavBtn.scrollIntoViewIfNeeded();
    await referencesNavBtn.click();

    await expect(page.getByText('Reference Integrations')).toBeVisible();
    await expect(page.getByText('Target Bibliography File')).toBeVisible();
    await expect(page.getByText('Zotero Integration')).toBeVisible();
    await expect(page.getByText('Mendeley Integration')).toBeVisible();

    // 6. Select Zotero Collection and click "Sync to BibTeX"
    const zoteroSelectTrigger = page.locator('button[aria-label="Select Zotero Collection"]');
    await expect(zoteroSelectTrigger).toBeVisible();
    await zoteroSelectTrigger.click();

    const zoteroOption = page.getByRole('option', { name: /Topological Qubits Lab/i });
    await expect(zoteroOption).toBeVisible();
    await zoteroOption.click();

    const syncBibBtn = page.getByRole('button', { name: /Sync to BibTeX/i });
    await expect(syncBibBtn).toBeEnabled();
    await syncBibBtn.click();

    await expect.poll(() => syncedZoteroPayload?.collectionId).toBe('zot-col-topological');
  });

  test('Stage 5 (US-LIB-10, US-LIB-14 & US-LIB-15): Multi-Macro Citation Styles, Retraction-Aware Citation Guard & One-Click Bibliography Injector', async ({
    page,
    editor,
  }) => {
    void editor;

    const retractedPaper = {
      id: 'lib-item-dias-2020',
      citationKey: 'dias2020room',
      itemType: 'journalArticle',
      title: 'Room-temperature superconductivity in a carbonaceous sulfur hydride',
      authors: ['Ranga P. Dias', 'Ashkan Salamat'],
      year: 2020,
      journal: 'Nature',
      publicationTitle: 'Nature',
      doi: '10.1038/s41586-020-2801-z',
      isRetracted: true,
      retractionStatus: 'retracted',
      retractionReason: 'Data fabrication and anomalous background subtraction concerns.',
      noticeUrl: 'https://doi.org/10.1038/s41586-022-05294-9',
    };

    const stage5LibraryItems = [...WORKSPACE_LIBRARY_ITEMS, retractedPaper];

    await page.route(/\/library\/items(\?.*)?$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          items: stage5LibraryItems,
          total: stage5LibraryItems.length,
          data: {
            items: stage5LibraryItems,
            total: stage5LibraryItems.length,
          },
        }),
      });
    });

    await page.route(/\/library\/retraction\/items(\?.*)?$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          items: [retractedPaper],
          data: { items: [retractedPaper] },
        }),
      });
    });

    // Mock batch bibliography formatting endpoint for BibliographyInjectorCard
    await page.route(/\/citations\/format|\/batch-format/, async (route) => {
      const formattedResponse = {
        bibliographyText:
          '[1] A. Vaswani et al., "Attention Is All You Need," NeurIPS, 2017.\n[2] R. P. Dias et al., "Room-temperature superconductivity," Nature, 2020.',
        citations: [
          {
            id: 'lib-item-vaswani-2017',
            citation: {
              inText: '(Vaswani et al., 2017)',
              bibliography: 'Vaswani, A. et al. (2017). Attention Is All You Need. NeurIPS.',
            },
          },
        ],
      };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...formattedResponse,
          success: true,
          data: formattedResponse,
        }),
      });
    });

    await page.goto(`/editor/${PAGE_ID}`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.cm-editor')).toBeVisible({ timeout: 30000 });

    // 1. Open Citations Sidebar -> Open 3-Column Citation Cockpit
    await page.locator('button[aria-label="Citations & BibTeX"]').first().click();
    await page.locator('button[aria-label="Insert citation"]').first().click();

    const pickerModal = page.locator('[role="dialog"]').filter({ hasText: 'Insert Citation' }).first();
    await expect(pickerModal).toBeVisible({ timeout: 8000 });

    // 2. Multi-Macro Selector (US-LIB-15): Select Vaswani (2017) and switch macro style from \cite to \citep
    const vaswaniCard = pickerModal
      .locator('[role="option"]')
      .filter({ hasText: 'Attention Is All You Need' })
      .first();
    await expect(vaswaniCard).toBeVisible({ timeout: 8000 });
    await vaswaniCard.click();

    const macroStyleBtn = pickerModal.getByRole('button', { name: /Copy \\cite/i });
    await expect(macroStyleBtn).toBeVisible();
    await macroStyleBtn.click();

    const citepMenuItem = page.getByRole('menuitem', { name: /\\citep/i });
    await expect(citepMenuItem).toBeVisible();
    await citepMenuItem.click();

    // Insert using \citep macro style
    await pickerModal.getByRole('button', { name: /Insert Citation/i }).click();
    await expect(pickerModal).not.toBeVisible();
    await expect(page.locator('.cm-content')).toContainText('\\citep{vaswani2017attention}');

    // 3. Retraction-Aware Citation Guard (US-LIB-14): Attempt to cite retracted paper (dias2020room)
    await page.locator('button[aria-label="Insert citation"]').first().click();
    await expect(pickerModal).toBeVisible({ timeout: 8000 });

    const diasCard = pickerModal
      .locator('[role="option"]')
      .filter({ hasText: 'Room-temperature superconductivity' })
      .first();
    await expect(diasCard).toBeVisible();
    await diasCard.click();

    await pickerModal.getByRole('button', { name: /Insert Citation/i }).click();

    // Verify Retraction Warning AlertDialog blocks immediate insertion
    const retractionDialog = page
      .locator('[role="alertdialog"]')
      .filter({ hasText: 'This work has been retracted' });
    await expect(retractionDialog).toBeVisible({ timeout: 5000 });
    await expect(
      retractionDialog.getByText(/Data fabrication and anomalous background subtraction concerns/i)
    ).toBeVisible();
    await expect(retractionDialog.getByRole('link', { name: /View retraction notice/i })).toBeVisible();

    // Click "Cancel" first -> verify retracted citation is NOT inserted
    await retractionDialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(retractionDialog).not.toBeVisible();
    await expect(page.locator('.cm-content')).not.toContainText('dias2020room');

    // Click "Insert Citation" again and override with "Cite anyway"
    await pickerModal.getByRole('button', { name: /Insert Citation/i }).click();
    await expect(retractionDialog).toBeVisible();
    await retractionDialog.getByRole('button', { name: 'Cite anyway' }).click();
    await expect(pickerModal).not.toBeVisible();
    await expect(page.locator('.cm-content')).toContainText('dias2020room');

    // 4. One-Click Bibliography Injector (US-LIB-10) in Citations Sidebar ("In Document" tab)
    await expect(page.getByText(/Danh mục tài liệu/i)).toBeVisible({ timeout: 8000 });
    const injectBibBtn = page.getByRole('button', { name: /Chèn vào đề cương/i });
    await expect(injectBibBtn).toBeVisible();
    await injectBibBtn.click();

    await expect(page.locator('.cm-content')).toContainText('\\begin{thebibliography}');
  });
});

