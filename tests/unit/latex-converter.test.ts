import { describe, it, expect } from 'vitest';
import {
  latexToHtml,
  htmlToLatex,
  extractLatexBodyAndPreamble,
  renderMathHtml,
} from '@/features/editor/domain/latex/latex-converter';

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
    it('should preserve protected environments (table, tikz, algorithm)', () => {
      const raw = `
\\begin{tikzpicture}
\\draw (0,0) -- (1,1);
\\node at (0.5,0.5) {test};
\\end{tikzpicture}
      `.trim();

      const html = latexToHtml(raw);
      expect(html).toContain('latex-protected-block');
      expect(html).toContain('Protected Block');

      const restored = htmlToLatex(html);
      expect(restored).toContain('\\begin{tikzpicture}');
      expect(restored).toContain('\\draw (0,0) -- (1,1);');
      expect(restored).toContain('\\end{tikzpicture}');
    });

    it('should convert figure and figure* to interactive WYSIWYG figures and restore faithfully', () => {
      const raw = `
\\begin{figure}[htbp]
\\centering
\\includegraphics[width=0.8\\linewidth]{plot.png}
\\caption{Experimental Results}
\\label{fig:results}
\\end{figure}
      `.trim();

      const html = latexToHtml(raw);
      expect(html).toContain('latex-figure-wrapper');
      expect(html).toContain('data-src="plot.png"');
      expect(html).toContain('data-width="0.8%5Clinewidth"');
      expect(html).toContain('data-caption="Experimental%20Results"');
      expect(html).toContain('data-label="fig%3Aresults"');
      expect(html).toContain('data-placement="htbp"');
      expect(html).toContain('data-centering="true"');
      expect(html).toContain('Experimental Results');
      expect(html).toContain('style="width: 80%;"');

      const restored = htmlToLatex(html);
      expect(restored).toContain('\\begin{figure}[htbp]');
      expect(restored).toContain('\\centering');
      expect(restored).toContain('\\includegraphics[width=0.8\\linewidth]{plot.png}');
      expect(restored).toContain('\\caption{Experimental Results}');
      expect(restored).toContain('\\label{fig:results}');
      expect(restored).toContain('\\end{figure}');

      // Test figure* (starred two-column figure)
      const rawStarred = `
\\begin{figure*}[!t]
\\includegraphics[width=\\textwidth]{wide-diagram.pdf}
\\caption{Wide Diagram across two columns}
\\label{fig:wide}
\\end{figure*}
      `.trim();

      const htmlStarred = latexToHtml(rawStarred);
      expect(htmlStarred).toContain('latex-figure-wrapper');
      expect(htmlStarred).toContain('data-starred="true"');
      expect(htmlStarred).toContain('data-placement="!t"');

      const restoredStarred = htmlToLatex(htmlStarred);
      expect(restoredStarred).toContain('\\begin{figure*}[!t]');
      expect(restoredStarred).toContain('\\includegraphics[width=\\textwidth]{wide-diagram.pdf}');
      expect(restoredStarred).toContain('\\caption{Wide Diagram across two columns}');
      expect(restoredStarred).toContain('\\label{fig:wide}');
      expect(restoredStarred).toContain('\\end{figure*}');
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

    it('should assign accurate data-line attributes to headings, blocks, figures and tables for SyncTeX', () => {
      const latex = [
        '\\section{First Section}',
        'First paragraph of text.',
        '\\begin{equation}',
        'y = mx + b',
        '\\end{equation}',
        '\\begin{figure}[htbp]',
        '\\centering',
        '\\includegraphics{chart.png}',
        '\\caption{Chart}',
        '\\end{figure}',
      ].join('\n');

      const html = latexToHtml(latex);
      expect(html).toContain('data-line="1"'); // section
      expect(html).toContain('data-line="2"'); // paragraph
      expect(html).toContain('data-line="3"'); // equation
      expect(html).toContain('data-line="6"'); // figure
    });
  });
});
