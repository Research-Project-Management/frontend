import type * as Monaco from 'monaco-editor';

export interface LatexSnippet {
  label: string;
  detail: string;
  documentation: string;
  snippet: string;
  kind: Monaco.languages.CompletionItemKind;
}

export const LATEX_SNIPPETS: LatexSnippet[] = [
  // ── Environments ──────────────────────────────────────────────────────────
  {
    label: '\\begin{equation}',
    detail: 'Numbered Math Equation',
    documentation: 'Creates a standard numbered single-line equation.',
    snippet: '\\begin{equation}\n\t${1:E = mc^2}\n\t\\label{eq:${2:label}}\n\\end{equation}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
  },
  {
    label: '\\begin{equation*}',
    detail: 'Unnumbered Math Equation',
    documentation: 'Creates an unnumbered single-line equation.',
    snippet: '\\begin{equation*}\n\t${1:E = mc^2}\n\\end{equation*}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
  },
  {
    label: '\\begin{align}',
    detail: 'Aligned Multiline Equations',
    documentation: 'Creates an aligned multi-line equation block with & alignment and \\\\ line breaks.',
    snippet: '\\begin{align}\n\t${1:y} &= ${2:mx + b} \\label{eq:${3:align1}} \\\\\n\t${4:z} &= ${5:ax + c} \\label{eq:${6:align2}}\n\\end{align}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
  },
  {
    label: '\\begin{align*}',
    detail: 'Unnumbered Aligned Equations',
    documentation: 'Creates unnumbered aligned multi-line equations.',
    snippet: '\\begin{align*}\n\t${1:y} &= ${2:mx + b} \\\\\n\t${3:z} &= ${4:ax + c}\n\\end{align*}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
  },
  {
    label: '\\begin{figure}',
    detail: 'Figure with Graphic & Caption',
    documentation: 'Standard floating figure environment with graphic inclusion, caption, and label.',
    snippet: '\\begin{figure}[${1:htbp}]\n\t\\centering\n\t\\includegraphics[width=${2:0.8\\linewidth}]{${3:figure.png}}\n\t\\caption{${4:Figure description here.}}\n\t\\label{fig:${5:my_figure}}\n\\end{figure}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
  },
  {
    label: '\\begin{table}',
    detail: 'Floating Table with Caption',
    documentation: 'Standard floating table environment with tabular data, caption, and label.',
    snippet: '\\begin{table}[${1:htbp}]\n\t\\centering\n\t\\caption{${2:Table caption title.}}\n\t\\label{tab:${3:my_table}}\n\t\\begin{tabular}{${4:lcr}}\n\t\t\\hline\n\t\t${5:Header 1} & ${6:Header 2} & ${7:Header 3} \\\\\n\t\t\\hline\n\t\t${8:Data 1} & ${9:Data 2} & ${10:Data 3} \\\\\n\t\t\\hline\n\t\\end{tabular}\n\\end{table}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
  },
  {
    label: '\\begin{itemize}',
    detail: 'Unordered Bulleted List',
    documentation: 'Creates an itemized bulleted list.',
    snippet: '\\begin{itemize}\n\t\\item ${1:First point}\n\t\\item ${2:Second point}\n\t\\item ${3:Third point}\n\\end{itemize}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
  },
  {
    label: '\\begin{enumerate}',
    detail: 'Numbered Ordered List',
    documentation: 'Creates an enumerated numbered list.',
    snippet: '\\begin{enumerate}\n\t\\item ${1:First item}\n\t\\item ${2:Second item}\n\t\\item ${3:Third item}\n\\end{enumerate}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
  },
  {
    label: '\\begin{theorem}',
    detail: 'Theorem Environment',
    documentation: 'Creates a formal mathematical theorem block.',
    snippet: '\\begin{theorem}[${1:Theorem Name}]\n\t${2:State the formal theorem statement here.}\n\\end{theorem}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
  },
  {
    label: '\\begin{lemma}',
    detail: 'Lemma Environment',
    documentation: 'Creates a mathematical lemma block.',
    snippet: '\\begin{lemma}\n\t${1:State the supporting lemma statement here.}\n\\end{lemma}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
  },
  {
    label: '\\begin{proof}',
    detail: 'Mathematical Proof Block',
    documentation: 'Creates a formal proof environment with ending Q.E.D. symbol.',
    snippet: '\\begin{proof}\n\t${1:Write the detailed formal derivation and proof steps here.}\n\\end{proof}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
  },
  {
    label: '\\begin{cases}',
    detail: 'Piecewise Cases Equation',
    documentation: 'Creates a piecewise case-by-case definition inside a math environment.',
    snippet: '\\begin{cases}\n\t${1:x}, & \\text{if } ${2:condition 1} \\\\\n\t${3:-x}, & \\text{otherwise}\n\\end{cases}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
  },
  {
    label: '\\begin{matrix}',
    detail: 'Matrix (Square Brackets bmatrix)',
    documentation: 'Creates a 2x2 or NxM matrix with square brackets.',
    snippet: '\\begin{bmatrix}\n\t${1:a_{11}} & ${2:a_{12}} \\\\\n\t${3:a_{21}} & ${4:a_{22}}\n\\end{bmatrix}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
  },
  {
    label: '\\begin{algorithm}',
    detail: 'Pseudocode Algorithm Block',
    documentation: 'Floating algorithm environment for research procedures.',
    snippet: '\\begin{algorithm}[${1:htbp}]\n\t\\caption{${2:Algorithm Title}}\n\t\\label{alg:${3:my_alg}}\n\t\\begin{algorithmic}[1]\n\t\t\\State ${4:Initialize variables}\n\t\t\\For{${5:i = 1 \\dots N}}\n\t\t\t\\State ${6:Compute step}\n\t\t\\EndFor\n\t\\end{algorithmic}\n\\end{algorithm}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
  },

  // ── Structure & Sectioning ──────────────────────────────────────────────────
  {
    label: '\\section',
    detail: 'Top-Level Section',
    documentation: 'Creates a top-level \\section{Title} with label.',
    snippet: '\\section{${1:Section Title}}\n\\label{sec:${2:sec_label}}\n$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
  },
  {
    label: '\\subsection',
    detail: 'Subsection',
    documentation: 'Creates a \\subsection{Title} with label.',
    snippet: '\\subsection{${1:Subsection Title}}\n\\label{subsec:${2:subsec_label}}\n$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
  },
  {
    label: '\\subsubsection',
    detail: 'Subsubsection',
    documentation: 'Creates a \\subsubsection{Title} with label.',
    snippet: '\\subsubsection{${1:Subsubsection Title}}\n\\label{subsubsec:${2:subsubsec_label}}\n$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
  },
  {
    label: '\\paragraph',
    detail: 'In-line Paragraph Heading',
    documentation: 'Creates a bold run-in \\paragraph{Title}.',
    snippet: '\\paragraph{${1:Paragraph Title}} ${0:Content starts here...}',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
  },

  // ── Mathematics Macros ─────────────────────────────────────────────────────
  {
    label: '\\frac',
    detail: 'Fractions \\frac{a}{b}',
    documentation: 'Creates a mathematical fraction with numerator and denominator.',
    snippet: '\\frac{${1:numerator}}{${2:denominator}}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
  },
  {
    label: '\\sqrt',
    detail: 'Square Root \\sqrt{x}',
    documentation: 'Creates a radical or square root.',
    snippet: '\\sqrt{${1:x}}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
  },
  {
    label: '\\sum',
    detail: 'Summation \\sum_{i=1}^{n}',
    documentation: 'Summation with lower and upper limits.',
    snippet: '\\sum_{${1:i=1}}^{${2:n}} ${3:x_i}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
  },
  {
    label: '\\int',
    detail: 'Definite Integral \\int_{a}^{b}',
    documentation: 'Definite integral with lower and upper bounds.',
    snippet: '\\int_{${1:a}}^{${2:b}} ${3:f(x)} \\, d${4:x}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
  },
  {
    label: '\\lim',
    detail: 'Limit \\lim_{x \\to \\infty}',
    documentation: 'Limit with approach target.',
    snippet: '\\lim_{${1:x} \\to ${2:\\infty}} ${3:f(x)}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
  },
  {
    label: '\\mathbb',
    detail: 'Blackboard Bold \\mathbb{R}',
    documentation: 'Math blackboard font for sets (Real, Natural, Complex).',
    snippet: '\\mathbb{${1:R}}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
  },
  {
    label: '\\mathcal',
    detail: 'Calligraphic Font \\mathcal{L}',
    documentation: 'Calligraphic font for loss functions, sets, or operators.',
    snippet: '\\mathcal{${1:L}}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
  },
  {
    label: '\\mathbf',
    detail: 'Bold Vector/Matrix \\mathbf{x}',
    documentation: 'Bold font for vectors and matrices.',
    snippet: '\\mathbf{${1:x}}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
  },

  // ── Text Styles & Cross-References ──────────────────────────────────────────
  {
    label: '\\textbf',
    detail: 'Bold Text',
    documentation: 'Applies bold face weight to text.',
    snippet: '\\textbf{${1:bold text}}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
  },
  {
    label: '\\textit',
    detail: 'Italic Text',
    documentation: 'Applies italic font shape to text.',
    snippet: '\\textit{${1:italic text}}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
  },
  {
    label: '\\underline',
    detail: 'Underlined Text',
    documentation: 'Underlines the enclosed text.',
    snippet: '\\underline{${1:underlined text}}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
  },
  {
    label: '\\emph',
    detail: 'Emphasized Text',
    documentation: 'Context-sensitive emphasis (italics or roman).',
    snippet: '\\emph{${1:emphasized text}}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
  },
  {
    label: '\\ref',
    detail: 'Cross-Reference',
    documentation: 'References a numbered section, figure, table, or equation.',
    snippet: '\\ref{${1:label}}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
  },
  {
    label: '\\eqref',
    detail: 'Equation Reference (with parentheses)',
    documentation: 'References an equation with automatic parentheses, e.g. (1).',
    snippet: '\\eqref{eq:${1:label}}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
  },
  {
    label: '\\footnote',
    detail: 'Footnote',
    documentation: 'Creates a numbered footnote at bottom of page.',
    snippet: '\\footnote{${1:Footnote explanation text.}}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
  },
  {
    label: '\\href',
    detail: 'Hyperlink with Custom Text',
    documentation: 'Clickable hyperlink with URL and display anchor text.',
    snippet: '\\href{${1:https://example.com}}{${2:link text}}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
  },
  {
    label: '\\url',
    detail: 'Raw URL Hyperlink',
    documentation: 'Clickable raw URL.',
    snippet: '\\url{${1:https://example.com}}$0',
    kind: 27 as Monaco.languages.CompletionItemKind.Snippet,
  },
];

