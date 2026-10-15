'use client';

import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ItemsService,
  CollectionsService,
  getCollections,
  createCollection,
  updateCollection,
  deleteCollection,
  TagsService,
  NotesService,
  StateService,
  SavedSearchesService,
  RelationsService,
  type ItemStateData,
  type ItemTypesResponse,
  type CreateNoteDTO,
  type UpdateNoteDTO,
  type TagWithCount,
  type CreateSavedSearchInput,
  type UpdateSavedSearchInput,
  type SavedSearchConditionGroup,
} from './catalog.service';
import type {
  Item,
  CreateItemDTO,
  UpdateItemDTO,
  CursorPaginationMeta,
  ItemQueryParams,
  Collection,
  CreateCollectionDTO,
  UpdateCollectionDTO,
  Note,
  SavedSearch,
} from '@/features/library/types/library.types';
import { updateLibrarySchemaRegistry } from '@/features/library/types';
import {
  itemKeys,
  libraryKeys,
  collectionKeys,
  tagKeys,
  noteKeys,
  savedSearchKeys,
  relationKeys,
  invalidateCollections,
} from '@/features/library/data/query-keys';

export {
  itemKeys,
  collectionKeys,
  tagKeys,
  noteKeys,
  savedSearchKeys,
  relationKeys,
  invalidateCollections,
};

// ── COLLECTIONS QUERY KEYS & HOOKS ───────────────────────────────────────────

export function useLibraryCountsQuery(scopeId?: string) {
  const targetScope = scopeId || 'user';
  return useQuery({
    queryKey: itemKeys.counts(targetScope),
    queryFn: () => ItemsService.getCounts(targetScope),
    staleTime: 1000 * 30,
  });
}

export type UseCollectionsScopeInput = string | { scopeId?: string; projectId?: string; enabled?: boolean };

