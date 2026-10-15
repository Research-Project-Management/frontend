import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import {
  wrapFormatting,
  handleAutoCloseEnvironment,
  handleAutoCloseMath,
  handleBackspaceBetweenMath,
} from '@/features/editor/core/engine/codemirror/latex-formatting.commands';

describe('Overleaf LaTeX Formatting & Auto-Close (Overleaf Parity)', () => {
  let view: EditorView;

  afterEach(() => {
    view?.destroy();
  });

  it('wrapFormatting wraps selected text with \\textbf{...}', () => {
    const text = 'Hello world';
    const state = EditorState.create({
      doc: text,
      selection: { anchor: 6, head: 11 }, // select "world"
    });
    view = new EditorView({ state });

    wrapFormatting(view, '\\textbf{', '}');
    expect(view.state.doc.toString()).toBe('Hello \\textbf{world}');
  });

  it('wrapFormatting inserts empty \\textbf{} and places cursor inside when selection is empty', () => {
    const text = 'Hello ';
    const state = EditorState.create({
      doc: text,
      selection: { anchor: 6 },
    });
    view = new EditorView({ state });

    wrapFormatting(view, '\\textbf{', '}');
    expect(view.state.doc.toString()).toBe('Hello \\textbf{}');
    expect(view.state.selection.main.head).toBe(6 + '\\textbf{'.length);
  });

  it('wrapFormatting wraps selected text with \\textit{...}', () => {
    const text = 'Academic research';
    const state = EditorState.create({
      doc: text,
      selection: { anchor: 9, head: 17 }, // select "research"
    });
    view = new EditorView({ state });

    wrapFormatting(view, '\\textit{', '}');
    expect(view.state.doc.toString()).toBe('Academic \\textit{research}');
  });

  it('wrapFormatting wraps selected text with \\underline{...}', () => {
    const text = 'Important note';
    const state = EditorState.create({
      doc: text,
      selection: { anchor: 0, head: 9 }, // select "Important"
    });
    view = new EditorView({ state });

    wrapFormatting(view, '\\underline{', '}');
    expect(view.state.doc.toString()).toBe('\\underline{Important} note');
  });

  it('handleAutoCloseEnvironment auto-closes \\begin{equation} with indentation', () => {
    const state = EditorState.create({
      doc: '  \\begin{equation}',
      selection: { anchor: '  \\begin{equation}'.length },
    });
    view = new EditorView({ state });

    const handled = handleAutoCloseEnvironment(view);
    expect(handled).toBe(true);

    const docText = view.state.doc.toString();
    expect(docText).toBe('  \\begin{equation}\n    \n  \\end{equation}');
  });

  it('handleAutoCloseEnvironment preserves asterisks in environment names like \\begin{align*}', () => {
    const state = EditorState.create({
      doc: '\\begin{align*}',
      selection: { anchor: '\\begin{align*}'.length },
    });
    view = new EditorView({ state });

    const handled = handleAutoCloseEnvironment(view);
    expect(handled).toBe(true);
    expect(view.state.doc.toString()).toBe('\\begin{align*}\n  \n\\end{align*}');
  });

  it('handleAutoCloseEnvironment does not duplicate \\end if already present', () => {
    const state = EditorState.create({
      doc: '\\begin{figure}\\end{figure}',
      selection: { anchor: '\\begin{figure}'.length },
    });
    view = new EditorView({ state });

    const handled = handleAutoCloseEnvironment(view);
    expect(handled).toBe(false);
    expect(view.state.doc.toString()).toBe('\\begin{figure}\\end{figure}');
  });

  it('SHORTCUT_LIST has Go to Line bound to Ctrl+G (Overleaf 1:1 Parity)', async () => {
    const { SHORTCUT_LIST } = await import('@/features/editor/ui/modals/KeyboardShortcutsModal');
    const gotoItem = SHORTCUT_LIST.find((s) => s.id === 'goto-line');
    expect(gotoItem).toBeDefined();
    expect(gotoItem?.keys).toEqual(['Ctrl', 'G']);
  });

  it('SHORTCUT_LIST has Code Folding shortcuts (fold-code, unfold-code, fold-all, unfold-all)', async () => {
    const { SHORTCUT_LIST } = await import('@/features/editor/ui/modals/KeyboardShortcutsModal');
    const foldCurrent = SHORTCUT_LIST.find((s) => s.id === 'fold-code');
    const unfoldCurrent = SHORTCUT_LIST.find((s) => s.id === 'unfold-code');
    const foldAll = SHORTCUT_LIST.find((s) => s.id === 'fold-all');
    const unfoldAll = SHORTCUT_LIST.find((s) => s.id === 'unfold-all');

    expect(foldCurrent?.keys).toEqual(['Ctrl', 'Alt', '[']);
    expect(unfoldCurrent?.keys).toEqual(['Ctrl', 'Alt', ']']);
    expect(foldAll?.keys).toEqual(['Ctrl', 'Alt', 'Shift', '[']);
    expect(unfoldAll?.keys).toEqual(['Ctrl', 'Alt', 'Shift', ']']);
  });

  it('LatexSymbolsCore correctly indexes and returns image files for \\includegraphics', async () => {
    const { LatexSymbolsIndexCore } = await import('@/features/editor/domain/latex/latex-symbols-core');
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

    const filtered = core.getImageFiles('chart');
    expect(filtered).toEqual(['figures/chart.png']);
  });

  it('handleAutoCloseMath inserts $$ and places cursor between them', () => {
    const state = EditorState.create({
      doc: 'Compute ',
      selection: { anchor: 8 },
    });
    view = new EditorView({ state });

    const handled = handleAutoCloseMath(view);
    expect(handled).toBe(true);
    expect(view.state.doc.toString()).toBe('Compute $$');
    expect(view.state.selection.main.head).toBe(9);
  });

  it('handleAutoCloseMath wraps selected text in $...$', () => {
    const state = EditorState.create({
      doc: 'Value a + b here',
      selection: { anchor: 6, head: 11 }, // select "a + b"
    });
    view = new EditorView({ state });

    const handled = handleAutoCloseMath(view);
    expect(handled).toBe(true);
    expect(view.state.doc.toString()).toBe('Value $a + b$ here');
    expect(view.state.selection.main.head).toBe(13);
  });

  it('handleAutoCloseMath skips over existing closing $ when cursor is immediately before it', () => {
    const state = EditorState.create({
      doc: 'Value $x$',
      selection: { anchor: 8 }, // cursor between 'x' and '$'
    });
    view = new EditorView({ state });

    const handled = handleAutoCloseMath(view);
    expect(handled).toBe(true);
    expect(view.state.doc.toString()).toBe('Value $x$');
    expect(view.state.selection.main.head).toBe(9); // stepped over $
  });

  it('handleBackspaceBetweenMath deletes both $$ when cursor is between them', () => {
    const state = EditorState.create({
      doc: 'Compute $$',
      selection: { anchor: 9 }, // between $ and $
    });
    view = new EditorView({ state });

    const handled = handleBackspaceBetweenMath(view);
    expect(handled).toBe(true);
    expect(view.state.doc.toString()).toBe('Compute ');
    expect(view.state.selection.main.head).toBe(8);
  });

  it('SHORTCUT_LIST has Table Wizard and Toggle Editor Mode shortcuts', async () => {
    const { SHORTCUT_LIST } = await import('@/features/editor/ui/modals/KeyboardShortcutsModal');
    const tableWizard = SHORTCUT_LIST.find((s) => s.id === 'table-wizard');
    const toggleEditor = SHORTCUT_LIST.find((s) => s.id === 'toggle-editor-mode');

    expect(tableWizard?.keys).toEqual(['Ctrl', 'Shift', 'T']);
    expect(toggleEditor?.keys).toEqual(['Ctrl', 'Shift', 'V']);
  });

  it('VisualSlashCommandMenu has table-wizard command', async () => {
    const { SLASH_COMMANDS } = await import('@/features/editor/ui/editor/visual/toolbars/VisualSlashCommandMenu');
    const tableWizardCmd = SLASH_COMMANDS.find((c) => c.id === 'table-wizard');
    expect(tableWizardCmd).toBeDefined();
    expect(tableWizardCmd?.shortcut).toBe('Ctrl+Shift+T');
  });

  it('SHORTCUT_LIST has Word Count bound to Ctrl+Shift+W (Overleaf 1:1 Parity)', async () => {
    const { SHORTCUT_LIST } = await import('@/features/editor/ui/modals/KeyboardShortcutsModal');
    const wordCount = SHORTCUT_LIST.find((s) => s.id === 'word-count');
    expect(wordCount).toBeDefined();
    expect(wordCount?.keys).toEqual(['Ctrl', 'Shift', 'W']);
  });
});


