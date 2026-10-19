import type { QueryClient } from '@tanstack/react-query';
import type { Item } from '@/features/library/domain/types/library.types';
import type { InvalidationClient } from '@/features/library/domain/types/batch-upload.types';
import {
  itemKeys,
  invalidateCollections,
  normalizeScopeId,
} from '@/features/library/sdk/query-keys';

export type { InvalidationClient };

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
export function patchSingleItemCache<T>(oldData: T, patch: Partial<Item>): T {
  if (!oldData || typeof oldData !== 'object') return oldData;
  const record = oldData as Record<string, unknown>;
  if ('item' in record && record.item && typeof record.item === 'object') {
    return {
      ...record,
      item: { ...(record.item as Record<string, unknown>), ...patch },
    } as T;
  }
  return { ...record, ...patch } as T;
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
  const effectiveScope = normalizeScopeId(scopeId);
  queryClient.setQueryData(
    itemKeys.byId(effectiveScope, itemId),
    (old: unknown) => patchSingleItemCache(old, patch),
  );
  queryClient.setQueriesData(
    { queryKey: itemKeys.all(effectiveScope) },
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
    queryClient.removeQueries({
      queryKey: itemKeys.byId(effectiveScope, id),
      exact: true,
    });
  }

  queryClient.setQueriesData(
    { queryKey: itemKeys.all(effectiveScope) },
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