export function useCollections(scopeIdOrOptions?: UseCollectionsScopeInput) {
  const scopeId = typeof scopeIdOrOptions === 'string'
    ? scopeIdOrOptions
    : (scopeIdOrOptions?.scopeId || scopeIdOrOptions?.projectId || 'user');
  const explicitEnabled = typeof scopeIdOrOptions === 'object' ? scopeIdOrOptions?.enabled : undefined;

  const queryClient = useQueryClient();

  const collectionsQuery = useQuery({
    queryKey: collectionKeys.all(scopeId),
    queryFn: () => getCollections(scopeId),
    enabled: (explicitEnabled ?? true) && Boolean(scopeId),
    select: (data) => (Array.isArray(data) ? data : (data?.collections || [])),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateCollectionDTO) => {
      const rawParent = data.parentId ?? data.parent ?? null;
      const cleanParentId = rawParent === 'root' || !rawParent ? null : rawParent;
      const payload: CreateCollectionDTO = {
        name: data.name?.trim() || 'Untitled',
        description: data.description?.trim() || '',
        color: data.color || '#2563eb',
        icon: data.icon || '',
        parentId: cleanParentId,
      };
      return createCollection(scopeId, payload);
    },
    onSuccess: () => {
      invalidateCollections(queryClient, scopeId);
      toast.success('Collection created', { id: 'collection-mutation' });
    },
    onError: (err: Error) => {
      toast.error('Failed to create collection', {
        description: err.message || 'Please check the name and try again.',
        id: 'collection-mutation',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: UpdateCollectionDTO & { collectionId: string }) => {
      const { collectionId, ...rest } = data;
      const rawParent = rest.parentId ?? (rest as { parent?: string | null }).parent ?? undefined;
      const cleanParentId = rawParent === 'root' ? null : rawParent;
      const payload: UpdateCollectionDTO = {
        name: rest.name !== undefined ? rest.name.trim() : undefined,
        description: rest.description !== undefined ? rest.description.trim() : undefined,
        color: rest.color,
        icon: rest.icon,
      };
      if (rawParent !== undefined) {
        payload.parentId = cleanParentId;
      }
      return updateCollection(scopeId, collectionId, payload);
    },
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: collectionKeys.all(scopeId) });
      const previousCollections = queryClient.getQueryData<Collection[] | { collections: Collection[] }>(collectionKeys.all(scopeId));

      if (previousCollections) {
        const updateList = (cols: Collection[]) =>
          cols.map((col) =>
            col.id === data.collectionId
              ? {
                  ...col,
                  ...(data.name !== undefined ? { name: data.name.trim() } : {}),
                  ...(data.color !== undefined ? { color: data.color } : {}),
                  ...(data.icon !== undefined ? { icon: data.icon } : {}),
                  ...(data.parentId !== undefined ? { parentId: data.parentId } : {}),
                }
              : col,
          );

        if (Array.isArray(previousCollections)) {
          queryClient.setQueryData(collectionKeys.all(scopeId), updateList(previousCollections));
        } else if (previousCollections?.collections) {
          queryClient.setQueryData(collectionKeys.all(scopeId), {
            ...previousCollections,
            collections: updateList(previousCollections.collections),
          });
        }
      }

      return { previousCollections };
    },
    onError: (err: Error, _variables, context) => {
      if (context?.previousCollections) {
        queryClient.setQueryData(collectionKeys.all(scopeId), context.previousCollections);
      }
      toast.error('Failed to update collection', {
        description: err.message || 'Please try again.',
        id: 'collection-mutation',
      });
    },
    onSettled: () => {
      invalidateCollections(queryClient, scopeId);
    },
    onSuccess: () => {
      toast.success('Collection updated', { id: 'collection-mutation' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (collectionId: string) => deleteCollection(scopeId, collectionId),
    onSuccess: () => {
      invalidateCollections(queryClient, scopeId);
      toast.success('Collection deleted', {
        description: 'Contained items were unfiled to library, not deleted.',
        id: 'collection-mutation',
      });
    },
    onError: (err: Error) => {
      toast.error('Failed to delete collection', {
        description: err.message || 'Please try again.',
        id: 'collection-mutation',
      });
    },
  });

  const collections = collectionsQuery.data ?? [];

  const state = {
    collections,
    isLoading: collectionsQuery.isLoading,
    isError: collectionsQuery.isError,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };

  const actions = {
    create: createMutation.mutate,
    createAsync: createMutation.mutateAsync,
    update: updateMutation.mutate,
    updateAsync: updateMutation.mutateAsync,
    delete: deleteMutation.mutate,
    deleteAsync: deleteMutation.mutateAsync,
    refetch: collectionsQuery.refetch,
  };

  return {
    state,
    actions,
    collections,
    isLoading: collectionsQuery.isLoading,
    isError: collectionsQuery.isError,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    createCollection: createMutation.mutateAsync,
    updateCollection: updateMutation.mutateAsync,
    deleteCollection: deleteMutation.mutateAsync,
    refetch: collectionsQuery.refetch,
  };
}

export function useCollectionsQuery(scopeId?: string) {
  const targetScope = scopeId || 'user';
  return useQuery({
    queryKey: libraryKeys.collections(targetScope),
    queryFn: () => getCollections(targetScope),
    select: (data) => (Array.isArray(data) ? data : (data?.collections || [])),
    staleTime: 1000 * 60,
  });
}

export function useCreateCollectionMutation(scopeId?: string) {
  const queryClient = useQueryClient();
  const effectiveScope = scopeId || 'user';

  return useMutation({
    mutationFn: (data: CreateCollectionDTO) => {
      const rawParent = data.parentId ?? data.parent ?? null;
      const cleanParentId = rawParent === 'root' || !rawParent ? null : rawParent;
      const payload: CreateCollectionDTO = {
        name: data.name?.trim() || 'Untitled',
        description: data.description?.trim() || '',
        color: data.color || '#2563eb',
        icon: data.icon || '',
        parentId: cleanParentId,
      };
      return createCollection(effectiveScope, payload);
    },
    onSuccess: () => {
      invalidateCollections(queryClient, effectiveScope);
      toast.success('Collection created', { id: 'collection-create' });
    },
    onError: (err: Error) => {
      toast.error('Failed to create collection', {
        description: err.message || 'Please try again.',
        id: 'collection-create',
      });
    },
  });
}

export function useDetachItemFromCollectionMutation(scopeId?: string) {
  const queryClient = useQueryClient();
  const effectiveScope = scopeId || 'user';

  return useMutation({
    mutationFn: ({ collectionId, itemId }: { collectionId: string; itemId: string }) =>
      CollectionsService.detachItem(effectiveScope, collectionId, itemId),
    onSuccess: () => {
      invalidateCollections(queryClient, effectiveScope);
      queryClient.invalidateQueries({ queryKey: itemKeys.all(effectiveScope) });
      toast.success('Removed item from collection', {
        description: 'Item remains safely in your library (now in Unfiled Items if not in other collections).',
        id: 'detach-item',
      });
    },
    onError: (err: Error) => {
      toast.error('Failed to remove item from collection', {
        description: err.message || 'Please try again.',
      });
    },
  });
}

export function useBatchDetachItemsMutation(scopeId?: string) {
  const queryClient = useQueryClient();
  const effectiveScope = scopeId || 'user';

  return useMutation({
    mutationFn: async ({ collectionId, itemIds }: { collectionId: string; itemIds: string[] }) => {
      await CollectionsService.bulkDetachItems(effectiveScope, collectionId, itemIds);
    },
    onSuccess: (_data, variables) => {
      invalidateCollections(queryClient, effectiveScope);
      queryClient.invalidateQueries({ queryKey: itemKeys.all(effectiveScope) });
      toast.success(`Removed ${variables.itemIds.length} item(s) from collection`, {
        description: 'Items remain safely in your library (now in Unfiled Items if not in other collections).',
        id: 'batch-detach-items',
      });
    },
    onError: (err: Error) => {
      toast.error('Failed to remove items from collection', {
        description: err.message || 'Please try again.',
      });
    },
  });
}

// ── ITEMS QUERY HOOKS ────────────────────────────────────────────────────────

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

  const allItemsQuery = useQuery({
    queryKey: itemKeys.all(targetScope),
    queryFn: ({ signal }) => ItemsService.getAll(targetScope, undefined, { signal }),
    enabled: options.enabled ?? true,
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
    mutationFn: (data: CreateItemDTO & { silent?: boolean }) => ItemsService.create(targetScope, collectionId || '', data),
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
    mutationFn: async ({ id, data, expectedVersion, silent }: { id: string; data: UpdateItemDTO; expectedVersion?: number; silent?: boolean }) => {
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
    mutationFn: async ({ id, silent, itemCollectionId }: { id: string; silent?: boolean; itemCollectionId?: string }) => {
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
    idOrPayload: string | ({ id?: string; paperId?: string; data?: UpdateItemDTO; silent?: boolean; expectedVersion?: number } & UpdateItemDTO),
    maybeData?: UpdateItemDTO,
    maybeOptions?: { silent?: boolean; expectedVersion?: number }
  ) => {
    if (typeof idOrPayload === 'string') {
      return updateMutation.mutateAsync({ id: idOrPayload, data: maybeData || {}, expectedVersion: maybeOptions?.expectedVersion, silent: maybeOptions?.silent });
    }
    const { id, paperId, data, silent, expectedVersion, ...rest } = idOrPayload;
    const targetItemId = id || paperId || '';
    const targetData = (data || rest) as UpdateItemDTO;
    return updateMutation.mutateAsync({ id: targetItemId, data: targetData, expectedVersion, silent });
  };

  const deleteItemHandler = (
    idOrPayload: string | { paperId?: string; id?: string; silent?: boolean; collectionId?: string },
    maybeOptions?: { silent?: boolean }
  ) => {
    const targetItemId = typeof idOrPayload === 'string' ? idOrPayload : (idOrPayload.id || idOrPayload.paperId || '');
    const silent = typeof idOrPayload === 'object' && 'silent' in idOrPayload ? idOrPayload.silent : maybeOptions?.silent;
    const itemCollectionId = typeof idOrPayload === 'object' ? idOrPayload.collectionId : undefined;
    return deleteMutation.mutateAsync({ id: targetItemId, silent, itemCollectionId });
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
      const toastId = toast.loading(`Moving ${ids.length} item(s) to trash...`, { id: 'batch-trash' });
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
          description: err instanceof Error ? err.message : 'Could not move selected documents to trash.',
          id: toastId,
        });
      }
    },
    batchMoveItems: async (ids: string[], targetCollectionId: string | null) => {
      if (!ids.length) return;
      const toastId = toast.loading(`Moving ${ids.length} item(s)...`, { id: 'batch-move' });
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

export function useItemTypes(scopeIdOrOptions?: string | { scopeId?: string; projectId?: string }) {
  const sid = typeof scopeIdOrOptions === 'string'
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

/**
 * Safely patch an item inside TanStack Query cache across all formats:
 * - Paginated list: { items: Item[], ... }
 * - Infinite query: { pages: [{ items: Item[] }], pageParams: [] }
 * - Raw array: Item[]
 */
function patchItemInCacheData(
  oldData: unknown,
  targetId: string,
  patch: Partial<Item>,
): unknown {
  if (!oldData || typeof oldData !== 'object') return oldData;
  const data = oldData as {
    items?: Item[];
    pages?: Array<{ items?: Item[] }>;
  };
  if (Array.isArray(data.items)) {
    return {
      ...data,
      items: data.items.map((it: Item) =>
        it.id === targetId ? { ...it, ...patch } : it,
      ),
    };
  }
  if (Array.isArray(data.pages)) {
    return {
      ...data,
      pages: data.pages.map((page) => {
        if (!page || !Array.isArray(page.items)) return page;
        return {
          ...page,
          items: page.items.map((it: Item) =>
            it.id === targetId ? { ...it, ...patch } : it,
          ),
        };
      }),
    };
  }
  if (Array.isArray(oldData)) {
    return (oldData as Item[]).map((it: Item) =>
      it.id === targetId ? { ...it, ...patch } : it,
    );
  }
  return oldData;
}

/**
 * Safely patch single item detail cache ({ item: Item, paper: Item } or Item)
 */
function patchSingleItemCache<T>(oldData: T, patch: Partial<Item>): T {
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

export function useItemState(scopeId?: string, itemId?: string | null) {
  const queryClient = useQueryClient();
  const effectiveScope = scopeId || 'user';
  const effectiveItemId = itemId || '';

  const stateQuery = useQuery({
    queryKey: itemKeys.state(effectiveScope, effectiveItemId),
    queryFn: async () => {
      if (!effectiveItemId) return null;
      return StateService.getState(effectiveScope, effectiveItemId);
    },
    enabled: Boolean(effectiveItemId),
    staleTime: 30_000,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { readStatus?: 'unread' | 'reading' | 'completed'; rating?: number }) => {
      if (!effectiveItemId) throw new Error('Item ID required');
      return StateService.updateState(effectiveScope, effectiveItemId, data);
    },
    onSuccess: (newData) => {
      if (effectiveItemId) {
        const patch: Partial<Item> = {
          readStatus: newData.readStatus,
          rating: newData.rating,
          lastReadAt: newData.lastReadAt,
        };
        queryClient.setQueryData(itemKeys.state(effectiveScope, effectiveItemId), newData);
        queryClient.setQueryData(
          itemKeys.byId(effectiveScope, effectiveItemId),
          (old) => patchSingleItemCache(old, patch),
        );
        queryClient.setQueriesData(
          { queryKey: ['library', 'items', effectiveScope] },
          (old) => patchItemInCacheData(old, effectiveItemId, patch),
        );
      }
      toast.success('Reading state updated', { id: 'library-reading-state' });
    },
    onError: (err: Error | { message?: string }) => {
      toast.error(err?.message || 'Failed to update reading state', { id: 'library-reading-state' });
    },
  });

  const markAsReadMutation = useMutation({
    mutationFn: async () => {
      if (!effectiveItemId) throw new Error('Item ID required');
      return StateService.markAsRead(effectiveScope, effectiveItemId);
    },
    onSuccess: (newData) => {
      if (effectiveItemId) {
        const patch: Partial<Item> = {
          readStatus: newData.readStatus,
          rating: newData.rating,
          lastReadAt: newData.lastReadAt,
        };
        queryClient.setQueryData(itemKeys.state(effectiveScope, effectiveItemId), newData);
        queryClient.setQueryData(
          itemKeys.byId(effectiveScope, effectiveItemId),
          (old) => patchSingleItemCache(old, patch),
        );
        queryClient.setQueriesData(
          { queryKey: ['library', 'items', effectiveScope] },
          (old) => patchItemInCacheData(old, effectiveItemId, patch),
        );
      }
      toast.success('Marked as read', { id: 'library-reading-state' });
    },
    onError: (err: Error | { message?: string }) => {
      toast.error(err?.message || 'Failed to mark as read', { id: 'library-reading-state' });
    },
  });

  const state = {
    itemState: stateQuery.data as ItemStateData | null,
    isLoading: stateQuery.isLoading,
    isUpdating: updateMutation.isPending || markAsReadMutation.isPending,
  };

  const actions = {
    updateState: updateMutation.mutateAsync,
    markAsRead: markAsReadMutation.mutateAsync,
  };

  return {
    state,
    actions,
    ...state,
    ...actions,
    data: stateQuery.data,
  };
}

export function useTrash(scopeId: string = 'user', options?: { enabled?: boolean }) {
  const queryClient = useQueryClient();
  const effectiveScope = scopeId || 'user';

  const trashQuery = useQuery({
    queryKey: itemKeys.trash(effectiveScope),
    queryFn: ({ signal }) => ItemsService.getAll(effectiveScope, { view: 'trash' }, { signal }),
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
        itemKeys.byId(effectiveScope, targetId)
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
      const returnedItem = (updatedResult?.item || updatedResult?.paper || updatedResult) as Item;
      const patchData: Partial<Item> = {
        ...rawData,
        ...(returnedItem && typeof returnedItem === 'object' ? returnedItem : {}),
      };

      if (targetId) {
        // 1. Direct cache update for detail view
        queryClient.setQueryData(
          itemKeys.byId(effectiveScope, targetId),
          (old: unknown) => patchSingleItemCache(old, patchData),
        );

        // 2. Direct cache patch for all active item lists (instant update, zero table flicker)
        queryClient.setQueriesData(
          { queryKey: ['library', 'items', effectiveScope] },
          (old) => patchItemInCacheData(old, targetId, patchData),
        );
      }

      // 3. Invalidate auxiliary caches only
      queryClient.invalidateQueries({ queryKey: libraryKeys.tags(effectiveScope) });
      if (patchData.collectionId !== undefined) {
        invalidateCollections(queryClient, effectiveScope);
      }

      const isSilent = Boolean(
        variables.silent ||
        variables.payload?.silent ||
        variables.data?.silent
      );
      if (!isSilent) {
        toast.success('Item updated', { id: 'item-update' });
      }
    },
    onError: (err: Error, variables) => {
      const targetId = variables?.id || variables?.itemId;
      if (targetId) {
        queryClient.invalidateQueries({ queryKey: itemKeys.byId(effectiveScope, targetId) });
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
      // Cancel queries in flight to prevent overwriting optimistic state
      await queryClient.cancelQueries({ queryKey: ['library', 'items', effectiveScope] });
      await queryClient.cancelQueries({ queryKey: itemKeys.byId(effectiveScope, id) });
      await queryClient.cancelQueries({ queryKey: itemKeys.state(effectiveScope, id) });

      // Snapshot previous state for rollback
      const previousLists = queryClient.getQueriesData({
        queryKey: ['library', 'items', effectiveScope],
      });
      const previousItem = queryClient.getQueryData(itemKeys.byId(effectiveScope, id));
      const previousState = queryClient.getQueryData(itemKeys.state(effectiveScope, id));

      // Optimistically update lists cache
      queryClient.setQueriesData(
        { queryKey: ['library', 'items', effectiveScope] },
        (old) => patchItemInCacheData(old, id, { isStarred }),
      );

      // Optimistically update detail cache
      queryClient.setQueryData(
        itemKeys.byId(effectiveScope, id),
        (old: unknown) => patchSingleItemCache(old, { isStarred }),
      );

      // Optimistically update state cache
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
      // Rollback to snapshots
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
      toast.success(variables.isStarred ? 'Added to Starred' : 'Removed from Starred', {
        id: 'item-star-toggle',
      });
    },
    onSettled: () => {
      // Sync badge count in sidebar without table flicker
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
      invalidateCollections(queryClient, effectiveScope);
      toast.success(`Moved ${ids.length} ${ids.length === 1 ? 'item' : 'items'} to trash`, { id: 'item-delete' });
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
      invalidateCollections(queryClient, effectiveScope);
      toast.success(`Restored ${ids.length} ${ids.length === 1 ? 'item' : 'items'}`, { id: 'item-restore' });
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
      invalidateCollections(queryClient, effectiveScope);
      toast.success(`Permanently deleted ${ids.length} ${ids.length === 1 ? 'item' : 'items'}`, { id: 'item-purge' });
    },
    onError: (err: Error) => {
      toast.error('Failed to permanently delete items', {
        description: err.message || 'Please try again.',
        id: 'item-purge',
      });
    },
  });
}

export function useItemMetadataSourcesQuery(
  scopeId?: string | null,
  itemId?: string | null,
  options?: { enabled?: boolean },
) {
  const effectiveScope = scopeId || 'user';
  return useQuery({
    queryKey: libraryKeys.itemMetadataSources(effectiveScope, itemId || undefined),
    queryFn: () => ItemsService.getMetadataSources(effectiveScope, itemId!),
    enabled: !!itemId && (options?.enabled ?? true),
  });
}

export type { ItemMetadataSourceItem, ItemMetadataSourcesResponse } from './catalog.service';


// ── TAGS QUERY HOOKS ──────────────────────────────────────────────────────────

export function useTags(scopeId?: string) {
  const queryClient = useQueryClient();
  const effectiveScope = scopeId || 'user';

  const tagsQuery = useQuery({
    queryKey: tagKeys.list(effectiveScope),
    queryFn: () => TagsService.list(effectiveScope),
    enabled: true,
    staleTime: 30_000,
  });

  const createMutation = useMutation({
    mutationFn: ({ name, color, type }: { name: string; color?: string; type?: string }) =>
      TagsService.create(effectiveScope, name, color, type),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tagKeys.list(effectiveScope) });
      queryClient.invalidateQueries({ queryKey: itemKeys.all(effectiveScope) });
      toast.success('Tag created', { id: 'tag-mutation' });
    },
    onError: (err: Error) => {
      toast.error('Failed to create tag', {
        description: err.message || 'Please check the name and try again.',
        id: 'tag-mutation',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (tagId: string) => TagsService.delete(effectiveScope, tagId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tagKeys.list(effectiveScope) });
      queryClient.invalidateQueries({ queryKey: itemKeys.all(effectiveScope) });
      toast.success('Tag deleted', { id: 'tag-mutation' });
    },
    onError: (err: Error) => {
      toast.error('Failed to delete tag', {
        description: err.message || 'Please try again.',
        id: 'tag-mutation',
      });
    },
  });

  const deleteAutomaticMutation = useMutation({
    mutationFn: () => TagsService.deleteAutomatic(effectiveScope),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: tagKeys.list(effectiveScope) });
      queryClient.invalidateQueries({ queryKey: itemKeys.all(effectiveScope) });
      toast.success(`Removed ${data?.count ?? 0} automatic tag(s)`, { id: 'tag-mutation' });
    },
    onError: (err: Error) => {
      toast.error('Failed to delete automatic tags', {
        description: err.message || 'Please try again.',
        id: 'tag-mutation',
      });
    },
  });

  return {
    tags: tagsQuery.data || [],
    isLoading: tagsQuery.isLoading,
    isError: tagsQuery.isError,
    error: tagsQuery.error,
    refetch: tagsQuery.refetch,
    createTag: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    deleteTag: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
    deleteAutomaticTags: deleteAutomaticMutation.mutateAsync,
    isDeletingAutomatic: deleteAutomaticMutation.isPending,
  };
}


