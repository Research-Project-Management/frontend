import { useCallback } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { prefetchLibraryCollection } from '@/features/shell/lib/navigation-prefetch';
import type { Item } from '@/features/library/domain/types/library.types';
import type { InvalidationClient } from '@/features/library/domain/types/batch-upload.types';
import {
  itemKeys,
  invalidateCollections,
  normalizeScopeId,
} from '@/features/library/sdk/query-keys';

export type { InvalidationClient };

/**
 * Helper to deduplicate and partition IDs into chunks of at most chunkSize (default 100).
 * Prevents exceeding URL/HTTP payload limits during batch operations.
 */
export function chunkUniqueIds(
  ids: readonly string[],
  chunkSize = 100,
): string[][] {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return [];
  const safeChunkSize = Math.max(1, chunkSize);
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += safeChunkSize) {
    chunks.push(unique.slice(i, i + safeChunkSize));
  }
  return chunks;
}

/**
 * Extracts a target Item from arbitrary TanStack Query cache data.
 * Supports:
 * 1. Detail envelope: { item: Item }
 * 2. Direct item: Item (record.id === itemId)
 * 3. Paginated list: { items: Item[] }
 * 4. InfiniteQuery pages: { pages: Array<{ items?: Item[] }> }
 * 5. Raw Item[] array
 */
export function extractItemFromCacheData(
  data: unknown,
  itemId: string,
): Item | undefined {
  if (!data || typeof data !== 'object' || !itemId) return undefined;

  // 1. Detail envelope: { item: Item }
  const record = data as Record<string, unknown>;
  if ('item' in record && record.item && typeof record.item === 'object') {
    const it = record.item as Item;
    if (it.id === itemId) return it;
  }

  // 2. Direct Item: { id: itemId, ... }
  if ('id' in record && record.id === itemId) {
    return record as unknown as Item;
  }

  // 3. Paginated list: { items: Item[] }
  if (Array.isArray(record.items)) {
    const found = (record.items as Item[]).find((it) => it && it.id === itemId);
    if (found) return found;
  }

  // 4. InfiniteQuery pages: { pages: Array<{ items?: Item[] }> }
  if (Array.isArray(record.pages)) {
    for (const page of record.pages as Array<{ items?: Item[] }>) {
      if (page && Array.isArray(page.items)) {
        const found = page.items.find((it) => it && it.id === itemId);
        if (found) return found;
      }
    }
  }

  // 5. Raw Item[] array
  if (Array.isArray(data)) {
    return (data as Item[]).find((it) => it && it.id === itemId);
  }

  return undefined;
}

/**
 * Safely patch an item inside TanStack Query cache across all formats:
 * - Paginated list: { items: Item[], ... }
 * - Infinite query: { pages: [{ items: Item[] }], pageParams: [] }
 * - Raw array: Item[]
 */
export function patchItemInCacheData(
  oldData: unknown,
  targetId: string,
  patchOrUpdater: Partial<Item> | ((item: Item) => Item),
): unknown {
  if (!oldData || typeof oldData !== 'object') return oldData;

  const patchItemsArray = (items: Item[]): Item[] => {
    const idx = items.findIndex((it) => it.id === targetId);
    if (idx === -1) return items; // Structural sharing: preserve reference when targetId is absent
    const current = items[idx];
    const updated =
      typeof patchOrUpdater === 'function'
        ? patchOrUpdater(current)
        : { ...current, ...patchOrUpdater };
    if (updated === current) return items;
    const next = items.slice();
    next[idx] = updated;
    return next;
  };

  const data = oldData as {
    items?: Item[];
    pages?: Array<{ items?: Item[] }>;
  };

  if (Array.isArray(data.items)) {
    const nextItems = patchItemsArray(data.items);
    if (nextItems === data.items) return oldData;
    return {
      ...data,
      items: nextItems,
    };
  }

  if (Array.isArray(data.pages)) {
    let anyPageMutated = false;
    const nextPages = data.pages.map((page) => {
      if (!page || !Array.isArray(page.items)) return page;
      const nextItems = patchItemsArray(page.items);
      if (nextItems === page.items) return page;
      anyPageMutated = true;
      return {
        ...page,
        items: nextItems,
      };
    });
    if (!anyPageMutated) return oldData;
    return {
      ...data,
      pages: nextPages,
    };
  }

  if (Array.isArray(oldData)) {
    return patchItemsArray(oldData as Item[]);
  }

  return oldData;
}

