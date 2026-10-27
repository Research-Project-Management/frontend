import { useCallback } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import {
  prefetchLibraryCollection,
  prefetchLibraryProjectScope,
} from '@/features/shell/lib/navigation-prefetch';
import type { Item } from '@/features/library/domain/types/library.types';
import type { InvalidationClient } from '@/features/library/domain/types/batch-upload.types';
import {
  itemKeys,
  tagKeys,
  savedSearchKeys,
  invalidateCollections,
  normalizeScopeId,
} from '@/features/library/sdk/query-keys';

export type { InvalidationClient };
export function chunkUniqueIds(ids: readonly string[], chunkSize = 100): string[][] {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return [];
  const safeChunkSize = Math.max(1, chunkSize);
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += safeChunkSize) {
    chunks.push(unique.slice(i, i + safeChunkSize));
  }
  return chunks;
}

export function extractItemFromCacheData(data: unknown, itemId: string): Item | undefined {
  if (!data || typeof data !== 'object' || !itemId) return undefined;
  const record = data as Record<string, unknown>;
  if ('item' in record && record.item && typeof record.item === 'object') {
    const it = record.item as Item;
    if (it.id === itemId) return it;
  }
  if ('id' in record && record.id === itemId) return record as unknown as Item;
  if (Array.isArray(record.items)) {
    const found = (record.items as Item[]).find((it) => it && it.id === itemId);
    if (found) return found;
  }
  if (Array.isArray(record.pages)) {
    for (const page of record.pages as Array<{ items?: Item[] }>) {
      if (page && Array.isArray(page.items)) {
        const found = page.items.find((it) => it && it.id === itemId);
        if (found) return found;
      }
    }
  }
  if (Array.isArray(data)) return (data as Item[]).find((it) => it && it.id === itemId);
  return undefined;
}

export function hasFullBackendItemFlag(patch?: Partial<Item> | Record<string, unknown> | null): boolean {
  return Boolean(
    patch &&
      typeof patch === "object" &&
      "_isFullBackendItem" in patch &&
      (patch as { _isFullBackendItem?: boolean })._isFullBackendItem === true,
  );
}

function stripNullOrUndefinedKeys(record?: Record<string, unknown> | null): Record<string, unknown> {
  if (!record || typeof record !== "object") return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(record)) {
    if (v !== null && v !== undefined) out[k] = v;
  }
  return out;
}

/**
 * Merges a partial item patch onto an existing cached Item while preserving user-state fields
 * (`isStarred`, `isFavorite`, `isRead`, `readStatus`, `rating`, `lastReadAt`) when `patch` came
 * from `mapBackendItem(raw)` without explicit user-state data (`_hasExplicitUserState === false`),
 * and cleanly merging `extraFields` and `metadata` (or replacing them on full backend responses).
 */
