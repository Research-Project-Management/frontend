'use client';

import { useRef } from 'react';
import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
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

function resolveCachedItemVersion(
  queryClient: QueryClient,
  effectiveScope: string,
  itemId: string,
  explicitVersion?: number,
  dtoVersion?: number,
): number | undefined {
  if (typeof explicitVersion === 'number') return explicitVersion;
  if (typeof dtoVersion === 'number') return dtoVersion;

  const cached = queryClient.getQueryData<Item>(
    itemKeys.byId(effectiveScope, itemId),
  );
  if (typeof cached?.version === 'number') {
    return cached.version;
  }

  const listQueries = queryClient.getQueriesData<{ items?: Item[] }>({
    queryKey: itemKeys.all(effectiveScope),
  });
  for (const [, listData] of listQueries) {
    if (Array.isArray(listData?.items)) {
      const found = listData.items.find((it) => it.id === itemId);
      if (typeof found?.version === 'number') {
        return found.version;
      }
    }
  }
  return undefined;
}

// ITEMS QUERY HOOKS

export function useLibraryCountsQuery(scopeId?: string) {
  const targetScope = scopeId || 'user';
  return useQuery({
    queryKey: itemKeys.counts(targetScope),
    queryFn: () => ItemsService.getCounts(targetScope),
    staleTime: 1000 * 30,
  });
}

