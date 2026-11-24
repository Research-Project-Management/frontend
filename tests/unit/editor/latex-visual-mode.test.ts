import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { createVisualModeExtensions } from '@/features/editor/core/engine/codemirror/codemirror-base-theme';
import {
  preambleExpandedField,
  togglePreambleEffect,
} from '@/features/editor/core/engine/extensions/latex-visual-document-shell';
import { editorCommandBus } from '@/features/editor/core/bus/command-bus';
import { workspaceCoordinator } from '@/features/editor/core/coordinator/workspace.coordinator';
import { usePageStore } from '@/features/editor/core/store/editor.store';
import { resolveProjectImageAssetUrl } from '@/features/editor/core/engine/extensions/latex-visual-floats';

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

  it('renders an empty quote block immediately via cm-visual-quote-line', () => {
    const docWithEmptyQuote = [
      '\\begin{document}',
      'Paragraph above.',
      '\\begin{quote}',
      '',
      '\\end{quote}',
      '\\end{document}',
    ].join('\n');

    const parent = document.createElement('div');
    document.body.appendChild(parent);

    const view = new EditorView({
      state: EditorState.create({
        doc: docWithEmptyQuote,
        selection: { anchor: docWithEmptyQuote.indexOf('Paragraph above.') },
        extensions: createVisualModeExtensions(),
      }),
      parent,
    });

    try {
      const quoteLines = parent.querySelectorAll('.cm-visual-quote-line');
      expect(quoteLines.length).toBe(1);
    } finally {
      view.destroy();
      parent.remove();
    }
  });

  it('auto-expands preamble on preamble edits or non-zero preamble cursor jumps while keeping pos 0 collapsed', () => {
    const parent = document.createElement('div');
    document.body.appendChild(parent);

    const view = new EditorView({
      state: EditorState.create({
        doc: SAMPLE_TEX,
        selection: { anchor: 0 },
        extensions: createVisualModeExtensions(),
      }),
      parent,
    });

    try {
      // Initial load at position 0 keeps preamble collapsed
      expect(view.state.field(preambleExpandedField)).toBe(false);

      // Moving selection to position 0 keeps preamble collapsed
      view.dispatch({ selection: { anchor: 0 } });
      expect(view.state.field(preambleExpandedField)).toBe(false);

      // Moving selection to an offset > 0 inside the preamble (e.g. Ctrl+F / diagnostic jump) auto-expands
      const pkgOffset = SAMPLE_TEX.indexOf('\\usepackage{graphicx}') + 5;
      view.dispatch({ selection: { anchor: pkgOffset } });
      expect(view.state.field(preambleExpandedField)).toBe(true);

      // Explicit Hide Preamble toggle still collapses even when selection was inside preamble
      view.dispatch({ effects: togglePreambleEffect.of(false) });
      expect(view.state.field(preambleExpandedField)).toBe(false);

      // Clicking inside PreambleHeaderWidget doc header ignores CM cursor snap
      const bodyOffset = SAMPLE_TEX.indexOf('Body text before quote.');
      view.dispatch({ selection: { anchor: bodyOffset } });
      const titleEl = parent.querySelector('.cm-visual-doc-title');
      titleEl?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      expect(view.state.selection.main.from).toBe(bodyOffset);
      expect(view.state.field(preambleExpandedField)).toBe(false);

      // Full-document programmatic sync keeps preamble collapsed
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: `${SAMPLE_TEX}\n% synced` },
      });
      expect(view.state.field(preambleExpandedField)).toBe(false);

      // Targeted edit inside the preamble (e.g. AI patch adding a package) auto-expands
      const insertPos = SAMPLE_TEX.indexOf('\\title{flux}');
      view.dispatch({
        changes: { from: insertPos, to: insertPos, insert: '\\usepackage{amsmath}\n' },
      });
      expect(view.state.field(preambleExpandedField)).toBe(true);
    } finally {
      view.destroy();
      parent.remove();
    }
  });

  it('renders unfocused figure & table floats cleanly, expands on Edit LaTeX, and falls back gracefully', () => {
    const floatDoc = [
      '\\documentclass{article}',
      '\\begin{document}',
      'Introductory paragraph.',
      '\\begin{figure}[htbp]',
      '  \\centering',
      '  \\includegraphics[width=0.8\\linewidth]{figures/plot.png}',
      '  \\caption{Training convergence curve.}',
      '  \\label{fig:results}',
      '\\end{figure}',
      '\\begin{table}[htbp]',
      '  \\centering',
      '  \\caption{Benchmark metrics ($n=10$).}',
      '  \\label{tab:metrics}',
      '  \\begin{tabular}{lr}',
      '    \\toprule',
      '    Model & Accuracy \\\\',
      '    \\midrule',
      '    Flux & 98.4\\% \\\\',
      '    \\bottomrule',
      '  \\end{tabular}',
      '\\end{table}',
      '\\begin{table}[htbp]',
      '  % Table without tabular environment',
      '  Plain placeholder note.',
      '\\end{table}',
      '\\end{document}',
    ].join('\n');

    const parent = document.createElement('div');
    document.body.appendChild(parent);

    const view = new EditorView({
      state: EditorState.create({
        doc: floatDoc,
        selection: { anchor: floatDoc.indexOf('Introductory paragraph.') },
        extensions: createVisualModeExtensions(),
      }),
      parent,
    });

    try {
      expect(view.state.doc.toString()).toBe(floatDoc);

      // Figure card shows filename, options, caption, and label
      const figureCard = parent.querySelector('.cm-visual-figure-card');
      expect(figureCard).not.toBeNull();
      expect(figureCard?.textContent).toContain('figures/plot.png');
      expect(figureCard?.textContent).toContain('width=0.8\\linewidth');
      expect(figureCard?.textContent).toContain('Training convergence curve.');
      expect(figureCard?.textContent).toContain('fig:results');

      // Only the valid tabular table is rendered as a card (invalid table falls back to raw LaTeX)
      const tableCards = parent.querySelectorAll('.cm-visual-table-card');
      expect(tableCards.length).toBe(1);
      const tableCard = tableCards[0]!;
      expect(tableCard.textContent).toContain('Benchmark metrics');
      expect(tableCard.textContent).toContain('tab:metrics');

      const headers = Array.from(tableCard.querySelectorAll('thead th')).map((el) =>
        el.textContent?.trim(),
      );
      expect(headers).toEqual(['Model', 'Accuracy']);

      const bodyCells = Array.from(tableCard.querySelectorAll('tbody td')).map((el) =>
        el.textContent?.trim(),
      );
      expect(bodyCells).toEqual(['Flux', '98.4%']);

      const alignments = Array.from(tableCard.querySelectorAll('thead th')).map(
        (el) => (el as HTMLElement).style.textAlign,
      );
      expect(alignments).toEqual(['left', 'right']);

      // Fallback table without \begin{tabular} stays visible as raw text
      expect(parent.querySelector('.cm-content')?.textContent).toContain('Plain placeholder note.');

      // Clicking "Edit LaTeX" on Figure card jumps cursor inside block and expands raw LaTeX
      const editBtn = figureCard?.querySelector('.cm-visual-float-edit-btn');
      editBtn?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      expect(parent.querySelector('.cm-visual-figure-card')).toBeNull();
      expect(parent.querySelector('.cm-content')?.textContent).toContain(
        '\\includegraphics[width=0.8\\linewidth]{figures/plot.png}',
      );
      expect(view.state.doc.toString()).toBe(floatDoc);
    } finally {
      view.destroy();
      parent.remove();
    }
  });

  it('renders description list terms and hides unfocused inline trailing comments while preserving escaped \\%', () => {
    const doc = [
      '\\begin{document}',
      'Lead paragraph.',
      '\\begin{description}',
      '\\item[Flux] Visual editor',
      '\\end{description}',
      'Value is 50\\% done % hidden note',
      '\\end{document}',
    ].join('\n');

    const parent = document.createElement('div');
    document.body.appendChild(parent);

    const view = new EditorView({
      state: EditorState.create({
        doc,
        selection: { anchor: doc.indexOf('Lead paragraph.') },
        extensions: createVisualModeExtensions(),
      }),
      parent,
    });

    try {
      const term = parent.querySelector('.cm-visual-list-term');
      expect(term?.textContent?.trim()).toBe('Flux');
      expect(parent.querySelector('.cm-content')?.textContent).toContain('Visual editor');

      const contentText = parent.querySelector('.cm-content')?.textContent ?? '';
      expect(contentText).toContain('50\\% done');
      expect(contentText).not.toContain('% hidden note');

      // Moving cursor onto the line reveals the inline comment losslessly
      view.dispatch({ selection: { anchor: doc.indexOf('50\\% done') } });
      expect(parent.querySelector('.cm-content')?.textContent).toContain('% hidden note');
      expect(view.state.doc.toString()).toBe(doc);
    } finally {
      view.destroy();
      parent.remove();
    }
  });

  it('renders href/url link chips and footnote badges and opens Table Wizard with initialLatex', () => {
    const doc = [
      '\\begin{document}',
      'Read \\href{https://overleaf.com}{Overleaf} and \\url{https://example.com}\\footnote{See \\textbf{Appendix A}.}.',
      '\\begin{table}[htbp]',
      '  \\begin{tabular}{cc}',
      '    \\hline',
      '    A & B \\\\',
      '    \\hline',
      '  \\end{tabular}',
      '\\end{table}',
      '\\end{document}',
    ].join('\n');

    const parent = document.createElement('div');
    document.body.appendChild(parent);

    const view = new EditorView({
      state: EditorState.create({
        doc,
        selection: { anchor: doc.indexOf('Read ') },
        extensions: createVisualModeExtensions(),
      }),
      parent,
    });

    const openedCommands: Array<{ dialog: string; initialLatex?: string }> = [];
    const unsub = editorCommandBus.subscribe('dialog:open', (cmd) => {
      openedCommands.push({
        dialog: cmd.dialog,
        initialLatex: cmd.payload?.initialLatex,
      });
    });

    try {
      const linkChips = Array.from(parent.querySelectorAll('.cm-visual-link-chip')).map((el) =>
        el.textContent?.trim(),
      );
      expect(linkChips).toEqual(['Overleaf', 'https://example.com']);

      const footnoteChip = parent.querySelector('.cm-visual-footnote-chip');
      expect(footnoteChip?.textContent).toBe('fn');
      expect(footnoteChip?.getAttribute('title')).toContain('Appendix A.');

      // Placing cursor inside \footnote{...} expands raw syntax losslessly
      view.dispatch({ selection: { anchor: doc.indexOf('Appendix A') } });
      expect(parent.querySelector('.cm-visual-footnote-chip')).toBeNull();
      expect(parent.querySelector('.cm-content')?.textContent).toContain('\\footnote{');

      // Clicking "Edit Table" dispatches table-wizard dialog with selected raw table LaTeX
      const wizardBtn = parent.querySelector('.cm-visual-float-wizard-btn');
      wizardBtn?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      expect(openedCommands.length).toBe(1);
      expect(openedCommands[0]?.dialog).toBe('table-wizard');
      expect(openedCommands[0]?.initialLatex).toContain('\\begin{tabular}{cc}');
      expect(view.state.doc.toString()).toBe(doc);
    } finally {
      unsub();
      view.destroy();
      parent.remove();
    }
  });

  it('resolves project image asset stream URLs for figure previews and returns null when unmatched', () => {
    const prevPageState = usePageStore.getState();
    const scopeId = 'page-visual-test';
    try {
      usePageStore.setState({
        spaceId: 'space-visual-test',
        projectId: 'proj-visual-test',
        rootPageId: scopeId,
        parentPageId: scopeId,
      });
      workspaceCoordinator.syncStructureItems(
        [
          {
            id: 'file-plot-1',
            fileId: 'file-plot-1',
            pageId: scopeId,
            projectId: 'proj-visual-test',
            filename: 'plot.png',
            path: 'figures/plot.png',
            isFolder: false,
          },
        ],
        scopeId,
      );

      const exactUrl = resolveProjectImageAssetUrl('./figures/plot.png');
      const stemUrl = resolveProjectImageAssetUrl('figures/plot');
      const baseUrl = resolveProjectImageAssetUrl('plot');
      const missingUrl = resolveProjectImageAssetUrl('figures/missing.png');

      expect(exactUrl).toContain('file-plot-1');
      expect(stemUrl).toBe(exactUrl);
      expect(baseUrl).toBe(exactUrl);
      expect(missingUrl).toBeNull();
    } finally {
      usePageStore.setState({
        spaceId: prevPageState.spaceId,
        projectId: prevPageState.projectId,
        rootPageId: prevPageState.rootPageId,
        parentPageId: prevPageState.parentPageId,
      });
    }
  });
});
