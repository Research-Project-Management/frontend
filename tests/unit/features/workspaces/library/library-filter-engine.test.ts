import { describe, it, expect } from 'vitest';
import { LibraryFilterEngine } from '@/features/workspaces/library/utils/library.util';
import type { Paper } from '@/features/workspaces/library/types/library.types';

describe('LibraryFilterEngine Deep Module', () => {
  const papers: Paper[] = [
    {
      _id: 'p1',
      id: 'p1',
      title: 'Attention Is All You Need',
      authors: ['Ashish Vaswani', 'Noam Shazeer'],
      year: 2017,
      journal: 'NeurIPS',
      abstract: 'The dominant sequence transduction models are based on complex recurrent...',
      keywords: ['Transformers', 'NLP', 'Attention'],
      doi: '10.5555/3295222.3295349',
      fileUrl: 'https://storage.local/attention.pdf',
    },
    {
      _id: 'p2',
      id: 'p2',
      title: 'Deep Residual Learning for Image Recognition',
      authors: ['Kaiming He', 'Jian Sun'],
      year: 2016,
      journal: 'CVPR',
      abstract: 'Deeper neural networks are more difficult to train...',
      keywords: ['Vision', 'ResNet'],
      doi: '10.1109/CVPR.2016.90',
    },
    {
      _id: 'p3',
      id: 'p3',
      title: 'Language Models are Few-Shot Learners',
      authors: ['Tom Brown', 'Benjamin Mann'],
      year: 2020,
      journal: 'NeurIPS',
      abstract: 'Recent work has demonstrated substantial gains on many NLP tasks...',
      keywords: ['GPT-3', 'LLM', 'NLP'],
      doi: '10.48550/arXiv.2005.14165',
      fileUrl: 'https://storage.local/gpt3.pdf',
    },
  ] as unknown as Paper[];

  it('filters papers by search query across multiple fields', () => {
    // Search by title
    const res1 = LibraryFilterEngine.filterBySearch(papers, 'attention');
    expect(res1).toHaveLength(1);
    expect(res1[0].id).toBe('p1');

    // Search by author
    const res2 = LibraryFilterEngine.filterBySearch(papers, 'Kaiming');
    expect(res2).toHaveLength(1);
    expect(res2[0].id).toBe('p2');

    // Search by journal
    const res3 = LibraryFilterEngine.filterBySearch(papers, 'NeurIPS');
    expect(res3).toHaveLength(2);

    // Search by tag
    const res4 = LibraryFilterEngine.filterBySearch(papers, 'LLM');
    expect(res4).toHaveLength(1);
    expect(res4[0].id).toBe('p3');
  });

  it('filters papers with multi-criteria options', () => {
    // Filter by tags and year range
    const res = LibraryFilterEngine.filter(papers, {
      selectedTags: ['NLP'],
      fromYear: 2018,
    });
    expect(res).toHaveLength(1);
    expect(res[0].id).toBe('p3');

    // Filter by attachment presence
    const withPdf = LibraryFilterEngine.filter(papers, {
      hasAttachment: true,
    });
    expect(withPdf).toHaveLength(2);
  });

  it('sorts papers by title, year, and authors', () => {
    // Sort by year desc
    const sortedYear = LibraryFilterEngine.sort(papers, { field: 'year', direction: 'desc' });
    expect(sortedYear[0].id).toBe('p3'); // 2020
    expect(sortedYear[1].id).toBe('p1'); // 2017
    expect(sortedYear[2].id).toBe('p2'); // 2016

    // Sort by title asc
    const sortedTitle = LibraryFilterEngine.sort(papers, { field: 'title', direction: 'asc' });
    expect(sortedTitle[0].title).toBe('Attention Is All You Need');
  });

  it('detects duplicate papers by matching DOI or title', () => {
    const listWithDupes: Paper[] = [
      ...papers,
      {
        _id: 'p4',
        id: 'p4',
        title: 'Attention Is All You Need (Preprint)',
        authors: ['Ashish Vaswani'],
        year: 2017,
        doi: '10.5555/3295222.3295349', // Same DOI as p1
      },
    ] as unknown as Paper[];

    const duplicates = LibraryFilterEngine.findDuplicates(listWithDupes);
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0].original.id).toBe('p1');
    expect(duplicates[0].duplicates).toHaveLength(1);
    expect(duplicates[0].duplicates[0].id).toBe('p4');
  });
});
