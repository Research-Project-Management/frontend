'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ItemsService,
  CollectionsService,
  StateService,
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
  searchOrOptions?: string | { search?: string; enabled?: boolean },
  options?: { enabled?: boolean },
) {
  const targetScope = scopeId || 'user';
  const search = typeof searchOrOptions === 'string' ? searchOrOptions : searchOrOptions?.search;
  const enabled =
    (typeof searchOrOptions === 'object' ? searchOrOptions?.enabled : options?.enabled) ?? true;
  return useQuery({
    queryKey: itemKeys.byView(targetScope, view, search),
    queryFn: ({ signal }) =>
      ItemsService.getAll(
        targetScope,
        {
          view,
          search: search?.trim() || undefined,
        },
        { signal },
      ),
    enabled,
    placeholderData: (previousData) => previousData,
    select: (data) => {
      const items: Item[] = data?.items || [];
      const meta = (data?.meta || data?.pagination || null) as CursorPaginationMeta | null;
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
  paperId?: string;
  itemId?: string;
  enabled?: boolean;
}

export function useItems(optionsOrScope: string | UseItemsOptions = {}) {
  const options = typeof optionsOrScope === 'string' ? { scopeId: optionsOrScope } : optionsOrScope;
  const { scopeId, projectId, collectionId, paperId, itemId } = options;
  const targetScope = scopeId || projectId || 'user';
  const activeItemId = itemId || paperId || '';
  const queryClient = useQueryClient();

  const shouldFetchAllByDefault = !activeItemId && !collectionId;
  const allItemsQuery = useQuery({
    queryKey: itemKeys.all(targetScope),
    queryFn: ({ signal }) => ItemsService.getAll(targetScope, undefined, { signal }),
    enabled: options.enabled ?? shouldFetchAllByDefault,
    select: (data) => {
      if (!data) return { items: [] as Item[], meta: null };
      const items: Item[] = data.items || [];
      const meta = data.meta || data.pagination || null;
      return { items, meta };
    },
  });

  const itemByIdQuery = useQuery({
    queryKey: itemKeys.byId(targetScope, activeItemId),
    queryFn: () => ItemsService.getById(targetScope, activeItemId),
    enabled: Boolean(activeItemId),
    select: (data) => (data?.item ? (data.item as Item) : (data as Item)),
  });

  const collectionItemsQuery = useQuery({
    queryKey: itemKeys.byCollection(targetScope, collectionId || ''),
    queryFn: () => ItemsService.getByCollection(targetScope, collectionId || ''),
    enabled: Boolean(collectionId),
    select: (data) => (data?.items || data?.papers || []) as Item[],
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateItemDTO & { silent?: boolean }) =>
      ItemsService.create(targetScope, collectionId || '', data),
    onSuccess: (newItem, variables) => {
      const targetCollection = newItem?.collectionId || collectionId;
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
      const res = await ItemsService.update(targetScope, id, data, expectedVersion);
      return { res, silent, id };
    },
    onSuccess: ({ res: updatedItem, silent, id }) => {
      const targetCollection = updatedItem?.collectionId || collectionId;
      if (targetCollection) {
        queryClient.invalidateQueries({
          queryKey: itemKeys.byCollection(targetScope, targetCollection),
        });
      }
      queryClient.invalidateQueries({ queryKey: itemKeys.all(targetScope) });
      queryClient.setQueryData(itemKeys.byId(targetScope, id), updatedItem);
      queryClient.invalidateQueries({ queryKey: tagKeys.list(targetScope) });
      invalidateCollections(queryClient, targetScope);
      if (!silent) {
        toast.success('Metadata updated', { id: 'item-mutation-toast' });
      }
    },
    onError: (error: Error | { message?: string }, variables) => {
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
  const state = {
    data: resolvedAllItems,
    items: resolvedAllItems,
    allItems: resolvedAllItems,
    allPapers: resolvedAllItems,
    meta: allItemsQuery.data?.meta || null,
    item: (itemByIdQuery.data || null) as Item | null,
    paper: (itemByIdQuery.data || null) as Item | null,
    collectionItems: (collectionItemsQuery.data || []) as Item[],
    collectionPapers: (collectionItemsQuery.data || []) as Item[],
    isLoadingAll: allItemsQuery.isLoading,
    isLoadingItem: itemByIdQuery.isLoading,
    isLoadingPaper: itemByIdQuery.isLoading,
    isLoadingCollection: collectionItemsQuery.isLoading,
    isCreating: createMutation.isPending,
    isAdding: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };

  const updateItemHandler = (
    idOrPayload:
      | string
      | ({
          id?: string;
          paperId?: string;
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
    const { id, paperId, data, silent, expectedVersion, ...rest } = idOrPayload;
    const targetItemId = id || paperId || '';
    const targetData = (data || rest) as UpdateItemDTO;
    return updateMutation.mutateAsync({
      id: targetItemId,
      data: targetData,
      expectedVersion,
      silent,
    });
  };

  const deleteItemHandler = (
    idOrPayload:
      | string
      | { paperId?: string; id?: string; silent?: boolean; collectionId?: string },
    maybeOptions?: { silent?: boolean },
  ) => {
    const targetItemId =
      typeof idOrPayload === 'string'
        ? idOrPayload
        : (idOrPayload.id || idOrPayload.paperId || '');
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

  const actions = {
    createItem: createMutation.mutateAsync,
    createPaper: createMutation.mutateAsync,
    addPaper: createMutation.mutateAsync,
    updateItem: updateItemHandler,
    updatePaper: updateItemHandler,
    deleteItem: deleteItemHandler,
    deletePaper: deleteItemHandler,
    batchDeleteItems: async (ids: string[]) => {
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
    },
    batchMoveItems: async (ids: string[], targetCollectionId: string | null) => {
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
    },
    refetchAll: allItemsQuery.refetch,
    refetchItem: itemByIdQuery.refetch,
    refetchCollection: collectionItemsQuery.refetch,
  };

  return {
    state,
    actions,
    ...state,
    ...actions,
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
    state: { types, isLoading },
    actions: {},
    types,
    isLoading,
  };
}

import {
  patchItemInCacheData,
  patchSingleItemCache,
  patchItemAcrossScopeCaches,
  invalidateLibraryScopeCatalog,
} from './cache-patcher';

export {
  patchItemInCacheData,
  patchSingleItemCache,
  patchItemAcrossScopeCaches,
  invalidateLibraryScopeCatalog,
};

export function useTrash(
  scopeId: string = 'user',
  options?: { enabled?: boolean },
) {
  const queryClient = useQueryClient();
  const effectiveScope = scopeId || 'user';

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

  const state = {
    trashItems,
    isLoading: trashQuery.isLoading,
    isError: trashQuery.isError,
    error: trashQuery.error,
    isRestoring: restoreMutation.isPending,
    isPurging: purgeMutation.isPending,
    isEmptyingTrash: emptyTrashMutation.isPending,
  };

  const actions = {
    refetch: trashQuery.refetch,
    restoreItem: restoreMutation.mutateAsync,
    purgeItem: purgeMutation.mutateAsync,
    emptyTrash: () => emptyTrashMutation.mutateAsync(trashItems),
  };

  return {
    state,
    actions,
    ...state,
    ...actions,
  };
}

export function useItem(id?: string, scopeId?: string) {
  const targetScope = scopeId || 'user';
  return useQuery({
    queryKey: itemKeys.byId(targetScope, id || ''),
    queryFn: () => ItemsService.getById(targetScope, id || ''),
    enabled: Boolean(id),
    select: (data) => (data?.item ? (data.item as Item) : (data as Item)),
  });
}

export interface LibraryItemsQueryResult {
  items: Item[];
  total: number;
  meta: Record<string, unknown> | CursorPaginationMeta | null;
  pagination: Record<string, unknown> | CursorPaginationMeta | null;
  hasNextPage: boolean;
  nextCursor?: string | null;
}

export function useLibraryItemsQuery(
  scopeId?: string,
  params?: ItemQueryParams,
  options?: { enabled?: boolean },
) {
  const targetScope = scopeId || 'user';
  return useQuery({
    queryKey: libraryKeys.items(targetScope, params),
    enabled: options?.enabled ?? true,
    queryFn: async ({ signal }): Promise<LibraryItemsQueryResult> => {
      const res = await ItemsService.getAll(targetScope, params, { signal });
      const items: Item[] = res?.items || [];
      const pagination = (res?.pagination || res?.meta || null) as CursorPaginationMeta | null;
      const total =
        pagination?.totalCount ??
        res?.total ??
        items.length;
      const hasNextPage = Boolean(pagination?.hasNextPage);
      const nextCursor = pagination?.nextCursor || null;

      return {
        items,
        total,
        meta: pagination,
        pagination,
        hasNextPage,
        nextCursor,
      };
    },
    placeholderData: (previousData) => previousData,
    staleTime: 1000 * 30,
  });
}

export function useLibraryItemDetailQuery(
  scopeIdOrItemId?: string,
  maybeItemId?: string,
) {
  let scopeId = 'user';
  let itemId = scopeIdOrItemId;

  if (arguments.length >= 2) {
    scopeId = scopeIdOrItemId || 'user';
    itemId = maybeItemId;
  }

  return useItem(itemId, scopeId);
}

export function useUpdateLibraryItemMutation(scopeId?: string) {
  const queryClient = useQueryClient();
  const effectiveScope = scopeId || 'user';

  return useMutation({
    mutationFn: async ({
      id,
      itemId,
      payload,
      data,
      expectedVersion,
      silent,
    }: {
      id?: string;
      itemId?: string;
      payload?: Partial<Item>;
      data?: Partial<Item>;
      expectedVersion?: number;
      silent?: boolean;
    }) => {
      const targetId = id || itemId || '';
      const rawData = payload || data || {};
      const { silent: _silent, ...updateData } = rawData;
      const cached = queryClient.getQueryData<{ item?: Item; version?: number }>(
        itemKeys.byId(effectiveScope, targetId),
      );
      const cachedVersion = cached?.item?.version ?? cached?.version;
      const resolvedVersion =
        expectedVersion ??
        updateData.version ??
        (typeof cachedVersion === 'number' ? cachedVersion : undefined);
      return ItemsService.update(effectiveScope, targetId, updateData, resolvedVersion);
    },
    onSuccess: (updatedResult, variables) => {
      const targetId = variables.id || variables.itemId || '';
      const rawData = variables.payload || variables.data || {};
      const returnedItem = (updatedResult?.item ||
        updatedResult?.paper ||
        updatedResult) as Item;
      const patchData: Partial<Item> = {
        ...rawData,
        ...(returnedItem && typeof returnedItem === 'object' ? returnedItem : {}),
      };

      if (targetId) {
        queryClient.setQueryData(
          itemKeys.byId(effectiveScope, targetId),
          (old: unknown) => patchSingleItemCache(old, patchData),
        );

        queryClient.setQueriesData(
          { queryKey: ['library', 'items', effectiveScope] },
          (old) => patchItemInCacheData(old, targetId, patchData),
        );
      }

      queryClient.invalidateQueries({ queryKey: libraryKeys.tags(effectiveScope) });
      if (patchData.collectionId !== undefined) {
        invalidateCollections(queryClient, effectiveScope);
      }

      const isSilent = Boolean(
        variables.silent || variables.payload?.silent || variables.data?.silent,
      );
      if (!isSilent) {
        toast.success('Item updated', { id: 'item-update' });
      }
    },
    onError: (err: Error, variables) => {
      const targetId = variables?.id || variables?.itemId;
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
  const effectiveScope = scopeId || 'user';

  return useMutation({
    mutationFn: async ({ id, isStarred }: { id: string; isStarred: boolean }) => {
      return StateService.updateState(effectiveScope, id, { isStarred });
    },
    onMutate: async ({ id, isStarred }) => {
      await queryClient.cancelQueries({ queryKey: ['library', 'items', effectiveScope] });
      await queryClient.cancelQueries({ queryKey: itemKeys.byId(effectiveScope, id) });
      await queryClient.cancelQueries({ queryKey: itemKeys.state(effectiveScope, id) });

      const previousLists = queryClient.getQueriesData({
        queryKey: ['library', 'items', effectiveScope],
      });
      const previousItem = queryClient.getQueryData(
        itemKeys.byId(effectiveScope, id),
      );
      const previousState = queryClient.getQueryData(
        itemKeys.state(effectiveScope, id),
      );

      queryClient.setQueriesData(
        { queryKey: ['library', 'items', effectiveScope] },
        (old) => patchItemInCacheData(old, id, { isStarred }),
      );

      queryClient.setQueryData(
        itemKeys.byId(effectiveScope, id),
        (old: unknown) => patchSingleItemCache(old, { isStarred }),
      );

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
    onSuccess: (_, variables) => {
      toast.success(
        variables.isStarred ? 'Added to Starred' : 'Removed from Starred',
        {
          id: 'item-star-toggle',
        },
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: itemKeys.counts(effectiveScope) });
    },
  });
}

export function useDeleteLibraryItemsMutation(scopeId?: string) {
  const queryClient = useQueryClient();
  const effectiveScope = scopeId || 'user';

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
  const effectiveScope = scopeId || 'user';

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
  const effectiveScope = scopeId || 'user';

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
