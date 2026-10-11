import { describe, it, expect } from 'vitest';
import {
  latexToHtml,
  htmlToLatex,
  renderChemHtml,
  renderMathHtml,
} from '@/features/editor/domain/latex/latex-converter';
import {
  isTableData,
  parseTableToLatex,
} from '@/features/editor/domain/latex/smart-paste';

describe('Overleaf 1:1 Parity Visual Mode Enhancements', () => {
  describe('Figure Parsing & Serialization Round-trip', () => {
    it('accurately parses a full LaTeX figure environment into HTML representation', () => {
      const latex = `
\\begin{figure}[htbp]
  \\centering
  \\includegraphics[width=0.85\\linewidth]{figures/arch.png}
  \\caption{System Architecture Overview}
  \\label{fig:arch}
\\end{figure}
      `.trim();

      const html = latexToHtml(latex);
      expect(html).toContain('latex-figure-wrapper');
      expect(html).toContain('data-src="figures%2Farch.png"');
      expect(html).toContain('data-placement="htbp"');
      expect(html).toContain('data-centering="true"');
      expect(html).toContain('System Architecture Overview');
      expect(html).toContain('data-label="fig%3Aarch"');
    });

    it('round-trip serializes parsed figure back to valid LaTeX', () => {
      const latex = `
\\begin{figure}[t!]
  \\centering
  \\includegraphics[scale=0.5]{plots/convergence.pdf}
  \\caption{Training Loss over Epochs}
  \\label{fig:loss}
\\end{figure}
      `.trim();

      const html = latexToHtml(latex);
      const restored = htmlToLatex(html);

      expect(restored).toContain('\\begin{figure}[t!]');
      expect(restored).toContain('\\centering');
      expect(restored).toContain('plots/convergence.pdf');
      expect(restored).toContain('\\caption{Training Loss over Epochs}');
      expect(restored).toContain('\\label{fig:loss}');
      expect(restored).toContain('\\end{figure}');
    });
  });

  describe('Chemical Formulas (\\ce{...} mhchem parity)', () => {
    it('renders chemical formulas using KaTeX mhchem without error', () => {
      const waterHtml = renderChemHtml('H2O');
      expect(waterHtml).toContain('katex');
      expect(waterHtml).not.toContain('chem-error');

      const reactionHtml = renderChemHtml('CO2 + C -> 2 CO');
      expect(reactionHtml).toContain('katex');
      expect(reactionHtml).not.toContain('chem-error');
    });

    it('renders standard and display math via renderMathHtml', () => {
      const inlineMath = renderMathHtml('E = mc^2', false);
      expect(inlineMath).toContain('katex');

      const displayMath = renderMathHtml('\\int_{0}^{\\infty} e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}', true);
      expect(displayMath).toContain('katex-display');
    });
  });

  describe('Smart Paste (Excel / TSV to LaTeX Tabular)', () => {
    it('detects and converts tab-separated values into LaTeX table', () => {
      const tsvData = 'Name\tScore\tRank\nAlice\t98\t1\nBob\t92\t2';
      const mockClipboard = {
        getData: (format: string) => {
          if (format === 'text/plain') return tsvData;
          return '';
        },
      } as unknown as DataTransfer;

      expect(isTableData(mockClipboard)).toBe(true);

      const latex = parseTableToLatex(mockClipboard, {
        caption: 'Student Results',
        label: 'tab:results',
      });

      expect(latex).toContain('\\begin{table}[htbp]');
      expect(latex).toContain('\\caption{Student Results}');
      expect(latex).toContain('\\begin{tabular}{c c c}');
      expect(latex).toContain('Alice & 98 & 1');
      expect(latex).toContain('\\bottomrule');
    });
  });
});
