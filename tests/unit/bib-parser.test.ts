import { describe, it, expect } from 'vitest';
import {
  parseBibContent,
  parseMultipleBibContents,
  type BibEntry,
} from '@/features/editor/utils/bib-parser.util';

describe('BibTeX Parser (bib-parser.util.ts)', () => {
  it('should parse standard BibTeX article entry', () => {
    const bib = `@article{vaswani2017attention,
  author = {Vaswani, Ashish and Shazeer, Noam and Parmar, Niki},
  title = {Attention Is All You Need},
  journal = {Advances in Neural Information Processing Systems},
  year = {2017},
  volume = {30},
  pages = {5998--6008},
  doi = {10.5555/3295222.3295349}
}`;

    const entries = parseBibContent(bib);
    expect(entries).toHaveLength(1);
    const entry = entries[0];
    expect(entry.key).toBe('vaswani2017attention');
    expect(entry.type).toBe('article');
    expect(entry.title).toBe('Attention Is All You Need');
    expect(entry.authors).toEqual(['Vaswani, Ashish', 'Shazeer, Noam', 'Parmar, Niki']);
    expect(entry.year).toBe('2017');
    expect(entry.journal).toBe('Advances in Neural Information Processing Systems');
    expect(entry.volume).toBe('30');
    expect(entry.pages).toBe('5998--6008');
    expect(entry.doi).toBe('10.5555/3295222.3295349');
  });

  it('should preserve nested curly braces inside title and fields', () => {
    const bib = `@inproceedings{devlin2019bert,
  title = {An Empirical Analysis of {BERT} and {GPT-2} on {NLP} Benchmarks},
  author = {Devlin, Jacob and Chang, Ming-Wei},
  booktitle = {Proceedings of the Conference on Empirical Methods in Natural Language Processing},
  year = {2019}
}`;

    const entries = parseBibContent(bib);
    expect(entries).toHaveLength(1);
    expect(entries[0].title).toBe('An Empirical Analysis of {BERT} and {GPT-2} on {NLP} Benchmarks');
    expect(entries[0].authors).toEqual(['Devlin, Jacob', 'Chang, Ming-Wei']);
  });

  it('should handle email addresses with @ symbol in fields without truncating entry', () => {
    const bib = `@article{researcher2023,
  author = {Smith, John <jsmith@university.edu> and Doe, Jane <jdoe@lab.org>},
  title = {Collaborative Research Across Universities},
  year = {2023}
}

@book{goodfellow2016deep,
  title = {Deep Learning},
  author = {Goodfellow, Ian and Bengio, Yoshua and Courville, Aaron},
  publisher = {MIT Press},
  year = {2016}
}`;

    const entries = parseBibContent(bib);
    expect(entries).toHaveLength(2);
    expect(entries[0].key).toBe('researcher2023');
    expect(entries[0].authors).toEqual(['Smith, John <jsmith@university.edu>', 'Doe, Jane <jdoe@lab.org>']);
    expect(entries[1].key).toBe('goodfellow2016deep');
    expect(entries[1].publisher).toBe('MIT Press');
  });

  it('should parse unquoted numeric years and double-quoted values', () => {
    const bib = `@misc{lecun2024ai,
  title = "Next-Generation Machine Intelligence",
  author = "LeCun, Yann",
  year = 2024
}`;

    const entries = parseBibContent(bib);
    expect(entries).toHaveLength(1);
    expect(entries[0].key).toBe('lecun2024ai');
    expect(entries[0].title).toBe('Next-Generation Machine Intelligence');
    expect(entries[0].year).toBe('2024');
  });

  it('should merge multiple files and deduplicate by key', () => {
    const files = [
      {
        filename: 'refs1.bib',
        content: `@article{key1, title = {Paper 1}}
@article{key2, title = {Paper 2}}`,
      },
      {
        filename: 'refs2.bib',
        content: `@article{key2, title = {Paper 2 Duplicate}}
@article{key3, title = {Paper 3}}`,
      },
    ];

    const merged = parseMultipleBibContents(files);
    expect(merged).toHaveLength(3);
    expect(merged.map((e) => e.key)).toEqual(['key1', 'key2', 'key3']);
    expect(merged[1].title).toBe('Paper 2');
  });

  it('should safely return empty array for empty or whitespace content', () => {
    expect(parseBibContent('')).toEqual([]);
    expect(parseBibContent('   \n\t  ')).toEqual([]);
    expect(parseMultipleBibContents([])).toEqual([]);
  });
});
