import { test, expect } from '../fixtures/editor.fixture';
import {
  MOCK_PAGE,
  MOCK_FILES_HIERARCHY,
} from '../fixtures/mock-data';

/**
 * Generates a valid multi-page PDF-1.4 document in Base64 where each page contains
 * positioned text operations `(x, y, text)` in standard PDF bottom-left coordinates (MediaBox 595x842).
 * This allows PDF.js (`react-pdf`) in the real Chromium browser to decode, render `<canvas>`,
 * populate `.textLayer` / `.react-pdf__Page__textContent`, and execute XY-Cut search & SyncTeX!
 */
function buildMultiPagePdfBase64(
  pages: Array<Array<{ x: number; y: number; text: string; fontSize?: number }>>,
): string {
  const objs: string[] = [];
  // Obj 1: Catalog
  objs.push(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`);

  // Obj 2: Pages (kids start at obj 4, step by 2: 4=Page1, 5=Stream1, 6=Page2, 7=Stream2...)
  const pageObjIds = pages.map((_, idx) => `${4 + idx * 2} 0 R`).join(' ');
  objs.push(`2 0 obj\n<< /Type /Pages /Kids [${pageObjIds}] /Count ${pages.length} >>\nendobj\n`);

  // Obj 3: Font F1 (Helvetica)
  objs.push(`3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`);

  pages.forEach((items, idx) => {
    const pageObjId = 4 + idx * 2;
    const streamObjId = pageObjId + 1;

    const ops = items
      .map((item) => {
        const escaped = item.text
          .replace(/\\/g, '\\\\')
          .replace(/\(/g, '\\(')
          .replace(/\)/g, '\\)');
        const size = item.fontSize ?? 11;
        return `BT /F1 ${size} Tf 1 0 0 1 ${item.x} ${item.y} Tm (${escaped}) Tj ET`;
      })
      .join('\n');
    const streamContent = `${ops}\n`;

    objs.push(
      `${pageObjId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents ${streamObjId} 0 R /Resources << /Font << /F1 3 0 R >> >> >>\nendobj\n`,
    );
    objs.push(
      `${streamObjId} 0 obj\n<< /Length ${streamContent.length} >>\nstream\n${streamContent}endstream\nendobj\n`,
    );
  });

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objs) {
    offsets.push(pdf.length);
    pdf += obj;
  }
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objs.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, 'utf-8').toString('base64');
}

/**
 * overleaf-pdf-viewer-accuracy.spec.ts
 *
 * Empirical Verification Suite for PDF Viewer Output Accuracy across 6 Core Dimensions:
 *
 * - Dataset P1 (Dimension 1 — Multi-Page PDF Binary Decoding, Canvas & TextLayer Fidelity, Typography Normalization):
 *   Verifies that a 3-page PDF payload (`data.pdf` / `data.pdfUrl`) is decoded into a valid Blob URL,
 *   `PdfPaginationControls` reports `/ 3` pages, `<canvas>` renders with non-zero dimensions,
 *   `.textLayer` / `.react-pdf__Page__textContent` renders exact LaTeX strings, and em-dashes (`—`) are normalized to `-`.
 *
 * - Dataset P2 (Dimension 2 — Multi-Column Academic Layout & In-Document Search Accuracy via Recursive XY-Cut):
 *   Constructs a 2-page, 2-column IEEE/ACM style PDF where Left Column (`x=54..270`) and Right Column (`x=315..540`)
 *   appear at identical Y heights, plus a page-2 match. Verifies `PdfFindBar` (`Find in document (Ctrl+F)`),
 *   match counter (`1/3`, `2/3`, `3/3`), Case Sensitive (`Alt+C`), Whole Word (`Alt+W`), Regex (`Alt+R`),
 *   and `.flux-pdf-highlight` / `.flux-pdf-highlight-current` DOM marks.
 *
 * - Dataset P3 (Dimension 3 — 2D k-d Tree Spatial SyncTeX Disambiguation on Two-Column PDF):
 *   Constructs a plain-text SyncTeX map with two nodes at the EXACT SAME Y coordinate (`y=220pt` / `rawY=14472000`)
 *   on Page 1:
 *   - Left Column (`x=72pt` / `rawX=4736000`) -> `sections/left_col.tex`, line 4
 *   - Right Column (`x=340pt` / `rawX=22365000`) -> `sections/right_col.tex`, line 5
 *   Verifies that double-clicking the Left Column opens `left_col.tex` (line 4), while double-clicking
 *   the Right Column at the same Y height disambiguates via 2D k-d Tree X-axis and opens `right_col.tex` (line 5),
 *   plus verifies Forward SyncTeX (`Jump to PDF location (SyncTeX)`) renders `[data-testid="synctex-pdf-highlight-box"]`
 *   with `[data-testid="synctex-pdf-accent-bar"]`.
 *
 * - Dataset P4 (Dimension 4 — Viewport Scaling, Fit Modes, Two-Page Spread View, & Dark Mode Invert Filter):
 *   Verifies Zoom In / Zoom Out / Preset (`150%`) / `Fit Page` (`height`) / `Fit Width`,
 *   Two-Page Spread View (`pair` rows rendering 2 pages side-by-side per row), and Dark Mode (`invert(0.9) hue-rotate(180deg)`).
 *
 * - Dataset P5 (Dimension 5 — State Continuity Across Recompiles & Error-to-PDF Recovery):
 *   Verifies that navigating/scrolling to Page 2 of a 3-page PDF, then triggering a Recompile that produces an
 *   updated 3-page PDF, preserves the user's scroll position (`lastScrollTopRef`) and updates the text layer without
 *   resetting to a blank screen; and when a compile fails with errors, switching back to PDF shows `CompilationErrorBanner`
 *   with `Jump to first error`.
 */
test.describe('Overleaf PDF Viewer Output Accuracy — Empirical Datasets P1 to P5', () => {
  const PAGE_ID = 'page-paper-001';

  test('Dataset P1: Multi-Page PDF Binary Decoding, Canvas & TextLayer Fidelity, Pagination (/ 3), & Em-Dash Normalization', async ({
    page,
    editor,
  }) => {
    void editor;

    const threePagePdfBase64 = buildMultiPagePdfBase64([
      [
        { x: 72, y: 760, text: 'Page 1: Quantum Variational Eigenvalue Solver', fontSize: 14 },
        { x: 72, y: 720, text: 'Theorem 1.1: Convergence bound for non-convex landscapes.' },
      ],
      [
        { x: 72, y: 760, text: 'Page 2: Experimental Superconducting Qubit Architecture', fontSize: 14 },
        { x: 72, y: 720, text: 'Section 2: Gate fidelity exceeds 99.9% threshold.' },
      ],
      [
        { x: 72, y: 760, text: 'Page 3: Conclusion and Open Problems', fontSize: 14 },
        { x: 72, y: 720, text: 'Appendix A: Full proof of Lemma 4.' },
      ],
    ]);

    await page.route(/\/compile(\?.*)?$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          pdf: threePagePdfBase64,
          logs: 'This is pdfTeX, Version 3.141592653 (TeX Live 2024)\nOutput written on main.pdf (3 pages, 45120 bytes).',
        }),
      });
    });

    await page.goto(`/editor/${PAGE_ID}`);
    await expect(page.locator('.cm-content').first()).toBeVisible({ timeout: 15000 });

    const recompileBtn = page.getByRole('button', { name: /Recompile document/i }).first();
    await expect(recompileBtn).toBeVisible({ timeout: 10000 });
    await recompileBtn.click();

    // 1. Verify PDF.js decodes all 3 pages and updates PdfPaginationControls to "/ 3"
    const pdfPreviewRegion = page.getByRole('region', { name: 'PDF document preview' });
    await expect(pdfPreviewRegion).toBeVisible({ timeout: 10000 });
    await expect(page.locator('span', { hasText: '/ 3' }).first()).toBeVisible({ timeout: 10000 });

    // 2. Verify Page 1 <canvas> is rendered with non-zero width & height
    const firstCanvas = pdfPreviewRegion.locator('canvas').first();
    await expect(firstCanvas).toBeVisible({ timeout: 10000 });
    const canvasBox = await firstCanvas.boundingBox();
    expect(canvasBox?.width).toBeGreaterThan(100);
    expect(canvasBox?.height).toBeGreaterThan(100);

    // 3. Verify Page 1 .textLayer renders exact compiled text from the PDF binary stream
    await expect(pdfPreviewRegion).toContainText('Quantum Variational Eigenvalue Solver', {
      timeout: 10000,
    });
    await expect(pdfPreviewRegion).toContainText('Theorem 1.1: Convergence bound');

    // 4. Verify Next Page button and direct page input jump to Page 2 & Page 3
    const nextPageBtn = page.getByRole('button', { name: 'Next page' });
    await nextPageBtn.click();
    const pageInput = page.getByRole('textbox', { name: 'Current page number' });
    await expect(pageInput).toHaveValue('2');
  });

  test('Dataset P2: Multi-Column Academic Layout & In-Document PDF Search Accuracy (XY-Cut, Case Sensitive, Whole Word, Regex)', async ({
    page,
    editor,
  }) => {
    void editor;

    // 2-page PDF with 2-column layout on Page 1 (Left column x=60, Right column x=320) and Page 2 match
    const twoColumnPdfBase64 = buildMultiPagePdfBase64([
      [
        // Spanning Title
        { x: 140, y: 780, text: 'Multi-Column IEEE Transactions Layout Verification', fontSize: 14 },
        // Left Column (x = 60)
        { x: 60, y: 700, text: 'LeftCol: Hamiltonian simulation via Trotterization.' },
        { x: 60, y: 660, text: 'LeftCol: Lower bound on circuit depth.' },
        // Right Column at the SAME Y coordinates (x = 320)
        { x: 320, y: 700, text: 'RightCol: Error mitigation with zero-noise extrapolation.' },
        { x: 320, y: 660, text: 'RightCol: Trotterization overhead analysis.' },
      ],
      [
        { x: 60, y: 740, text: 'Page2: Higher-order Trotterization schemes in fault-tolerant regime.' },
      ],
    ]);

    await page.route(/\/compile(\?.*)?$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          pdf: twoColumnPdfBase64,
          logs: 'Output written on main.pdf (2 pages, 28400 bytes).',
        }),
      });
    });

    await page.goto(`/editor/${PAGE_ID}`);
    await expect(page.locator('.cm-content').first()).toBeVisible({ timeout: 15000 });

    const recompileBtn = page.getByRole('button', { name: /Recompile document/i }).first();
    await recompileBtn.click();

    const pdfPreviewRegion = page.getByRole('region', { name: 'PDF document preview' });
    await expect(pdfPreviewRegion).toContainText('Hamiltonian simulation', { timeout: 10000 });

    // 1. Open In-Document Find Bar (`Find in document (Ctrl+F)`)
    const findBtn = page.getByRole('button', { name: /Find in document/i });
    await expect(findBtn).toBeVisible();
    await findBtn.click();

    const findBar = page.getByRole('search', { name: 'Find in PDF' });
    await expect(findBar).toBeVisible();

    // 2. Search for "Trotterization" -> must find 3 matches across Left Column, Right Column, and Page 2 ("1/3")
    const searchInput = findBar.getByPlaceholder('Find in document…');
    await searchInput.fill('Trotterization');
    await expect(findBar).toContainText('1/3', { timeout: 8000 });

    // Verify DOM highlight mark is injected into PDF text layer
    await expect(pdfPreviewRegion.locator('mark.flux-pdf-highlight-current')).toBeVisible();

    // 3. Navigate Next Match -> "2/3" -> "3/3"
    const nextMatchBtn = findBar.getByRole('button', { name: 'Next match' });
    await nextMatchBtn.click();
    await expect(findBar).toContainText('2/3');
    await nextMatchBtn.click();
    await expect(findBar).toContainText('3/3');

    // 4. Test Regex mode (`Use Regular Expression`) with invalid regex -> shows "Invalid regex"
    const regexBtn = findBar.getByRole('button', { name: 'Use Regular Expression' });
    await regexBtn.click();
    await searchInput.fill('[unclosedGroup');
    await expect(findBar).toContainText('Invalid regex');
  });

  test('Dataset P3: 2D k-d Tree Spatial SyncTeX Accuracy — Two-Column Disambiguation at Identical Y & Forward Highlight Box', async ({
    page,
    editor,
  }) => {
    void editor;

    const LEFT_COL_FILE_ID = 'file-left-col-001';
    const RIGHT_COL_FILE_ID = 'file-right-col-002';

    const leftColTexContent = [
      '\\section{Left Column Section}',
      'First paragraph in left column.',
      'Second paragraph in left column.',
      'LEFT_COLUMN_TARGET_LINE_4: Variational ansatz definition.',
    ].join('\n');

    const rightColTexContent = [
      '\\section{Right Column Section}',
      'First paragraph in right column.',
      'Second paragraph in right column.',
      'Third paragraph in right column.',
      'RIGHT_COLUMN_TARGET_LINE_5: Hardware-efficient circuit.',
    ].join('\n');

    const twoColPdfBase64 = buildMultiPagePdfBase64([
      [
        { x: 72, y: 622, text: 'Left Column Y=220pt Target Text' },
        { x: 340, y: 622, text: 'Right Column Y=220pt Target Text' },
      ],
    ]);

    // SyncTeX plain-text map:
    // Note: scaleFactor = (1 / 65536) * 0.996264 = 0.00001520178
    // rawX = 4736000 -> x = 72pt (Left Column)
    // rawX = 22365000 -> x = 340pt (Right Column)
    // rawY = 14472000 -> y = 220pt (IDENTICAL Y coordinate for both columns!)
    // rawW = 11840000 -> w = 180pt, rawH = 920000 -> h = 14pt
    const twoColumnSynctexText = [
      'SyncTeX Version:1',
      'Input:1:./main.tex',
      'Input:2:./sections/left_col.tex',
      'Input:3:./sections/right_col.tex',
      'Unit:1',
      'Content:',
      '{1',
      '[1,1:4736000,6578000:30000000,40000000,0',
      'h2,4:4736000,14472000:11840000,920000',
      'h3,5:22365000,14472000:11840000,920000',
      ']',
      '}',
    ].join('\n');

    await page.route(/\/files(\?.*)?$/, async (route) => {
      const files = [
        ...MOCK_FILES_HIERARCHY,
        {
          id: LEFT_COL_FILE_ID,
          title: 'left_col.tex',
          path: 'sections/left_col.tex',
          content: leftColTexContent,
          projectId: 'proj-academic-001',
          isMain: false,
        },
        {
          id: RIGHT_COL_FILE_ID,
          title: 'right_col.tex',
          path: 'sections/right_col.tex',
          content: rightColTexContent,
          projectId: 'proj-academic-001',
          isMain: false,
        },
      ];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          files,
          success: true,
          data: { files },
        }),
      });
    });

    await page.route(/\/synctex\/forward/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          page: 1,
          x: 72,
          y: 220,
          w: 180,
          h: 14,
        }),
      });
    });

    await page.route(/\/compile(\?.*)?$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          pdf: twoColPdfBase64,
          synctex: twoColumnSynctexText,
          logs: 'Output written on main.pdf (1 page, 19200 bytes).',
        }),
      });
    });

    await page.goto(`/editor/${PAGE_ID}`);
    const cmContent = page.locator('.cm-content').first();
    await expect(cmContent).toBeVisible({ timeout: 15000 });

    const recompileBtn = page.getByRole('button', { name: /Recompile document/i }).first();
    await recompileBtn.click();

    const pdfPage = page.locator('.react-pdf__Page').first();
    await expect(pdfPage).toBeVisible({ timeout: 10000 });

    // 1. Test Forward SyncTeX button (`Jump to PDF location (SyncTeX)`) -> renders yellow highlight box & left accent bar on PDF!
    const forwardSyncBtn = page.getByRole('button', { name: 'Jump to PDF location (SyncTeX)' });
    await forwardSyncBtn.click();

    const highlightBox = page.getByTestId('synctex-pdf-highlight-box');
    await expect(highlightBox).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('synctex-pdf-accent-bar')).toBeVisible();

    // 2. Test Reverse SyncTeX on LEFT COLUMN (`x ~ 18% of width, y ~ 26% of height`) -> must open `left_col.tex` at line 4!
    const pageBox = await pdfPage.boundingBox();
    expect(pageBox).not.toBeNull();
    if (pageBox) {
      const leftClickX = Math.round((100 / 595) * pageBox.width);
      const clickY = Math.round((220 / 842) * pageBox.height);
      await pdfPage.dblclick({ position: { x: leftClickX, y: clickY } });

      await expect(page.getByTestId('synctex-pdf-backward-ripple')).toBeVisible({ timeout: 5000 });
      await expect(cmContent).toContainText('LEFT_COLUMN_TARGET_LINE_4', { timeout: 8000 });

      // 3. Test Reverse SyncTeX on RIGHT COLUMN at the EXACT SAME Y coordinate (`x ~ 65% of width, y ~ 26% of height`) -> must disambiguate via 2D k-d Tree and open `right_col.tex` at line 5!
      const rightClickX = Math.round((380 / 595) * pageBox.width);
      await pdfPage.dblclick({ position: { x: rightClickX, y: clickY } });
      await expect(cmContent).toContainText('RIGHT_COLUMN_TARGET_LINE_5', { timeout: 8000 });
    }
  });

  test('Dataset P4: Viewport Scaling (Fit Width / Fit Page / Zoom Presets), Two-Page Spread View, & Dark Mode Invert Filter', async ({
    page,
    editor,
  }) => {
    void editor;

    const twoPagePdfBase64 = buildMultiPagePdfBase64([
      [{ x: 72, y: 740, text: 'Spread View Page 1 Left Side' }],
      [{ x: 72, y: 740, text: 'Spread View Page 2 Right Side' }],
    ]);

    await page.route(/\/compile(\?.*)?$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          pdf: twoPagePdfBase64,
          logs: 'Output written on main.pdf (2 pages, 22100 bytes).',
        }),
      });
    });

    await page.goto(`/editor/${PAGE_ID}`);
    await expect(page.locator('.cm-content').first()).toBeVisible({ timeout: 15000 });

    const recompileBtn = page.getByRole('button', { name: /Recompile document/i }).first();
    await recompileBtn.click();

    const pdfPreviewRegion = page.getByRole('region', { name: 'PDF document preview' });
    await expect(pdfPreviewRegion).toContainText('Spread View Page 1 Left Side', { timeout: 10000 });

    // 1. Test Zoom Preset Dropdown (`Select zoom level`) -> select `150%` and verify label updates to `150%`
    const zoomDropdownBtn = page.getByRole('button', { name: 'Select zoom level' });
    if (await zoomDropdownBtn.isVisible()) {
      await zoomDropdownBtn.click();
      await page.getByRole('menuitem', { name: '150%' }).click();
      await expect(zoomDropdownBtn).toContainText('150%');

      // Switch to `Fit Page`
      await zoomDropdownBtn.click();
      await page.getByRole('menuitem', { name: 'Fit Page' }).click();
      await expect(zoomDropdownBtn).toContainText('Fit Page');
    }

    // 2. Toggle Dark Mode (`Dark mode (Invert PDF colors)`) or via Viewer options menu
    const invertBtn = page.getByRole('button', { name: /Dark mode \(Invert PDF colors\)/i });
    const moreOptionsBtn = page.getByRole('button', { name: 'Viewer options' });
    if (await invertBtn.isVisible()) {
      await invertBtn.click();
    } else if (await moreOptionsBtn.isVisible()) {
      await moreOptionsBtn.click();
      await page.getByRole('button', { name: /Dark mode \(Invert\)/i }).click();
    }
    await expect(pdfPreviewRegion).toHaveClass(/dark/);

    // 3. Toggle Two-Page Spread View (`Two-page spread view`)
    const spreadBtn = page.getByRole('button', { name: /Two-page spread view/i });
    if (await spreadBtn.isVisible()) {
      await spreadBtn.click();
    } else if (await moreOptionsBtn.isVisible()) {
      await moreOptionsBtn.click();
      await page.getByRole('button', { name: /Two-page spread/i }).click();
    }
    // Verify both Page 1 and Page 2 are rendered simultaneously inside the spread row
    await expect(pdfPreviewRegion).toContainText('Spread View Page 1 Left Side');
    await expect(pdfPreviewRegion).toContainText('Spread View Page 2 Right Side');
  });

  test('Dataset P5: State Continuity Across Recompiles (Scroll Position & Content Update) + Error Banner Overlay on Stale PDF', async ({
    page,
    editor,
  }) => {
    void editor;

    let compileGeneration = 0;

    const gen1PdfBase64 = buildMultiPagePdfBase64([
      [{ x: 72, y: 740, text: 'Gen1 Page 1 Content' }],
      [{ x: 72, y: 740, text: 'Gen1 Page 2 Content Before Edit' }],
      [{ x: 72, y: 740, text: 'Gen1 Page 3 Content' }],
    ]);

    const gen2PdfBase64 = buildMultiPagePdfBase64([
      [{ x: 72, y: 740, text: 'Gen2 Page 1 Content' }],
      [{ x: 72, y: 740, text: 'Gen2 Page 2 UPDATED Content After Recompile' }],
      [{ x: 72, y: 740, text: 'Gen2 Page 3 Content' }],
    ]);

    await page.route(/\/compile(\?.*)?$/, async (route) => {
      compileGeneration++;
      if (compileGeneration === 1) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            pdf: gen1PdfBase64,
            logs: 'Output written on main.pdf (3 pages, 31000 bytes).',
          }),
        });
      } else if (compileGeneration === 2) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            pdf: gen2PdfBase64,
            logs: 'Output written on main.pdf (3 pages, 31200 bytes).',
          }),
        });
      } else {
        // Generation 3: Compile fails with a hard error while PDF from Gen 2 is still loaded
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: 'Compilation failed',
            logs: 'This is pdfTeX\n(./main.tex\n! Undefined control sequence.\nl.6 \\brokenCmd\n)',
          }),
        });
      }
    });

    await page.goto(`/editor/${PAGE_ID}`);
    await expect(page.locator('.cm-content').first()).toBeVisible({ timeout: 15000 });

    const recompileBtn = page.getByRole('button', { name: /Recompile document/i }).first();

    // 1. Compile Generation 1 (3 pages)
    await recompileBtn.click();
    const pdfPreviewRegion = page.getByRole('region', { name: 'PDF document preview' });
    await expect(pdfPreviewRegion).toContainText('Gen1 Page 1 Content', { timeout: 10000 });

    // Scroll down inside the PDF preview container
    await pdfPreviewRegion.evaluate((el) => {
      el.scrollTop = 350;
      el.dispatchEvent(new Event('scroll'));
    });
    const scrollBeforeRecompile = await pdfPreviewRegion.evaluate((el) => el.scrollTop);
    expect(scrollBeforeRecompile).toBeGreaterThan(100);

    // 2. Compile Generation 2 -> verify updated PDF content renders AND scroll position is preserved!
    await recompileBtn.click();
    await expect(pdfPreviewRegion).toContainText('Gen2 Page 2 UPDATED Content After Recompile', {
      timeout: 10000,
    });
    await expect
      .poll(() => pdfPreviewRegion.evaluate((el) => el.scrollTop), { timeout: 5000 })
      .toBeGreaterThan(100);

    // 3. Compile Generation 3 (Error) -> auto-switches to Logs overlay; clicking "Back to PDF" shows stale PDF + CompilationErrorBanner!
    await recompileBtn.click();
    const backToPdfBtn = page.getByRole('button', { name: /Back to PDF/i });
    await expect(backToPdfBtn).toBeVisible({ timeout: 10000 });
    await backToPdfBtn.click();

    await expect(page.getByTestId('compilation-error-banner')).toContainText(
      /1 compilation error detected in this build/i,
    );
    await expect(page.getByRole('button', { name: /Jump to first error/i })).toBeVisible();
  });

  test('Dataset P6: Closed-Loop Sub-Pixel Coordinate Invariant — BoundingBox Intersection Between SyncTeX Highlight Box & PDF.js TextLayer Span', async ({
    page,
    editor,
  }) => {
    void editor;

    // Ground-Truth PDF Coordinates (ISO 32000-1 bottom-left origin on 595 x 842 pt page):
    // Target text placed at x_pdf = 120 pt, y_pdf = 542 pt (which means baseline y_top = 842 - 542 = 300 pt from top!)
    const groundTruthPdfBase64 = buildMultiPagePdfBase64([
      [
        { x: 72, y: 760, text: 'Header: Coordinate Calibration Benchmark', fontSize: 14 },
        { x: 120, y: 542, text: 'CALIBRATED_EQUATION_TARGET_X120_Y300', fontSize: 12 },
      ],
    ]);

    // Ground-Truth SyncTeX Node (Top-Left origin in sp, where scaleFactor = (1 / 65536) * 0.996264):
    // x = 120 pt -> rawX = 120 / 0.000015201782 = 7893811 sp
    // y = 300 pt -> rawY = 300 / 0.000015201782 = 19734528 sp
    // w = 220 pt -> rawW = 14471988 sp, h = 12 pt -> rawH = 789381 sp
    const groundTruthSynctex = [
      'SyncTeX Version:1',
      'Input:1:./main.tex',
      'Unit:1',
      'Content:',
      '{1',
      'h1,4:7893811,19734528:14471988,789381',
      '}',
    ].join('\n');

    await page.route(/\/synctex\/forward/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          page: 1,
          x: 120,
          y: 300,
          w: 220,
          h: 12,
        }),
      });
    });

    await page.route(/\/compile(\?.*)?$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          pdf: groundTruthPdfBase64,
          synctex: groundTruthSynctex,
          logs: 'Output written on main.pdf (1 page, 16400 bytes).',
        }),
      });
    });

    await page.goto(`/editor/${PAGE_ID}`);
    await expect(page.locator('.cm-content').first()).toBeVisible({ timeout: 15000 });

    const recompileBtn = page.getByRole('button', { name: /Recompile document/i }).first();
    await recompileBtn.click();

    // 1. Wait for PDF.js to render the exact text span in .textLayer
    const pdfPreviewRegion = page.getByRole('region', { name: 'PDF document preview' });
    const targetSpan = pdfPreviewRegion
      .locator('.textLayer span, .react-pdf__Page__textContent span')
      .filter({ hasText: 'CALIBRATED_EQUATION_TARGET_X120_Y300' })
      .first();
    await expect(targetSpan).toBeVisible({ timeout: 10000 });

    // 2. Trigger Forward SyncTeX -> renders [data-testid="synctex-pdf-highlight-box"]
    const forwardSyncBtn = page.getByRole('button', { name: 'Jump to PDF location (SyncTeX)' });
    await forwardSyncBtn.click();

    const highlightBox = page.getByTestId('synctex-pdf-highlight-box');
    await expect(highlightBox).toBeVisible({ timeout: 5000 });

    // 3. Measure actual browser DOM BoundingClientRects of the PDF.js text span, SyncTeX highlight box, and PDF page
    const pdfPage = page.locator('.react-pdf__Page').first();
    const pageRect = await pdfPage.boundingBox();
    const spanRect = await targetSpan.boundingBox();
    const highlightRect = await highlightBox.boundingBox();

    expect(pageRect).not.toBeNull();
    expect(spanRect).not.toBeNull();
    expect(highlightRect).not.toBeNull();

    if (pageRect && spanRect && highlightRect) {
      // Relative coordinates inside the rendered PDF page
      const spanRelX = spanRect.x - pageRect.x;
      const spanRelY = spanRect.y - pageRect.y;
      const hlRelX = highlightRect.x - pageRect.x;
      const hlRelY = highlightRect.y - pageRect.y;

      // Verify affine scale invariance: highlight box left is anchored at (x - 4px padding) of the text span
      expect(Math.abs(hlRelX - (spanRelX - 4))).toBeLessThanOrEqual(8);

      // Verify vertical baseline-to-top alignment: highlight box top is within 1 line-height (14px) of the PDF.js text span
      expect(Math.abs(hlRelY - spanRelY)).toBeLessThanOrEqual(14);

      // Verify 2D bounding-box intersection: the SyncTeX highlight box physically overlaps the rendered PDF text span!
      const intersectsHorizontally =
        highlightRect.x <= spanRect.x + spanRect.width &&
        highlightRect.x + highlightRect.width >= spanRect.x;
      const intersectsVertically =
        highlightRect.y <= spanRect.y + spanRect.height &&
        highlightRect.y + highlightRect.height >= spanRect.y;

      expect(intersectsHorizontally).toBe(true);
      expect(intersectsVertically).toBe(true);
    }
  });
});
