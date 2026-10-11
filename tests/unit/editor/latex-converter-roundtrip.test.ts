import { describe, expect, it } from 'vitest';
import { htmlToLatex, latexToHtml } from '@/features/editor/domain/latex/latex-converter';

const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
const roundTrip = (latex: string) => htmlToLatex(latexToHtml(latex), latex);

const MANUSCRIPT = String.raw`\documentclass[11pt]{article}
\usepackage{amsmath}
\usepackage{booktabs}
\newcommand{\R}{\mathbb{R}}
\title{Round Trip}
\author{Flux}
\begin{document}
\maketitle

\begin{abstract}
We study things where $x < y$.
\end{abstract}

\section{Introduction}\label{sec:intro}
We know that a < b and c > d, also A & B. % trailing comment
% full line comment
Prior work \citep[see][p.~3]{smith2020,doe2021} and \textcite{knuth}. See \cite{x} and \parencite[ch.~2]{y}.

$$ x^2 + y^2 = z^2 $$

Inline $a<b$ and \(c>d\) math with an escaped \$5 price.
\begin{equation}
  E = mc^2 \label{eq:emc}
\end{equation}
As shown in Eq.~\eqref{eq:emc} and Section~\ref{sec:intro}.
\newcommand{\foo}{bar}
\def\baz{qux}
\myunknownmacro{arg}[opt] text \textbf{bold \emph{nested}} and \textsc{caps}.

\subsection*{Results}
\begin{table*}[t]
  \centering
  \caption{Results}
  \label{tab:res}
  \begin{tabular}{|l|p{3cm}|c|}
    \hline
    A & B & C \\
    \hline
    1 & 2 & 3 \\
    \hline
  \end{tabular}
\end{table*}

\begin{table}[h]
\begin{tabular}{lc}
\multicolumn{2}{c}{Span} \\
x & y \\
\end{tabular}
\end{table}

\begin{itemize}
  \item First item
  \item Second item
\end{itemize}

See \url{http://a.com/x%20y} and a note\footnote{Note with \cite{z} and 50\%}.

\bibliographystyle{plain}
\bibliography{refs}
\end{document}
`;

