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
import { EditorView } from '@codemirror/view';
import { editorCommandBus } from '@/features/editor/core/command-bus/editor-command-bus';

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
  { label: '\\zeta', type: 'variable', apply: '\\zeta', detail: 'Greek zeta' },
  { label: '\\eta', type: 'variable', apply: '\\eta', detail: 'Greek eta' },
  { label: '\\theta', type: 'variable', apply: '\\theta', detail: 'Greek theta' },
  { label: '\\kappa', type: 'variable', apply: '\\kappa', detail: 'Greek kappa' },
  { label: '\\lambda', type: 'variable', apply: '\\lambda', detail: 'Greek lambda' },
  { label: '\\mu', type: 'variable', apply: '\\mu', detail: 'Greek mu' },
  { label: '\\nu', type: 'variable', apply: '\\nu', detail: 'Greek nu' },
  { label: '\\xi', type: 'variable', apply: '\\xi', detail: 'Greek xi' },
  { label: '\\pi', type: 'variable', apply: '\\pi', detail: 'Greek pi' },
  { label: '\\rho', type: 'variable', apply: '\\rho', detail: 'Greek rho' },
  { label: '\\sigma', type: 'variable', apply: '\\sigma', detail: 'Greek sigma' },
  { label: '\\tau', type: 'variable', apply: '\\tau', detail: 'Greek tau' },
  { label: '\\phi', type: 'variable', apply: '\\phi', detail: 'Greek phi' },
  { label: '\\chi', type: 'variable', apply: '\\chi', detail: 'Greek chi' },
  { label: '\\psi', type: 'variable', apply: '\\psi', detail: 'Greek psi' },
  { label: '\\omega', type: 'variable', apply: '\\omega', detail: 'Greek omega' },
  { label: '\\Gamma', type: 'variable', apply: '\\Gamma', detail: 'Greek Gamma' },
  { label: '\\Delta', type: 'variable', apply: '\\Delta', detail: 'Greek Delta' },
  { label: '\\Theta', type: 'variable', apply: '\\Theta', detail: 'Greek Theta' },
  { label: '\\Lambda', type: 'variable', apply: '\\Lambda', detail: 'Greek Lambda' },
  { label: '\\Sigma', type: 'variable', apply: '\\Sigma', detail: 'Greek Sigma' },
  { label: '\\Phi', type: 'variable', apply: '\\Phi', detail: 'Greek Phi' },
  { label: '\\Psi', type: 'variable', apply: '\\Psi', detail: 'Greek Psi' },
  { label: '\\Omega', type: 'variable', apply: '\\Omega', detail: 'Greek Omega' },
  { label: '\\infty', type: 'constant', apply: '\\infty', detail: 'Infinity symbol' },
  { label: '\\partial', type: 'operator', apply: '\\partial', detail: 'Partial derivative' },
  { label: '\\nabla', type: 'operator', apply: '\\nabla', detail: 'Nabla / Del operator' },
  { label: '\\mathbf', type: 'function', apply: snippet('\\mathbf{${1:x}}'), detail: 'Bold math' },
  { label: '\\mathcal', type: 'function', apply: snippet('\\mathcal{${1:L}}'), detail: 'Calligraphic font' },
  { label: '\\mathbb', type: 'function', apply: snippet('\\mathbb{${1:R}}'), detail: 'Blackboard bold' },
  { label: '\\mathrm', type: 'function', apply: snippet('\\mathrm{${1:text}}'), detail: 'Roman math font' },
  { label: '\\mathit', type: 'function', apply: snippet('\\mathit{${1:text}}'), detail: 'Italic math font' },
  { label: '\\forall', type: 'operator', apply: '\\forall ', detail: 'Universal quantifier' },
  { label: '\\exists', type: 'operator', apply: '\\exists ', detail: 'Existential quantifier' },
  { label: '\\in', type: 'operator', apply: '\\in ', detail: 'Element of' },
  { label: '\\notin', type: 'operator', apply: '\\notin ', detail: 'Not element of' },
  { label: '\\subset', type: 'operator', apply: '\\subset ', detail: 'Subset' },
  { label: '\\subseteq', type: 'operator', apply: '\\subseteq ', detail: 'Subset or equal' },
  { label: '\\approx', type: 'operator', apply: '\\approx ', detail: 'Approximately equal' },
  { label: '\\equiv', type: 'operator', apply: '\\equiv ', detail: 'Equivalent / identical' },
  { label: '\\neq', type: 'operator', apply: '\\neq ', detail: 'Not equal' },
  { label: '\\le', type: 'operator', apply: '\\le ', detail: 'Less than or equal' },
  { label: '\\ge', type: 'operator', apply: '\\ge ', detail: 'Greater than or equal' },
  { label: '\\times', type: 'operator', apply: '\\times ', detail: 'Multiplication sign' },
  { label: '\\cdot', type: 'operator', apply: '\\cdot ', detail: 'Center dot' },
  { label: '\\dots', type: 'constant', apply: '\\dots', detail: 'Ellipsis' },
  { label: '\\cdots', type: 'constant', apply: '\\cdots', detail: 'Centered ellipsis' },
  { label: '\\ldots', type: 'constant', apply: '\\ldots', detail: 'Low ellipsis' },
  { label: '\\left', type: 'keyword', apply: snippet('\\left( ${1:content} \\right)'), detail: 'Dynamic auto-sized brackets' },
  { label: '\\hat', type: 'function', apply: snippet('\\hat{${1:x}}'), detail: 'Hat accent' },
  { label: '\\bar', type: 'function', apply: snippet('\\bar{${1:x}}'), detail: 'Bar accent' },
  { label: '\\tilde', type: 'function', apply: snippet('\\tilde{${1:x}}'), detail: 'Tilde accent' },
  { label: '\\vec', type: 'function', apply: snippet('\\vec{${1:x}}'), detail: 'Vector accent' },
];

