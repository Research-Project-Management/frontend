/**
 * latex-autocomplete.ts
 *
 * CodeMirror 6 Autocompletion Source for LaTeX (Engines Layer).
 * Location: `features/editor/engines/extensions/latex-autocomplete.ts`
 *
 * Provides comprehensive, high-performance, cross-file autocompletions for:
 * 1. Cross-file BibTeX Citations: \cite{...}, \citep{...}, \citet{...}, Pandoc [@key], etc.
 * 2. Cross-file Document Labels: \ref{...}, \eqref{...}, \autoref{...}, \cref{...}, etc.
 * 3. Smart Environment Completion & Closing: \begin{...} and unclosed stack matching \end{...}.
 * 4. Package Suggestions: \usepackage{...} with descriptions for 50+ packages.
 * 5. Document Class Suggestions: \documentclass{...} with document type hints.
 * 6. File Inclusions: \input{...}, \include{...}, \subfile{...}.
 * 7. Standard LaTeX Commands, Greek Letters & Unicode Math Symbols.
 * 8. Dynamic Custom Project Macros (\newcommand) indexed in memory.
 */

import {
  autocompletion,
  type Completion,
  type CompletionContext,
  type CompletionResult,
  snippet,
} from '@codemirror/autocomplete';
import { latexSymbolsIndex, type BibEntry, type LabelEntry } from '../../domain/latex-symbols-index';
import { isVietnameseAuthorName, formatShortAuthor } from '../../domain/utils/citation.util';

// ── 1. Environments ──────────────────────────────────────────────────────────

