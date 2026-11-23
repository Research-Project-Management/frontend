// @vitest-environment jsdom
/**
 * selection-gutter-and-hover-parity.test.ts
 *
 * Verifies Overleaf-parity UX:
 * 1. Red-underlined spelling, linter, and compiler errors do NOT show hover popups.
 * 2. Non-empty text selection shows a 2-button floating gutter pill (Comment + AI Write).
 * 3. highlightSelectionMatches() highlights matching tokens on selection.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Compartment, EditorSelection, EditorState } from '@codemirror/state';
import { EditorView, activateHover, hasHoverTooltips } from '@codemirror/view';
import { setDiagnostics } from '@codemirror/lint';
import {
  createLatexSpellingExtension,
  setSpellErrorsEffect,
  spellingStateField,
} from '@/features/editor/core/engine/extensions/latex-spelling';
import { createLatexLinterExtension } from '@/features/editor/subsystems/diagnostics/extensions/latex-linter';
import {
  createDiagnosticsGutter,
  compilerDiagnosticsField,
} from '@/features/editor/subsystems/diagnostics/extensions/diagnostics-gutter';
import {
  createSelectionGutterActionsExtension,
  SELECTION_GUTTER_AI_ACTIONS,
} from '@/features/editor/core/engine/extensions/selection-gutter-actions';
import { createCodeMirrorPreset } from '@/features/editor/core/engine/codemirror/codemirror-preset';
import { editorCommandBus } from '@/features/editor/core/bus/command-bus';
import { useWorkspaceStore } from '@/features/editor/core/store/workspace.store';
import { keybindingCoordinator } from '@/features/editor/subsystems/keybinding/coordinator/keybinding.coordinator';
import type { EditorDiagnosticItem } from '@/features/editor/domain/types/diagnostics.types';

describe('Overleaf Parity: Hover Removal, Selection Gutter Actions & Match Highlights', () => {
  const mountedViews: EditorView[] = [];
  const activeUnsubs: Array<() => void> = [];

  function mountEditor(doc: string, extensions: Parameters<typeof EditorState.create>[0]['extensions']): EditorView {
    const parent = document.createElement('div');
    document.body.appendChild(parent);
    const view = new EditorView({
      state: EditorState.create({ doc, extensions }),
      parent,
    });
    mountedViews.push(view);
    return view;
  }

  beforeEach(() => {
    useWorkspaceStore.setState({
      activeSidebarTab: 'files',
      sidebarLeftOpen: false,
    });
  });

  afterEach(() => {
    while (activeUnsubs.length > 0) {
      activeUnsubs.pop()?.();
    }
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    while (mountedViews.length > 0) {
      const view = mountedViews.pop()!;
      const parent = view.dom.parentElement;
      view.destroy();
      parent?.remove();
    }
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  describe('1. Disabled Hover Tooltips on Red-Underlined Text', () => {
    it('keeps .cm-spell-error mark and right-click context menu without registering hover tooltips', async () => {
      const view = mountEditor('Teh quick brown fox', createLatexSpellingExtension({ enabled: true }));

      view.dispatch({
        effects: setSpellErrorsEffect.of([
          {
            from: 0,
            to: 3,
            word: 'Teh',
            suggestions: ['The'],
          },
        ]),
      });

      const spellDecos = view.state.field(spellingStateField);
      expect(spellDecos.size).toBe(1);
      expect(view.dom.querySelector('.cm-spell-error')).not.toBeNull();

      activateHover(view, 1, 1);
      await Promise.resolve();

      expect(hasHoverTooltips(view.state)).toBe(false);
      expect(view.dom.querySelector('.cm-tooltip-hover')).toBeNull();
      expect(document.querySelector('.cm-tooltip-hover')).toBeNull();

      // Right-click context menu must still work on red misspelled words
      vi.spyOn(view, 'posAtCoords').mockReturnValue(1);
      const contextEvent = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: 40,
        clientY: 20,
      });
      view.contentDOM.dispatchEvent(contextEvent);

      expect(contextEvent.defaultPrevented).toBe(true);
      expect(document.body.textContent).toContain('The');
      expect(document.body.textContent).toContain('Add to project dictionary');
    });

    it('keeps compiler diagnostic underline & gutter marker without showing inline hover tooltips', async () => {
      const diag: EditorDiagnosticItem = {
        id: 'comp-err-1',
        file: 'main.tex',
        line: 1,
        column: 1,
        message: 'Undefined control sequence \\badcmd',
        highlightCommand: '\\badcmd',
        severity: 'error',
        source: 'pdflatex',
      };

      const view = mountEditor(
        '\\badcmd{hello}',
        createDiagnosticsGutter({
          filePath: 'main.tex',
          enabled: true,
          getDiagnostics: () => [diag],
        }),
      );

      const compState = view.state.field(compilerDiagnosticsField);
      expect(compState.items).toHaveLength(1);
      expect(view.dom.querySelector('.cm-compiler-diag-error')).not.toBeNull();
      expect(view.dom.querySelector('.cm-compiler-gutter-error')).not.toBeNull();

      activateHover(view, 2, 1);
      await Promise.resolve();

      expect(hasHoverTooltips(view.state)).toBe(false);
      expect(document.querySelector('.cm-compiler-tooltip')).toBeNull();
      expect(document.querySelector('.cm-tooltip-hover')).toBeNull();
    });

    it('dispatches compiler:open-logs when clicking a compiler gutter error marker', () => {
      const openedLogs: Array<{
        file?: string;
        line?: number;
        severity?: string;
        message?: string;
      }> = [];
      activeUnsubs.push(
        editorCommandBus.subscribe('compiler:open-logs', (cmd) => {
          openedLogs.push({
            file: cmd.file,
            line: cmd.line,
            severity: cmd.severity,
            message: cmd.message,
          });
        }),
      );

      const warningDiag: EditorDiagnosticItem = {
        id: 'comp-warn-1',
        file: 'main.tex',
        line: 1,
        column: 1,
        message: 'Underfull \\hbox',
        severity: 'warning',
        source: 'pdflatex',
      };
      const errorDiag: EditorDiagnosticItem = {
        id: 'comp-err-1',
        file: 'main.tex',
        line: 1,
        column: 1,
        message: 'Undefined control sequence \\badcmd',
        highlightCommand: '\\badcmd',
        severity: 'error',
        source: 'pdflatex',
      };

      const view = mountEditor(
        '\\badcmd{hello}',
        createDiagnosticsGutter({
          filePath: 'main.tex',
          enabled: true,
          getDiagnostics: () => [warningDiag, errorDiag],
        }),
      );

      const marker = view.dom.querySelector('.cm-compiler-gutter-marker') as HTMLElement | null;
      expect(marker).not.toBeNull();
      marker!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

      expect(openedLogs).toHaveLength(1);
      expect(openedLogs[0]).toEqual({
        file: 'main.tex',
        line: 1,
        severity: 'error',
        message: 'Undefined control sequence \\badcmd',
      });
    });

    it('suppresses @codemirror/lint hover popups via tooltipFilter while preserving lint squiggles', async () => {
      const view = mountEditor('\\badcmd{hello}', createLatexLinterExtension('main.tex'));

      view.dispatch(
        setDiagnostics(view.state, [
          {
            from: 0,
            to: 7,
            severity: 'error',
            message: 'Undefined LaTeX command',
          },
        ]),
      );

      expect(view.dom.querySelector('.cm-lintRange-error')).not.toBeNull();

      activateHover(view, 2, 1);
      await Promise.resolve();

      expect(hasHoverTooltips(view.state)).toBe(false);
      expect(document.querySelector('.cm-tooltip-lint')).toBeNull();
      expect(document.querySelector('.cm-tooltip-hover')).toBeNull();
    });
  });

  describe('2. Overleaf-style Selection Gutter Pill & Match Highlighting', () => {
    it('shows the floating 2-button pill only on non-whitespace selection and hides on collapse', () => {
      const view = mountEditor(
        '   \n\\usepackage{natbib}\nSee natbib manual.',
        createSelectionGutterActionsExtension(),
      );

      const pill = view.dom.querySelector('[data-testid="selection-gutter-actions"]') as HTMLDivElement;
      const commentBtn = view.dom.querySelector(
        '[data-testid="selection-gutter-comment-btn"]',
      ) as HTMLButtonElement;
      const aiBtn = view.dom.querySelector(
        '[data-testid="selection-gutter-ai-btn"]',
      ) as HTMLButtonElement;

      expect(pill).not.toBeNull();
      expect(commentBtn).not.toBeNull();
      expect(aiBtn).not.toBeNull();
      expect(pill.style.display).toBe('none');

      // Whitespace-only selection keeps pill hidden
      view.dispatch({ selection: EditorSelection.range(0, 3) });
      expect(pill.style.display).toBe('none');

      // Selecting "natbib" displays the pill
      const natbibStart = view.state.doc.toString().indexOf('natbib');
      view.dispatch({ selection: EditorSelection.range(natbibStart, natbibStart + 6) });
      expect(pill.style.display).toBe('flex');

      // Collapsing selection hides the pill again
      view.dispatch({ selection: EditorSelection.cursor(natbibStart) });
      expect(pill.style.display).toBe('none');
    });

    it('positions horizontal pill above the selection after requestMeasure frame without console errors and hides when off-screen', async () => {
      const originalGetClientRects = Range.prototype.getClientRects;
      const originalGetBoundingClientRect = Range.prototype.getBoundingClientRect;
      Range.prototype.getClientRects = (() => []) as unknown as typeof Range.prototype.getClientRects;
      Range.prototype.getBoundingClientRect = () => new DOMRect(0, 0, 0, 0);

      try {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const view = mountEditor(
          'Line one\nUse natbib here',
          createCodeMirrorPreset({
            enableSpellCheck: false,
            enableLinter: false,
            enableErrorLens: false,
            enableAutocomplete: false,
          }),
        );

        const gutterEl = view.dom.querySelector('.cm-gutters') as HTMLElement;
        expect(gutterEl).not.toBeNull();

        vi.spyOn(view.dom, 'getBoundingClientRect').mockReturnValue(new DOMRect(100, 50, 600, 400));
        vi.spyOn(view.scrollDOM, 'getBoundingClientRect').mockReturnValue(new DOMRect(100, 50, 600, 400));
        vi.spyOn(gutterEl, 'getBoundingClientRect').mockReturnValue(new DOMRect(100, 50, 44, 400));
        const coordsSpy = vi
          .spyOn(view, 'coordsAtPos')
          .mockReturnValue({ top: 96, bottom: 116, left: 160, right: 168 });

        const pos = view.state.doc.toString().indexOf('natbib');
        view.dispatch({ selection: EditorSelection.range(pos, pos + 6) });

        await new Promise((resolve) => setTimeout(resolve, 40));

        const pill = view.dom.querySelector('[data-testid="selection-gutter-actions"]') as HTMLDivElement;
        expect(errorSpy).not.toHaveBeenCalled();
        expect(pill.style.display).toBe('flex');
        expect(pill.style.top).toBe('12px');
        expect(pill.style.left).toBe('60px');

        // When selection scrolls outside the viewport, next measure hides the pill
        coordsSpy.mockReturnValue({ top: 10, bottom: 30, left: 160, right: 168 });
        view.scrollDOM.dispatchEvent(new Event('scroll'));
        await new Promise((resolve) => setTimeout(resolve, 40));

        expect(pill.style.display).toBe('none');
        expect(errorSpy).not.toHaveBeenCalled();
      } finally {
        Range.prototype.getClientRects = originalGetClientRects;
        Range.prototype.getBoundingClientRect = originalGetBoundingClientRect;
      }
    });

    it('dispatches review:create-comment with start line, endLine, and selectedText on Comment click', () => {
      const dispatched: Array<{ line?: number; endLine?: number; selectedText?: string }> = [];
      activeUnsubs.push(
        editorCommandBus.subscribe('review:create-comment', (cmd) => {
          dispatched.push({ line: cmd.line, endLine: cmd.endLine, selectedText: cmd.selectedText });
        }),
      );

      const doc = 'First line\nSecond natbib line\nThird line summary';
      const view = mountEditor(doc, createSelectionGutterActionsExtension());

      const from = doc.indexOf('natbib');
      const to = doc.indexOf('line summary') + 4;
      view.dispatch({ selection: EditorSelection.range(from, to) });

      const commentBtn = view.dom.querySelector(
        '[data-testid="selection-gutter-comment-btn"]',
      ) as HTMLButtonElement;
      commentBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      commentBtn.click();

      expect(dispatched).toHaveLength(1);
      expect(dispatched[0]).toEqual({
        line: 2,
        endLine: 3,
        selectedText: 'natbib line\nThird line',
      });
    });

    it('opens AI Writing Tools popover and dispatches sidebar:open-ai-panel on action select', () => {
      const aiPayloads: Array<{
        initialPrompt?: string;
        selectedText?: string;
        autoSend?: boolean;
        forceOpen?: boolean;
      }> = [];
      activeUnsubs.push(
        editorCommandBus.subscribe('sidebar:open-ai-panel', (cmd) => {
          aiPayloads.push({
            initialPrompt: cmd.initialPrompt,
            selectedText: cmd.selectedText,
            autoSend: cmd.autoSend,
            forceOpen: cmd.forceOpen,
          });
        }),
      );

      const doc = '\\PassOptionsToPackage{numbers,compress}{natbib}';
      const view = mountEditor(doc, createSelectionGutterActionsExtension());

      const from = doc.indexOf('natbib');
      view.dispatch({ selection: EditorSelection.range(from, from + 6) });

      const aiBtn = view.dom.querySelector(
        '[data-testid="selection-gutter-ai-btn"]',
      ) as HTMLButtonElement;
      aiBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      aiBtn.click();

      const menu = document.querySelector('[data-testid="selection-gutter-ai-menu"]');
      expect(menu).not.toBeNull();
      for (const action of SELECTION_GUTTER_AI_ACTIONS) {
        expect(
          document.querySelector(`[data-testid="selection-gutter-ai-action-${action.id}"]`),
        ).not.toBeNull();
      }

      const polishBtn = document.querySelector(
        '[data-testid="selection-gutter-ai-action-polish"]',
      ) as HTMLButtonElement;
      polishBtn.click();

      expect(document.querySelector('[data-testid="selection-gutter-ai-menu"]')).toBeNull();
      expect(useWorkspaceStore.getState().activeSidebarTab).toBe('ai');
      expect(useWorkspaceStore.getState().sidebarLeftOpen).toBe(true);
      expect(aiPayloads).toHaveLength(1);
      expect(aiPayloads[0]).toEqual({
        selectedText: 'natbib',
        initialPrompt: SELECTION_GUTTER_AI_ACTIONS[0].prompt,
        autoSend: true,
        forceOpen: true,
      });

      // Verify "Ask AI…" passes undefined initialPrompt and autoSend: false
      aiBtn.click();
      const askBtn = document.querySelector(
        '[data-testid="selection-gutter-ai-action-ask"]',
      ) as HTMLButtonElement;
      askBtn.click();

      expect(aiPayloads).toHaveLength(2);
      expect(aiPayloads[1]).toEqual({
        selectedText: 'natbib',
        initialPrompt: undefined,
        autoSend: false,
        forceOpen: true,
      });
    });

    it('hides AI Write button when EditorState.readOnly is true while keeping Comment accessible', () => {
      const readOnlyCompartment = new Compartment();
      const view = mountEditor('Read-only LaTeX text', [
        readOnlyCompartment.of(EditorState.readOnly.of(true)),
        createSelectionGutterActionsExtension(),
      ]);

      view.dispatch({ selection: EditorSelection.range(0, 9) });

      const pill = view.dom.querySelector('[data-testid="selection-gutter-actions"]') as HTMLDivElement;
      const commentBtn = view.dom.querySelector(
        '[data-testid="selection-gutter-comment-btn"]',
      ) as HTMLButtonElement;
      const aiBtn = view.dom.querySelector(
        '[data-testid="selection-gutter-ai-btn"]',
      ) as HTMLButtonElement;

      expect(pill.style.display).toBe('flex');
      expect(commentBtn.hidden).toBe(false);
      expect(aiBtn.hidden).toBe(true);
      expect(aiBtn.style.display).toBe('none');

      aiBtn.click();
      expect(document.querySelector('[data-testid="selection-gutter-ai-menu"]')).toBeNull();

      // Reconfiguring back to editable restores AI Write button
      view.dispatch({ effects: readOnlyCompartment.reconfigure(EditorState.readOnly.of(false)) });
      expect(aiBtn.hidden).toBe(false);
      expect(aiBtn.style.display).toBe('');
    });

    it('enables highlightSelectionMatches in preset and removes pill/menu cleanly on destroy', () => {
      const doc = 'Use natbib package.\nLater natbib reference.';
      const view = mountEditor(
        doc,
        createCodeMirrorPreset({
          enableSpellCheck: false,
          enableLinter: false,
          enableErrorLens: false,
          enableAutocomplete: false,
        }),
      );

      const firstNatbib = doc.indexOf('natbib');
      view.dispatch({ selection: EditorSelection.range(firstNatbib, firstNatbib + 6) });

      expect(view.dom.querySelectorAll('.cm-selectionMatch').length).toBeGreaterThanOrEqual(1);
      expect(view.dom.querySelector('[data-testid="selection-gutter-actions"]')).not.toBeNull();

      const aiBtn = view.dom.querySelector(
        '[data-testid="selection-gutter-ai-btn"]',
      ) as HTMLButtonElement;
      aiBtn.click();
      expect(document.querySelector('[data-testid="selection-gutter-ai-menu"]')).not.toBeNull();

      view.destroy();
      expect(document.querySelector('[data-testid="selection-gutter-actions"]')).toBeNull();
      expect(document.querySelector('[data-testid="selection-gutter-ai-menu"]')).toBeNull();
    });

    it('toggles AI panel via Mod-j even when CodeMirror editor is focused', () => {
      const cleanupKeys = keybindingCoordinator.init();
      activeUnsubs.push(cleanupKeys);

      let toggleCount = 0;
      activeUnsubs.push(
        editorCommandBus.subscribe('sidebar:toggle-ai-panel', () => {
          toggleCount += 1;
        }),
      );

      const view = mountEditor('Hello LaTeX', []);
      view.contentDOM.tabIndex = 0;
      view.contentDOM.focus();
      expect(document.activeElement).toBe(view.contentDOM);

      const modKey =
        typeof navigator !== 'undefined' && navigator.platform.toUpperCase().includes('MAC')
          ? { metaKey: true }
          : { ctrlKey: true };
      const event = new KeyboardEvent('keydown', {
        key: 'j',
        bubbles: true,
        cancelable: true,
        ...modKey,
      });
      window.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(true);
      expect(toggleCount).toBe(1);
    });
  });
});