export function useViewItems(
  scopeId?: string,
  view: 'all' | 'recent' | 'unfiled' | 'trash' | 'my-publications' | 'publications' = 'all',
  searchOrOptions?: string | { search?: string; collectionId?: string; enabled?: boolean; limit?: number },
  options?: { enabled?: boolean; limit?: number },
) {
  const targetScope = scopeId || 'user';
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
  const targetScope = scopeId || projectId || 'user';
  const effectiveScope = normalizeScopeId(targetScope);
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
    enabled: Boolean(activeItemId),
    gcTime: 5 * 60 * 1000,
  });

  const collectionItemsQuery = useQuery({
    queryKey: itemKeys.byCollection(targetScope, collectionId || ''),
    queryFn: () => ItemsService.getByCollection(targetScope, collectionId || ''),
    enabled: Boolean(collectionId),
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
      const cached = queryClient.getQueryData<Item>(
        itemKeys.byId(effectiveScope, id),
      );
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

      const previousLists = queryClient.getQueriesData({
        queryKey: itemKeys.all(effectiveScope),
      });
      const previousItem = queryClient.getQueryData<Item>(
        itemKeys.byId(effectiveScope, id),
      );

      const { silent: _silent, ...optimisticPatch } = data;
      patchItemAcrossScopeCaches(
        queryClient,
        effectiveScope,
        id,
        optimisticPatch as Partial<Item>,
      );

      return { previousLists, previousItem };
    },
    onSuccess: ({ res: updatedItem, silent, id, data }) => {
      const patchData: Partial<Item> = {
        ...data,
        ...(updatedItem && typeof updatedItem === 'object' ? updatedItem : {}),
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
      if (context?.previousLists) {
        for (const [key, data] of context.previousLists) {
          queryClient.setQueryData(key, data);
        }
      }
      if (context?.previousItem !== undefined && variables?.id) {
        queryClient.setQueryData(
          itemKeys.byId(effectiveScope, variables.id),
          context.previousItem,
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
    if (!ids.length) return;
    const toastId = toast.loading(`Moving ${ids.length} item(s) to trash...`, {
      id: 'batch-trash',
    });
    try {
      if (ids.length === 1) {
        await deleteMutation.mutateAsync({ id: ids[0], silent: true });
      } else {
        await ItemsService.bulkTrash(targetScope, ids);
        queryClient.invalidateQueries({ queryKey: itemKeys.all(targetScope) });
        queryClient.invalidateQueries({ queryKey: itemKeys.trash(targetScope) });
        invalidateCollections(queryClient, targetScope);
      }
      toast.success('Moved to trash', {
        description: `${ids.length} document(s) moved to trash.`,
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
    if (!ids.length) return;
    const toastId = toast.loading(`Moving ${ids.length} item(s)...`, {
      id: 'batch-move',
    });
    try {
      await CollectionsService.moveItems(
        targetScope,
        targetCollectionId || 'unfiled',
        ids,
      );
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
        description: `Moved ${ids.length} item(s) to target collection.`,
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
  scopeIdOrOptions?: string | { scopeId?: string; projectId?: string },
) {
  const sid =
    typeof scopeIdOrOptions === 'string'
      ? scopeIdOrOptions
      : (scopeIdOrOptions?.scopeId || scopeIdOrOptions?.projectId || 'user');

  const { data, isLoading } = useQuery({
    queryKey: itemKeys.types(sid),
    queryFn: async () => {
      const res = await ItemsService.getItemTypes(sid);
      if (res) {
        updateLibrarySchemaRegistry(res);
      }
      return res;
    },
    enabled: true,
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

import {
  patchItemInCacheData,
  patchSingleItemCache,
  patchItemAcrossScopeCaches,
  removeItemsFromCacheData,
  removeItemsFromScopeCaches,
  invalidateLibraryScopeCatalog,
} from './cache-patcher';

export {
  patchItemInCacheData,
  patchSingleItemCache,
  patchItemAcrossScopeCaches,
  removeItemsFromCacheData,
  removeItemsFromScopeCaches,
  invalidateLibraryScopeCatalog,
};

export function useTrash(
  scopeId: string = 'user',
  options?: { enabled?: boolean },
) {
  const queryClient = useQueryClient();
  const effectiveScope = normalizeScopeId(scopeId);

  const trashQuery = useQuery({
    queryKey: itemKeys.trash(effectiveScope),
    queryFn: ({ signal }) =>
      ItemsService.getAll(effectiveScope, { view: 'trash' }, { signal }),
    enabled: (options?.enabled ?? true) && Boolean(scopeId),
    select: (data): Item[] => {
      if (Array.isArray(data?.items)) return data.items;
      if (Array.isArray(data)) return data as Item[];
      return [];
    },
  });

  const trashItems: Item[] = trashQuery.data ?? [];

  const restoreMutation = useMutation({
    mutationFn: (itemId: string) => ItemsService.restore(effectiveScope, itemId),
    onSuccess: () => {
      toast.success('Item restored', {
        description: 'Item has been returned to your library.',
        id: 'trash-mutation-toast',
      });
      queryClient.invalidateQueries({ queryKey: itemKeys.all(effectiveScope) });
    },
    onError: (err: Error) => {
      toast.error('Failed to restore item', {
        description: err.message || 'Please try again.',
        id: 'trash-mutation-toast',
      });
    },
  });

  const purgeMutation = useMutation({
    mutationFn: (itemId: string) => ItemsService.purge(effectiveScope, itemId),
    onSuccess: () => {
      toast.success('Permanently deleted', {
        description: 'The item and its attachments were permanently removed.',
        id: 'trash-mutation-toast',
      });
      queryClient.invalidateQueries({ queryKey: itemKeys.all(effectiveScope) });
    },
    onError: (err: Error) => {
      toast.error('Failed to delete item', {
        description: err.message || 'Please try again.',
        id: 'trash-mutation-toast',
      });
    },
  });

  const emptyTrashMutation = useMutation({
    mutationFn: async (items: Item[]) => {
      if (items.length === 0) return 0;
      const ids = items.map((item) => item.id).filter(Boolean);
      if (ids.length === 0) return 0;
      const res = await ItemsService.bulkPurge(effectiveScope, ids);
      return res?.count ?? ids.length;
    },
    onSuccess: (count) => {
      toast.success('Trash emptied', {
        description: `Permanently removed ${count} item(s).`,
        id: 'trash-mutation-toast',
      });
      queryClient.invalidateQueries({ queryKey: itemKeys.all(effectiveScope) });
      queryClient.invalidateQueries({ queryKey: itemKeys.trash(effectiveScope) });
      invalidateCollections(queryClient, effectiveScope);
    },
    onError: (err: Error) => {
      toast.error('Failed to empty trash', {
        description: err.message || 'Please try again.',
        id: 'trash-mutation-toast',
      });
    },
  });

  return {
    trashItems,
    isLoading: trashQuery.isLoading,
    isError: trashQuery.isError,
    error: trashQuery.error,
    isRestoring: restoreMutation.isPending,
    isPurging: purgeMutation.isPending,
    isEmptyingTrash: emptyTrashMutation.isPending,
    refetch: trashQuery.refetch,
    restoreItem: restoreMutation.mutateAsync,
    purgeItem: purgeMutation.mutateAsync,
    emptyTrash: () => emptyTrashMutation.mutateAsync(trashItems),
  };
}

export function useItem(
  id?: string,
  scopeId?: string,
  options?: { enabled?: boolean },
) {
  const targetScope = normalizeScopeId(scopeId);
  return useQuery({
    queryKey: itemKeys.byId(targetScope, id || ''),
    queryFn: () => ItemsService.getById(targetScope, id || ''),
    enabled: (options?.enabled ?? true) && Boolean(id),
    gcTime: 5 * 60 * 1000,
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
    placeholderData: (previousData) => previousData,
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

export function useUpdateLibraryItemMutation(scopeId?: string) {
  const queryClient = useQueryClient();
  const effectiveScope = normalizeScopeId(scopeId);

  return useMutation({
    mutationFn: async ({
      itemId,
      data,
      expectedVersion,
    }: {
      itemId: string;
      data: UpdateItemDTO;
      expectedVersion?: number;
      silent?: boolean;
    }) => {
      const { silent: _silent, ...updateData } = data;
      const cached = queryClient.getQueryData<Item>(
        itemKeys.byId(effectiveScope, itemId),
      );
      const cachedVersion = cached?.version;
      const resolvedVersion =
        expectedVersion ??
        updateData.version ??
        (typeof cachedVersion === 'number'
          ? cachedVersion
          : resolveCachedItemVersion(queryClient, effectiveScope, itemId));
      return ItemsService.update(effectiveScope, itemId, updateData, resolvedVersion);
    },
    onMutate: async ({ itemId, data }) => {
      if (!itemId) return undefined;
      await queryClient.cancelQueries({ queryKey: itemKeys.all(effectiveScope) });
      await queryClient.cancelQueries({ queryKey: itemKeys.byId(effectiveScope, itemId) });

      const previousLists = queryClient.getQueriesData({
        queryKey: itemKeys.all(effectiveScope),
      });
      const previousItem = queryClient.getQueryData<Item>(
        itemKeys.byId(effectiveScope, itemId),
      );

      const { silent: _silent, ...optimisticPatch } = data;
      patchItemAcrossScopeCaches(
        queryClient,
        effectiveScope,
        itemId,
        optimisticPatch as Partial<Item>,
      );

      return { previousLists, previousItem };
    },
    onSuccess: (updatedItem, variables) => {
      const targetId = variables.itemId;
      const rawData = variables.data || {};
      const patchData: Partial<Item> = {
        ...rawData,
        ...(updatedItem && typeof updatedItem === 'object' ? updatedItem : {}),
      };

      if (targetId) {
        patchItemAcrossScopeCaches(queryClient, effectiveScope, targetId, patchData);
      }

      queryClient.invalidateQueries({ queryKey: itemKeys.counts(effectiveScope) });
      if (rawData.tags !== undefined) {
        queryClient.invalidateQueries({ queryKey: libraryKeys.tags(effectiveScope) });
      }
      if (patchData.collectionIds !== undefined) {
        invalidateCollections(queryClient, effectiveScope);
      }

      const isSilent = Boolean(variables.silent || variables.data?.silent);
      if (!isSilent) {
        toast.success('Item updated', { id: 'item-update' });
      }
    },
    onError: (err: Error, variables, context) => {
      const targetId = variables?.itemId;
      if (context?.previousLists) {
        for (const [key, data] of context.previousLists) {
          queryClient.setQueryData(key, data);
        }
      }
      if (context?.previousItem !== undefined && targetId) {
        queryClient.setQueryData(
          itemKeys.byId(effectiveScope, targetId),
          context.previousItem,
        );
      }
      queryClient.invalidateQueries({
        queryKey: itemKeys.all(effectiveScope),
      });
      if (targetId) {
        queryClient.invalidateQueries({
          queryKey: itemKeys.byId(effectiveScope, targetId),
        });
      }
      toast.error('Failed to update item', {
        description: err.message || 'Please try again.',
        id: 'item-update',
      });
    },
  });
}

export function useToggleStarItemMutation(scopeId?: string) {
  const queryClient = useQueryClient();
  const effectiveScope = normalizeScopeId(scopeId);

  return useMutation({
    mutationFn: async ({ id, isStarred }: { id: string; isStarred: boolean }) => {
      return StateService.updateState(effectiveScope, id, { isStarred });
    },
    onMutate: async ({ id, isStarred }) => {
      await queryClient.cancelQueries({ queryKey: itemKeys.all(effectiveScope) });
      await queryClient.cancelQueries({ queryKey: itemKeys.byId(effectiveScope, id) });
      await queryClient.cancelQueries({ queryKey: itemKeys.state(effectiveScope, id) });

      const previousLists = queryClient.getQueriesData({
        queryKey: itemKeys.all(effectiveScope),
      });
      const previousItem = queryClient.getQueryData(
        itemKeys.byId(effectiveScope, id),
      );
      const previousState = queryClient.getQueryData(
        itemKeys.state(effectiveScope, id),
      );

      patchItemAcrossScopeCaches(queryClient, effectiveScope, id, {
        isStarred,
        isFavorite: isStarred,
      });

      queryClient.setQueryData(
        itemKeys.state(effectiveScope, id),
        (old: unknown) => {
          const s = old as Record<string, unknown> | undefined;
          if (!s) return { isStarred };
          return { ...s, isStarred };
        },
      );

      return { previousLists, previousItem, previousState };
    },
    onError: (err: Error, variables, context) => {
      if (context?.previousLists) {
        for (const [key, data] of context.previousLists) {
          queryClient.setQueryData(key, data);
        }
      } else {
        queryClient.invalidateQueries({ queryKey: itemKeys.all(effectiveScope) });
      }
      if (context?.previousItem !== undefined) {
        queryClient.setQueryData(
          itemKeys.byId(effectiveScope, variables.id),
          context.previousItem,
        );
      }
      if (context?.previousState !== undefined) {
        queryClient.setQueryData(
          itemKeys.state(effectiveScope, variables.id),
          context.previousState,
        );
      }
      toast.error('Action failed', {
        description: err?.message || 'Please try again.',
        id: 'item-star-toggle',
      });
    },
    onSuccess: (_updated, variables) => {
      patchItemAcrossScopeCaches(queryClient, effectiveScope, variables.id, {
        isStarred: variables.isStarred,
        isFavorite: variables.isStarred,
      });
      queryClient.invalidateQueries({ queryKey: itemKeys.counts(effectiveScope) });
      toast.success(
        variables.isStarred ? 'Added to Starred' : 'Removed from Starred',
        {
          id: 'item-star-toggle',
        },
      );
    },
  });
}

export function useDeleteLibraryItemsMutation(scopeId?: string) {
  const queryClient = useQueryClient();
  const effectiveScope = normalizeScopeId(scopeId);

  return useMutation({
    mutationFn: async (itemIds: string[] | string) => {
      const ids = Array.isArray(itemIds) ? itemIds : [itemIds];
      if (ids.length === 1) {
        await ItemsService.delete(effectiveScope, ids[0]);
      } else if (ids.length > 1) {
        await ItemsService.bulkTrash(effectiveScope, ids);
      }
      return ids;
    },
    onSuccess: (ids) => {
      queryClient.invalidateQueries({ queryKey: itemKeys.all(effectiveScope) });
      queryClient.invalidateQueries({ queryKey: itemKeys.trash(effectiveScope) });
      queryClient.invalidateQueries({ queryKey: tagKeys.list(effectiveScope) });
      invalidateCollections(queryClient, effectiveScope);
      toast.success(
        `Moved ${ids.length} ${ids.length === 1 ? 'item' : 'items'} to trash`,
        { id: 'item-delete' },
      );
    },
    onError: (err: Error) => {
      toast.error('Failed to delete items', {
        description: err.message || 'Please try again.',
        id: 'item-delete',
      });
    },
  });
}

export function useBatchRestoreItemsMutation(scopeId?: string) {
  const queryClient = useQueryClient();
  const effectiveScope = normalizeScopeId(scopeId);

  return useMutation({
    mutationFn: async (itemIds: string[] | string) => {
      const ids = Array.isArray(itemIds) ? itemIds : [itemIds];
      if (ids.length === 1) {
        await ItemsService.restore(effectiveScope, ids[0]);
      } else if (ids.length > 1) {
        await ItemsService.bulkRestore(effectiveScope, ids);
      }
      return ids;
    },
    onSuccess: (ids) => {
      queryClient.invalidateQueries({ queryKey: itemKeys.all(effectiveScope) });
      queryClient.invalidateQueries({ queryKey: itemKeys.trash(effectiveScope) });
      queryClient.invalidateQueries({ queryKey: tagKeys.list(effectiveScope) });
      invalidateCollections(queryClient, effectiveScope);
      toast.success(
        `Restored ${ids.length} ${ids.length === 1 ? 'item' : 'items'}`,
        { id: 'item-restore' },
      );
    },
    onError: (err: Error) => {
      toast.error('Failed to restore items', {
        description: err.message || 'Please try again.',
        id: 'item-restore',
      });
    },
  });
}

export function useBatchPurgeItemsMutation(scopeId?: string) {
  const queryClient = useQueryClient();
  const effectiveScope = normalizeScopeId(scopeId);

  return useMutation({
    mutationFn: async (itemIds: string[] | string) => {
      const ids = Array.isArray(itemIds) ? itemIds : [itemIds];
      await ItemsService.bulkPurge(effectiveScope, ids);
      return ids;
    },
    onSuccess: (ids) => {
      queryClient.invalidateQueries({ queryKey: itemKeys.all(effectiveScope) });
      queryClient.invalidateQueries({ queryKey: itemKeys.trash(effectiveScope) });
      queryClient.invalidateQueries({ queryKey: tagKeys.list(effectiveScope) });
      invalidateCollections(queryClient, effectiveScope);
      toast.success(
        `Permanently deleted ${ids.length} ${ids.length === 1 ? 'item' : 'items'}`,
        { id: 'item-purge' },
      );
    },
    onError: (err: Error) => {
      toast.error('Failed to permanently delete items', {
        description: err.message || 'Please try again.',
        id: 'item-purge',
      });
    },
  });
}

export function useImportFromUserMutation(scopeId?: string) {
  const queryClient = useQueryClient();
  const effectiveScope = normalizeScopeId(scopeId);

  return useMutation({
    mutationFn: (
      input: string[] | { projectId?: string; scopeId?: string; itemIds: string[] },
    ) => {
      const itemIds = Array.isArray(input) ? input : input.itemIds;
      const targetProject = Array.isArray(input)
        ? effectiveScope
        : normalizeScopeId(input.projectId || input.scopeId || effectiveScope);
      return ItemsService.importFromUser(targetProject, itemIds);
    },
    onSuccess: (_res, input) => {
      const targetProject = Array.isArray(input)
        ? effectiveScope
        : normalizeScopeId(input.projectId || input.scopeId || effectiveScope);
      queryClient.invalidateQueries({ queryKey: itemKeys.all(targetProject) });
      queryClient.invalidateQueries({ queryKey: itemKeys.counts(targetProject) });
      invalidateCollections(queryClient, targetProject);
    },
  });
}

export function useCreateLibraryItemMutation(scopeId?: string) {
  const queryClient = useQueryClient();
  const effectiveScope = normalizeScopeId(scopeId);

  return useMutation({
    mutationFn: (
      input:
        | (Partial<Item> & { collectionId?: string })
        | { collectionId?: string; data: Partial<Item> | Record<string, unknown> },
    ) => {
      const hasNestedData =
        input &&
        typeof input === 'object' &&
        'data' in input &&
        input.data &&
        typeof input.data === 'object';
      const collectionId = (input as { collectionId?: string })?.collectionId || '';
      const payload = hasNestedData
        ? (input as { data: Partial<Item> | Record<string, unknown> }).data
        : (input as Partial<Item>);
      return ItemsService.create(effectiveScope, collectionId, payload);
    },
    onSuccess: (newItem, variables) => {
      const targetCollection =
        newItem?.collectionIds?.[0] ||
        (variables as { collectionId?: string })?.collectionId;
      if (targetCollection) {
        queryClient.invalidateQueries({
          queryKey: itemKeys.byCollection(effectiveScope, targetCollection),
        });
      }
      queryClient.invalidateQueries({ queryKey: itemKeys.all(effectiveScope) });
      queryClient.invalidateQueries({ queryKey: libraryKeys.tags(effectiveScope) });
      invalidateCollections(queryClient, effectiveScope);
    },
  });
}

function hasSyncVersionAdvanced(currentSeq: string, nextVersion: string): boolean {
  if (!nextVersion || nextVersion === currentSeq || nextVersion === '0') {
    return false;
  }
  if (/^\d+$/.test(currentSeq) && /^\d+$/.test(nextVersion)) {
    return BigInt(nextVersion) > BigInt(currentSeq);
  }
  return nextVersion !== currentSeq;
}

/**
 * Lightweight CDC Delta Sync Hook for Library Scopes.
 *
 * Tracks monotonic sync sequence (`lastSyncSeqRef`) per `effectiveScope`, polls
 * `SyncService.getVersion(effectiveScope)` on window focus / interval, and when
 * the remote version advances, pulls incremental changes via `SyncService.getChanges`
 * to patch updated/created items and remove deleted items in the TanStack Query cache.
 */
export function useLibraryDeltaSync(
  scopeId?: string,
  options?: { enabled?: boolean; refetchInterval?: number | false },
) {
  const queryClient = useQueryClient();
  const effectiveScope = normalizeScopeId(scopeId);
  const lastSyncSeqRef = useRef<string | null>(null);
  const lastScopeRef = useRef<string>(effectiveScope);

  if (lastScopeRef.current !== effectiveScope) {
    lastScopeRef.current = effectiveScope;
    lastSyncSeqRef.current = null;
  }

  return useQuery({
    queryKey: libraryKeys.syncVersion(effectiveScope),
    enabled: options?.enabled ?? true,
    refetchOnWindowFocus: true,
    refetchInterval: options?.refetchInterval ?? 30_000,
    staleTime: 10_000,
    queryFn: async () => {
      const versionRes = await SyncService.getVersion(effectiveScope);
      const remoteVersion = String(versionRes?.version ?? '0');

      if (lastSyncSeqRef.current === null) {
        lastSyncSeqRef.current = remoteVersion;
        return {
          version: remoteVersion,
          scopeId: effectiveScope,
          syncedCount: 0,
        };
      }

      if (!hasSyncVersionAdvanced(lastSyncSeqRef.current, remoteVersion)) {
        return {
          version: remoteVersion,
          scopeId: effectiveScope,
          syncedCount: 0,
        };
      }

      let currentSince = lastSyncSeqRef.current;
      const deletedItemIds: string[] = [];
      let patchedCount = 0;
      let hasCreatedItems = false;
      let pagesFetched = 0;

      while (pagesFetched < 10) {
        pagesFetched++;
        const changesRes = await SyncService.getChanges(effectiveScope, {
          since: currentSince,
          limit: 100,
        }) as {
          since?: string;
          nextSince?: string;
          count?: number;
          hasMore?: boolean;
          changes?: Array<Record<string, unknown>>;
        };
        const changes = Array.isArray(changesRes?.changes) ? changesRes.changes : [];
        if (changes.length === 0) break;

        for (const change of changes) {
          if (!change || typeof change !== 'object') continue;
          const entityType = String(
            change.entityType ?? change.type ?? 'Item',
          ).toLowerCase();
          const action = String(
            change.action ?? change.operation ?? 'UPDATE',
          ).toUpperCase();
          const rawData =
            change.data && typeof change.data === 'object'
              ? (change.data as Record<string, unknown>)
              : change.item && typeof change.item === 'object'
                ? (change.item as Record<string, unknown>)
                : change;
          const itemId = String(
            change.entityId ?? change.itemId ?? rawData.id ?? change.id ?? '',
          );

          if (entityType !== 'item' || !itemId) continue;

          if (
            action === 'DELETE' ||
            action === 'DELETED' ||
            action === 'PURGE' ||
            action === 'PURGED' ||
            Boolean(rawData.deletedAt)
          ) {
            deletedItemIds.push(itemId);
          } else {
            if (action === 'CREATE' || action === 'CREATED') {
              hasCreatedItems = true;
            }
            const patch: Partial<Item> = {
              ...(rawData as Partial<Item>),
              id: itemId,
              ...(typeof change.version === 'number'
                ? { version: change.version }
                : {}),
            };
            patchItemAcrossScopeCaches(queryClient, effectiveScope, itemId, patch);
            patchedCount++;
          }
        }

        const lastChangeSeq = changes[changes.length - 1]?.seq;
        const nextCursor =
          changesRes?.nextSince ||
          (lastChangeSeq !== undefined ? String(lastChangeSeq) : null);

        if (changesRes?.hasMore && nextCursor && nextCursor !== currentSince) {
          currentSince = nextCursor;
        } else {
          break;
        }
      }

      if (deletedItemIds.length > 0) {
        removeItemsFromScopeCaches(queryClient, effectiveScope, deletedItemIds);
      }

      lastSyncSeqRef.current = remoteVersion;

      if (hasCreatedItems) {
        await queryClient.invalidateQueries({
          queryKey: itemKeys.all(effectiveScope),
        });
      }

      await queryClient.invalidateQueries({
        queryKey: itemKeys.counts(effectiveScope),
      });

      return {
        version: remoteVersion,
        scopeId: effectiveScope,
        syncedCount: patchedCount + deletedItemIds.length,
      };
    },
  });
}
