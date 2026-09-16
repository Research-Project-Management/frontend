import { describe, it, expect } from 'vitest';
import {
  LATEX_SNIPPETS,
  findMatchingEnvironmentRanges,
} from '@/features/editor/components/editor/latex-snippets.provider';

describe('LATEX_SNIPPETS Knowledge Base', () => {
  it('should contain rich scientific and publishing snippets (Floating, Math, Theorems, Beamer, BibTeX)', () => {
    expect(LATEX_SNIPPETS.length).toBeGreaterThanOrEqual(40);

    const labels = LATEX_SNIPPETS.map((s) => s.label);

    // Floating & Tables
    expect(labels).toContain('\\begin{figure}');
    expect(labels).toContain('\\begin{subfigure}');
    expect(labels).toContain('\\begin{table}');
    expect(labels).toContain('\\begin{algorithm}');
    expect(labels).toContain('\\begin{lstlisting}');
    expect(labels).toContain('\\begin{minted}');

    // Math & Matrices
    expect(labels).toContain('\\begin{equation}');
    expect(labels).toContain('\\begin{align}');
    expect(labels).toContain('\\begin{cases}');
    expect(labels).toContain('\\begin{bmatrix}');
    expect(labels).toContain('\\begin{pmatrix}');
    expect(labels).toContain('\\begin{vmatrix}');
    expect(labels).toContain('\\left( ... \\right)');

    // Theorems & Proofs
    expect(labels).toContain('\\begin{theorem}');
    expect(labels).toContain('\\begin{lemma}');
    expect(labels).toContain('\\begin{corollary}');
    expect(labels).toContain('\\begin{definition}');
    expect(labels).toContain('\\begin{proof}');

    // Beamer Presentation
    expect(labels).toContain('\\begin{frame}');
    expect(labels).toContain('\\begin{block}');
    expect(labels).toContain('\\begin{columns}');

    // BibTeX Templates
    expect(labels).toContain('@article');
    expect(labels).toContain('@inproceedings');
    expect(labels).toContain('@book');
    expect(labels).toContain('@techreport');
    expect(labels).toContain('@misc');
  });

  it('should ensure all snippets have required metadata and tab-stop placeholders', () => {
    for (const snippet of LATEX_SNIPPETS) {
      expect(snippet.label).toBeTruthy();
      expect(snippet.detail).toBeTruthy();
      expect(snippet.documentation).toBeTruthy();
      expect(snippet.snippet).toBeTruthy();
      expect(snippet.snippet).toContain('$');
      expect(snippet.prefixes).toBeDefined();
      expect(snippet.prefixes?.length).toBeGreaterThan(0);
    }
  });

  it('should associate common shorthand prefixes with snippets', () => {
    const figSnippet = LATEX_SNIPPETS.find((s) => s.label === '\\begin{figure}');
    expect(figSnippet?.prefixes).toContain('fig');

    const subfigSnippet = LATEX_SNIPPETS.find((s) => s.label === '\\begin{subfigure}');
    expect(subfigSnippet?.prefixes).toContain('subfig');

    const tabSnippet = LATEX_SNIPPETS.find((s) => s.label === '\\begin{table}');
    expect(tabSnippet?.prefixes).toContain('tab');

    const eqSnippet = LATEX_SNIPPETS.find((s) => s.label === '\\begin{equation}');
    expect(eqSnippet?.prefixes).toContain('eq');

    const bmatSnippet = LATEX_SNIPPETS.find((s) => s.label === '\\begin{bmatrix}');
    expect(bmatSnippet?.prefixes).toContain('bmat');

    const codeSnippet = LATEX_SNIPPETS.find((s) => s.label === '\\begin{lstlisting}');
    expect(codeSnippet?.prefixes).toContain('code');

    const frameSnippet = LATEX_SNIPPETS.find((s) => s.label === '\\begin{frame}');
    expect(frameSnippet?.prefixes).toContain('frame');

    const articleSnippet = LATEX_SNIPPETS.find((s) => s.label === '@article');
    expect(articleSnippet?.prefixes).toContain('article');
  });
});

describe('findMatchingEnvironmentRanges (Linked Editing)', () => {
  const createMockModel = (lines: string[]) => ({
    getLineCount: () => lines.length,
    getLineContent: (lineNumber: number) => lines[lineNumber - 1] ?? '',
  });

  it('should link \\begin{equation} to \\end{equation} when cursor is at begin tag', () => {
    const lines = [
      '\\section{Math}',
      '\\begin{equation}',
      '  E = mc^2',
      '\\end{equation}',
      'Some text.',
    ];
    const model = createMockModel(lines) as any;

    // Line 2: \begin{equation} -> environment name 'equation' starts at column 8, ends at 15
    const pos = { lineNumber: 2, column: 10 };
    const match = findMatchingEnvironmentRanges(model, pos);

    expect(match).not.toBeNull();
    expect(match?.envName).toBe('equation');
    expect(match?.beginRange).toEqual({
      startLineNumber: 2,
      startColumn: 8,
      endLineNumber: 2,
      endColumn: 16,
    });
    expect(match?.endRange).toEqual({
      startLineNumber: 4,
      startColumn: 6,
      endLineNumber: 4,
      endColumn: 14,
    });
  });

  it('should link \\end{align} to \\begin{align} when cursor is at end tag', () => {
    const lines = [
      '\\begin{align}',
      '  a &= b \\\\',
      '  c &= d',
      '\\end{align}',
    ];
    const model = createMockModel(lines) as any;

    // Line 4: \end{align} -> environment name 'align' starts at column 6
    const pos = { lineNumber: 4, column: 8 };
    const match = findMatchingEnvironmentRanges(model, pos);

    expect(match).not.toBeNull();
    expect(match?.envName).toBe('align');
    expect(match?.beginRange).toEqual({
      startLineNumber: 1,
      startColumn: 8,
      endLineNumber: 1,
      endColumn: 13,
    });
    expect(match?.endRange).toEqual({
      startLineNumber: 4,
      startColumn: 6,
      endLineNumber: 4,
      endColumn: 11,
    });
  });

  it('should handle nested environments with the same name correctly', () => {
    const lines = [
      '\\begin{itemize}',
      '  \\item Outer 1',
      '  \\begin{itemize}',
      '    \\item Inner 1',
      '  \\end{itemize}',
      '  \\item Outer 2',
      '\\end{itemize}',
    ];
    const model = createMockModel(lines) as any;

    // Cursor on outer \begin{itemize} (Line 1)
    const matchOuter = findMatchingEnvironmentRanges(model, { lineNumber: 1, column: 10 });
    expect(matchOuter).not.toBeNull();
    expect(matchOuter?.beginRange.startLineNumber).toBe(1);
    expect(matchOuter?.endRange.startLineNumber).toBe(7);

    // Cursor on inner \begin{itemize} (Line 3)
    const matchInner = findMatchingEnvironmentRanges(model, { lineNumber: 3, column: 12 });
    expect(matchInner).not.toBeNull();
    expect(matchInner?.beginRange.startLineNumber).toBe(3);
    expect(matchInner?.endRange.startLineNumber).toBe(5);
  });

  it('should return null when cursor is outside environment tags', () => {
    const lines = [
      '\\section{Introduction}',
      'This is standard text with no environment.',
    ];
    const model = createMockModel(lines) as any;

    const match = findMatchingEnvironmentRanges(model, { lineNumber: 2, column: 10 });
    expect(match).toBeNull();
  });
});
