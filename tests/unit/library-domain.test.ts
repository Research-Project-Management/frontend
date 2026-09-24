import { describe, it, expect } from 'vitest';
import {
  // Creators
  normalizeAuthors,
  parseAuthorName,
  formatCreatorCompact,
  // Identifiers
  cleanDoi,
  isValidDoi,
  extractArxivId,
  getArxivPdfUrl,
  cleanPaperTitle,
  normalizeAcademicTitleCase,
  // Citations
  generateCitationKey,
  toBibTeXEntry,
  // Categories
  resolveArxivCategory,
  getSubjectArea,
  // Renamer
  previewAttachmentFilename,
  sanitizeFilenameStem,
  RENAME_PRESETS,
  // Search & Filter
  LibraryFilterEngine,
  // Deduplication
  isDuplicatePair,
  clusterDuplicateItems,
  // Diff & Merge
  inspectItemDifferences,
  aggregateItemAssets,
} from '@/features/library/domain';

describe('Library Domain Layer — Pure Functional Logic', () => {
  describe('Creators Domain (creators.ts)', () => {
    it('should parse author names correctly with first/last names', () => {
      const p1 = parseAuthorName('Donald E. Knuth');
      expect(p1.firstName).toBe('Donald E.');
      expect(p1.lastName).toBe('Knuth');

      const p2 = parseAuthorName('Knuth, Donald E.');
      expect(p2.firstName).toBe('Donald E.');
      expect(p2.lastName).toBe('Knuth');

      const p3 = parseAuthorName('Google Brain Team');
      expect(p3.isInstitution).toBe(true);
      expect(p3.fullName).toBe('Google Brain Team');
    });

    it('should normalize authors from string or object arrays', () => {
      const res = normalizeAuthors(['A. Turing', 'A. Lovelace']);
      expect(res).toEqual(['A. Turing', 'A. Lovelace']);

      const resObj = normalizeAuthors(undefined, [
        { firstName: 'Alan', lastName: 'Turing' },
        { name: 'Ada Lovelace' },
      ]);
      expect(resObj).toEqual(['Alan Turing', 'Ada Lovelace']);
    });

    it('should format creator compact (et al. format)', () => {
      expect(formatCreatorCompact(['Knuth'])).toBe('Knuth');
      expect(formatCreatorCompact(['Knuth', 'Dijkstra'])).toBe('Knuth & Dijkstra');
      expect(formatCreatorCompact(['Knuth', 'Dijkstra', 'Turing'])).toBe('Knuth et al.');
    });
  });

  describe('Identifiers Domain (identifiers.ts)', () => {
    it('should sanitize and validate DOIs properly', () => {
      expect(cleanDoi('https://doi.org/10.1145/123456.789')).toBe('10.1145/123456.789');
      expect(cleanDoi('doi:10.1000/182')).toBe('10.1000/182');
      expect(isValidDoi('10.1145/123456.789')).toBe(true);
      expect(isValidDoi('not-a-doi')).toBe(false);
    });

    it('should extract arXiv ID and create PDF URL', () => {
      expect(extractArxivId('arXiv:2301.07041v2')).toBe('2301.07041v2');
      expect(extractArxivId('https://arxiv.org/abs/2301.07041')).toBe('2301.07041');
      expect(getArxivPdfUrl('2301.07041')).toBe('https://arxiv.org/pdf/2301.07041.pdf');
    });

    it('should clean title and normalize academic title case', () => {
      expect(cleanPaperTitle('  A Study on   Deep Learning\n\r ')).toBe('A Study on Deep Learning');
      expect(normalizeAcademicTitleCase('attention is all you need')).toBe('Attention Is All You Need');
    });
  });

  describe('Citations Domain (citations.ts)', () => {
    it('should generate valid BibTeX citation keys', () => {
      const item = {
        title: 'Attention Is All You Need',
        authors: ['Vaswani, Ashish', 'Shazeer, Noam'],
        year: 2017,
      };
      const key = generateCitationKey(item);
      expect(key).toBe('vaswani2017attention');
    });

    it('should export standard BibTeX entry', () => {
      const item = {
        title: 'Deep Residual Learning',
        authors: ['He, Kaiming', 'Zhang, Xiangyu'],
        year: 2016,
        doi: '10.1109/CVPR.2016.90',
        itemType: 'conferencePaper',
      };
      const bibtex = toBibTeXEntry(item);
      expect(bibtex).toContain('@inproceedings{he2016deep,');
      expect(bibtex).toContain('title = {Deep Residual Learning}');
      expect(bibtex).toContain('doi = {10.1109/CVPR.2016.90}');
      expect(bibtex).toContain('year = {2016}');
    });
  });

  describe('Categories Domain (categories.ts)', () => {
    it('should resolve arXiv category names and subject areas', () => {
      expect(resolveArxivCategory('cs.AI')).toBe('cs.AI');
      expect(getSubjectArea('cs.LG')).toBe('Computer Science');
      expect(getSubjectArea('math.PR')).toBe('Mathematics');
    });
  });

  describe('Renamer Domain (renamer.ts)', () => {
    it('should format attachment filenames based on Zotero presets', () => {
      const item = {
        title: 'Mastering the Game of Go without Human Knowledge',
        authors: ['David Silver', 'Julian Schrittwieser'],
        year: 2017,
      };

      const defaultPreset = RENAME_PRESETS[0];
      const filename = previewAttachmentFilename(defaultPreset.pattern, item, 'nature_go.pdf');
      expect(filename).toBe('Silver - 2017 - Mastering the Game of Go without Human Knowledge.pdf');

      const citeKeyPreset = RENAME_PRESETS.find((p) => p.id === 'citation-key');
      if (citeKeyPreset) {
        const keyFilename = previewAttachmentFilename(citeKeyPreset.pattern, item, 'nature_go.pdf');
        expect(keyFilename).toBe('silver2017mastering.pdf');
      }
    });

    it('should sanitize filename stems from illegal OS characters', () => {
      expect(sanitizeFilenameStem('paper:with/illegal\\chars*?"<>|')).toBe('paper with illegal chars');
    });
  });

  describe('Search & Filter Domain (search-filter.ts)', () => {
    const testItems: any[] = [
      { id: '1', title: 'Quantum Computing', year: 2021, authors: ['Nielsen'], createdAt: '2021-01-01' },
      { id: '2', title: 'Deep Learning', year: 2023, authors: ['LeCun'], createdAt: '2023-01-01' },
      { id: '3', title: 'AlphaFold', year: 2020, authors: ['Jumper'], createdAt: '2020-01-01' },
    ];

    it('should sort items by title, year, and date', () => {
      const sortedByYearDesc = LibraryFilterEngine.sort(testItems, {
        field: 'year',
        direction: 'desc',
      });
      expect(sortedByYearDesc[0].id).toBe('2');
      expect(sortedByYearDesc[2].id).toBe('3');

      const sortedByTitleAsc = LibraryFilterEngine.sort(testItems, {
        field: 'title',
        direction: 'asc',
      });
      expect(sortedByTitleAsc[0].title).toBe('AlphaFold');
    });

    it('should filter items by search query', () => {
      const filtered = LibraryFilterEngine.filterBySearch(testItems, 'Quantum');
      expect(filtered.length).toBe(1);
      expect(filtered[0].id).toBe('1');
    });
  });

  describe('Deduplication Domain (deduplication.ts)', () => {
    it('should detect duplicate pairs by DOI or title matching', () => {
      const itemA = { id: 'a', title: 'Attention Is All You Need', doi: '10.1145/123' };
      const itemB = { id: 'b', title: 'Attention Is All You Need (preprint)', doi: '10.1145/123' };
      const itemC = { id: 'c', title: 'Unrelated Paper', doi: '10.9999/other' };

      expect(isDuplicatePair(itemA, itemB).isDuplicate).toBe(true);
      expect(isDuplicatePair(itemA, itemC).isDuplicate).toBe(false);
    });

    it('should cluster duplicates into deduplication groups', () => {
      const items: any[] = [
        { id: '1', title: 'Deep Learning', doi: '10.1000/1' },
        { id: '2', title: 'Deep Learning', doi: '10.1000/1' },
        { id: '3', title: 'Quantum Teleportation', doi: '10.2000/2' },
      ];

      const clusters = clusterDuplicateItems(items);
      expect(clusters.length).toBe(1);
      expect(clusters[0].items.length).toBe(2);
      expect(clusters[0].items.map((i) => i.id)).toEqual(['1', '2']);
    });

    it('should scale linearly O(N) without freezing for large item lists', () => {
      // Generate 2000 items with scattered duplicates
      const largeList: any[] = [];
      for (let i = 0; i < 2000; i++) {
        largeList.push({
          id: `item-${i}`,
          title: `Unique Academic Paper Title #${i} with more than fifteen characters`,
          doi: `10.1000/paper.${i}`,
          year: 2020 + (i % 5),
        });
      }
      // Inject duplicate pairs
      largeList.push({
        id: 'dup-1',
        title: 'Unique Academic Paper Title #10 with more than fifteen characters',
        doi: '10.1000/paper.10',
        year: 2020,
      });

      const start = performance.now();
      const clusters = clusterDuplicateItems(largeList);
      const durationMs = performance.now() - start;

      // O(N) bucket hashing should finish 2000 items in well under 100ms (O(N^2) would take seconds)
      expect(clusters.length).toBeGreaterThanOrEqual(1);
      expect(durationMs).toBeLessThan(200);
    });
  });

  describe('Deep Metadata Diff & Asset Aggregation (diff.ts)', () => {
    it('should inspect differences and flag conflicts correctly', () => {
      const master: any = {
        id: 'master-1',
        title: 'Master Title',
        abstract: 'A very detailed abstract of the research.',
        year: 2022,
        doi: '10.1000/abc',
      };
      const candidate: any = {
        id: 'candidate-2',
        title: 'Candidate Title',
        abstract: 'Short abstract',
        year: 2022,
        doi: '',
      };

      const result = inspectItemDifferences([master, candidate], master.id);
      expect(result.hasConflicts).toBe(true);
      expect(result.conflictCount).toBeGreaterThan(0);

      // Title has conflict
      const titleDiff = result.fields.find((f) => f.key === 'title');
      expect(titleDiff?.hasConflict).toBe(true);

      // Abstract recommends the longer one (master)
      const abstractDiff = result.fields.find((f) => f.key === 'abstract');
      expect(abstractDiff?.recommendedItemId).toBe(master.id);
    });

    it('should non-destructively aggregate assets', () => {
      const item1: any = {
        id: '1',
        tags: ['AI', 'Robotics'],
        collectionId: 'col-1',
        attachments: [{ id: 'f1' }],
        notes: [{ id: 'n1' }],
      };
      const item2: any = {
        id: '2',
        tags: ['Robotics', 'Control'],
        collectionIds: ['col-2'],
        attachments: [{ id: 'f2' }],
        notes: [{ id: 'n2' }, { id: 'n3' }],
      };

      const summary = aggregateItemAssets([item1, item2]);
      expect(summary.totalTags).toBe(3); // 'AI', 'Robotics', 'Control'
      expect(summary.tags).toContain('AI');
      expect(summary.tags).toContain('Robotics');
      expect(summary.tags).toContain('Control');
      expect(summary.totalCollections).toBe(2); // 'col-1', 'col-2'
      expect(summary.totalFiles).toBe(2);
      expect(summary.totalNotes).toBe(3);
    });
  });
});
