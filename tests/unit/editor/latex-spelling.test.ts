import { describe, it, expect } from 'vitest';
import { extractLatexWords } from '@/features/editor/engines/extensions/latex-spelling';

describe('extractLatexWords - LaTeX Aware Spell Check Tokenizer', () => {
  it('extracts plain natural language words', () => {
    const text = 'This is a sample document for testing spellcheck.';
    const words = extractLatexWords(text).map((w) => w.word);
    expect(words).toEqual(['This', 'is', 'sample', 'document', 'for', 'testing', 'spellcheck']);
  });

  it('masks inline math ($...$, \\(...\\)) and display math ($$...$$, \\[...]\\)', () => {
    const text = 'The energy $E = mc^2$ and Euler identity $$\\mathrm{e}^{i\\pi} + 1 = 0$$ explain physics.';
    const words = extractLatexWords(text).map((w) => w.word);
    expect(words).toEqual(['The', 'energy', 'and', 'Euler', 'identity', 'explain', 'physics']);
    expect(words).not.toContain('mathrm');
    expect(words).not.toContain('mc');
  });

  it('masks math environments like equation, align, gather, multline', () => {
    const text = `
Here is an equation:
\\begin{equation}
  \\nabla \\times \\mathbf{B} - \\frac{1}{c} \\frac{\\partial \\mathbf{E}}{\\partial t} = \\frac{4\\pi}{c}\\mathbf{j}
\\end{equation}
which is one of Maxwell equations.
`;
    const words = extractLatexWords(text).map((w) => w.word);
    expect(words).toContain('Here');
    expect(words).toContain('equation');
    expect(words).toContain('which');
    expect(words).toContain('Maxwell');
    expect(words).not.toContain('nabla');
    expect(words).not.toContain('mathbf');
    expect(words).not.toContain('partial');
  });

  it('masks citation keys, references, labels, and package names in macro braces', () => {
    const text = 'As shown in \\cite{knuth1984texbook} and \\ref{sec:methods}, we use \\usepackage{amsmath}.';
    const words = extractLatexWords(text).map((w) => w.word);
    expect(words).toContain('As');
    expect(words).toContain('shown');
    expect(words).toContain('in');
    expect(words).toContain('and');
    expect(words).toContain('we');
    expect(words).toContain('use');
    expect(words).not.toContain('knuth1984texbook');
    expect(words).not.toContain('methods');
    expect(words).not.toContain('amsmath');
  });

  it('masks comments completely', () => {
    const text = `
This is valid text. % This comment mentions asdfqwerty which is a typo
Another line here.
`;
    const words = extractLatexWords(text).map((w) => w.word);
    expect(words).toContain('This');
    expect(words).toContain('valid');
    expect(words).toContain('text');
    expect(words).toContain('Another');
    expect(words).toContain('line');
    expect(words).toContain('here');
    expect(words).not.toContain('comment');
    expect(words).not.toContain('asdfqwerty');
  });

  it('masks verbatim and code blocks', () => {
    const text = `
Consider this snippet:
\\begin{verbatim}
def quicksort(arr):
    return arr
\\end{verbatim}
for sorting lists.
`;
    const words = extractLatexWords(text).map((w) => w.word);
    expect(words).toContain('Consider');
    expect(words).toContain('snippet');
    expect(words).toContain('for');
    expect(words).toContain('sorting');
    expect(words).toContain('lists');
    expect(words).not.toContain('quicksort');
    expect(words).not.toContain('arr');
  });

  it('extracts formatted text contents while skipping the macro command itself', () => {
    const text = '\\textbf{Important} notice: \\textit{please} review.';
    const words = extractLatexWords(text).map((w) => w.word);
    expect(words).toContain('Important');
    expect(words).toContain('notice');
    expect(words).toContain('please');
    expect(words).toContain('review');
    expect(words).not.toContain('textbf');
    expect(words).not.toContain('textit');
  });

  it('correctly handles escaped percent signs (\\%) and dollar signs (\\$)', () => {
    const text = 'Interest rate increased by 5\\% and price was \\$100 today.';
    const words = extractLatexWords(text).map((w) => w.word);
    expect(words).toContain('Interest');
    expect(words).toContain('rate');
    expect(words).toContain('increased');
    expect(words).toContain('by');
    expect(words).toContain('and');
    expect(words).toContain('price');
    expect(words).toContain('was');
    expect(words).toContain('today');
  });

  it('correctly extracts Vietnamese words with tone marks and Latin Extended characters', () => {
    const text = 'Nghiên cứu về trí tuệ nhân tạo và xử lý ngôn ngữ tự nhiên.';
    const words = extractLatexWords(text).map((w) => w.word);
    expect(words).toContain('Nghiên');
    expect(words).toContain('cứu');
    expect(words).toContain('về');
    expect(words).toContain('trí');
    expect(words).toContain('tuệ');
    expect(words).toContain('nhân');
    expect(words).toContain('tạo');
    expect(words).toContain('xử');
    expect(words).toContain('lý');
    expect(words).toContain('ngôn');
    expect(words).toContain('ngữ');
    expect(words).toContain('tự');
    expect(words).toContain('nhiên');
  });
});
