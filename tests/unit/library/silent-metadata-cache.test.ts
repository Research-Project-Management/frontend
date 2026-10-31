import { describe, it, expect, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import {
  isMetadataOnlyPatch,
  doesPatchAffectMembership,
  MEMBERSHIP_MUTATION_KEYS,
  patchItemAcrossScopeCaches,
} from '@/features/library/sdk/queries/cache-patcher';
import { itemKeys } from '@/features/library/sdk/query-keys';
import type { Item } from '@/features/library/domain/types/library.types';

describe('Silent Metadata Auto-save & Cache Stability', () => {
  it('correctly classifies metadata-only patches as silent and non-membership affecting', () => {
    const metadataPatches = [
      { shortTitle: 'Attention Paper' },
      { title: 'Attention Is All You Need' },
      { pages: '1-15' },
      { doi: '10.1145/3065386' },
      { abstractNote: 'Transformers are cool' },
      { publicationTitle: 'NeurIPS' },
      { journalAbbr: 'ACM' },
      { volume: '30' },
      { issue: '2' },
      { year: 2017 },
      { date: '2017-06-12' },
      { extra: 'BibTeX note' },
      { language: 'en' },
      { authors: ['Vaswani, Ashish'] },
      { creators: [{ name: 'Vaswani, Ashish', creatorType: 'author' }] },
    ];

    for (const patch of metadataPatches) {
      expect(isMetadataOnlyPatch(patch)).toBe(true);
      expect(doesPatchAffectMembership(patch)).toBe(false);
    }
  });

  it('correctly identifies membership/state affecting patches', () => {
    const membershipPatches = [
      { isStarred: true },
      { deletedAt: new Date().toISOString() },
      { collectionId: 'col-123' },
      { collectionIds: ['col-1', 'col-2'] },
      { status: 'archived' },
      { tags: ['deep-learning'] },
    ];

    for (const patch of membershipPatches) {
      expect(isMetadataOnlyPatch(patch)).toBe(false);
      if ('tags' in patch) {
        expect(doesPatchAffectMembership(patch)).toBe(false);
      } else {
        expect(doesPatchAffectMembership(patch)).toBe(true);
      }
    }
  });

  it('verifies MEMBERSHIP_MUTATION_KEYS contains all critical lifecycle fields', () => {
    expect(MEMBERSHIP_MUTATION_KEYS.has('isStarred')).toBe(true);
    expect(MEMBERSHIP_MUTATION_KEYS.has('deletedAt')).toBe(true);
    expect(MEMBERSHIP_MUTATION_KEYS.has('status')).toBe(true);
    expect(MEMBERSHIP_MUTATION_KEYS.has('collectionId')).toBe(true);
    expect(MEMBERSHIP_MUTATION_KEYS.has('collectionIds')).toBe(true);
  });

  it('maintains table row position and does NOT invalidate list query when saving shortTitle/metadata', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const sampleItems: Item[] = [
      { id: 'item-1', title: 'Paper 1', version: 1 } as Item,
      { id: 'item-2', title: 'Paper 2', version: 1 } as Item,
      { id: 'item-10', title: 'ImageNet CNN', shortTitle: '', version: 1 } as Item,
    ];

    // Seed list cache
    const listKey = itemKeys.all('user');
    queryClient.setQueryData(listKey, { items: sampleItems, total: 3 });

    // Seed detail cache for item-10
    const detailKey = itemKeys.byId('user', 'item-10');
    queryClient.setQueryData(detailKey, sampleItems[2]);

    // Apply metadata-only patch (e.g. user editing Short Title in Inspector panel)
    patchItemAcrossScopeCaches(
      queryClient,
      'user',
      'item-10',
      { shortTitle: 'ImageNet', updatedAt: '2026-10-27T17:07:50Z' },
      { membershipPatch: { shortTitle: 'ImageNet' } },
    );

    // 1. invalidateQueries should NOT have been called for list query
    expect(invalidateSpy).not.toHaveBeenCalled();

    // 2. The item in the list cache should be updated IN-PLACE at index 2 (row 10)
    const updatedList = queryClient.getQueryData<{ items: Item[] }>(listKey);
    expect(updatedList?.items[2].id).toBe('item-10');
    expect(updatedList?.items[2].shortTitle).toBe('ImageNet');
    expect(updatedList?.items[0].id).toBe('item-1');
    expect(updatedList?.items[1].id).toBe('item-2');
  });

  it('invalidates list query when membership fields actually change', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const sampleItems: Item[] = [
      { id: 'item-1', title: 'Paper 1', isStarred: false, version: 1 } as Item,
    ];
    queryClient.setQueryData(itemKeys.all('user'), { items: sampleItems, total: 1 });
    queryClient.setQueryData(itemKeys.byId('user', 'item-1'), sampleItems[0]);

    // Star the item
    patchItemAcrossScopeCaches(
      queryClient,
      'user',
      'item-1',
      { isStarred: true },
      { membershipPatch: { isStarred: true } },
    );

    expect(invalidateSpy).toHaveBeenCalled();
  });
});
