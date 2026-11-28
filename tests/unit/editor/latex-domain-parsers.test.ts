import { describe, it, expect } from 'vitest';
import {
  formatBibtexContent,
  parseBibDocument,
  serializeBibDocument,
  parseBibContent,
} from '@/features/editor/domain/latex/bib-parser';
import { formatItemToBibtex } from '@/features/editor/subsystems/citation';
import {
  escapeLatex,
  isTableData,
  parseTableToLatex,
  isImageData,
  generateFigureLatex,
} from '@/features/editor/domain/latex/smart-paste';
import {
  parseLatexStructure,
  getLineContext,
  formatContextForPrompt,
  type RichEditorContext,
} from '@/features/editor/domain/latex/latex-structure';
import {
  CANONICAL_MATH_SYMBOLS,
  getModalSymbols,
  getVisualSymbols,
} from '@/features/editor/domain/latex/latex-symbols';
import type { Item } from '@/features/library/types/core.types';

function createMockClipboard(data: {
  'text/plain'?: string;
  'text/html'?: string;
  items?: Array<{ type: string }>;
  files?: Array<{ type: string; name: string }>;
}): DataTransfer {
  return {
    getData: (format: string) => (data[format as keyof typeof data] as string) || '',
    items: (data.items || []).map((item) => ({
      type: item.type,
      kind: 'file',
      getAsFile: () => new File([''], 'test.png', { type: item.type }),
      getAsString: () => {},
      webkitGetAsEntry: () => null,
    })) as unknown as DataTransferItemList,
    files: (data.files || []).map((f) => new File([''], f.name, { type: f.type })) as unknown as FileList,
    types: Object.keys(data),
    clearData: () => {},
    setData: () => true,
    dropEffect: 'none',
    effectAllowed: 'uninitialized',
  } as unknown as DataTransfer;
}

