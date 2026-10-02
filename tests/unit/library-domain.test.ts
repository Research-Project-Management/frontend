import { describe, it, expect } from 'vitest';
import {
  // Creators
  normalizeAuthors,
  parseAuthorName,
  formatCreatorCompact,
  cleanAuthorName,
  splitAuthorString,
  isNoiseAuthorName,
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
  // Diff & Merge
  inspectItemDifferences,
  aggregateItemAssets,
} from '@/features/library/domain';
import { formatAcademicAuthors } from '@/features/library/utils/academic-text';

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

      const p4 = parseAuthorName('Martin Luther King, Jr.');
      expect(p4.firstName).toBe('Martin Luther');
      expect(p4.lastName).toBe('King Jr.');
      expect(p4.fullName).toBe('Martin Luther King Jr.');
    });

    it('should clean author names from OCR junk, footnote markers, and emails', () => {
      expect(cleanAuthorName('Karen Simonyan 1,2*')).toBe('Karen Simonyan');
      expect(cleanAuthorName('Andrew Zisserman *†')).toBe('Andrew Zisserman');
      expect(cleanAuthorName('1. Ashish Vaswani')).toBe('Ashish Vaswani');
      expect(cleanAuthorName('Jane Doe (corresponding author)')).toBe('Jane Doe');
      expect(cleanAuthorName('John Doe <john@ox.ac.uk>')).toBe('John Doe');
      expect(cleanAuthorName('Prof. Dr. Donald E. Knuth, PhD')).toBe('Donald E. Knuth');
      expect(cleanAuthorName('Jakob Uszkoreit 1')).toBe('Jakob Uszkoreit');
    });

    it('should reject noise author names, affiliations, and OCR artifacts', () => {
      expect(isNoiseAuthorName('A B S T R A C T')).toBe(true);
      expect(isNoiseAuthorName('A BSTRACT')).toBe(true);
      expect(isNoiseAuthorName('ABSTRACT')).toBe(true);
      expect(isNoiseAuthorName('Visual Geometry Group')).toBe(true);
      expect(isNoiseAuthorName('Department of Engineering Science')).toBe(true);
      expect(isNoiseAuthorName('University of Oxford, Department of Engineering Science')).toBe(true);
      expect(isNoiseAuthorName('Keywords')).toBe(true);
      expect(isNoiseAuthorName('References')).toBe(true);
      expect(isNoiseAuthorName('Karen Simonyan')).toBe(false);
      expect(isNoiseAuthorName('Andrew Zisserman')).toBe(false);

      expect(cleanAuthorName('A B S T R A C T')).toBe('');
      expect(cleanAuthorName('Author: A BSTRACT')).toBe('');
      expect(cleanAuthorName('Visual Geometry Group')).toBe('');

      expect(
        splitAuthorString('Karen Simonyan, Andrew Zisserman, A BSTRACT, Visual Geometry Group')
      ).toEqual(['Karen Simonyan', 'Andrew Zisserman']);
    });

    it('should split composite author strings with semicolon, and, &, and commas correctly', () => {
      // Semicolon
      expect(splitAuthorString('Simonyan, Karen; Zisserman, Andrew')).toEqual([
        'Simonyan, Karen',
        'Zisserman, Andrew',
      ]);

      // Conjunctions with Oxford comma
      expect(splitAuthorString('Ashish Vaswani, Noam Shazeer, and Niki Parmar')).toEqual([
        'Ashish Vaswani',
        'Noam Shazeer',
        'Niki Parmar',
      ]);

      // Conjunction with ampersand
      expect(splitAuthorString('Vaswani, Ashish and Shazeer, Noam & Parmar, Niki')).toEqual([
        'Vaswani, Ashish',
        'Shazeer, Noam',
        'Parmar, Niki',
      ]);

      // Two forward authors
      expect(splitAuthorString('Karen Simonyan, Andrew Zisserman')).toEqual([
        'Karen Simonyan',
        'Andrew Zisserman',
      ]);

      // Single inverted author
      expect(splitAuthorString('Simonyan, Karen')).toEqual(['Simonyan, Karen']);

      // Inverted pairs with initials
      expect(splitAuthorString('Vaswani, A., Shazeer, N., Parmar, N.')).toEqual([
        'Vaswani, A.',
        'Shazeer, N.',
        'Parmar, N.',
      ]);
    });

    it('should format academic authors for UI display without confusing mid-name commas', () => {
      // Inverted authors become natural for UI joining
      expect(formatAcademicAuthors(['Simonyan, Karen', 'Zisserman, Andrew'])).toBe(
        'Karen Simonyan, Andrew Zisserman',
      );

      // Single composite string is split and formatted
      expect(formatAcademicAuthors('Ashish Vaswani; Noam Shazeer; Niki Parmar; Jakob Uszkoreit')).toBe(
        'Ashish Vaswani, Noam Shazeer, Niki Parmar et al.',
      );

      // CSL-JSON objects
      expect(
        formatAcademicAuthors([
          { family: 'Vaswani', given: 'Ashish' },
          { family: 'Shazeer', given: 'Noam' },
        ]),
      ).toBe('Ashish Vaswani, Noam Shazeer');

      // Empty or invalid returns dash
      expect(formatAcademicAuthors(null)).toBe('—');
      expect(formatAcademicAuthors([])).toBe('—');
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

    it('should normalize spaced hyphens and OCR gaps in paper titles', () => {
      expect(cleanPaperTitle('Large - Scale Image Recognition')).toBe('Large-Scale Image Recognition');
      expect(cleanPaperTitle('Auto - Encoding Variational Bayes')).toBe('Auto-Encoding Variational Bayes');
      expect(
        cleanPaperTitle('Very Deep Convolutional Networks for Large - Scale Image Recognition')
      ).toBe('Very Deep Convolutional Networks for Large-Scale Image Recognition');
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

    it('should disambiguate citation keys with a, b, c suffixes when collisions exist', () => {
      const item = {
        title: 'Attention Is All You Need',
        authors: ['Vaswani, Ashish'],
        year: 2017,
      };
      const existing = new Set(['vaswani2017attention']);
      const key2 = generateCitationKey(item, existing);
      expect(key2).toBe('vaswani2017attentiona');

      existing.add('vaswani2017attentiona');
      const key3 = generateCitationKey(item, existing);
      expect(key3).toBe('vaswani2017attentionb');
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
    it('should resolve arXiv category names', () => {
      expect(resolveArxivCategory('cs.AI')).toBe('cs.AI');
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

  describe('Tree Structure & Cycle Guard (tree-helpers.ts)', () => {
    it('should build a nested tree from a flat collection array', async () => {
      const { buildTree } = await import('@/features/library/components/sidebar/tree-helpers');
      const collections: any[] = [
        { id: 'c1', name: 'Root 1', parentId: null },
        { id: 'c2', name: 'Child 1.1', parentId: 'c1' },
        { id: 'c3', name: 'Child 1.1.1', parentId: 'c2' },
        { id: 'c4', name: 'Root 2', parentId: null },
      ];

      const tree = buildTree(collections);
      expect(tree.length).toBe(2);
      expect(tree[0].id).toBe('c1');
      expect(tree[0].children.length).toBe(1);
      expect(tree[0].children[0].id).toBe('c2');
      expect(tree[0].children[0].children[0].id).toBe('c3');
      expect(tree[1].id).toBe('c4');
    });

    it('should break circular parent cycles gracefully without stack overflow', async () => {
      const { buildTree } = await import('@/features/library/components/sidebar/tree-helpers');
      // Create a circular dependency: A -> B -> A and self-reference: C -> C
      const collections: any[] = [
        { id: 'cA', name: 'Cyclic A', parentId: 'cB' },
        { id: 'cB', name: 'Cyclic B', parentId: 'cA' },
        { id: 'cC', name: 'Self Cyclic C', parentId: 'cC' },
      ];

      const tree = buildTree(collections);
      // All cyclic nodes must be safely converted to root nodes to prevent infinite recursion
      expect(tree.length).toBeGreaterThanOrEqual(2);
      // Ensure children do not reference their ancestor
      const findCycle = (node: any, seen = new Set<string>()): boolean => {
        if (seen.has(node.id)) return true;
        seen.add(node.id);
        return node.children.some((child: any) => findCycle(child, new Set(seen)));
      };
      expect(tree.some((root) => findCycle(root))).toBe(false);
    });

    it('should accurately compute valid move targets excluding self and all descendants', async () => {
      const { getValidMoveTargets } = await import('@/features/library/components/sidebar/tree-helpers');
      const collections: any[] = [
        { id: 'root', name: 'Root', parentId: null },
        { id: 'child', name: 'Child', parentId: 'root' },
        { id: 'grandchild', name: 'Grandchild', parentId: 'child' },
        { id: 'other', name: 'Other Root', parentId: null },
      ];

      const validForChild = getValidMoveTargets(collections, 'child');
      const validIds = validForChild.map((c) => c.id);
      expect(validIds).toContain('root');
      expect(validIds).toContain('other');
      expect(validIds).not.toContain('child');
      expect(validIds).not.toContain('grandchild');
    });

    it('should filter collections preserving ancestor chain', async () => {
      const { filterCollections } = await import('@/features/library/components/sidebar/tree-helpers');
      const collections: any[] = [
        { id: 'root', name: 'Physics Department', parentId: null },
        { id: 'child', name: 'Quantum Optics Lab', parentId: 'root' },
        { id: 'unrelated', name: 'Computer Science', parentId: null },
      ];

      const filtered = filterCollections(collections, 'Quantum');
      const ids = filtered.map((c) => c.id);
      expect(ids).toContain('child');
      expect(ids).toContain('root'); // Parent preserved!
      expect(ids).not.toContain('unrelated');
    });
  });

  describe('Library Sorting Utility (sort-items.ts)', () => {
    it('should pin processing items to the top regardless of sort direction', async () => {
      const { sortLibraryItems } = await import('@/features/library/utils/sort-items');
      const items: any[] = [
        { id: '1', title: 'Beta', year: 2020 },
        { id: '2', title: 'Alpha', year: 2024, _isProcessing: true },
        { id: '3', title: 'Gamma', year: 2022 },
      ];
      const res = sortLibraryItems(items, 'title', 'asc', false);
      expect(res[0].id).toBe('2');
      expect(res[1].id).toBe('1');
      expect(res[2].id).toBe('3');
    });

    it('should sort regular items alphabetically and numerically', async () => {
      const { sortLibraryItems } = await import('@/features/library/utils/sort-items');
      const items: any[] = [
        { id: '1', title: 'Charlie', year: 2020 },
        { id: '2', title: 'Alpha', year: 2024 },
        { id: '3', title: 'Bravo', year: 2022 },
      ];
      const asc = sortLibraryItems(items, 'title', 'asc', false);
      expect(asc.map((i) => i.title)).toEqual(['Alpha', 'Bravo', 'Charlie']);

      const descYear = sortLibraryItems(items, 'year', 'desc', false);
      expect(descYear.map((i) => i.year)).toEqual([2024, 2022, 2020]);
    });

    it('should correctly handle author and date aliases', async () => {
      const { sortLibraryItems } = await import('@/features/library/utils/sort-items');
      const items: any[] = [
        { id: '1', authors: ['Knuth'], createdAt: '2024-01-01' },
        { id: '2', authors: ['Einstein'], createdAt: '2024-05-01' },
      ];
      const sortedByAuthor = sortLibraryItems(items, 'authors', 'asc', false);
      expect(sortedByAuthor[0].id).toBe('2');

      const sortedByDate = sortLibraryItems(items, 'dateAdded', 'desc', false);
      expect(sortedByDate[0].id).toBe('2');
    });
  });
});
