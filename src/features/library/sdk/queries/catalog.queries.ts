'use client';

import { useRef, useEffect } from 'react';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { ItemsService, type ItemTypesResponse } from '../clients/items.client';
import { SearchService } from '../clients/catalog-entities.client';
import type {
  Item, Collection, CursorPaginationMeta, ItemQueryParams, SearchFacets,
} from '@/features/library/types/core.types';
import { updateLibrarySchemaRegistry } from '@/features/library/types/core.types';
import { ALL_ITEM_TYPES_FLAT } from '@/features/library/types/item-type-mappings.constants';
import { getDescendantCollectionIds } from '@/features/library/domain/collection-tree.domain';
import {
  itemKeys, libraryKeys, collectionKeys, tagKeys, noteKeys, savedSearchKeys, relationKeys, feedKeys,
  invalidateCollections, normalizeScopeId, prepareBootstrapScope, registerBootstrapPromise, waitForBootstrapCache,
  getReaderBootstrapScope, notifyServerFeedsHydrated,
} from '@/features/library/sdk/query-keys';
import { mapServerFeedSubscriptions } from '@/features/library/domain/feed-parser.domain';
import {
  resolveCachedItemVersion, useUpdateLibraryItemMutation, useToggleStarItemMutation,
  useImportFromUserMutation, useCreateLibraryItemMutation, useReResolveItemMetadataMutation,
  useSetMyPublicationMutation,
} from './item-mutations.queries';
import {
  chunkUniqueIds, extractItemFromCacheData, mergeCachedItemWithPatch, patchItemInCacheData,
  patchSingleItemCache, patchItemAcrossScopeCaches, removeItemsFromCacheData, removeItemsFromScopeCaches,
  invalidateLibraryCatalogDependencies, invalidateLibraryScopeCatalog, resolveCachedItemFromScope,
  useLibraryCacheSynchronizer,
} from './cache-patcher.queries';

export {
  type ItemTypesResponse,
  itemKeys, collectionKeys, tagKeys, noteKeys, savedSearchKeys, relationKeys, invalidateCollections,
  normalizeScopeId,
  chunkUniqueIds, extractItemFromCacheData, mergeCachedItemWithPatch, patchItemInCacheData,
  patchSingleItemCache, patchItemAcrossScopeCaches, removeItemsFromCacheData, removeItemsFromScopeCaches,
  invalidateLibraryCatalogDependencies, invalidateLibraryScopeCatalog, resolveCachedItemFromScope,
  useLibraryCacheSynchronizer,
};

export function fetchLibraryItemById(scopeId: string | undefined, itemId: string) {
  return ItemsService.getById(scopeId, itemId);
}

function derivePlaceholderItems(
  queryClient: QueryClient,
  targetScope: string | undefined,
  params: ItemQueryParams | undefined,
): LibraryItemsQueryResult | undefined {
  if (params?.search || params?.view === 'trash') return undefined;

  const listQueries = queryClient.getQueriesData<LibraryItemsQueryResult>({
    queryKey: itemKeys.all(targetScope),
  });
  for (const [key, listData] of listQueries) {
    if (!Array.isArray(listData?.items)) continue;
    const keyParams = Array.isArray(key) ? (key[3] as ItemQueryParams | undefined) : undefined;
    if (keyParams?.collectionId || keyParams?.view || keyParams?.search) continue;

    let filtered: Item[] | undefined;
    if (params?.collectionId) {
      const includeSub = params.includeSubcollections !== false;
      const cachedColsData = queryClient.getQueryData<Collection[] | { collections?: Collection[] }>(
        collectionKeys.all(targetScope),
      );
      const cachedCols = Array.isArray(cachedColsData) ? cachedColsData : (cachedColsData?.collections ?? []);
      const targetColIds = new Set(
        includeSub && cachedCols.length > 0
          ? getDescendantCollectionIds(cachedCols, params.collectionId)
          : [params.collectionId],
      );
      filtered = listData.items.filter((it) => it.collectionIds?.some((cid) => targetColIds.has(cid)));
    } else if (params?.view === 'starred') {
      filtered = listData.items.filter((it) => Boolean(it.isStarred));
    } else if (params?.view === 'unfiled') {
      filtered = listData.items.filter((it) => !it.collectionIds || it.collectionIds.length === 0);
    } else if (!params?.collectionId && !params?.view) {
      filtered = listData.items;
    }

    if (filtered && listData.hasNextPage === false) {
      return {
        items: filtered,
        total: filtered.length,
        meta: null,
        hasNextPage: false,
        nextCursor: null,
      };
    }
  }
  return undefined;
}