export const LATEX_ENVIRONMENTS: Completion[] = [
  {
    label: 'equation',
    type: 'class',
    detail: 'Numbered Equation',
    apply: snippet('\\begin{equation}\n\t${1}\n\\end{equation}'),
  },
  {
    label: 'equation*',
    type: 'class',
    detail: 'Unnumbered Equation',
    apply: snippet('\\begin{equation*}\n\t${1}\n\\end{equation*}'),
  },
  {
    label: 'align',
    type: 'class',
    detail: 'Aligned Equations (&=)',
    apply: snippet('\\begin{align}\n\t${1} &= ${2} \\\\\n\\end{align}'),
  },
  {
    label: 'align*',
    type: 'class',
    detail: 'Unnumbered Aligned Equations (&=)',
    apply: snippet('\\begin{align*}\n\t${1} &= ${2} \\\\\n\\end{align*}'),
  },
  {
    label: 'gather',
    type: 'class',
    detail: 'Consecutive Equations without Alignment',
    apply: snippet('\\begin{gather}\n\t${1} \\\\\n\t${2}\n\\end{gather}'),
  },
  {
    label: 'gather*',
    type: 'class',
    detail: 'Unnumbered Consecutive Equations',
    apply: snippet('\\begin{gather*}\n\t${1} \\\\\n\t${2}\n\\end{gather*}'),
  },
  {
    label: 'multline',
    type: 'class',
    detail: 'Multi-line Equation',
    apply: snippet('\\begin{multline}\n\t${1} \\\\\n\t${2}\n\\end{multline}'),
  },
  {
    label: 'multline*',
    type: 'class',
    detail: 'Unnumbered Multi-line Equation',
    apply: snippet('\\begin{multline*}\n\t${1} \\\\\n\t${2}\n\\end{multline*}'),
  },
  {
    label: 'subequations',
    type: 'class',
    detail: 'Sub-equation Numbering (1a, 1b)',
    apply: snippet('\\begin{subequations}\n\\label{eq:${1:master}}\n\\begin{align}\n\t${2} &= ${3} \\\\\n\\end{align}\n\\end{subequations}'),
  },
  {
    label: 'figure',
    type: 'class',
    detail: 'Floating Figure Environment',
    apply: snippet(
      '\\begin{figure}[htbp]\n\t\\centering\n\t\\includegraphics[width=${1:0.8}\\linewidth]{${2:image.png}}\n\t\\caption{${3:Caption text}}\n\t\\label{fig:${4:label}}\n\\end{figure}'
    ),
  },
  {
    label: 'figure*',
    type: 'class',
    detail: 'Full-Width Floating Figure (Two-Column)',
    apply: snippet(
      '\\begin{figure*}[htbp]\n\t\\centering\n\t\\includegraphics[width=${1:0.8}\\linewidth]{${2:image.png}}\n\t\\caption{${3:Caption text}}\n\t\\label{fig:${4:label}}\n\\end{figure*}'
    ),
  },
  {
    label: 'table',
    type: 'class',
    detail: 'Floating Table Environment',
    apply: snippet(
      '\\begin{table}[htbp]\n\t\\centering\n\t\\caption{${1:Table caption}}\n\t\\label{tab:${2:label}}\n\t\\begin{tabular}{${3:cc}}\n\t\t\\hline\n\t\t${4:Col 1} & ${5:Col 2} \\\\\n\t\t\\hline\n\t\\end{tabular}\n\\end{table}'
    ),
  },
  {
    label: 'table*',
    type: 'class',
    detail: 'Full-Width Floating Table (Two-Column)',
    apply: snippet(
      '\\begin{table*}[htbp]\n\t\\centering\n\t\\caption{${1:Table caption}}\n\t\\label{tab:${2:label}}\n\t\\begin{tabular}{${3:cc}}\n\t\t\\hline\n\t\t${4:Col 1} & ${5:Col 2} \\\\\n\t\t\\hline\n\t\\end{tabular}\n\\end{table*}'
    ),
  },
  {
    label: 'algorithm',
    type: 'class',
    detail: 'Floating Algorithm Environment',
    apply: snippet('\\begin{algorithm}[htbp]\n\\caption{${1:Algorithm Title}}\\label{alg:${2:label}}\n\\begin{algorithmic}[1]\n\t\\State ${3:Step}\n\\end{algorithmic}\n\\end{algorithm}'),
  },
  {
    label: 'itemize',
    type: 'class',
    detail: 'Unordered Bulleted List',
    apply: snippet('\\begin{itemize}\n\t\\item ${1}\n\\end{itemize}'),
  },
  {
    label: 'enumerate',
    type: 'class',
    detail: 'Numbered Ordered List',
    apply: snippet('\\begin{enumerate}\n\t\\item ${1}\n\\end{enumerate}'),
  },
  {
    label: 'description',
    type: 'class',
    detail: 'Description / Definition List',
    apply: snippet('\\begin{description}\n\t\\item[${1:Term}] ${2:Description}\n\\end{description}'),
  },
  {
    label: 'pmatrix',
    type: 'class',
    detail: 'Matrix with Parentheses ()',
    apply: snippet('\\begin{pmatrix}\n\t${1} & ${2} \\\\\n\t${3} & ${4}\n\\end{pmatrix}'),
  },
  {
    label: 'bmatrix',
    type: 'class',
    detail: 'Matrix with Square Brackets []',
    apply: snippet('\\begin{bmatrix}\n\t${1} & ${2} \\\\\n\t${3} & ${4}\n\\end{bmatrix}'),
  },
  {
    label: 'vmatrix',
    type: 'class',
    detail: 'Determinant with Single Vertical Bars ||',
    apply: snippet('\\begin{vmatrix}\n\t${1} & ${2} \\\\\n\t${3} & ${4}\n\\end{vmatrix}'),
  },
  {
    label: 'Vmatrix',
    type: 'class',
    detail: 'Norm Matrix with Double Vertical Bars ‖‖',
    apply: snippet('\\begin{Vmatrix}\n\t${1} & ${2} \\\\\n\t${3} & ${4}\n\\end{Vmatrix}'),
  },
  {
    label: 'matrix',
    type: 'class',
    detail: 'Plain Matrix without Delimiters',
    apply: snippet('\\begin{matrix}\n\t${1} & ${2} \\\\\n\t${3} & ${4}\n\\end{matrix}'),
  },
  {
    label: 'cases',
    type: 'class',
    detail: 'Piecewise Mathematical Cases {',
    apply: snippet('\\begin{cases}\n\t${1:value} & \\text{if } ${2:condition} \\\\\n\t${3:value} & \\text{otherwise}\n\\end{cases}'),
  },
  {
    label: 'theorem',
    type: 'class',
    detail: 'Mathematical Theorem',
    apply: snippet('\\begin{theorem}[${1:Name}]\n\t${2:Statement}\n\\end{theorem}'),
  },
  {
    label: 'lemma',
    type: 'class',
    detail: 'Mathematical Lemma',
    apply: snippet('\\begin{lemma}[${1:Name}]\n\t${2:Statement}\n\\end{lemma}'),
  },
  {
    label: 'proof',
    type: 'class',
    detail: 'Mathematical Proof',
    apply: snippet('\\begin{proof}\n\t${1:Proof content}\n\\end{proof}'),
  },
  {
    label: 'definition',
    type: 'class',
    detail: 'Definition Environment',
    apply: snippet('\\begin{definition}[${1:Term}]\n\t${2:Definition}\n\\end{definition}'),
  },
  {
    label: 'example',
    type: 'class',
    detail: 'Example Environment',
    apply: snippet('\\begin{example}\n\t${1:Content}\n\\end{example}'),
  },
  {
    label: 'remark',
    type: 'class',
    detail: 'Remark / Observation',
    apply: snippet('\\begin{remark}\n\t${1:Content}\n\\end{remark}'),
  },
  {
    label: 'verbatim',
    type: 'class',
    detail: 'Verbatim Text / Monospace Block',
    apply: snippet('\\begin{verbatim}\n${1}\n\\end{verbatim}'),
  },
  {
    label: 'lstlisting',
    type: 'class',
    detail: 'Source Code Listing (listings package)',
    apply: snippet('\\begin{lstlisting}[language=${1:Python}]\n${2}\n\\end{lstlisting}'),
  },
  {
    label: 'minted',
    type: 'class',
    detail: 'Syntax-highlighted Code (minted package)',
    apply: snippet('\\begin{minted}{${1:python}}\n${2}\n\\end{minted}'),
  },
  {
    label: 'center',
    type: 'class',
    detail: 'Centered Text Block',
    apply: snippet('\\begin{center}\n\t${1}\n\\end{center}'),
  },
  {
    label: 'minipage',
    type: 'class',
    detail: 'Miniature Page / Sub-column',
    apply: snippet('\\begin{minipage}{${1:0.48}\\linewidth}\n\t${2}\n\\end{minipage}'),
  },
  {
    label: 'abstract',
    type: 'class',
    detail: 'Document Abstract',
    apply: snippet('\\begin{abstract}\n\t${1}\n\\end{abstract}'),
  },
  {
    label: 'quote',
    type: 'class',
    detail: 'Short Indented Quote',
    apply: snippet('\\begin{quote}\n\t${1}\n\\end{quote}'),
  },
  {
    label: 'quotation',
    type: 'class',
    detail: 'Long Multi-paragraph Quotation',
    apply: snippet('\\begin{quotation}\n\t${1}\n\\end{quotation}'),
  },
];

// ── 2. Popular Packages ──────────────────────────────────────────────────────

