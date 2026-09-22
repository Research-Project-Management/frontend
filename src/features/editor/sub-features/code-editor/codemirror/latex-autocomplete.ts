/**
 * latex-autocomplete.ts
 *
 * CodeMirror 6 LaTeX Autocompletion Provider (Overleaf Parity):
 * - Auto-completes \begin{env} -> automatically inserts corresponding \end{env}.
 * - Auto-completes \cite{key} from document or provided BibTeX entries.
 * - Auto-completes \ref{label} by scanning \label{...} in document.
 * - Math symbols and academic command snippets (\frac, \sqrt, etc.).
 */

import {
  CompletionContext,
  CompletionResult,
  Completion,
  snippet,
} from '@codemirror/autocomplete';

const COMMON_ENVIRONMENTS = [
  'equation',
  'equation*',
  'align',
  'align*',
  'gather',
  'figure',
  'table',
  'tabular',
  'itemize',
  'enumerate',
  'description',
  'abstract',
  'proof',
  'theorem',
  'lemma',
  'definition',
  'matrix',
  'pmatrix',
  'bmatrix',
  'vmatrix',
  'cases',
  'lstlisting',
  'verbatim',
];

const MATH_COMMANDS: Completion[] = [
  { label: '\\frac', type: 'function', apply: snippet('\\frac{${1:num}}{${2:den}}'), detail: 'Fraction' },
  { label: '\\sqrt', type: 'function', apply: snippet('\\sqrt{${1:x}}'), detail: 'Square root' },
  { label: '\\sum', type: 'keyword', apply: snippet('\\sum_{${1:i=1}}^{${2:n}} '), detail: 'Summation' },
  { label: '\\int', type: 'keyword', apply: snippet('\\int_{${1:a}}^{${2:b}} '), detail: 'Integral' },
  { label: '\\prod', type: 'keyword', apply: snippet('\\prod_{${1:i=1}}^{${2:n}} '), detail: 'Product' },
  { label: '\\lim', type: 'keyword', apply: snippet('\\lim_{${1:x \\to \\infty}} '), detail: 'Limit' },
  { label: '\\alpha', type: 'variable', apply: '\\alpha', detail: 'Greek alpha' },
  { label: '\\beta', type: 'variable', apply: '\\beta', detail: 'Greek beta' },
  { label: '\\gamma', type: 'variable', apply: '\\gamma', detail: 'Greek gamma' },
  { label: '\\delta', type: 'variable', apply: '\\delta', detail: 'Greek delta' },
  { label: '\\epsilon', type: 'variable', apply: '\\epsilon', detail: 'Greek epsilon' },
  { label: '\\theta', type: 'variable', apply: '\\theta', detail: 'Greek theta' },
  { label: '\\lambda', type: 'variable', apply: '\\lambda', detail: 'Greek lambda' },
  { label: '\\sigma', type: 'variable', apply: '\\sigma', detail: 'Greek sigma' },
  { label: '\\infty', type: 'constant', apply: '\\infty', detail: 'Infinity symbol' },
  { label: '\\partial', type: 'operator', apply: '\\partial', detail: 'Partial derivative' },
  { label: '\\mathbf', type: 'function', apply: snippet('\\mathbf{${1:x}}'), detail: 'Bold math' },
  { label: '\\mathcal', type: 'function', apply: snippet('\\mathcal{${1:L}}'), detail: 'Calligraphic font' },
  { label: '\\mathbb', type: 'function', apply: snippet('\\mathbb{${1:R}}'), detail: 'Blackboard bold' },
];

