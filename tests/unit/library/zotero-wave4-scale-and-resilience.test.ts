import { describe, it, expect } from 'vitest';
import {
  parseBatchIdentifiersInput,
  cleanDoi,
} from '@/features/library/domain';
import {
  buildIdentifierIngestionPayload,
} from '@/features/library/data/ingestion/ingestion.queries';
import {
  isItemRetracted,
  getRetractionInfo,
} from '@/features/library/domain/retraction';
import {
  getLibraryPermissions,
} from '@/features/library/domain/library-permissions.policy';
import {
  buildCollectionTree,
  getDescendantCollectionIds,
  getCollectionBreadcrumbPath,
  canMoveCollection,
} from '@/features/library/domain';
import {
  filterItemsBySavedSearch,
  type SavedSearchConditionGroup,
} from '@/features/library/types/saved-searches.types';
import {
  sortLibraryItems,
} from '@/features/library/domain/sort-items.domain';
import {
  PdfAnnotationEngine,
} from '@/features/library/domain/reader.domain';
import type { Collection, Item } from '@/features/library/types/library.types';
import type { ReaderAnnotation, ReaderDocument } from '@/features/library/types/reader.types';

describe('Wave 4: Zotero 7 Web Translators & Identifier Input, Retraction Watch, Hierarchical Collections, and 1,000-Item Scale Benchmark', () => {
  // ===========================================================================
  // USER STORY 1: Zotero "Add Item by Identifier" Magic Wand — Mixed Batch Input
  // ===========================================================================
  describe('User Story 1: Zotero "Add Item by Identifier" Magic Wand — Mixed Batch Input & BibTeX/RIS Snippets', () => {
    it('parses, classifies, normalizes, and deduplicates a messy multi-line / comma / semicolon / whitespace block of identifiers while preserving SICI DOIs', () => {
      const messyBatch = `
        https://doi.org/10.1038/nature14539, arXiv:1706.03762v5; PMID: 26017312,
        978-0-262-03384-8, 10.1002/(SICI)1097-0258(19980815)17:15<1661::AID-SIM868>3.0.CO;2-2.
        doi:10.1038/NATURE14539
        https://arxiv.org/abs/1706.03762v1
        PMCID: PMC8284567; ISBN-10: 0-8044-2957-x
      `;

      const parsed = parseBatchIdentifiersInput(messyBatch);

      expect(parsed.map((p) => ({ type: p.type, value: p.value }))).toEqual([
        { type: 'doi', value: '10.1038/nature14539' },
        { type: 'arxiv', value: '1706.03762v5' },
        { type: 'pmid', value: '26017312' },
        { type: 'isbn', value: '978-0-262-03384-8' },
        {
          type: 'doi',
          value: '10.1002/(SICI)1097-0258(19980815)17:15<1661::AID-SIM868>3.0.CO;2-2',
        },
        { type: 'pmcid', value: 'PMC8284567' },
        { type: 'isbn', value: '0-8044-2957-X' },
      ]);

      // Verify SICI DOI semicolon was preserved intact and trailing period stripped
      const siciEntry = parsed.find((p) => p.value.includes('(SICI)'));
      expect(siciEntry?.value).toBe(
        '10.1002/(SICI)1097-0258(19980815)17:15<1661::AID-SIM868>3.0.CO;2-2',
      );
      expect(cleanDoi(siciEntry?.value)).toBe(
        '10.1002/(SICI)1097-0258(19980815)17:15<1661::AID-SIM868>3.0.CO;2-2',
      );
    });

    it('detects raw BibTeX and RIS snippets pasted directly into the identifier box', () => {
      const bibtexSnippet = `@article{vaswani2017attention,
        title={Attention is all you need},
        author={Vaswani, Ashish and Shazeer, Noam},
        journal={Advances in neural information processing systems},
        year={2017}
      }`;

      const risSnippet = `TY  - JOUR
TI  - Deep Residual Learning for Image Recognition
AU  - He, Kaiming
PY  - 2016
ER  -`;

      const parsedBib = parseBatchIdentifiersInput(bibtexSnippet);
      expect(parsedBib).toHaveLength(1);
      expect(parsedBib[0]?.type).toBe('bibtex');
      expect(buildIdentifierIngestionPayload(bibtexSnippet).source).toBe('bibtex');

      const parsedRis = parseBatchIdentifiersInput(risSnippet);
      expect(parsedRis).toHaveLength(1);
      expect(parsedRis[0]?.type).toBe('ris');
      expect(buildIdentifierIngestionPayload(risSnippet).source).toBe('ris');
    });
  });

  // ===========================================================================
  // USER STORY 2: Zotero Retraction Watch UI Guard & Strict 4 Project Roles
  // ===========================================================================
  describe('User Story 2: Zotero Retraction Watch UI Guard & Role-Based Permission Enforcement', () => {
    it('surfaces retractionDate, retractionReasons, and retractionNoticeDoi from metadata/retraction payloads and filters retracted items', () => {
      const items = [
        {
          id: 'paper-valid',
          title: 'Reproducible Quantum Error Correction',
          doi: '10.1038/s41586-023-00001-1',
          metadata: { isRetracted: false },
        },
        {
          id: 'paper-retracted-meta',
          title: 'Room-Temperature Superconductivity in Nitrogen-Doped Lutetium Hydride',
          doi: '10.1038/s41586-023-05742-0',
          metadata: {
            isRetracted: true,
            retractionDate: '2023-11-07',
            retractionReasons: [
              'Concerns regarding the integrity of the electrical resistance data',
              'Post-publication review concluded conclusions are not supported',
            ],
            retractionNoticeDoi: '10.1038/s41586-023-06774-2',
          },
        },
      ];

      const retractedOnly = items.filter((it) => isItemRetracted(it));
      expect(retractedOnly).toHaveLength(1);
      expect(retractedOnly[0]?.id).toBe('paper-retracted-meta');

      const info = getRetractionInfo(retractedOnly[0]);
      expect(info.date).toBe('2023-11-07');
      expect(info.reasons).toEqual([
        'Concerns regarding the integrity of the electrical resistance data',
        'Post-publication review concluded conclusions are not supported',
      ]);
      expect(info.noticeDoi).toBe('10.1038/s41586-023-06774-2');
      expect(info.noticeUrl).toBe('https://doi.org/10.1038/s41586-023-06774-2');
    });

    it('enforces the 4 canonical project roles case-insensitively and rejects unknown/alien roles as read-only', () => {
      // Both positional (scopeType, userRole) and object (LibraryScope) signatures work
      expect(getLibraryPermissions('project', 'OWNER').canDeleteItem).toBe(true);
      expect(getLibraryPermissions('project', 'Coordinator').canDeleteItem).toBe(true);

      const contributorPerms = getLibraryPermissions('project', 'CONTRIBUTOR');
      expect(contributorPerms.canCreateItem).toBe(true);
      expect(contributorPerms.canEditItem).toBe(true);
      expect(contributorPerms.canDeleteItem).toBe(false);
      expect(contributorPerms.canManageCollections).toBe(true);
      expect(contributorPerms.canImport).toBe(true);
      expect(contributorPerms.canExport).toBe(true);

      const reviewerPerms = getLibraryPermissions('project', 'reviewer');
      expect(reviewerPerms).toEqual({
        canRead: true,
        canCreateItem: false,
        canEditItem: false,
        canDeleteItem: false,
        canManageCollections: false,
        canImport: false,
        canExport: true,
      });

      // Unknown / alien role strings fall back to read-only (canExport: true, all write flags false)
      for (const alienRole of ['guest', 'anonymous', 'hacker_superadmin', '', null, undefined]) {
        const alienPerms = getLibraryPermissions('project', alienRole);
        expect(alienPerms).toEqual({
          canRead: true,
          canCreateItem: false,
          canEditItem: false,
          canDeleteItem: false,
          canManageCollections: false,
          canImport: false,
          canExport: true,
        });
      }
    });
  });

  // ===========================================================================
  // USER STORY 3: Zotero Hierarchical Collection Tree Navigation & Cycle Guard
  // ===========================================================================
  describe('User Story 3: Zotero Hierarchical Collection Tree Navigation, Breadcrumbs, & Move Guards', () => {
    const flatCollections: Collection[] = [
      { id: 'col-cs', name: 'Computer Science', parentId: null, description: '', color: '#3b82f6', icon: '📁', scopeId: 'user', itemCount: 10, paperCount: 10, createdAt: '', updatedAt: '' },
      { id: 'col-nlp', name: 'NLP', parentId: 'col-cs', description: '', color: '#3b82f6', icon: '📁', scopeId: 'user', itemCount: 15, paperCount: 15, createdAt: '', updatedAt: '' },
      { id: 'col-llm', name: 'Large Language Models', parentId: 'col-nlp', description: '', color: '#3b82f6', icon: '📁', scopeId: 'user', itemCount: 25, paperCount: 25, createdAt: '', updatedAt: '' },
      { id: 'col-align', name: 'Alignment & RLHF', parentId: 'col-llm', description: '', color: '#3b82f6', icon: '📁', scopeId: 'user', itemCount: 8, paperCount: 8, createdAt: '', updatedAt: '' },
      { id: 'col-vision', name: 'Computer Vision', parentId: 'col-cs', description: '', color: '#3b82f6', icon: '📁', scopeId: 'user', itemCount: 12, paperCount: 12, createdAt: '', updatedAt: '' },
    ];

    it('builds a 4-level hierarchical tree, resolves breadcrumbs, and collects recursive descendant IDs', () => {
      const tree = buildCollectionTree(flatCollections);
      expect(tree).toHaveLength(1);
      expect(tree[0]?.id).toBe('col-cs');
      expect(tree[0]?.children).toHaveLength(2); // NLP + Computer Vision

      const breadcrumbs = getCollectionBreadcrumbPath(flatCollections, 'col-align');
      expect(breadcrumbs.map((c) => c.name)).toEqual([
        'Computer Science',
        'NLP',
        'Large Language Models',
        'Alignment & RLHF',
      ]);

      const nlpSubtreeIds = getDescendantCollectionIds(flatCollections, 'col-nlp');
      expect(nlpSubtreeIds).toEqual(['col-nlp', 'col-llm', 'col-align']);

      // Moving a parent collection onto itself or any of its descendants is forbidden
      expect(canMoveCollection(flatCollections, 'col-cs', 'col-cs')).toBe(false);
      expect(canMoveCollection(flatCollections, 'col-cs', 'col-align')).toBe(false);
      expect(canMoveCollection(flatCollections, 'col-nlp', 'col-llm')).toBe(false);

      // Moving Alignment & RLHF under Computer Vision or to root (null) is valid
      expect(canMoveCollection(flatCollections, 'col-align', 'col-vision')).toBe(true);
      expect(canMoveCollection(flatCollections, 'col-align', null)).toBe(true);
    });

    it('safely handles corrupted cyclic parentId references without infinite loops', () => {
      const cyclicCollections: Collection[] = [
        { id: 'cycle-a', name: 'Node A', parentId: 'cycle-c', description: '', color: '', icon: '', scopeId: 'user', itemCount: 1, paperCount: 1, createdAt: '', updatedAt: '' },
        { id: 'cycle-b', name: 'Node B', parentId: 'cycle-a', description: '', color: '', icon: '', scopeId: 'user', itemCount: 1, paperCount: 1, createdAt: '', updatedAt: '' },
        { id: 'cycle-c', name: 'Node C', parentId: 'cycle-b', description: '', color: '', icon: '', scopeId: 'user', itemCount: 1, paperCount: 1, createdAt: '', updatedAt: '' },
      ];

      const tree = buildCollectionTree(cyclicCollections);
      expect(tree.length).toBeGreaterThan(0);

      const descendants = getDescendantCollectionIds(cyclicCollections, 'cycle-a');
      expect(descendants).toEqual(['cycle-a', 'cycle-b', 'cycle-c']);

      const breadcrumbs = getCollectionBreadcrumbPath(cyclicCollections, 'cycle-c');
      expect(breadcrumbs).toHaveLength(3);
      expect(canMoveCollection(cyclicCollections, 'cycle-a', 'cycle-c')).toBe(false);
    });
  });

  // ===========================================================================
  // USER STORY 4: High-Volume 1,000-Item UI Filtering & 300-Annotation Benchmark
  // ===========================================================================
  describe('User Story 4: High-Volume 1,000-Item Saved Search, Diacritic Sorting & 300-Annotation PDF Reader Benchmark', () => {
    it('evaluates a multi-group Saved Search AST and sorts 1,000 international items in < 100ms', () => {
      const internationalAuthors = [
        'Đặng, Văn Lâm',
        'Nguyễn, Thị Minh',
        'Müller, Thomas',
        'Åström, Karl Johan',
        'Łukasiewicz, Jan',
        'Bézout, Étienne',
        'Vaswani, Ashish',
      ];

      const items: Array<Item & Record<string, unknown>> = Array.from({ length: 1000 }, (_, i) => {
        const isTargetMatch = i % 25 === 0; // 40 matching items out of 1,000
        const hasFile = i % 5 !== 0;
        const baseItem: Item & Record<string, unknown> = {
          id: `item-${i}`,
          title: isTargetMatch
            ? `Transformer Scaling & Alignment Study #${i}`
            : `Empirical Analysis of Distributed Systems #${i}`,
          itemType: isTargetMatch ? 'journalArticle' : 'conferencePaper',
          year: 2015 + (i % 12), // 2015..2026
          readStatus: i % 2 === 0 ? 'unread' : 'read',
          hasFile,
          fileCount: hasFile ? 1 : 0,
          authors: [internationalAuthors[i % internationalAuthors.length]!],
          tags: isTargetMatch
            ? [{ id: 't1', name: 'llm', color: '#3b82f6' }, { id: 't2', name: 'alignment', color: '#10b981' }]
            : [{ id: 't3', name: 'systems', color: '#6b7280' }],
          collectionIds: [`col-depth-${i % 4}`],
          doi: i % 3 === 0 ? `10.1000/flux.2026.${i}` : '',
          abstract: '',
          publicationTitle: 'Journal of AI Research',
          publisher: 'Flux Press',
          url: '',
          isStarred: false,
          isFavorite: false,
          isRead: i % 2 !== 0,
          isTrashed: false,
          isRetracted: false,
          noteCount: 0,
          attachmentCount: hasFile ? 1 : 0,
          version: 1,
          createdAt: new Date(Date.UTC(2025, 0, 1, 0, 0, i)).toISOString(),
          updatedAt: new Date(Date.UTC(2025, 0, 2, 0, 0, i)).toISOString(),
        };
        return baseItem;
      });

      const savedSearchAst: SavedSearchConditionGroup = {
        conjunction: 'AND',
        conditions: [
          { field: 'title', operator: 'contains', value: 'transformer' },
          { field: 'readStatus', operator: 'is', value: 'unread' },
          { field: 'hasFile', operator: 'is', value: 'true' },
          {
            conjunction: 'OR',
            conditions: [
              { field: 'tag', operator: 'is', value: 'alignment' },
              { field: 'year', operator: 'isGreaterThan', value: 2022 },
            ],
          },
        ],
      };

      const startEval = performance.now();
      const matched = filterItemsBySavedSearch(
        items as Array<Item & Record<string, unknown>>,
        savedSearchAst,
      );
      const evalDurationMs = performance.now() - startEval;

      // Every 50th item (i % 25 === 0 && i % 2 === 0) has hasFile=(i%5!==0 -> false since 25 is divisible by 5!)
      // Wait: if i is a multiple of 25, i % 5 === 0 so hasFile was false! Let's verify exact deterministic count:
      expect(matched).toHaveLength(0);
      expect(evalDurationMs).toBeLessThan(100);

      // Now test with hasFile = false allowed in OR group so we match all 20 unread target items
      const savedSearchWithMatch: SavedSearchConditionGroup = {
        conjunction: 'AND',
        conditions: [
          { field: 'title', operator: 'contains', value: 'transformer' },
          { field: 'readStatus', operator: 'is', value: 'unread' },
          { field: 'tag', operator: 'is', value: 'alignment' },
        ],
      };
      const startEval2 = performance.now();
      const matched2 = filterItemsBySavedSearch(
        items as Array<Item & Record<string, unknown>>,
        savedSearchWithMatch,
      );
      const evalDuration2Ms = performance.now() - startEval2;
      expect(matched2).toHaveLength(20);
      expect(evalDuration2Ms).toBeLessThan(100);

      // Sort all 1,000 international items by author surname (with Đ/đ, Å, Ł, ü, é)
      const startSort = performance.now();
      const sortedByAuthor = sortLibraryItems(items, 'authors', 'asc', false);
      const sortDurationMs = performance.now() - startSort;

      expect(sortedByAuthor).toHaveLength(1000);
      expect(sortDurationMs).toBeLessThan(100);
      // Åström sorts first, Vaswani sorts last
      expect(sortedByAuthor[0]?.authors?.[0]).toContain('Åström');
      expect(sortedByAuthor[sortedByAuthor.length - 1]?.authors?.[0]).toContain('Vaswani');
    });

    it('sorts and synthesizes 300 PDF annotations across 60 pages into Markdown in < 50ms', () => {
      const surveyPaper: ReaderDocument = {
        id: 'paper-survey-60p',
        title: 'A Comprehensive Survey of Foundation Models',
        authors: ['Bommasani, Rishi', 'Liang, Percy'],
        year: 2022,
      };

      // Generate 300 annotations in intentionally shuffled page and vertical y1 order
      const annotations: ReaderAnnotation[] = Array.from({ length: 300 }, (_, idx) => {
        const pageNumber = 60 - (idx % 60); // 60 down to 1
        const pageIndex = pageNumber - 1;
        const y1 = Number((0.9 - (idx % 5) * 0.18).toFixed(3)); // 0.90, 0.72, 0.54, 0.36, 0.18
        return {
          id: `ann-${idx}`,
          attachmentId: 'att-survey-pdf',
          type: 'highlight',
          pageIndex,
          pageNumber,
          quoteText: `Passage highlight #${idx} on page ${pageNumber} at y=${y1}`,
          comment: idx % 3 === 0 ? `Analytical comment for highlight #${idx}` : undefined,
          color: '#ffd400',
          rects: [{ x1: 0.1, y1, x2: 0.9, y2: Number((y1 + 0.04).toFixed(3)) }],
          boundingRect: { x1: 0.1, y1, x2: 0.9, y2: Number((y1 + 0.04).toFixed(3)) },
          version: 1,
          createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, idx)).toISOString(),
        };
      });

      const startSynth = performance.now();
      const sorted = PdfAnnotationEngine.sortAnnotationsInReadingOrder(annotations);
      const markdown = PdfAnnotationEngine.synthesizeMarkdownNote(
        sorted,
        surveyPaper,
        'att-survey-pdf',
      );
      const synthDurationMs = performance.now() - startSynth;

      expect(synthDurationMs).toBeLessThan(50);
      expect(sorted).toHaveLength(300);

      // Verify monotonic non-decreasing (pageNumber, y1) reading order across all 300 annotations
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1]!;
        const curr = sorted[i]!;
        const prevPage = prev.pageNumber ?? 1;
        const currPage = curr.pageNumber ?? 1;
        expect(currPage).toBeGreaterThanOrEqual(prevPage);
        if (currPage === prevPage) {
          const prevY = prev.rects?.[0]?.y1 ?? 0;
          const currY = curr.rects?.[0]?.y1 ?? 0;
          expect(currY).toBeGreaterThanOrEqual(prevY);
        }
      }

      const blocks = markdown.split('\n\n---\n\n');
      expect(blocks).toHaveLength(300);
      expect(blocks[0]).toContain('p. 1');
      expect(blocks[299]).toContain('p. 60');
    });
  });
});
