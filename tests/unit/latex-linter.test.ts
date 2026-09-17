import { describe, it, expect } from 'vitest';
import {
  maskLatexSyntax,
  lintLatexStructure,
  checkLatexSpelling,
  runLatexLinter,
} from '@/features/editor/utils/latex-linter.util';

describe('LaTeX Linter & Spellchecker Engine (Overleaf latexqc standards)', () => {
  describe('1. LaTeX Syntax Masking (Preserving Line & Col Coordinates)', () => {
    it('should mask comments while preserving exact string length', () => {
      const input = 'Hello World % this is a comment\nNext Line';
      const masked = maskLatexSyntax(input);

      expect(masked.length).toBe(input.length);
      expect(masked.split('\n').length).toBe(input.split('\n').length);
      expect(masked).toContain('Hello World');
      expect(masked).not.toContain('this is a comment');
    });

    it('should mask inline and display math without affecting surroundings', () => {
      const input = 'Equation $E = mc^2$ holds.\nAlso $$a^2 + b^2 = c^2$$ holds.';
      const masked = maskLatexSyntax(input);

      expect(masked.length).toBe(input.length);
      expect(masked).toContain('Equation');
      expect(masked).toContain('holds.');
      expect(masked).not.toContain('mc^2');
      expect(masked).not.toContain('a^2 + b^2');
    });

    it('should mask citations, labels, and package references', () => {
      const input = 'As shown in \\cite{vaswani2017attention} and \\ref{sec:methods}, we propose...';
      const masked = maskLatexSyntax(input);

      expect(masked.length).toBe(input.length);
      expect(masked).not.toContain('vaswani2017attention');
      expect(masked).not.toContain('sec:methods');
      expect(masked).toContain('propose');
    });
  });

  describe('2. Structural Integrity Linting', () => {
    it('should flag unclosed environments', () => {
      const input = '\\begin{equation}\nE = mc^2\n';
      const diags = lintLatexStructure(input);

      const unclosed = diags.find((d) => d.code === 'UNCLOSED_ENV');
      expect(unclosed).toBeDefined();
      expect(unclosed?.message).toContain('\\begin{equation}');
      expect(unclosed?.startLineNumber).toBe(1);
    });

    it('should flag mismatched environments', () => {
      const input = '\\begin{itemize}\n\\item Hello\n\\end{enumerate}';
      const diags = lintLatexStructure(input);

      const mismatch = diags.find((d) => d.code === 'MISMATCHED_ENV');
      expect(mismatch).toBeDefined();
      expect(mismatch?.message).toContain('Mismatched environment');
      expect(mismatch?.suggestions).toContain('\\end{itemize}');
    });

    it('should flag extra \\end{} without matching \\begin{}', () => {
      const input = 'Some text\n\\end{table}';
      const diags = lintLatexStructure(input);

      const extra = diags.find((d) => d.code === 'EXTRA_END_ENV');
      expect(extra).toBeDefined();
      expect(extra?.message).toContain('\\end{table}');
    });

    it('should flag deprecated LaTeX 2.09 commands', () => {
      const input = 'This is {\\bf bold text} and {\\it italic text}.';
      const diags = lintLatexStructure(input);

      const bfDiag = diags.find((d) => d.message.includes('\\textbf'));
      expect(bfDiag).toBeDefined();
      expect(bfDiag?.code).toBe('DEPRECATED_COMMAND');
      expect(bfDiag?.suggestions).toContain('\\textbf{...}');
    });

    it('should flag empty reference arguments', () => {
      const input = 'See equation \\eqref{} or reference \\cite{}.';
      const diags = lintLatexStructure(input);

      const emptyRefs = diags.filter((d) => d.code === 'EMPTY_REFERENCE');
      expect(emptyRefs.length).toBe(2);
    });

    it('should flag consecutive repeated words', () => {
      const input = 'We observe that the the model achieves high accuracy.';
      const diags = lintLatexStructure(input);

      const repDiag = diags.find((d) => d.code === 'REPEATED_WORD');
      expect(repDiag).toBeDefined();
      expect(repDiag?.message).toContain("Repeated word 'the'");
    });

    it('should flag whitespace preceding punctuation', () => {
      const input = 'Our experimental results , shown below , indicate success .';
      const diags = lintLatexStructure(input);

      const spacePunct = diags.filter((d) => d.code === 'SPACE_BEFORE_PUNCT');
      expect(spacePunct.length).toBe(3);
    });
  });

  describe('3. Academic-Aware Spellchecker', () => {
    it('should produce zero false positives on standard academic terminology', () => {
      const manuscript = `
        \\section{Methodology}
        We present a stochastic optimization framework for convolutional neural networks.
        The algorithm computes the eigenvalues of the Hessian matrix.
        We benchmark our transformer architecture on heterogeneous datasets with comprehensive ablation.
      `;
      const masked = maskLatexSyntax(manuscript);
      const diags = checkLatexSpelling(manuscript, masked);

      expect(diags).toHaveLength(0);
    });

    it('should detect misspelled words in prose', () => {
      const manuscript = 'We conduct an expiriment using our novel methedology.';
      const masked = maskLatexSyntax(manuscript);
      const diags = checkLatexSpelling(manuscript, masked);

      const misspelledWords = diags.map((d) => d.message);
      expect(misspelledWords.some((m) => m.includes('expiriment'))).toBe(true);
      expect(misspelledWords.some((m) => m.includes('methedology'))).toBe(true);
    });

    it('should ignore uppercase acronyms like GPU, CPU, BERT', () => {
      const manuscript = 'The model runs on GPU and CPU using BERT embeddings.';
      const masked = maskLatexSyntax(manuscript);
      const diags = checkLatexSpelling(manuscript, masked);

      expect(diags).toHaveLength(0);
    });
  });

  describe('4. Full runLatexLinter Integration', () => {
    it('should correctly combine structure linting and spellchecking', () => {
      const content = `
        \\section{Introduction}
        The the model is initialized with \\bf bold weights.
        \\begin{equation}
        y = Wx + b
      `;
      const results = runLatexLinter(content);

      expect(results.some((r) => r.code === 'REPEATED_WORD')).toBe(true);
      expect(results.some((r) => r.code === 'DEPRECATED_COMMAND')).toBe(true);
      expect(results.some((r) => r.code === 'UNCLOSED_ENV')).toBe(true);
    });
  });
});
