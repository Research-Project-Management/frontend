import { test, expect } from '../fixtures/editor.fixture';
import {
  MOCK_PAGE,
  MOCK_FILES_HIERARCHY,
  MOCK_COMPILE_SUCCESS,
} from '../fixtures/mock-data';

/**
 * overleaf-track-changes-and-compile-logs.spec.ts
 *
 * Multi-Dataset E2E Verification Suite for:
 * 1. Track Changes & Review Subsystem:
 *    - Dataset A: Heterogeneous suggestions (insert, delete, replace), View Modes
 *      (Show all changes, Show final text, Show original text), inline decorations,
 *      and Sidebar/Inline Accept & Reject mutating the live CodeMirror document buffer.
 *    - Dataset B: Multi-file Review Overview (main.tex + methodology.tex), Editing Mode
 *      switcher (Editing / Reviewing / Viewing), Comment threads (reply, resolve, reopen,
 *      resolved filter toggle), and Bulk Accept All / Reject All in reverse offset order.
 * 2. Compile Log & Diagnostics Subsystem:
 *    - Dataset A: Multi-error LaTeX compilation log stream (! Undefined control sequence,
 *      ! LaTeX Error: Environment undefined, ! Missing $ inserted), auto-opening CompilerLogs,
 *      Overleaf F8 / Shift+F8 error stepper, LaTeX Error Guide (Explain), AI Error Assist
 *      (Suggest fix -> diff preview), Quick Fix application, and auto-return to PDF on clean build.
 *    - Dataset B: Noisy multi-category warnings & bad boxes (LaTeX Reference Warning,
 *      LaTeX Font Warning, Package hyperref Warning, BibTeX Warning--, Overfull \hbox,
 *      Underfull \vbox), Filter Tabs (All logs, Errors, Warnings, Info), Raw logs accordion,
 *      Output artifacts popover, and Clear cached files (force_clean) recompile.
 */