const GENERAL_COMMANDS: Completion[] = [
  { label: '\\section', type: 'keyword', apply: snippet('\\section{${1:Title}}\n'), detail: 'Section heading' },
  { label: '\\subsection', type: 'keyword', apply: snippet('\\subsection{${1:Title}}\n'), detail: 'Subsection heading' },
  { label: '\\subsubsection', type: 'keyword', apply: snippet('\\subsubsection{${1:Title}}\n'), detail: 'Subsubsection heading' },
  { label: '\\paragraph', type: 'keyword', apply: snippet('\\paragraph{${1:Title}} '), detail: 'Paragraph heading' },
  { label: '\\textbf', type: 'function', apply: snippet('\\textbf{${1:text}}'), detail: 'Bold text' },
  { label: '\\textit', type: 'function', apply: snippet('\\textit{${1:text}}'), detail: 'Italic text' },
  { label: '\\underline', type: 'function', apply: snippet('\\underline{${1:text}}'), detail: 'Underline text' },
  { label: '\\texttt', type: 'function', apply: snippet('\\texttt{${1:code}}'), detail: 'Monospace code' },
  { label: '\\emph', type: 'function', apply: snippet('\\emph{${1:text}}'), detail: 'Emphasized text' },
  { label: '\\footnote', type: 'function', apply: snippet('\\footnote{${1:note}}'), detail: 'Footnote text' },
  { label: '\\item', type: 'keyword', apply: '\\item ', detail: 'List item' },
  { label: '\\centering', type: 'keyword', apply: '\\centering\n', detail: 'Center alignment' },
  { label: '\\raggedright', type: 'keyword', apply: '\\raggedright\n', detail: 'Left alignment' },
  { label: '\\raggedleft', type: 'keyword', apply: '\\raggedleft\n', detail: 'Right alignment' },
  { label: '\\newpage', type: 'keyword', apply: '\\newpage\n', detail: 'Page break' },
  { label: '\\clearpage', type: 'keyword', apply: '\\clearpage\n', detail: 'Flush floats & page break' },
  { label: '\\appendix', type: 'keyword', apply: '\\appendix\n', detail: 'Start appendix sections' },
  { label: '\\tableofcontents', type: 'keyword', apply: '\\tableofcontents\n', detail: 'Table of contents' },
  { label: '\\listoffigures', type: 'keyword', apply: '\\listoffigures\n', detail: 'List of figures' },
  { label: '\\listoftables', type: 'keyword', apply: '\\listoftables\n', detail: 'List of tables' },
  { label: '\\maketitle', type: 'keyword', apply: '\\maketitle\n', detail: 'Generate title block' },
  { label: '\\title', type: 'function', apply: snippet('\\title{${1:Title}}'), detail: 'Document title' },
  { label: '\\author', type: 'function', apply: snippet('\\author{${1:Authors}}'), detail: 'Document authors' },
  { label: '\\date', type: 'function', apply: snippet('\\date{${1:\\today}}'), detail: 'Document date' },
  { label: '\\usepackage', type: 'keyword', apply: snippet('\\usepackage{${1:package}}'), detail: 'Import package' },
  { label: '\\caption', type: 'function', apply: snippet('\\caption{${1:caption}}'), detail: 'Table/Figure caption' },
  { label: '\\label', type: 'function', apply: snippet('\\label{${1:key}}'), detail: 'Cross-reference label' },
  { label: '\\bibliography', type: 'function', apply: snippet('\\bibliography{${1:references}}'), detail: 'BibTeX bibliography file' },
  { label: '\\bibliographystyle', type: 'function', apply: snippet('\\bibliographystyle{${1:plain}}'), detail: 'BibTeX style' },
  { label: '\\addbibresource', type: 'function', apply: snippet('\\addbibresource{${1:references.bib}}'), detail: 'biblatex resource' },
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
      source?: 'bib' | 'library' | 'server' | string;
    };

