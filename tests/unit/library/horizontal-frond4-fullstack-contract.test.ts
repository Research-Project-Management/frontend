import { describe, it, expect, vi } from 'vitest';
import type { Item } from '@/features/library/domain/types/library.types';
import {
  mapBackendItem,
  getPublicationVenue,
  buildExtraMetadataPatch,
} from '@/features/library/domain/metadata';
import { mergeRawItemPartials } from '@/features/library/domain/metadata-mapper.helpers';
import { mergeCachedItemWithPatch } from '@/features/library/sdk/queries/cache-patcher';
import { buildInspectorFieldPatch } from '@/features/library/domain/item-field-schema';
import { FIELD_CANDIDATE_SCORERS } from '@/features/library/domain/item-field-scorers.strategy';
import {
  buildStructuredCreatorsFromAuthors,
  resolveDuplicateMergeFieldOverrides,
  selectBestMasterItemId,
} from '@/features/library/domain/diff';
import { createMergeDuplicatesCommand } from '@/features/library/core/manager/library-commands.catalog';
import { sortLibraryItems } from '@/features/library/domain/sort-items.domain';
import {
  normalizeSearchStr,
  calculateFilterMatchScore,
} from '@/features/library/domain/filter-matcher.domain';

function makeBaseItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 'item-1',
    title: 'Sample Item',
    authors: ['Jane Doe'],
    creators: [
      {
        creatorType: 'author',
        firstName: 'Jane',
        lastName: 'Doe',
        fullName: 'Jane Doe',
        fieldMode: 0,
      },
    ],
    year: 2024,
    itemType: 'journalArticle',
    tags: [],
    collectionIds: [],
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-02T00:00:00.000Z',
    ...overrides,
  };
}