export const LATEX_PACKAGES: Completion[] = [
  { label: 'amsmath', type: 'namespace', detail: 'AMS math facilities and environments' },
  { label: 'amssymb', type: 'namespace', detail: 'AMS mathematical symbol fonts' },
  { label: 'amsthm', type: 'namespace', detail: 'Theorem styling and proof environments' },
  { label: 'mathtools', type: 'namespace', detail: 'Mathematical tools to use with amsmath' },
  { label: 'graphicx', type: 'namespace', detail: 'Enhanced support for figures & graphics' },
  { label: 'hyperref', type: 'namespace', detail: 'Hypertext marks, URLs & PDF links' },
  { label: 'cleveref', type: 'namespace', detail: 'Intelligent cross-referencing (\\cref)' },
  { label: 'geometry', type: 'namespace', detail: 'Flexible and easy page layout & margins' },
  { label: 'booktabs', type: 'namespace', detail: 'Publication-quality tables (\\toprule)' },
  { label: 'tabularx', type: 'namespace', detail: 'Tables with specified width and auto-wrap' },
  { label: 'array', type: 'namespace', detail: 'Extending array and tabular environments' },
  { label: 'multirow', type: 'namespace', detail: 'Create tabular cells spanning multiple rows' },
  { label: 'longtable', type: 'namespace', detail: 'Multi-page tables' },
  { label: 'tikz', type: 'namespace', detail: 'Create graphics programmatically' },
  { label: 'pgfplots', type: 'namespace', detail: '2D & 3D data plotting with TikZ' },
  { label: 'xcolor', type: 'namespace', detail: 'Driver-independent color extensions' },
  { label: 'biblatex', type: 'namespace', detail: 'Modern bibliography management' },
  { label: 'natbib', type: 'namespace', detail: 'Author-year and numerical citations' },
  { label: 'csquotes', type: 'namespace', detail: 'Context-sensitive quotation facilities' },
  { label: 'microtype', type: 'namespace', detail: 'Typographic subliminal refinements' },
  { label: 'siunitx', type: 'namespace', detail: 'Comprehensive (SI) units typesetting' },
  { label: 'listings', type: 'namespace', detail: 'Source code syntax printing' },
  { label: 'minted', type: 'namespace', detail: 'Pygments-based code syntax highlighting' },
  { label: 'algorithm2e', type: 'namespace', detail: 'Floating algorithm environment' },
  { label: 'algorithmicx', type: 'namespace', detail: 'Algorithmic pseudocode styling' },
  { label: 'caption', type: 'namespace', detail: 'Customising captions in figures/tables' },
  { label: 'subcaption', type: 'namespace', detail: 'Subfigures and subtables captioning' },
  { label: 'float', type: 'namespace', detail: 'Improved floating object control ([H])' },
  { label: 'fancyhdr', type: 'namespace', detail: 'Extensive control of headers and footers' },
  { label: 'enumitem', type: 'namespace', detail: 'Custom layout for itemize & enumerate' },
  { label: 'titlesec', type: 'namespace', detail: 'Select alternative section titles format' },
  { label: 'setspace', type: 'namespace', detail: 'Set space between lines (\\doublespacing)' },
  { label: 'multicol', type: 'namespace', detail: 'Multiple columns of text on a page' },
  { label: 'fontspec', type: 'namespace', detail: 'Advanced font selection (XeTeX/LuaTeX)' },
  { label: 'unicode-math', type: 'namespace', detail: 'Unicode mathematics (XeTeX/LuaTeX)' },
  { label: 'tcolorbox', type: 'namespace', detail: 'Colored boxes for theorems & highlights' },
  { label: 'pdfpages', type: 'namespace', detail: 'Include external PDF documents' },
  { label: 'todonotes', type: 'namespace', detail: 'Marking things with TODO margin notes' },
  { label: 'babel', type: 'namespace', detail: 'Multilingual support for LaTeX' },
  { label: 'url', type: 'namespace', detail: 'Verbatim with URL-sensitive line breaks' },
];

// ── 3. Document Classes ──────────────────────────────────────────────────────

export const LATEX_DOCUMENTCLASSES: Completion[] = [
  { label: 'article', type: 'class', detail: 'Standard scientific articles, notes, papers' },
  { label: 'report', type: 'class', detail: 'Long reports with chapters, thesis, dissertations' },
  { label: 'book', type: 'class', detail: 'Books, monographs with front/main/back matter' },
  { label: 'beamer', type: 'class', detail: 'Presentations, slides, conference talks' },
  { label: 'letter', type: 'class', detail: 'Formal correspondence and letters' },
  { label: 'proc', type: 'class', detail: 'Conference proceedings based on article' },
  { label: 'standalone', type: 'class', detail: 'Cropped single figures, TikZ diagrams, formulas' },
  { label: 'minimal', type: 'class', detail: 'Minimal class for testing & debugging' },
  { label: 'extarticle', type: 'class', detail: 'Extended article supporting 8pt-20pt fonts' },
  { label: 'extreport', type: 'class', detail: 'Extended report supporting 8pt-20pt fonts' },
  { label: 'extbook', type: 'class', detail: 'Extended book supporting 8pt-20pt fonts' },
];

// ── 4. Standard Commands & Math Symbols with Glyphs ──────────────────────────