export function mergeCachedItemWithPatch(current: Item, patch: Partial<Item>): Item {
  const preserveUserState =
    "_hasExplicitUserState" in patch &&
    (patch as { _hasExplicitUserState?: boolean })._hasExplicitUserState === false;

  const isFullBackendReplace = hasFullBackendItemFlag(patch);

  const rawMergedExtraFields = isFullBackendReplace
    ? patch.extraFields && typeof patch.extraFields === "object"
      ? { ...patch.extraFields }
      : {}
    : patch.extraFields && typeof patch.extraFields === "object"
      ? {
          ...(current.extraFields && typeof current.extraFields === "object"
            ? current.extraFields
            : {}),
          ...patch.extraFields,
        }
      : current.extraFields;

  const mergedExtraFields =
    rawMergedExtraFields && typeof rawMergedExtraFields === "object"
      ? stripNullOrUndefinedKeys(rawMergedExtraFields as Record<string, unknown>)
      : rawMergedExtraFields;

  const rawMergedMetadata = isFullBackendReplace
    ? patch.metadata !== undefined
      ? patch.metadata
      : undefined
    : patch.metadata && typeof patch.metadata === "object"
      ? {
          ...(current.metadata && typeof current.metadata === "object"
            ? current.metadata
            : {}),
          ...patch.metadata,
        }
      : current.metadata;

  let mergedMetadata = rawMergedMetadata;
  if (mergedMetadata && typeof mergedMetadata === "object" && !Array.isArray(mergedMetadata)) {
    const cleanedMeta = stripNullOrUndefinedKeys(mergedMetadata as Record<string, unknown>);
    if (
      cleanedMeta.extraFields &&
      typeof cleanedMeta.extraFields === "object" &&
      !Array.isArray(cleanedMeta.extraFields)
    ) {
      cleanedMeta.extraFields = stripNullOrUndefinedKeys(
        cleanedMeta.extraFields as Record<string, unknown>,
      );
    }
    mergedMetadata = cleanedMeta;
  }

  const baseRecord: Item = isFullBackendReplace
    ? ({ ...patch, id: patch.id || current.id } as Item)
    : { ...current, ...patch };

  const mergedResult: Item = {
    ...baseRecord,
    ...(mergedExtraFields !== undefined ? { extraFields: mergedExtraFields } : {}),
    ...(mergedMetadata !== undefined ? { metadata: mergedMetadata } : {}),
    ...(preserveUserState
      ? {
          isStarred: current.isStarred ?? patch.isStarred ?? false,
          isFavorite: current.isFavorite ?? current.isStarred ?? patch.isFavorite ?? false,
          isRead: current.isRead ?? patch.isRead ?? false,
          readStatus: current.readStatus ?? patch.readStatus ?? "unread",
          rating: current.rating ?? patch.rating ?? 0,
          ...(current.lastReadAt !== undefined ? { lastReadAt: current.lastReadAt } : {}),
        }
      : {}),
  };

  if (
    hasFullBackendItemFlag(patch) ||
    hasFullBackendItemFlag(current as unknown as Record<string, unknown>)
  ) {
    Object.defineProperty(mergedResult, "_isFullBackendItem", {
      value: true,
      enumerable: false,
      configurable: true,
      writable: true,
    });
  }
  if ("_hasExplicitUserState" in patch) {
    Object.defineProperty(mergedResult, "_hasExplicitUserState", {
      value: Boolean((patch as { _hasExplicitUserState?: boolean })._hasExplicitUserState),
      enumerable: false,
      configurable: true,
      writable: true,
    });
  } else if ("_hasExplicitUserState" in current) {
    Object.defineProperty(mergedResult, "_hasExplicitUserState", {
      value: Boolean((current as { _hasExplicitUserState?: boolean })._hasExplicitUserState),
      enumerable: false,
      configurable: true,
      writable: true,
    });
  }

  return mergedResult;
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
        : mergeCachedItemWithPatch(current, patchOrUpdater);
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
        : mergeCachedItemWithPatch(currentItem, patchOrUpdater);
    return {
      ...record,
      item: updatedItem,
    } as T;
  }
  const currentItem = record as unknown as Item;
  const updatedItem =
    typeof patchOrUpdater === 'function'
      ? patchOrUpdater(currentItem)
      : mergeCachedItemWithPatch(currentItem, patchOrUpdater);
  return updatedItem as unknown as T;
}

function isTrashQueryKey(queryKey: readonly unknown[]): boolean {
  if (queryKey[2] === 'trash' || queryKey[3] === 'trash') return true;
  const params = queryKey[3];
  if (params && typeof params === 'object' && (params as { view?: unknown }).view === 'trash') {
    return true;
  }
  return false;
}

function doesItemMatchQueryFilter(
  item: Item,
  params: Record<string, unknown> | undefined,
): boolean {
  if (!params || typeof params !== 'object') return true;
  const view = typeof params.view === 'string' ? params.view : undefined;
  const starredParam = params.starred;
  const collectionId = typeof params.collectionId === 'string' ? params.collectionId : undefined;
  const unfiled = Boolean(params.unfiled) || view === 'unfiled';
  const isStarredFilter = Boolean(starredParam) || view === 'starred';
  const isMyPublicationsFilter = view === 'my-publications' || view === 'publications';
  const isRetractedFilter = view === 'retracted';

  if (item.deletedAt) {
    return view === 'trash';
  }
  if (view === 'trash') {
    return Boolean(item.deletedAt);
  }
  if (isStarredFilter && !(item.isStarred || item.isFavorite)) {
    return false;
  }
  if (unfiled && Array.isArray(item.collectionIds) && item.collectionIds.length > 0) {
    return false;
  }
  if (collectionId) {
    const colIds = Array.isArray(item.collectionIds) ? item.collectionIds : [];
    const singleColId = (item as { collectionId?: string }).collectionId;
    if (!colIds.includes(collectionId) && singleColId !== collectionId) {
      return false;
    }
  }
  if (isMyPublicationsFilter && !item.isMyPublication) {
    return false;
  }
  if (isRetractedFilter && !(item.isRetracted || item.retractionStatus === 'retracted')) {
    return false;
  }
  return true;
}

