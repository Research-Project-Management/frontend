/**
 * latex-macros.ts
 *
 * CodeMirror 6 Autocompletion Source for LaTeX (Block 4: Engines Layer).
 * Location: `features/editor/engines/latex-macros.ts`
 *
 * Provides intelligent snippet completions for:
 * - Environments: equation, align, figure, table, itemize, enumerate, matrix.
 * - Sectioning: section, subsection, subsubsection, paragraph.
 * - Math commands & symbols: frac, sqrt, sum, int, alpha, beta, gamma, etc.
 * - Cross-referencing: cite, ref, eqref, label.
 */

import {
  autocompletion,
  type Completion,
  type CompletionContext,
  type CompletionResult,
  snippet,
} from '@codemirror/autocomplete';
import { latexSymbolsIndex } from '../domain/latex-symbols-index';

const LATEX_ENVIRONMENTS: Completion[] = [
  {
    label: 'equation',
    type: 'class',
    detail: 'Numbered Equation',
    apply: snippet('\\begin{equation}\n\t${1}\n\\end{equation}'),
  },
  {
    label: 'align',
    type: 'class',
    detail: 'Aligned Equations',
    apply: snippet('\\begin{align}\n\t${1} &= ${2} \\\\\n\\end{align}'),
  },
  {
    label: 'figure',
    type: 'class',
    detail: 'Figure Environment',
    apply: snippet(
      '\\begin{figure}[htbp]\n\t\\centering\n\t\\includegraphics[width=${1:0.8}\\linewidth]{${2:image.png}}\n\t\\caption{${3:Caption text}}\n\t\\label{fig:${4:label}}\n\\end{figure}'
    ),
  },
  {
    label: 'table',
    type: 'class',
    detail: 'Table Environment',
    apply: snippet(
      '\\begin{table}[htbp]\n\t\\centering\n\t\\caption{${1:Table caption}}\n\t\\label{tab:${2:label}}\n\t\\begin{tabular}{${3:cc}}\n\t\t\\hline\n\t\t${4:Col 1} & ${5:Col 2} \\\\\n\t\t\\hline\n\t\\end{tabular}\n\\end{table}'
    ),
  },
  {
    label: 'itemize',
    type: 'class',
    detail: 'Bullet List',
    apply: snippet('\\begin{itemize}\n\t\\item ${1}\n\\end{itemize}'),
  },
  {
    label: 'enumerate',
    type: 'class',
    detail: 'Numbered List',
    apply: snippet('\\begin{enumerate}\n\t\\item ${1}\n\\end{enumerate}'),
  },
  {
    label: 'pmatrix',
    type: 'class',
    detail: 'Parenthesized Matrix',
    apply: snippet('\\begin{pmatrix}\n\t${1} & ${2} \\\\\n\t${3} & ${4}\n\\end{pmatrix}'),
  },
  {
    label: 'bmatrix',
    type: 'class',
    detail: 'Bracketed Matrix',
    apply: snippet('\\begin{bmatrix}\n\t${1} & ${2} \\\\\n\t${3} & ${4}\n\\end{bmatrix}'),
  },
];