// ITEMS QUERY HOOKS

export function useLibraryBootstrapQuery(
  scopeId?: string,
  itemParams?: ItemQueryParams,
  options?: { enabled?: boolean; includeItems?: boolean },
) {
  const queryClient = useQueryClient();
  const targetScope = normalizeScopeId(scopeId);
  const includeItems = options?.includeItems ?? true;
  const isEnabled = options?.enabled ?? true;

  const initialSeedRef = useRef<{
    scope: string;
    params?: ItemQueryParams;
    includeItems: boolean;
  }>({
    scope: targetScope,
    params: itemParams,
    includeItems,
  });

  const bootstrapKey = libraryKeys.bootstrap(targetScope, {
    includeItems:
      initialSeedRef.current.scope === targetScope
        ? initialSeedRef.current.includeItems
        : includeItems,
  });
  const hasCachedBootstrap =
    queryClient.getQueryData(bootstrapKey) !== undefined;

  if (initialSeedRef.current.scope !== targetScope || !hasCachedBootstrap) {
    initialSeedRef.current = {
      scope: targetScope,
      params: itemParams,
      includeItems,
    };
  }
  const seedParams = initialSeedRef.current.params;
  const seedIncludeItems = initialSeedRef.current.includeItems;
  const effectiveBootstrapKey = libraryKeys.bootstrap(targetScope, {
    includeItems: seedIncludeItems,
  });

  if (isEnabled && queryClient.getQueryData(effectiveBootstrapKey) === undefined) {
    prepareBootstrapScope(queryClient, targetScope);
  }

  return useQuery({
    queryKey: effectiveBootstrapKey,
    enabled: isEnabled,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    queryFn: ({ signal }) =>
      registerBootstrapPromise(
        queryClient,
        targetScope,
        (async () => {
          const res = await ItemsService.getBootstrap(
            targetScope,
            {
              ...(seedIncludeItems ? seedParams : {}),
              includeItems: seedIncludeItems,
            },
            { signal },
          );
          if (!res || typeof res !== 'object') return res;

          if (res.counts) {
            queryClient.setQueryData(itemKeys.counts(targetScope), res.counts);
          }
          if (Array.isArray(res.collections)) {
            queryClient.setQueryData(collectionKeys.all(targetScope), res.collections);
          }
          if (Array.isArray(res.savedSearches)) {
            queryClient.setQueryData(savedSearchKeys.all(targetScope), res.savedSearches);
          }
          if (Array.isArray(res.tags)) {
            queryClient.setQueryData(tagKeys.list(targetScope), res.tags);
          }
          if (res.itemTypes && typeof res.itemTypes === 'object') {
            updateLibrarySchemaRegistry(res.itemTypes);
            queryClient.setQueryData(itemKeys.types(targetScope), res.itemTypes);
            if (targetScope !== 'user') {
              queryClient.setQueryData(itemKeys.types('user'), res.itemTypes);
            }
          }
          if (res.syncVersion && typeof res.syncVersion === 'object') {
            const incomingVersion = String(res.syncVersion.version ?? '0');
            const existingSync = queryClient.getQueryData<{ version?: string }>(
              libraryKeys.syncVersion(targetScope),
            );
            const existingVersion = String(existingSync?.version ?? '0');
            const shouldAdvance =
              !existingSync?.version ||
              existingVersion === '0' ||
              (/^\d+$/.test(existingVersion) &&
                /^\d+$/.test(incomingVersion) &&
                BigInt(incomingVersion) >= BigInt(existingVersion));
            if (shouldAdvance) {
              queryClient.setQueryData(libraryKeys.syncVersion(targetScope), {
                version: incomingVersion,
                scopeId: targetScope,
                syncedCount: 0,
              });
            }
          }
          if (targetScope === 'user' && Array.isArray(res.feedSubscriptions)) {
            const mappedFeeds = mapServerFeedSubscriptions(res.feedSubscriptions);
            notifyServerFeedsHydrated(mappedFeeds);
            queryClient.setQueryData(feedKeys.subscriptions(), mappedFeeds);
          }
          if (seedIncludeItems && Array.isArray(res.items)) {
            const items: Item[] = res.items;
            const meta = (res.meta || res.pagination || null) as CursorPaginationMeta | null;
            const total = meta?.totalCount ?? items.length;
            const hasNextPage = Boolean(meta?.hasNextPage);
            const nextCursor = meta?.nextCursor || meta?.cursor || null;
            queryClient.setQueryData<LibraryItemsQueryResult>(
              libraryKeys.items(targetScope, seedParams),
              {
                items,
                total,
                meta,
                hasNextPage,
                nextCursor,
              },
            );
            if (seedParams?.view === 'trash' && !seedParams?.search) {
              queryClient.setQueryData(itemKeys.trash(targetScope), {
                items,
                meta,
                pagination: meta,
              });
            }
          }

          return res;
        })(),
      ),
  });
}

