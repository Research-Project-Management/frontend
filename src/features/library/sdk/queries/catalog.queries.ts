'use client';

import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useLibraryCommandStore } from '@/features/library/core/manager/library-command.manager';
import {
  ItemsService,
  CollectionsService,
  StateService,
  SyncService,
  type ItemTypesResponse,
} from '../library.client';
import type {
  Item,
  CreateItemDTO,
  UpdateItemDTO,
  CursorPaginationMeta,
  ItemQueryParams,
} from '@/features/library/domain/types/library.types';
import { updateLibrarySchemaRegistry } from '@/features/library/domain/types/library.types';
import {
  itemKeys,
  libraryKeys,
  collectionKeys,
  tagKeys,
  noteKeys,
  savedSearchKeys,
  relationKeys,
  invalidateCollections,
  normalizeScopeId,
} from '@/features/library/sdk/query-keys';

export {
  itemKeys,
  collectionKeys,
  tagKeys,
  noteKeys,
  savedSearchKeys,
  relationKeys,
  invalidateCollections,
};

import {
  resolveCachedItemVersion,
  useUpdateLibraryItemMutation,
  useToggleStarItemMutation,
  useImportFromUserMutation,
  useCreateLibraryItemMutation,
} from './item-mutations.queries';
import {
  chunkUniqueIds,
  extractItemFromCacheData,
  patchItemInCacheData,
  patchSingleItemCache,
  patchItemAcrossScopeCaches,
  removeItemsFromCacheData,
  removeItemsFromScopeCaches,
  invalidateLibraryScopeCatalog,
  resolveCachedItemFromScope,
  useLibraryCacheSynchronizer,
} from './cache-patcher';

export {
  chunkUniqueIds,
  extractItemFromCacheData,
  patchItemInCacheData,
  patchSingleItemCache,
  patchItemAcrossScopeCaches,
  removeItemsFromCacheData,
  removeItemsFromScopeCaches,
  invalidateLibraryScopeCatalog,
  resolveCachedItemFromScope,
  useLibraryCacheSynchronizer,
};

// ITEMS QUERY HOOKS

export function useLibraryCountsQuery(
  scopeId?: string,
  options?: { enabled?: boolean },
) {
  const targetScope = normalizeScopeId(scopeId);
  return useQuery({
    queryKey: itemKeys.counts(targetScope),
    queryFn: () => ItemsService.getCounts(targetScope),
    enabled: options?.enabled ?? true,
    staleTime: 1000 * 30,
  });
}

export function useViewItems(
  scopeId?: string,
  view: 'all' | 'recent' | 'unfiled' | 'trash' | 'my-publications' | 'publications' = 'all',
  searchOrOptions?: string | { search?: string; collectionId?: string; enabled?: boolean; limit?: number },
  options?: { enabled?: boolean; limit?: number },
) {
  const targetScope = normalizeScopeId(scopeId);
  const search = typeof searchOrOptions === 'string' ? searchOrOptions : searchOrOptions?.search;
  const collectionId = typeof searchOrOptions === 'object' ? searchOrOptions?.collectionId : undefined;
  const enabled =
    (typeof searchOrOptions === 'object' ? searchOrOptions?.enabled : options?.enabled) ?? true;
  const limit =
    typeof searchOrOptions === 'object' ? searchOrOptions?.limit : options?.limit;
  return useQuery({
    queryKey: collectionId
      ? [...itemKeys.byView(targetScope, view, search), { collectionId }]
      : itemKeys.byView(targetScope, view, search),
    queryFn: ({ signal }) =>
      ItemsService.getAll(
        targetScope,
        {
          view,
          search: search?.trim() || undefined,
          ...(collectionId ? { collectionId } : {}),
          ...(limit ? { limit } : {}),
        },
        { signal },
      ),
    enabled,
    gcTime: 5 * 60 * 1000,
    placeholderData: (previousData) => previousData,
    select: (data) => {
      const items: Item[] = data?.items || [];
      const meta = (data?.meta || null) as CursorPaginationMeta | null;
      const total: number =
        meta?.totalCount ??
        data?.total ??
        items.length;
      return { items, meta, total, hasNextPage: meta?.hasNextPage ?? false, nextCursor: meta?.cursor };
    },
  });
}

