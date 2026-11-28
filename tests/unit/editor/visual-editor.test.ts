import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { useSettingsStore, editorCommandBus } from '@/features/editor/core';
import {
  createCodeMirrorPreset,
  reconfigureVisualMode,
  createVisualModeExtensions,
} from '@/features/editor/core/engine/codemirror/codemirror-preset';
import {
  findMatchingBrace,
  latexVisualHeadings,
} from '@/features/editor/core/engine/extensions/latex-visual-headings';
import { latexVisualMath } from '@/features/editor/core/engine/extensions/latex-visual-math';
import { latexVisualCitations } from '@/features/editor/core/engine/extensions/latex-visual-citations';

describe('CodeMirror 6 Visual Mode, Balanced-Brace Parser & Mode Toggle', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    useSettingsStore.setState({ editorMode: 'code' });
  });

  afterEach(() => {
    container.remove();
    vi.clearAllMocks();
  });

  describe('1. Settings Store editorMode & Command Bus Delegation', () => {
    it('toggles between code and visual modes and dispatches visual/citation commands', () => {
      expect(useSettingsStore.getState().editorMode).toBe('code');
      useSettingsStore.getState().toggleEditorMode();
      expect(useSettingsStore.getState().editorMode).toBe('visual');
      useSettingsStore.getState().toggleEditorMode();
      expect(useSettingsStore.getState().editorMode).toBe('code');

      const visualListener = vi.fn();
      const unsubVisual = editorCommandBus.subscribe('editor:visual-command', visualListener);
      editorCommandBus.dispatch({ type: 'editor:visual-command', command: 'heading', level: 2 });
      expect(visualListener).toHaveBeenCalledWith({
        type: 'editor:visual-command',
        command: 'heading',
        level: 2,
      });
      unsubVisual();

      const citeListener = vi.fn();
      const unsubCite = editorCommandBus.subscribe('editor:insert-citation', citeListener);
      editorCommandBus.dispatch({ type: 'editor:insert-citation', bibKey: 'knuth1984' });
      expect(citeListener).toHaveBeenCalledWith({
        type: 'editor:insert-citation',
        bibKey: 'knuth1984',
      });
      unsubCite();
    });
  });

  describe('2. Lossless CM6 Visual Mode Compartment Reconfiguration', () => {
    it('reconfigures visual extensions dynamically without mutating underlying LaTeX source', () => {
      expect(createVisualModeExtensions()).toHaveLength(4);

      const extensions = createCodeMirrorPreset({ enableVisualMode: false });
      const doc =
        '\\section{Theory}\n\\textbf{Bold text} and \\textit{italic text}.\n$$f(x) = x^2$$\\ref{sec:theory}';
      const view = new EditorView({
        state: EditorState.create({ doc, extensions }),
        parent: container,
      });

      reconfigureVisualMode(view, true);
      expect(view.state.doc.toString()).toBe(doc);

      reconfigureVisualMode(view, false);
      expect(view.state.doc.toString()).toBe(doc);

      view.destroy();
    });
  });

  describe('3. Balanced-Brace LaTeX Parser & Visual Headings/Math/Citations', () => {
    it('resolves nested braces, escaped braces, and unclosed braces safely', () => {
      const simple = '\\section{Introduction to Quantum Computing}';
      expect(findMatchingBrace(simple, simple.indexOf('{'))).toBe(simple.length - 1);

      const nested = '\\section{Introduction to \\textbf{Deep} Learning}';
      const openIdx = nested.indexOf('{');
      const closeIdx = findMatchingBrace(nested, openIdx)!;
      expect(nested.slice(openIdx + 1, closeIdx)).toBe('Introduction to \\textbf{Deep} Learning');

      const escaped = '\\section{Analysis of Set \\{1, 2, 3\\} Properties}';
      const escOpen = escaped.indexOf('{');
      expect(escaped.slice(escOpen + 1, findMatchingBrace(escaped, escOpen)!)).toBe(
        'Analysis of Set \\{1, 2, 3\\} Properties',
      );

      expect(findMatchingBrace('\\section{Unclosed', 8)).toBeNull();
    });

    it('mounts visual headings, multi-line equation math, and citation chips without RangeSetBuilder errors', () => {
      const doc = [
        '\\section{Overview of \\textbf{Robust} and \\textit{Stable} Architectures}',
        '\\begin{equation}',
        '  E = mc^2',
        '\\end{equation}',
        'According to \\cite{turing1936} and \\ref{sec:proof}.',
      ].join('\n');

      const view = new EditorView({
        state: EditorState.create({
          doc,
          extensions: [latexVisualHeadings(), latexVisualMath(), latexVisualCitations()],
        }),
        parent: container,
      });

      expect(view.state.doc.toString()).toBe(doc);
      view.destroy();
    });
  });
});
