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
      totalWords: 0,
      charactersWithSpaces: 0,
      charactersNoSpaces: 0,
    });
  });

  it('should ignore comments starting with %', () => {
    const text = `Hello world! % this is a comment that should not be counted
This is the second line.`;
    const res = countLatexWords(text);
    expect(res.wordsInText).toBe(7); // Hello, world, This, is, the, second, line
    expect(res.totalWords).toBe(7);
  });

  it('should strictly exclude content enclosed in %TC:ignore and %TC:endignore', () => {
    const text = `Visible words in body text.
%TC:ignore
This entire block of ignored words should not be counted at all.
%TC:endignore
Final words here.`;
    const res = countLatexWords(text);
    expect(res.wordsInText).toBe(8); // Visible, words, in, body, text, Final, words, here
    expect(res.totalWords).toBe(8);
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
    expect(res.totalWords).toBe(8);
  });

  it('should count captions and footnotes as words outside text', () => {
    const text = `Body text with words.\\footnote{This is a footnote text.}
\\begin{figure}
  \\caption{Figure describing results.}
\\end{figure}`;

    const res = countLatexWords(text);
    expect(res.wordsInText).toBe(4); // Body, text, with, words
    expect(res.wordsInCaptions).toBe(8); // This, is, a, footnote, text (5) + Figure, describing, results (3) = 8
    expect(res.floats).toBe(1);
    expect(res.totalWords).toBe(12); // 4 + 8 = 12
  });

  it('should strip LaTeX commands but keep argument content', () => {
    const text = `\\section{Introduction to Quantum Physics}
In this \\textbf{critical} document, we show \\textit{experimental} data.`;

    const res = countLatexWords(text);
    expect(res.headers).toBe(1);
    expect(res.wordsInHeaders).toBe(4); // Introduction, to, Quantum, Physics
    expect(res.wordsInText).toBe(8); // In, this, critical, document, we, show, experimental, data
    expect(res.totalWords).toBe(12);
    expect(res.charactersWithSpaces).toBeGreaterThan(0);
    expect(res.charactersNoSpaces).toBeGreaterThan(0);
  });
});