export function useLibraryCountsQuery(
  scopeId?: string,
  options?: { enabled?: boolean },
) {
  const queryClient = useQueryClient();
  const targetScope = normalizeScopeId(scopeId);
  const cacheKey = itemKeys.counts(targetScope);
  return useQuery({
    queryKey: cacheKey,
    queryFn: async () => {
      const seeded =
        (await waitForBootstrapCache<Awaited<ReturnType<typeof ItemsService.getCounts>>>(
          queryClient,
          targetScope,
          cacheKey,
        )) ??
        (await waitForBootstrapCache<Awaited<ReturnType<typeof ItemsService.getCounts>>>(
          queryClient,
          getReaderBootstrapScope(targetScope),
          cacheKey,
        ));
      if (seeded !== undefined) return seeded;
      return ItemsService.getCounts(targetScope);
    },
    enabled: options?.enabled ?? true,
    staleTime: 1000 * 60,
  });
}

const EMPTY_VIEW_ITEMS: Item[] = [];

function selectViewItemsPayload(data: { items?: Item[]; meta?: CursorPaginationMeta | null; total?: number } | null | undefined) {
  const items: Item[] = data?.items && data.items.length > 0 ? data.items : EMPTY_VIEW_ITEMS;
  const meta = (data?.meta || null) as CursorPaginationMeta | null;
  const total: number =
    meta?.totalCount ??
    data?.total ??
    items.length;
  return { items, meta, total, hasNextPage: meta?.hasNextPage ?? false, nextCursor: meta?.cursor };
}

export function useViewItems(
  scopeId?: string,
  view: 'all' | 'recent' | 'unfiled' | 'trash' | 'my-publications' | 'publications' = 'all',
  searchOrOptions?:
    | string
    | {
        search?: string;
        collectionId?: string;
        checkInProjectId?: string;
        enabled?: boolean;
        limit?: number;
      },
  options?: { enabled?: boolean; limit?: number },
) {
  const targetScope = normalizeScopeId(scopeId);
  const search = typeof searchOrOptions === 'string' ? searchOrOptions : searchOrOptions?.search;
  const collectionId = typeof searchOrOptions === 'object' ? searchOrOptions?.collectionId : undefined;
  const checkInProjectId =
    typeof searchOrOptions === 'object' ? searchOrOptions?.checkInProjectId : undefined;
  const enabled =
    (typeof searchOrOptions === 'object' ? searchOrOptions?.enabled : options?.enabled) ?? true;
  const limit =
    typeof searchOrOptions === 'object' ? searchOrOptions?.limit : options?.limit;
  const extraKeyMeta =
    collectionId || checkInProjectId
      ? {
          ...(collectionId ? { collectionId } : {}),
          ...(checkInProjectId ? { checkInProjectId } : {}),
        }
      : undefined;
  const trimmedSearch = search?.trim() || undefined;
  const shouldUseDedicatedSearchEngine =
    Boolean(trimmedSearch) &&
    !checkInProjectId &&
    view !== 'trash' &&
    view !== 'recent';

  return useQuery({
    queryKey: extraKeyMeta
      ? [...itemKeys.byView(targetScope, view, search), extraKeyMeta]
      : itemKeys.byView(targetScope, view, search),
    queryFn: async ({ signal }) => {
      if (shouldUseDedicatedSearchEngine && trimmedSearch) {
        const mappedView =
          view === 'publications' ? 'my-publications' : view;
        const searchResponse = await SearchService.search(
          {
            query: trimmedSearch,
            view: mappedView,
            ...(collectionId ? { collectionId } : {}),
            ...(limit ? { limit } : {}),
            includeFacets: false,
          },
          targetScope,
          { signal },
        );
        const hasNextPage = Boolean(searchResponse.meta?.hasNextPage);
        const nextCursor =
          searchResponse.nextCursor ?? searchResponse.meta?.cursor ?? null;
        const resolvedTotal =
          searchResponse.meta?.totalCount ??
          searchResponse.total ??
          searchResponse.items.length;
        return {
          items: searchResponse.items,
          total: resolvedTotal,
          meta: {
            totalCount: resolvedTotal,
            hasNextPage,
            cursor: nextCursor,
            nextCursor,
          } satisfies CursorPaginationMeta,
        };
      }

      return ItemsService.getAll(
        targetScope,
        {
          view,
          search: trimmedSearch,
          ...(collectionId ? { collectionId } : {}),
          ...(checkInProjectId ? { checkInProjectId } : {}),
          ...(limit ? { limit } : {}),
        },
        { signal },
      );
    },
    enabled,
    gcTime: 5 * 60 * 1000,
    placeholderData: (previousData) => previousData,
    select: selectViewItemsPayload,
  });
}

