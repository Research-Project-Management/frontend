import type * as Monaco from 'monaco-editor';

export interface LatexSnippet {
  label: string;
  detail: string;
  documentation: string;
  snippet: string;
  kind: Monaco.languages.CompletionItemKind;
  prefixes?: string[];
}

export const LATEX_SNIPPETS: LatexSnippet[] = [
  // ── 1. Floating & Graphics ──────────────────────────────────────────────────
  {
    label: '\\begin{figure}',
    detail: 'Figure with Graphic & Caption',
    documentation: 'Standard floating figure environment with graphic inclusion, caption, and label.',
    snippet: '\\begin{figure}[${1:htbp}]\n\t\\centering\n\t\\includegraphics[width=${2:0.8\\linewidth}]{${3:figure.png}}\n\t\\caption{${4:Figure description here.}}\n\t\\label{fig:${5:my_figure}}\n\\end{figure}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
    prefixes: ['fig', 'figure', 'bfig'],
  },
  {
    label: '\\begin{subfigure}',
    detail: 'Subfigures Side-by-Side (subcaption)',
    documentation: 'Two subfigures side-by-side inside a parent figure environment.',
    snippet: '\\begin{figure}[${1:htbp}]\n\t\\centering\n\t\\begin{subfigure}[b]{${2:0.48\\textwidth}}\n\t\t\\centering\n\t\t\\includegraphics[width=\\linewidth]{${3:fig1.png}}\n\t\t\\caption{${4:First Subfigure}}\n\t\t\\label{fig:${5:sub1}}\n\t\\end{subfigure}\n\t\\hfill\n\t\\begin{subfigure}[b]{${2:0.48\\textwidth}}\n\t\t\\centering\n\t\t\\includegraphics[width=\\linewidth]{${6:fig2.png}}\n\t\t\\caption{${7:Second Subfigure}}\n\t\t\\label{fig:${8:sub2}}\n\t\\end{subfigure}\n\t\\caption{${9:Overall Figure Caption.}}\n\t\\label{fig:${10:combined_figure}}\n\\end{figure}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
    prefixes: ['subfig', 'subfigure', 'subfigures', 'bsubfig'],
  },
  {
    label: '\\begin{figure*}',
    detail: 'Two-Column Wide Figure',
    documentation: 'Spans across both columns in a two-column paper (IEEE/ACM).',
    snippet: '\\begin{figure*}[${1:t}]\n\t\\centering\n\t\\includegraphics[width=${2:0.9\\textwidth}]{${3:wide_figure.png}}\n\t\\caption{${4:Two-column spanning figure caption.}}\n\t\\label{fig:${5:wide_figure}}\n\\end{figure*}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
    prefixes: ['fig*', 'widefig', 'figure*'],
  },
  {
    label: '\\begin{wrapfigure}',
    detail: 'Text-Wrapping Figure (wrapfig)',
    documentation: 'Figure wrapped around paragraph text.',
    snippet: '\\begin{wrapfigure}{${1|r,l|}}{${2:0.5\\textwidth}}\n\t\\centering\n\t\\includegraphics[width=\\linewidth]{${3:wrapped_image.png}}\n\t\\caption{${4:Caption.}}\n\t\\label{fig:${5:wrap_fig}}\n\\end{wrapfigure}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
    prefixes: ['wrapfig', 'wrapfigure'],
  },
  {
    label: '\\includegraphics',
    detail: 'Include Graphics Image',
    documentation: 'Inserts an image with width or height scaling.',
    snippet: '\\includegraphics[width=${1:0.8\\linewidth}]{${2:image_path}}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
    prefixes: ['img', 'image', 'includegraphics'],
  },

  // ── 2. Tables & Tabular ─────────────────────────────────────────────────────
  {
    label: '\\begin{table}',
    detail: 'Floating Table (Booktabs)',
    documentation: 'Professional table using toprule, midrule, and bottomrule from booktabs.',
    snippet: '\\begin{table}[${1:htbp}]\n\t\\centering\n\t\\caption{${2:Table caption title.}}\n\t\\label{tab:${3:my_table}}\n\t\\begin{tabular}{${4:lcr}}\n\t\t\\toprule\n\t\t${5:Header 1} & ${6:Header 2} & ${7:Header 3} \\\\\n\t\t\\midrule\n\t\t${8:Data 1} & ${9:Data 2} & ${10:Data 3} \\\\\n\t\t\\bottomrule\n\t\\end{tabular}\n\\end{table}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
    prefixes: ['tab', 'table', 'btab', 'booktabs'],
  },
  {
    label: '\\begin{table*}',
    detail: 'Two-Column Wide Table',
    documentation: 'Spans across both columns in a two-column paper.',
    snippet: '\\begin{table*}[${1:t}]\n\t\\centering\n\t\\caption{${2:Two-column table caption.}}\n\t\\label{tab:${3:wide_table}}\n\t\\begin{tabular}{${4:lcccc}}\n\t\t\\toprule\n\t\t${5:Col 1} & ${6:Col 2} & ${7:Col 3} & ${8:Col 4} & ${9:Col 5} \\\\\n\t\t\\midrule\n\t\t${10:Val 1} & ${11:Val 2} & ${12:Val 3} & ${13:Val 4} & ${14:Val 5} \\\\\n\t\t\\bottomrule\n\t\\end{tabular}\n\\end{table*}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
    prefixes: ['tab*', 'widetable', 'table*'],
  },
  {
    label: '\\multicolumn',
    detail: 'Multi-Column Table Cell',
    documentation: 'Combines multiple columns into a single cell.',
    snippet: '\\multicolumn{${1:2}}{${2:c}}{${3:Merged Content}}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
    prefixes: ['multicolumn', 'mcol'],
  },
  {
    label: '\\multirow',
    detail: 'Multi-Row Table Cell',
    documentation: 'Combines multiple rows into a single cell (multirow package).',
    snippet: '\\multirow{${1:2}}{*}{\\textbf{${2:Merged Row}}}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
    prefixes: ['multirow', 'mrow'],
  },

  // ── 3. Algorithms & Code Listings ───────────────────────────────────────────
  {
    label: '\\begin{algorithm}',
    detail: 'Algorithm with Algorithmicx',
    documentation: 'Floating algorithm environment with step numbering, inputs, and outputs.',
    snippet: '\\begin{algorithm}[${1:htbp}]\n\t\\caption{${2:Algorithm Title}}\n\t\\label{alg:${3:my_algorithm}}\n\t\\begin{algorithmic}[1]\n\t\t\\Require ${4:Input specifications}\n\t\t\\Ensure ${5:Output specifications}\n\t\t\\State ${6:Initialize variables}\n\t\t\\For{${7:i = 1 \\dots N}}\n\t\t\t\\If{${8:condition}}\n\t\t\t\t\\State ${9:Compute result}\n\t\t\t\\EndIf\n\t\t\\EndFor\n\t\t\\State \\Return ${10:final_result}\n\t\\end{algorithmic}\n\\end{algorithm}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
    prefixes: ['alg', 'algorithm', 'pseudo', 'balg'],
  },
  {
    label: '\\begin{lstlisting}',
    detail: 'Source Code Listing (listings)',
    documentation: 'Syntax-highlighted code block with line numbering.',
    snippet: '\\begin{lstlisting}[language=${1|Python,C++,Java,Rust,Go,SQL|}, caption={${2:Code Description}}, label={lst:${3:code_snippet}}]\n${4:# Write source code here}\n\\end{lstlisting}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
    prefixes: ['code', 'lst', 'listing', 'lstlisting', 'bcode'],
  },
  {
    label: '\\begin{minted}',
    detail: 'Source Code Block (minted)',
    documentation: 'Modern Pygments code block with lineno and frame styling.',
    snippet: '\\begin{minted}[linenos, frame=lines, framesep=2mm]{${1|python,cpp,java,rust,bash,sql|}}\n${2:# Write source code here}\n\\end{minted}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
    prefixes: ['minted', 'bminted'],
  },
  {
    label: '\\lstinline',
    detail: 'Inline Code (listings)',
    documentation: 'Inline code snippet inside text.',
    snippet: '\\lstinline|${1:code_here}|$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
    prefixes: ['lstinline', 'icode'],
  },

  // ── 4. Mathematical Equations & Blocks ──────────────────────────────────────
  {
    label: '\\begin{equation}',
    detail: 'Numbered Math Equation',
    documentation: 'Creates a standard numbered single-line equation.',
    snippet: '\\begin{equation}\n\t${1:E = mc^2}\n\t\\label{eq:${2:label}}\n\\end{equation}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
    prefixes: ['eq', 'equation', 'beq'],
  },
  {
    label: '\\begin{equation*}',
    detail: 'Unnumbered Math Equation',
    documentation: 'Creates an unnumbered single-line equation.',
    snippet: '\\begin{equation*}\n\t${1:E = mc^2}\n\\end{equation*}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
    prefixes: ['eq*', 'equation*'],
  },
  {
    label: '\\begin{align}',
    detail: 'Aligned Multiline Equations',
    documentation: 'Creates an aligned multi-line equation block with & alignment and \\\\ line breaks.',
    snippet: '\\begin{align}\n\t${1:y} &= ${2:mx + b} \\label{eq:${3:align1}} \\\\\n\t${4:z} &= ${5:ax + c} \\label{eq:${6:align2}}\n\\end{align}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
    prefixes: ['ali', 'align', 'balign'],
  },
  {
    label: '\\begin{align*}',
    detail: 'Unnumbered Aligned Equations',
    documentation: 'Creates unnumbered aligned multi-line equations.',
    snippet: '\\begin{align*}\n\t${1:y} &= ${2:mx + b} \\\\\n\t${3:z} &= ${4:ax + c}\n\\end{align*}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
    prefixes: ['ali*', 'align*'],
  },
  {
    label: '\\begin{gather}',
    detail: 'Gather Equations (Centered, no alignment)',
    documentation: 'Consecutive centered equations without alignment marks.',
    snippet: '\\begin{gather}\n\t${1:a = b + c} \\label{eq:${2:gather1}} \\\\\n\t${3:d = e + f} \\label{eq:${4:gather2}}\n\\end{gather}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
    prefixes: ['gather', 'bgather'],
  },
  {
    label: '\\begin{gather*}',
    detail: 'Unnumbered Gather Equations',
    documentation: 'Consecutive centered equations without equation numbers.',
    snippet: '\\begin{gather*}\n\t${1:a = b + c} \\\\\n\t${2:d = e + f}\n\\end{gather*}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
    prefixes: ['gather*'],
  },
  {
    label: '\\begin{multline}',
    detail: 'Multline Long Equation',
    documentation: 'Splits a very long equation across lines with first line left and last line right.',
    snippet: '\\begin{multline}\n\t${1:f(x) = a + b + c + d} \\\\\n\t${2:+ e + f + g} \\\\\n\t${3:+ h + i + j}\n\\end{multline}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
    prefixes: ['multline', 'bmultline'],
  },
  {
    label: '\\begin{cases}',
    detail: 'Piecewise Cases Equation',
    documentation: 'Creates a piecewise case-by-case definition inside a math environment.',
    snippet: '\\begin{cases}\n\t${1:x}, & \\text{if } ${2:condition 1} \\\\\n\t${3:-x}, & \\text{otherwise}\n\\end{cases}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
    prefixes: ['cases', 'bcases'],
  },

  // ── 5. Matrices & Delimiters ────────────────────────────────────────────────
  {
    label: '\\begin{bmatrix}',
    detail: 'Matrix (Square Brackets bmatrix)',
    documentation: 'Creates a 2x2 or NxM matrix with square brackets [...].',
    snippet: '\\begin{bmatrix}\n\t${1:a_{11}} & ${2:a_{12}} \\\\\n\t${3:a_{21}} & ${4:a_{22}}\n\\end{bmatrix}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
    prefixes: ['bmat', 'bmatrix', 'matrix'],
  },
  {
    label: '\\begin{pmatrix}',
    detail: 'Matrix (Round Parentheses pmatrix)',
    documentation: 'Creates a matrix with round parentheses (...).',
    snippet: '\\begin{pmatrix}\n\t${1:a_{11}} & ${2:a_{12}} \\\\\n\t${3:a_{21}} & ${4:a_{22}}\n\\end{pmatrix}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
    prefixes: ['pmat', 'pmatrix'],
  },
  {
    label: '\\begin{vmatrix}',
    detail: 'Matrix Determinant (Vertical bars |...|)',
    documentation: 'Creates a determinant matrix with single vertical bars.',
    snippet: '\\begin{vmatrix}\n\t${1:a_{11}} & ${2:a_{12}} \\\\\n\t${3:a_{21}} & ${4:a_{22}}\n\\end{vmatrix}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
    prefixes: ['vmat', 'vmatrix', 'det'],
  },
  {
    label: '\\begin{Vmatrix}',
    detail: 'Matrix Norm (Double vertical bars ||...||)',
    documentation: 'Creates a matrix with double vertical bars.',
    snippet: '\\begin{Vmatrix}\n\t${1:a_{11}} & ${2:a_{12}} \\\\\n\t${3:a_{21}} & ${4:a_{22}}\n\\end{Vmatrix}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
    prefixes: ['Vmat', 'Vmatrix', 'norm'],
  },
  {
    label: '\\left( ... \\right)',
    detail: 'Auto-sizing Parentheses',
    documentation: 'Parentheses that scale dynamically with expression height.',
    snippet: '\\left( ${1:expression} \\right)$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
    prefixes: ['lr(', 'left('],
  },
  {
    label: '\\left[ ... \\right]',
    detail: 'Auto-sizing Square Brackets',
    documentation: 'Square brackets that scale dynamically with expression height.',
    snippet: '\\left[ ${1:expression} \\right]$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
    prefixes: ['lr[', 'left['],
  },
  {
    label: '\\left\\{ ... \\right\\}',
    detail: 'Auto-sizing Curly Braces',
    documentation: 'Curly braces that scale dynamically with expression height.',
    snippet: '\\left\\{ ${1:expression} \\right\\}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
    prefixes: ['lr{', 'left{'],
  },

  // ── 6. Scientific Theorems & Proofs ─────────────────────────────────────────
  {
    label: '\\begin{theorem}',
    detail: 'Theorem Environment',
    documentation: 'Creates a formal mathematical theorem block.',
    snippet: '\\begin{theorem}[${1:Theorem Name}]\n\t${2:State the formal theorem statement here.}\n\\end{theorem}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
    prefixes: ['thm', 'theorem', 'bthm'],
  },
  {
    label: '\\begin{lemma}',
    detail: 'Lemma Environment',
    documentation: 'Creates a mathematical lemma block.',
    snippet: '\\begin{lemma}\n\t${1:State the supporting lemma statement here.}\n\\end{lemma}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
    prefixes: ['lem', 'lemma', 'blem'],
  },
  {
    label: '\\begin{corollary}',
    detail: 'Corollary Environment',
    documentation: 'Creates a mathematical corollary derived from a theorem.',
    snippet: '\\begin{corollary}\n\t${1:State the corollary result here.}\n\\end{corollary}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
    prefixes: ['cor', 'corollary', 'bcor'],
  },
  {
    label: '\\begin{definition}',
    detail: 'Definition Environment',
    documentation: 'Formal definition of a scientific concept or notation.',
    snippet: '\\begin{definition}[${1:Concept Name}]\n\t${2:Definition details here.}\n\\end{definition}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
    prefixes: ['def', 'definition', 'bdef'],
  },
  {
    label: '\\begin{proposition}',
    detail: 'Proposition Environment',
    documentation: 'Mathematical proposition statement.',
    snippet: '\\begin{proposition}\n\t${1:State the proposition here.}\n\\end{proposition}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
    prefixes: ['prop', 'proposition', 'bprop'],
  },
  {
    label: '\\begin{remark}',
    detail: 'Remark Environment',
    documentation: 'Clarifying remark or observational note.',
    snippet: '\\begin{remark}\n\t${1:Remark explanation.}\n\\end{remark}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
    prefixes: ['rem', 'remark', 'brem'],
  },
  {
    label: '\\begin{example}',
    detail: 'Example Environment',
    documentation: 'Concrete example demonstrating a theory.',
    snippet: '\\begin{example}\n\t${1:Example description.}\n\\end{example}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
    prefixes: ['ex', 'example', 'bex'],
  },
  {
    label: '\\begin{proof}',
    detail: 'Mathematical Proof Block',
    documentation: 'Creates a formal proof environment with ending Q.E.D. symbol.',
    snippet: '\\begin{proof}\n\t${1:Write the detailed formal derivation and proof steps here.}\n\\end{proof}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
    prefixes: ['proof', 'bproof'],
  },

  // ── 7. Lists & Enumerations ─────────────────────────────────────────────────
  {
    label: '\\begin{itemize}',
    detail: 'Unordered Bulleted List',
    documentation: 'Creates an itemized bulleted list.',
    snippet: '\\begin{itemize}\n\t\\item ${1:First point}\n\t\\item ${2:Second point}\n\t\\item ${3:Third point}\n\\end{itemize}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
    prefixes: ['item', 'itemize', 'bitem', 'bullet'],
  },
  {
    label: '\\begin{enumerate}',
    detail: 'Numbered Ordered List',
    documentation: 'Creates an enumerated numbered list.',
    snippet: '\\begin{enumerate}\n\t\\item ${1:First item}\n\t\\item ${2:Second item}\n\t\\item ${3:Third item}\n\\end{enumerate}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
    prefixes: ['enum', 'enumerate', 'benum'],
  },
  {
    label: '\\begin{description}',
    detail: 'Description / Glossary List',
    documentation: 'List with customizable bold label terms.',
    snippet: '\\begin{description}\n\t\\item[${1:Term 1}] ${2:Description 1}\n\t\\item[${3:Term 2}] ${4:Description 2}\n\\end{description}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
    prefixes: ['desc', 'description', 'bdesc'],
  },

  // ── 8. Beamer Presentation Slides ───────────────────────────────────────────
  {
    label: '\\begin{frame}',
    detail: 'Beamer Slide Frame',
    documentation: 'Creates a slide presentation frame with title and subtitle.',
    snippet: '\\begin{frame}{${1:Slide Title}}{${2:Optional Subtitle}}\n\t${3:Slide contents here...}\n\\end{frame}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
    prefixes: ['frame', 'slide', 'bframe'],
  },
  {
    label: '\\begin{block}',
    detail: 'Beamer Information Block',
    documentation: 'Creates a colored highlighted block in Beamer.',
    snippet: '\\begin{block}{${1:Block Title}}\n\t${2:Block content goes here.}\n\\end{block}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
    prefixes: ['block', 'bblock'],
  },
  {
    label: '\\begin{columns}',
    detail: 'Beamer Two-Column Layout',
    documentation: 'Splits a Beamer slide into two equal or custom columns.',
    snippet: '\\begin{columns}\n\t\\begin{column}{${1:0.5\\textwidth}}\n\t\t${2:Left column content}\n\t\\end{column}\n\t\\begin{column}{${1:0.5\\textwidth}}\n\t\t${3:Right column content}\n\t\\end{column}\n\\end{columns}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
    prefixes: ['cols', 'columns', 'bcols'],
  },

  // ── 9. BibTeX Templates ─────────────────────────────────────────────────────
  {
    label: '@article',
    detail: 'BibTeX: Journal Article',
    documentation: 'Bibliographic entry for an article in a journal or magazine.',
    snippet: '@article{${1:citation_key},\n\tauthor = {${2:Author Name}},\n\ttitle = {${3:Article Title}},\n\tjournal = {${4:Journal Name}},\n\tyear = {${5:2026}},\n\tvolume = {${6:1}},\n\tnumber = {${7:1}},\n\tpages = {${8:1--10}},\n\tdoi = {${9:10.1000/xyz}}\n}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
    prefixes: ['article', '@article', 'bibarticle'],
  },
  {
    label: '@inproceedings',
    detail: 'BibTeX: Conference Proceedings',
    documentation: 'Bibliographic entry for a paper in a conference proceedings.',
    snippet: '@inproceedings{${1:citation_key},\n\tauthor = {${2:Author Name}},\n\ttitle = {${3:Paper Title}},\n\tbooktitle = {${4:Proceedings of Conference Name}},\n\tyear = {${5:2026}},\n\tpages = {${6:100--108}},\n\tpublisher = {${7:IEEE}}\n}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
    prefixes: ['inproceedings', '@inproceedings', 'conference', 'bibconf'],
  },
  {
    label: '@book',
    detail: 'BibTeX: Book',
    documentation: 'Bibliographic entry for a published book with an explicit publisher.',
    snippet: '@book{${1:citation_key},\n\tauthor = {${2:Author Name}},\n\ttitle = {${3:Book Title}},\n\tpublisher = {${4:Publisher Name}},\n\tyear = {${5:2026}},\n\taddress = {${6:City}},\n\tedition = {${7:2nd}}\n}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
    prefixes: ['book', '@book', 'bibbook'],
  },
  {
    label: '@techreport',
    detail: 'BibTeX: Technical Report / Preprint',
    documentation: 'Bibliographic entry for an institutional report or arXiv preprint.',
    snippet: '@techreport{${1:citation_key},\n\tauthor = {${2:Author Name}},\n\ttitle = {${3:Report Title}},\n\tinstitution = {${4:Institution or University}},\n\tyear = {${5:2026}},\n\tnumber = {${6:arXiv:2601.12345}}\n}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
    prefixes: ['techreport', '@techreport', 'preprint', 'arxiv'],
  },
  {
    label: '@misc',
    detail: 'BibTeX: Online / Software / Dataset',
    documentation: 'Bibliographic entry for a website, software package, or open repository.',
    snippet: '@misc{${1:citation_key},\n\tauthor = {${2:Author Name}},\n\ttitle = {${3:Resource or Software Title}},\n\tyear = {${4:2026}},\n\thowpublished = {\\url{${5:https://github.com/example}}},\n\tnote = {Accessed: ${6:2026-09-16}}\n}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
    prefixes: ['misc', '@misc', 'online', 'web', 'bibmisc'],
  },

  // ── 10. Structure & Sectioning ──────────────────────────────────────────────
  {
    label: '\\section',
    detail: 'Top-Level Section',
    documentation: 'Creates a top-level \\section{Title} with label.',
    snippet: '\\section{${1:Section Title}}\n\\label{sec:${2:sec_label}}\n$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
    prefixes: ['sec', 'section'],
  },
  {
    label: '\\subsection',
    detail: 'Subsection',
    documentation: 'Creates a \\subsection{Title} with label.',
    snippet: '\\subsection{${1:Subsection Title}}\n\\label{subsec:${2:subsec_label}}\n$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
    prefixes: ['ssec', 'subsection'],
  },
  {
    label: '\\subsubsection',
    detail: 'Subsubsection',
    documentation: 'Creates a \\subsubsection{Title} with label.',
    snippet: '\\subsubsection{${1:Subsubsection Title}}\n\\label{subsubsec:${2:subsubsec_label}}\n$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
    prefixes: ['sssec', 'subsubsection'],
  },
  {
    label: '\\paragraph',
    detail: 'In-line Paragraph Heading',
    documentation: 'Creates a bold run-in \\paragraph{Title}.',
    snippet: '\\paragraph{${1:Paragraph Title}} ${0:Content starts here...}',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
    prefixes: ['par', 'paragraph'],
  },

  // ── 11. Mathematics Macros ──────────────────────────────────────────────────
  {
    label: '\\frac',
    detail: 'Fractions \\frac{a}{b}',
    documentation: 'Creates a mathematical fraction with numerator and denominator.',
    snippet: '\\frac{${1:numerator}}{${2:denominator}}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
    prefixes: ['frac', 'fraction'],
  },
  {
    label: '\\sqrt',
    detail: 'Square Root \\sqrt{x}',
    documentation: 'Creates a radical or square root.',
    snippet: '\\sqrt{${1:x}}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
    prefixes: ['sqrt', 'root'],
  },
  {
    label: '\\sum',
    detail: 'Summation \\sum_{i=1}^{n}',
    documentation: 'Summation with lower and upper limits.',
    snippet: '\\sum_{${1:i=1}}^{${2:n}} ${3:x_i}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
    prefixes: ['sum', 'summation'],
  },
  {
    label: '\\int',
    detail: 'Definite Integral \\int_{a}^{b}',
    documentation: 'Definite integral with lower and upper bounds.',
    snippet: '\\int_{${1:a}}^{${2:b}} ${3:f(x)} \\, d${4:x}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
    prefixes: ['int', 'integral'],
  },
  {
    label: '\\lim',
    detail: 'Limit \\lim_{x \\to \\infty}',
    documentation: 'Limit with approach target.',
    snippet: '\\lim_{${1:x} \\to ${2:\\infty}} ${3:f(x)}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
    prefixes: ['lim', 'limit'],
  },
  {
    label: '\\mathbb',
    detail: 'Blackboard Bold \\mathbb{R}',
    documentation: 'Math blackboard font for sets (Real, Natural, Complex).',
    snippet: '\\mathbb{${1:R}}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
    prefixes: ['bb', 'mathbb'],
  },
  {
    label: '\\mathcal',
    detail: 'Calligraphic Font \\mathcal{L}',
    documentation: 'Calligraphic font for loss functions, sets, or operators.',
    snippet: '\\mathcal{${1:L}}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
    prefixes: ['cal', 'mathcal'],
  },
  {
    label: '\\mathbf',
    detail: 'Bold Vector/Matrix \\mathbf{x}',
    documentation: 'Bold font for vectors and matrices.',
    snippet: '\\mathbf{${1:x}}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
    prefixes: ['bf', 'mathbf'],
  },

  // ── 12. Text Styles & Cross-References ──────────────────────────────────────
  {
    label: '\\textbf',
    detail: 'Bold Text',
    documentation: 'Applies bold face weight to text.',
    snippet: '\\textbf{${1:bold text}}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
    prefixes: ['bold', 'textbf'],
  },
  {
    label: '\\textit',
    detail: 'Italic Text',
    documentation: 'Applies italic font shape to text.',
    snippet: '\\textit{${1:italic text}}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
    prefixes: ['italic', 'textit'],
  },
  {
    label: '\\underline',
    detail: 'Underlined Text',
    documentation: 'Underlines the enclosed text.',
    snippet: '\\underline{${1:underlined text}}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
    prefixes: ['underline'],
  },
  {
    label: '\\emph',
    detail: 'Emphasized Text',
    documentation: 'Context-sensitive emphasis (italics or roman).',
    snippet: '\\emph{${1:emphasized text}}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
    prefixes: ['emph'],
  },
  {
    label: '\\ref',
    detail: 'Cross-Reference',
    documentation: 'References a numbered section, figure, table, or equation.',
    snippet: '\\ref{${1:label}}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
    prefixes: ['ref'],
  },
  {
    label: '\\eqref',
    detail: 'Equation Reference (with parentheses)',
    documentation: 'References an equation with automatic parentheses, e.g. (1).',
    snippet: '\\eqref{eq:${1:label}}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
    prefixes: ['eqref', 'eqr'],
  },
  {
    label: '\\cite',
    detail: 'Bibliography Citation',
    documentation: 'Cites a reference key from the bibliography.',
    snippet: '\\cite{${1:citation_key}}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
    prefixes: ['cite'],
  },
  {
    label: '\\footnote',
    detail: 'Footnote',
    documentation: 'Creates a numbered footnote at bottom of page.',
    snippet: '\\footnote{${1:Footnote explanation text.}}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
    prefixes: ['footnote', 'fn'],
  },
  {
    label: '\\href',
    detail: 'Hyperlink with Custom Text',
    documentation: 'Clickable hyperlink with URL and display anchor text.',
    snippet: '\\href{${1:https://example.com}}{${2:link text}}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
    prefixes: ['href'],
  },
  {
    label: '\\url',
    detail: 'Raw URL Hyperlink',
    documentation: 'Clickable raw URL.',
    snippet: '\\url{${1:https://example.com}}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
    prefixes: ['url'],
  },
];