// ── NOTES QUERY HOOKS ─────────────────────────────────────────────────────────

export function useNotes(scopeId?: string, itemId?: string) {
  const queryClient = useQueryClient();

  const notesQuery = useQuery({
    queryKey: noteKeys.list(scopeId, itemId),
    queryFn: () => {
      if (!itemId) return [];
      return NotesService.list(scopeId, itemId);
    },
    enabled: !!itemId,
  });

  const createMutation = useMutation({
    mutationFn: (dto: CreateNoteDTO) =>
      NotesService.create(scopeId, { ...dto, itemId: dto.itemId !== undefined ? dto.itemId : itemId }),
    onSuccess: (_data, dto) => {
      const targetItemId = (dto.itemId !== undefined ? dto.itemId : itemId) ?? undefined;
      queryClient.invalidateQueries({ queryKey: noteKeys.list(scopeId, targetItemId) });
      queryClient.invalidateQueries({ queryKey: noteKeys.all(scopeId) });
      if (targetItemId) {
        queryClient.invalidateQueries({ queryKey: itemKeys.byId(scopeId, targetItemId) });
      }
      queryClient.invalidateQueries({ queryKey: itemKeys.all(scopeId) });
      toast.success('Note saved', { id: 'note-mutation-toast' });
    },
    onError: (err: Error) => {
      toast.error('Failed to create note', {
        description: err.message || 'Please try again.',
        id: 'note-mutation-toast',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      version,
      dto,
    }: {
      id: string;
      version: number;
      dto: UpdateNoteDTO;
    }) => NotesService.update(scopeId, id, version, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: noteKeys.list(scopeId, itemId) });
      queryClient.invalidateQueries({ queryKey: noteKeys.all(scopeId) });
      toast.success('Note updated', { id: 'note-mutation-toast' });
    },
    onError: (err: Error) => {
      toast.error('Failed to update note', {
        description: err.message || 'Please try again.',
        id: 'note-mutation-toast',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id, version }: { id: string; version?: number }) =>
      NotesService.delete(scopeId, id, version),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: noteKeys.list(scopeId, itemId) });
      queryClient.invalidateQueries({ queryKey: noteKeys.all(scopeId) });
      if (itemId) {
        queryClient.invalidateQueries({ queryKey: itemKeys.byId(scopeId, itemId) });
      }
      queryClient.invalidateQueries({ queryKey: itemKeys.all(scopeId) });
      toast.success('Note deleted', { id: 'note-mutation-toast' });
    },
    onError: (err: Error) => {
      toast.error('Failed to delete note', {
        description: err.message || 'Please try again.',
        id: 'note-mutation-toast',
      });
    },
  });

  const state = {
    notes: (notesQuery.data || []) as Note[],
    isLoading: notesQuery.isLoading,
    isError: notesQuery.isError,
    error: notesQuery.error,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };

  const actions = {
    refetch: notesQuery.refetch,
    createNote: createMutation.mutateAsync,
    updateNote: (id: string, version: number, dto: UpdateNoteDTO) =>
      updateMutation.mutateAsync({ id, version, dto }),
    deleteNote: (id: string, version?: number) =>
      deleteMutation.mutateAsync({ id, version }),
  };

  return {
    state,
    actions,
    ...state,
    ...actions,
  };
}


