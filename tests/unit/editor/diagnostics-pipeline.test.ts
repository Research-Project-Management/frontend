// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

import {
  runLocalLatexSyntaxLinter,
  hasHardSyntaxErrors,
} from '@/features/editor/subsystems/diagnostics/model/local-latex-linter';
import { diagnosticsCoordinator } from '@/features/editor/subsystems/diagnostics/coordinator/diagnostics.coordinator';
import {
  compilerDiagnosticsField,
  createDiagnosticsGutter,
  setCompilerDiagnosticsEffect,
  clearCompilerDiagnosticsEffect,
} from '@/features/editor/subsystems/diagnostics/extensions/diagnostics-gutter';
import {
  ErrorLensWidget,
  createLatexErrorLensExtension,
  setErrorLensDiagnosticsEffect,
} from '@/features/editor/subsystems/diagnostics/extensions/latex-error-lens';
import {
  useCompileStore,
  selectFilteredCompileDiagnostics,
} from '@/features/editor/subsystems/compiler/coordinator/compiler.store';
import { compilerCoordinator } from '@/features/editor/subsystems/compiler/coordinator/compiler.coordinator';
import { CompileOutcomeCard } from '@/features/editor/subsystems/compiler/ui/logs/CompileOutcomeCard';
import { CompilationErrorBanner } from '@/features/editor/subsystems/compiler/ui/CompilationErrorBanner';
import { resolveProjectFileByLogPath } from '@/features/editor/subsystems/compiler/ui/hooks/useLogViewerActions';
import { usePageStore } from '@/features/editor/core/store/editor.store';
import { useSettingsStore } from '@/features/editor/core/store/settings.store';
import { useConnectivityStore } from '@/features/editor/core/store/connectivity.store';
import { editorCommandBus } from '@/features/editor/core/bus/command-bus';
import type { CompileReport } from '@/features/editor/domain/types/compiler.types';