/**
 * Parses matching \begin{env} and \end{env} pairs in a document model around a cursor position.
 * Used by Monaco LinkedEditingRangeProvider.
 */
export function findMatchingEnvironmentRanges(
  model: Monaco.editor.ITextModel,
  position: Monaco.IPosition,
): { beginRange: Monaco.IRange; endRange: Monaco.IRange; envName: string } | null {
  const lineContent = model.getLineContent(position.lineNumber);
  const col = position.column;

  // Regex to detect if cursor is on an environment name in \begin{...} or \end{...}
  const envRegex = /\\(begin|end)\{([a-zA-Z0-9*_-]+)\}/g;
  let match: RegExpExecArray | null;
  let targetTag: 'begin' | 'end' | null = null;
  let targetEnv: string | null = null;
  let targetRange: { startCol: number; endCol: number } | null = null;

  while ((match = envRegex.exec(lineContent)) !== null) {
    const fullMatch = match[0];
    const tagType = match[1] as 'begin' | 'end';
    const env = match[2];
    const nameStartCol = match.index + (tagType === 'begin' ? 8 : 6); // column 1-based: index + prefix length + 1
    const nameEndCol = nameStartCol + env.length;

    if (col >= nameStartCol && col <= nameEndCol + 1) {
      targetTag = tagType;
      targetEnv = env;
      targetRange = { startCol: nameStartCol, endCol: nameEndCol };
      break;
    }
  }

  if (!targetTag || !targetEnv || !targetRange) {
    return null;
  }

  const lineCount = model.getLineCount();

  if (targetTag === 'begin') {
    // Scan forward from current line to find the matching \end{env}
    let depth = 1;
    const currentLine = position.lineNumber;

    for (let l = currentLine; l <= lineCount; l++) {
      const text = model.getLineContent(l);
      const startIdx = l === currentLine ? targetRange.endCol : 0;
      const scanText = text.substring(startIdx);
      const scanRegex = /\\(begin|end)\{([a-zA-Z0-9*_-]+)\}/g;
      let scanMatch: RegExpExecArray | null;

      while ((scanMatch = scanRegex.exec(scanText)) !== null) {
        const type = scanMatch[1];
        const name = scanMatch[2];

        if (name === targetEnv) {
          if (type === 'begin') {
            depth++;
          } else if (type === 'end') {
            depth--;
            if (depth === 0) {
              const matchIndex = startIdx + scanMatch.index;
              const endNameCol = matchIndex + 6; // 1-based column for name in \end{
              return {
                beginRange: {
                  startLineNumber: position.lineNumber,
                  startColumn: targetRange.startCol,
                  endLineNumber: position.lineNumber,
                  endColumn: targetRange.endCol,
                },
                endRange: {
                  startLineNumber: l,
                  startColumn: endNameCol,
                  endLineNumber: l,
                  endColumn: endNameCol + targetEnv.length,
                },
                envName: targetEnv,
              };
            }
          }
        }
      }
    }
  } else {
    // Scan backward from current line to find matching \begin{env}
    let depth = 1;
    const currentLine = position.lineNumber;

    for (let l = currentLine; l >= 1; l--) {
      const text = model.getLineContent(l);
      const endIdx = l === currentLine ? targetRange.startCol - 1 : text.length;
      const scanText = text.substring(0, endIdx);
      const matches: Array<{ type: string; name: string; index: number }> = [];
      const scanRegex = /\\(begin|end)\{([a-zA-Z0-9*_-]+)\}/g;
      let scanMatch: RegExpExecArray | null;

      while ((scanMatch = scanRegex.exec(scanText)) !== null) {
        matches.push({ type: scanMatch[1], name: scanMatch[2], index: scanMatch.index });
      }

      // Reverse iterate so we go backwards
      for (let i = matches.length - 1; i >= 0; i--) {
        const m = matches[i];
        if (m.name === targetEnv) {
          if (m.type === 'end') {
            depth++;
          } else if (m.type === 'begin') {
            depth--;
            if (depth === 0) {
              const beginNameCol = m.index + 8; // 1-based column for name in \begin{
              return {
                beginRange: {
                  startLineNumber: l,
                  startColumn: beginNameCol,
                  endLineNumber: l,
                  endColumn: beginNameCol + targetEnv.length,
                },
                endRange: {
                  startLineNumber: position.lineNumber,
                  startColumn: targetRange.startCol,
                  endLineNumber: position.lineNumber,
                  endColumn: targetRange.endCol,
                },
                envName: targetEnv,
              };
            }
          }
        }
      }
    }
  }

  return null;
}