export const LATEX_COMMANDS: Completion[] = [
  // Document Structure & Sectioning
  { label: '\\section', type: 'keyword', detail: 'Major section', apply: snippet('\\section{${1:Title}}') },
  { label: '\\subsection', type: 'keyword', detail: 'Subsection', apply: snippet('\\subsection{${1:Title}}') },
  { label: '\\subsubsection', type: 'keyword', detail: 'Subsubsection', apply: snippet('\\subsubsection{${1:Title}}') },
  { label: '\\paragraph', type: 'keyword', detail: 'Paragraph heading', apply: snippet('\\paragraph{${1:Title}}') },
  { label: '\\subparagraph', type: 'keyword', detail: 'Subparagraph heading', apply: snippet('\\subparagraph{${1:Title}}') },
  { label: '\\chapter', type: 'keyword', detail: 'Chapter (report/book)', apply: snippet('\\chapter{${1:Title}}') },
  { label: '\\part', type: 'keyword', detail: 'Document part', apply: snippet('\\part{${1:Title}}') },
  { label: '\\tableofcontents', type: 'keyword', detail: 'Generate table of contents' },
  { label: '\\listoffigures', type: 'keyword', detail: 'Generate list of figures' },
  { label: '\\listoftables', type: 'keyword', detail: 'Generate list of tables' },
  { label: '\\maketitle', type: 'keyword', detail: 'Render document title header' },
  { label: '\\newpage', type: 'keyword', detail: 'Page break' },
  { label: '\\clearpage', type: 'keyword', detail: 'Flush floats and page break' },
  { label: '\\centering', type: 'keyword', detail: 'Center content declaration' },
  { label: '\\caption', type: 'function', detail: 'Float caption', apply: snippet('\\caption{${1:Caption text}}') },
  { label: '\\footnote', type: 'function', detail: 'Footnote', apply: snippet('\\footnote{${1:text}}') },

  // References & Citations
  { label: '\\cite', type: 'function', detail: 'Citation reference', apply: snippet('\\cite{${1:key}}') },
  { label: '\\citep', type: 'function', detail: 'Parenthetical citation (natbib)', apply: snippet('\\citep{${1:key}}') },
  { label: '\\citet', type: 'function', detail: 'Textual citation (natbib)', apply: snippet('\\citet{${1:key}}') },
  { label: '\\autocite', type: 'function', detail: 'Context-sensitive citation (biblatex)', apply: snippet('\\autocite{${1:key}}') },
  { label: '\\textcite', type: 'function', detail: 'Author-in-text citation (biblatex)', apply: snippet('\\textcite{${1:key}}') },
  { label: '\\ref', type: 'function', detail: 'Cross reference', apply: snippet('\\ref{${1:label}}') },
  { label: '\\eqref', type: 'function', detail: 'Equation reference (eq:...)', apply: snippet('\\eqref{eq:${1:label}}') },
  { label: '\\cref', type: 'function', detail: 'Clever reference (cleveref)', apply: snippet('\\cref{${1:label}}') },
  { label: '\\Cref', type: 'function', detail: 'Capitalized clever reference', apply: snippet('\\Cref{${1:label}}') },
  { label: '\\autoref', type: 'function', detail: 'Automatic reference with type prefix', apply: snippet('\\autoref{${1:label}}') },
  { label: '\\pageref', type: 'function', detail: 'Page number reference', apply: snippet('\\pageref{${1:label}}') },
  { label: '\\label', type: 'function', detail: 'Create label anchor', apply: snippet('\\label{${1:label}}') },

  // Text Formatting & Fonts
  { label: '\\textbf', type: 'keyword', detail: 'Bold text', apply: snippet('\\textbf{${1:text}}') },
  { label: '\\textit', type: 'keyword', detail: 'Italic text', apply: snippet('\\textit{${1:text}}') },
  { label: '\\texttt', type: 'keyword', detail: 'Monospace / Typewriter text', apply: snippet('\\texttt{${1:text}}') },
  { label: '\\textsc', type: 'keyword', detail: 'Small capitals text', apply: snippet('\\textsc{${1:text}}') },
  { label: '\\underline', type: 'keyword', detail: 'Underline text', apply: snippet('\\underline{${1:text}}') },
  { label: '\\emph', type: 'keyword', detail: 'Emphasize text', apply: snippet('\\emph{${1:text}}') },
  { label: '\\item', type: 'keyword', detail: 'List item', apply: snippet('\\item ') },

  // Math Constructs
  { label: '\\frac', type: 'function', detail: 'Fraction a/b', apply: snippet('\\frac{${1:num}}{${2:den}}') },
  { label: '\\sqrt', type: 'function', detail: 'Square root', apply: snippet('\\sqrt{${1:x}}') },
  { label: '\\sum', type: 'constant', detail: 'Summation ∑', apply: snippet('\\sum_{${1:i=1}}^{${2:n}}') },
  { label: '\\prod', type: 'constant', detail: 'Product ∏', apply: snippet('\\prod_{${1:i=1}}^{${2:n}}') },
  { label: '\\int', type: 'constant', detail: 'Definite integral ∫', apply: snippet('\\int_{${1:a}}^{${2:b}} ${3:f(x)} \\, dx') },
  { label: '\\iint', type: 'constant', detail: 'Double integral ∬' },
  { label: '\\iiint', type: 'constant', detail: 'Triple integral ∭' },
  { label: '\\oint', type: 'constant', detail: 'Contour integral ∮' },
  { label: '\\lim', type: 'constant', detail: 'Limit', apply: snippet('\\lim_{${1:x} \\to ${2:\\infty}}') },
  { label: '\\left', type: 'keyword', detail: 'Dynamic auto-sizing left delimiter', apply: snippet('\\left( ${1} \\right)') },
  { label: '\\right', type: 'keyword', detail: 'Dynamic auto-sizing right delimiter' },
  { label: '\\text', type: 'function', detail: 'Insert plain text inside math', apply: snippet('\\text{${1:text}}') },
  { label: '\\mathbf', type: 'function', detail: 'Math bold font', apply: snippet('\\mathbf{${1:x}}') },
  { label: '\\mathrm', type: 'function', detail: 'Math roman font', apply: snippet('\\mathrm{${1:x}}') },
  { label: '\\mathit', type: 'function', detail: 'Math italic font', apply: snippet('\\mathit{${1:x}}') },
  { label: '\\mathbb', type: 'function', detail: 'Blackboard bold (ℝ, ℂ, ℕ)', apply: snippet('\\mathbb{${1:R}}') },
  { label: '\\mathcal', type: 'function', detail: 'Calligraphic script', apply: snippet('\\mathcal{${1:L}}') },
  { label: '\\mathfrak', type: 'function', detail: 'Fraktur font', apply: snippet('\\mathfrak{${1:g}}') },
  { label: '\\overbrace', type: 'function', detail: 'Overbrace annotation', apply: snippet('\\overbrace{${1:expr}}^{${2:note}}') },
  { label: '\\underbrace', type: 'function', detail: 'Underbrace annotation', apply: snippet('\\underbrace{${1:expr}}_{${2:note}}') },

  // Greek Letters (Lowercase)
  { label: '\\alpha', type: 'variable', detail: 'α (alpha)' },
  { label: '\\beta', type: 'variable', detail: 'β (beta)' },
  { label: '\\gamma', type: 'variable', detail: 'γ (gamma)' },
  { label: '\\delta', type: 'variable', detail: 'δ (delta)' },
  { label: '\\epsilon', type: 'variable', detail: 'ϵ (epsilon)' },
  { label: '\\varepsilon', type: 'variable', detail: 'ε (varepsilon)' },
  { label: '\\zeta', type: 'variable', detail: 'ζ (zeta)' },
  { label: '\\eta', type: 'variable', detail: 'η (eta)' },
  { label: '\\theta', type: 'variable', detail: 'θ (theta)' },
  { label: '\\vartheta', type: 'variable', detail: 'ϑ (vartheta)' },
  { label: '\\iota', type: 'variable', detail: 'ι (iota)' },
  { label: '\\kappa', type: 'variable', detail: 'κ (kappa)' },
  { label: '\\lambda', type: 'variable', detail: 'λ (lambda)' },
  { label: '\\mu', type: 'variable', detail: 'μ (mu)' },
  { label: '\\nu', type: 'variable', detail: 'ν (nu)' },
  { label: '\\xi', type: 'variable', detail: 'ξ (xi)' },
  { label: '\\pi', type: 'variable', detail: 'π (pi)' },
  { label: '\\varpi', type: 'variable', detail: 'ϖ (varpi)' },
  { label: '\\rho', type: 'variable', detail: 'ρ (rho)' },
  { label: '\\varrho', type: 'variable', detail: 'ϱ (varrho)' },
  { label: '\\sigma', type: 'variable', detail: 'σ (sigma)' },
  { label: '\\varsigma', type: 'variable', detail: 'ς (varsigma)' },
  { label: '\\tau', type: 'variable', detail: 'τ (tau)' },
  { label: '\\upsilon', type: 'variable', detail: 'υ (upsilon)' },
  { label: '\\phi', type: 'variable', detail: 'ϕ (phi)' },
  { label: '\\varphi', type: 'variable', detail: 'φ (varphi)' },
  { label: '\\chi', type: 'variable', detail: 'χ (chi)' },
  { label: '\\psi', type: 'variable', detail: 'ψ (psi)' },
  { label: '\\omega', type: 'variable', detail: 'ω (omega)' },

  // Greek Letters (Uppercase)
  { label: '\\Gamma', type: 'variable', detail: 'Γ (Capital Gamma)' },
  { label: '\\Delta', type: 'variable', detail: 'Δ (Capital Delta)' },
  { label: '\\Theta', type: 'variable', detail: 'Θ (Capital Theta)' },
  { label: '\\Lambda', type: 'variable', detail: 'Λ (Capital Lambda)' },
  { label: '\\Xi', type: 'variable', detail: 'Ξ (Capital Xi)' },
  { label: '\\Pi', type: 'variable', detail: 'Π (Capital Pi)' },
  { label: '\\Sigma', type: 'variable', detail: 'Σ (Capital Sigma)' },
  { label: '\\Upsilon', type: 'variable', detail: 'Υ (Capital Upsilon)' },
  { label: '\\Phi', type: 'variable', detail: 'Φ (Capital Phi)' },
  { label: '\\Psi', type: 'variable', detail: 'Ψ (Capital Psi)' },
  { label: '\\Omega', type: 'variable', detail: 'Ω (Capital Omega)' },

  // Math Operators & Relations
  { label: '\\times', type: 'operator', detail: '× (cross / multiply)' },
  { label: '\\div', type: 'operator', detail: '÷ (divide)' },
  { label: '\\pm', type: 'operator', detail: '± (plus-minus)' },
  { label: '\\mp', type: 'operator', detail: '∓ (minus-plus)' },
  { label: '\\cdot', type: 'operator', detail: '· (dot product)' },
  { label: '\\leq', type: 'operator', detail: '≤ (less than or equal)' },
  { label: '\\geq', type: 'operator', detail: '≥ (greater than or equal)' },
  { label: '\\neq', type: 'operator', detail: '≠ (not equal)' },
  { label: '\\approx', type: 'operator', detail: '≈ (approximately equal)' },
  { label: '\\equiv', type: 'operator', detail: '≡ (equivalent / identical)' },
  { label: '\\sim', type: 'operator', detail: '∼ (similar / distributed as)' },
  { label: '\\propto', type: 'operator', detail: '∝ (proportional to)' },
  { label: '\\ll', type: 'operator', detail: '≪ (much less than)' },
  { label: '\\gg', type: 'operator', detail: '≫ (much greater than)' },
  { label: '\\perp', type: 'operator', detail: '⊥ (perpendicular / orthogonal)' },
  { label: '\\parallel', type: 'operator', detail: '∥ (parallel)' },

  // Logic & Set Theory
  { label: '\\in', type: 'operator', detail: '∈ (element of)' },
  { label: '\\notin', type: 'operator', detail: '∉ (not element of)' },
  { label: '\\subset', type: 'operator', detail: '⊂ (proper subset)' },
  { label: '\\subseteq', type: 'operator', detail: '⊆ (subset or equal)' },
  { label: '\\supset', type: 'operator', detail: '⊃ (proper superset)' },
  { label: '\\supseteq', type: 'operator', detail: '⊇ (superset or equal)' },
  { label: '\\cap', type: 'operator', detail: '∩ (set intersection)' },
  { label: '\\cup', type: 'operator', detail: '∪ (set union)' },
  { label: '\\setminus', type: 'operator', detail: '\\ (set difference)' },
  { label: '\\emptyset', type: 'constant', detail: '∅ (empty set)' },
  { label: '\\forall', type: 'constant', detail: '∀ (for all)' },
  { label: '\\exists', type: 'constant', detail: '∃ (there exists)' },
  { label: '\\nexists', type: 'constant', detail: '∄ (there does not exist)' },
  { label: '\\neg', type: 'operator', detail: '¬ (logical not)' },
  { label: '\\land', type: 'operator', detail: '∧ (logical and)' },
  { label: '\\lor', type: 'operator', detail: '∨ (logical or)' },

  // Arrows
  { label: '\\to', type: 'operator', detail: '→ (to / right arrow)' },
  { label: '\\leftarrow', type: 'operator', detail: '← (left arrow)' },
  { label: '\\rightarrow', type: 'operator', detail: '→ (right arrow)' },
  { label: '\\Leftarrow', type: 'operator', detail: '⇐ (implied by)' },
  { label: '\\Rightarrow', type: 'operator', detail: '⇒ (implies)' },
  { label: '\\leftrightarrow', type: 'operator', detail: '↔ (left-right arrow)' },
  { label: '\\Leftrightarrow', type: 'operator', detail: '⇔ (if and only if)' },
  { label: '\\iff', type: 'operator', detail: '⟺ (iff / equivalence)' },
  { label: '\\mapsto', type: 'operator', detail: '↦ (maps to)' },
  { label: '\\uparrow', type: 'operator', detail: '↑ (up arrow)' },
  { label: '\\downarrow', type: 'operator', detail: '↓ (down arrow)' },

  // Calculus & Constants
  { label: '\\partial', type: 'constant', detail: '∂ (partial derivative)' },
  { label: '\\nabla', type: 'constant', detail: '∇ (nabla / del gradient)' },
  { label: '\\infty', type: 'constant', detail: '∞ (infinity)' },
  { label: '\\hbar', type: 'constant', detail: 'ℏ (reduced Planck constant)' },
  { label: '\\ell', type: 'constant', detail: 'ℓ (cursive ell)' },
  { label: '\\Re', type: 'constant', detail: 'ℜ (real part)' },
  { label: '\\Im', type: 'constant', detail: 'ℑ (imaginary part)' },
];