/**
 * Safely patch single item detail cache (Item or { item: Item })
 */
export function patchSingleItemCache<T>(
  oldData: T,
  patchOrUpdater: Partial<Item> | ((item: Item) => Item),
): T {
  if (!oldData || typeof oldData !== 'object') return oldData;
  const record = oldData as Record<string, unknown>;
  if ('item' in record && record.item && typeof record.item === 'object') {
    const currentItem = record.item as Item;
    const updatedItem =
      typeof patchOrUpdater === 'function'
        ? patchOrUpdater(currentItem)
        : { ...currentItem, ...patchOrUpdater };
    return {
      ...record,
      item: updatedItem,
    } as T;
  }
  const currentItem = record as unknown as Item;
  const updatedItem =
    typeof patchOrUpdater === 'function'
      ? patchOrUpdater(currentItem)
      : { ...currentItem, ...patchOrUpdater };
  return updatedItem as unknown as T;
}

/**
 * Deterministically patches both the item detail cache and all active item list caches
 * within a given scopeId.
 */
export function patchItemAcrossScopeCaches(
  queryClient: QueryClient,
  scopeId: string,
  itemId: string,
  patch: Partial<Item> | ((item: Item) => Item),
): void {
  const effectiveScope = normalizeScopeId(scopeId);
  queryClient.setQueryData(
    itemKeys.byId(effectiveScope, itemId),
    (old: unknown) => patchSingleItemCache(old, patch),
  );
  queryClient.setQueriesData(
    {
      queryKey: itemKeys.all(effectiveScope),
      predicate: (query) => query.queryKey[3] !== 'detail',
    },
    (old) => patchItemInCacheData(old, itemId, patch),
  );
}

/**
 * Safely remove one or more items from paginated/infinite/array list cache data.
 */
export function removeItemsFromCacheData(
  oldData: unknown,
  targetIds: ReadonlySet<string>,
): unknown {
  if (!oldData || typeof oldData !== 'object' || targetIds.size === 0) return oldData;

  const filterItemsArray = (items: Item[]): Item[] => {
    const next = items.filter((it) => !targetIds.has(it.id));
    return next.length === items.length ? items : next;
  };

  const data = oldData as {
    items?: Item[];
    total?: number;
    pages?: Array<{ items?: Item[] }>;
  };

  if (Array.isArray(data.items)) {
    const nextItems = filterItemsArray(data.items);
    if (nextItems === data.items) return oldData;
    const removedCount = data.items.length - nextItems.length;
    return {
      ...data,
      items: nextItems,
      ...(typeof data.total === 'number'
        ? { total: Math.max(0, data.total - removedCount) }
        : {}),
    };
  }

  if (Array.isArray(data.pages)) {
    let anyPageMutated = false;
    const nextPages = data.pages.map((page) => {
      if (!page || !Array.isArray(page.items)) return page;
      const nextItems = filterItemsArray(page.items);
      if (nextItems === page.items) return page;
      anyPageMutated = true;
      return {
        ...page,
        items: nextItems,
      };
    });
    if (!anyPageMutated) return oldData;
    return {
      ...data,
      pages: nextPages,
    };
  }

  if (Array.isArray(oldData)) {
    return filterItemsArray(oldData as Item[]);
  }

  return oldData;
}

/**
 * Deterministically removes deleted/purged items from both the item detail cache
 * and all active item list caches within a given scopeId.
 */
export function removeItemsFromScopeCaches(
  queryClient: QueryClient,
  scopeId: string,
  itemIds: string | string[],
): void {
  const effectiveScope = normalizeScopeId(scopeId);
  const ids = Array.isArray(itemIds) ? itemIds : [itemIds];
  const idSet = new Set(ids.filter(Boolean));
  if (idSet.size === 0) return;

  for (const id of idSet) {
    queryClient.setQueryData(itemKeys.byId(effectiveScope, id), null);
    queryClient.removeQueries({
      queryKey: itemKeys.byId(effectiveScope, id),
      exact: true,
    });
  }

  queryClient.setQueriesData(
    {
      queryKey: itemKeys.all(effectiveScope),
      predicate: (query) => query.queryKey[3] !== 'detail',
    },
    (old) => removeItemsFromCacheData(old, idSet),
  );
}