describe('Horizontal Frond 4 — Full-Stack Metadata Contract, Diff, Cache Patcher & Sort/Filter', () => {
  describe('1. Cleared Field Resurrection & Tombstone Preservation', () => {
    it('does not resurrect cleared top-level or extraFields keys from stale raw.metadata', () => {
      const raw = {
        id: 'item-resurrect-1',
        title: 'Clean Paper',
        doi: '',
        publicationTitle: null,
        extraFields: {
          volume: null,
        },
        metadata: {
          doi: '10.1000/stale-doi',
          publicationTitle: 'Stale Journal in Metadata',
          volume: '99',
          issue: '4',
        },
      };

      const { mapped, ef } = mergeRawItemPartials(raw);
      expect(mapped.doi).not.toBe('10.1000/stale-doi');
      expect(mapped.publicationTitle).not.toBe('Stale Journal in Metadata');
      expect(mapped.volume).toBeUndefined();
      expect(ef.volume).toBeNull();
      expect(mapped.issue).toBe('4');

      const mappedItem = mapBackendItem(raw);
      expect(mappedItem.doi || undefined).toBeUndefined();
      expect(mappedItem.publicationTitle || undefined).toBeUndefined();
      expect(mappedItem.volume || undefined).toBeUndefined();
      expect(mappedItem.issue).toBe('4');
    });

    it('preserves explicit empty creators when user clears all creators despite stale metadata.authors', () => {
      const raw = {
        id: 'item-empty-creators',
        title: 'Anonymous Document',
        creators: [],
        authors: [],
        metadata: {
          authors: ['Stale Author From Ingestion'],
          creators: [
            {
              creatorType: 'author',
              firstName: 'Stale',
              lastName: 'Author',
              fullName: 'Stale Author',
            },
          ],
        },
      };

      const mappedItem = mapBackendItem(raw);
      expect(mappedItem.authors).toEqual([]);
      expect(mappedItem.creators).toEqual([]);
      expect(mappedItem.contributors).toEqual([]);
    });

    it('getPublicationVenue respects cleared or tombstoned venue fields instead of falling back to stale metadata', () => {
      const itemWithClearedVenue = {
        id: 'item-venue-cleared',
        itemType: 'journalArticle',
        publicationTitle: '',
        extraFields: {
          publicationTitle: null,
          journal: null,
        },
        metadata: {
          publicationTitle: 'Resurrected Journal Title',
          journal: 'Resurrected Journal',
        },
      } as unknown as Item;

      expect(getPublicationVenue(itemWithClearedVenue)).toBe('');
    });

    it('mergeCachedItemWithPatch preserves null tombstones during optimistic patching and strips cleared identifiers', () => {
      const cached = makeBaseItem({
        doi: '10.1234/old.doi',
        publicationTitle: 'Old Venue',
        extraFields: {
          publicationTitle: 'Old Venue',
          volume: '12',
        },
        identifiers: [
          { type: 'doi', value: '10.1234/old.doi' },
          { type: 'isbn', value: '978-3-16-148410-0' },
        ],
        metadata: {
          publicationTitle: 'Old Venue',
          volume: '12',
          doi: '10.1234/old.doi',
        },
      });

      const optimisticMerged = mergeCachedItemWithPatch(
        cached,
        {
          doi: '',
          publicationTitle: '',
          extraFields: {
            publicationTitle: null,
            volume: null,
          } as unknown as Record<string, unknown>,
        },
      );

      expect(optimisticMerged.doi).toBe('');
      expect(
        (optimisticMerged.extraFields as Record<string, unknown>)?.publicationTitle,
      ).toBeNull();
      expect(
        (optimisticMerged.extraFields as Record<string, unknown>)?.volume,
      ).toBeNull();
      expect(optimisticMerged.identifiers).toEqual([
        { type: 'isbn', value: '978-3-16-148410-0' },
      ]);
      expect(getPublicationVenue(optimisticMerged)).toBe('');
    });
  });

  describe('2. Extra Field Deletion & Inspector Schema Descriptors', () => {
    it('buildExtraMetadataPatch sets null tombstones on extraFields and metadata when an extraFields-backed line is deleted from Extra', () => {
      const item = makeBaseItem({
        itemType: 'journalArticle',
        extra: 'PMID: 12345678\nPMCID: PMC8765432',
        extraFields: {
          pmid: '12345678',
          pmcid: 'PMC8765432',
        },
      });

      // User deletes the PMCID line from the Extra textarea
      const patch = buildExtraMetadataPatch(item, 'PMID: 12345678');
      const patchEf = patch.extraFields as Record<string, unknown>;
      const patchMeta = (patch as Record<string, unknown>).metadata as Record<
        string,
        unknown
      >;

      expect(patchEf.pmid).toBe('12345678');
      expect(patchEf.pmcid).toBeNull();
      expect(patchMeta.pmcid).toBeNull();
    });

    it('buildInspectorFieldPatch year descriptor parses 4-digit year as number | null and syncs date/publicationDate', () => {
      const item = makeBaseItem({
        year: 2021,
        date: '2021',
        publicationDate: '2021',
      });

      const updatePatch = buildInspectorFieldPatch(item, 'year', '2025');
      expect(updatePatch.year).toBe(2025);
      expect(updatePatch.date).toBe('2025');
      expect(updatePatch.publicationDate).toBe('2025');

      const clearPatch = buildInspectorFieldPatch(item, 'year', '');
      expect(clearPatch.year).toBeNull();
      expect(clearPatch.date).toBe('');
      expect(clearPatch.publicationDate).toBe('');
    });

    it('buildInspectorFieldPatch clears year to null when filingDate is cleared and no issueDate/publicationDate exists', () => {
      const patentItem = makeBaseItem({
        itemType: 'patent',
        year: 2022,
        filingDate: '2022-05-10',
        issueDate: undefined,
        publicationDate: undefined,
      });

      const patch = buildInspectorFieldPatch(patentItem, 'filingDate', '');
      expect(patch.filingDate).toBe('');
      expect(patch.year).toBeNull();
    });
  });

  describe('3. Duplicate Merge Diff, Master Selection, Creator Preservation & Undo Snapshot', () => {
    it('buildStructuredCreatorsFromAuthors preserves fieldMode: 1 for institutional creators', () => {
      const creators = buildStructuredCreatorsFromAuthors([
        'World Health Organization',
        'Ada Lovelace',
      ]);

      expect(creators).toHaveLength(2);
      expect(creators[0]).toMatchObject({
        creatorType: 'author',
        lastName: 'World Health Organization',
        fullName: 'World Health Organization',
        fieldMode: 1,
      });
      expect(creators[1]).toMatchObject({
        creatorType: 'author',
        firstName: 'Ada',
        lastName: 'Lovelace',
        fieldMode: 0,
      });
    });

    it('resolveDuplicateMergeFieldOverrides preserves non-author secondary creators from master and duplicates even when authors are not overridden', () => {
      const master = makeBaseItem({
        id: 'master-1',
        authors: ['Jane Doe'],
        creators: [
          {
            creatorType: 'author',
            firstName: 'Jane',
            lastName: 'Doe',
            fullName: 'Jane Doe',
            fieldMode: 0,
          },
          {
            creatorType: 'editor',
            firstName: 'Max',
            lastName: 'Perkins',
            fullName: 'Max Perkins',
            fieldMode: 0,
          },
        ],
      });

      const dup = makeBaseItem({
        id: 'dup-1',
        authors: ['Jane Doe'],
        creators: [
          {
            creatorType: 'author',
            firstName: 'Jane',
            lastName: 'Doe',
            fullName: 'Jane Doe',
            fieldMode: 0,
          },
          {
            creatorType: 'translator',
            firstName: 'Constance',
            lastName: 'Garnett',
            fullName: 'Constance Garnett',
            fieldMode: 0,
          },
        ],
      });

      // Case A: 'authors' is NOT in overrides — secondary translator from dup is still merged
      const overridesWithoutAuthors = resolveDuplicateMergeFieldOverrides(
        [master, dup],
        master.id,
        { abstract: 'Merged abstract' },
      );
      expect(overridesWithoutAuthors.creators).toBeDefined();
      const rolesA = (
        overridesWithoutAuthors.creators as Array<{ creatorType: string }>
      ).map((c) => c.creatorType);
      expect(rolesA).toContain('author');
      expect(rolesA).toContain('editor');
      expect(rolesA).toContain('translator');

      // Case B: 'authors' IS in overrides — both master editor and dup translator are preserved
      const overridesWithAuthors = resolveDuplicateMergeFieldOverrides(
        [master, dup],
        master.id,
        { authors: ['Jane M. Doe'] },
      );
      const rolesB = (
        overridesWithAuthors.creators as Array<{ creatorType: string }>
      ).map((c) => c.creatorType);
      expect(rolesB).toContain('author');
      expect(rolesB).toContain('editor');
      expect(rolesB).toContain('translator');
    });

    it('scoreTitleCandidate penalizes filename/placeholder/underscore titles to 1 and selectBestMasterItemId prefers real titles and type-specific fields', () => {
      const titleScorer = FIELD_CANDIDATE_SCORERS.title!;
      expect(titleScorer('2024_smith_final_draft.pdf')).toBe(1);
      expect(titleScorer('Untitled Document')).toBe(1);
      expect(titleScorer('a_b_c_d_paper')).toBe(1);
      expect(
        titleScorer('Attention Is All You Need: Transformer Architectures'),
      ).toBeGreaterThan(20);

      // Patent items with type-specific fields (patentNumber, assignee, issuingAuthority)
      const weakPatent = makeBaseItem({
        id: 'patent-weak',
        itemType: 'patent',
        title: 'scan_patent_001.pdf',
      });
      const richPatent = makeBaseItem({
        id: 'patent-rich',
        itemType: 'patent',
        title: 'Method and Apparatus for Distributed Consensus',
        patentNumber: 'US-11223344-B2',
        assignee: 'Acme Research Corp.',
        issuingAuthority: 'USPTO',
      });

      expect(selectBestMasterItemId([weakPatent, richPatent])).toBe('patent-rich');
    });

    it('createMergeDuplicatesCommand undo restores full schema fields via buildPreConversionSnapshot', async () => {
      const masterBefore = makeBaseItem({
        id: 'master-undo',
        itemType: 'patent',
        title: 'Original Patent Title',
        patentNumber: 'US-9999999',
        assignee: 'Original Lab',
        extra: 'Original Extra Line: 42',
        extraFields: {
          patentNumber: 'US-9999999',
          assignee: 'Original Lab',
        },
        creators: [
          {
            creatorType: 'inventor',
            firstName: 'Nikola',
            lastName: 'Tesla',
            fullName: 'Nikola Tesla',
            fieldMode: 0,
          },
        ],
      });

      const updateItemMutation = { mutateAsync: vi.fn().mockResolvedValue({}) };
      const mergeMutation = { mutateAsync: vi.fn().mockResolvedValue({}) };
      const restoreMutation = { mutateAsync: vi.fn().mockResolvedValue({}) };

      const cmd = createMergeDuplicatesCommand({
        primaryItem: masterBefore,
        duplicateIdsToDelete: ['dup-undo-1'],
        mergedFields: {
          title: 'Overridden Title',
          patentNumber: 'US-0000000',
        },
        mergeMutation,
        restoreMutation,
        updateItemMutation,
      });

      await cmd.execute();
      expect(mergeMutation.mutateAsync).toHaveBeenCalledTimes(1);

      await cmd.undo();
      expect(restoreMutation.mutateAsync).toHaveBeenCalledWith(['dup-undo-1']);
      expect(updateItemMutation.mutateAsync).toHaveBeenCalledTimes(1);
      const undoCall = updateItemMutation.mutateAsync.mock.calls[0][0];
      expect(undoCall.itemId).toBe('master-undo');
      expect(undoCall.data.title).toBe('Original Patent Title');
      expect(undoCall.data.patentNumber).toBe('US-9999999');
      expect(undoCall.data.assignee).toBe('Original Lab');
      expect(undoCall.data.extra).toBe('Original Extra Line: 42');
      expect(undoCall.data.creators).toEqual(masterBefore.creators);
    });
  });

  describe('4. Client-Side Sort & Unicode Filter Matching', () => {
    it('sortLibraryItems sorts institutional creators, unstructured fullName creators, caseName/nameOfAct titles, and fallback dates', () => {
      const items: Item[] = [
        makeBaseItem({
          id: 'item-smith-john',
          itemType: 'case',
          title: '',
          caseName: 'Roe v. Wade',
          year: undefined,
          publicationDate: '1973-01-22',
          creators: [
            {
              creatorType: 'author',
              fullName: 'John Smith',
            },
          ],
        }),
        makeBaseItem({
          id: 'item-smith-alice',
          itemType: 'statute',
          title: '',
          nameOfAct: 'Clean Air Act',
          year: undefined,
          date: '1963-12-17',
          creators: [
            {
              creatorType: 'author',
              firstName: 'Alice',
              lastName: 'Smith',
              fieldMode: 0,
            },
          ],
        }),
        makeBaseItem({
          id: 'item-who',
          itemType: 'report',
          title: 'Global Health Report',
          year: 2020,
          creators: [
            {
              creatorType: 'author',
              lastName: 'World Health Organization',
              fullName: 'World Health Organization',
              fieldMode: 1,
            },
          ],
        }),
      ];

      // Sort by authors ascending: Smith Alice < Smith John < World Health Organization
      const byAuthor = sortLibraryItems(items, 'authors', 'asc', false);
      expect(byAuthor.map((i) => i.id)).toEqual([
        'item-smith-alice',
        'item-smith-john',
        'item-who',
      ]);

      // Sort by title ascending using display title (Clean Air Act < Global Health Report < Roe v. Wade)
      const byTitle = sortLibraryItems(items, 'title', 'asc', false);
      expect(byTitle.map((i) => i.id)).toEqual([
        'item-smith-alice',
        'item-who',
        'item-smith-john',
      ]);

      // Sort by year ascending using fallback dates (1963 < 1973 < 2020)
      const byYear = sortLibraryItems(items, 'year', 'asc', false);
      expect(byYear.map((i) => i.id)).toEqual([
        'item-smith-alice',
        'item-smith-john',
        'item-who',
      ]);
    });

    it('normalizeSearchStr and calculateFilterMatchScore preserve non-Latin scripts (Greek, CJK, Cyrillic)', () => {
      expect(normalizeSearchStr('α-synuclein & β-sheet')).toBe(
        'α synuclein β sheet',
      );
      expect(normalizeSearchStr('深度学习 (Deep Learning)')).toBe(
        '深度学习 deep learning',
      );
      expect(normalizeSearchStr('Квантовая механика')).toBe(
        'квантовая механика',
      );

      expect(
        calculateFilterMatchScore(
          'Aggregation of α-synuclein in neural tissue',
          'α-synuclein',
        ).matches,
      ).toBe(true);
      expect(
        calculateFilterMatchScore(
          '基于Transformer的深度学习模型研究',
          '深度学习',
        ).matches,
      ).toBe(true);
      expect(
        calculateFilterMatchScore(
          'Aggregation of α-synuclein in neural tissue',
          '深度学习',
        ).matches,
      ).toBe(false);
    });
  });
});
