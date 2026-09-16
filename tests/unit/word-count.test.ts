import { describe, it, expect } from 'vitest';
import { countLatexWords } from '@/features/editor/components/editor/subcomponents/WordCountDialog';

describe('countLatexWords (TeXcount utility)', () => {
  it('should return 0 stats for empty string', () => {
    const res = countLatexWords('');
    expect(res).toEqual({
      words: 0,
      chars: 0,
      lines: 0,
      mathInline: 0,
      mathDisplay: 0,
    });
  });

  it('should ignore comments starting with %', () => {
    const text = `Hello world! % this is a comment that should not be counted
This is the second line.`;
    const res = countLatexWords(text);
    expect(res.words).toBe(7); // Hello, world, This, is, the, second, line
    expect(res.lines).toBe(2);
  });

  it('should count math inline and display environments correctly', () => {
    const text = `The formula $E = mc^2$ is very famous.
\\begin{equation}
  \\int_{0}^{\\infty} e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}
\\end{equation}
End of text.`;

    const res = countLatexWords(text);
    expect(res.mathInline).toBe(1);
    expect(res.mathDisplay).toBe(1);
    // Words should be: The, formula, is, very, famous, End, of, text
    expect(res.words).toBe(8);
  });

  it('should strip LaTeX commands but keep argument content', () => {
    const text = `\\section{Introduction to Quantum Physics}
In this \\textbf{critical} document, we show \\textit{experimental} data.`;

    const res = countLatexWords(text);
    // Words: Introduction, to, Quantum, Physics, In, this, critical, document, we, show, experimental, data
    expect(res.words).toBe(12);
  });
});