export const MEMBERSHIP_MUTATION_KEYS = new Set([
  'isStarred',
  'isFavorite',
  'deletedAt',
  'status',
  'collectionId',
  'collectionIds',
]);

export function doesPatchAffectMembership(patch?: Record<string, unknown> | null): boolean {
  if (!patch || typeof patch !== 'object') return false;
  for (const key of Object.keys(patch)) {
    if (MEMBERSHIP_MUTATION_KEYS.has(key)) return true;
  }
  return false;
}

export function isMetadataOnlyPatch(patch?: Record<string, unknown> | null): boolean {
  if (!patch || typeof patch !== 'object') return false;
  const keys = Object.keys(patch);
  if (keys.length === 0) return true;
  return !keys.some((k) => MEMBERSHIP_MUTATION_KEYS.has(k) || k === 'tags');
}

function hasMembershipFieldsChanged(
  oldItem: Item | null,
  updatedItem: Item,
  membershipPatch?: Record<string, unknown>,
): boolean {
  if (membershipPatch && !doesPatchAffectMembership(membershipPatch)) {
    return false;
  }
  if (!oldItem) return false;

  const oldStarred = Boolean(oldItem.isStarred || oldItem.isFavorite);
  const nextStarred = Boolean(updatedItem.isStarred || updatedItem.isFavorite);
  if (oldStarred !== nextStarred) {
    return true;
  }

  const oldDeleted = Boolean(oldItem.deletedAt);
  const nextDeleted = Boolean(updatedItem.deletedAt);
  if (oldDeleted !== nextDeleted) {
    return true;
  }

  const oldStatus = (oldItem as { status?: string }).status ?? null;
  const nextStatus = (updatedItem as { status?: string }).status ?? null;
  if (oldStatus !== nextStatus) {
    return true;
  }

  const oldColId = (oldItem as { collectionId?: string }).collectionId ?? null;
  const nextColId = (updatedItem as { collectionId?: string }).collectionId ?? null;
  if (oldColId !== nextColId) {
    return true;
  }

  const oldCols = Array.isArray(oldItem.collectionIds) ? oldItem.collectionIds : [];
  const nextCols = Array.isArray(updatedItem.collectionIds) ? updatedItem.collectionIds : [];
  if (oldCols.length !== nextCols.length) {
    return true;
  }
  const oldSet = new Set(oldCols);
  for (const c of nextCols) {
    if (!oldSet.has(c)) return true;
  }

  return false;
}

/**
 * Deterministically patches both the item detail cache and all active item list caches
 * within a given scopeId, while maintaining Trash and filtered list cache integrity.
 */
