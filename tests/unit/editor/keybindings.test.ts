import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import {
  keybindingCoordinator,
  SHORTCUT_LIST,
} from '@/features/editor/subsystems/keybinding';
import {
  editorCommandBus,
  sessionCoordinator,
  useSettingsStore,
} from '@/features/editor/core';
import {
  wrapFormatting,
  handleAutoCloseEnvironment,
  handleAutoCloseMath,
  handleBackspaceBetweenMath,
} from '@/features/editor/core/engine/codemirror/latex-formatting.commands';
import { LatexSymbolsIndexCore } from '@/features/editor/domain/latex/latex-symbols-core';

describe('Editor Keybindings, Formatting Commands & Input Modes', () => {
  describe('1. KeybindingCoordinator Global & Scoped Shortcuts', () => {
    let cleanup: () => void;

    beforeEach(() => {
      cleanup = keybindingCoordinator.init();
    });

    afterEach(() => {
      cleanup?.();
      vi.restoreAllMocks();
    });

    it('triggers compiler recompile on Mod-Enter', () => {
      const dispatchSpy = vi.spyOn(editorCommandBus, 'dispatch');
      const event = new KeyboardEvent('keydown', {
        key: 'Enter',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });

      window.dispatchEvent(event);

      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'compiler:trigger', reason: 'shortcut' }),
      );
      expect(event.defaultPrevented).toBe(true);
    });

    it('triggers sessionCoordinator flush on Mod-s', () => {
      const flushSpy = vi
        .spyOn(sessionCoordinator, 'flushAllPending')
        .mockResolvedValue(undefined as never);
      const event = new KeyboardEvent('keydown', {
        key: 's',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });

      window.dispatchEvent(event);

      expect(flushSpy).toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(true);
    });

    it('triggers next error navigation on F8 and previous error on Shift-F8', () => {
      const dispatchSpy = vi.spyOn(editorCommandBus, 'dispatch');

      const f8Event = new KeyboardEvent('keydown', {
        key: 'F8',
        shiftKey: false,
        bubbles: true,
        cancelable: true,
      });
      window.dispatchEvent(f8Event);
      expect(dispatchSpy).toHaveBeenCalledWith({ type: 'navigation:next-error' });
      expect(f8Event.defaultPrevented).toBe(true);

      const shiftF8Event = new KeyboardEvent('keydown', {
        key: 'F8',
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      });
      window.dispatchEvent(shiftF8Event);
      expect(dispatchSpy).toHaveBeenCalledWith({ type: 'navigation:prev-error' });
      expect(shiftF8Event.defaultPrevented).toBe(true);
    });

    it('opens shortcuts cheat sheet on F1 and Mod-/ when editor is not focused', () => {
      const dispatchSpy = vi.spyOn(editorCommandBus, 'dispatch');

      const f1Event = new KeyboardEvent('keydown', {
        key: 'F1',
        bubbles: true,
        cancelable: true,
      });
      window.dispatchEvent(f1Event);
      expect(dispatchSpy).toHaveBeenCalledWith({
        type: 'dialog:open',
        dialog: 'shortcuts',
      });
      expect(f1Event.defaultPrevented).toBe(true);

      dispatchSpy.mockClear();
      const slashEvent = new KeyboardEvent('keydown', {
        key: '/',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      window.dispatchEvent(slashEvent);
      expect(dispatchSpy).toHaveBeenCalledWith({
        type: 'dialog:open',
        dialog: 'shortcuts',
      });
    });

    it('triggers quick-open (Mod-p), word-count (Mod-Shift-w), table-wizard (Mod-Shift-t), and editor mode toggle (Mod-Shift-v)', () => {
      const dispatchSpy = vi.spyOn(editorCommandBus, 'dispatch');
      const toggleSpy = vi.spyOn(useSettingsStore.getState(), 'toggleEditorMode');

      const quickOpenEvent = new KeyboardEvent('keydown', {
        key: 'p',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      window.dispatchEvent(quickOpenEvent);
      expect(dispatchSpy).toHaveBeenCalledWith({
        type: 'dialog:open',
        dialog: 'quick-open',
      });
      expect(quickOpenEvent.defaultPrevented).toBe(true);

      const wordCountEvent = new KeyboardEvent('keydown', {
        key: 'w',
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      });
      window.dispatchEvent(wordCountEvent);
      expect(dispatchSpy).toHaveBeenCalledWith({
        type: 'dialog:open',
        dialog: 'word-count',
      });

      const tableWizardEvent = new KeyboardEvent('keydown', {
        key: 't',
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      });
      window.dispatchEvent(tableWizardEvent);
      expect(dispatchSpy).toHaveBeenCalledWith({
        type: 'dialog:open',
        dialog: 'table-wizard',
      });

      const toggleEvent = new KeyboardEvent('keydown', {
        key: 'v',
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      });
      window.dispatchEvent(toggleEvent);
      expect(toggleSpy).toHaveBeenCalled();
      expect(toggleEvent.defaultPrevented).toBe(true);
    });
  });

  describe('2. Keybinding Mode Store & Shortcut Registry', () => {
    beforeEach(() => {
      useSettingsStore.getState().setKeybinding('standard');
    });

    it('switches cleanly between standard, vim, and emacs keybinding modes', () => {
      expect(useSettingsStore.getState().keybinding).toBe('standard');

      useSettingsStore.getState().setKeybinding('vim');
      expect(useSettingsStore.getState().keybinding).toBe('vim');

      useSettingsStore.getState().setKeybinding('emacs');
      expect(useSettingsStore.getState().keybinding).toBe('emacs');

      useSettingsStore.getState().setKeybinding('standard');
      expect(useSettingsStore.getState().keybinding).toBe('standard');
    });

    it('exposes canonical Overleaf-parity bindings in SHORTCUT_LIST', () => {
      expect(SHORTCUT_LIST.find((s) => s.id === 'goto-line')?.keys).toEqual(['Ctrl', 'G']);
      expect(SHORTCUT_LIST.find((s) => s.id === 'fold-code')?.keys).toEqual(['Ctrl', 'Alt', '[']);
      expect(SHORTCUT_LIST.find((s) => s.id === 'unfold-code')?.keys).toEqual(['Ctrl', 'Alt', ']']);
      expect(SHORTCUT_LIST.find((s) => s.id === 'fold-all')?.keys).toEqual([
        'Ctrl',
        'Alt',
        'Shift',
        '[',
      ]);
      expect(SHORTCUT_LIST.find((s) => s.id === 'unfold-all')?.keys).toEqual([
        'Ctrl',
        'Alt',
        'Shift',
        ']',
      ]);
      expect(SHORTCUT_LIST.find((s) => s.id === 'table-wizard')?.keys).toEqual([
        'Ctrl',
        'Shift',
        'T',
      ]);
      expect(SHORTCUT_LIST.find((s) => s.id === 'toggle-editor-mode')?.keys).toEqual([
        'Ctrl',
        'Shift',
        'V',
      ]);
      expect(SHORTCUT_LIST.find((s) => s.id === 'word-count')?.keys).toEqual([
        'Ctrl',
        'Shift',
        'W',
      ]);
    });
  });

  describe('3. CodeMirror LaTeX Formatting & Auto-Close Commands', () => {
    let view: EditorView;

    afterEach(() => {
      view?.destroy();
    });

    it('wrapFormatting wraps selected text or places cursor inside empty command', () => {
      view = new EditorView({
        state: EditorState.create({
          doc: 'Hello world',
          selection: { anchor: 6, head: 11 },
        }),
      });
      wrapFormatting(view, '\\textbf{', '}');
      expect(view.state.doc.toString()).toBe('Hello \\textbf{world}');
      view.destroy();

      view = new EditorView({
        state: EditorState.create({
          doc: 'Hello ',
          selection: { anchor: 6 },
        }),
      });
      wrapFormatting(view, '\\textbf{', '}');
      expect(view.state.doc.toString()).toBe('Hello \\textbf{}');
      expect(view.state.selection.main.head).toBe(6 + '\\textbf{'.length);
      view.destroy();

      view = new EditorView({
        state: EditorState.create({
          doc: 'Academic research',
          selection: { anchor: 9, head: 17 },
        }),
      });
      wrapFormatting(view, '\\textit{', '}');
      expect(view.state.doc.toString()).toBe('Academic \\textit{research}');
      view.destroy();

      view = new EditorView({
        state: EditorState.create({
          doc: 'Important note',
          selection: { anchor: 0, head: 9 },
        }),
      });
      wrapFormatting(view, '\\underline{', '}');
      expect(view.state.doc.toString()).toBe('\\underline{Important} note');
    });

    it('handleAutoCloseEnvironment closes indented/starred environments without duplicating existing \\end', () => {
      view = new EditorView({
        state: EditorState.create({
          doc: '  \\begin{equation}',
          selection: { anchor: '  \\begin{equation}'.length },
        }),
      });
      expect(handleAutoCloseEnvironment(view)).toBe(true);
      expect(view.state.doc.toString()).toBe('  \\begin{equation}\n    \n  \\end{equation}');
      view.destroy();

      view = new EditorView({
        state: EditorState.create({
          doc: '\\begin{align*}',
          selection: { anchor: '\\begin{align*}'.length },
        }),
      });
      expect(handleAutoCloseEnvironment(view)).toBe(true);
      expect(view.state.doc.toString()).toBe('\\begin{align*}\n  \n\\end{align*}');
      view.destroy();

      view = new EditorView({
        state: EditorState.create({
          doc: '\\begin{figure}\\end{figure}',
          selection: { anchor: '\\begin{figure}'.length },
        }),
      });
      expect(handleAutoCloseEnvironment(view)).toBe(false);
      expect(view.state.doc.toString()).toBe('\\begin{figure}\\end{figure}');
    });

    it('handleAutoCloseMath and handleBackspaceBetweenMath manage inline $...$ pairs cleanly', () => {
      view = new EditorView({
        state: EditorState.create({
          doc: 'Compute ',
          selection: { anchor: 8 },
        }),
      });
      expect(handleAutoCloseMath(view)).toBe(true);
      expect(view.state.doc.toString()).toBe('Compute $$');
      expect(view.state.selection.main.head).toBe(9);
      expect(handleBackspaceBetweenMath(view)).toBe(true);
      expect(view.state.doc.toString()).toBe('Compute ');
      expect(view.state.selection.main.head).toBe(8);
      view.destroy();

      view = new EditorView({
        state: EditorState.create({
          doc: 'Value a + b here',
          selection: { anchor: 6, head: 11 },
        }),
      });
      expect(handleAutoCloseMath(view)).toBe(true);
      expect(view.state.doc.toString()).toBe('Value $a + b$ here');
      expect(view.state.selection.main.head).toBe(13);
      view.destroy();

      view = new EditorView({
        state: EditorState.create({
          doc: 'Value $x$',
          selection: { anchor: 8 },
        }),
      });
      expect(handleAutoCloseMath(view)).toBe(true);
      expect(view.state.doc.toString()).toBe('Value $x$');
      expect(view.state.selection.main.head).toBe(9);
    });

    it('LatexSymbolsIndexCore indexes and filters image files for \\includegraphics completion', () => {
      const core = new LatexSymbolsIndexCore();
      core.indexFile('file-1', 'figures/chart.png', '');
      core.indexFile('file-2', 'images/photo.jpg', '');
      core.indexFile('file-3', 'diagram.pdf', '');
      core.indexFile('file-4', 'main.tex', '\\documentclass{article}');

      const images = core.getImageFiles();
      expect(images).toContain('figures/chart.png');
      expect(images).toContain('images/photo.jpg');
      expect(images).toContain('diagram.pdf');
      expect(images).not.toContain('main.tex');
      expect(core.getImageFiles('chart')).toEqual(['figures/chart.png']);
    });
  });
});