export type LatexFileInput =
  | string
  | {
      name?: string;
      path?: string;
      title?: string;
    };

export interface NormalizedCiteItem {
  key: string;
  title?: string;
  authors: string[];
  authorStr?: string;
  year?: string;
  journal?: string;
  source: 'bib' | 'library' | 'server';
}

interface DocScanCache {
  text: string;
  bibItems: NormalizedCiteItem[];
  labels: string[];
  macros: Completion[];
}

let cachedDocTokens: DocScanCache | null = null;

function scanDocumentTokens(docText: string): DocScanCache {
  if (cachedDocTokens && cachedDocTokens.text === docText) {
    return cachedDocTokens;
  }

  // 1. \bibitem entries
  const bibItems: NormalizedCiteItem[] = [];
  const bibitemRegex = /\\bibitem(?:\[[^\]]*\])?\{([^}]+)\}/g;
  let bMatch: RegExpExecArray | null;
  while ((bMatch = bibitemRegex.exec(docText)) !== null) {
    const key = bMatch[1]?.trim();
    if (key) {
      bibItems.push({
        key,
        authors: [],
        authorStr: 'Document bibliography',
        source: 'bib',
      });
    }
  }

  // 2. Cross-reference \label entries
  const labels = new Set<string>();
  const labelRegex = /\\label\{([^}]+)\}/g;
  let lMatch: RegExpExecArray | null;
  while ((lMatch = labelRegex.exec(docText)) !== null) {
    labels.add(lMatch[1]);
  }

  // 3. User macros (\newcommand, \DeclareMathOperator, \def)
  const macros: Completion[] = [];
  const macroRegex =
    /\\(?:(?:re)?newcommand\*?|DeclareMathOperator\*?)\s*(?:\{?\\([a-zA-Z]+)\}?)|\\def\\([a-zA-Z]+)/g;
  let mMatch: RegExpExecArray | null;
  const seenMacros = new Set<string>();
  while ((mMatch = macroRegex.exec(docText)) !== null) {
    const macroName = mMatch[1] || mMatch[2];
    if (macroName && !seenMacros.has(macroName)) {
      seenMacros.add(macroName);
      macros.push({
        label: `\\${macroName}`,
        type: 'function',
        detail: 'User-defined macro',
        section: { name: 'USER DEFINED', rank: 0 },
        boost: 3,
      });
    }
  }

  cachedDocTokens = {
    text: docText,
    bibItems,
    labels: Array.from(labels),
    macros,
  };
  return cachedDocTokens;
}