export function patchItemAcrossScopeCaches(
  queryClient: QueryClient,
  scopeId: string,
  itemId: string,
  patch: Partial<Item> | ((item: Item) => Item),
  options?: {
    membershipPatch?: Record<string, unknown>;
    forceSkipMembershipInvalidation?: boolean;
  },
): void {
  const effectiveScope = normalizeScopeId(scopeId);
  const oldItem = resolveCachedItemFromScope(queryClient, effectiveScope, itemId);
  const resolvedUpdatedItem: Item = oldItem
    ? typeof patch === 'function'
      ? patch(oldItem)
      : mergeCachedItemWithPatch(oldItem, patch)
    : typeof patch === 'function'
      ? patch({ id: itemId } as Item)
      : ({ id: itemId, ...patch } as Item);

  queryClient.setQueryData(
    itemKeys.byId(effectiveScope, itemId),
    (old: unknown) => patchSingleItemCache(old, patch),
  );

  const isActiveItem = !resolvedUpdatedItem.deletedAt;
  const isMetadataOnly = options?.membershipPatch
    ? isMetadataOnlyPatch(options.membershipPatch as Partial<Item>)
    : typeof patch === 'object' && patch !== null
      ? isMetadataOnlyPatch(patch as Partial<Item>)
      : false;

  const membershipChanged =
    !isMetadataOnly &&
    !options?.forceSkipMembershipInvalidation &&
    hasMembershipFieldsChanged(oldItem, resolvedUpdatedItem, options?.membershipPatch);
  const targetIdSet = new Set([itemId]);

  const listQueries = queryClient.getQueriesData({
    queryKey: itemKeys.all(effectiveScope),
    predicate: (query) => query.queryKey[3] !== 'detail',
  });

  for (const [queryKey, queryData] of listQueries) {
    if (queryData === undefined) continue;

    // 1. If item is active (!deletedAt) and this is a Trash cache, evict the restored item from Trash!
    if (isActiveItem && isTrashQueryKey(queryKey)) {
      const nextData = removeItemsFromCacheData(queryData, targetIdSet);
      if (nextData !== queryData) {
        queryClient.setQueryData(queryKey, nextData);
      }
      continue;
    }

    // 2. Check filtered list queries when membership-affecting fields changed
    const rawParams =
      queryKey[3] && typeof queryKey[3] === 'object'
        ? (queryKey[3] as Record<string, unknown>)
        : queryKey[2] === 'list' && queryKey[3] && typeof queryKey[3] === 'object'
          ? (queryKey[3] as Record<string, unknown>)
          : undefined;

    if (rawParams && !doesItemMatchQueryFilter(resolvedUpdatedItem, rawParams)) {
      const nextData = removeItemsFromCacheData(queryData, targetIdSet);
      if (nextData !== queryData) {
        queryClient.setQueryData(queryKey, nextData);
      }
      continue;
    }

    const nextData = patchItemInCacheData(queryData, itemId, patch);
    if (nextData !== queryData) {
      queryClient.setQueryData(queryKey, nextData);
    }
  }

  if (membershipChanged) {
    void queryClient.invalidateQueries({
      queryKey: itemKeys.all(effectiveScope),
      refetchType: 'active',
    });
  }
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
 * Soft-deleted items are NOT evicted from `itemKeys.trash(scopeId)`; instead,
 * the trash cache is invalidated so opening Trash displays newly deleted items.
 */
export function removeItemsFromScopeCaches(
  queryClient: QueryClient,
  scopeId: string,
  itemIds: string | string[],
  options?: { permanent?: boolean },
): void {
  const effectiveScope = normalizeScopeId(scopeId);
  const ids = Array.isArray(itemIds) ? itemIds : [itemIds];
  const idSet = new Set(ids.filter(Boolean));
  if (idSet.size === 0) return;

  for (const id of idSet) {
    queryClient.setQueryData(itemKeys.byId(effectiveScope, id), null);
    queryClient.removeQueries({ queryKey: itemKeys.byId(effectiveScope, id), exact: true });
  }

  queryClient.setQueriesData(
    {
      queryKey: itemKeys.all(effectiveScope),
      predicate: (query) =>
        query.queryKey[3] !== 'detail' &&
        (Boolean(options?.permanent) || !isTrashQueryKey(query.queryKey)),
    },
    (old) => removeItemsFromCacheData(old, idSet),
  );

  void queryClient.invalidateQueries({ queryKey: itemKeys.trash(effectiveScope) });
}

export const evictItemFromScopeCaches = removeItemsFromScopeCaches;

/**
 * Reusable post-mutation invalidation helper that normalizes scopeId and
 * invalidates requested catalog key families (item detail, items list, counts, collections, tags).
 */
export function invalidateLibraryCatalogDependencies(
  queryClient: InvalidationClient,
  scopeId?: string,
  options: {
    itemId?: string;
    collections?: boolean;
    smartCollections?: boolean;
    tags?: boolean;
    counts?: boolean;
    itemsList?: boolean;
  } = {},
): Promise<unknown[]> {
  const effectiveScope = normalizeScopeId(scopeId);
  const {
    itemId,
    collections = false,
    smartCollections = false,
    tags = false,
    counts = false,
    itemsList = true,
  } = options;

  const tasks: Array<Promise<unknown> | void> = [];
  if (itemId) tasks.push(queryClient.invalidateQueries({ queryKey: itemKeys.byId(effectiveScope, itemId) }));
  if (itemsList) tasks.push(queryClient.invalidateQueries({ queryKey: itemKeys.all(effectiveScope) }));
  if (counts && !collections) tasks.push(queryClient.invalidateQueries({ queryKey: itemKeys.counts(effectiveScope) }));
  if (collections) tasks.push(invalidateCollections(queryClient, effectiveScope));
  if (smartCollections) tasks.push(queryClient.invalidateQueries({ queryKey: savedSearchKeys.all(effectiveScope) }));
  if (tags) tasks.push(queryClient.invalidateQueries({ queryKey: tagKeys.list(effectiveScope) }));
  return Promise.all(tasks);
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

  const directCached = queryClient.getQueryData(itemKeys.byId(effectiveScope, itemId));
  const directFound = extractItemFromCacheData(directCached, itemId);
  if (directFound) return directFound;

  const queries = queryClient.getQueriesData({ queryKey: itemKeys.all(effectiveScope) });
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

  const prefetchProjectScope = useCallback(
    (projectId: string) => {
      prefetchLibraryProjectScope(queryClient, projectId);
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
    prefetchProjectScope,
  };
}
