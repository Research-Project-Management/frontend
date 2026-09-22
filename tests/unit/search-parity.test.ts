import { describe, it, expect } from 'vitest';
import { formatCitationSnippet } from '@/features/editor/utils/citation.util';

describe('Search Parity: File Tree Filtering Logic', () => {
  interface MockTreeItem {
    kind: 'folder' | 'asset' | 'tex';
    name: string;
  }

  const sampleItems: MockTreeItem[] = [
    { kind: 'folder', name: 'chapters' },
    { kind: 'folder', name: 'figures' },
    { kind: 'tex', name: 'main.tex' },
    { kind: 'tex', name: 'introduction.tex' },
    { kind: 'tex', name: 'conclusion.tex' },
    { kind: 'asset', name: 'architecture.png' },
    { kind: 'asset', name: 'references.bib' },
  ];

  function filterItems(items: MockTreeItem[], query: string) {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return items;
    return items.filter((item) => item.name.toLowerCase().includes(trimmed));
  }

  it('filters items by exact substring matching', () => {
    const results = filterItems(sampleItems, 'intro');
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('introduction.tex');
  });

  it('filters items case-insensitively', () => {
    const results = filterItems(sampleItems, 'MAIN');
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('main.tex');
  });

  it('filters items by extension (e.g. .bib or .png)', () => {
    const bibResults = filterItems(sampleItems, '.bib');
    expect(bibResults).toHaveLength(1);
    expect(bibResults[0].name).toBe('references.bib');

    const pngResults = filterItems(sampleItems, '.png');
    expect(pngResults).toHaveLength(1);
    expect(pngResults[0].name).toBe('architecture.png');
  });

  it('returns all items when filter query is empty or whitespace', () => {
    const results = filterItems(sampleItems, '   ');
    expect(results).toHaveLength(sampleItems.length);
  });

  it('returns empty array when no files match', () => {
    const results = filterItems(sampleItems, 'non_existent_file');
    expect(results).toHaveLength(0);
  });
});

describe('Search Parity: Reference Search & Citation Formatting', () => {
  interface MockBibEntry {
    key: string;
    title?: string;
    authors?: string[];
    year?: string;
    type: string;
  }

  const mockBibEntries: MockBibEntry[] = [
    {
      key: 'vaswani2017attention',
      title: 'Attention Is All You Need',
      authors: ['Ashish Vaswani', 'Noam Shazeer', 'Niki Parmar'],
      year: '2017',
      type: 'article',
    },
    {
      key: 'einstein1905photoelectric',
      title: 'Concerning an Heuristic Point of View Toward the Emission and Transformation of Light',
      authors: ['Albert Einstein'],
      year: '1905',
      type: 'article',
    },
    {
      key: 'turing1936computable',
      title: 'On Computable Numbers, with an Application to the Entscheidungsproblem',
      authors: ['Alan M. Turing'],
      year: '1936',
      type: 'article',
    },
  ];

  function searchBibEntries(entries: MockBibEntry[], query: string) {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((entry) => {
      const authorMatch = entry.authors?.some((a) => a.toLowerCase().includes(q)) ?? false;
      const titleMatch = entry.title?.toLowerCase().includes(q) ?? false;
      const keyMatch = entry.key.toLowerCase().includes(q);
      const yearMatch = entry.year?.includes(q) ?? false;
      return authorMatch || titleMatch || keyMatch || yearMatch;
    });
  }

  it('searches references by author name', () => {
    const results = searchBibEntries(mockBibEntries, 'vaswani');
    expect(results).toHaveLength(1);
    expect(results[0].key).toBe('vaswani2017attention');
  });

  it('searches references by title keyword', () => {
    const results = searchBibEntries(mockBibEntries, 'attention');
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Attention Is All You Need');
  });

  it('searches references by year', () => {
    const results = searchBibEntries(mockBibEntries, '1905');
    expect(results).toHaveLength(1);
    expect(results[0].key).toBe('einstein1905photoelectric');
  });

  it('formats citations correctly for LaTeX styles', () => {
    expect(formatCitationSnippet('vaswani2017attention', 'latex-cite')).toBe('\\cite{vaswani2017attention}');
    expect(formatCitationSnippet('vaswani2017attention', 'latex-citep')).toBe('\\citep{vaswani2017attention}');
    expect(formatCitationSnippet('vaswani2017attention', 'latex-citet')).toBe('\\citet{vaswani2017attention}');
    expect(formatCitationSnippet('vaswani2017attention', 'markdown-bracket')).toBe('[@vaswani2017attention]');
  });
});