export function createLatexCompletionSource(
  bibSource: LatexBibEntryInput[] | (() => LatexBibEntryInput[]) = [],
  fileSource: LatexFileInput[] | (() => LatexFileInput[]) = [],
) {
  return function latexCompletionSource(context: CompletionContext): CompletionResult | null {
    const rawKeys = typeof bibSource === 'function' ? bibSource() : bibSource;
    const rawFiles = typeof fileSource === 'function' ? fileSource() : fileSource;
    const docText = context.state.doc.toString();
    const docTokens = scanDocumentTokens(docText);

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

    // 2. Check for citation commands (\cite, \citep, \citet, \autocite, \parencite, \nocite, etc.)
    const citeMatch = context.matchBefore(
      /\\(?:auto|paren|text|foot|no)?cite(?:p|t|alt|alp|author|year|date|num)?\*?(?:\[[^\]]*\])*\{[^}]*$/i,
    );
    if (citeMatch) {
      const matchText = citeMatch.text;
      const lastSep = Math.max(matchText.lastIndexOf('{'), matchText.lastIndexOf(','));
      const afterSep = matchText.slice(lastSep + 1);
      const leadingSpaces = afterSep.length - afterSep.trimStart().length;
      const searchQuery = afterSep.trimStart().toLowerCase();
      const from = citeMatch.from + lastSep + 1 + leadingSpaces;

      const allBibItems = new Map<string, NormalizedCiteItem>();

      for (const item of rawKeys) {
        if (typeof item === 'string' && item) {
          allBibItems.set(item.toLowerCase(), {
            key: item,
            authors: [],
            source: 'bib',
          });
        } else if (item && typeof item === 'object') {
          const key = item.key || item.citationKey || item.id;
          if (key) {
            const authors = Array.isArray(item.authors)
              ? item.authors
              : item.author
              ? [item.author]
              : [];
            const authorStr =
              authors.length > 0
                ? authors.length <= 2
                  ? authors.join(' & ')
                  : `${authors[0]} et al.`
                : '';
            const year = item.year ? String(item.year) : undefined;
            allBibItems.set(key.toLowerCase(), {
              key,
              title: item.title,
              authors,
              authorStr,
              year,
              journal: item.journal,
              source: (item.source as 'bib' | 'library' | 'server') || 'bib',
            });
          }
        }
      }

      // Merge cached document bibitems
      for (const b of docTokens.bibItems) {
        const lowerKey = b.key.toLowerCase();
        if (!allBibItems.has(lowerKey)) {
          allBibItems.set(lowerKey, b);
        }
      }

      const itemsList = Array.from(allBibItems.values());

      // Multi-field search and relevance ranking
      let matchedItems: Array<{ item: NormalizedCiteItem; score: number }> = [];

      if (!searchQuery) {
        matchedItems = itemsList.map((item) => ({
          item,
          score: item.source === 'bib' ? 2 : 1,
        }));
      } else {
        for (const item of itemsList) {
          const lowerKey = item.key.toLowerCase();
          const lowerTitle = item.title?.toLowerCase() || '';
          const authorMatch = item.authors.some((a) => a.toLowerCase().includes(searchQuery));
          const yearMatch = item.year?.includes(searchQuery);

          let score = 0;
          if (lowerKey === searchQuery) {
            score = 100;
          } else if (lowerKey.startsWith(searchQuery)) {
            score = 80;
          } else if (lowerKey.includes(searchQuery)) {
            score = 60;
          } else if (authorMatch) {
            score = 40;
          } else if (lowerTitle.includes(searchQuery)) {
            score = 30;
          } else if (yearMatch) {
            score = 20;
          }

          if (score > 0) {
            if (item.source === 'bib') score += 5; // Slight bias toward project references
            matchedItems.push({ item, score });
          }
        }
        matchedItems.sort((a, b) => b.score - a.score);
      }

      const options: Completion[] = matchedItems.map(({ item }) => {
        const isProject = item.source === 'bib';
        const authorYear = [item.authorStr, item.year ? `(${item.year})` : ''].filter(Boolean).join(' ');
        const detail = authorYear
          ? `${authorYear}${isProject ? '' : ' · [Library]'}`
          : isProject
          ? 'Project Reference'
          : 'Library Reference';

        return {
          label: item.key,
          type: isProject ? 'constant' : 'variable',
          detail,
          info: item.title
            ? `${item.title}${item.journal ? `\n\nVenue: ${item.journal}` : ''}${!isProject ? '\n\nSource: Workspace Library (auto-adds to references.bib)' : ''}`
            : undefined,
          boost: isProject ? 2 : 1,
          apply: (view: EditorView, _completion: Completion, applyFrom: number, applyTo: number) => {
            const nextChar = view.state.doc.sliceString(applyTo, applyTo + 1);
            const insertText = nextChar === '}' || nextChar === ',' ? item.key : `${item.key}}`;
            view.dispatch({
              changes: { from: applyFrom, to: applyTo, insert: insertText },
              selection: { anchor: applyFrom + insertText.length },
            });
            editorCommandBus.dispatch({
              type: 'editor:insert-citation',
              bibKey: item.key,
              textInserted: true,
            });
          },
        };
      });

      return {
        from,
        options,
        filter: false,
      };
    }

    // 3. Check for cross-references (\ref, \pageref, \eqref, \autoref, \cref, etc.)
    const refMatch = context.matchBefore(/\\(?:eq|page|auto|c|C|name)?ref\{[a-zA-Z0-9:_-]*/);
    if (refMatch) {
      const from = refMatch.text.lastIndexOf('{') + refMatch.from + 1;
      const options: Completion[] = docTokens.labels.map((lbl) => ({
        label: lbl,
        type: 'variable',
        apply: (view: EditorView, _completion: Completion, applyFrom: number, applyTo: number) => {
          const nextChar = view.state.doc.sliceString(applyTo, applyTo + 1);
          const insertText = nextChar === '}' ? lbl : `${lbl}}`;
          view.dispatch({
            changes: { from: applyFrom, to: applyTo, insert: insertText },
            selection: { anchor: applyFrom + insertText.length },
          });
        },
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

    // 7. Standard & user-defined command matching after '\'
    const slashMatch = context.matchBefore(/\\[a-zA-Z]*/);
    if (!slashMatch || (slashMatch.from === slashMatch.to && !context.explicit)) {
      return null;
    }

    const userMacros = docTokens.macros;

    return {
      from: slashMatch.from,
      options: [...userMacros, ...GENERAL_COMMANDS, ...MATH_COMMANDS],
      validFor: /^\\[a-zA-Z]*$/,
    };
  };
}
