/**
 * editor-error-lens-gutter.test.ts
 *
 * Unit test suite for LaTeX Error Lens, Diagnostic Gutter, and F8 Stepping Parity.
 * Location: `frontend/tests/unit/editor/editor-error-lens-gutter.test.ts`
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import {
  createLatexErrorLensExtension,
  setErrorLensDiagnosticsEffect,
  clearErrorLensDiagnosticsEffect,
  errorLensField,
  ErrorLensWidget,
} from '@/features/editor/engines/extensions/latex-error-lens';
import {
  createCodeMirrorPreset,
  reconfigureErrorLens,
  editorCompartments,
} from '@/features/editor/engines/codemirror/codemirror-preset';
import { diagnosticsCoordinator } from '@/features/editor/coordinators/diagnostics.coordinator';
import { navigationCoordinator } from '@/features/editor/coordinators/navigation.coordinator';
import { editorCommandBus, setActiveEditorEngine } from '@/features/editor/coordinators/command-bus';
import { useSettingsStore } from '@/features/editor/store/settings.store';
import { usePageStore } from '@/features/editor/store/editor.store';
import type { CompileError } from '@/features/editor/domain/types/compiler.types';

describe('LaTeX Error Lens & Diagnostic Gutter Parity', () => {
  beforeEach(() => {
    diagnosticsCoordinator.clear();
    navigationCoordinator.resetDiagnosticState();
    useSettingsStore.setState({ errorLensEnabled: true });
    setActiveEditorEngine(null);
  });

  describe('1. ErrorLensWidget DOM & Interactive Actions', () => {
    it('creates correct DOM structure, severity classes and cleans LaTeX prefixes', () => {
      const widget = new ErrorLensWidget(
        {
          id: 'test-1',
          file: 'main.tex',
          line: 12,
          message: 'LaTeX Error: Undefined control sequence \\testmacro',
          severity: 'error',
          context: 'l.12 \\testmacro',
        },
        'main.tex'
      );

      const dom = widget.toDOM();

      expect(dom.classList.contains('cm-error-lens')).toBe(true);
      expect(dom.classList.contains('cm-error-lens-error')).toBe(true);
      expect(dom.getAttribute('data-line')).toBe('12');
      expect(dom.getAttribute('data-severity')).toBe('error');

      const msgSpan = dom.querySelector('.cm-error-lens-msg');
      expect(msgSpan?.textContent).toBe('Undefined control sequence \\testmacro');
    });

    it('cleans "Error on line N:" prefix for warnings and info diagnostics', () => {
      const widget = new ErrorLensWidget(
        {
          id: 'test-warn',
          file: 'main.tex',
          line: 5,
          message: 'Error on line 5: Overfull \\hbox (10.0pt too wide)',
          severity: 'warning',
        },
        'main.tex'
      );

      const dom = widget.toDOM();
      expect(dom.classList.contains('cm-error-lens-warning')).toBe(true);
      const msgSpan = dom.querySelector('.cm-error-lens-msg');
      expect(msgSpan?.textContent).toBe('Overfull \\hbox (10.0pt too wide)');
    });

    it('dispatches "ai:autofix-diagnostic" when clicking "Fix with AI"', () => {
      const dispatched: any[] = [];
      const unsub = editorCommandBus.subscribe('ai:autofix-diagnostic', (cmd) => {
        dispatched.push(cmd);
      });

      const diag = {
        id: 'fix-diag-1',
        file: 'main.tex',
        line: 18,
        message: 'Missing $ inserted',
        severity: 'error' as const,
      };

      const widget = new ErrorLensWidget(diag, 'main.tex');
      const dom = widget.toDOM();

      const fixBtn = dom.querySelector('button[data-testid="error-lens-fix-btn"]') as HTMLButtonElement;
      expect(fixBtn).toBeDefined();

      fixBtn.click();

      expect(dispatched).toHaveLength(1);
      expect(dispatched[0].diagnostic.id).toBe('fix-diag-1');
      expect(dispatched[0].diagnostic.line).toBe(18);

      unsub();
    });

    it('dispatches "editor:suggest-fix" when clicking "Ask AI" in sidebar', () => {
      const dispatched: any[] = [];
      const unsub = editorCommandBus.subscribe('editor:suggest-fix', (cmd) => {
        dispatched.push(cmd);
      });

      const diag = {
        id: 'ask-diag-1',
        file: 'chapters/intro.tex',
        line: 42,
        message: 'Undefined control sequence \\citep',
        context: 'l.42 \\citep{key}',
        severity: 'error' as const,
      };

      const widget = new ErrorLensWidget(diag, 'chapters/intro.tex');
      const dom = widget.toDOM();

      const askBtn = dom.querySelector('button[data-testid="error-lens-ask-btn"]') as HTMLButtonElement;
      expect(askBtn).toBeDefined();

      askBtn.click();

      expect(dispatched).toHaveLength(1);
      expect(dispatched[0].error.line).toBe(42);
      expect(dispatched[0].error.file).toBe('chapters/intro.tex');
      expect(dispatched[0].error.message).toContain('\\citep');

      unsub();
    });
  });

  describe('2. CodeMirror 6 StateField & Decorations Mapping', () => {
    it('generates line background tint and end-of-line widget decorations', () => {
      const extensions = createLatexErrorLensExtension({ enabled: true });
      const doc = 'Line 1\nLine 2 with error\nLine 3\n';

      const state = EditorState.create({
        doc,
        extensions,
      });

      const parent = document.createElement('div');
      const view = new EditorView({ state, parent });

      const diagnostics = [
        {
          id: 'comp-1',
          file: 'main.tex',
          line: 2,
          column: 1,
          message: 'LaTeX Error: Bad math delimiter',
          severity: 'error' as const,
        },
      ];

      view.dispatch({
        effects: setErrorLensDiagnosticsEffect.of({
          diagnostics,
          filePath: 'main.tex',
        }),
      });

      const decorations = view.state.field(errorLensField);
      expect(decorations.size).toBeGreaterThanOrEqual(2); // Line tint + inline widget

      // Clear decorations
      view.dispatch({
        effects: clearErrorLensDiagnosticsEffect.of(),
      });
      const cleared = view.state.field(errorLensField);
      expect(cleared.size).toBe(0);

      view.destroy();
    });

    it('prioritizes errors over warnings when multiple diagnostics occur on the same line', () => {
      const extensions = createLatexErrorLensExtension({ enabled: true });
      const state = EditorState.create({
        doc: 'Line 1\nLine 2 with multiple issues\nLine 3\n',
        extensions,
      });
      const view = new EditorView({ state, parent: document.createElement('div') });

      const diagnostics = [
        {
          id: 'warn-1',
          file: 'main.tex',
          line: 2,
          message: 'Underfull \\hbox',
          severity: 'warning' as const,
        },
        {
          id: 'err-1',
          file: 'main.tex',
          line: 2,
          message: 'LaTeX Error: Undefined reference',
          severity: 'error' as const,
        },
      ];

      view.dispatch({
        effects: setErrorLensDiagnosticsEffect.of(diagnostics),
      });

      const decorations = view.state.field(errorLensField);
      let foundErrorWidget = false;
      decorations.between(0, state.doc.length, (_from, _to, value) => {
        const spec = value.spec as any;
        if (spec.widget && spec.widget instanceof ErrorLensWidget) {
          if (spec.widget.diagnostic.severity === 'error') {
            foundErrorWidget = true;
          }
        }
      });

      expect(foundErrorWidget).toBe(true);
      view.destroy();
    });
  });

  describe('3. Dynamic Compartment Reconfiguration (Zero Remount)', () => {
    it('toggles error lens dynamically via reconfigureErrorLens without resetting editor document', () => {
      const extensions = createCodeMirrorPreset({
        enableErrorLens: true,
      });

      const initialDoc = '\\begin{document}\n\\section{Title}\n\\end{document}';
      const view = new EditorView({
        state: EditorState.create({
          doc: initialDoc,
          extensions,
        }),
        parent: document.createElement('div'),
      });

      // Initially enabled
      expect(view.state.doc.toString()).toBe(initialDoc);

      // Disable error lens dynamically
      reconfigureErrorLens(view, false);
      expect(view.state.doc.toString()).toBe(initialDoc);

      // Re-enable error lens dynamically
      reconfigureErrorLens(view, true);
      expect(view.state.doc.toString()).toBe(initialDoc);

      view.destroy();
    });
  });

  describe('4. Overleaf Diagnostic Stepping (F8 / Shift-F8 Parity)', () => {
    it('steps forward and backward through multi-file project errors', () => {
      const errors: CompileError[] = [
        { line: 5, message: 'Missing documentenv', file: 'main.tex', severity: 'error' },
        { line: 20, message: 'Bad character', file: 'main.tex', severity: 'error' },
        { line: 12, message: 'Missing graphic', file: 'chapters/intro.tex', severity: 'error' },
      ];

      diagnosticsCoordinator.ingestCompilerErrors(errors, 'main.tex');

      setActiveEditorEngine(null);
      usePageStore.setState({
        activeFilePage: {
          id: 'main.tex',
          title: 'main.tex',
          path: 'main.tex',
          content: 'line 1\nline 2\nline 3\nline 4\nline 5\n',
        } as any,
        currentPage: {
          id: 'main.tex',
          title: 'main.tex',
          path: 'main.tex',
          content: 'line 1\nline 2\nline 3\nline 4\nline 5\n',
        } as any,
      });

      const stepped: any[] = [];
      const unsub = editorCommandBus.subscribe('editor:error-stepped', (cmd) => {
        stepped.push(cmd);
      });

      // 1. Jump to first error (F8)
      navigationCoordinator.jumpToNextDiagnostic('error');
      expect(stepped.length).toBe(1);
      expect(stepped[0].line).toBe(5);
      expect(stepped[0].file).toBe('main.tex');

      // 2. Jump to second error in same file (F8)
      navigationCoordinator.jumpToNextDiagnostic('error');
      expect(stepped.length).toBe(2);
      expect(stepped[1].line).toBe(20);

      // 3. Jump to third error in chapters/intro.tex (F8 across files)
      navigationCoordinator.jumpToNextDiagnostic('error');
      expect(stepped.length).toBe(3);
      expect(stepped[2].file).toBe('chapters/intro.tex');
      expect(stepped[2].line).toBe(12);

      // 4. Jump back using Shift+F8
      navigationCoordinator.jumpToPrevDiagnostic('error');
      expect(stepped.length).toBe(4);
      expect(stepped[3].line).toBe(20);
      expect(stepped[3].file).toBe('main.tex');

      unsub();
    });
  });

  describe('5. Settings Store Integration', () => {
    it('allows toggling errorLensEnabled via settings store', () => {
      expect(useSettingsStore.getState().errorLensEnabled).toBe(true);

      useSettingsStore.getState().toggleErrorLensEnabled();
      expect(useSettingsStore.getState().errorLensEnabled).toBe(false);

      useSettingsStore.getState().setErrorLensEnabled(true);
      expect(useSettingsStore.getState().errorLensEnabled).toBe(true);
    });
  });
});