const LATEX_COMMANDS: Completion[] = [
  // Sectioning
  { label: '\\section', type: 'keyword', apply: snippet('\\section{${1:Title}}') },
  { label: '\\subsection', type: 'keyword', apply: snippet('\\subsection{${1:Title}}') },
  { label: '\\subsubsection', type: 'keyword', apply: snippet('\\subsubsection{${1:Title}}') },
  { label: '\\paragraph', type: 'keyword', apply: snippet('\\paragraph{${1:Title}}') },

  // References & Citations
  { label: '\\cite', type: 'function', detail: 'Citation reference', apply: snippet('\\cite{${1:key}}') },
  { label: '\\ref', type: 'function', detail: 'Cross reference', apply: snippet('\\ref{${1:label}}') },
  { label: '\\eqref', type: 'function', detail: 'Equation reference', apply: snippet('\\eqref{eq:${1:label}}') },
  { label: '\\label', type: 'function', detail: 'Create label', apply: snippet('\\label{${1:label}}') },

  // Text Formatting
  { label: '\\textbf', type: 'keyword', detail: 'Bold text', apply: snippet('\\textbf{${1:text}}') },
  { label: '\\textit', type: 'keyword', detail: 'Italic text', apply: snippet('\\textit{${1:text}}') },
  { label: '\\texttt', type: 'keyword', detail: 'Monospace text', apply: snippet('\\texttt{${1:text}}') },
  { label: '\\underline', type: 'keyword', detail: 'Underline text', apply: snippet('\\underline{${1:text}}') },

  // Math Commands
  { label: '\\frac', type: 'function', detail: 'Fraction \\frac{a}{b}', apply: snippet('\\frac{${1:num}}{${2:den}}') },
  { label: '\\sqrt', type: 'function', detail: 'Square root', apply: snippet('\\sqrt{${1:x}}') },
  { label: '\\sum', type: 'constant', detail: 'Summation', apply: snippet('\\sum_{${1:i=1}}^{${2:n}}') },
  { label: '\\prod', type: 'constant', detail: 'Product', apply: snippet('\\prod_{${1:i=1}}^{${2:n}}') },
  { label: '\\int', type: 'constant', detail: 'Integral', apply: snippet('\\int_{${1:a}}^{${2:b}} ${3:f(x)} \\, dx') },
  { label: '\\lim', type: 'constant', detail: 'Limit', apply: snippet('\\lim_{${1:x} \\to ${2:\\infty}}') },

  // Greek Letters & Common Symbols
  { label: '\\alpha', type: 'variable', detail: 'Greek letter α' },
  { label: '\\beta', type: 'variable', detail: 'Greek letter β' },
  { label: '\\gamma', type: 'variable', detail: 'Greek letter γ' },
  { label: '\\delta', type: 'variable', detail: 'Greek letter δ' },
  { label: '\\epsilon', type: 'variable', detail: 'Greek letter ε' },
  { label: '\\theta', type: 'variable', detail: 'Greek letter θ' },
  { label: '\\lambda', type: 'variable', detail: 'Greek letter λ' },
  { label: '\\mu', type: 'variable', detail: 'Greek letter μ' },
  { label: '\\pi', type: 'variable', detail: 'Greek letter π' },
  { label: '\\sigma', type: 'variable', detail: 'Greek letter σ' },
  { label: '\\tau', type: 'variable', detail: 'Greek letter τ' },
  { label: '\\phi', type: 'variable', detail: 'Greek letter φ' },
  { label: '\\omega', type: 'variable', detail: 'Greek letter ω' },
  { label: '\\infty', type: 'constant', detail: 'Infinity ∞' },
  { label: '\\partial', type: 'constant', detail: 'Partial derivative ∂' },
  { label: '\\nabla', type: 'constant', detail: 'Nabla / Del ∇' },
  { label: '\\forall', type: 'constant', detail: 'For all ∀' },
  { label: '\\exists', type: 'constant', detail: 'Exists ∃' },
  { label: '\\in', type: 'operator', detail: 'Element of ∈' },
  { label: '\\subset', type: 'operator', detail: 'Subset of ⊂' },
  { label: '\\leq', type: 'operator', detail: 'Less than or equal ≤' },
  { label: '\\geq', type: 'operator', detail: 'Greater than or equal ≥' },
  { label: '\\neq', type: 'operator', detail: 'Not equal ≠' },
  { label: '\\approx', type: 'operator', detail: 'Approximately equal ≈' },
  { label: '\\times', type: 'operator', detail: 'Multiplication ×' },
  { label: '\\cdot', type: 'operator', detail: 'Dot product ·' },
];

