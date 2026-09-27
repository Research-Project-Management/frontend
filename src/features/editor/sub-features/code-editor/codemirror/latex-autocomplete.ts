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

const COMMON_PACKAGES: Completion[] = [
  { label: 'amsmath', type: 'class', detail: 'AMS math facilities', apply: 'amsmath}' },
  { label: 'amssymb', type: 'class', detail: 'AMS math symbols', apply: 'amssymb}' },
  { label: 'amsfonts', type: 'class', detail: 'AMS fonts', apply: 'amsfonts}' },
  { label: 'amsthm', type: 'class', detail: 'Theorem typesetting', apply: 'amsthm}' },
  { label: 'graphicx', type: 'class', detail: 'Enhanced image support', apply: 'graphicx}' },
  { label: 'geometry', type: 'class', detail: 'Page geometry & margins', apply: 'geometry}' },
  { label: 'hyperref', type: 'class', detail: 'Hypertext links & metadata', apply: 'hyperref}' },
  { label: 'xcolor', type: 'class', detail: 'Color extensions', apply: 'xcolor}' },
  { label: 'tikz', type: 'class', detail: 'Vector graphics creation', apply: 'tikz}' },
  { label: 'pgfplots', type: 'class', detail: '2D & 3D plots in LaTeX', apply: 'pgfplots}' },
  { label: 'booktabs', type: 'class', detail: 'Publication-quality tables', apply: 'booktabs}' },
  { label: 'array', type: 'class', detail: 'Array & tabular extensions', apply: 'array}' },
  { label: 'tabularx', type: 'class', detail: 'Auto-width column tables', apply: 'tabularx}' },
  { label: 'longtable', type: 'class', detail: 'Multi-page tables', apply: 'longtable}' },
  { label: 'caption', type: 'class', detail: 'Custom figure/table captions', apply: 'caption}' },
  { label: 'subcaption', type: 'class', detail: 'Subfigures & subcaptions', apply: 'subcaption}' },
  { label: 'float', type: 'class', detail: 'Strict placement for floats [H]', apply: 'float}' },
  { label: 'cite', type: 'class', detail: 'Compressed & sorted citations', apply: 'cite}' },
  { label: 'natbib', type: 'class', detail: 'Author-year & numeric citations', apply: 'natbib}' },
  { label: 'biblatex', type: 'class', detail: 'Modern bibliography framework', apply: 'biblatex}' },
  { label: 'listings', type: 'class', detail: 'Source code syntax highlighting', apply: 'listings}' },
  { label: 'algorithm', type: 'class', detail: 'Floating algorithm wrapper', apply: 'algorithm}' },
  { label: 'algorithmic', type: 'class', detail: 'Algorithm pseudocode environment', apply: 'algorithmic}' },
  { label: 'algpseudocode', type: 'class', detail: 'Pseudocode formatting (algorithmicx)', apply: 'algpseudocode}' },
  { label: 'enumitem', type: 'class', detail: 'Custom list layouts', apply: 'enumitem}' },
  { label: 'fancyhdr', type: 'class', detail: 'Custom headers and footers', apply: 'fancyhdr}' },
  { label: 'microtype', type: 'class', detail: 'Subtle typographic enhancements', apply: 'microtype}' },
  { label: 'babel', type: 'class', detail: 'Multilingual support', apply: 'babel}' },
  { label: 'inputenc', type: 'class', detail: 'Input encoding selection', apply: 'inputenc}' },
  { label: 'fontenc', type: 'class', detail: 'Font encoding specification', apply: 'fontenc}' },
  { label: 'csquotes', type: 'class', detail: 'Context-sensitive quotation', apply: 'csquotes}' },
  { label: 'siunitx', type: 'class', detail: 'Comprehensive SI units', apply: 'siunitx}' },
  { label: 'cleveref', type: 'class', detail: 'Intelligent cross-referencing', apply: 'cleveref}' },
  { label: 'url', type: 'class', detail: 'URL line breaking', apply: 'url}' },
  { label: 'titlesec', type: 'class', detail: 'Section title styling', apply: 'titlesec}' },
  { label: 'setspace', type: 'class', detail: 'Adjust line spacing', apply: 'setspace}' },
  { label: 'lineno', type: 'class', detail: 'Line numbering for review', apply: 'lineno}' },
  { label: 'pdfpages', type: 'class', detail: 'Include external PDF pages', apply: 'pdfpages}' },
  { label: 'multicol', type: 'class', detail: 'Multi-column layout', apply: 'multicol}' },
  { label: 'bm', type: 'class', detail: 'Bold math symbols', apply: 'bm}' },
  { label: 'mathtools', type: 'class', detail: 'Mathematical tools & fixes', apply: 'mathtools}' },
  { label: 'todonotes', type: 'class', detail: 'Margin TODO notes', apply: 'todonotes}' },
  { label: 'glossaries', type: 'class', detail: 'Glossaries and acronyms', apply: 'glossaries}' },
  { label: 'wrapfig', type: 'class', detail: 'Text-wrapped figures', apply: 'wrapfig}' },
  { label: 'lipsum', type: 'class', detail: 'Lorem Ipsum dummy text', apply: 'lipsum}' },
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

export type LatexBibEntryInput =
  | string
  | {
      key?: string;
      id?: string;
      citationKey?: string;
      title?: string;
      authors?: string[];
      author?: string;
      year?: string | number;
      journal?: string;
    };

export type LatexFileInput =
  | string
  | {
      name?: string;
      path?: string;
      title?: string;
    };

export function createLatexCompletionSource(
  bibSource: LatexBibEntryInput[] | (() => LatexBibEntryInput[]) = [],
  fileSource: LatexFileInput[] | (() => LatexFileInput[]) = [],
) {
  return function latexCompletionSource(context: CompletionContext): CompletionResult | null {
    const rawKeys = typeof bibSource === 'function' ? bibSource() : bibSource;
    const rawFiles = typeof fileSource === 'function' ? fileSource() : fileSource;
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

      const docBibMap = new Map<string, { key: string; detail?: string; info?: string }>();
      for (const item of rawKeys) {
        if (typeof item === 'string' && item) {
          docBibMap.set(item.toLowerCase(), { key: item, detail: 'Citation key' });
        } else if (item && typeof item === 'object') {
          const key = item.key || item.citationKey || item.id;
          if (key) {
            const authorStr = item.author || (Array.isArray(item.authors) ? item.authors.join(', ') : '');
            const yearStr = item.year ? ` (${item.year})` : '';
            const detail = (authorStr + yearStr).trim() || 'Citation key';
            docBibMap.set(key.toLowerCase(), {
              key,
              detail,
              info: item.title || undefined,
            });
          }
        }
      }

      // Also extract any \bibitem{...} from the document
      const bibitemRegex = /\\bibitem\{([^}]+)\}/g;
      let bMatch: RegExpExecArray | null;
      while ((bMatch = bibitemRegex.exec(docText)) !== null) {
        const key = bMatch[1];
        if (!docBibMap.has(key.toLowerCase())) {
          docBibMap.set(key.toLowerCase(), { key, detail: 'Document bibliography' });
        }
      }

      const options: Completion[] = Array.from(docBibMap.values()).map((entry) => ({
        label: entry.key,
        type: 'constant',
        apply: `${entry.key}}`,
        detail: entry.detail,
        info: entry.info,
        boost: 1,
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

    // 4. Check for \usepackage[...]{...} or \usepackage{...}
    const pkgMatch = context.matchBefore(/\\usepackage(?:\[[^\]]*\])?\{[a-zA-Z0-9_-]*/);
    if (pkgMatch) {
      const from = pkgMatch.text.lastIndexOf('{') + pkgMatch.from + 1;
      return {
        from,
        options: COMMON_PACKAGES,
        validFor: /^[a-zA-Z0-9_-]*$/,
      };
    }

    // 5. Check for \input{...}, \include{...}, \subfile{...}
    const inputMatch = context.matchBefore(/\\(?:input|include|subfile)\{[a-zA-Z0-9_\-\./]*/);
    if (inputMatch) {
      const from = inputMatch.text.lastIndexOf('{') + inputMatch.from + 1;
      const fileNames = rawFiles
        .map((f) => (typeof f === 'string' ? f : f.name || f.path || f.title || ''))
        .filter(Boolean);

      const texFiles = fileNames.filter(
        (name) => name.toLowerCase().endsWith('.tex') || !name.includes('.')
      );
      const candidateFiles = texFiles.length > 0 ? texFiles : fileNames;

      const options: Completion[] = candidateFiles.map((name) => ({
        label: name,
        type: 'text',
        apply: `${name}}`,
        detail: 'Document file',
      }));

      return { from, options, validFor: /^[a-zA-Z0-9_\-\./]*$/ };
    }

    // 6. Check for \includegraphics[...]{...} or \includegraphics{...}
    const graphicsMatch = context.matchBefore(/\\includegraphics(?:\[[^\]]*\])?\{[a-zA-Z0-9_\-\./]*/);
    if (graphicsMatch) {
      const from = graphicsMatch.text.lastIndexOf('{') + graphicsMatch.from + 1;
      const fileNames = rawFiles
        .map((f) => (typeof f === 'string' ? f : f.name || f.path || f.title || ''))
        .filter(Boolean);

      const imageExts = ['.png', '.jpg', '.jpeg', '.pdf', '.eps', '.svg'];
      const imgFiles = fileNames.filter((name) => {
        const lower = name.toLowerCase();
        return imageExts.some((ext) => lower.endsWith(ext));
      });
      const candidateFiles = imgFiles.length > 0 ? imgFiles : fileNames;

      const options: Completion[] = candidateFiles.map((name) => ({
        label: name,
        type: 'constant',
        apply: `${name}}`,
        detail: 'Graphic file',
      }));

      return { from, options, validFor: /^[a-zA-Z0-9_\-\./]*$/ };
    }

    // 7. Standard command matching after '\'
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
