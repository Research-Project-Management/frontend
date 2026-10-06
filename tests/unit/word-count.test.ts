import { describe, it, expect } from 'vitest';
import { countLatexWords } from '@/features/editor/components/editor/subcomponents/WordCountDialog';

describe('countLatexWords (TeXcount utility)', () => {
  it('should return 0 stats for empty string', () => {
    const res = countLatexWords('');
    expect(res).toEqual({
      wordsInText: 0,
      wordsInHeaders: 0,
      wordsInCaptions: 0,
      headers: 0,
      floats: 0,
      mathInlines: 0,
      mathDisplayed: 0,
    });
  });

  it('should ignore comments starting with %', () => {
    const text = `Hello world! % this is a comment that should not be counted
This is the second line.`;
    const res = countLatexWords(text);
    expect(res.wordsInText).toBe(7); // Hello, world, This, is, the, second, line
  });

  it('should count math inline and display environments correctly', () => {
    const text = `The formula $E = mc^2$ is very famous.
\\begin{equation}
  \\int_{0}^{\\infty} e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}
\\end{equation}
End of text.`;

    const res = countLatexWords(text);
    expect(res.mathInlines).toBe(1);
    expect(res.mathDisplayed).toBe(1);
    // Words should be: The, formula, is, very, famous, End, of, text
    expect(res.wordsInText).toBe(8);
  });

  it('should strip LaTeX commands but keep argument content', () => {
    const text = `\\section{Introduction to Quantum Physics}
In this \\textbf{critical} document, we show \\textit{experimental} data.`;

    const res = countLatexWords(text);
    expect(res.headers).toBe(1);
    expect(res.wordsInHeaders).toBe(4); // Introduction, to, Quantum, Physics
    expect(res.wordsInText).toBe(8); // In, this, critical, document, we, show, experimental, data
  });
});
