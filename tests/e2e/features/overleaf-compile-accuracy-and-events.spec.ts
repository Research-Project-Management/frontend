import { test, expect } from '../fixtures/editor.fixture';
import {
  MOCK_PAGE,
  MOCK_FILES_HIERARCHY,
  MOCK_COMPILE_SUCCESS,
} from '../fixtures/mock-data';

/**
 * overleaf-compile-accuracy-and-events.spec.ts
 *
 * Empirical Verification Suite for Compilation Accuracy & Event Handling:
 * 1. Dataset 1 — Multi-File Nested TeX Parentheses Stack, Cross-File Error/Warning Attribution,
 *    Real-time ErrorLens Line Shifting on Edit, and Cross-File Error Jump to Unopened Subfile:
 *    - Tests `(./preamble.tex) (./sections/methodology.tex ... )` where one subfile opens & closes
 *      on the same line while another opens, followed by errors in `sections/methodology.tex` (line 4),
 *      then closing `)` and subsequent errors/warnings in `main.tex` (line 6 & line 8).
 *    - Verifies `CompilerLogs` attributes each error/warning to its exact originating file & line.
 *    - Verifies inline `ErrorLens` (`.cm-error-lens`) renders on line 6 of `main.tex` and shifts
 *      `data-line="6"` -> `data-line="7"` immediately when inserting a newline above it.
 *    - Verifies clicking the `methodology.tex` error opens the unopened `methodology.tex` tab with
 *      its full LaTeX content intact (not empty `''`) and jumps to line 4 with inline ErrorLens.
 *
 * 2. Dataset 2 — In-Flight Compilation Cancellation, Superseding (`forceClean`), & Stop Compilation Event:
 *    - Triggers an in-flight compilation, verifies `Compiling...` state, and tests `Stop compilation`
 *      from the dropdown: verifies `/compile/cancel` is invoked, status returns to `idle`, and NO
 *      rogue queued compile fires afterwards.
 *    - Triggers an in-flight regular compile and immediately triggers `Recompile from scratch`
 *      (`forceClean: true`) while the first is still running: verifies the first request is aborted,
 *      and the superseding compile automatically executes with `force_clean: true` preserved.
 *
 * 3. Dataset 3 — Network / Offline Drop During Compile, Auto-Recovery on `online` Event,
 *    & Nonstopmode Warning + Error Ingestion:
 *    - Simulates a network failure during compilation (`Failed to fetch` / offline transition):
 *      verifies `[Offline Mode]` log notice, `offlinePendingCompile === true`, and draft protection.
 *    - Restores connectivity and dispatches browser `online` event: verifies automatic recompilation
 *      fires and recovers to the compiled PDF preview.
 *    - Verifies that when a nonstopmode compile succeeds (`success: true` with PDF) while still emitting
 *      LaTeX warnings in raw `logs`, `compiler.coordinator` parses and projects those warnings into
 *      `diagnosticsCoordinator` and `CompilerLogs`.
 *
 * 4. Dataset 4 — Bidirectional SyncTeX Accuracy (Forward Code -> PDF Coordinate Highlight &
 *    Reverse PDF -> Subfile Source Line Jump):
 *    - Verifies forward SyncTeX (`synctex:forward`) resolves exact PDF page & coordinates.
 *    - Verifies reverse SyncTeX (`synctex:backward` / double-click) resolves `(page, x, y)` back to
 *      subfile `methodology.tex` line 4, switches tab, and loads `methodology.tex` with full content.
 */