/**
 * Invalidates all item, trash, count, and collection queries for a library scope.
 */
export async function invalidateLibraryScopeCatalog(
  queryClient: InvalidationClient,
  scopeId: string,
): Promise<void> {
  const effectiveScope = normalizeScopeId(scopeId);
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: itemKeys.all(effectiveScope) }),
    queryClient.invalidateQueries({ queryKey: itemKeys.trash(effectiveScope) }),
    invalidateCollections(queryClient, effectiveScope),
  ]);
}

/**
 * Multi-tier synchronous cache lookup (direct byId cache -> list query scanning)
 * to resolve an item immediately without network flicker.
 */
export function resolveCachedItemFromScope(
  queryClient: QueryClient,
  scopeId: string,
  itemId?: string,
): Item | null {
  if (!itemId) return null;
  const effectiveScope = normalizeScopeId(scopeId);

  // 1. Direct byId query check
  const directCached = queryClient.getQueryData(itemKeys.byId(effectiveScope, itemId));
  const directFound = extractItemFromCacheData(directCached, itemId);
  if (directFound) return directFound;

  // 2. Scan all queries matching itemKeys.all(effectiveScope)
  const queries = queryClient.getQueriesData({
    queryKey: itemKeys.all(effectiveScope),
  });
  for (const [, data] of queries) {
    const found = extractItemFromCacheData(data, itemId);
    if (found) return found;
  }
  return null;
}

/**
 * Centralized React Hook for Library Cache Synchronization & Multi-Tier Resolution.
 * Eliminates scattered useQueryClient() + itemKeys.* calls across UI components.
 */
export function useLibraryCacheSynchronizer(defaultScopeId?: string) {
  const queryClient = useQueryClient();
  const baseScope = normalizeScopeId(defaultScopeId);

  const invalidateScopeItemsAndCounts = useCallback(
    async (overrideScopeId?: string, options?: { includeCollections?: boolean }) => {
      const scope = overrideScopeId ? normalizeScopeId(overrideScopeId) : baseScope;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: itemKeys.all(scope) }),
        queryClient.invalidateQueries({ queryKey: itemKeys.counts(scope) }),
        options?.includeCollections ? invalidateCollections(queryClient, scope) : Promise.resolve(),
      ]);
    },
    [queryClient, baseScope],
  );

  const invalidateItemById = useCallback(
    async (itemId: string, overrideScopeId?: string) => {
      const scope = overrideScopeId ? normalizeScopeId(overrideScopeId) : baseScope;
      await queryClient.invalidateQueries({ queryKey: itemKeys.byId(scope, itemId) });
    },
    [queryClient, baseScope],
  );

  const syncConvertedOrPatchedItem = useCallback(
    (itemId: string, updatedItem?: Item, overrideScopeId?: string) => {
      const scope = overrideScopeId ? normalizeScopeId(overrideScopeId) : baseScope;
      if (updatedItem?.id) {
        patchItemAcrossScopeCaches(queryClient, scope, updatedItem.id, updatedItem);
      }
      void queryClient.invalidateQueries({ queryKey: itemKeys.byId(scope, itemId) });
      void queryClient.invalidateQueries({ queryKey: itemKeys.all(scope) });
    },
    [queryClient, baseScope],
  );

  const resolveCachedItem = useCallback(
    (itemId?: string, overrideScopeId?: string) => {
      const scope = overrideScopeId ? normalizeScopeId(overrideScopeId) : baseScope;
      return resolveCachedItemFromScope(queryClient, scope, itemId);
    },
    [queryClient, baseScope],
  );

  const prefetchCollection = useCallback(
    (collectionId: string, overrideProjectId?: string | null) => {
      prefetchLibraryCollection(queryClient, overrideProjectId || undefined, collectionId);
    },
    [queryClient],
  );

  return {
    queryClient,
    invalidateScopeItemsAndCounts,
    invalidateItemById,
    syncConvertedOrPatchedItem,
    resolveCachedItem,
    prefetchCollection,
  };
}