export interface UseItemsOptions {
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
  const effectiveScope = targetScope;
  const activeItemId = itemId || '';
  const effectiveLimit = limit ?? 200;
  const queryClient = useQueryClient();

  const shouldFetchAllByDefault = !activeItemId && !collectionId;
  const allItemsQuery = useQuery({
    queryKey: itemKeys.all(targetScope),
    queryFn: ({ signal }) =>
      ItemsService.getAll(targetScope, { limit: effectiveLimit }, { signal }),
    enabled: options.enabled ?? shouldFetchAllByDefault,
    gcTime: 5 * 60 * 1000,
    select: (data) => {
      if (!data) return { items: [] as Item[], meta: null };
      const items: Item[] = data.items || [];
      const meta = (data.meta || null) as CursorPaginationMeta | null;
      return { items, meta };
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

  const createMutation = useMutation({
    mutationFn: (data: CreateItemDTO & { silent?: boolean }) =>
      ItemsService.create(targetScope, collectionId || '', data),
    onSuccess: (newItem, variables) => {
      const targetCollection = newItem?.collectionIds?.[0] || collectionId;
      if (targetCollection) {
        queryClient.invalidateQueries({
          queryKey: itemKeys.byCollection(targetScope, targetCollection),
        });
      }
      queryClient.invalidateQueries({ queryKey: itemKeys.all(targetScope) });
      queryClient.invalidateQueries({ queryKey: libraryKeys.tags(targetScope) });
      invalidateCollections(queryClient, targetScope);
      if (!variables?.silent) {
        toast.success('Document added', {
          description: 'Added to your library.',
          id: 'library-item-create',
        });
      }
    },
    onError: (error: Error | { message?: string }, variables) => {
      if (!variables?.silent) {
        toast.error('Failed to add document', {
          description: error?.message || 'Please check your inputs and try again.',
          id: 'library-item-create',
        });
      }
    },
  });

  const updateMutation = useMutation({
    mutationKey: ['use-items-update', effectiveScope],
    mutationFn: async ({
      id,
      data,
      expectedVersion,
      silent,
    }: {
      id: string;
      data: UpdateItemDTO;
      expectedVersion?: number;
      silent?: boolean;
    }) => {
      const cached = resolveCachedItemFromScope(queryClient, effectiveScope, id);
      const cachedVersion = cached?.version;
      const resolvedVersion =
        expectedVersion ??
        data.version ??
        (typeof cachedVersion === 'number'
          ? cachedVersion
          : resolveCachedItemVersion(queryClient, effectiveScope, id));
      const res = await ItemsService.update(targetScope, id, data, resolvedVersion);
      return { res, silent, id, data };
    },
    onMutate: async ({ id, data }) => {
      if (!id) return undefined;
      await queryClient.cancelQueries({ queryKey: itemKeys.all(effectiveScope) });
      await queryClient.cancelQueries({ queryKey: itemKeys.byId(effectiveScope, id) });

      const previousItemSnapshot = resolveCachedItemFromScope(
        queryClient,
        effectiveScope,
        id,
      );

      const { silent: _silent, ...optimisticPatch } = data;
      patchItemAcrossScopeCaches(
        queryClient,
        effectiveScope,
        id,
        (old) => ({
          ...old,
          ...(optimisticPatch as Partial<Item>),
          // Keep old.version during optimistic patch to prevent 409 Conflict if mutationFn reads cache
          version: old.version,
        }),
      );

      return { previousItemSnapshot };
    },
    onSuccess: ({ res: updatedItem, silent, id, data }) => {
      const serverItem =
        updatedItem && typeof updatedItem === 'object' && 'item' in updatedItem && updatedItem.item
          ? (updatedItem.item as Partial<Item>)
          : (updatedItem as Partial<Item> | undefined);
      const patchData: Partial<Item> = {
        ...data,
        ...(serverItem && typeof serverItem === 'object' ? serverItem : {}),
      };
      if (id) {
        patchItemAcrossScopeCaches(queryClient, effectiveScope, id, patchData);
      }
      queryClient.invalidateQueries({ queryKey: itemKeys.counts(effectiveScope) });
      if (data.tags !== undefined) {
        queryClient.invalidateQueries({ queryKey: tagKeys.list(effectiveScope) });
      }
      if (data.collectionIds !== undefined) {
        invalidateCollections(queryClient, effectiveScope);
      }
      if (!silent) {
        toast.success('Metadata updated', { id: 'item-mutation-toast' });
      }
    },
    onError: (error: Error | { message?: string }, variables, context) => {
      const isLastMutation = queryClient.isMutating({ mutationKey: ['use-items-update', effectiveScope] }) <= 1;
      if (variables?.id && context?.previousItemSnapshot && isLastMutation) {
        patchItemAcrossScopeCaches(
          queryClient,
          effectiveScope,
          variables.id,
          context.previousItemSnapshot,
        );
      }
      queryClient.invalidateQueries({ queryKey: itemKeys.all(effectiveScope) });
      if (variables?.id) {
        queryClient.invalidateQueries({
          queryKey: itemKeys.byId(effectiveScope, variables.id),
        });
      }
      if (!variables?.silent) {
        toast.error('Failed to update metadata', {
          description: error?.message || 'Please check your connection and try again.',
          id: 'item-mutation-toast',
        });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({
      id,
      silent,
      itemCollectionId,
    }: {
      id: string;
      silent?: boolean;
      itemCollectionId?: string;
    }) => {
      const res = await ItemsService.delete(targetScope, id);
      return { res, silent, itemCollectionId };
    },
    onSuccess: ({ silent, itemCollectionId }) => {
      const targetCollection = itemCollectionId || collectionId;
      if (targetCollection) {
        queryClient.invalidateQueries({
          queryKey: itemKeys.byCollection(targetScope, targetCollection),
        });
      }
      queryClient.invalidateQueries({ queryKey: itemKeys.all(targetScope) });
      queryClient.invalidateQueries({ queryKey: tagKeys.list(targetScope) });
      invalidateCollections(queryClient, targetScope);
      if (!silent) {
        toast.success('Moved to trash', {
          description: 'You can restore this item from Trash at any time.',
          id: 'item-mutation-toast',
        });
      }
    },
    onError: (error: Error | { message?: string }, variables) => {
      if (!variables?.silent) {
        toast.error('Failed to delete item', {
          description: error?.message || 'Please try again.',
          id: 'item-mutation-toast',
        });
      }
    },
  });

  const resolvedAllItems = (allItemsQuery.data?.items || []) as Item[];

  const updateItem = (
    idOrPayload:
      | string
      | ({
          id?: string;
          itemId?: string;
          data?: UpdateItemDTO;
          silent?: boolean;
          expectedVersion?: number;
        } & UpdateItemDTO),
    maybeData?: UpdateItemDTO,
    maybeOptions?: { silent?: boolean; expectedVersion?: number },
  ) => {
    if (typeof idOrPayload === 'string') {
      return updateMutation.mutateAsync({
        id: idOrPayload,
        data: maybeData || {},
        expectedVersion: maybeOptions?.expectedVersion,
        silent: maybeOptions?.silent,
      });
    }
    const { id, itemId: payloadItemId, data, silent, expectedVersion, ...rest } = idOrPayload;
    const targetItemId = id || payloadItemId || '';
    const targetData = (data || rest) as UpdateItemDTO;
    return updateMutation.mutateAsync({
      id: targetItemId,
      data: targetData,
      expectedVersion,
      silent,
    });
  };

  const deleteItem = (
    idOrPayload:
      | string
      | { id?: string; itemId?: string; silent?: boolean; collectionId?: string },
    maybeOptions?: { silent?: boolean },
  ) => {
    const targetItemId =
      typeof idOrPayload === 'string'
        ? idOrPayload
        : (idOrPayload.id || idOrPayload.itemId || '');
    const silent =
      typeof idOrPayload === 'object' && 'silent' in idOrPayload
        ? idOrPayload.silent
        : maybeOptions?.silent;
    const itemCollectionId =
      typeof idOrPayload === 'object' ? idOrPayload.collectionId : undefined;
    return deleteMutation.mutateAsync({
      id: targetItemId,
      silent,
      itemCollectionId,
    });
  };

  const batchDeleteItems = async (ids: string[]) => {
    const chunks = chunkUniqueIds(ids, 100);
    if (!chunks.length) return;
    const totalCount = ids.length;
    const toastId = toast.loading(`Moving ${totalCount} item(s) to trash...`, {
      id: 'batch-trash',
    });
    try {
      for (const chunk of chunks) {
        if (chunk.length === 1 && chunks.length === 1) {
          await deleteMutation.mutateAsync({ id: chunk[0], silent: true });
        } else {
          await ItemsService.bulkTrash(targetScope, chunk);
        }
      }
      queryClient.invalidateQueries({ queryKey: itemKeys.all(targetScope) });
      queryClient.invalidateQueries({ queryKey: itemKeys.trash(targetScope) });
      invalidateCollections(queryClient, targetScope);
      toast.success('Moved to trash', {
        description: `${totalCount} document(s) moved to trash.`,
        id: toastId,
      });
    } catch (err: unknown) {
      toast.error('Failed to delete items', {
        description:
          err instanceof Error
            ? err.message
            : 'Could not move selected documents to trash.',
        id: toastId,
      });
    }
  };

  const batchMoveItems = async (ids: string[], targetCollectionId: string | null) => {
    const chunks = chunkUniqueIds(ids, 100);
    if (!chunks.length) return;
    const totalCount = ids.length;
    const toastId = toast.loading(`Moving ${totalCount} item(s)...`, {
      id: 'batch-move',
    });
    try {
      for (const chunk of chunks) {
        await CollectionsService.moveItems(
          targetScope,
          targetCollectionId || 'unfiled',
          chunk,
        );
      }
      queryClient.invalidateQueries({ queryKey: itemKeys.all(targetScope) });
      queryClient.invalidateQueries({ queryKey: collectionKeys.all(targetScope) });
      if (targetCollectionId) {
        queryClient.invalidateQueries({
          queryKey: itemKeys.byCollection(targetScope, targetCollectionId),
        });
      }
      if (collectionId) {
        queryClient.invalidateQueries({
          queryKey: itemKeys.byCollection(targetScope, collectionId),
        });
      }
      invalidateCollections(queryClient, targetScope);
      toast.success('Documents moved', {
        description: `Moved ${totalCount} item(s) to target collection.`,
        id: toastId,
      });
    } catch (err: unknown) {
      toast.error('Failed to move items', {
        description:
          err instanceof Error
            ? err.message
            : 'Could not move selected documents.',
        id: toastId,
      });
    }
  };

  return {
    items: resolvedAllItems,
    meta: allItemsQuery.data?.meta || null,
    item: (itemByIdQuery.data || null) as Item | null,
    collectionItems: (collectionItemsQuery.data || []) as Item[],
    isLoading:
      allItemsQuery.isLoading ||
      itemByIdQuery.isLoading ||
      collectionItemsQuery.isLoading,
    isLoadingAll: allItemsQuery.isLoading,
    isLoadingItem: itemByIdQuery.isLoading,
    isLoadingCollection: collectionItemsQuery.isLoading,
    isError:
      allItemsQuery.isError ||
      itemByIdQuery.isError ||
      collectionItemsQuery.isError,
    error:
      allItemsQuery.error ||
      itemByIdQuery.error ||
      collectionItemsQuery.error,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    createItem: createMutation.mutateAsync,
    updateItem,
    deleteItem,
    batchDeleteItems,
    batchMoveItems,
    refetch: allItemsQuery.refetch,
    refetchAll: allItemsQuery.refetch,
    refetchItem: itemByIdQuery.refetch,
    refetchCollection: collectionItemsQuery.refetch,
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

  const { data, isLoading } = useQuery({
    queryKey: itemKeys.types(sid),
    queryFn: async () => {
      const res = await ItemsService.getItemTypes(sid);
      if (res) {
        updateLibrarySchemaRegistry(res);
      }
      return res;
    },
    enabled,
    staleTime: 1000 * 60 * 60,
  });

  const types = Array.isArray(data)
    ? data
    : ((data as ItemTypesResponse | undefined)?.itemTypes ||
        (data as ItemTypesResponse | undefined)?.data ||
        []);

  return {
    types,
    isLoading,
  };
}



export { useTrash } from './trash.queries';

export function useItem(
  id?: string,
  scopeId?: string,
  options?: { enabled?: boolean },
) {
  const queryClient = useQueryClient();
  const targetScope = normalizeScopeId(scopeId);
  return useQuery({
    queryKey: itemKeys.byId(targetScope, id || ''),
    queryFn: () => ItemsService.getById(targetScope, id || ''),
    enabled: (options?.enabled ?? true) && Boolean(id),
    staleTime: 1000 * 30,
    gcTime: 5 * 60 * 1000,
    placeholderData: (previousData) => {
      if (previousData) return previousData;
      if (!id) return undefined;
      return resolveCachedItemFromScope(queryClient, targetScope, id) ?? undefined;
    },
  });
}

export interface LibraryItemsQueryResult {
  items: Item[];
  total: number;
  meta: CursorPaginationMeta | null;
  hasNextPage: boolean;
  nextCursor?: string | null;
}

export function useLibraryItemsQuery(
  scopeId?: string,
  params?: ItemQueryParams,
  options?: { enabled?: boolean },
) {
  const queryClient = useQueryClient();
  const targetScope = normalizeScopeId(scopeId);
  return useQuery({
    queryKey: libraryKeys.items(targetScope, params),
    enabled: options?.enabled ?? true,
    queryFn: async ({ signal }): Promise<LibraryItemsQueryResult> => {
      const res = await ItemsService.getAll(targetScope, params, { signal });
      const items: Item[] = res?.items || [];
      const meta = (res?.meta || null) as CursorPaginationMeta | null;
      const total =
        meta?.totalCount ??
        res?.total ??
        items.length;
      const hasNextPage = Boolean(meta?.hasNextPage);
      const nextCursor = meta?.nextCursor || null;

      return {
        items,
        total,
        meta,
        hasNextPage,
        nextCursor,
      };
    },
    placeholderData: (previousData) => {
      if (previousData) return previousData;
      if (params?.search || params?.view === 'trash') return undefined;

      const listQueries = queryClient.getQueriesData<LibraryItemsQueryResult>({
        queryKey: itemKeys.all(targetScope),
      });
      for (const [key, listData] of listQueries) {
        if (!Array.isArray(listData?.items)) continue;
        const keyParams = Array.isArray(key) ? (key[3] as ItemQueryParams | undefined) : undefined;
        // Prefer deriving from an unfiltered root items query
        if (keyParams?.collectionId || keyParams?.view || keyParams?.search) continue;

        let filtered: Item[] | undefined;
        if (params?.collectionId) {
          filtered = listData.items.filter((it) =>
            it.collectionIds?.includes(params.collectionId!),
          );
        } else if (params?.view === 'starred') {
          filtered = listData.items.filter((it) => Boolean(it.isStarred || it.isFavorite));
        } else if (params?.view === 'unfiled') {
          filtered = listData.items.filter(
            (it) => !it.collectionIds || it.collectionIds.length === 0,
          );
        } else if (!params?.collectionId && !params?.view) {
          filtered = listData.items;
        }

        if (filtered && (filtered.length > 0 || !listData.hasNextPage)) {
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
    },
    staleTime: 1000 * 30,
    gcTime: 5 * 60 * 1000,
  });
}

export function useLibraryItemDetailQuery(
  scopeId: string | undefined,
  itemId: string | undefined,
  options?: { enabled?: boolean },
) {
  return useItem(itemId, normalizeScopeId(scopeId), options);
}

export {
  resolveCachedItemVersion,
  useUpdateLibraryItemMutation,
  useToggleStarItemMutation,
  useImportFromUserMutation,
  useCreateLibraryItemMutation,
};

export {
  useDeleteLibraryItemsMutation,
  useBatchRestoreItemsMutation,
  useBatchPurgeItemsMutation,
} from './trash.queries';

export { useLibraryDeltaSync } from './sync.queries';