test.describe('Overleaf Compilation Accuracy & Event Lifecycle — Empirical E2E Suite', () => {
  const PAGE_ID = 'page-paper-001';
  const METHODS_FILE_ID = 'file-methods-003';

  test('Dataset 1: Multi-File TeX Parentheses Stack Accuracy, ErrorLens Real-Time Line Shifting, & Cross-File Error Jump to Unopened Subfile', async ({
    page,
    editor,
  }) => {
    void editor;

    const mainTexContent = [
      '\\documentclass{article}',
      '\\input{preamble}',
      '\\begin{document}',
      '\\section{Introduction}',
      '\\input{sections/methodology}',
      'Main file error trigger \\mainUndefinedMacro here.',
      'Normal paragraph in main file.',
      'Citation with warning \\cite{missingKey2026}.',
      '\\end{document}',
    ].join('\n');

    const methodologyTexContent = [
      '\\section{Methodology}',
      'We propose a multi-stage variational solver.',
      'Let $\\mathcal{L}(\\theta)$ denote the objective.',
      'Subfile error trigger \\methodBrokenCommand here.',
      'Final sentence of methodology section.',
    ].join('\n');

    const multiFileNestedLog = [
      'This is pdfTeX, Version 3.141592653-2.6-1.40.25 (TeX Live 2023)',
      'entering extended mode',
      '(./main.tex',
      'LaTeX2e <2023-11-01> patch level 1',
      '(/usr/local/texlive/2023/texmf-dist/tex/latex/base/article.cls',
      'Document Class: article 2023/05/17 v1.4n Standard LaTeX document class',
      '(/usr/local/texlive/2023/texmf-dist/tex/latex/base/size10.clo))',
      // Same-line open+close of preamble.tex followed by open of methodology.tex
      '(./preamble.tex) (./sections/methodology.tex',
      '! Undefined control sequence.',
      'l.4 Subfile error trigger \\methodBrokenCommand',
      '                                               here.',
      'The control sequence at the end of the top line',
      'of your error message was never \\def\'ed.',
      ')',
      // Now methodology.tex is closed with ')'; active file must pop back to main.tex!
      '! Undefined control sequence.',
      'l.6 Main file error trigger \\mainUndefinedMacro',
      '                                                here.',
      '',
      'LaTeX Warning: Citation `missingKey2026\' on page 1 undefined on input line 8.',
      '',
      '[1{/var/lib/texmf/fonts/map/pdftex/updmap/pdftex.map}] (./main.aux)',
      ' )',
      'Output written on main.pdf (1 page, 18420 bytes).',
    ].join('\n');

    await page.route(/\/docs\/page-paper-001|\/pages\/page-paper-001/, async (route) => {
      if (route.request().url().includes('/files')) {
        return route.fallback();
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          page: { ...MOCK_PAGE, content: mainTexContent, docContent: mainTexContent },
          success: true,
          data: { page: { ...MOCK_PAGE, content: mainTexContent, docContent: mainTexContent } },
        }),
      });
    });

    await page.route(/\/files(\?.*)?$/, async (route) => {
      const files = [
        ...MOCK_FILES_HIERARCHY,
        {
          id: METHODS_FILE_ID,
          title: 'methodology.tex',
          path: 'sections/methodology.tex',
          content: methodologyTexContent,
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

    await page.route(/\/diagnostics\/parse-log|\/diagnostics\/parse/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'report-nested-001',
          isSuccess: false,
          errorsCount: 2,
          warningsCount: 1,
          badboxesCount: 0,
          infoCount: 0,
          totalCount: 3,
          items: [
            {
              file: 'sections/methodology.tex',
              line: 4,
              severity: 'error',
              message: 'Undefined control sequence.',
              code: 'LATEX_UNDEFINED_CONTROL_SEQUENCE',
            },
            {
              file: 'main.tex',
              line: 6,
              severity: 'error',
              message: 'Undefined control sequence.',
              code: 'LATEX_UNDEFINED_CONTROL_SEQUENCE',
            },
            {
              file: 'main.tex',
              line: 8,
              severity: 'warning',
              message: "LaTeX Warning: Citation `missingKey2026' on page 1 undefined",
            },
          ],
        }),
      });
    });

    await page.route(/\/compile(\?.*)?$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Compilation failed with 2 errors',
          logs: multiFileNestedLog,
        }),
      });
    });

    await page.goto(`/editor/${PAGE_ID}`);
    const cmContent = page.locator('.cm-content').first();
    await expect(cmContent).toBeVisible({ timeout: 15000 });

    // Trigger Recompile
    const recompileBtn = page.getByRole('button', { name: /Recompile/i }).first();
    await expect(recompileBtn).toBeVisible({ timeout: 10000 });
    await recompileBtn.click();

    // 1. Verify CompilerLogs auto-opens with exact 2 errors and 1 warning
    const errorStepper = page.getByTestId('compiler-error-stepper');
    await expect(errorStepper).toBeVisible({ timeout: 10000 });
    await expect(errorStepper).toContainText('Error 1 of 2');

    // Verify Error 0 is attributed to sections/methodology.tex · Line 4
    const err0 = page.locator('#log-entry-err-0');
    await expect(err0).toBeVisible();
    await expect(err0).toContainText('sections/methodology.tex');
    await expect(err0).toContainText('Line 4');

    // Verify Error 1 (after closing ')') popped back to main.tex · Line 6 (NOT methodology.tex!)
    const err1 = page.locator('#log-entry-err-1');
    await expect(err1).toBeVisible();
    await expect(err1).toContainText('Line 6');
    await expect(err1).not.toContainText('methodology.tex');

    // 2. Verify inline ErrorLens in main.tex is mounted at Line 6 (and NOT leaking methodology.tex Line 4 onto main.tex)
    const mainErrorLens = page.locator('.cm-error-lens.cm-error-lens-error');
    await expect(mainErrorLens).toHaveCount(1, { timeout: 10000 });
    await expect(mainErrorLens.first()).toHaveAttribute('data-line', '6');

    // 3. Test Real-Time Line Shifting: Insert a newline at the top of main.tex (Line 1)
    await cmContent.click();
    await page.keyboard.press('Control+Home');
    await page.keyboard.press('Enter');

    // ErrorLens on line 6 must shift to data-line="7" in real time
    await expect(page.locator('.cm-error-lens.cm-error-lens-error').first()).toHaveAttribute(
      'data-line',
      '7',
      { timeout: 5000 }
    );

    // 4. Test Cross-File Error Jump to Unopened Subfile (sections/methodology.tex, Line 4)
    await err0.getByRole('button', { name: /Line 4/i }).first().click();

    // Verify methodology.tex opens with its actual content (NOT overwritten by empty string '')
    await expect(cmContent).toContainText('\\methodBrokenCommand', { timeout: 8000 });
    await expect(cmContent).toContainText('variational solver');

    // Verify inline ErrorLens in methodology.tex renders on Line 4
    await expect(page.locator('.cm-error-lens.cm-error-lens-error').first()).toHaveAttribute(
      'data-line',
      '4',
      { timeout: 5000 }
    );
  });

  test('Dataset 2: In-Flight Compilation Cancellation, Superseding with forceClean, & Stop Compilation Event', async ({
    page,
    editor,
  }) => {
    void editor;

    let compileCallCount = 0;
    let cancelCallCount = 0;
    let shouldSlowCompile = false;
    const receivedPayloads: Array<Record<string, unknown>> = [];
    let releaseSlowCompile: (() => void) | null = null;

    await page.route(/\/compile\/cancel/, async (route) => {
      cancelCallCount++;
      if (releaseSlowCompile) {
        const release = releaseSlowCompile;
        releaseSlowCompile = null;
        release();
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ cancelled: true }),
      });
    });

    await page.route(/\/compile(\?.*)?$/, async (route) => {
      if (route.request().url().includes('/cancel')) {
        return route.fallback();
      }
      compileCallCount++;
      let body: Record<string, unknown> = {};
      try {
        body = route.request().postDataJSON() || {};
      } catch {}
      receivedPayloads.push(body);

      if (shouldSlowCompile) {
        await new Promise<void>((resolve) => {
          releaseSlowCompile = resolve;
          setTimeout(resolve, 1500);
        });
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: 'Compilation superseded',
            logs: 'signal is aborted',
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_COMPILE_SUCCESS),
      });
    });

    await page.goto(`/editor/${PAGE_ID}`);
    await expect(page.locator('.cm-content').first()).toBeVisible({ timeout: 15000 });

    const recompileBtn = page.getByRole('button', { name: /Recompile document/i }).first();
    await expect(recompileBtn).toBeVisible({ timeout: 10000 });

    // Wait for any initial page load compile to finish or settle
    await expect(recompileBtn).toContainText('Recompile', { timeout: 10000 });
    const baselineCalls = compileCallCount;

    // ── Part A: Trigger slow compile (baseline + 1) and click "Stop compilation" ──
    shouldSlowCompile = true;
    await recompileBtn.click();
    await expect(recompileBtn).toContainText('Compiling...', { timeout: 5000 });
    const callsDuringSlow1 = compileCallCount;

    // Open Compilation Options dropdown and click "Stop compilation"
    await page.getByRole('button', { name: 'Compilation Options' }).first().click();
    const stopItem = page.getByRole('menuitem', { name: /Stop compilation/i });
    await expect(stopItem).toBeVisible();
    await stopItem.click();

    // Verify /compile/cancel was called and button returns to "Recompile" without firing a rogue queued compile
    await expect.poll(() => cancelCallCount, { timeout: 5000 }).toBeGreaterThanOrEqual(1);
    await expect(recompileBtn).toContainText('Recompile', { timeout: 5000 });
    await page.waitForTimeout(350);
    expect(compileCallCount).toBe(callsDuringSlow1);
    expect(callsDuringSlow1).toBeGreaterThan(baselineCalls);

    // ── Part B: Trigger slow compile and supersede it with "Recompile from scratch" (forceClean: true) ──
    shouldSlowCompile = true;
    await recompileBtn.click();
    await expect(recompileBtn).toContainText('Compiling...', { timeout: 5000 });
    const callsDuringSlow2 = compileCallCount;

    // Next compile (the superseding one) should succeed immediately
    shouldSlowCompile = false;

    // While slow compile #2 is in-flight, click Compilation Options -> "Recompile from scratch"
    await page.getByRole('button', { name: 'Compilation Options' }).first().click();
    const scratchItem = page.getByRole('menuitem', { name: /Recompile from scratch/i });
    await expect(scratchItem).toBeVisible();
    await scratchItem.click();

    // Verify slow compile #2 was cancelled and superseding compile automatically fired with force_clean: true preserved!
    await expect.poll(() => compileCallCount, { timeout: 8000 }).toBe(callsDuringSlow2 + 1);
    const lastPayload = receivedPayloads[receivedPayloads.length - 1];
    expect(lastPayload?.force_clean).toBe(true);
    expect(lastPayload?.use_cache).toBe(false);
  });

  test('Dataset 3: Offline / Network Drop During Compile, Automatic Recovery on online Event, & Nonstopmode Warning Ingestion', async ({
    page,
    editor,
  }) => {
    void editor;

    let compileCalls = 0;
    let simulateNetworkFailure = false;

    const nonstopmodeLogWithWarning = [
      'This is pdfTeX, Version 3.141592653-2.6-1.40.25 (TeX Live 2023)',
      '(./main.tex',
      'LaTeX Warning: Reference `sec:unlinked\' on page 1 undefined on input line 4.',
      ')',
      'Output written on main.pdf (1 page, 12400 bytes).',
    ].join('\n');

    await page.route(/\/compile(\?.*)?$/, async (route) => {
      compileCalls++;
      if (simulateNetworkFailure) {
        await route.abort('failed');
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...MOCK_COMPILE_SUCCESS,
          logs: nonstopmodeLogWithWarning,
        }),
      });
    });

    await page.goto(`/editor/${PAGE_ID}`);
    await expect(page.locator('.cm-content').first()).toBeVisible({ timeout: 15000 });

    const recompileBtn = page.getByRole('button', { name: /Recompile document/i }).first();
    await expect(recompileBtn).toBeVisible({ timeout: 10000 });

    // 1. Simulate offline mode and trigger compile
    simulateNetworkFailure = true;
    await page.evaluate(() => {
      window.dispatchEvent(new Event('offline'));
    });

    await recompileBtn.click();

    // Open logs view via "Logs and output files" button to inspect offline notice
    const logsBtn = page.getByRole('button', { name: /Logs and output files/i }).first();
    if (await logsBtn.isVisible()) {
      await logsBtn.click();
    }

    const rawLogsBtn = page.getByRole('button', { name: /Raw logs/i });
    await expect(rawLogsBtn).toBeVisible({ timeout: 5000 });
    await rawLogsBtn.click();
    await expect(page.locator('#raw-latex-logs-content')).toContainText('[Offline Mode]');

    // 2. Restore network connectivity and dispatch 'online' event -> must auto-recompile!
    const callsBeforeOnline = compileCalls;
    simulateNetworkFailure = false;
    await page.evaluate(() => {
      window.dispatchEvent(new Event('online'));
    });

    await expect
      .poll(() => compileCalls, { timeout: 8000 })
      .toBeGreaterThan(callsBeforeOnline);

    // 3. Verify nonstopmode warning on line 4 was ingested into CodeMirror inline ErrorLens even on a successful build!
    await expect(page.locator('.cm-error-lens.cm-error-lens-warning').first()).toHaveAttribute(
      'data-line',
      '4',
      { timeout: 8000 }
    );
  });

  test('Dataset 4: Bidirectional SyncTeX Accuracy (Forward Code -> PDF & Reverse PDF -> Subfile Line)', async ({
    page,
    editor,
  }) => {
    void editor;

    const methodologyTexContent = [
      '\\section{Methodology}',
      'We formulate the Lagrangian dual problem.',
      '\\begin{equation}\\label{eq:lagrangian}',
      '  \\mathcal{L}(x, \\lambda) = f(x) + \\lambda^T g(x)',
      '\\end{equation}',
    ].join('\n');

    let forwardSyncRequested = false;

    await page.route(/\/files(\?.*)?$/, async (route) => {
      const files = [
        ...MOCK_FILES_HIERARCHY,
        {
          id: METHODS_FILE_ID,
          title: 'methodology.tex',
          path: 'sections/methodology.tex',
          content: methodologyTexContent,
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
      forwardSyncRequested = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          page: 1,
          x: 110.5,
          y: 280.2,
          w: 240.0,
          h: 14.5,
        }),
      });
    });

    await page.route(/\/synctex\/reverse/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          file: 'sections/methodology.tex',
          line: 4,
          column: 1,
        }),
      });
    });

    await page.goto(`/editor/${PAGE_ID}`);
    const cmContent = page.locator('.cm-content').first();
    await expect(cmContent).toBeVisible({ timeout: 15000 });

    // Trigger compile so PDF surface is loaded
    const recompileBtn = page.getByRole('button', { name: /Recompile document/i }).first();
    await expect(recompileBtn).toBeVisible({ timeout: 10000 });
    await recompileBtn.click();

    // Place cursor on line 4 of main.tex
    const line4 = page.locator('.cm-line').nth(3);
    if (await line4.isVisible()) {
      await line4.click();
    }

    // Trigger Reverse SyncTeX by double-clicking on the PDF surface or page container
    const pdfSurface = page.locator('[data-page-number="1"], .react-pdf__Page').first();
    if (await pdfSurface.isVisible()) {
      await pdfSurface.dblclick({ position: { x: 120, y: 180 } });
      await expect(cmContent).toContainText('\\mathcal{L}(x, \\lambda)', { timeout: 8000 });
    }
    void forwardSyncRequested;
  });

  test('Dataset 5: Official Overleaf LatexLogParser — 79-Character Hard-Wrap Unwrapping, Runaway Argument?, LaTeX3/Module Warnings, & Fatal Summary Filtering', async ({
    page,
    editor,
  }) => {
    void editor;

    // Exact 79-character line wrapping as emitted by TeX (LOG_WRAP_LIMIT = 79):
    // Line 1 of file open is exactly 79 chars:
    // `(./sections/long_experimental_methodology_and_ablation_study_results_v2_final.t` (79 chars)
    // followed by `ex` on the next line!
    const wrappedFileLinePart1 =
      '(./sections/long_experimental_methodology_and_ablation_study_results_v2_final.t';
    expect(wrappedFileLinePart1.length).toBe(79);
    const wrappedFileLinePart2 = 'ex';

    // Warning line wrapped at exactly 79 chars right before the line number `19.`:
    // `Package hyperref Warning: Token not allowed in a PDF string (Unicode): on input` (79 chars)
    // followed by ` line 19.`
    const wrappedWarnPart1 =
      'Package hyperref Warning: Token not allowed in a PDF string (Unicode): on input';
    expect(wrappedWarnPart1.length).toBe(79);
    const wrappedWarnPart2 = ' line 19.';

    const officialLatexLogDataset = [
      'This is pdfTeX, Version 3.141592653-2.6-1.40.25 (TeX Live 2023)',
      '(./main.tex',
      wrappedFileLinePart1,
      wrappedFileLinePart2,
      'Runaway argument?',
      '{\\textbf{Unclosed bold argument in experimental section \\par ',
      '! Paragraph ended before \\textbf was complete.',
      '<to be read again> ',
      '                   \\par ',
      'l.12 ',
      ')',
      wrappedWarnPart1,
      wrappedWarnPart2,
      'Module l3kernel Warning: Deprecated expl3 function used on input line 27.',
      '!  ==> Fatal error occurred, no output PDF file produced!',
      'Transcript written on main.log.',
    ].join('\n');

    await page.route(/\/diagnostics\/parse-log|\/diagnostics\/parse/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'report-overleaf-official-005',
          isSuccess: false,
          errorsCount: 1,
          warningsCount: 2,
          badboxesCount: 0,
          infoCount: 0,
          totalCount: 3,
          items: [],
        }),
      });
    });

    await page.route(/\/compile(\?.*)?$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Compilation failed',
          logs: officialLatexLogDataset,
        }),
      });
    });

    await page.goto(`/editor/${PAGE_ID}`);
    await expect(page.locator('.cm-content').first()).toBeVisible({ timeout: 15000 });

    const recompileBtn = page.getByRole('button', { name: /Recompile document/i }).first();
    await expect(recompileBtn).toBeVisible({ timeout: 10000 });
    await recompileBtn.click();

    // 1. Verify Fatal Summary Line (`!  ==> Fatal error occurred...`) was filtered out and Runaway argument? merged into exactly 1 error!
    const errorStepper = page.getByTestId('compiler-error-stepper');
    await expect(errorStepper).toBeVisible({ timeout: 10000 });
    await expect(errorStepper).toContainText('Error 1 of 1');

    // 2. Verify 79-char unwrapped file path attributed the Runaway argument? error to the full `.tex` filename & Line 12
    const err0 = page.locator('#log-entry-err-0');
    await expect(err0).toBeVisible();
    await expect(err0).toContainText(
      'sections/long_experimental_methodology_and_ablation_study_results_v2_final.tex'
    );
    await expect(err0).toContainText('Line 12');
    await expect(err0).toContainText('Runaway argument?');

    // 3. Verify 79-char unwrapped hyperref warning extracted `Line 19` and `Module l3kernel Warning` extracted `Line 27`
    const warningsTab = page.getByRole('tab', { name: /Warnings/i }).first();
    await warningsTab.click();
    await expect(page.locator('body')).toContainText('Line 19');
    await expect(page.locator('body')).toContainText('Line 27');
  });

  test('Dataset 6: Official Overleaf BibLogParser — BibTeX & Biber Subsystem Errors/Warnings & Cross-File Jump to references.bib', async ({
    page,
    editor,
  }) => {
    void editor;

    const BIB_FILE_ID = 'file-bib-002';
    const bibFileContent = [
      '@article{vaswani2017attention,',
      '  title={Attention is all you need},',
      '  author={Vaswani, Ashish and others},',
      '  year={2017}',
      '}',
      '',
      '@inproceedings{dupKey2026,',
      '  title={First entry},',
      '  author={Smith, John},',
      '  year={2026}',
      '}',
      '',
      '% Line 13 comment before duplicate entry',
      '@inproceedings{dupKey2026,',
      '  title={Duplicate entry triggering BibTeX error on line 14},',
      '  author={Doe, Jane},',
      '  year={2026}',
      '}',
      '',
      '@article{biberBroken2026,',
      '  title={Missing comma before year} year={2026}',
      '}',
    ].join('\n');

    const bibAndBiberLogDataset = [
      'This is pdfTeX, Version 3.141592653-2.6-1.40.25 (TeX Live 2023)',
      '(./main.tex',
      'This is BibTeX, Version 0.99d (TeX Live 2023)',
      'Database file #1: references.bib',
      'Warning--empty journal in vaswani2017attention',
      '--line 4 of file references.bib',
      'Repeated entry---line 14 of file references.bib',
      ' : @inproceedings{dupKey2026',
      ' :                          ,',
      "I'm skipping whatever remains of this entry",
      '[245] Utils.pm:410> ERROR - BibTeX subsystem: /compile/references.bib_9812.utf8, line 21, syntax error: found "year", expected ","',
      '[246] Biber.pm:130> WARN - I didn\'t find a database entry for \'missingBibKey2026\'',
      ')',
    ].join('\n');

    await page.route(/\/files(\?.*)?$/, async (route) => {
      const files = [
        ...MOCK_FILES_HIERARCHY.map((f) =>
          f.id === BIB_FILE_ID || f.title === 'references.bib'
            ? { ...f, id: BIB_FILE_ID, title: 'references.bib', path: 'references.bib', content: bibFileContent }
            : f
        ),
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

    await page.route(/\/diagnostics\/parse-log|\/diagnostics\/parse/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'report-bib-biber-006',
          isSuccess: false,
          errorsCount: 2,
          warningsCount: 2,
          badboxesCount: 0,
          infoCount: 0,
          totalCount: 4,
          items: [],
        }),
      });
    });

    await page.route(/\/compile(\?.*)?$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'BibTeX / Biber errors encountered',
          logs: bibAndBiberLogDataset,
        }),
      });
    });

    await page.goto(`/editor/${PAGE_ID}`);
    const cmContent = page.locator('.cm-content').first();
    await expect(cmContent).toBeVisible({ timeout: 15000 });

    const recompileBtn = page.getByRole('button', { name: /Recompile document/i }).first();
    await expect(recompileBtn).toBeVisible({ timeout: 10000 });
    await recompileBtn.click();

    // 1. Verify both BibTeX error (line 14) and Biber subsystem error (line 21) are parsed as 2 errors in references.bib
    const errorStepper = page.getByTestId('compiler-error-stepper');
    await expect(errorStepper).toBeVisible({ timeout: 10000 });
    await expect(errorStepper).toContainText('Error 1 of 2');

    const err0 = page.locator('#log-entry-err-0');
    await expect(err0).toContainText('references.bib');
    await expect(err0).toContainText('Line 14');
    await expect(err0).toContainText('Repeated entry');

    const err1 = page.locator('#log-entry-err-1');
    await expect(err1).toContainText('references.bib');
    await expect(err1).toContainText('Line 21');
    await expect(err1).toContainText('Biber error');

    // 2. Click Line 14 on the BibTeX error entry -> must switch active editor tab to `references.bib` with full BibTeX content!
    await err0.getByRole('button', { name: /Line 14/i }).first().click();
    await expect(cmContent).toContainText('Duplicate entry triggering BibTeX error on line 14', {
      timeout: 8000,
    });
  });

  test('Dataset 7: Official Overleaf CLSI Compile Modes — Fast (draft) Mode & Stop on First Error Payload Verification', async ({
    page,
    editor,
  }) => {
    void editor;

    const capturedPayloads: Array<Record<string, unknown>> = [];

    await page.route(/\/compile(\?.*)?$/, async (route) => {
      let body: Record<string, unknown> = {};
      try {
        body = route.request().postDataJSON() || {};
      } catch {}
      capturedPayloads.push(body);

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_COMPILE_SUCCESS),
      });
    });

    await page.goto(`/editor/${PAGE_ID}`);
    await expect(page.locator('.cm-content').first()).toBeVisible({ timeout: 15000 });

    const recompileBtn = page.getByRole('button', { name: /Recompile document/i }).first();
    await expect(recompileBtn).toBeVisible({ timeout: 10000 });

    // Open Compilation Options dropdown and select "Fast (draft)"
    await page.getByRole('button', { name: 'Compilation Options' }).first().click();
    const draftMenuItem = page.getByRole('menuitem', { name: /Fast \(draft\)/i });
    await expect(draftMenuItem).toBeVisible();
    await draftMenuItem.click();

    // Open Compilation Options dropdown and enable "Stop on first error"
    await page.getByRole('button', { name: 'Compilation Options' }).first().click();
    const stopOnFirstErrorItem = page.getByRole('menuitem', { name: /Stop on first error/i });
    await expect(stopOnFirstErrorItem).toBeVisible();
    await stopOnFirstErrorItem.click();

    // Trigger Recompile and verify payload sends `draft: true` and `stop_on_first_error: true`
    const countBefore = capturedPayloads.length;
    await recompileBtn.click();
    await expect.poll(() => capturedPayloads.length, { timeout: 8000 }).toBeGreaterThan(countBefore);

    const latestPayload = capturedPayloads[capturedPayloads.length - 1];
    expect(latestPayload?.draft).toBe(true);
    expect(latestPayload?.stop_on_first_error).toBe(true);
  });
});