describe('Editor Diagnostics Pipeline, Outcome UI & CodeMirror Bridge', () => {
  beforeEach(() => {
    cleanup();
    document.body.innerHTML = '';
    diagnosticsCoordinator.clear();
    useCompileStore.getState().resetCompiler();
    useSettingsStore.setState({
      stopOnValidationError: true,
      stopOnFirstError: true,
      suppressBadBoxes: true,
      suppressFontWarnings: true,
      suppressPackageWarnings: false,
      customSuppressedWarnings: [],
    });
    useConnectivityStore.setState({ isOnline: true });
  });

  afterEach(() => {
    cleanup();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  describe('Local-First Synchronous LaTeX Linter & Auto-Compile Guard', () => {
    it('detects hard syntax errors synchronously while respecting comments, verbatim, novalidate, \\iffalse, and \\newcommand', () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      const brokenDoc = [
        '\\documentclass{article}',
        '\\newcommand{\\wrap}[1]{\\begin{center}#1}',
        '\\begin{document}',
        '% comment with unclosed { and \\begin{itemize}',
        '\\begin{verbatim}',
        'unclosed { inside verbatim',
        '\\end{verbatim}',
        '\\verb|{| inline verb is safe',
        '\\iffalse',
        '\\begin{equation}',
        '\\fi',
        '%begin novalidate',
        '\\bad{',
        '%end novalidate',
        '\\begin{itemize}',
        '\\item Missing closing environment below',
        'Text with {unclosed brace',
        '\\end{document}',
      ].join('\n');

      const diags = runLocalLatexSyntaxLinter(brokenDoc, { filePath: 'main.tex' });
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(hasHardSyntaxErrors(diags)).toBe(true);
      expect(diags.some((d) => d.code === 'ENVIRONMENT_MISMATCH')).toBe(true);
      expect(diags.some((d) => d.code === 'UNBALANCED_BRACES')).toBe(true);
      // Verbatim content must not create false positives, and %novalidate disables whole-file linting
      expect(diags.some((d) => d.message.includes('verbatim'))).toBe(false);
      expect(
        runLocalLatexSyntaxLinter(`%novalidate\n${brokenDoc}`, { filePath: 'main.tex' }),
      ).toEqual([]);
    });

    it('blocks auto-compile with code-check-blocked on hard syntax errors, while manual compile bypasses the guard', async () => {
      usePageStore.setState({
        projectId: 'proj-c3',
        currentPage: { id: 'page-c3', title: 'main.tex' } as never,
        activeFilePage: { id: 'file-c3', title: 'main.tex', path: 'main.tex' } as never,
      });

      diagnosticsCoordinator.ingestLinterDiagnostics('main.tex', [
        {
          id: 'lint-1',
          file: 'main.tex',
          line: 4,
          column: 1,
          severity: 'error',
          code: 'UNBALANCED_BRACES',
          message: 'Unclosed `{`.',
          source: 'LaTeX Linter',
        },
      ]);

      const compileSpy = vi
        .spyOn(
          (compilerCoordinator as unknown as {
            compilerEngine: { compile: (...args: unknown[]) => Promise<unknown> };
          }).compilerEngine,
          'compile',
        )
        .mockResolvedValue({
          success: true,
          outcome: 'success',
          pdfUrl: null,
          diagnostics: [],
          log: '',
        });

      // Auto-compile MUST be blocked locally without calling compilerEngine.compile
      const autoOk = await compilerCoordinator.compile({ reason: 'auto' });
      expect(autoOk).toBe(false);
      expect(compileSpy).not.toHaveBeenCalled();
      expect(useCompileStore.getState().compileOutcome).toBe('code-check-blocked');

      // Manual compile MUST bypass the local code-check guard
      await compilerCoordinator.compile({ reason: 'manual' });
      expect(compileSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Atomic CompileReport Store & Shared Selector Parity', () => {
    it('updates compilePhase/compileOutcome/compileReport atomically and preserves last good pdfUrl on failure', () => {
      const store = useCompileStore.getState();
      store.setPdfUrl('blob:http://localhost/good-prev.pdf');

      const failedReport: CompileReport = {
        outcome: 'stopped-on-first-error',
        errorMessage: 'Undefined control sequence',
        diagnostics: [
          {
            file: 'main.tex',
            line: 12,
            severity: 'error',
            category: 'error',
            source: 'tex',
            highlightCommand: '\\badcmd',
            message: 'Undefined control sequence \\badcmd',
            code: 'UNDEFINED_CONTROL_SEQUENCE',
          },
          {
            file: 'main.tex',
            line: 15,
            severity: 'warning',
            category: 'warning',
            source: 'tex',
            message: 'LaTeX Warning: Reference `sec:a` on page 1 undefined on input line 15',
          },
          {
            file: 'main.tex',
            line: 20,
            severity: 'warning',
            category: 'warning',
            source: 'tex',
            message: 'Package hyperref Warning: Token not allowed in a PDF string',
          },
          {
            file: 'main.tex',
            line: 25,
            severity: 'badbox',
            category: 'badbox',
            warningSubtype: 'badbox',
            source: 'tex',
            message: 'Overfull \\hbox (4.2pt too wide) at line 25',
          },
        ],
        summary: {
          totalErrors: 1,
          totalWarnings: 1,
          totalBadboxes: 1,
          suppressedCascadeCount: 1,
          truncated: false,
        },
        validationIssues: [],
        logText: '! Undefined control sequence.\nl.12 \\badcmd',
        logMeta: { sizeBytes: 120, truncated: false },
        compiledAt: new Date(),
        mainFile: 'main.tex',
      };

      store.applyCompileResult(failedReport);

      const next = useCompileStore.getState();
      expect(next.compilePhase).toBe('done');
      expect(next.compileOutcome).toBe('stopped-on-first-error');
      expect(next.compileStatus).toBe('error');
      expect(next.pdfUrl).toBe('blob:http://localhost/good-prev.pdf');
      expect(next.compileReport?.summary.suppressedCascadeCount).toBe(1);

      const filteredToolbar = selectFilteredCompileDiagnostics(next.compileReport, {
        suppressBadBoxes: true,
        suppressFontWarnings: true,
        suppressPackageWarnings: false,
        customPatterns: [],
        stopOnFirstError: true,
        applyFilter: true,
      });
      const filteredLogs = selectFilteredCompileDiagnostics(next.compileReport, {
        suppressBadBoxes: true,
        suppressFontWarnings: true,
        suppressPackageWarnings: false,
        customPatterns: [],
        stopOnFirstError: true,
        applyFilter: true,
      });

      expect(filteredToolbar).toEqual(filteredLogs);
      expect(filteredToolbar.errors).toHaveLength(1);
      // Transient Reference undefined warning suppressed under stopOnFirstError, hyperref kept
      expect(filteredToolbar.warnings).toHaveLength(1);
      // Bad box suppressed, reflected in suppressedCount
      expect(filteredToolbar.badBoxes).toHaveLength(0);
      expect(filteredToolbar.suppressedCount).toBe(1);
    });
  });

  describe('Outcome Cards, Contextual Banners & Cross-File QuickFix Routing', () => {
    it('renders CompileOutcomeCard for timedout, validation-problems, and stopped-on-first-error', () => {
      const { rerender } = render(
        React.createElement(CompileOutcomeCard, {
          outcome: 'timedout',
          errorCount: 0,
          onCompile: vi.fn(),
          onClearCacheAndCompile: vi.fn(),
        }),
      );
      expect(screen.getByTestId('compile-outcome-card').getAttribute('data-outcome')).toBe('timedout');
      expect(screen.getByText(/compilation timed out/i)).toBeTruthy();

      rerender(
        React.createElement(CompileOutcomeCard, {
          outcome: 'validation-problems',
          errorCount: 0,
          validationIssues: [
            {
              code: 'mainFile',
              mainFile: 'main.tex',
              availableTexFiles: ['paper.tex'],
              message: 'Main TeX document "main.tex" is missing or empty.',
            },
          ],
        }),
      );
      expect(screen.getByText(/pre-compile project validation issues/i)).toBeTruthy();
      expect(screen.getByText(/\[mainFile\]/)).toBeTruthy();

      rerender(
        React.createElement(CompileOutcomeCard, {
          outcome: 'stopped-on-first-error',
          errorCount: 1,
          summary: {
            totalErrors: 1,
            totalWarnings: 0,
            totalBadboxes: 0,
            suppressedCascadeCount: 2,
            truncated: true,
          },
        }),
      );
      expect(screen.getByText(/stopped on first fatal error/i)).toBeTruthy();
      expect(screen.getByText(/2 cascading follow-up diagnostics suppressed/i)).toBeTruthy();
      expect(screen.getByText(/diagnostics list capped/i)).toBeTruthy();
    });

    it('renders CompilationErrorBanner for clsi-unavailable, code-check-blocked, offline-queued, and batch-errors', () => {
      const onJump = vi.fn();
      const onCompileAnyway = vi.fn();
      const { rerender } = render(
        React.createElement(CompilationErrorBanner, {
          errorCount: 0,
          outcome: 'clsi-unavailable',
          onJumpToFirstError: onJump,
          onRetry: vi.fn(),
        }),
      );
      expect(screen.getByTestId('compilation-error-banner').getAttribute('data-banner-mode')).toBe(
        'clsi-unavailable',
      );

      rerender(
        React.createElement(CompilationErrorBanner, {
          errorCount: 1,
          outcome: 'code-check-blocked',
          onJumpToFirstError: onJump,
          onCompileAnyway,
        }),
      );
      fireEvent.click(screen.getByText(/compile anyway/i));
      expect(onCompileAnyway).toHaveBeenCalledTimes(1);

      rerender(
        React.createElement(CompilationErrorBanner, {
          errorCount: 0,
          outcome: 'offline-queued',
          onJumpToFirstError: onJump,
        }),
      );
      expect(screen.getByTestId('compilation-error-banner').getAttribute('data-banner-mode')).toBe(
        'offline-queued',
      );
    });

    it('resolves project files for preamble/mainFile and nested child paths cleanly', () => {
      const files = [
        { id: 'f-main', title: 'main.tex', path: 'main.tex' },
        { id: 'f-sec1', title: 'intro.tex', path: 'sections/intro.tex' },
        { id: 'f-bib', title: 'refs.bib', path: 'bib/refs.bib' },
      ];

      expect(resolveProjectFileByLogPath(undefined, 'main.tex', files)?.id).toBe('f-main');
      expect(resolveProjectFileByLogPath('./sections/intro.tex', 'main.tex', files)?.id).toBe(
        'f-sec1',
      );
      expect(resolveProjectFileByLogPath('refs.bib', 'main.tex', files)?.id).toBe('f-bib');
    });
  });

  describe('Push-Based Compiler Gutter, Highlight Token, ChangeSet Remap & Stale State', () => {
    it('pushes diagnostics via StateEffect, highlights exact command, handles empty lines safely, and marks edited lines stale', () => {
      const docText = '\\documentclass{article}\n\n\\begin{document}\n\\badmacro{x}\n\\end{document}';
      const state = EditorState.create({
        doc: docText,
        extensions: [
          createDiagnosticsGutter({ filePath: 'main.tex', getDiagnostics: () => [] }),
        ],
      });

      const nextState = state.update({
        effects: setCompilerDiagnosticsEffect.of([
          {
            id: 'c-1',
            file: 'main.tex',
            line: 2, // empty line must never throw Decoration.mark empty range error
            severity: 'warning',
            message: 'Warning on empty line',
            source: 'tex',
          },
          {
            id: 'c-2',
            file: 'main.tex',
            line: 4,
            severity: 'error',
            highlightCommand: '\\badmacro',
            message: 'Undefined control sequence \\badmacro',
            source: 'tex',
          },
        ]),
      }).state;

      const fieldVal = nextState.field(compilerDiagnosticsField);
      expect(fieldVal.items).toHaveLength(2);

      // Exact span for \badmacro
      const line4 = nextState.doc.line(4);
      const expectedFrom = line4.from + line4.text.indexOf('\\badmacro');
      expect(fieldVal.items[1].from).toBe(expectedFrom);
      expect(fieldVal.items[1].to).toBe(expectedFrom + '\\badmacro'.length);

      // Insert 2 blank lines above line 4 -> error remaps to line 6 without stale
      const afterInsertAbove = nextState.update({
        changes: { from: 0, to: 0, insert: '% line 1\n% line 2\n' },
      }).state;
      const mappedField = afterInsertAbove.field(compilerDiagnosticsField);
      expect(mappedField.items[1].item.line).toBe(6);
      expect(mappedField.items[1].item.stale).toBe(false);

      // Edit directly inside line 6 -> marks stale: true
      const editLine6Pos = afterInsertAbove.doc.line(6).from + 1;
      const afterEditErrLine = afterInsertAbove.update({
        changes: { from: editLine6Pos, to: editLine6Pos, insert: 'y' },
      }).state;
      expect(afterEditErrLine.field(compilerDiagnosticsField).items[1].item.stale).toBe(true);

      // clearCompilerDiagnosticsEffect empties field
      const cleared = afterEditErrLine.update({
        effects: clearCompilerDiagnosticsEffect.of(),
      }).state;
      expect(cleared.field(compilerDiagnosticsField).items).toHaveLength(0);
    });

    it('renders stale indicator and resolves live line via ErrorLensWidget.toDOM(view)', () => {
      const dispatchSpy = vi.spyOn(editorCommandBus, 'dispatch');
      const container = document.createElement('div');
      document.body.appendChild(container);

      const view = new EditorView({
        doc: 'line 1\nline 2\n\\badmacro\nline 4',
        extensions: [createLatexErrorLensExtension('main.tex')],
        parent: container,
      });

      view.dispatch({
        effects: setErrorLensDiagnosticsEffect.of({
          filePath: 'main.tex',
          diagnostics: [
            {
              id: 'lens-1',
              file: 'main.tex',
              line: 3,
              severity: 'error',
              message: 'Undefined control sequence',
              stale: true,
              source: 'tex',
            },
          ],
        }),
      });

      const lensEl = view.dom.querySelector('.cm-error-lens') as HTMLElement | null;
      expect(lensEl).not.toBeNull();
      expect(lensEl?.classList.contains('cm-error-lens-stale')).toBe(true);

      // Insert two lines above line 3 so the line moves down to line 5
      view.dispatch({
        changes: { from: 0, to: 0, insert: 'a\nb\n' },
      });

      // Mock posAtDOM to simulate CM6 live position lookup in jsdom
      vi.spyOn(view, 'posAtDOM').mockReturnValue(view.state.doc.line(5).from);

      const fixBtn = view.dom.querySelector('[data-testid="error-lens-fix-btn"]') as HTMLButtonElement | null;
      expect(fixBtn).not.toBeNull();
      fireEvent.click(fixBtn!);

      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ai:autofix-diagnostic',
          diagnostic: expect.objectContaining({ line: 5 }),
        }),
      );

      // Verify standalone widget call without view falls back cleanly
      const standalone = new ErrorLensWidget(
        {
          id: 'lens-2',
          file: 'main.tex',
          line: 9,
          severity: 'error',
          message: 'Fallback line test',
        },
        'main.tex',
      );
      const dom = standalone.toDOM();
      expect(dom.getAttribute('data-line')).toBe('9');

      view.destroy();
    });
  });
});