// ── SAVED SEARCHES QUERY HOOKS ────────────────────────────────────────────────

export const invalidateSavedSearches = (qc: QueryClient, scopeId?: string) => {
  qc.invalidateQueries({ queryKey: savedSearchKeys.all(scopeId) });
};

export function useSavedSearches(scopeId?: string) {
  const queryClient = useQueryClient();
  const effectiveScope = scopeId || 'user';

  const savedSearchesQuery = useQuery({
    queryKey: savedSearchKeys.all(effectiveScope),
    queryFn: () => SavedSearchesService.getAll(effectiveScope),
    enabled: true,
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateSavedSearchInput) =>
      SavedSearchesService.create(effectiveScope, data),
    onSuccess: () => {
      invalidateSavedSearches(queryClient, effectiveScope);
      toast.success('Smart collection created', { id: 'saved-search-mutation' });
    },
    onError: (err: Error) => {
      toast.error('Failed to create smart collection', {
        description: err.message || 'Please check your conditions and try again.',
        id: 'saved-search-mutation',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSavedSearchInput }) =>
      SavedSearchesService.update(effectiveScope, id, data),
    onSuccess: (_, variables) => {
      invalidateSavedSearches(queryClient, effectiveScope);
      queryClient.invalidateQueries({
        queryKey: savedSearchKeys.byId(effectiveScope, variables.id),
      });
      toast.success('Smart collection updated', { id: 'saved-search-mutation' });
    },
    onError: (err: Error) => {
      toast.error('Failed to update smart collection', {
        description: err.message,
        id: 'saved-search-mutation',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => SavedSearchesService.delete(effectiveScope, id),
    onSuccess: () => {
      invalidateSavedSearches(queryClient, effectiveScope);
      toast.success('Smart collection deleted', { id: 'saved-search-mutation' });
    },
    onError: (err: Error) => {
      toast.error('Failed to delete smart collection', {
        description: err.message,
        id: 'saved-search-mutation',
      });
    },
  });

  const previewMutation = useMutation({
    mutationFn: (conditions: SavedSearchConditionGroup) =>
      SavedSearchesService.preview(effectiveScope, conditions),
  });

  return {
    savedSearches: savedSearchesQuery.data || [],
    isLoading: savedSearchesQuery.isLoading,
    isError: savedSearchesQuery.isError,
    error: savedSearchesQuery.error,
    createSavedSearch: createMutation.mutateAsync,
    updateSavedSearch: updateMutation.mutateAsync,
    deleteSavedSearch: deleteMutation.mutateAsync,
    previewConditions: previewMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isPreviewing: previewMutation.isPending,
    refetch: savedSearchesQuery.refetch,
  };
}

export function useSavedSearchResults(
  scopeId: string | undefined,
  id: string | null,
  params?: {
    limit?: number;
    page?: number;
    cursor?: string;
    sortBy?: string;
    sortOrder?: string;
  },
) {
  const effectiveScope = scopeId || null;

  return useQuery({
    queryKey: savedSearchKeys.results(effectiveScope ?? undefined, id || '', params),
    queryFn: () => {
      if (!id) return null;
      return SavedSearchesService.getResults(effectiveScope || 'user', id, params);
    },
    enabled: !!id && !!effectiveScope,
  });
}

// ── RELATIONS QUERY HOOKS ─────────────────────────────────────────────────────

export function useRelations(
  scopeIdOrOptions?: string | { scopeId?: string; projectId?: string; enabled?: boolean },
  itemId?: string,
  options?: { enabled?: boolean },
) {
  const scopeId = typeof scopeIdOrOptions === 'string'
    ? scopeIdOrOptions
    : (scopeIdOrOptions?.scopeId || scopeIdOrOptions?.projectId || 'user');
  const explicitEnabled =
    (typeof scopeIdOrOptions === 'object' ? scopeIdOrOptions?.enabled : undefined) ??
    options?.enabled ??
    true;

  const queryClient = useQueryClient();
  const effectiveItemId = itemId || '';

  const relationsQuery = useQuery({
    queryKey: relationKeys.all(scopeId, effectiveItemId),
    queryFn: () => RelationsService.getRelated(scopeId || '', effectiveItemId),
    enabled: explicitEnabled && Boolean(effectiveItemId && effectiveItemId !== 'user'),
    select: (data) => ({
      items: data.relatedItems || [],
      total: data.total || 0,
    }),
  });

  const linkMutation = useMutation({
    mutationFn: ({
      targetItemId,
      targetItemIds,
      relationType = 'related',
    }: {
      targetItemId?: string;
      targetItemIds?: string[];
      relationType?: string;
    }) => {
      const targets = targetItemIds && targetItemIds.length > 0
        ? targetItemIds
        : (targetItemId ? [targetItemId] : []);
      return RelationsService.link(scopeId || '', effectiveItemId, targets.length === 1 ? targets[0] : targets, relationType);
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: relationKeys.all(scopeId, effectiveItemId),
      });
      const targets = variables.targetItemIds || (variables.targetItemId ? [variables.targetItemId] : []);
      for (const tId of targets) {
        queryClient.invalidateQueries({
          queryKey: relationKeys.all(scopeId, tId),
        });
      }
      const count = targets.length;
      toast.success(
        count > 1 ? `Successfully linked ${count} references` : 'Reference linked',
        { id: 'relation-mutation' },
      );
    },
    onError: (err: Error) => {
      toast.error('Failed to link references', {
        description: err.message || 'Please try again.',
        id: 'relation-mutation',
      });
    },
  });

  const unlinkMutation = useMutation({
    mutationFn: (variables: { targetItemId: string; relationType?: string }) =>
      RelationsService.unlink(scopeId || '', effectiveItemId, variables.targetItemId, variables.relationType),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: relationKeys.all(scopeId, effectiveItemId),
      });
      if (variables.targetItemId) {
        queryClient.invalidateQueries({
          queryKey: relationKeys.all(scopeId, variables.targetItemId),
        });
      }
      toast.success('Reference unlinked', { id: 'relation-mutation' });
    },
    onError: (err: Error) => {
      toast.error('Failed to unlink reference', {
        description: err.message || 'Please try again.',
        id: 'relation-mutation',
      });
    },
  });

  return {
    relatedItems: relationsQuery.data?.items ?? [],
    total: relationsQuery.data?.total ?? 0,
    isLoading: relationsQuery.isLoading,
    error: relationsQuery.error,
    link: linkMutation.mutateAsync,
    unlink: unlinkMutation.mutateAsync,
    isLinking: linkMutation.isPending,
    isUnlinking: unlinkMutation.isPending,
  };
}


