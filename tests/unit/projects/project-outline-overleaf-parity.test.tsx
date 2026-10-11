import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import {
  parseDocumentOutline,
  parseLatexHeadings,
  cleanLatexTitle,
} from '@/features/editor/domain/pdf/pdf-outline';
import {
  LatexSymbolsIndexCore,
  buildOutlineTree,
  type OutlineItem,
} from '@/features/editor/domain/latex/latex-symbols-core';
import { latexSymbolsIndex } from '@/features/editor/domain/latex/latex-symbols-index';
import { OutlineTab } from '@/features/editor/ui/features/sidebar/outline/OutlineTab';
import { editorCommandBus } from '@/features/editor/coordinators/command-bus';
import { usePageStore } from '@/features/editor/store/editor.store';
import { TooltipProvider } from '@/shared/components/ui/tooltip';

describe('Phase 13: Project Outline & Section Jump Navigation (Overleaf Parity)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    latexSymbolsIndex.clear();
  });

  afterEach(() => {
    cleanup();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  describe('1. LaTeX Headings, Figures & Tables Caption Extraction (pdf-outline)', () => {
    it('cleans LaTeX commands, math symbols, and labels from titles', () => {
      const raw = '\\textbf{Deep Learning} for \\emph{Quantum} Physics: $E=mc^2$ \\label{sec:intro} \\cite{einstein1905}';
      const cleaned = cleanLatexTitle(raw);
      expect(cleaned).toBe('Deep Learning for Quantum Physics: E=mc^2');
    });

    it('extracts figures and tables with captions into structured outline entries', () => {
      const latex = `
\\documentclass{article}
\\begin{document}
\\section{Experimental Setup}
Some preliminary text.

\\begin{figure}[htbp]
  \\centering
  \\includegraphics[width=0.8\\linewidth]{diagram.png}
  \\caption{System architecture and data pipeline}
  \\label{fig:arch}
\\end{figure}

\\subsection{Evaluation Results}

\\begin{table}[h]
  \\centering
  \\begin{tabular}{cc}
    A & B \\\\
  \\end{tabular}
  \\caption{Accuracy benchmark across models}
  \\label{tab:results}
\\end{table}

\\end{document}
`;
      const entries = parseDocumentOutline(latex);

      // Section, Figure, Subsection, Table
      expect(entries.length).toBe(4);

      // 1. Section
      expect(entries[0].levelName).toBe('Section');
      expect(entries[0].title).toBe('Experimental Setup');
      expect(entries[0].type).toBe('section');

      // 2. Figure
      expect(entries[1].levelName).toBe('Figure');
      expect(entries[1].title).toBe('Fig: System architecture and data pipeline');
      expect(entries[1].type).toBe('figure');
      expect(entries[1].level).toBe(3);

      // 3. Subsection
      expect(entries[2].levelName).toBe('Subsection');
      expect(entries[2].title).toBe('Evaluation Results');
      expect(entries[2].type).toBe('subsection');

      // 4. Table
      expect(entries[3].levelName).toBe('Table');
      expect(entries[3].title).toBe('Tab: Accuracy benchmark across models');
      expect(entries[3].type).toBe('table');
      expect(entries[3].level).toBe(3);
    });

    it('captures starred sections, appendices, and abstracts', () => {
      const latex = `
\\documentclass{article}
\\begin{document}
\\begin{abstract}
This paper explores real-time collaborative editing.
\\end{abstract}

\\section*{Unnumbered Overview}
Overview body.

\\appendix
\\section{Mathematical Proofs}
Proofs body.
\\end{document}
`;
      const entries = parseLatexHeadings(latex);

      expect(entries.some((e) => e.levelName === 'Abstract')).toBe(true);
      expect(entries.some((e) => e.title === 'Unnumbered Overview')).toBe(true);
      expect(entries.some((e) => e.levelName === 'Appendix')).toBe(true);
      expect(entries.some((e) => e.title === 'Mathematical Proofs')).toBe(true);
    });
  });

  describe('2. Multi-File Project Outline Aggregation (latex-symbols-core)', () => {
    it('indexes figures, tables, and sections in symbol core', () => {
      const core = new LatexSymbolsIndexCore();
      core.indexFile(
        'file-1',
        'main.tex',
        `\\section{Introduction}
\\begin{figure}
  \\caption{Overview diagram}
\\end{figure}`
      );

      const snapshot = core.exportSnapshot();
      const items = snapshot.flatOutlineByFile['main.tex'];
      expect(items).toBeDefined();
      expect(items.length).toBe(2);
      expect(items[0].type).toBe('section');
      expect(items[1].type).toBe('figure');
      expect(items[1].title).toContain('Overview diagram');
    });

    it('aggregates multi-file outlines via \\input and \\include in correct document order', () => {
      const core = new LatexSymbolsIndexCore();

      // Main file includes chapter1 and chapter2
      core.indexFile(
        'main-id',
        'main.tex',
        `\\documentclass{book}
\\begin{document}
\\chapter{Opening Remarks}
\\input{chapters/chapter1.tex}
\\chapter{Concluding Remarks}
\\include{chapters/chapter2.tex}
\\end{document}`
      );

      // Chapter 1 subfile
      core.indexFile(
        'ch1-id',
        'chapters/chapter1.tex',
        `\\section{Deep Dive into Chapter 1}
\\subsection{Sub-analysis}
\\begin{table}
  \\caption{Performance Table}
\\end{table}`
      );

      // Chapter 2 subfile
      core.indexFile(
        'ch2-id',
        'chapters/chapter2.tex',
        `\\section{Future Work in Chapter 2}`
      );

      const snapshot = core.exportSnapshot();
      const projFlat = snapshot.projectFlatOutline;
      expect(projFlat).toBeDefined();

      // Expected order:
      // 1. Opening Remarks (main.tex)
      // 2. Deep Dive into Chapter 1 (chapter1.tex)
      // 3. Sub-analysis (chapter1.tex)
      // 4. Performance Table (chapter1.tex)
      // 5. Concluding Remarks (main.tex)
      // 6. Future Work in Chapter 2 (chapter2.tex)
      expect(projFlat?.map((it) => it.title)).toEqual([
        'Opening Remarks',
        'Deep Dive into Chapter 1',
        'Sub-analysis',
        'Tab: Performance Table',
        'Concluding Remarks',
        'Future Work in Chapter 2',
      ]);

      // Verify sourceFile tracking on items
      expect(projFlat?.[0].sourceFile).toBe('main.tex');
      expect(projFlat?.[1].sourceFile).toBe('chapters/chapter1.tex');
      expect(projFlat?.[4].sourceFile).toBe('main.tex');
      expect(projFlat?.[5].sourceFile).toBe('chapters/chapter2.tex');

      // Verify tree structure nesting
      const projTree = snapshot.projectOutline;
      expect(projTree).toBeDefined();
      expect(projTree?.length).toBe(2); // Two root chapters
      expect(projTree?.[0].title).toBe('Opening Remarks');
      expect(projTree?.[0].children.length).toBe(1); // Section in chapter1
      expect(projTree?.[0].children[0].title).toBe('Deep Dive into Chapter 1');
    });
  });

  describe('3. OutlineTab UI: Scopes, Filtering & Section Jump Navigation', () => {
    it('renders OutlineTab with Project and File scope switcher and category filter', () => {
      // Mock active document
      usePageStore.setState({
        currentPage: { id: 'main-id', title: 'main.tex' } as any,
        activeFilePage: { id: 'main-id', title: 'main.tex' } as any,
      });

      // Populate latexSymbolsIndex with project symbols
      latexSymbolsIndex.indexFile(
        'main-id',
        'main.tex',
        `\\section{System Overview}
\\begin{figure}
  \\caption{Flowchart Architecture}
\\end{figure}`,
        true
      );

      render(
        <TooltipProvider>
          <OutlineTab />
        </TooltipProvider>
      );

      // Scope buttons exist
      expect(screen.getByRole('button', { name: /project/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /file/i })).toBeInTheDocument();

      // Category filters exist
      expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Sec' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Fig/Tab' })).toBeInTheDocument();

      // Heading items are visible
      expect(screen.getByText('System Overview')).toBeInTheDocument();
      expect(screen.getByText(/Flowchart Architecture/)).toBeInTheDocument();
    });

    it('filters outline by category (Sec vs Fig/Tab)', () => {
      usePageStore.setState({
        currentPage: { id: 'test-doc', title: 'doc.tex' } as any,
        activeFilePage: { id: 'test-doc', title: 'doc.tex' } as any,
      });

      latexSymbolsIndex.indexFile(
        'test-doc',
        'doc.tex',
        `\\section{Main Body}
\\begin{figure}
  \\caption{My Figure}
\\end{figure}`,
        true
      );

      render(
        <TooltipProvider>
          <OutlineTab />
        </TooltipProvider>
      );

      // Filter to Sections only
      fireEvent.click(screen.getByRole('button', { name: 'Sec' }));
      expect(screen.getByText('Main Body')).toBeInTheDocument();
      expect(screen.queryByText(/My Figure/)).not.toBeInTheDocument();

      // Filter to Figures & Tables only
      fireEvent.click(screen.getByRole('button', { name: 'Fig/Tab' }));
      expect(screen.queryByText('Main Body')).not.toBeInTheDocument();
      expect(screen.getByText(/My Figure/)).toBeInTheDocument();
    });

    it('dispatches navigation:jump-to-line and synctex:forward when an outline item is clicked', () => {
      usePageStore.setState({
        currentPage: { id: 'main-id', title: 'main.tex' } as any,
        activeFilePage: { id: 'main-id', title: 'main.tex' } as any,
      });

      latexSymbolsIndex.indexFile(
        'main-id',
        'main.tex',
        `\\section{Jump Target Section}`,
        true
      );

      const dispatchSpy = vi.spyOn(editorCommandBus, 'dispatch');

      render(
        <TooltipProvider>
          <OutlineTab />
        </TooltipProvider>
      );

      const sectionButton = screen.getByText('Jump Target Section');
      fireEvent.click(sectionButton);

      // Verify cross-file jump command
      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'navigation:jump-to-line',
          filePath: 'main.tex',
          line: 1,
          highlight: 'synctex',
        })
      );

      // Verify SyncTeX forward synchronization to PDF viewer
      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'synctex:forward',
          line: 1,
        })
      );
    });
  });
});
