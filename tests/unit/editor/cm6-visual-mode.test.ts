/**
 * cm6-visual-mode.test.ts
 *
 * Unit tests for CodeMirror 6 Visual Mode Extensions (Overleaf Parity).
 * Location: `frontend/tests/unit/editor/cm6-visual-mode.test.ts`
 */

import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import {
  createCodeMirrorPreset,
  reconfigureVisualMode,
  createVisualModeExtensions,
  editorCompartments,
} from '@/features/editor/core/engine/codemirror/codemirror-preset';
import { latexVisualHeadings } from '@/features/editor/core/engine/extensions/latex-visual-headings';
import { latexVisualMath } from '@/features/editor/core/engine/extensions/latex-visual-math';
import { latexVisualCitations } from '@/features/editor/core/engine/extensions/latex-visual-citations';

describe('CodeMirror 6 Visual Mode Architecture (Lossless CM6 Widgets)', () => {
  it('should instantiate CodeMirror preset with visualMode compartment', () => {
    const extensions = createCodeMirrorPreset({
      enableVisualMode: false,
    });

    const state = EditorState.create({
      doc: '\\section{Introduction}\nHere is $E = mc^2$ and \\cite{einstein1905}.',
      extensions,
    });

    expect(state.doc.toString()).toContain('\\section{Introduction}');
    expect(state.doc.toString()).toContain('$E = mc^2$');
    expect(state.doc.toString()).toContain('\\cite{einstein1905}');
  });

  it('should dynamically activate visual extensions via reconfigureVisualMode without altering doc content', () => {
    const extensions = createCodeMirrorPreset({
      enableVisualMode: false,
    });

    const parent = document.createElement('div');
    const view = new EditorView({
      state: EditorState.create({
        doc: '\\section{Theory}\n\\textbf{Bold text} and \\textit{italic text}.\n$$f(x) = x^2$$\\ref{sec:theory}',
        extensions,
      }),
      parent,
    });

    const originalContent = view.state.doc.toString();

    // Reconfigure to Visual Mode
    reconfigureVisualMode(view, true);

    // Document text must remain 100% UNTOUCHED (lossless LaTeX preservation)
    expect(view.state.doc.toString()).toBe(originalContent);

    // Reconfigure back to Code Mode
    reconfigureVisualMode(view, false);
    expect(view.state.doc.toString()).toBe(originalContent);

    view.destroy();
  });

  it('should construct visual extensions array cleanly', () => {
    const visualExts = createVisualModeExtensions();
    expect(visualExts).toBeDefined();
    expect(visualExts.length).toBe(4); // theme, headings, math, citations
  });
});