describe('latex-converter round trip', () => {
  it('reproduces a representative manuscript byte-for-byte', () => {
    expect(roundTrip(MANUSCRIPT)).toBe(MANUSCRIPT);
  });

  it('survives the visual editor DOM (contentEditable innerHTML parse/serialize)', () => {
    const host = document.createElement('div');
    host.contentEditable = 'true';
    host.innerHTML = latexToHtml(MANUSCRIPT);
    const serialized = host.innerHTML;
    for (const attr of ['data-raw-latex', 'data-sig', 'data-cmd', 'data-env', 'data-delim', 'data-math', 'data-latex-comment', 'data-label', 'data-wsb']) {
      expect(serialized).toContain(attr + '=');
    }
    expect(htmlToLatex(serialized, MANUSCRIPT)).toBe(MANUSCRIPT);
  });

  it('does not invent paragraph breaks around display math', () => {
    const src = 'Before text\n\\begin{equation}\n  a=b\n\\end{equation}\nafter text, and $x$ inline-ish.\n\n\n\nNext   para.';
    expect(roundTrip(src)).toBe(src);
  });

  it('regenerates only edited parts and keeps gaps elsewhere', () => {
    const src = 'Para one.\n\\[ y \\]\nPara two.';
    const html = latexToHtml(src).replace('Para two.', 'Para 2.');
    expect(htmlToLatex(html, src)).toBe('Para one.\n\\[ y \\]\nPara 2.');
  });

  it('edited lists are regenerated, unedited lists are verbatim', () => {
    const src = '\\begin{itemize}\n\\item A\n\\item B\n\\end{itemize}';
    expect(roundTrip(src)).toBe(src);
    const out = htmlToLatex(latexToHtml(src).replace('<li>B</li>', '<li>C</li>'), src);
    expect(out).toBe('\\begin{itemize}\n  \\item A\n  \\item C\n\\end{itemize}');
  });

  it('keeps unknown environments containing math, comments and lists verbatim', () => {
    const src = String.raw`\begin{center}
Math $a<b$ % note
\begin{itemize}
  \item one \cite{k}
\end{itemize}
\[ x \]
\end{center}`;
    expect(roundTrip(src)).toBe(src);
  });

  it('round-trips headings with stars and attached labels', () => {
    const src = '\\section*{Intro}\\label{s:i}\n\nText with \\emph{emph} and \\textit{it}.';
    expect(roundTrip(src)).toBe(src);
  });

  it('(1) escapes body text so < and > survive', () => {
    const src = 'Here a < b and c > d hold, and <tag> & stuff.';
    const html = latexToHtml(src);
    expect(html).toContain('a &lt; b and c &gt; d');
    expect(html).toContain('&amp; stuff');
    expect(roundTrip(src)).toBe(src);
  });

  it('(2) handles $$ display math and preserves delimiter types', () => {
    const src = 'Text\n\n$$ a+b $$\n\nand $c$ and \\(d\\) and \\[ e \\]';
    const html = latexToHtml(src);
    expect(html).toContain('data-env="dollars"');
    expect(html).toContain('data-env="bracket"');
    expect(html).toContain('data-delim="paren"');
    expect(roundTrip(src)).toBe(src);
    expect(roundTrip('Value $a<b$ ok.')).toBe('Value $a<b$ ok.');
  });

  describe('(3) tables', () => {
    const table = String.raw`\begin{table*}[t]
  \centering
  \caption{Results}
  \label{tab:res}
  \begin{tabular}{|l|p{3cm}|c|}
    \hline
    A & B & C \\
    \hline
    1 & \textbf{2} & 3 \\
    \hline
  \end{tabular}
\end{table*}`;

    it('returns the original block verbatim when cells are unedited', () => {
      expect(roundTrip(table)).toBe(table);
      const bare = '\\begin{tabular}{l @{\\,} r}\nx & y \\\\\n\\end{tabular}';
      expect(roundTrip(bare)).toBe(bare);
    });

    it('regenerates edited tables keeping align spec, env, placement and rule style', () => {
      const html = latexToHtml(table).replace('<td><p>3</p></td>', '<td><p>33</p></td>');
      const out = htmlToLatex(html, table);
      expect(out).toContain('\\begin{table*}[t]');
      expect(out).toContain('\\begin{tabular}{|l|p{3cm}|c|}');
      expect(out).toContain('\\hline');
      expect(out).not.toContain('\\toprule');
      expect(out).toContain('\\caption{Results}');
      expect(out).toContain('\\label{tab:res}');
      expect(out).toContain('1 & \\textbf{2} & 33 \\\\');
      expect(out).toContain('\\end{table*}');
    });

    it('keeps tables with \\multicolumn / \\multirow / longtable as protected raw blocks', () => {
      const mc = '\\begin{table}[h]\n\\begin{tabular}{lc}\n\\multicolumn{2}{c}{Span} \\\\\nx & y \\\\\n\\end{tabular}\n\\end{table}';
      expect(latexToHtml(mc)).toContain('latex-protected-block');
      expect(roundTrip(mc)).toBe(mc);
      const lt = '\\begin{longtable}{ll}\na & b \\\\\n\\end{longtable}';
      expect(roundTrip(lt)).toBe(lt);
    });
  });

  it('(4) preserves citation command variants and optional args', () => {
    const src = String.raw`A \citep[see][p.~3]{a,b} B \citet{c} C \autocite[2]{d} D \textcite{e} E \parencite*{f} F \cite{g}.`;
    expect(roundTrip(src)).toBe(src);
    expect(latexToHtml(src)).toContain('data-cite-cmd="citep"');
  });

  it('(5) preserves trailing and full-line % comments', () => {
    const src = 'Line one % note here\n% whole line\nLine two with 50\\% literal.';
    expect(roundTrip(src)).toBe(src);
  });

  it('(6) preserves bibliography, macro definitions and unknown macros verbatim', () => {
    const src = String.raw`\newcommand{\vect}[1]{\mathbf{#1}}
\def\foo{bar}
Some \weird[x]{y}{z} macro and \foo.

\bibliographystyle{plainnat}
\bibliography{refs,more}`;
    expect(roundTrip(src)).toBe(src);
  });

  it('(7) preserves preamble-like content in child files without \\begin{document}', () => {
    const src = String.raw`\documentclass{article}
\usepackage[utf8]{inputenc}
\newcommand{\R}{\mathbb{R}}

\section{Child}
Body text.`;
    expect(roundTrip(src)).toBe(src);
  });

  it('(8) keeps \\maketitle at its original position', () => {
    const src = String.raw`\documentclass{article}
\title{T}
\begin{document}
\begin{abstract}
Abs.
\end{abstract}
\maketitle
Text.
\end{document}`;
    const out = roundTrip(src);
    expect(norm(out)).toBe(norm(src));
    expect(out.indexOf('\\end{abstract}')).toBeLessThan(out.indexOf('\\maketitle'));
  });
});
