import { describe, it, expect } from 'vitest';
import {
  parseLatexFigure,
  serializeFigureToLatex,
} from '@/features/editor/sub-features/code-editor/codemirror/figure-visual-widget';
import {
  renderChemHtml,
  renderMathHtml,
} from '@/features/editor/domain/latex/latex-converter';
import {
  isTableData,
  parseTableToLatex,
} from '@/features/editor/domain/latex/smart-paste';
import { EditorState } from '@codemirror/state';
import { latexVisualField } from '@/features/editor/sub-features/code-editor/codemirror/latex-visual-plugin';

describe('Overleaf 1:1 Parity Visual Mode Enhancements', () => {
  describe('Figure Widget Parsing & Serialization', () => {
    it('accurately parses a full LaTeX figure environment', () => {
      const latex = `
\\begin{figure}[htbp]
  \\centering
  \\includegraphics[width=0.85\\linewidth]{figures/arch.png}
  \\caption{System Architecture Overview}
  \\label{fig:arch}
\\end{figure}
      `.trim();

      const parsed = parseLatexFigure(latex);
      expect(parsed.placement).toBe('htbp');
      expect(parsed.isCentered).toBe(true);
      expect(parsed.imageSrc).toBe('figures/arch.png');
      expect(parsed.imageOpts).toBe('width=0.85\\linewidth');
      expect(parsed.caption).toBe('System Architecture Overview');
      expect(parsed.label).toBe('fig:arch');
      expect(parsed.isStarred).toBe(false);
    });

    it('round-trip serializes parsed figure back to valid LaTeX', () => {
      const parsed = {
        rawLatex: '',
        isStarred: false,
        placement: 't!',
        isCentered: true,
        imageSrc: 'plots/convergence.pdf',
        imageOpts: 'scale=0.5',
        caption: 'Training Loss over Epochs',
        label: 'fig:loss',
      };

      const serialized = serializeFigureToLatex(parsed);
      expect(serialized).toContain('\\begin{figure}[t!]');
      expect(serialized).toContain('\\centering');
      expect(serialized).toContain('\\includegraphics[scale=0.5]{plots/convergence.pdf}');
      expect(serialized).toContain('\\caption{Training Loss over Epochs}');
      expect(serialized).toContain('\\label{fig:loss}');
      expect(serialized).toContain('\\end{figure}');
    });
  });

  describe('Chemical Formulas (\ce{...} mhchem parity)', () => {
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

  describe('CodeMirror 6 Visual StateField', () => {
    it('generates visual decorations without throwing CM6 RangeError', () => {
      const sampleLatex = `
\\section{Introduction}
This is \\textbf{bold} and \\textit{italic} text with inline math $x^2 + y^2 = r^2$ and chemistry \\ce{H2SO4}.

\\[
  \\lim_{n \\to \\infty} \\left(1 + \\frac{1}{n}\\right)^n = e
\\]

As seen in Figure~\\ref{fig:model} and cited in \\cite{vaswani2017attention}\\footnote{See Appendix A}.

\\begin{figure}[htbp]
  \\centering
  \\includegraphics{figures/model.png}
  \\caption{Transformer Model}
  \\label{fig:model}
\\end{figure}
      `.trim();

      const state = EditorState.create({
        doc: sampleLatex,
        extensions: [latexVisualField],
      });

      const decorations = state.field(latexVisualField);
      expect(decorations).toBeDefined();
      expect(decorations.size).toBeGreaterThan(0);
    });
  });
});