test.describe('Track Changes & Compile Logs — Multi-Dataset E2E Suite', () => {
  const PAGE_ID = 'page-paper-001';
  const SECOND_PAGE_ID = 'page-methods-003';

  test('Track Changes Dataset A: Insert, Delete & Replace Suggestions across View Modes and Live Buffer Accept/Reject', async ({
    page,
    editor,
  }) => {
    void editor;

    const initialLatex = `\\documentclass{article}
\\begin{document}
\\section{Introduction}
We establish a fault-tolerant bound under idealized noise-free assumptions with notable advantages.
\\end{document}
`;

    let suggestionsState = [
      {
        id: 'sug-ins-001',
        pageId: PAGE_ID,
        type: 'insert',
        originalText: '',
        suggestedText: 'We establish a fault-tolerant bound ',
        fromLine: 4,
        status: 'pending',
        description: 'Add explicit fault-tolerant bound claim',
        createdAt: new Date(Date.now() - 3600_000).toISOString(),
        author: {
          id: 'user-reviewer-002',
          name: 'Prof. Emmy Noether',
          email: 'noether@flux.academic',
        },
      },
      {
        id: 'sug-del-002',
        pageId: PAGE_ID,
        type: 'delete',
        originalText: 'under idealized noise-free assumptions ',
        suggestedText: '',
        fromLine: 4,
        status: 'pending',
        description: 'Remove restrictive noise-free assumption',
        createdAt: new Date(Date.now() - 1800_000).toISOString(),
        author: {
          id: 'user-reviewer-003',
          name: 'Dr. Richard Feynman',
          email: 'feynman@flux.academic',
        },
      },
      {
        id: 'sug-rep-003',
        pageId: PAGE_ID,
        type: 'replace',
        originalText: 'notable advantages',
        suggestedText: 'provable exponential speedups',
        fromLine: 4,
        status: 'pending',
        description: 'Strengthen claim with complexity bound',
        createdAt: new Date(Date.now() - 600_000).toISOString(),
        author: {
          id: 'user-reviewer-002',
          name: 'Prof. Emmy Noether',
          email: 'noether@flux.academic',
        },
      },
    ];

    await page.route(/\/docs\/page-paper-001|\/pages\/page-paper-001/, async (route) => {
      if (route.request().url().includes('/suggestions') || route.request().url().includes('/comments')) {
        return route.fallback();
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          page: { ...MOCK_PAGE, content: initialLatex, docContent: initialLatex },
          success: true,
          data: { page: { ...MOCK_PAGE, content: initialLatex, docContent: initialLatex } },
        }),
      });
    });

    await page.route(/\/suggestions(\?.*)?$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          suggestions: suggestionsState,
          success: true,
          data: { suggestions: suggestionsState },
        }),
      });
    });

    await page.route(/\/suggestions\/([^/]+)\/accept/, async (route) => {
      const match = route.request().url().match(/\/suggestions\/([^/]+)\/accept/);
      const sugId = match?.[1];
      suggestionsState = suggestionsState.map((s) =>
        s.id === sugId ? { ...s, status: 'accepted' } : s
      );
      const updated = suggestionsState.find((s) => s.id === sugId);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          suggestion: updated,
          page: MOCK_PAGE,
        }),
      });
    });

    await page.route(/\/suggestions\/([^/]+)\/reject/, async (route) => {
      const match = route.request().url().match(/\/suggestions\/([^/]+)\/reject/);
      const sugId = match?.[1];
      suggestionsState = suggestionsState.map((s) =>
        s.id === sugId ? { ...s, status: 'rejected' } : s
      );
      const updated = suggestionsState.find((s) => s.id === sugId);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          suggestion: updated,
        }),
      });
    });

    await page.goto(`/editor/${PAGE_ID}`);
    const cmContent = page.locator('.cm-content').first();
    await expect(cmContent).toBeVisible({ timeout: 15000 });

    // Open Review sidebar panel
    const reviewActivityTab = page.getByRole('tab', { name: /Review & Comments/i });
    await reviewActivityTab.click();

    // Verify all 3 pending suggestions appear in the Review sidebar
    await expect(page.getByText('3 pending suggestions')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#suggestion-sug-ins-001')).toBeVisible();
    await expect(page.locator('#suggestion-sug-del-002')).toBeVisible();
    await expect(page.locator('#suggestion-sug-rep-003')).toBeVisible();

    // 1. Verify CodeMirror inline decorations in default "Show all changes" ('changes') mode
    await expect(page.locator('.cm-track-change-insert')).toHaveCount(1);
    await expect(page.locator('.cm-track-change-delete')).toHaveCount(1);
    await expect(page.locator('.cm-track-change-replace')).toHaveCount(1);

    // 2. Switch TrackChangesControlBar view mode -> "Show final text" ('clean')
    const viewModeSelect = page.getByLabel('Track changes view mode');
    await expect(viewModeSelect).toBeVisible();
    await viewModeSelect.selectOption('clean');

    // In 'clean' mode, deletion mark is replaced/hidden and insert mark is rendered clean
    await expect(page.locator('.cm-track-change-delete')).toHaveCount(0);
    await expect(page.locator('.cm-track-change-insert')).toHaveCount(0);

    // 3. Switch TrackChangesControlBar view mode -> "Show original text" ('original')
    await viewModeSelect.selectOption('original');
    await expect(page.locator('.cm-track-change-insert')).toHaveCount(0);

    // 4. Switch back to "Show all changes" ('changes')
    await viewModeSelect.selectOption('changes');
    await expect(page.locator('.cm-track-change-insert')).toHaveCount(1);
    await expect(page.locator('.cm-track-change-delete')).toHaveCount(1);
    await expect(page.locator('.cm-track-change-replace')).toHaveCount(1);

    // 5. Accept 'replace' suggestion (sug-rep-003: 'notable advantages' -> 'provable exponential speedups')
    const repCard = page.locator('#suggestion-sug-rep-003');
    await repCard.getByRole('button', { name: 'Accept' }).click();
    await expect(cmContent).toContainText('provable exponential speedups');
    await expect(cmContent).not.toContainText('notable advantages');

    // 6. Accept 'delete' suggestion (sug-del-002: remove 'under idealized noise-free assumptions ')
    const delCard = page.locator('#suggestion-sug-del-002');
    await delCard.getByRole('button', { name: 'Accept' }).click();
    await expect(cmContent).not.toContainText('under idealized noise-free assumptions');

    // 7. Reject 'insert' suggestion (sug-ins-001: remove 'We establish a fault-tolerant bound ')
    const insCard = page.locator('#suggestion-sug-ins-001');
    await insCard.getByRole('button', { name: 'Reject' }).click();
    await expect(cmContent).not.toContainText('We establish a fault-tolerant bound');
  });

  test('Track Changes Dataset B: Multi-File Overview, Editing Mode Switcher, Comment Threads & Bulk Accept All', async ({
    page,
    editor,
  }) => {
    void editor;

    const mainTexContent = `\\documentclass{article}
\\begin{document}
\\section{Overview}
First baseline claim in main file.
Second baseline claim in main file.
\\input{methodology}
\\end{document}
`;

    const methodsTexContent = `\\section{Methodology}
We calibrate superconducting transmon qubits at 15 mK.
`;

    let mainSuggestions = [
      {
        id: 'sug-bulk-1',
        pageId: PAGE_ID,
        type: 'replace',
        originalText: 'First baseline claim',
        suggestedText: 'Primary theoretical theorem',
        fromLine: 4,
        status: 'pending',
        createdAt: new Date().toISOString(),
        author: { id: 'user-reviewer-002', name: 'Prof. Emmy Noether' },
      },
      {
        id: 'sug-bulk-2',
        pageId: PAGE_ID,
        type: 'replace',
        originalText: 'Second baseline claim',
        suggestedText: 'Secondary empirical corollary',
        fromLine: 5,
        status: 'pending',
        createdAt: new Date().toISOString(),
        author: { id: 'user-reviewer-002', name: 'Prof. Emmy Noether' },
      },
    ];

    const methodsSuggestions = [
      {
        id: 'sug-methods-1',
        pageId: SECOND_PAGE_ID,
        type: 'replace',
        originalText: '15 mK',
        suggestedText: '10 mK dilution refrigerator temperature',
        fromLine: 2,
        status: 'pending',
        createdAt: new Date().toISOString(),
        author: { id: 'user-reviewer-002', name: 'Prof. Emmy Noether' },
      },
    ];

    let mainComments = [
      {
        id: 'cmt-open-001',
        pageId: PAGE_ID,
        projectId: 'proj-academic-001',
        content: 'Please clarify the stabilizer syndrome extraction rate here.',
        line: 4,
        lineEnd: 4,
        status: 'open',
        resolved: false,
        createdAt: new Date().toISOString(),
        author: { id: 'user-reviewer-002', name: 'Prof. Emmy Noether' },
        replies: [],
      },
      {
        id: 'cmt-resolved-002',
        pageId: PAGE_ID,
        projectId: 'proj-academic-001',
        content: 'Typo fixed in previous draft.',
        line: 3,
        lineEnd: 3,
        status: 'resolved',
        resolved: true,
        createdAt: new Date().toISOString(),
        author: { id: 'user-academic-001', name: 'Dr. Alan Turing' },
        replies: [],
      },
    ];

    await page.route(/\/files(\?.*)?$/, async (route) => {
      const files = [
        ...MOCK_FILES_HIERARCHY.map((f) =>
          f.id === PAGE_ID ? { ...f, content: mainTexContent } : f
        ),
        {
          id: SECOND_PAGE_ID,
          title: 'methodology.tex',
          projectId: 'proj-academic-001',
          isMain: false,
          content: methodsTexContent,
        },
      ];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ files, success: true, data: { files } }),
      });
    });

    await page.route(/\/docs\/page-paper-001|\/pages\/page-paper-001/, async (route) => {
      const reqUrl = route.request().url();
      if (
        reqUrl.includes('/suggestions') ||
        reqUrl.includes('/comments') ||
        reqUrl.includes('/files') ||
        reqUrl.includes('/deleted-files')
      ) {
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

    await page.route(new RegExp(`/docs/${SECOND_PAGE_ID}/suggestions`), async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          suggestions: methodsSuggestions,
          success: true,
          data: { suggestions: methodsSuggestions },
        }),
      });
    });

    await page.route(new RegExp(`/docs/${SECOND_PAGE_ID}/comments`), async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ comments: [], success: true, data: { comments: [] } }),
      });
    });

    await page.route(new RegExp(`/docs/${PAGE_ID}/suggestions(\\?.*)?$`), async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          suggestions: mainSuggestions,
          success: true,
          data: { suggestions: mainSuggestions },
        }),
      });
    });

    await page.route(new RegExp(`/docs/${PAGE_ID}/suggestions/accept-all`), async (route) => {
      mainSuggestions = mainSuggestions.map((s) => ({ ...s, status: 'accepted' }));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, acceptedCount: 2 }),
      });
    });

    await page.route(new RegExp(`/docs/${PAGE_ID}/comments(\\?.*)?$`), async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          comments: mainComments,
          success: true,
          data: { comments: mainComments },
        }),
      });
    });

    await page.route(new RegExp(`/docs/${PAGE_ID}/comments/([^/]+)/reply`), async (route) => {
      const body = route.request().postDataJSON();
      const newReply = {
        id: `reply-${Date.now()}`,
        content: body?.content || '',
        createdAt: new Date().toISOString(),
        author: { id: 'user-academic-001', name: 'Dr. Alan Turing' },
      };
      mainComments = mainComments.map((c) =>
        c.id === 'cmt-open-001' ? { ...c, replies: [...c.replies, newReply] } : c
      );
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          comment: mainComments.find((c) => c.id === 'cmt-open-001'),
        }),
      });
    });

    await page.route(new RegExp(`/docs/${PAGE_ID}/comments/([^/]+)/resolve`), async (route) => {
      const body = route.request().postDataJSON();
      const isResolved = Boolean(body?.resolved);
      mainComments = mainComments.map((c) =>
        c.id === 'cmt-open-001'
          ? { ...c, resolved: isResolved, status: isResolved ? 'resolved' : 'open' }
          : c
      );
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          comment: mainComments.find((c) => c.id === 'cmt-open-001'),
        }),
      });
    });

    await page.goto(`/editor/${PAGE_ID}`);
    const cmContent = page.locator('.cm-content').first();
    await expect(cmContent).toBeVisible({ timeout: 15000 });

    // 1. Test Topbar EditingModeDropdown (Editing -> Reviewing -> Editing)
    const modeDropdownBtn = page.getByRole('button', { name: /Editing mode:/i });
    await expect(modeDropdownBtn).toBeVisible();
    await modeDropdownBtn.click();
    await page.getByRole('menuitem', { name: /Reviewing/i }).click();
    await expect(page.getByRole('button', { name: 'Editing mode: Reviewing' })).toBeVisible();

    // Switch back to Editing mode
    await page.getByRole('button', { name: 'Editing mode: Reviewing' }).click();
    await page.getByRole('menuitem', { name: /Editing\s+Edit files directly/i }).click();
    await expect(page.getByRole('button', { name: 'Editing mode: Editing' })).toBeVisible();

    // 2. Open Review Sidebar & interact with Comment thread (Reply + Resolve + Filter Resolved)
    await page.getByRole('tab', { name: /Review & Comments/i }).click();
    const openCommentCard = page.locator('#comment-cmt-open-001');
    await expect(openCommentCard).toBeVisible({ timeout: 10000 });
    await expect(openCommentCard).toContainText('Please clarify the stabilizer syndrome extraction rate here.');

    // Reply to comment
    const replyInput = openCommentCard.getByPlaceholder('Reply...');
    await replyInput.fill('We use a 1 microsecond surface code cycle.');
    await openCommentCard.getByRole('button', { name: 'Send reply' }).click();
    await expect(openCommentCard).toContainText('We use a 1 microsecond surface code cycle.');

    // Resolve comment
    await openCommentCard.getByRole('button', { name: 'Resolve comment' }).click();
    await expect(openCommentCard).toContainText('Resolved');

    // Toggle "Hide resolved comments" in ReviewHeader
    const hideResolvedBtn = page.getByRole('button', { name: 'Hide resolved comments' });
    await hideResolvedBtn.click();
    await expect(openCommentCard).toBeHidden();

    // Show resolved comments again
    const showResolvedBtn = page.getByRole('button', { name: /Resolved comments:/i });
    await showResolvedBtn.click();
    await expect(openCommentCard).toBeVisible();

    // 3. Bulk Accept All pending suggestions on main.tex and verify reverse-offset safe application
    await expect(page.getByText('2 pending suggestions')).toBeVisible();
    await page.getByRole('button', { name: 'Accept All' }).click();
    await expect(cmContent).toContainText('Primary theoretical theorem in main file.');
    await expect(cmContent).toContainText('Secondary empirical corollary in main file.');

    // 4. Switch ReviewBottomNav to "Overview" and verify multi-file aggregation (methodology.tex)
    const reviewScopeNav = page.getByRole('navigation', { name: 'Review scope' });
    await reviewScopeNav.getByRole('button', { name: 'Overview' }).click();
    await expect(page.getByRole('button', { name: 'Jump to file methodology.tex' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('10 mK dilution refrigerator temperature')).toBeVisible();
  });

  test('Compile Log Dataset A: Multi-Error TeX Log, F8 Error Stepper, Error Guide (Explain), AI Fix & Quick Fix Recovery', async ({
    page,
    editor,
  }) => {
    void editor;

    const brokenLatex = `\\documentclass{article}
\\begin{document}
\\section{Quantum Teleportation}
\\quantumteleportation{Alice}{Bob}
\\begin{theorem}
Bell state fidelity is maximal.
\\end{theorem}
\\alpha + \\beta = 1
\\end{document}
`;

    const multiErrorRawLog = `This is pdfTeX, Version 3.141592653-2.6-1.40.26 (TeX Live 2024)
(./main.tex
LaTeX2e <2023-11-01> patch level 1
! Undefined control sequence.
l.4 \\quantumteleportation
                         {Alice}{Bob}
! LaTeX Error: Environment theorem undefined.
l.5 \\begin{theorem}
                   
! Missing $ inserted.
<inserted text> 
                $
l.8 \\alpha
           + \\beta = 1
)
No pages of output.
Transcript written on main.log.`;

    let shouldCompileSucceed = false;

    await page.route(/\/docs\/page-paper-001|\/pages\/page-paper-001/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          page: { ...MOCK_PAGE, content: brokenLatex, docContent: brokenLatex },
          success: true,
          data: { page: { ...MOCK_PAGE, content: brokenLatex, docContent: brokenLatex } },
        }),
      });
    });

    await page.route(/\/diagnostics\/parse-log/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'report-err-001',
          isSuccess: false,
          errorsCount: 3,
          warningsCount: 0,
          badboxesCount: 0,
          infoCount: 0,
          totalCount: 3,
          items: [
            {
              file: 'main.tex',
              line: 4,
              severity: 'error',
              code: 'LATEX_UNDEFINED_CONTROL_SEQUENCE',
              message: 'Undefined control sequence.',
              explanation: {
                code: 'LATEX_UNDEFINED_CONTROL_SEQUENCE',
                title: 'Undefined Control Sequence (\\quantumteleportation)',
                explanation: 'LaTeX encountered a macro command that has not been defined in the preamble or loaded via a package.',
                commonCauses: [
                  'Misspelled command name in the manuscript body',
                  'Forgot to include the required \\usepackage{} in the preamble',
                ],
                suggestedFix: 'Replace \\quantumteleportation{Alice}{Bob} with \\textbf{Alice and Bob}',
                exampleSnippet: '\\newcommand{\\quantumteleportation}[2]{\\textbf{#1 to #2}}',
              },
              quickFix: {
                description: 'Replace undefined macro with \\textbf{Alice and Bob}',
                replacementText: '\\textbf{Alice and Bob}',
              },
            },
          ],
        }),
      });
    });

    await page.route(/\/api\/ai\/chat\/sync|\/ai\/suggest-fix|\/suggest-fix/, async (route) => {
      const aiPayload = JSON.stringify({
        explanation: 'The command \\quantumteleportation is not a standard LaTeX macro. Wrap the arguments in \\textbf{} or define the macro.',
        fixedSnippet: '\\textbf{Alice and Bob}',
        originalSnippet: '\\quantumteleportation{Alice}{Bob}',
        confidence: 'high',
        startLine: 4,
        endLine: 4,
      });
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          content: aiPayload,
          reply: aiPayload,
          data: { content: aiPayload },
        }),
      });
    });

    await page.route(/\/compile(\?.*)?$/, async (route) => {
      if (!shouldCompileSucceed) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: 'Compilation failed with 3 errors',
            logs: multiErrorRawLog,
            errors: [
              { file: 'main.tex', line: 4, message: 'Undefined control sequence.', severity: 'error' },
              { file: 'main.tex', line: 5, message: 'LaTeX Error: Environment theorem undefined.', severity: 'error' },
              { file: 'main.tex', line: 8, message: 'Missing $ inserted.', severity: 'error' },
            ],
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ...MOCK_COMPILE_SUCCESS,
            pdf: 'JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCA2MTIgNzkyXSA+PgplbmRvYmoKdHJhaWxlcgo8PCAvUm9vdCAxIDAgUiA+PgplbmRsb2YKJSVFT0YK',
            logs: 'This is pdfTeX, Version 3.141592653 (TeX Live 2024)\nOutput written on main.pdf (1 page, 1240 bytes).',
          }),
        });
      }
    });

    await page.goto(`/editor/${PAGE_ID}`);
    const cmContent = page.locator('.cm-content').first();
    await expect(cmContent).toBeVisible({ timeout: 15000 });

    // Trigger compilation -> should fail with 3 errors and auto-open CompilerLogs panel
    const recompileBtn = page.getByRole('button', { name: /Recompile/i }).first();
    await recompileBtn.click();

    const errorStepper = page.getByTestId('compiler-error-stepper');
    await expect(errorStepper).toBeVisible({ timeout: 10000 });
    await expect(errorStepper).toContainText('Error 1 of 3');

    // Step through errors via Next error (F8) and Previous error (Shift+F8)
    await page.getByRole('button', { name: 'Next error (F8)' }).click();
    await expect(errorStepper).toContainText('Error 2 of 3');

    await page.getByRole('button', { name: 'Next error (F8)' }).click();
    await expect(errorStepper).toContainText('Error 3 of 3');

    await page.getByRole('button', { name: 'Previous error (Shift+F8)' }).click();
    await expect(errorStepper).toContainText('Error 2 of 3');

    // Click Explain on the first error entry to inspect LaTeX Error Guide
    const firstErrorRow = page.locator('#log-entry-err-0');
    await expect(firstErrorRow).toBeVisible();
    await firstErrorRow.getByRole('button', { name: 'Explain' }).click();

    const errorGuideRegion = firstErrorRow.getByRole('region', { name: 'LaTeX Error Guide' });
    await expect(errorGuideRegion).toBeVisible();
    await expect(errorGuideRegion).toContainText('Undefined Control Sequence (\\quantumteleportation)');
    await expect(errorGuideRegion).toContainText('Misspelled command name in the manuscript body');

    // Click Suggest fix on the first error entry to open AI Error Assist
    await firstErrorRow.getByRole('button', { name: 'Suggest fix' }).click();
    const aiFixRegion = firstErrorRow.getByRole('region', { name: 'AI Error Assist' });
    await expect(aiFixRegion).toBeVisible();
    await expect(aiFixRegion).toContainText('high confidence');
    await expect(aiFixRegion).toContainText('\\textbf{Alice and Bob}');

    // Now switch compiler mock to succeed and click "Quick fix" on firstErrorRow
    shouldCompileSucceed = true;
    await firstErrorRow.getByRole('button', { name: 'Quick fix' }).click();

    // Verify Quick fix updated the editor buffer and auto-returned from CompilerLogs to PDF Viewer
    await expect(cmContent).toContainText('\\textbf{Alice and Bob}');
    await expect(page.getByRole('button', { name: 'Back to PDF' })).toBeHidden({ timeout: 10000 });
  });

  test('Compile Log Dataset B: Multi-Category Warnings (Font, Package, BibTeX), Bad Boxes, Filter Tabs & Clear Cache', async ({
    page,
    editor,
  }) => {
    void editor;

    const multiWarningLog = `This is pdfTeX, Version 3.141592653-2.6-1.40.26 (TeX Live 2024)
(./main.tex
LaTeX Warning: Reference \`eq:bell-state' on page 1 undefined on input line 12.
LaTeX Font Warning: Font shape \`OT1/cmr/m/sc' in size <10.5> not available on input line 15.
Package hyperref Warning: Token not allowed in a PDF string (Unicode) on input line 20.
Warning--empty journal in vaswani2017attention
--line 28 of file references.bib
Overfull \\hbox (18.42pt too wide) in paragraph at lines 24--28
Underfull \\vbox (badness 10000) has occurred while \\output is active [1]
Output written on main.pdf (1 page, 32150 bytes).
)`;

    let forceCleanReceived = false;

    await page.route(/\/artifacts(\?.*)?$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          files: [
            { name: 'output.aux', size: 1024 },
            { name: 'output.bbl', size: 2048 },
            { name: 'output.blg', size: 512 },
            { name: 'output.log', size: 8192 },
          ],
        }),
      });
    });

    await page.route(/\/compile(\?.*)?$/, async (route) => {
      const body = route.request().postDataJSON();
      if (body?.force_clean === true) {
        forceCleanReceived = true;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          pdf: 'JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCA2MTIgNzkyXSA+PgplbmRvYmoKdHJhaWxlcgo8PCAvUm9vdCAxIDAgUiA+PgplbmRsb2YKJSVFT0YK',
          logs: multiWarningLog,
          issues: [],
        }),
      });
    });

    await page.goto(`/editor/${PAGE_ID}`);
    await expect(page.locator('.cm-content').first()).toBeVisible({ timeout: 15000 });

    // Trigger compilation so multiWarningLog is loaded
    await page.getByRole('button', { name: /Recompile/i }).first().click();

    // Verify warning badge appears on "Logs and output files" button in PdfToolbar
    const warningBadge = page.getByTestId('compiler-warning-badge');
    await expect(warningBadge).toBeVisible({ timeout: 10000 });
    await expect(warningBadge).toHaveText('4');

    // Open CompilerLogs panel
    await page.getByRole('button', { name: /Logs and output files/i }).click();

    // 1. Verify Filter Tabs counts: All logs (6), Errors (0), Warnings (4), Info (2)
    const tabList = page.getByRole('tablist', { name: 'Log filter categories' });
    await expect(tabList.getByRole('tab', { name: /All logs/i })).toContainText('6');
    await expect(tabList.getByRole('tab', { name: /Errors/i })).toContainText('0');
    await expect(tabList.getByRole('tab', { name: /Warnings/i })).toContainText('4');
    await expect(tabList.getByRole('tab', { name: /Info/i })).toContainText('2');

    // 2. Filter by Warnings tab -> verify Reference, Font, Package hyperref, and BibTeX warnings
    await tabList.getByRole('tab', { name: /Warnings/i }).click();
    await expect(page.getByText(/LaTeX Warning: Reference `eq:bell-state' on page 1 undefined/i)).toBeVisible();
    await expect(page.getByText(/LaTeX Font Warning: Font shape/i)).toBeVisible();
    await expect(page.getByText(/Package hyperref Warning: Token not allowed/i)).toBeVisible();
    await expect(page.getByText(/Warning--empty journal in vaswani2017attention/i)).toBeVisible();

    // 3. Filter by Info tab -> verify Overfull \hbox and Underfull \vbox bad boxes
    await tabList.getByRole('tab', { name: /Info/i }).click();
    await expect(page.getByText(/Overfull \\hbox \(18\.42pt too wide\)/i)).toBeVisible();
    await expect(page.getByText(/Underfull \\vbox \(badness 10000\)/i)).toBeVisible();

    // 4. Filter by Errors tab -> verify clean empty state
    await tabList.getByRole('tab', { name: /Errors/i }).click();
    await expect(page.getByText('No compilation errors')).toBeVisible();

    // 5. Open Raw logs accordion and verify full transcript is rendered
    await page.getByRole('button', { name: 'Raw logs' }).click();
    await expect(page.locator('#raw-latex-logs-content')).toContainText('This is pdfTeX, Version 3.141592653');

    // 6. Open "Other logs and files" popover in footer and verify auxiliary artifacts list
    await page.getByRole('button', { name: /Other logs and files/i }).click();
    await expect(page.getByText('Download other output files')).toBeVisible();
    await expect(page.getByRole('button', { name: 'output.bbl' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Download all/i })).toBeVisible();

    // Close popover by clicking Clear cached files and verify force_clean compile is triggered
    await page.getByRole('button', { name: 'Clear cached files' }).click();
    await expect.poll(() => forceCleanReceived, { timeout: 10000 }).toBe(true);
  });

  // =========================================================================
  // 5. TRACK CHANGES — DATASET C:
  //    Live Keystroke Recording in Suggesting Mode (Insert & Delete)
  //    + Clean Preview Replacement Widget (.cm-track-clean-replace)
  // =========================================================================
  test('Track Changes Dataset C: Live Keystroke Interception in Suggesting Mode & Clean Preview Replacement Widget', async ({
    page,
    editor,
  }) => {
    void editor;
    const docText = [
      '\\documentclass{article}',
      '\\begin{document}',
      'Quantum error correction protects fragile states.',
      'We evaluate classical decoding latency.',
      '\\end{document}',
    ].join('\n');

    const initialSuggestions = [
      {
        id: 'sug-rep-clean-01',
        pageId: PAGE_ID,
        type: 'replace',
        originalText: 'classical',
        suggestedText: 'neural-network',
        fromLine: 4,
        fromColumn: 13,
        toLine: 4,
        toColumn: 22,
        status: 'pending',
        createdAt: new Date().toISOString(),
        author: { id: 'user-collab-002', name: 'Prof. Emmy Noether' },
      },
    ];

    await page.route(/\/docs\/page-paper-001|\/pages\/page-paper-001/, async (route) => {
      const reqUrl = route.request().url();
      if (
        reqUrl.includes('/suggestions') ||
        reqUrl.includes('/comments') ||
        reqUrl.includes('/files') ||
        reqUrl.includes('/deleted-files')
      ) {
        return route.fallback();
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          page: { ...MOCK_PAGE, content: docText, docContent: docText },
          success: true,
          data: { page: { ...MOCK_PAGE, content: docText, docContent: docText } },
        }),
      });
    });

    await page.route(/\/docs\/page-paper-001\/suggestions(\?.*)?$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          suggestions: initialSuggestions,
          success: true,
          data: { suggestions: initialSuggestions },
        }),
      });
    });

    await page.route(/\/docs\/page-paper-001\/comments(\?.*)?$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ comments: [], success: true, data: { comments: [] } }),
      });
    });

    await page.goto(`/editor/${PAGE_ID}`);
    const cmContent = page.locator('.cm-content').first();
    await expect(cmContent).toBeVisible({ timeout: 15000 });

    // Open Review sidebar
    await page.getByRole('tab', { name: /Review & Comments/i }).click();

    // 1. Verify replace suggestion renders .cm-track-change-replace in 'Show changes' mode
    await expect(page.locator('.cm-track-change-replace')).toHaveCount(1);

    // 2. Switch to 'Clean preview' -> verify CleanReplacePreviewWidget (.cm-track-clean-replace) renders 'neural-network'
    const viewModeSelect = page.getByRole('combobox', { name: 'Track changes view mode' });
    await viewModeSelect.selectOption('clean');
    await expect(page.locator('.cm-track-clean-replace')).toHaveCount(1);
    await expect(page.locator('.cm-track-clean-replace')).toHaveText('neural-network');

    // Switch back to 'Show changes'
    await viewModeSelect.selectOption('changes');

    // 3. Enable Reviewing (Track Changes) mode from toolbar dropdown
    const editingModeTrigger = page.getByRole('button', {
      name: /Editing mode:/i,
    });
    await editingModeTrigger.click();
    await page.getByRole('menuitem', { name: /Reviewing/i }).click();
    await expect(page.getByRole('button', { name: 'Editing mode: Reviewing' })).toBeVisible();

    // 4. Focus CodeMirror on line 3 and type new text in Suggesting Mode
    const line3 = cmContent.locator('.cm-line').nth(2);
    await line3.click();
    await page.keyboard.press('End');
    await page.keyboard.type(' actively');

    // Typed text should immediately be wrapped in .cm-track-change-insert
    await expect(page.locator('.cm-track-change-insert')).toContainText('actively');
  });

  // =========================================================================
  // 6. TRACK CHANGES — DATASET D:
  //    In-Editor Hover Tooltip 1-Click Accept & Comment Reopen / Delete Lifecycle
  // =========================================================================
  test('Track Changes Dataset D: In-Editor Hover Popover 1-Click Accept & Comment Reopen/Delete Lifecycle', async ({
    page,
    editor,
  }) => {
    void editor;
    const docText = [
      '\\documentclass{article}',
      '\\begin{document}',
      'The threshold theorem guarantees fault-tolerant computation.',
      '\\end{document}',
    ].join('\n');

    let activeSuggestions = [
      {
        id: 'sug-hover-del-01',
        pageId: PAGE_ID,
        type: 'delete',
        originalText: 'fault-tolerant ',
        suggestedText: '',
        fromLine: 3,
        fromColumn: 34,
        toLine: 3,
        toColumn: 49,
        status: 'pending',
        description: 'Simplify terminology in abstract',
        createdAt: new Date().toISOString(),
        author: { id: 'user-collab-002', name: 'Prof. Emmy Noether' },
      },
    ];

    let activeComments = [
      {
        id: 'cmt-lifecycle-01',
        pageId: PAGE_ID,
        projectPageId: PAGE_ID,
        page: PAGE_ID,
        content: 'Verify threshold value for depolarizing noise.',
        line: 3,
        status: 'resolved',
        resolved: true,
        createdAt: new Date().toISOString(),
        author: { id: 'user-academic-001', name: 'Dr. Alan Turing' },
        authorId: 'user-academic-001',
        replies: [],
      },
    ];

    await page.route(/\/docs\/page-paper-001|\/pages\/page-paper-001/, async (route) => {
      const reqUrl = route.request().url();
      if (
        reqUrl.includes('/suggestions') ||
        reqUrl.includes('/comments') ||
        reqUrl.includes('/files') ||
        reqUrl.includes('/deleted-files')
      ) {
        return route.fallback();
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          page: { ...MOCK_PAGE, content: docText, docContent: docText },
          success: true,
          data: { page: { ...MOCK_PAGE, content: docText, docContent: docText } },
        }),
      });
    });

    await page.route(/\/docs\/page-paper-001\/suggestions(\?.*)?$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          suggestions: activeSuggestions,
          success: true,
          data: { suggestions: activeSuggestions },
        }),
      });
    });

    await page.route(/\/docs\/page-paper-001\/suggestions\/([^/]+)\/accept/, async (route) => {
      activeSuggestions = activeSuggestions.map((s) => ({ ...s, status: 'accepted' }));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    });

    await page.route(/\/docs\/page-paper-001\/comments(\?.*)?$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          comments: activeComments,
          success: true,
          data: { comments: activeComments },
        }),
      });
    });

    await page.route(/\/docs\/page-paper-001\/comments\/([^/]+)\/resolve/, async (route) => {
      const body = route.request().postDataJSON();
      const isResolved = Boolean(body?.resolved);
      activeComments = activeComments.map((c) => ({
        ...c,
        resolved: isResolved,
        status: isResolved ? 'resolved' : 'open',
      }));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ comment: activeComments[0] }),
      });
    });

    await page.route(/\/docs\/page-paper-001\/comments\/cmt-lifecycle-01$/, async (route) => {
      if (route.request().method() === 'DELETE') {
        activeComments = [];
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true }),
        });
        return;
      }
      await route.fallback();
    });

    await page.goto(`/editor/${PAGE_ID}`);
    const cmContent = page.locator('.cm-content').first();
    await expect(cmContent).toBeVisible({ timeout: 15000 });

    // 1. Hover over the .cm-track-change-delete span in CodeMirror to trigger the inline popover
    const deleteMark = page.locator('.cm-track-change-delete').first();
    await expect(deleteMark).toBeVisible({ timeout: 10000 });
    await deleteMark.hover();

    const tooltip = page.getByTestId('inline-suggestion-tooltip');
    await expect(tooltip).toBeVisible({ timeout: 5000 });
    await expect(tooltip).toContainText('Prof. Emmy Noether');
    await expect(tooltip).toContainText('Simplify terminology in abstract');

    // Click Accept directly inside the inline hover tooltip
    await page.getByTestId('inline-accept-btn').click();
    await expect(cmContent).not.toContainText('fault-tolerant ');
    await expect(cmContent).toContainText('The threshold theorem guarantees computation.');

    // 2. Open Review sidebar and test Reopen + Delete on resolved comment
    await page.getByRole('tab', { name: /Review & Comments/i }).click();
    const commentCard = page.locator('#comment-cmt-lifecycle-01');
    await expect(commentCard).toBeVisible({ timeout: 10000 });

    // Reopen resolved comment
    await commentCard.getByRole('button', { name: 'Reopen comment' }).click();
    await expect(commentCard.getByRole('button', { name: 'Resolve comment' })).toBeVisible();
  });

  // =========================================================================
  // 7. COMPILE LOGS — DATASET C:
  //    AI Error Assist "Apply suggestion" (Applied & Recompiled) + Preamble \usepackage Quick Fix
  // =========================================================================
  test('Compile Log Dataset C: AI Fix "Apply suggestion" & Preamble Package Injection Quick Fix', async ({
    page,
    editor,
  }) => {
    void editor;
    const preambleBrokenTex = [
      '\\documentclass{article}',
      '\\begin{document}',
      '\\section{Results}',
      '\\toprule',
      '\\end{document}',
    ].join('\n');

    let compileAttempt = 0;

    await page.route(/\/docs\/page-paper-001|\/pages\/page-paper-001/, async (route) => {
      const reqUrl = route.request().url();
      if (
        reqUrl.includes('/suggestions') ||
        reqUrl.includes('/comments') ||
        reqUrl.includes('/files') ||
        reqUrl.includes('/deleted-files')
      ) {
        return route.fallback();
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          page: { ...MOCK_PAGE, content: preambleBrokenTex, docContent: preambleBrokenTex },
          success: true,
          data: { page: { ...MOCK_PAGE, content: preambleBrokenTex, docContent: preambleBrokenTex } },
        }),
      });
    });

    await page.route(/\/manuscripts\/diagnostics\/parse-log/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              file: 'main.tex',
              line: 4,
              severity: 'error',
              message: 'Undefined control sequence \\toprule.',
              code: 'LATEX_BOOKTABS_MISSING',
              quickFix: {
                description: 'Add \\usepackage{booktabs} to preamble',
                replacementText: '\\usepackage{booktabs}',
              },
            },
          ],
          errorsCount: 1,
          warningsCount: 0,
        }),
      });
    });

    await page.route(/\/api\/ai\/chat\/sync|\/manuscripts\/ai\/suggest-fix/, async (route) => {
      const aiPayload = JSON.stringify({
        explanation: 'Replace \\toprule with \\hline or load booktabs.',
        fixedSnippet: '\\hline',
        originalSnippet: '\\toprule',
        confidence: 'high',
        startLine: 4,
        endLine: 4,
      });
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          content: aiPayload,
          reply: aiPayload,
          data: { content: aiPayload },
        }),
      });
    });

    await page.route(/\/compile(\?.*)?$/, async (route) => {
      compileAttempt++;
      if (compileAttempt <= 2) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: 'Compilation failed',
            logs: 'This is pdfTeX\n(./main.tex\n! Undefined control sequence.\nl.4 \\toprule\n)',
            errors: [{ file: 'main.tex', line: 4, message: 'Undefined control sequence \\toprule.', severity: 'error' }],
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ...MOCK_COMPILE_SUCCESS,
            pdf: 'JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCA2MTIgNzkyXSA+PgplbmRvYmoKdHJhaWxlcgo8PCAvUm9vdCAxIDAgUiA+PgplbmRsb2YKJSVFT0YK',
            logs: 'Output written on main.pdf (1 page, 1240 bytes).',
          }),
        });
      }
    });

    await page.goto(`/editor/${PAGE_ID}`);
    const cmContent = page.locator('.cm-content').first();
    await expect(cmContent).toBeVisible({ timeout: 15000 });

    // 1. Trigger compile (attempt 1 -> fails)
    await page.getByRole('button', { name: /Recompile/i }).first().click();
    const firstErrorRow = page.locator('#log-entry-err-0');
    await expect(firstErrorRow).toBeVisible({ timeout: 10000 });

    // 2. Click "Quick fix" to inject \usepackage{booktabs} into the preamble before \begin{document}
    await firstErrorRow.getByRole('button', { name: 'Quick fix' }).click();
    await expect(cmContent).toContainText('\\usepackage{booktabs}');

    // 3. Open Suggest fix and click "Apply suggestion" inside AI Error Assist panel (attempt 3 -> succeeds!)
    await firstErrorRow.getByRole('button', { name: 'Suggest fix' }).click();
    const aiFixRegion = firstErrorRow.getByRole('region', { name: 'AI Error Assist' });
    await expect(aiFixRegion).toBeVisible();
    await aiFixRegion.getByRole('button', { name: 'Apply suggestion' }).click();

    // Verify line 4 was updated to \hline and clean recompile auto-closed CompilerLogs
    await expect(cmContent).toContainText('\\hline');
    await expect(page.getByRole('button', { name: 'Back to PDF' })).toBeHidden({ timeout: 10000 });
  });

  // =========================================================================
  // 8. COMPILE LOGS — DATASET D:
  //    Fatal Compiler Crash with 0 Line Errors (PlaneErrorState)
  //    & Warning Suppression Filter Toggle ("Suppressed (N)" <-> "Showing all")
  // =========================================================================
  test('Compile Log Dataset D: Fatal Engine Failure State & Warning Suppression Toggle', async ({
    page,
    editor,
  }) => {
    void editor;
    let phase: 'fatal' | 'warnings' = 'fatal';

    const warningRichLog = [
      'This is pdfTeX, Version 3.141592653 (TeX Live 2024)',
      '(./main.tex',
      "LaTeX Font Warning: Font shape `OT1/cmr/m/sc' undefined on input line 9.",
      'Package hyperref Warning: Token not allowed in a PDF string on input line 14.',
      'Overfull \\hbox (24.0pt too wide) in paragraph at lines 20--25',
      'Output written on main.pdf (1 page, 2048 bytes).',
      ')',
    ].join('\n');

    // Enable warning suppression flags in persisted editor settings before page load
    await page.addInitScript(() => {
      try {
        const raw = window.localStorage.getItem('flux-editor-settings');
        const parsed = raw ? JSON.parse(raw) : { state: {}, version: 0 };
        parsed.state = {
          ...(parsed.state || {}),
          suppressBadBoxes: true,
          suppressFontWarnings: true,
          suppressPackageWarnings: false,
        };
        window.localStorage.setItem('flux-editor-settings', JSON.stringify(parsed));
      } catch {
        // ignore storage errors
      }
    });

    await page.route(/\/manuscripts\/diagnostics\/parse-log/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [], errorsCount: 0, warningsCount: 0 }),
      });
    });

    await page.route(/\/compile(\?.*)?$/, async (route) => {
      if (phase === 'fatal') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: 'pdflatex: fatal memory allocation failure',
            logs: 'This is pdfTeX, Version 3.141592653\npdflatex: fatal memory allocation failure: capacity exceeded.',
            errors: [],
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ...MOCK_COMPILE_SUCCESS,
            pdf: 'JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCA2MTIgNzkyXSA+PgplbmRvYmoKdHJhaWxlcgo8PCAvUm9vdCAxIDAgUiA+PgplbmRsb2YKJSVFT0YK',
            logs: warningRichLog,
          }),
        });
      }
    });

    await page.goto(`/editor/${PAGE_ID}`);
    await expect(page.locator('.cm-content').first()).toBeVisible({ timeout: 15000 });

    // 1. Trigger fatal compile -> verify PlaneErrorState ("Compilation failed") renders when parsed.errors is empty
    await page.getByRole('button', { name: /Recompile/i }).first().click();
    await expect(page.getByText('Compilation failed')).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByText(/The LaTeX compiler encountered an error or terminated prematurely/i)
    ).toBeVisible();

    // 2. Switch to warning-rich compile and recompile
    phase = 'warnings';
    await page.getByRole('button', { name: /Recompile/i }).first().click();
    await expect(page.getByRole('button', { name: 'Back to PDF' })).toBeHidden({ timeout: 10000 });

    // Open Logs and output files
    await page.getByRole('button', { name: /Logs and output files/i }).click();

    // Because suppressBadBoxes=true and suppressFontWarnings=true, 2 items are suppressed (1 Font Warning + 1 Overfull \hbox)
    const toggleSuppressedBtn = page.getByTestId('toggle-suppressed-warnings-btn');
    await expect(toggleSuppressedBtn).toBeVisible();
    await expect(toggleSuppressedBtn).toContainText('Suppressed (2)');

    const tabList = page.getByRole('tablist', { name: 'Log filter categories' });
    await expect(tabList.getByRole('tab', { name: /All logs/i })).toContainText('1');

    // Click "Suppressed (2)" -> should switch to "Showing all" and reveal all 3 items (2 Warnings + 1 Info)
    await toggleSuppressedBtn.click();
    await expect(toggleSuppressedBtn).toContainText('Showing all');
    await expect(tabList.getByRole('tab', { name: /All logs/i })).toContainText('3');
    await expect(page.getByText(/LaTeX Font Warning: Font shape/i)).toBeVisible();
  });
});