interface UseItemsOptions {
  projectId?: string;
  scopeId?: string;
  collectionId?: string;
  itemId?: string;
  limit?: number;
  enabled?: boolean;
}

export function useItems(optionsOrScope: string | UseItemsOptions = {}) {
  const options = typeof optionsOrScope === 'string' ? { scopeId: optionsOrScope } : optionsOrScope;
  const { scopeId, projectId, collectionId, itemId, limit } = options;
  const targetScope = normalizeScopeId(scopeId || projectId);
  const activeItemId = itemId || '';
  const effectiveLimit = limit ?? 200;

  const shouldFetchAllByDefault = !activeItemId && !collectionId;
  const allItemsQuery = useQuery({
    queryKey: [...itemKeys.all(targetScope), 'legacy-all', { limit: effectiveLimit }] as const,
    queryFn: ({ signal }) =>
      ItemsService.getAll(targetScope, { limit: effectiveLimit }, { signal }),
    enabled: options.enabled ?? shouldFetchAllByDefault,
    gcTime: 5 * 60 * 1000,
    select: (data) => {
      if (!data) return { items: [] as Item[], meta: null, hasNextPage: false };
      const items: Item[] = data.items || [];
      const meta = (data.meta || null) as CursorPaginationMeta | null;
      return { items, meta, hasNextPage: Boolean(meta?.hasNextPage) };
    },
  });

  const itemByIdQuery = useQuery({
    queryKey: itemKeys.byId(targetScope, activeItemId),
    queryFn: () => ItemsService.getById(targetScope, activeItemId),
    enabled: (options.enabled ?? true) && Boolean(activeItemId),
    gcTime: 5 * 60 * 1000,
  });

  const collectionItemsQuery = useQuery({
    queryKey: itemKeys.byCollection(targetScope, collectionId || ''),
    queryFn: () => ItemsService.getByCollection(targetScope, collectionId || ''),
    enabled: (options.enabled ?? true) && Boolean(collectionId),
    gcTime: 5 * 60 * 1000,
    select: (data) => (data?.items || []) as Item[],
  });

  return {
    items: (allItemsQuery.data?.items || []) as Item[],
    meta: allItemsQuery.data?.meta || null,
    item: (itemByIdQuery.data || null) as Item | null,
    collectionItems: (collectionItemsQuery.data || []) as Item[],
    isLoading:
      allItemsQuery.isLoading ||
      itemByIdQuery.isLoading ||
      collectionItemsQuery.isLoading,
    isLoadingAll: allItemsQuery.isLoading,
    isLoadingCollection: collectionItemsQuery.isLoading,
    isError:
      allItemsQuery.isError ||
      itemByIdQuery.isError ||
      collectionItemsQuery.isError,
    error:
      allItemsQuery.error ||
      itemByIdQuery.error ||
      collectionItemsQuery.error,
    refetch: allItemsQuery.refetch,
  };
}

