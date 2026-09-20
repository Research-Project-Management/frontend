import { describe, it, expect } from 'vitest';
import {
  latexToHtml,
  htmlToLatex,
  convertLatexTableToHtml,
} from '@/features/editor/utils/latex-converter.util';

describe('Visual Table Editing (WYSIWYG Overleaf Parity)', () => {
  describe('convertLatexTableToHtml', () => {
    it('converts a LaTeX table with caption, label, and booktabs into HTML table', () => {
      const latex = `
\\begin{table}[htbp]
  \\centering
  \\caption{Model Performance Comparison}
  \\label{tab:perf}
  \\begin{tabular}{l c r}
    \\toprule
    Model & Accuracy & F1-Score \\\\
    \\midrule
    BERT & 91.2\\% & 0.89 \\\\
    RoBERTa & 93.4\\% & 0.92 \\\\
    \\bottomrule
  \\end{tabular}
\\end{table}
      `.trim();

      const html = convertLatexTableToHtml(latex);

      expect(html).toContain('<table');
      expect(html).toContain('data-caption="Model%20Performance%20Comparison"');
      expect(html).toContain('data-label="tab%3Aperf"');
      expect(html).toContain('<thead>');
      expect(html).toContain('<th><p>Model</p></th>');
      expect(html).toContain('<th><p>Accuracy</p></th>');
      expect(html).toContain('<th><p>F1-Score</p></th>');
      expect(html).toContain('<tbody>');
      expect(html).toContain('<td><p>BERT</p></td>');
      expect(html).toContain('<td><p>91.2%</p></td>');
      expect(html).toContain('<td><p>0.89</p></td>');
    });

    it('converts formatted text in cells (\\textbf, \\textit) to HTML tags', () => {
      const latex = `
\\begin{tabular}{cc}
  \\toprule
  \\textbf{Method} & \\textit{Score} \\\\
  \\midrule
  Proposed & 99.5 \\\\
  \\bottomrule
\\end{tabular}
      `.trim();

      const html = convertLatexTableToHtml(latex);
      expect(html).toContain('<strong>Method</strong>');
      expect(html).toContain('<em>Score</em>');
    });

    it('unescapes LaTeX special characters in cells for WYSIWYG display', () => {
      const latex = `
\\begin{tabular}{cc}
  \\toprule
  Symbol & Description \\\\
  \\midrule
  \\& & Ampersand \\\\
  100\\% & Percent \\\\
  \\bottomrule
\\end{tabular}
      `.trim();

      const html = convertLatexTableToHtml(latex);
      expect(html).toContain('<td><p>&</p></td>');
      expect(html).toContain('<td><p>100%</p></td>');
    });
  });

  describe('htmlToLatex Table Reconstruction', () => {
    it('converts an HTML table back to LaTeX table with booktabs and alignment', () => {
      const html = `
<table data-caption="Experimental%20Results" data-label="tab%3Aresults" data-align="l%20c%20r">
  <thead>
    <tr>
      <th><p>Parameter</p></th>
      <th><p>Default</p></th>
      <th><p>Max</p></th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><p>Learning Rate</p></td>
      <td><p>0.001</p></td>
      <td><p>0.1</p></td>
    </tr>
    <tr>
      <td><p>Batch Size</p></td>
      <td><p>32</p></td>
      <td><p>128</p></td>
    </tr>
  </tbody>
</table>
      `.trim();

      const latex = htmlToLatex(html);

      expect(latex).toContain('\\begin{table}[htbp]');
      expect(latex).toContain('\\centering');
      expect(latex).toContain('\\caption{Experimental Results}');
      expect(latex).toContain('\\label{tab:results}');
      expect(latex).toContain('\\begin{tabular}{l c r}');
      expect(latex).toContain('\\toprule');
      expect(latex).toContain('Parameter & Default & Max \\\\');
      expect(latex).toContain('\\midrule');
      expect(latex).toContain('Learning Rate & 0.001 & 0.1 \\\\');
      expect(latex).toContain('Batch Size & 32 & 128 \\\\');
      expect(latex).toContain('\\bottomrule');
      expect(latex).toContain('\\end{tabular}');
      expect(latex).toContain('\\end{table}');
    });

    it('preserves text formatting (\\textbf, \\textit) and escapes literal characters in cells', () => {
      const html = `
<table>
  <thead>
    <tr>
      <th><p><strong>Metric</strong></p></th>
      <th><p><em>Gain</em></p></th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><p>Accuracy & Precision</p></td>
      <td><p>+15%</p></td>
    </tr>
  </tbody>
</table>
      `.trim();

      const latex = htmlToLatex(html);

      expect(latex).toContain('\\textbf{Metric}');
      expect(latex).toContain('\\textit{Gain}');
      expect(latex).toContain('Accuracy \\& Precision');
      expect(latex).toContain('+15\\%');
    });
  });

  describe('Round-trip Full Fidelity (LaTeX -> HTML -> LaTeX)', () => {
    it('maintains structural integrity across a round-trip conversion', () => {
      const initialLatex = `
\\begin{table}[htbp]
  \\centering
  \\caption{Evaluation Summary}
  \\label{tab:summary}
  \\begin{tabular}{c c}
    \\toprule
    Algorithm & Runtime \\\\
    \\midrule
    QuickSort & 12ms \\\\
    MergeSort & 15ms \\\\
    \\bottomrule
  \\end{tabular}
\\end{table}
      `.trim();

      const html = latexToHtml(initialLatex);
      expect(html).toContain('<table');

      const regeneratedLatex = htmlToLatex(html);
      expect(regeneratedLatex).toContain('\\begin{table}[htbp]');
      expect(regeneratedLatex).toContain('\\caption{Evaluation Summary}');
      expect(regeneratedLatex).toContain('\\label{tab:summary}');
      expect(regeneratedLatex).toContain('\\toprule');
      expect(regeneratedLatex).toContain('Algorithm & Runtime \\\\');
      expect(regeneratedLatex).toContain('\\midrule');
      expect(regeneratedLatex).toContain('QuickSort & 12ms \\\\');
      expect(regeneratedLatex).toContain('MergeSort & 15ms \\\\');
      expect(regeneratedLatex).toContain('\\bottomrule');
    });
  });
});