// ── CONVERSION QUERY HOOKS ────────────────────────────────────────────────────

export interface DroppedField {
  field: string;
  label: string;
  value: unknown;
}

export interface FieldMappingChange {
  fromField: string;
  toField: string;
  value: unknown;
  rule: 'direct' | 'base-semantic' | 'special-rule';
}

export interface CreatorRoleChange {
  creator: Record<string, unknown>;
  fromRole: string;
  toRole: string;
  reason: 'preserved' | 'primary-fallback' | 'secondary-fallback';
}

export interface TypeConversionPreview {
  sourceType: string;
  targetType: string;
  preservedFields: string[];
  mappedFields: FieldMappingChange[];
  droppedFields: DroppedField[];
  creatorChanges: CreatorRoleChange[];
  newAvailableFields?: Array<{
    field: string;
    label: string;
    category?: string;
    type?: string;
  }>;
  projectedItem: Record<string, unknown>;
  unmappedRetained: Record<string, unknown>;
  hasLoss: boolean;
}

export function useItemTypeConversion(scopeId?: string) {
  const queryClient = useQueryClient();
  const effectiveScopeId = scopeId || 'user';

  const previewMutation = useMutation({
    mutationFn: ({
      itemId,
      targetType,
      retainUnmappedInExtra = true,
    }: {
      itemId: string;
      targetType: string;
      retainUnmappedInExtra?: boolean;
    }) =>
      ItemsService.previewConvertType(
        effectiveScopeId,
        itemId,
        targetType,
        retainUnmappedInExtra,
      ).then((res: unknown): TypeConversionPreview => (res as { preview?: TypeConversionPreview; data?: TypeConversionPreview })?.preview ?? (res as { data?: TypeConversionPreview })?.data ?? (res as TypeConversionPreview)),
    onError: (err: Error) => {
      toast.error('Preview failed', {
        description: err.message || 'Failed to preview type conversion.',
        id: 'type-conversion-preview',
      });
    },
  });

  const convertMutation = useMutation({
    mutationFn: ({
      itemId,
      targetType,
      expectedVersion,
      retainUnmappedInExtra = true,
      silent = false,
    }: {
      itemId: string;
      targetType: string;
      expectedVersion?: number;
      retainUnmappedInExtra?: boolean;
      silent?: boolean;
    }) =>
      ItemsService.convertType(
        effectiveScopeId,
        itemId,
        targetType,
        expectedVersion,
        retainUnmappedInExtra,
      ),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: itemKeys.byId(effectiveScopeId, variables.itemId),
      });
      queryClient.invalidateQueries({ queryKey: itemKeys.all(effectiveScopeId) });
      if (!variables.silent) {
        toast.success('Item type converted', {
          description: variables.retainUnmappedInExtra ? 'Unmapped fields have been preserved in Extra.' : undefined,
          id: 'type-conversion',
        });
      }
    },
    onError: (err: Error) => {
      toast.error('Conversion failed', {
        description: err.message || 'Could not convert item type.',
        id: 'type-conversion',
      });
    },
  });

  return {
    previewAsync: previewMutation.mutateAsync,
    convertAsync: convertMutation.mutateAsync,
    isPreviewing: previewMutation.isPending,
    isConverting: convertMutation.isPending,
    previewData: previewMutation.data as TypeConversionPreview | undefined,
    conversionResult: convertMutation.data,
  };
}

export const useConversion = useItemTypeConversion;
