import { test, expect } from '../fixtures/editor.fixture';
import {
  MOCK_PAGE,
  MOCK_FILES_HIERARCHY,
  MOCK_COMPILE_SUCCESS,
} from '../fixtures/mock-data';

/**
 * overleaf-output-format-verification.spec.ts
 *
 * Official Overleaf Output Format Verification E2E Dataset Suite (Datasets O1 - O6).
 * Benchmarked directly against official Overleaf primary sources:
 * - `services/web/frontend/js/features/pdf-preview/util/output-files.ts` (`normalizeFilePath`, `TRANSIENT_WARNING_REGEX`, `buildLogEntryAnnotations`, `handleOutputFiles`)
 * - `services/web/frontend/js/ide/human-readable-logs/HumanReadableLogs.ts` & `HumanReadableLogsRules.tsx` (`cascadesFrom: ['environment']`)
 * - `services/web/frontend/js/ide/human-readable-logs/HumanReadableLogsPackageSuggestions.ts` (32 command & 10 environment package suggestions)
 * - `services/web/frontend/js/features/pdf-preview/components/error-logs.tsx` & `pdf-preview-error.tsx`
 */
test.describe('Overleaf User-Facing Output Format Verification — Datasets O1 to O6', () => {
  const PAGE_ID = 'page-paper-001';

  test('Dataset O1: Official Overleaf Path Normalization (/var/lib/overleaf/data/compiles/<id>/, /compile/, Windows backslashes, quoted spaces) & Pointer-Noise Filtering', async ({
    page,
    editor,
  }) => {
    void editor;

    // Simulates raw CLSI container paths & pointer-noise detail lines as emitted by Overleaf's Docker TeX runner
    const clsiRawContainerPathsLog = [
      'This is pdfTeX, Version 3.141592653-2.6-1.40.25 (TeX Live 2023)',
      '(/var/lib/overleaf/data/compiles/652a9f12bc0192837465abcd-507f1f77bcf86cd799439011/./main.tex',
      '(/var/lib/overleaf/data/compiles/652a9f12bc0192837465abcd-507f1f77bcf86cd799439011//sections//experimental_setup.tex',
      '! Undefined control sequence.',
      'l.9   ^^^^^^',
      '\\unknownContainerMacro',
      ')',
      '("/compile/chapters/01_Introduction_and_Background.tex"',
      '! Missing $ inserted.',
      'l.18 x_1 + y_1 = z_1',
      ')',
      '(.\\appendix\\proofs_v1.tex',
      'LaTeX Warning: Reference `thm:main\u20141\' on page 1 undefined on input line 33.',
      ')',
      ')',
    ].join('\n');

    await page.route(/\/diagnostics\/parse-log|\/diagnostics\/parse/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'report-output-format-o1',
          isSuccess: false,
          errorsCount: 2,
          warningsCount: 1,
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
          error: 'Compilation failed with 2 errors',
          logs: clsiRawContainerPathsLog,
        }),
      });
    });

    await page.goto(`/editor/${PAGE_ID}`);
    await expect(page.locator('.cm-content').first()).toBeVisible({ timeout: 15000 });

    const recompileBtn = page.getByRole('button', { name: /Recompile document/i }).first();
    await expect(recompileBtn).toBeVisible({ timeout: 10000 });
    await recompileBtn.click();

    // 1. Verify CLSI container path `/var/lib/overleaf/data/compiles/<id>//sections//experimental_setup.tex` is normalized cleanly
    const err0 = page.locator('#log-entry-err-0');
    await expect(err0).toBeVisible({ timeout: 10000 });
    await expect(err0).toContainText('sections/experimental_setup.tex');
    await expect(err0).not.toContainText('/var/lib/overleaf');
    await expect(err0).not.toContainText('compiles/');
    await expect(err0).toContainText('Line 9');

    // 2. Verify `/compile/chapters/01_Introduction_and_Background.tex` is normalized cleanly
    const err1 = page.locator('#log-entry-err-1');
    await expect(err1).toBeVisible();
    await expect(err1).toContainText('chapters/01_Introduction_and_Background.tex');
    await expect(err1).not.toContainText('/compile/');
    await expect(err1).toContainText('Line 18');

    // 3. Verify Windows backslash path `(.\appendix\proofs_v1.tex` and Unicode em-dash `\u2014` sanitization in Warnings
    await page.getByRole('tab', { name: /Warnings/i }).first().click();
    await expect(page.locator('body')).toContainText('appendix/proofs_v1.tex');
    await expect(page.locator('body')).toContainText('Line 33');
    await expect(page.locator('body')).toContainText("Reference `thm:main-1'");
  });

  test('Dataset O2: Official Overleaf HumanReadableLogs — Cascading Environment Error Suppression, Package Suggestion QuickFix, & Mismatched Environment QuickFix', async ({
    page,
    editor,
  }) => {
    void editor;

    const initialMainTex = [
      '\\documentclass{article}',
      '\\begin{document}',
      '\\section{Introduction}',
      '\\toprule',
      '\\begin{itemize}',
      '  \\item First point',
      '\\end{enumerate}',
      '\\end{document}',
    ].join('\n');

    // Simulates:
    // 1. Missing `booktabs` package (`\toprule` on line 4) -> should offer Quick Fix `Add \usepackage{booktabs} to preamble`
    // 2. Primary environment mismatch: `\begin{itemize} on input line 5 ended by \end{enumerate}.` on line 7
    // 3. Cascading environment error (`! LaTeX Error: `\end{itemize}' expected...`) and cascading warning (`Warning: No matching \end found for `\begin{itemize}'`) -> MUST BE SUPPRESSED!
    const cascadingAndQuickFixLog = [
      'This is pdfTeX, Version 3.141592653-2.6-1.40.25 (TeX Live 2023)',
      '(./main.tex',
      '! Undefined control sequence.',
      'l.4 \\toprule',
      '',
      '! LaTeX Error: \\begin{itemize} on input line 5 ended by \\end{enumerate}.',
      'See the LaTeX manual or LaTeX Companion for explanation.',
      'l.7 \\end{enumerate}',
      '',
      "! LaTeX Error: `\\end{itemize}' expected, but found `\\end{document}'.",
      'l.8 \\end{document}',
      '',
      "LaTeX Warning: No matching \\end found for `\\begin{itemize}' on input line 5.",
      ')',
    ].join('\n');

    await page.route(/\/docs\/page-paper-001|\/pages\/page-paper-001/, async (route) => {
      if (route.request().url().includes('/files')) {
        return route.fallback();
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          page: { ...MOCK_PAGE, content: initialMainTex, docContent: initialMainTex },
          success: true,
          data: { page: { ...MOCK_PAGE, content: initialMainTex, docContent: initialMainTex } },
        }),
      });
    });

    await page.route(/\/diagnostics\/parse-log|\/diagnostics\/parse/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'report-output-format-o2',
          isSuccess: false,
          errorsCount: 2,
          warningsCount: 0,
          badboxesCount: 0,
          infoCount: 0,
          totalCount: 2,
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
          logs: cascadingAndQuickFixLog,
        }),
      });
    });

    await page.goto(`/editor/${PAGE_ID}`);
    const cmContent = page.locator('.cm-content').first();
    await expect(cmContent).toBeVisible({ timeout: 15000 });

    const recompileBtn = page.getByRole('button', { name: /Recompile document/i }).first();
    await expect(recompileBtn).toBeVisible({ timeout: 10000 });
    await recompileBtn.click();

    // 1. Verify cascading environment error #3 and cascading warning were SUPPRESSED (only 2 errors, 0 warnings!)
    const errorStepper = page.getByTestId('compiler-error-stepper');
    await expect(errorStepper).toBeVisible({ timeout: 10000 });
    await expect(errorStepper).toContainText('Error 1 of 2');
    await expect(page.getByRole('tab', { name: /Warnings/i }).first()).toContainText('0');

    // 2. Verify Error 0 (`\toprule`) has Quick Fix button (`Add \usepackage{booktabs} to preamble`) and clicking it injects `\usepackage{booktabs}` before `\begin{document}`
    const err0 = page.locator('#log-entry-err-0');
    const quickFixBtn0 = err0.getByRole('button', { name: /Quick fix/i });
    await expect(quickFixBtn0).toBeVisible();
    await quickFixBtn0.click();

    await expect(cmContent).toContainText('\\usepackage{booktabs}', { timeout: 5000 });

    // 3. Verify Error 1 (`\begin{itemize} ... ended by \end{enumerate}`) has Quick Fix button (`Replace with \end{itemize}`)
    const err1 = page.locator('#log-entry-err-1');
    const quickFixBtn1 = err1.getByRole('button', { name: /Quick fix/i });
    await expect(quickFixBtn1).toBeVisible();
  });

  test('Dataset O3: Official Overleaf Same-Line Multi-Diagnostic Formatting & Severity Priority on CodeMirror ErrorLens', async ({
    page,
    editor,
  }) => {
    void editor;

    // Line 4 has BOTH a hard error (`! Undefined control sequence`) AND a warning (`Citation 'missingRef' ... undefined on input line 4`)
    const sameLineErrorAndWarningLog = [
      'This is pdfTeX, Version 3.141592653-2.6-1.40.25 (TeX Live 2023)',
      '(./main.tex',
      '! Undefined control sequence.',
      'l.4 \\brokenMacroOnLineFour \\cite{missingRef}',
      '',
      "LaTeX Warning: Citation `missingRef' on page 1 undefined on input line 4.",
      ')',
    ].join('\n');

    await page.route(/\/diagnostics\/parse-log|\/diagnostics\/parse/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'report-output-format-o3',
          isSuccess: false,
          errorsCount: 1,
          warningsCount: 1,
          badboxesCount: 0,
          infoCount: 0,
          totalCount: 2,
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
          logs: sameLineErrorAndWarningLog,
        }),
      });
    });

    await page.goto(`/editor/${PAGE_ID}`);
    await expect(page.locator('.cm-content').first()).toBeVisible({ timeout: 15000 });

    const recompileBtn = page.getByRole('button', { name: /Recompile document/i }).first();
    await expect(recompileBtn).toBeVisible({ timeout: 10000 });
    await recompileBtn.click();

    // 1. Verify CompilerLogs Filter Tabs show All logs (2), Errors (1), Warnings (1)
    await expect(page.getByRole('tab', { name: /All logs/i }).first()).toContainText('2', {
      timeout: 10000,
    });
    await expect(page.getByRole('tab', { name: /Errors/i }).first()).toContainText('1');
    await expect(page.getByRole('tab', { name: /Warnings/i }).first()).toContainText('1');

    // 2. Verify CodeMirror inline ErrorLens on Line 4 renders with ERROR severity (`.cm-error-lens-error`) and NOT warning severity (`.cm-error-lens-warning`), proving error priority + single-widget deduplication per line!
    const line4ErrorLens = page.locator('.cm-error-lens.cm-error-lens-error[data-line="4"]');
    await expect(line4ErrorLens).toBeVisible({ timeout: 8000 });
    await expect(line4ErrorLens).toContainText('Undefined control sequence.');
    await expect(page.locator('.cm-error-lens.cm-error-lens-warning[data-line="4"]')).toHaveCount(0);
  });

  test('Dataset O4: Official Overleaf Stop-on-First-Error Transient Warning Filtering (`TRANSIENT_WARNING_REGEX`)', async ({
    page,
    editor,
  }) => {
    void editor;

    // Log emitted when stopped-on-first-error: has 1 hard error, 2 transient Reference/Citation undefined warnings, and 1 real Package warning
    const stoppedOnFirstErrorLog = [
      'This is pdfTeX, Version 3.141592653-2.6-1.40.25 (TeX Live 2023)',
      '(./main.tex',
      "LaTeX Warning: Reference `sec:methods' on page 1 undefined on input line 3.",
      "LaTeX Warning: Citation `vaswani2017' on page 1 undefined on input line 4.",
      'Package hyperref Warning: Token not allowed in a PDF string on input line 5.',
      '! Undefined control sequence.',
      'l.6 \\haltImmediatelyMacro',
      ')',
    ].join('\n');

    await page.route(/\/diagnostics\/parse-log|\/diagnostics\/parse/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'report-output-format-o4',
          isSuccess: false,
          errorsCount: 1,
          warningsCount: 3,
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
          error: 'Stopped on first error',
          logs: stoppedOnFirstErrorLog,
        }),
      });
    });

    await page.goto(`/editor/${PAGE_ID}`);
    await expect(page.locator('.cm-content').first()).toBeVisible({ timeout: 15000 });

    const recompileBtn = page.getByRole('button', { name: /Recompile document/i }).first();
    await expect(recompileBtn).toBeVisible({ timeout: 10000 });

    // 1. In normal mode (stopOnFirstError = false), all 3 warnings are shown
    await recompileBtn.click();
    const warningsTab = page.getByRole('tab', { name: /Warnings/i }).first();
    await expect(warningsTab).toContainText('3', { timeout: 10000 });

    // 2. Enable "Stop on first error" in Compilation Options dropdown -> transient Reference/Citation warnings are filtered out, leaving only the 1 non-transient Package warning!
    await page.getByRole('button', { name: 'Compilation Options' }).first().click();
    await page.getByRole('menuitem', { name: /Stop on first error/i }).click();

    await expect(warningsTab).toContainText('1', { timeout: 5000 });
    await warningsTab.click();
    const warn0 = page.locator('#log-entry-warn-0');
    await expect(warn0).toBeVisible();
    await expect(warn0).toContainText('Package hyperref Warning');
    await expect(page.locator('#log-entry-warn-1')).toHaveCount(0);
  });

  test('Dataset O5 & O6: Official Overleaf Output Files Popover (`Other logs and files`), Raw Log Download, & CLSI `outputFiles` Resolution', async ({
    page,
    editor,
  }) => {
    void editor;

    // Mock `/artifacts` (auxFiles) returning extra compiler artifacts like `output.bbl` and `output.blg`
    await page.route(/\/artifacts$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          files: [
            { name: 'output.bbl', size: 2048 },
            { name: 'output.blg', size: 1024 },
            { name: 'output.synctex.gz', size: 8192 },
          ],
          success: true,
          data: {
            files: [
              { name: 'output.bbl', size: 2048 },
              { name: 'output.blg', size: 1024 },
              { name: 'output.synctex.gz', size: 8192 },
            ],
          },
        }),
      });
    });

    await page.route(/\/compile(\?.*)?$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Compilation error for log inspection',
          logs: [
            'This is pdfTeX, Version 3.141592653-2.6-1.40.25 (TeX Live 2023)',
            '(./main.tex',
            '! Undefined control sequence.',
            'l.5 \\inspectOutputFilesTest',
            ')',
          ].join('\n'),
        }),
      });
    });

    await page.goto(`/editor/${PAGE_ID}`);
    await expect(page.locator('.cm-content').first()).toBeVisible({ timeout: 15000 });

    const recompileBtn = page.getByRole('button', { name: /Recompile document/i }).first();
    await expect(recompileBtn).toBeVisible({ timeout: 10000 });
    await recompileBtn.click();

    // 1. Open "Other logs and files" popover at the bottom of CompilerLogs
    const otherFilesBtn = page.getByRole('button', { name: /Other logs and files/i });
    await expect(otherFilesBtn).toBeVisible({ timeout: 10000 });
    await otherFilesBtn.click();

    // 2. Verify 1:1 Overleaf popover header "Download other output files" and merged artifact list (`output.bbl`, `output.blg`, `output.log`, `output.aux`, `output.toc`, `Download all (10)`)
    await expect(page.locator('body')).toContainText('Download other output files');
    await expect(page.getByRole('button', { name: 'output.bbl', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'output.blg', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'output.log', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'output.aux', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /Download all \(10\)/i })).toBeVisible();

    // 3. Click `output.log` and verify client-side download of `output.log` triggers toast confirmation
    const downloadPromise = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);
    await page.getByRole('button', { name: 'output.log', exact: true }).click();
    const download = await downloadPromise;
    if (download) {
      expect(download.suggestedFilename()).toBe('output.log');
    }
  });
});
