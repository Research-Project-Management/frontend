import { describe, it, expect } from 'vitest';
import {
  latexToHtml,
  htmlToLatex,
  extractLatexBodyAndPreamble,
  renderMathHtml,
} from '@/features/editor/utils/latex-converter.util';

describe('latex-converter.util (AST-Guarded Lossless Conversion)', () => {
  describe('extractLatexBodyAndPreamble', () => {
    it('should extract documentclass, packages, macros, and body', () => {
      const latex = `
\\documentclass{article}
\\usepackage{amsmath}
\\usepackage{graphicx}
\\newcommand{\\R}{\\mathbb{R}}
\\title{Deep Learning}
\\author{Alan Turing}

\\begin{document}
\\maketitle
Hello world!
\\end{document}
      `.trim();

      const { preamble, body } = extractLatexBodyAndPreamble(latex);
      expect(preamble.documentclass).toBe('article');
      expect(preamble.title).toBe('Deep Learning');
      expect(preamble.author).toBe('Alan Turing');
      expect(preamble.packages).toContain('amsmath');
      expect(preamble.packages).toContain('graphicx');
      expect(preamble.customMacros).toHaveLength(1);
      expect(body).toBe('Hello world!');
    });
  });

  describe('renderMathHtml', () => {
    it('should render valid LaTeX math to KaTeX HTML', () => {
      const html = renderMathHtml('E = mc^2', false);
      expect(html).toContain('katex');
    });

    it('should handle broken math safely without throwing', () => {
      const html = renderMathHtml('\\invalidMacro{test}', false);
      expect(html).toBeDefined();
    });
  });

  describe('latexToHtml & htmlToLatex Round-trip Lossless Integrity', () => {
    it('should preserve protected environments (figure, table, tikz)', () => {
      const raw = `
\\begin{figure}[htbp]
\\centering
\\includegraphics[width=0.8\\textwidth]{plot.png}
\\caption{Experimental Results}
\\label{fig:results}
\\end{figure}
      `.trim();

      const html = latexToHtml(raw);
      expect(html).toContain('latex-protected-block');
      expect(html).toContain('Protected Block');

      const restored = htmlToLatex(html);
      expect(restored).toContain('\\begin{figure}[htbp]');
      expect(restored).toContain('\\includegraphics[width=0.8\\textwidth]{plot.png}');
      expect(restored).toContain('\\caption{Experimental Results}');
      expect(restored).toContain('\\end{figure}');
    });

    it('should preserve LaTeX comments without dropping them', () => {
      const raw = `
% Important note for reviewer: check equation 4
Regular text here.
      `.trim();

      const html = latexToHtml(raw);
      expect(html).toContain('latex-comment');

      const restored = htmlToLatex(html);
      expect(restored).toContain('% Important note for reviewer: check equation 4');
      expect(restored).toContain('Regular text here.');
    });

    it('should preserve labels and citations', () => {
      const raw = `
\\section{Introduction}\\label{sec:intro}
As shown by Einstein \\cite{einstein1905}, see Section \\ref{sec:intro}.
      `.trim();

      const html = latexToHtml(raw);
      expect(html).toContain('data-label="sec%3Aintro"');
      expect(html).toContain('data-cite="einstein1905"');
      expect(html).toContain('data-ref="sec:intro"');

      const restored = htmlToLatex(html);
      expect(restored).toContain('\\section{Introduction}');
      expect(restored).toContain('\\label{sec:intro}');
      expect(restored).toContain('\\cite{einstein1905}');
      expect(restored).toContain('\\ref{sec:intro}');
    });

    it('should preserve math equations and inline math', () => {
      const raw = `
Here is inline math $x \\in \\mathbb{R}$ and an equation:
\\begin{equation}
\\int_{0}^{\\infty} e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}
\\end{equation}
      `.trim();

      const html = latexToHtml(raw);
      expect(html).toContain('latex-math-inline');
      expect(html).toContain('latex-math-block');

      const restored = htmlToLatex(html);
      expect(restored).toContain('$x \\in \\mathbb{R}$');
      expect(restored).toContain('\\begin{equation}');
      expect(restored).toContain('\\int_{0}^{\\infty} e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}');
      expect(restored).toContain('\\end{equation}');
    });

    it('should preserve full manuscript preamble and postamble', () => {
      const manuscript = `
\\documentclass{article}
\\usepackage{amsmath}
\\newcommand{\\customMacro}[1]{\\textbf{#1}}

\\begin{document}
\\maketitle

\\section{Methods}
Some text here.

\\end{document}
      `.trim();

      const html = latexToHtml(manuscript);
      const restored = htmlToLatex(html, manuscript);

      expect(restored).toContain('\\documentclass{article}');
      expect(restored).toContain('\\usepackage{amsmath}');
      expect(restored).toContain('\\newcommand{\\customMacro}[1]{\\textbf{#1}}');
      expect(restored).toContain('\\begin{document}');
      expect(restored).toContain('\\maketitle');
      expect(restored).toContain('\\section{Methods}');
      expect(restored).toContain('Some text here.');
      expect(restored).toContain('\\end{document}');
    });
  });
});
