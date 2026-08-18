import { describe, it, expect } from 'vitest';
import {
  BibtexEngine,
  generateCitationKey,
  getBibTeXEntryType,
  convertToBibTeX,
  parseBibTeX,
  escapeLatexChars,
  unescapeLatexChars,
} from '@/features/workspaces/library/utils/library.util';
import type { Paper } from '@/features/workspaces/library/types/library.types';

describe('BibtexEngine Deep Module', () => {
  const samplePaper: Paper = {
    id: 'paper-1',
    title: 'Deep Residual Learning for Image Recognition',
    authors: ['Kaiming He', 'Xiangyu Zhang', 'Shaoqing Ren', 'Jian Sun'],
    year: 2016,
    journal: 'IEEE Conference on Computer Vision and Pattern Recognition',
    volume: '1',
    issue: '2',
    pages: '770-778',
    doi: '10.1109/CVPR.2016.90',
    itemType: 'journalArticle',
    publisher: 'IEEE',
    abstract: 'Deeper neural networks are more difficult to train...',
    keywords: ['Deep Learning', 'Computer Vision', 'Residual Networks'],
  } as unknown as Paper;

  it('generates consistent, clean citation keys', () => {
    // Standard multi-author paper
    const key = generateCitationKey(samplePaper);
    expect(key).toBe('he2016deep');

    // Single author paper
    const singleAuthor: Paper = {
      ...samplePaper,
      authors: ['Yann LeCun'],
      title: 'Gradient-Based Learning Applied to Document Recognition',
      year: 1998,
      citationKey: '',
    };
    expect(generateCitationKey(singleAuthor)).toBe('lecun1998gradientbased');

    // Pre-existing citation key is preserved
    const customKeyPaper: Paper = {
      ...samplePaper,
      citationKey: 'customKey2026',
    };
    expect(generateCitationKey(customKeyPaper)).toBe('customKey2026');

    // Missing authors fallback
    const noAuthorPaper: Paper = {
      ...samplePaper,
      authors: [],
      citationKey: '',
    };
    expect(generateCitationKey(noAuthorPaper)).toBe('unknown2016deep');
  });

  it('maps paper item types to standard BibTeX entry types', () => {
    expect(getBibTeXEntryType(samplePaper)).toBe('article');

    expect(getBibTeXEntryType({ ...samplePaper, itemType: 'book' })).toBe('book');
    expect(getBibTeXEntryType({ ...samplePaper, itemType: 'inproceedings' })).toBe('inproceedings');
    expect(getBibTeXEntryType({ ...samplePaper, itemType: 'phdthesis' })).toBe('phdthesis');
    expect(getBibTeXEntryType({ ...samplePaper, itemType: 'techreport' })).toBe('techreport');
    expect(getBibTeXEntryType({ ...samplePaper, itemType: 'webpage', journal: '' })).toBe('misc');
  });

  it('serializes a Paper record into a valid BibTeX string', () => {
    const bib = convertToBibTeX(samplePaper);

    expect(bib).toContain('@article{he2016deep,');
    expect(bib).toContain('title = {Deep Residual Learning for Image Recognition}');
    expect(bib).toContain('author = {Kaiming He and Xiangyu Zhang and Shaoqing Ren and Jian Sun}');
    expect(bib).toContain('year = {2016}');
    expect(bib).toContain('doi = {10.1109/CVPR.2016.90}');
    expect(bib).toContain('pages = {770-778}');
  });

  it('deserializes raw BibTeX entries into structured Paper objects', () => {
    const rawBibtex = `
      @article{vaswani2017attention,
        title = {Attention Is All You Need},
        author = {Ashish Vaswani and Noam Shazeer and Niki Parmar},
        journal = {Advances in Neural Information Processing Systems},
        year = {2017},
        volume = {30},
        pages = {5998--6008},
        doi = {10.5555/3295222.3295349}
      }

      @book{goodfellow2016deep,
        title = {Deep Learning},
        author = {Ian Goodfellow and Yoshua Bengio and Aaron Courville},
        publisher = {MIT Press},
        year = {2016}
      }
    `;

    const parsed = parseBibTeX(rawBibtex);
    expect(parsed).toHaveLength(2);

    // Entry 1
    expect(parsed[0]!.citationKey).toBe('vaswani2017attention');
    expect(parsed[0]!.title).toBe('Attention Is All You Need');
    expect(parsed[0]!.authors).toEqual(['Ashish Vaswani', 'Noam Shazeer', 'Niki Parmar']);
    expect(parsed[0]!.year).toBe(2017);
    expect(parsed[0]!.journal).toBe('Advances in Neural Information Processing Systems');
    expect(parsed[0]!.doi).toBe('10.5555/3295222.3295349');

    // Entry 2
    expect(parsed[1]!.citationKey).toBe('goodfellow2016deep');
    expect(parsed[1]!.title).toBe('Deep Learning');
    expect(parsed[1]!.publisher).toBe('MIT Press');
    expect(parsed[1]!.year).toBe(2016);
  });

  it('escapes and unescapes LaTeX special characters properly', () => {
    const textWithSpecialChars = 'Research & Development in AI: 100% of $100 #1 _under_ {tests}';
    const escaped = escapeLatexChars(textWithSpecialChars);
    expect(escaped).toBe('Research \\& Development in AI: 100\\% of \\$100 \\#1 \\_under\\_ \\{tests\\}');

    const unescaped = unescapeLatexChars(escaped);
    expect(unescaped).toBe(textWithSpecialChars);
  });
});