/**
 * Registers LaTeX Environment & Math Snippets with Monaco.
 * Supports both backslash triggers (`\fig`) and plain word aliases (`fig`).
 */
export function registerLatexSnippets(
  monaco: typeof Monaco,
  languages: string[] = ['latex'],
): Monaco.IDisposable {
  const disposables: Monaco.IDisposable[] = [];

  for (const language of languages) {
    const disposable = monaco.languages.registerCompletionItemProvider(language, {
      triggerCharacters: ['\\', '{', '@'],
      provideCompletionItems(model, position) {
        const word = model.getWordUntilPosition(position);
        const lineContent = model.getLineContent(position.lineNumber);
        const charBefore = lineContent[position.column - 2] || '';

        const isBackslashPreceded = charBefore === '\\';

        const suggestions: Monaco.languages.CompletionItem[] = [];

        // 1. Backslash-triggered suggestions (when typing `\`)
        if (isBackslashPreceded) {
          const range = new monaco.Range(
            position.lineNumber,
            position.column - 1, // include the backslash
            position.lineNumber,
            position.column,
          );

          for (const item of LATEX_SNIPPETS) {
            suggestions.push({
              label: item.label,
              kind: item.kind,
              detail: item.detail,
              documentation: item.documentation,
              insertText: item.snippet,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              range,
              sortText: `0_${item.label}`,
            });

            // If snippet has aliases, also match when user types `\` + alias (e.g. `\fig`)
            if (item.prefixes) {
              for (const prefix of item.prefixes) {
                suggestions.push({
                  label: `\\${prefix}`,
                  kind: item.kind,
                  detail: `${item.detail} (${item.label})`,
                  documentation: item.documentation,
                  insertText: item.snippet,
                  insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                  range,
                  sortText: `1_${prefix}`,
                });
              }
            }
          }
        } else {
          // 2. Plain word alias triggers (e.g. typing `fig`, `tab`, `eq`, `code`, `@article`)
          const range = new monaco.Range(
            position.lineNumber,
            word.startColumn,
            position.lineNumber,
            word.endColumn,
          );

          for (const item of LATEX_SNIPPETS) {
            if (item.prefixes) {
              for (const prefix of item.prefixes) {
                suggestions.push({
                  label: prefix,
                  kind: item.kind,
                  detail: `${item.detail} (${item.label})`,
                  documentation: item.documentation,
                  insertText: item.snippet,
                  insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                  range,
                  sortText: `2_${prefix}`,
                });
              }
            }
          }
        }

        return { suggestions };
      },
    });

    disposables.push(disposable);
  }

  return {
    dispose: () => disposables.forEach((d) => d.dispose()),
  };
}

