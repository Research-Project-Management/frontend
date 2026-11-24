import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { createVisualModeExtensions } from '@/features/editor/core/engine/codemirror/codemirror-base-theme';
import {
  preambleExpandedField,
  togglePreambleEffect,
} from '@/features/editor/core/engine/extensions/latex-visual-document-shell';

const SAMPLE_TEX = [
  '\\documentclass{article}',
  '\\usepackage{graphicx}',
  '\\title{flux}',
  '\\author{Tấn Thành}',
  '\\date{November 2026}',
  '\\begin{document}',
  '\\maketitle',
  '\\section{Introduction}',
  'Body text before quote.',
  '\\begin{quote}',
  'Quoted passage here.',
  '\\end{quote}',
  '\\begin{itemize}',
  '\\item First bullet',
  '\\end{itemize}',
  '\\end{document}',
].join('\n');

describe('Overleaf-style Visual Mode (Document Shell, Headings, Environments)', () => {
  it('collapses preamble into header widget, hides unfocused LaTeX syntax, and renders quote/list blocks losslessly', () => {
    const parent = document.createElement('div');
    document.body.appendChild(parent);

    // Place selection on body line so \section / quote / itemize are all unfocused cleanly
    const bodyOffset = SAMPLE_TEX.indexOf('Body text before quote.');
    const state = EditorState.create({
      doc: SAMPLE_TEX,
      selection: { anchor: bodyOffset },
      extensions: createVisualModeExtensions(),
    });
    const view = new EditorView({ state, parent });

    try {
      expect(view.state.doc.toString()).toBe(SAMPLE_TEX);
      expect(view.state.field(preambleExpandedField)).toBe(false);

      const pill = parent.querySelector('.cm-visual-preamble-pill');
      expect(pill?.textContent).toContain('Preamble · article · 1 package');

      const docTitle = parent.querySelector('.cm-visual-doc-title');
      expect(docTitle?.textContent).toBe('flux');

      const docMeta = parent.querySelector('.cm-visual-doc-meta');
      expect(docMeta?.textContent).toBe('Tấn Thành · November 2026');

      const quoteLine = parent.querySelector('.cm-visual-quote-line');
      expect(quoteLine?.textContent).toContain('Quoted passage here.');

      const bullet = parent.querySelector('.cm-visual-list-bullet');
      expect(bullet?.textContent?.trim()).toBe('•');

      // Structural commands (\maketitle, \end{document}) and unfocused heading braces are hidden
      const contentText = parent.querySelector('.cm-content')?.textContent ?? '';
      expect(contentText).toContain('Introduction');
      expect(contentText).not.toContain('\\section{');
      expect(contentText).not.toContain('\\maketitle');
      expect(contentText).not.toContain('\\end{document}');

      // Expanding preamble via togglePreambleEffect reveals raw preamble without modifying text
      view.dispatch({ effects: togglePreambleEffect.of(true) });
      expect(view.state.field(preambleExpandedField)).toBe(true);
      expect(parent.textContent).toContain('\\documentclass{article}');
      expect(view.state.doc.toString()).toBe(SAMPLE_TEX);
    } finally {
      view.destroy();
      parent.remove();
    }
  });
});
