import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import {
  parseDocumentOutline,
  parseLatexHeadings,
  cleanLatexTitle,
} from '@/features/editor/subsystems/compiler/synctex/pdf-outline';
import {
  LatexSymbolsIndexCore,
  buildOutlineTree,
  type OutlineItem,
} from '@/features/editor/domain/latex/latex-symbols-core';
import { latexSymbolsIndex } from '@/features/editor/domain/latex/latex-symbols-index';
import { FileOutlineSection } from '@/features/editor/subsystems/explorer/ui/subcomponents/FileOutlineSection';
import { editorCommandBus, useLayoutStore } from '@/features/editor/core';
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

  describe('3. FileOutlineSection UI: Overleaf File Tree Outline & Section Jump Navigation', () => {
    it('renders FileOutlineSection with headings, figures, and tables extracted from document content', () => {
      useLayoutStore.setState({ fileOutlineOpen: true });

      const docContent = `\\section{System Overview}
\\begin{figure}
  \\caption{Flowchart Architecture}
\\end{figure}
\\begin{table}
  \\caption{Benchmark Metrics}
\\end{table}`;

      render(
        <TooltipProvider>
          <FileOutlineSection
            isFileTreeOpen={true}
            docContent={docContent}
            activeFileName="main.tex"
          />
        </TooltipProvider>
      );

      expect(screen.getByText('File Outline')).toBeInTheDocument();
      expect(screen.getByText('System Overview')).toBeInTheDocument();
      expect(screen.getByText(/Flowchart Architecture/)).toBeInTheDocument();
      expect(screen.getByText(/Benchmark Metrics/)).toBeInTheDocument();
    });

    it('toggles FileOutlineSection collapse and expand via useLayoutStore', () => {
      useLayoutStore.setState({ fileOutlineOpen: true });

      render(
        <TooltipProvider>
          <FileOutlineSection
            isFileTreeOpen={true}
            docContent={`\\section{Main Body}`}
            activeFileName="doc.tex"
          />
        </TooltipProvider>
      );

      expect(screen.getByText('Main Body')).toBeInTheDocument();

      // Click accordion header to collapse
      fireEvent.click(screen.getByRole('button', { name: /collapse file outline/i }));
      expect(useLayoutStore.getState().fileOutlineOpen).toBe(false);
      expect(screen.queryByText('Main Body')).not.toBeInTheDocument();

      // Click accordion header to expand
      fireEvent.click(screen.getByRole('button', { name: /expand file outline/i }));
      expect(useLayoutStore.getState().fileOutlineOpen).toBe(true);
      expect(screen.getByText('Main Body')).toBeInTheDocument();
    });

    it('dispatches editor:jump-to-line and synctex:forward when an outline item is clicked', () => {
      useLayoutStore.setState({ fileOutlineOpen: true });
      const dispatchSpy = vi.spyOn(editorCommandBus, 'dispatch');

      render(
        <TooltipProvider>
          <FileOutlineSection
            isFileTreeOpen={true}
            docContent={`\\section{Jump Target Section}`}
            activeFileName="main.tex"
          />
        </TooltipProvider>
      );

      const sectionButton = screen.getByText('Jump Target Section');
      fireEvent.click(sectionButton);

      // Verify editor jump command
      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'editor:jump-to-line',
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