export function useItemTypes(
  scopeIdOrOptions?: string | { scopeId?: string; projectId?: string; enabled?: boolean },
) {
  const rawSid =
    typeof scopeIdOrOptions === 'string'
      ? scopeIdOrOptions
      : (scopeIdOrOptions?.scopeId || scopeIdOrOptions?.projectId || 'user');
  const sid = normalizeScopeId(rawSid);
  const enabled =
    typeof scopeIdOrOptions === 'object' ? (scopeIdOrOptions?.enabled ?? true) : true;

  const queryClient = useQueryClient();
  const cacheKey = itemKeys.types(sid);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: cacheKey,
    queryFn: async () => {
      const seeded = await waitForBootstrapCache<ItemTypesResponse>(queryClient, sid, cacheKey);
      if (seeded !== undefined) return seeded;
      const res = await ItemsService.getItemTypes(sid);
      if (res) {
        updateLibrarySchemaRegistry(res);
      }
      return res;
    },
    enabled,
    staleTime: 1000 * 60 * 60,
  });

  const rawTypes = Array.isArray(data)
    ? data
    : ((data as ItemTypesResponse | undefined)?.itemTypes ||
        (data as ItemTypesResponse | undefined)?.data ||
        []);

  // Architectural Separation:
  // - Backend is the Single Source of Truth for item types.
  // - Frontend only activates static ALL_ITEM_TYPES_FLAT fallback when Backend query fails (isError).
  const isFallback = Boolean(isError && rawTypes.length === 0);
  const types = rawTypes.length > 0
    ? rawTypes
    : isFallback
      ? ALL_ITEM_TYPES_FLAT.map((t) => ({
          itemType: t.value,
          label: t.label,
          isBibliographic: true,
        }))
      : [];

  return {
    types,
    isLoading,
    isError,
    error,
  };
}

interface LibraryItemsQueryResult {
  items: Item[];
  total: number;
  meta: CursorPaginationMeta | null;
  hasNextPage: boolean;
  nextCursor?: string | null;
  facets?: SearchFacets;
}

export function useLibrarySearchFacetsQuery(
  scopeId?: string,
  searchQuery?: string,
  collectionId?: string,
  searchMode?: 'title_creator_year' | 'fields_tags' | 'everything',
) {
  const targetScope = normalizeScopeId(scopeId);
  const trimmedSearch = (searchQuery ?? '').trim();
  const effectiveSearchMode = searchMode || 'everything';
  const facetKey = libraryKeys.searchFacets(targetScope, {
    q: trimmedSearch,
    collectionId: collectionId || '',
    searchMode: effectiveSearchMode,
  });
  return useQuery<SearchFacets | null>({
    queryKey: facetKey,
    enabled: trimmedSearch.length > 0,
    staleTime: 1000 * 60,
    gcTime: 5 * 60 * 1000,
    queryFn: async ({ signal }) => {
      const res = await SearchService.search(
        {
          query: trimmedSearch,
          searchMode: effectiveSearchMode,
          collectionId,
          limit: 1,
          includeFacets: true,
        },
        targetScope,
        { signal },
      );
      return res?.facets ?? null;
    },
  });
}