const GENERAL_COMMANDS: Completion[] = [
  { label: '\\section', type: 'keyword', apply: snippet('\\section{${1:Title}}\n'), detail: 'Section heading' },
  { label: '\\subsection', type: 'keyword', apply: snippet('\\subsection{${1:Title}}\n'), detail: 'Subsection heading' },
  { label: '\\subsubsection', type: 'keyword', apply: snippet('\\subsubsection{${1:Title}}\n'), detail: 'Subsubsection heading' },
  { label: '\\textbf', type: 'function', apply: snippet('\\textbf{${1:text}}'), detail: 'Bold text' },
  { label: '\\textit', type: 'function', apply: snippet('\\textit{${1:text}}'), detail: 'Italic text' },
  { label: '\\underline', type: 'function', apply: snippet('\\underline{${1:text}}'), detail: 'Underline text' },
  { label: '\\texttt', type: 'function', apply: snippet('\\texttt{${1:code}}'), detail: 'Monospace code' },
  { label: '\\usepackage', type: 'keyword', apply: snippet('\\usepackage{${1:package}}'), detail: 'Import package' },
  { label: '\\caption', type: 'function', apply: snippet('\\caption{${1:caption}}'), detail: 'Table/Figure caption' },
  { label: '\\label', type: 'function', apply: snippet('\\label{${1:key}}'), detail: 'Cross-reference label' },
];

export function createLatexCompletionSource(bibKeys: string[] = []) {
  return function latexCompletionSource(context: CompletionContext): CompletionResult | null {
    const docText = context.state.doc.toString();

    // 1. Check for \begin{...}
    const beginMatch = context.matchBefore(/\\begin\{[a-zA-Z0-9*_-]*/);
    if (beginMatch) {
      const from = beginMatch.from + 7; // after "\begin{"
      const options: Completion[] = COMMON_ENVIRONMENTS.map((env) => ({
        label: env,
        type: 'class',
        apply: snippet(`${env}}\n  \${1}\n\\end{${env}}`),
        detail: `Environment ${env}`,
      }));
      return { from, options, validFor: /^[a-zA-Z0-9*_-]*$/ };
    }

    // 2. Check for \cite{...}
    const citeMatch = context.matchBefore(/\\cite\{[a-zA-Z0-9_-]*/);
    if (citeMatch) {
      const from = citeMatch.from + 6; // after "\cite{"
      // Also extract any \bibitem{...} from the document
      const docBibKeys = new Set<string>(bibKeys);
      const bibitemRegex = /\\bibitem\{([^}]+)\}/g;
      let bMatch: RegExpExecArray | null;
      while ((bMatch = bibitemRegex.exec(docText)) !== null) {
        docBibKeys.add(bMatch[1]);
      }

      const options: Completion[] = Array.from(docBibKeys).map((key) => ({
        label: key,
        type: 'constant',
        apply: `${key}}`,
        detail: 'Citation key',
      }));

      return { from, options, validFor: /^[a-zA-Z0-9_-]*$/ };
    }

    // 3. Check for \ref{...}
    const refMatch = context.matchBefore(/\\ref\{[a-zA-Z0-9:_-]*/);
    if (refMatch) {
      const from = refMatch.from + 5; // after "\ref{"
      const labels = new Set<string>();
      const labelRegex = /\\label\{([^}]+)\}/g;
      let lMatch: RegExpExecArray | null;
      while ((lMatch = labelRegex.exec(docText)) !== null) {
        labels.add(lMatch[1]);
      }

      const options: Completion[] = Array.from(labels).map((lbl) => ({
        label: lbl,
        type: 'variable',
        apply: `${lbl}}`,
        detail: 'Cross-reference label',
      }));

      return { from, options, validFor: /^[a-zA-Z0-9:_-]*$/ };
    }

    // 4. Standard command matching after '\'
    const slashMatch = context.matchBefore(/\\[a-zA-Z]*/);
    if (!slashMatch || (slashMatch.from === slashMatch.to && !context.explicit)) {
      return null;
    }

    return {
      from: slashMatch.from,
      options: [...GENERAL_COMMANDS, ...MATH_COMMANDS],
      validFor: /^\\[a-zA-Z]*$/,
    };
  };
}
