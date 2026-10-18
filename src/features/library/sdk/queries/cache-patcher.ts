import type { QueryClient } from '@tanstack/react-query';
import type { Item } from '@/features/library/domain/types/library.types';
import { itemKeys, invalidateCollections } from '@/features/library/sdk/query-keys';

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
 * Safely patch single item detail cache ({ item: Item, paper: Item } or Item)
 */
export function patchSingleItemCache<T>(oldData: T, patch: Partial<Item>): T {
  if (!oldData || typeof oldData !== 'object') return oldData;
  const old = oldData as Record<string, unknown>;
  if (old.item && typeof old.item === 'object') {
    const updated = { ...(old.item as Record<string, unknown>), ...patch };
    return {
      ...old,
      ...updated,
      item: updated,
      paper: updated,
    } as T;
  }
  return { ...old, ...patch } as T;
}

/**
 * Deterministically patches both the item detail cache and all active item list caches
 * within a given scopeId.
 */
export function patchItemAcrossScopeCaches(
  queryClient: QueryClient,
  scopeId: string,
  itemId: string,
  patch: Partial<Item>,
): void {
  const effectiveScope = scopeId || 'user';
  queryClient.setQueryData(
    itemKeys.byId(effectiveScope, itemId),
    (old: unknown) => patchSingleItemCache(old, patch),
  );
  queryClient.setQueriesData(
    { queryKey: ['library', 'items', effectiveScope] },
    (old) => patchItemInCacheData(old, itemId, patch),
  );
}

/**
 * Invalidates all item, trash, count, and collection queries for a library scope.
 */
export async function invalidateLibraryScopeCatalog(
  queryClient: QueryClient,
  scopeId: string,
): Promise<void> {
  const effectiveScope = scopeId || 'user';
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: itemKeys.all(effectiveScope) }),
    queryClient.invalidateQueries({ queryKey: itemKeys.trash(effectiveScope) }),
    invalidateCollections(queryClient, effectiveScope),
  ]);
}