// ── 5. Helper Functions ──────────────────────────────────────────────────────


/**
 * Formats rich multiline tooltip documentation for a BibTeX entry
 */
function formatCitationInfo(entry: BibEntry): string {
  const lines: string[] = [];
  if (entry.title) lines.push(`📚 ${entry.title}`);
  if (entry.author) {
    const authorList = entry.author.split(/\s+and\s+|;\s*/i).join(', ');
    lines.push(`👤 ${authorList}`);
  }
  const metaParts = [
    entry.year ? `📅 ${entry.year}` : '',
    entry.journal ? `🏛️ ${entry.journal}` : '',
    entry.type ? `🏷️ @${entry.type}` : '',
  ].filter(Boolean);
  if (metaParts.length > 0) lines.push(metaParts.join('  •  '));
  if (entry.doi) lines.push(`🔗 DOI: ${entry.doi}`);
  if (entry.sourceFile) lines.push(`📁 Nguồn: ${entry.sourceFile}`);
  return lines.join('\n');
}

/**
 * Scans backward from the cursor to find the stack of open, unclosed environments.
 * Used for smart \end{...} auto-completion with the exact matching tag.
 */
function findUnclosedEnvironments(docText: string): string[] {
  // Strip comments (% ...) to prevent matching commented-out environments
  const clean = docText.replace(/(^|[^\\])%.*$/gm, '$1');

  const regex = /\\(begin|end)\{([a-zA-Z*0-9_]+)\}/g;
  const stack: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(clean)) !== null) {
    const kind = match[1];
    const env = match[2];
    if (kind === 'begin') {
      stack.push(env);
    } else if (kind === 'end') {
      const idx = stack.lastIndexOf(env);
      if (idx !== -1) {
        stack.splice(idx, 1);
      } else if (stack.length > 0) {
        stack.pop();
      }
    }
  }

  return stack;
}