/**
 * Registers LaTeX Environment & Math Snippets with Monaco.
 * Provides instant IntelliSense when typing `\` or LaTeX environment names.
 */
export function registerLatexSnippets(
  monaco: typeof Monaco,
  languages: string[] = ['latex'],
): Monaco.IDisposable {
  const disposables: Monaco.IDisposable[] = [];

  for (const language of languages) {
    const disposable = monaco.languages.registerCompletionItemProvider(language, {
      triggerCharacters: ['\\', '{'],
      provideCompletionItems(model, position) {
        const word = model.getWordUntilPosition(position);
        const lineContent = model.getLineContent(position.lineNumber);
        const charBefore = lineContent[position.column - 2] || '';

        // Check if cursor is preceded by a backslash
        const isBackslashPreceded = charBefore === '\\';
        const range = new monaco.Range(
          position.lineNumber,
          isBackslashPreceded ? position.column - 1 : word.startColumn,
          position.lineNumber,
          position.column,
        );

        const suggestions: Monaco.languages.CompletionItem[] = LATEX_SNIPPETS.map(
          (item) => ({
            label: item.label,
            kind: item.kind,
            detail: item.detail,
            documentation: item.documentation,
            insertText: item.snippet,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range,
            sortText: `0_${item.label}`,
          }),
        );

        return { suggestions };
      },
    });

    disposables.push(disposable);
  }

  return {
    dispose: () => disposables.forEach((d) => d.dispose()),
  };
}