export function useLibraryItemsQuery(
  scopeId?: string,
  params?: ItemQueryParams,
  options?: { enabled?: boolean },
) {
  const queryClient = useQueryClient();
  const targetScope = normalizeScopeId(scopeId);
  const cacheKey = libraryKeys.items(targetScope, params);
  return useQuery({
    queryKey: cacheKey,
    enabled: options?.enabled ?? true,
    queryFn: async ({ signal }): Promise<LibraryItemsQueryResult> => {
      const seeded = await waitForBootstrapCache<LibraryItemsQueryResult>(
        queryClient,
        targetScope,
        cacheKey,
      );
      if (seeded !== undefined) return seeded;

      const trimmedSearch = params?.search?.trim() || '';
      const shouldUseFtsSearch =
        trimmedSearch.length > 0 &&
        params?.view !== 'trash' &&
        params?.view !== 'recent' &&
        !params?.checkInProjectId &&
        !params?.smartFilter;

      if (shouldUseFtsSearch) {
        try {
          const rawParams = params as Record<string, unknown> | undefined;
          const effectiveItemType =
            params?.itemType ?? (rawParams?.type as string | undefined);
          const effectiveSortBy =
            params?.sortBy ?? (rawParams?.orderBy as string | undefined);
          const effectiveSortOrder =
            params?.sortOrder ??
            (rawParams?.orderDirection as 'asc' | 'desc' | undefined);

          const searchRes = await SearchService.search(
            {
              query: trimmedSearch,
              searchMode: params?.searchMode,
              view: params?.view,
              collectionId: params?.collectionId,
              includeSubcollections: params?.includeSubcollections,
              tag: params?.tag,
              itemType: effectiveItemType,
              yearFrom: params?.fromYear,
              yearTo: params?.toYear,
              hasFile: params?.hasFile,
              hasNotes: params?.hasNotes,
              readStatus: params?.readStatus,
              sortBy: effectiveSortBy,
              sortOrder: effectiveSortOrder, page: params?.page, limit: params?.limit, cursor: params?.cursor, includeFacets: true,
            },
            targetScope,
            { signal },
          );
          const items: Item[] = searchRes?.items || [];
          const meta = (searchRes?.meta || null) as CursorPaginationMeta | null;
          const total = meta?.totalCount ?? searchRes?.total ?? items.length;
          const hasNextPage = Boolean(meta?.hasNextPage);
          const nextCursor = searchRes?.nextCursor || meta?.cursor || null;

          if (searchRes?.facets) {
            queryClient.setQueryData(
              libraryKeys.searchFacets(targetScope, {
                q: trimmedSearch,
                collectionId: params?.collectionId || '',
                searchMode: params?.searchMode || 'everything',
              }),
              searchRes.facets,
            );
          }

          return { items, total, meta, hasNextPage, nextCursor, facets: searchRes?.facets };
        } catch {
          // Graceful fallback to catalog ItemsService.getAll if /search endpoint is unreachable
        }
      }

      const res = await ItemsService.getAll(targetScope, params, { signal });
      const items: Item[] = res?.items || [];
      const meta = (res?.meta || null) as CursorPaginationMeta | null;
      const hasNextPage = Boolean(meta?.hasNextPage);
      const nextCursor = meta?.nextCursor || meta?.cursor || null;

      let resolvedTotal = meta?.totalCount;
      if (typeof resolvedTotal !== 'number' && (params?.page ?? 1) > 1) {
        const page1Cache = queryClient.getQueryData<LibraryItemsQueryResult>(
          libraryKeys.items(targetScope, { ...params, page: 1 }),
        );
        if (typeof page1Cache?.total === 'number' && page1Cache.total > 0) {
          resolvedTotal = page1Cache.total;
        }
      }
      const currentPage = params?.page ?? 1;
      const currentLimit = params?.limit ?? 200;
      const minKnownCount = hasNextPage
        ? currentPage * currentLimit + 1
        : (currentPage - 1) * currentLimit + items.length;
      const total = Math.max(resolvedTotal ?? res?.total ?? items.length, minKnownCount);

      return { items, total, meta, hasNextPage, nextCursor };
    },
    placeholderData: (previousData) =>
      previousData ?? derivePlaceholderItems(queryClient, targetScope, params),
    staleTime: 1000 * 30,
    gcTime: 5 * 60 * 1000,
  });
}

export function usePrefetchNextLibraryItemsPage(options: {
  scopeId?: string;
  queryParams?: ItemQueryParams;
  activePage: number;
  baseTotalCount: number;
  enabled: boolean;
}) {
  const queryClient = useQueryClient();
  const { scopeId, queryParams, activePage, baseTotalCount, enabled } = options;
  useEffect(() => {
    if (!enabled) return;
    const targetScope = normalizeScopeId(scopeId);
    const nextParams = { ...queryParams, page: activePage + 1 };
    void queryClient.prefetchQuery({
      queryKey: libraryKeys.items(targetScope, nextParams),
      queryFn: async ({ signal }) => {
        const res = await ItemsService.getAll(targetScope, nextParams, { signal });
        const nextItems: Item[] = res?.items || [];
        const meta = res?.meta || null;
        return {
          items: nextItems, total: Math.max(baseTotalCount, nextItems.length),
          meta, hasNextPage: Boolean(meta?.hasNextPage), nextCursor: meta?.nextCursor || meta?.cursor || null,
        };
      },
      staleTime: 30_000,
    });
  }, [enabled, scopeId, queryParams, activePage, baseTotalCount, queryClient]);
}

export function useLibraryItemDetailQuery(
  scopeId: string | undefined, itemId: string | undefined, options?: { enabled?: boolean },
) {
  const targetScope = normalizeScopeId(scopeId);
  return useQuery<Item>({
    queryKey: itemKeys.byId(targetScope, itemId || ''),
    queryFn: () => ItemsService.getById(targetScope, itemId || ''),
    enabled: Boolean(itemId) && (options?.enabled ?? true),
    staleTime: 60_000,
  });
}

export {
  resolveCachedItemVersion, useUpdateLibraryItemMutation, useToggleStarItemMutation,
  useImportFromUserMutation, useCreateLibraryItemMutation, useReResolveItemMetadataMutation,
  useSetMyPublicationMutation,
};
export {
  useDeleteLibraryItemsMutation, useBatchRestoreItemsMutation, useBatchPurgeItemsMutation,
} from './tags-notes.queries';