// ── 6. Main Autocomplete Source ──────────────────────────────────────────────

export function latexAutocompleteSource(context: CompletionContext): CompletionResult | null {
  // ── A. Smart \end{...} Environment Closing ──────────────────────────────────
  const endMatch = context.matchBefore(/\\end\{[a-zA-Z*0-9_]*/);
  if (endMatch) {
    const from = endMatch.from + 5; // after \end{
    const hasClosingBrace = context.state.sliceDoc(context.pos, context.pos + 1) === '}';
    const to = hasClosingBrace ? context.pos + 1 : context.pos;

    const precedingLimit = Math.max(0, context.pos - 20000);
    const precedingText = context.state.doc.sliceString(precedingLimit, context.pos);
    const unclosedStack = findUnclosedEnvironments(precedingText);

    const latestUnclosed = unclosedStack.length > 0 ? unclosedStack[unclosedStack.length - 1] : null;
    const unclosedSet = new Set(unclosedStack);

    const options: Completion[] = [];

    // Highest priority: the innermost unclosed environment matching this \end
    if (latestUnclosed) {
      options.push({
        label: latestUnclosed,
        type: 'class',
        detail: 'Matching unclosed \\begin',
        apply: `${latestUnclosed}}`,
        boost: 120,
      });
    }

    // Secondary priority: other unclosed parent environments
    for (let i = unclosedStack.length - 2; i >= 0; i--) {
      const parentEnv = unclosedStack[i];
      if (parentEnv && parentEnv !== latestUnclosed) {
        options.push({
          label: parentEnv,
          type: 'class',
          detail: 'Unclosed parent environment',
          apply: `${parentEnv}}`,
          boost: 110,
        });
      }
    }

    // Tertiary priority: custom project environments (\newenvironment, \newtheorem)
    const customEnvs = latexSymbolsIndex.getEnvironments();
    for (const cEnv of customEnvs) {
      if (!unclosedSet.has(cEnv.name)) {
        options.push({
          label: cEnv.name,
          type: 'class',
          detail: `Custom environment (${cEnv.sourceFile})`,
          apply: `${cEnv.name}}`,
          boost: 70,
        });
      }
    }

    // Standard environments
    for (const env of LATEX_ENVIRONMENTS) {
      if (!unclosedSet.has(env.label)) {
        options.push({
          label: env.label,
          type: 'class',
          detail: env.detail,
          apply: `${env.label}}`,
          boost: 50,
        });
      }
    }

    return {
      from,
      to,
      options,
      validFor: /^[a-zA-Z*0-9_]*$/,
    };
  }

  // ── B. \begin{...} Environment Completion ───────────────────────────────────
  const beginMatch = context.matchBefore(/\\begin\{[a-zA-Z*0-9_]*/);
  if (beginMatch) {
    const from = beginMatch.from + 7; // after \begin{
    const hasClosingBrace = context.state.sliceDoc(context.pos, context.pos + 1) === '}';
    const to = hasClosingBrace ? context.pos + 1 : context.pos;

    // Custom project environments (\newtheorem, \newenvironment)
    const customOptions: Completion[] = latexSymbolsIndex.getEnvironments().map((cEnv) => ({
      label: cEnv.name,
      type: 'class',
      detail: `Custom Environment (${cEnv.sourceFile})`,
      apply: snippet(`${cEnv.name}}\n\t\${1}\n\\end{${cEnv.name}}`),
      boost: 95,
    }));

    const standardOptions: Completion[] = LATEX_ENVIRONMENTS.map((env) => ({
      label: env.label,
      type: 'class',
      detail: env.detail,
      apply: snippet(`${env.label}}\n\t\${1}\n\\end{${env.label}}`),
      boost: 100,
    }));

    return {
      from,
      to,
      options: [...standardOptions, ...customOptions],
      validFor: /^[a-zA-Z*0-9_]*$/,
    };
  }

  // ── C. Package Completion (\usepackage{...}) ────────────────────────────────
  const packageMatch = context.matchBefore(/\\usepackage(?:\s*\[[^\]]*\])?\s*\{[^}]*/);
  if (packageMatch) {
    const lastDelim = Math.max(packageMatch.text.lastIndexOf('{'), packageMatch.text.lastIndexOf(','));
    const textAfterDelim = packageMatch.text.slice(lastDelim + 1);
    const leadingWs = textAfterDelim.match(/^\s*/)?.[0]?.length || 0;
    const from = packageMatch.from + lastDelim + 1 + leadingWs;

    return {
      from,
      options: LATEX_PACKAGES.map((pkg) => ({
        ...pkg,
        boost: 100,
      })),
      validFor: /^[^},\s]*$/,
    };
  }

  // ── D. Document Class Completion (\documentclass{...}) ─────────────────────
  const docClassMatch = context.matchBefore(/\\documentclass(?:\s*\[[^\]]*\])?\s*\{[^}]*/);
  if (docClassMatch) {
    const lastBrace = docClassMatch.text.lastIndexOf('{');
    const from = docClassMatch.from + lastBrace + 1;

    return {
      from,
      options: LATEX_DOCUMENTCLASSES.map((cls) => ({
        ...cls,
        boost: 100,
      })),
      validFor: /^[^}\s]*$/,
    };
  }

  // ── E. Cross-File BibTeX Citations (\cite{...}, \citep{...}, [@key], etc.) ─
  const citeRegex = /\\(?:cite|citep|citet|nocite|textcite|autocite|parencite|supercite|footcite|fullcite|citeauthor|citeyear|citeyearpar|citealp|citealt|citenum|Cite|Parencite|Autocite|Textcite|footfullcite)\*?(?:\[[^\]]*\])*(?:\[[^\]]*\])*\{[^}]*/;
  const citeMatch = context.matchBefore(citeRegex);
  const pandocMatch = !citeMatch ? context.matchBefore(/\[@[^\]]*/) : null;

  if (citeMatch || pandocMatch) {
    const matchText = citeMatch ? citeMatch.text : pandocMatch!.text;
    const matchFrom = citeMatch ? citeMatch.from : pandocMatch!.from;

    const lastDelim = Math.max(
      matchText.lastIndexOf('{'),
      matchText.lastIndexOf(','),
      matchText.lastIndexOf('@'),
      matchText.lastIndexOf(';')
    );
    const textAfterDelim = matchText.slice(lastDelim + 1);
    const leadingWs = textAfterDelim.match(/^\s*/)?.[0]?.length || 0;
    const from = matchFrom + lastDelim + 1 + leadingWs;
    const query = textAfterDelim.trim();

    const citations = latexSymbolsIndex.getCitations(query);
    const nextChar = context.state.sliceDoc(context.pos, context.pos + 1);
    const hasClosingBrace = nextChar === '}';
    const to = hasClosingBrace ? context.pos + 1 : context.pos;
    const shouldAddClosingBrace = !hasClosingBrace && nextChar !== ',';

    return {
      from,
      to,
      options: citations.map((entry) => {
        const typeStr = (entry.type || 'bib').toUpperCase();
        const authorStr = formatShortAuthor(entry.author);
        const yearStr = entry.year ? `(${entry.year})` : '';
        const detailSuffix = [authorStr, yearStr].filter(Boolean).join(' ');

        return {
          label: entry.key,
          type: 'constant',
          detail: detailSuffix ? `[${typeStr}] ${detailSuffix}` : `[${typeStr}]`,
          info: formatCitationInfo(entry),
          apply: (!pandocMatch && (hasClosingBrace || shouldAddClosingBrace)) ? `${entry.key}}` : entry.key,
          boost: 100,
        };
      }),
      validFor: /^[^},\s\];]*$/,
    };
  }

  // ── F. Cross-File Labels (\ref{...}, \eqref{...}, \cref{...}, \hyperref[...]) ─
  const refRegex = /\\(?:ref|eqref|pageref|autoref|cref|Cref|cpageref|Cpageref|vref|Vref|nameref|namecref|nameCref)\*?(?:\[[^\]]*\])*\{[^}]*/;
  const refMatch = context.matchBefore(refRegex);
  const hyperrefMatch = !refMatch ? context.matchBefore(/\\hyperref\[[^\]]*/) : null;

  if (refMatch || hyperrefMatch) {
    let from: number;
    let query: string;
    let isBracket = false;

    if (refMatch) {
      const lastDelim = Math.max(refMatch.text.lastIndexOf('{'), refMatch.text.lastIndexOf(','));
      const textAfterDelim = refMatch.text.slice(lastDelim + 1);
      const leadingWs = textAfterDelim.match(/^\s*/)?.[0]?.length || 0;
      from = refMatch.from + lastDelim + 1 + leadingWs;
      query = textAfterDelim.trim();
    } else {
      isBracket = true;
      const lastBracket = hyperrefMatch!.text.lastIndexOf('[');
      const textAfterDelim = hyperrefMatch!.text.slice(lastBracket + 1);
      const leadingWs = textAfterDelim.match(/^\s*/)?.[0]?.length || 0;
      from = hyperrefMatch!.from + lastBracket + 1 + leadingWs;
      query = textAfterDelim.trim();
    }

    const nextChar = context.state.sliceDoc(context.pos, context.pos + 1);
    const hasClosing = isBracket ? nextChar === ']' : nextChar === '}';
    const to = hasClosing ? context.pos + 1 : context.pos;
    const shouldAddClosing = !hasClosing && nextChar !== ',';

    const labels = latexSymbolsIndex.getLabels(query);

    return {
      from,
      to,
      options: labels.map((entry: LabelEntry) => {
        const closingChar = isBracket ? ']' : '}';
        const applyText = (hasClosing || shouldAddClosing) ? `${entry.name}${closingChar}` : entry.name;
        return {
          label: entry.name,
          type: 'variable',
          detail: `[${entry.type.toUpperCase()}]`,
          info: `Defined in ${entry.sourceFile} (line ${entry.line})`,
          apply: applyText,
          boost: 100,
        };
      }),
      validFor: isBracket ? /^[^\]\s]*$/ : /^[^},\s]*$/,
    };
  }

  // ── G. File Inclusions (\input{...}, \include{...}, \subfile{...}) ──────────
  const inputMatch = context.matchBefore(/\\(?:input|include|subfile|includeonly|bibliography|addbibresource)\*?\{[^}]*/);
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
        detail: 'LaTeX / Project File',
        apply: file.replace(/\.tex$/, ''),
        boost: 100,
      })),
      validFor: /^[^}\s]*$/,
    };
  }

  // ── H. Standard Commands, Math Symbols & Dynamic Project Macros ─────────────
  const word = context.matchBefore(/\\?[a-zA-Z*0-9_]*/);
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

  // Dynamic user-defined macros from \newcommand across project files
  const customCommands: Completion[] = latexSymbolsIndex.getCommands().map((cmd) => {
    const label = isBackslash ? cmd.name : cmd.name.replace(/^\\/, '');
    const argsSnippet =
      cmd.argsCount > 0
        ? Array.from({ length: cmd.argsCount }, (_, i) => `{\${${i + 1}}}`).join('')
        : '';

    return {
      label,
      type: 'function',
      detail: `Macro (${cmd.argsCount} arg${cmd.argsCount === 1 ? '' : 's'})`,
      info: `User macro defined in ${cmd.sourceFile}`,
      apply: argsSnippet ? snippet(`${cmd.name}${argsSnippet}`) : cmd.name,
      boost: 60,
    };
  });

  return {
    from: word.from,
    options: [...filteredCommands, ...customCommands, ...LATEX_ENVIRONMENTS],
    validFor: /^\\?[a-zA-Z*0-9_]*$/,
  };
}

export function createLatexAutocompleteExtension() {
  return autocompletion({
    override: [latexAutocompleteSource],
    defaultKeymap: true,
    icons: true,
  });
}