describe('LaTeX Domain Parsers: BibTeX, Smart Paste, AST Structure & Canonical Symbols', () => {
  describe('1. BibTeX Formatting, Round-Trip & Citation Serialization', () => {
    it('formats raw BibTeX cleanly via bibtex-tidy while preserving UTF-8 and comments', () => {
      const raw = `% Header comment
@ARTICLE{vaswani2017,
AUTHOR="Vaswani, Ashish and Shazeer, Noam",
TITLE = {Phân tích {Attention} Is All You Need},
PAGES = {10–20},
YEAR = {2017},
}`;

      const formatted = formatBibtexContent(raw);
      expect(formatted).toContain('% Header comment');
      expect(formatted).toContain('@article{vaswani2017,');
      expect(formatted).toContain('  author = {Vaswani, Ashish and Shazeer, Noam},');
      expect(formatted).toContain('  title = {Phân tích {Attention} Is All You Need},');
      expect(formatted).toContain('  pages = {10--20},');
      expect(formatted).not.toMatch(/,\n\}/);
    });

    it('round-trips parseBibDocument -> serializeBibDocument and normalizes formatItemToBibtex', () => {
      const raw = `@string{NIPS = "NeurIPS"}

@inproceedings{devlin2019,
  title = {{BERT}: Pre-training of {Deep} Bidirectional Transformers},
  author = {Devlin, Jacob and Chang, Ming-Wei},
  booktitle = {NAACL},
  year = {2019}
}`;

      const doc = parseBibDocument(raw);
      expect(doc.preambleBlocks[0]).toContain('@string{NIPS');
      expect(doc.entries[0]?.key).toBe('devlin2019');
      expect(doc.entries[0]?.fields.title).toBe(
        '{BERT}: Pre-training of {Deep} Bidirectional Transformers',
      );

      const serialized = serializeBibDocument(doc);
      expect(serialized).toContain('@string{');
      expect(serialized).toContain('@inproceedings{devlin2019,');

      const entries = parseBibContent(
        `@incollection{smith2024, title = {Deep {NLP} Systems}, author = {Smith, Jane and Doe, John}, year = {2024}}`,
        'references.bib',
      );
      expect(entries[0]?.title).toBe('Deep {NLP} Systems');
      expect(entries[0]?.authors).toEqual(['Smith, Jane', 'Doe, John']);

      const itemBib = formatItemToBibtex({
        id: 'item-1',
        citationKey: 'nguyen2025',
        itemType: 'bookSection',
        title: 'Chương 1',
        authors: ['Nguyễn, Văn A'],
        publicationTitle: 'Tuyển tập AI',
        year: 2025,
      } as unknown as Item);
      expect(itemBib).toContain('@incollection{nguyen2025,');
      expect(itemBib).toContain('  booktitle = {Tuyển tập AI},');
    });
  });

  describe('2. Smart Paste (LaTeX Escaping, TSV/HTML Tables & Figures)', () => {
    it('escapes special LaTeX characters and detects tabular/image clipboard payloads', () => {
      expect(escapeLatex('Profit & Loss 100% with $50_fee #1')).toBe(
        'Profit \\& Loss 100\\% with \\$50\\_fee \\#1',
      );
      expect(escapeLatex('Special ~ and ^ characters')).toBe(
        'Special \\textasciitilde{} and \\textasciicircum{} characters',
      );
      expect(escapeLatex('')).toBe('');

      expect(isTableData(createMockClipboard({ 'text/plain': 'H1\tH2\nV1\tV2\n' }))).toBe(true);
      expect(isTableData(createMockClipboard({ 'text/plain': 'Plain text\nLine 2' }))).toBe(false);
      expect(
        isTableData(createMockClipboard({ 'text/html': '<table><tr><td>1</td></tr></table>' })),
      ).toBe(true);

      expect(isImageData(createMockClipboard({ items: [{ type: 'image/png' }] }))).toBe(true);
      expect(isImageData(createMockClipboard({ 'text/plain': 'Just text' }))).toBe(false);
    });

    it('converts TSV to booktabs or hline LaTeX tables and generates figure markup', () => {
      const booktabsLatex = parseTableToLatex(
        createMockClipboard({
          'text/plain': 'Item\tQuantity\tPrice ($)\nApples\t10\t15%\n',
        }),
        { caption: 'Fruit Inventory', label: 'tab:fruits' },
      );
      expect(booktabsLatex).toContain('\\caption{Fruit Inventory}');
      expect(booktabsLatex).toContain('\\label{tab:fruits}');
      expect(booktabsLatex).toContain('\\toprule');
      expect(booktabsLatex).toContain('Item & Quantity & Price (\\$) \\\\');
      expect(booktabsLatex).toContain('Apples & 10 & 15\\% \\\\');
      expect(booktabsLatex).toContain('\\bottomrule');

      const hlineLatex = parseTableToLatex(
        createMockClipboard({ 'text/plain': 'A\tB\n1\t2\n' }),
        { booktabs: false, alignment: 'left' },
      );
      expect(hlineLatex).toContain('\\begin{tabular}{l l}');
      expect(hlineLatex).toContain('\\hline');
      expect(hlineLatex).not.toContain('\\toprule');

      const fig = generateFigureLatex('my-chart.png', 'Performance Benchmark');
      expect(fig).toContain('\\includegraphics[width=0.8\\linewidth]{my-chart.png}');
      expect(fig).toContain('\\caption{Performance Benchmark}');
      expect(fig).toContain('\\label{fig:my-chart}');
    });
  });

  describe('3. LaTeX AST Structure & Canonical Math Symbol Palette', () => {
    const sampleLatex = `\\documentclass{article}
\\usepackage{amsmath}
\\usepackage{graphicx}

\\begin{document}

\\section{Introduction}
\\label{sec:intro}
This is the intro with a citation \\cite{einstein1905}.

\\begin{equation}
E = mc^2
\\label{eq:emc}
\\end{equation}

\\subsection{Background}
Some background text here.

\\begin{figure}
\\centering
\\caption{Sample figure}
\\label{fig:sample}
\\end{figure}

\\end{document}`;

    it('parses sections, environments, packages, labels, citations, and formats prompt context', () => {
      const structure = parseLatexStructure(sampleLatex);
      expect(structure.sections).toEqual([
        { level: 'section', title: 'Introduction', startLine: 7 },
        { level: 'subsection', title: 'Background', startLine: 16 },
      ]);
      expect(structure.environments.find((e) => e.type === 'equation')).toMatchObject({
        startLine: 11,
        endLine: 14,
      });
      expect(structure.packages).toEqual(expect.arrayContaining(['amsmath', 'graphicx']));
      expect(structure.labels).toEqual(
        expect.arrayContaining(['sec:intro', 'eq:emc', 'fig:sample']),
      );
      expect(structure.citations).toContain('einstein1905');

      expect(getLineContext(12, structure)).toEqual({
        section: '\\section{Introduction}',
        environment: 'equation',
      });
      expect(getLineContext(17, structure)).toEqual({
        section: '\\subsection{Background}',
        environment: null,
      });

      const richCtx: RichEditorContext = {
        filename: 'main.tex',
        fileContent: sampleLatex,
        totalLines: 26,
        selectedText: 'E = mc^2',
        hasSelection: true,
        startLine: 12,
        endLine: 12,
        startCol: 1,
        endCol: 9,
        selectedLineCount: 1,
        selectedCharCount: 8,
        selectedWordCount: 3,
        contextBefore: '\\begin{equation}',
        contextAfter: '\\end{equation}',
        currentSection: '\\section{Introduction}',
        currentEnvironment: 'equation',
        structure,
        cursorLine: 12,
        cursorCol: 5,
        cursorContext: 'E = mc^2',
      };
      const promptText = formatContextForPrompt(richCtx);
      expect(promptText).toContain('File: main.tex');
      expect(promptText).toContain('Current section: \\section{Introduction}');
      expect(promptText).toContain('Inside environment: \\begin{equation}');
    });

    it('maintains unique CANONICAL_MATH_SYMBOLS and maps modal & visual symbol projections', () => {
      expect(CANONICAL_MATH_SYMBOLS.length).toBeGreaterThan(50);
      const ids = CANONICAL_MATH_SYMBOLS.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);

      const modalSymbols = getModalSymbols();
      expect(modalSymbols).toHaveLength(CANONICAL_MATH_SYMBOLS.length);
      expect(modalSymbols[0]).toEqual(
        expect.objectContaining({
          command: expect.any(String),
          display: expect.any(String),
          name: expect.any(String),
          category: expect.any(String),
        }),
      );

      const visualSymbols = getVisualSymbols();
      expect(visualSymbols).toHaveLength(CANONICAL_MATH_SYMBOLS.length);
      expect(visualSymbols[0]).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          latex: expect.any(String),
          previewLatex: expect.any(String),
          keywords: expect.any(Array),
        }),
      );
    });
  });
});