export function latexAutocompleteSource(context: CompletionContext): CompletionResult | null {
  // 1. If user typed \begin{...}, complete environment names
  const envMatch = context.matchBefore(/\\begin\{[a-zA-Z]*/);
  if (envMatch) {
    const from = envMatch.from + 7; // after \begin{
    return {
      from,
      options: LATEX_ENVIRONMENTS.map((env) => ({
        label: env.label,
        type: 'class',
        detail: env.detail,
        apply: snippet(`${env.label}}\n\t\${1}\n\\end{${env.label}}`),
      })),
      validFor: /^[a-zA-Z]*$/,
    };
  }

  // 2. Cross-file BibTeX Citations: \cite{...}, \citep{...}, \citet{...}, etc.
  const citeMatch = context.matchBefore(/\\(?:cite|citep|citet|nocite|textcite|autocite)\*?(?:\[[^\]]*\])*\{[^}]*/);
  if (citeMatch) {
    const lastDelim = Math.max(citeMatch.text.lastIndexOf('{'), citeMatch.text.lastIndexOf(','));
    const from = citeMatch.from + lastDelim + 1;
    const query = citeMatch.text.slice(lastDelim + 1).trim();
    const citations = latexSymbolsIndex.getCitations(query);

    return {
      from,
      options: citations.map((entry) => ({
        label: entry.key,
        type: 'constant',
        detail: entry.type ? entry.type.toUpperCase() : 'BIB',
        info: () => {
          const parts: string[] = [];
          if (entry.title) parts.push(entry.title);
          if (entry.author) parts.push(`Author: ${entry.author}`);
          if (entry.year) parts.push(`Year: ${entry.year}`);
          if (entry.sourceFile) parts.push(`Source: ${entry.sourceFile}`);
          return parts.join('\n');
        },
        boost: 99,
      })),
      validFor: /^[^},\s]*$/,
    };
  }

  // 3. Cross-file Labels: \ref{...}, \eqref{...}, \pageref{...}, \autoref{...}, \cref{...}
  const refMatch = context.matchBefore(/\\(?:ref|eqref|pageref|autoref|cref|Cref)\*?\{[^}]*/);
  if (refMatch) {
    const lastDelim = Math.max(refMatch.text.lastIndexOf('{'), refMatch.text.lastIndexOf(','));
    const from = refMatch.from + lastDelim + 1;
    const query = refMatch.text.slice(lastDelim + 1).trim();
    const labels = latexSymbolsIndex.getLabels(query);

    return {
      from,
      options: labels.map((entry) => ({
        label: entry.name,
        type: 'variable',
        detail: `[${entry.type.toUpperCase()}]`,
        info: `Defined in ${entry.sourceFile} (line ${entry.line})`,
        boost: 99,
      })),
      validFor: /^[^},\s]*$/,
    };
  }

  // 4. File Inclusions: \input{...}, \include{...}, \subfile{...}
  const inputMatch = context.matchBefore(/\\(?:input|include|subfile)\*?\{[^}]*/);
  if (inputMatch) {
    const lastBrace = inputMatch.text.lastIndexOf('{');
    const from = inputMatch.from + lastBrace + 1;
    const query = inputMatch.text.slice(lastBrace + 1).trim();
    const includeFiles = latexSymbolsIndex.getIncludeFiles(query);

    return {
      from,
      options: includeFiles.map((file) => ({
        label: file,
        type: 'text',
        detail: 'LaTeX File',
        apply: file.replace(/\.tex$/, ''),
        boost: 99,
      })),
      validFor: /^[^}\s]*$/,
    };
  }

  // 5. Standard Commands & Custom Project Macros
  const word = context.matchBefore(/\\?[a-zA-Z]*/);
  if (!word || (word.from === word.to && !context.explicit)) {
    return null;
  }

  const isBackslash = word.text.startsWith('\\');
  const filteredCommands = isBackslash
    ? LATEX_COMMANDS
    : LATEX_COMMANDS.map((c) => ({
        ...c,
        label: c.label.replace(/^\\/, ''),
      }));

  const customCommands = latexSymbolsIndex.getCommands().map((cmd) => {
    const label = isBackslash ? cmd.name : cmd.name.replace(/^\\/, '');
    const argsSnippet = cmd.argsCount > 0
      ? Array.from({ length: cmd.argsCount }, (_, i) => `{$\{${i + 1}\}}`).join('')
      : '';
    return {
      label,
      type: 'function',
      detail: `Macro (${cmd.argsCount} arg${cmd.argsCount === 1 ? '' : 's'})`,
      apply: argsSnippet ? snippet(`${cmd.name}${argsSnippet}`) : cmd.name,
      boost: 50,
    };
  });

  return {
    from: word.from,
    options: [...filteredCommands, ...customCommands, ...LATEX_ENVIRONMENTS],
    validFor: /^\\?[a-zA-Z]*$/,
  };
}

export function createLatexAutocompleteExtension() {
  return autocompletion({
    override: [latexAutocompleteSource],
    defaultKeymap: true,
    icons: true,
  });
}
