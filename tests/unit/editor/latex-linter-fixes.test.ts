import { describe, it, expect } from 'vitest';
import {
  lintSpecialCharacters,
  lintInlineMath,
  lintLabelsAndReferences,
  scanDisplayMath,
  ALIGNMENT_ENVIRONMENTS,
} from '@/features/editor/domain/latex/latex-linter.rules';
import { lintLatexDocument } from '@/features/editor/engines/extensions/latex-linter-core';

const codes = (d: Array<{ code: string }>) => d.map((x) => x.code);

describe('latex-linter.rules fixes', () => {
  it('masks & and _ inside \\url / \\href', () => {
    const d = lintSpecialCharacters('See \\url{http://x.com/?a=1&b_c=2} and \\href{http://y.com/?q&r_s}{link}.');
    expect(codes(d)).not.toContain('UNESCAPED_AMPERSAND');
    expect(codes(d)).not.toContain('UNESCAPED_UNDERSCORE');
  });

  it('masks extended reference/citation commands', () => {
    const d = lintSpecialCharacters(
      '\\autoref{fig_a} \\cref{s_b} \\Cref{s_c} \\textcite{k_1} \\parencite[p.~3]{k_2} \\autocite{k_3} \\path{a_b} \\lstinline{x_y} \\nameref{n_1}',
    );
    expect(codes(d)).not.toContain('UNESCAPED_UNDERSCORE');
  });

  it.each(['tabularx', 'tabulary', 'longtable', 'supertabular', 'NiceTabular', 'tblr', 'xltabular'])(
    'allows & inside %s',
    (env) => {
      expect(ALIGNMENT_ENVIRONMENTS.has(env)).toBe(true);
      const d = lintSpecialCharacters(`\\begin{${env}}{lX}\na & b \\\\\n\\end{${env}}`);
      expect(codes(d)).not.toContain('UNESCAPED_AMPERSAND');
    },
  );

  it('does not treat \\\\[6pt] as display-math open', () => {
    expect(scanDisplayMath('a & b \\\\[6pt]', false)).toBe(false);
    expect(scanDisplayMath('\\[', false)).toBe(true);
    expect(scanDisplayMath('x \\\\\\[', false)).toBe(true);
    const d = lintSpecialCharacters('\\begin{tabular}{ll}\na & b \\\\[6pt]\n\\end{tabular}\nfile_name here');
    expect(codes(d)).toContain('UNESCAPED_UNDERSCORE');
  });

  it('treats single-line and multi-line \\[ ... \\] as math', () => {
    expect(codes(lintSpecialCharacters('\\[ x_1 \\]'))).not.toContain('UNESCAPED_UNDERSCORE');
    expect(codes(lintSpecialCharacters('\\[\n x_1\n\\]'))).not.toContain('UNESCAPED_UNDERSCORE');
  });

  it('allows inline math spanning lines within a paragraph', () => {
    const text = 'We have $a_1 +\nb_2$ here.';
    expect(codes(lintInlineMath(text))).not.toContain('UNCLOSED_INLINE_MATH');
    expect(codes(lintSpecialCharacters(text))).not.toContain('UNESCAPED_UNDERSCORE');
  });

  it('still flags inline math broken by a blank line', () => {
    const d = lintInlineMath('Open $x\n\nnext paragraph');
    expect(d).toHaveLength(1);
    expect(d[0].startLineNumber).toBe(1);
    expect(d[0].startColumn).toBe(6);
  });

  it('skips undefined-reference check for files without \\documentclass', () => {
    const d = lintLabelsAndReferences('\\label{a}\nSee \\ref{in-other-file}.');
    expect(codes(d)).not.toContain('UNDEFINED_REFERENCE');
  });

  it('skips undefined-reference check for multi-file roots', () => {
    const d = lintLabelsAndReferences('\\documentclass{article}\n\\input{ch1}\nSee \\ref{x}.');
    expect(codes(d)).not.toContain('UNDEFINED_REFERENCE');
  });

  it('reports undefined references for standalone single-file documents', () => {
    const d = lintLabelsAndReferences('\\documentclass{article}\n\\begin{document}\nSee \\ref{missing}.\n\\end{document}');
    expect(codes(d)).toContain('UNDEFINED_REFERENCE');
  });

  it('reports undefined references when project labels are supplied', () => {
    const d = lintLabelsAndReferences('See \\ref{nope}.', ['known']);
    expect(codes(d)).toContain('UNDEFINED_REFERENCE');
  });
});

describe('latex-linter-core fixes', () => {
  const msgs = (t: string) => lintLatexDocument(t).map((d) => d.message);

  it('handles \\text{$x$} nested inside display math', () => {
    expect(msgs('\\[ a = b \\text{ if $x>0$} \\]')).toEqual([]);
  });

  it('handles \\text{$x$} inside align environment', () => {
    expect(msgs('\\begin{align}\na &= b \\text{ for $\\alpha$}\n\\end{align}')).toEqual([]);
  });

  it('handles \\text{$x$} inside inline math', () => {
    expect(msgs('$a \\text{ and $b$ } c$')).toEqual([]);
  });

  it('flags math-only command in \\text group without math', () => {
    expect(msgs('$a \\text{ \\alpha }$').some((m) => m.includes('alpha'))).toBe(true);
  });

  it('reports unbalanced curly braces', () => {
    expect(msgs('\\textbf{bold').some((m) => m.includes('Unclosed opening brace'))).toBe(true);
    expect(msgs('oops}').some((m) => m.includes('Unmatched closing brace'))).toBe(true);
  });

  it.each(['minted', 'Verbatim', 'alltt', 'filecontents', 'tcblisting'])('ignores content of %s', (env) => {
    const arg = env === 'minted' ? '{python}' : env === 'filecontents' ? '{x.txt}' : '';
    expect(msgs(`\\begin{${env}}${arg}\n$ { \\alpha \\end{itemize}\n\\end{${env}}`)).toEqual([]);
  });
});