/**
 * Registers Linked Editing Ranges for LaTeX environment pairs (\begin{env} <-> \end{env}).
 * When user edits the environment name at \begin{...}, the matching \end{...} automatically updates in real-time.
 */
export function registerLatexLinkedEditing(
  monaco: typeof Monaco,
  languages: string[] = ['latex'],
): Monaco.IDisposable {
  const disposables: Monaco.IDisposable[] = [];

  for (const language of languages) {
    if (monaco.languages.registerLinkedEditingRangeProvider) {
      const disposable = monaco.languages.registerLinkedEditingRangeProvider(language, {
        provideLinkedEditingRanges(model, position) {
          const match = findMatchingEnvironmentRanges(model, position);
          if (!match) return null;

          return {
            ranges: [
              new monaco.Range(
                match.beginRange.startLineNumber,
                match.beginRange.startColumn,
                match.beginRange.endLineNumber,
                match.beginRange.endColumn,
              ),
              new monaco.Range(
                match.endRange.startLineNumber,
                match.endRange.startColumn,
                match.endRange.endLineNumber,
                match.endRange.endColumn,
              ),
            ],
            wordPattern: /[a-zA-Z0-9*_-]+/,
          };
        },
      });

      disposables.push(disposable);
    }
  }

  return {
    dispose: () => disposables.forEach((d) => d.dispose()),
  };
}
