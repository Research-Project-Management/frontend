'use client';

import { useState, useCallback, useMemo, type MouseEvent } from 'react';
import { useQuery, useInfiniteQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ItemService,
  ItemsService,
  CollectionsService,
  CollectionService,
  getCollections,
  createCollection,
  updateCollection,
  deleteCollection,
  TagsService,
  TagService,
  NotesService,
  NoteService,
  StateService,
  ItemStateService,
  ItemTypesService,
  SavedSearchesService,
  SavedSearchService,
  RelationsService,
  RelationService,
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
} from '../../types/library.types';
import { updateLibrarySchemaRegistry } from '../../types';
import { getPublicationVenue } from '../../domain';
import { itemKeys, libraryKeys } from '../query-keys';

export { itemKeys };

// ── COLLECTIONS QUERY KEYS & HOOKS ───────────────────────────────────────────

export const collectionKeys = {
  all: (scopeId?: string) => libraryKeys.collections(scopeId),
  byId: (scopeId?: string, collectionId?: string) => libraryKeys.collection(scopeId, collectionId),
};

export const invalidateCollections = (qc: QueryClient, scopeId?: string) => {
  qc.invalidateQueries({ queryKey: libraryKeys.collections(scopeId) });
  qc.invalidateQueries({ queryKey: libraryKeys.collectionsList(scopeId) });
  qc.invalidateQueries({ queryKey: itemKeys.counts(scopeId) });
};

export function useLibraryCountsQuery(scopeId?: string) {
  const targetScope = scopeId || 'user';
  return useQuery({
    queryKey: itemKeys.counts(targetScope),
    queryFn: () => ItemsService.getCounts(targetScope),
    staleTime: 1000 * 30,
  });
}
export const useLibraryCounts = useLibraryCountsQuery;

export type UseCollectionsScopeInput = string | { scopeId?: string; projectId?: string };

export function useCollections(scopeIdOrOptions?: UseCollectionsScopeInput) {
  const scopeId = typeof scopeIdOrOptions === 'string'
    ? scopeIdOrOptions
    : (scopeIdOrOptions?.scopeId || scopeIdOrOptions?.projectId || 'user');

  const queryClient = useQueryClient();

  const collectionsQuery = useQuery({
    queryKey: collectionKeys.all(scopeId),
    queryFn: () => getCollections(scopeId),
    enabled: true,
    select: (data) => data.collections || [],
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
    onError: (err: any) => {
      toast.error('Failed to create collection', {
        description: err?.message || 'Please check the name and try again.',
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
      const previousCollections = queryClient.getQueryData<any>(collectionKeys.all(scopeId));

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
    onError: (err: any, _variables, context) => {
      if (context?.previousCollections) {
        queryClient.setQueryData(collectionKeys.all(scopeId), context.previousCollections);
      }
      toast.error('Failed to update collection', {
        description: err?.message || 'Please try again.',
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
    onError: (err: any) => {
      toast.error('Failed to delete collection', {
        description: err?.message || 'Please try again.',
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

export function useLibraryCollectionTreeQuery(scopeId?: string) {
  const targetScope = scopeId || 'user';
  return useQuery({
    queryKey: libraryKeys.collections(targetScope),
    queryFn: async () => {
      const res = await CollectionsService.getTree(targetScope);
      return res?.tree || [];
    },
    staleTime: 1000 * 60,
  });
}

export function useCollectionsQuery(scopeId?: string) {
  const targetScope = scopeId || 'user';
  return useQuery({
    queryKey: libraryKeys.collectionsList(targetScope),
    queryFn: async () => {
      const res = await CollectionsService.getAll(targetScope);
      return res?.collections || [];
    },
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
    onError: (err: any) => {
      toast.error('Failed to create collection', {
        description: err?.message || 'Please try again.',
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
      toast.success('Removed item from collection');
    },
    onError: (err: any) => {
      toast.error('Failed to remove item from collection', {
        description: err?.message || 'Please try again.',
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
      toast.success(`Removed ${variables.itemIds.length} item(s) from collection`);
    },
    onError: (err: any) => {
      toast.error('Failed to remove items from collection', {
        description: err?.message || 'Please try again.',
      });
    },
  });
}

// ── ITEMS QUERY HOOKS ────────────────────────────────────────────────────────

export function useViewItems(
  scopeId?: string,
  view: 'all' | 'recent' | 'unfiled' | 'trash' | 'my-publications' | 'publications' = 'all',
  search?: string,
) {
  const targetScope = scopeId || 'user';
  return useQuery({
    queryKey: itemKeys.byView(targetScope, view, search),
    queryFn: () =>
      ItemService.getAll(targetScope, {
        view,
        search: search?.trim() || undefined,
      }),
    enabled: true,
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
    queryFn: () => ItemService.getAll(targetScope),
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
    queryFn: () => ItemService.getById(targetScope, activeItemId),
    enabled: Boolean(activeItemId),
    select: (data) => (data?.item ? (data.item as Item) : (data as Item)),
  });

  const collectionItemsQuery = useQuery({
    queryKey: itemKeys.byCollection(targetScope, collectionId || ''),
    queryFn: () => ItemService.getByCollection(targetScope, collectionId || ''),
    enabled: Boolean(collectionId),
    select: (data) => (data?.items || data?.papers || []) as Item[],
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateItemDTO & { silent?: boolean }) => ItemService.create(targetScope, collectionId || '', data),
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
      const res = await ItemService.update(targetScope, id, data, expectedVersion);
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
      const res = await ItemService.delete(targetScope, id);
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
          await ItemService.bulkTrash(targetScope, ids);
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
      } catch (err: any) {
        toast.error('Failed to move items', {
          description: err?.message || 'Could not move selected documents.',
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
      const res = await ItemService.getItemTypes(sid);
      if (res) {
        updateLibrarySchemaRegistry(res as unknown as Parameters<typeof updateLibrarySchemaRegistry>[0]);
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

export function useItemState(scopeId?: string, itemId?: string | null) {
  const queryClient = useQueryClient();
  const effectiveScope = scopeId || 'user';
  const effectiveItemId = itemId || '';

  const stateQuery = useQuery({
    queryKey: itemKeys.state(effectiveScope, effectiveItemId),
    queryFn: async () => {
      if (!effectiveItemId) return null;
      return ItemStateService.getState(effectiveScope, effectiveItemId);
    },
    enabled: Boolean(effectiveItemId),
    staleTime: 30_000,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { readStatus?: 'unread' | 'reading' | 'completed'; rating?: number }) => {
      if (!effectiveItemId) throw new Error('Item ID required');
      return ItemStateService.updateState(effectiveScope, effectiveItemId, data);
    },
    onSuccess: (newData) => {
      if (effectiveItemId) {
        queryClient.setQueryData(itemKeys.state(effectiveScope, effectiveItemId), newData);
      }
      queryClient.invalidateQueries({ queryKey: itemKeys.all(effectiveScope) });
      toast.success('Reading state updated', { id: 'library-reading-state' });
    },
    onError: (err: Error | { message?: string }) => {
      toast.error(err?.message || 'Failed to update reading state', { id: 'library-reading-state' });
    },
  });

  const markAsReadMutation = useMutation({
    mutationFn: async () => {
      if (!effectiveItemId) throw new Error('Item ID required');
      return ItemStateService.markAsRead(effectiveScope, effectiveItemId);
    },
    onSuccess: (newData) => {
      if (effectiveItemId) {
        queryClient.setQueryData(itemKeys.state(effectiveScope, effectiveItemId), newData);
      }
      queryClient.invalidateQueries({ queryKey: itemKeys.all(effectiveScope) });
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

export function useTrash(scopeId?: string) {
  const queryClient = useQueryClient();
  const effectiveScope = scopeId || 'user';

  const trashQuery = useQuery({
    queryKey: itemKeys.trash(effectiveScope),
    queryFn: () => ItemService.getAll(effectiveScope, { view: 'trash' }),
    enabled: true,
    select: (data): Item[] => {
      if (Array.isArray(data?.items)) return data.items;
      if (Array.isArray(data)) return data as Item[];
      return [];
    },
  });

  const trashItems: Item[] = trashQuery.data ?? [];

  const restoreMutation = useMutation({
    mutationFn: (itemId: string) => ItemService.restore(effectiveScope, itemId),
    onSuccess: () => {
      toast.success('Item restored', {
        description: 'Item has been returned to your library.',
        id: 'trash-mutation-toast',
      });
      queryClient.invalidateQueries({ queryKey: itemKeys.all(effectiveScope) });
    },
    onError: (err: any) => {
      toast.error('Failed to restore item', {
        description: err?.message || 'Please try again.',
        id: 'trash-mutation-toast',
      });
    },
  });

  const purgeMutation = useMutation({
    mutationFn: (itemId: string) => ItemService.purge(effectiveScope, itemId),
    onSuccess: () => {
      toast.success('Permanently deleted', {
        description: 'The item and its attachments were permanently removed.',
        id: 'trash-mutation-toast',
      });
      queryClient.invalidateQueries({ queryKey: itemKeys.all(effectiveScope) });
    },
    onError: (err: any) => {
      toast.error('Failed to delete item', {
        description: err?.message || 'Please try again.',
        id: 'trash-mutation-toast',
      });
    },
  });

  const emptyTrashMutation = useMutation({
    mutationFn: async (items: Item[]) => {
      if (items.length === 0) return 0;
      const ids = items.map((item) => item.id).filter(Boolean);
      if (ids.length === 0) return 0;
      const res = await ItemService.bulkPurge(effectiveScope, ids);
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
    onError: (err: any) => {
      toast.error('Failed to empty trash', {
        description: err?.message || 'Please try again.',
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

export type SortField =
  | 'title'
  | 'authors'
  | 'year'
  | 'publicationTitle'
  | 'journal'
  | 'createdAt'
  | 'updatedAt'
  | 'lastReadAt'
  | 'citationCount'
  | 'itemType';
export type SortOrder = 'asc' | 'desc';

export interface UseItemTableOptions {
  papers?: Item[];
  items?: Item[];
  initialActiveId?: string | null;
  initialSortField?: SortField;
  initialSortOrder?: SortOrder;
}

const EMPTY_ITEMS: Item[] = [];

export function useItemTable({
  papers,
  items,
  initialActiveId = null,
  initialSortField = 'createdAt',
  initialSortOrder = 'desc',
}: UseItemTableOptions) {
  const targetItems = useMemo(() => items || papers || EMPTY_ITEMS, [items, papers]);
  const [sortField, setSortField] = useState<SortField>(initialSortField);
  const [sortOrder, setSortOrder] = useState<SortOrder>(initialSortOrder);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeItemId, setActiveItemId] = useState<string | null>(initialActiveId);

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortOrder((previousOrder) => (previousOrder === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  }, [sortField]);

  const selectableItems = useMemo(
    () => targetItems.filter((item) => !item.isPending),
    [targetItems],
  );

  const toggleSelect = useCallback((itemId: string, clickEvent?: MouseEvent) => {
    if (clickEvent) clickEvent.stopPropagation();
    const item = targetItems.find((i) => i.id === itemId);
    if (item && item.isPending) return;

    setSelectedIds((previousSelectedIds) => {
      const nextSelectedIds = new Set(previousSelectedIds);
      if (nextSelectedIds.has(itemId)) {
        nextSelectedIds.delete(itemId);
      } else {
        nextSelectedIds.add(itemId);
      }
      return nextSelectedIds;
    });
  }, [targetItems]);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((previousSelectedIds) => {
      if (previousSelectedIds.size === selectableItems.length && selectableItems.length > 0) {
        return new Set();
      }
      return new Set(selectableItems.map((targetItem) => targetItem.id));
    });
  }, [selectableItems]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const sortedItems = useMemo(() => {
    return [...targetItems].sort((firstItem, secondItem) => {
      const aPending = Boolean(firstItem.isPending);
      const bPending = Boolean(secondItem.isPending);
      if (aPending && !bPending) return -1;
      if (!aPending && bPending) return 1;
      if (aPending && bPending) {
        return (
          new Date(secondItem.createdAt || 0).getTime() -
          new Date(firstItem.createdAt || 0).getTime()
        );
      }

      let comparisonResult = 0;
      switch (sortField) {
        case 'title':
          comparisonResult = (firstItem.title || '').localeCompare(secondItem.title || '');
          break;
        case 'authors':
          comparisonResult = (firstItem.authors?.[0] || '').localeCompare(secondItem.authors?.[0] || '');
          break;
        case 'itemType':
          comparisonResult = (firstItem.itemType || '').localeCompare(secondItem.itemType || '');
          break;
        case 'year':
          comparisonResult = Number(firstItem.year || 0) - Number(secondItem.year || 0);
          break;
        case 'citationCount': {
          const firstCitationCount = Number(
            firstItem.citationCount ?? (firstItem.extraFields as Record<string, unknown> | undefined)?.citationCount ?? 0,
          );
          const secondCitationCount = Number(
            secondItem.citationCount ?? (secondItem.extraFields as Record<string, unknown> | undefined)?.citationCount ?? 0,
          );
          comparisonResult = firstCitationCount - secondCitationCount;
          break;
        }
        case 'publicationTitle':
        case 'journal': {
          const v1 = getPublicationVenue(firstItem);
          const v2 = getPublicationVenue(secondItem);
          comparisonResult = v1.localeCompare(v2);
          break;
        }
        case 'lastReadAt': {
          const firstTimestamp = new Date(
            firstItem.lastReadAt || firstItem.accessedAt || firstItem.updatedAt || firstItem.createdAt || 0,
          ).getTime();
          const secondTimestamp = new Date(
            secondItem.lastReadAt || secondItem.accessedAt || secondItem.updatedAt || secondItem.createdAt || 0,
          ).getTime();
          comparisonResult = firstTimestamp - secondTimestamp;
          break;
        }
        case 'createdAt':
          comparisonResult =
            new Date(firstItem.createdAt || 0).getTime() -
            new Date(secondItem.createdAt || 0).getTime();
          break;
        case 'updatedAt':
          comparisonResult =
            new Date(firstItem.updatedAt || 0).getTime() -
            new Date(secondItem.updatedAt || 0).getTime();
          break;
        default:
          comparisonResult = 0;
      }
      return sortOrder === 'asc' ? comparisonResult : -comparisonResult;
    });
  }, [targetItems, sortField, sortOrder]);

  const isAllSelected = selectableItems.length > 0 && selectedIds.size === selectableItems.length;
  const isPartiallySelected = selectedIds.size > 0 && selectedIds.size < selectableItems.length;

  const state = {
    sortedItems,
    sortedPapers: sortedItems,
    sortField,
    sortOrder,
    selectedIds,
    activeItemId,
    activePaperId: activeItemId,
    isAllSelected,
    isPartiallySelected,
    selectedCount: selectedIds.size,
  };

  const actions = {
    handleSort,
    setSortField,
    setSortOrder,
    setActiveItemId,
    setActivePaperId: setActiveItemId,
    toggleSelect,
    toggleSelectAll,
    clearSelection,
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
    queryFn: () => ItemService.getById(targetScope, id || ''),
    enabled: Boolean(id),
    select: (data) => (data?.item ? (data.item as Item) : (data as Item)),
  });
}

export interface LibraryItemsQueryResult {
  items: Item[];
  total: number;
  meta: any;
  pagination: any;
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
    queryFn: async (): Promise<LibraryItemsQueryResult> => {
      const res = await ItemService.getAll(targetScope, params);
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

export function useInfiniteLibraryItemsQuery(
  scopeId?: string,
  params?: ItemQueryParams,
  options?: { enabled?: boolean },
) {
  const targetScope = scopeId || 'user';
  return useInfiniteQuery({
    queryKey: [...libraryKeys.items(targetScope, params), 'infinite'],
    enabled: options?.enabled ?? true,
    queryFn: async ({ pageParam }): Promise<LibraryItemsQueryResult> => {
      const res = await ItemService.getAll(targetScope, {
        ...params,
        cursor: pageParam ? String(pageParam) : undefined,
      });
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
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage?.hasNextPage && lastPage?.nextCursor ? lastPage.nextCursor : undefined,
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
      return ItemService.update(effectiveScope, targetId, updateData, resolvedVersion);
    },
    onSuccess: (_, variables) => {
      const targetId = variables.id || variables.itemId || '';
      queryClient.invalidateQueries({ queryKey: itemKeys.all(effectiveScope) });
      queryClient.invalidateQueries({ queryKey: libraryKeys.tags(effectiveScope) });
      if (targetId) {
        queryClient.invalidateQueries({ queryKey: itemKeys.byId(effectiveScope, targetId) });
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
    onError: (err: any) => {
      toast.error('Failed to update item', {
        description: err?.message || 'Please try again.',
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
      return ItemStateService.updateState(effectiveScope, id, { isStarred });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: itemKeys.all(effectiveScope) });
      queryClient.invalidateQueries({ queryKey: itemKeys.byId(effectiveScope, variables.id) });
      toast.success(variables.isStarred ? 'Added to Starred' : 'Removed from Starred', {
        id: 'item-star-toggle',
      });
    },
    onError: (err: any) => {
      toast.error('Action failed', {
        description: err?.message || 'Please try again.',
        id: 'item-star-toggle',
      });
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
        await ItemService.delete(effectiveScope, ids[0]);
      } else if (ids.length > 1) {
        await ItemService.bulkTrash(effectiveScope, ids);
      }
      return ids;
    },
    onSuccess: (ids) => {
      queryClient.invalidateQueries({ queryKey: itemKeys.all(effectiveScope) });
      queryClient.invalidateQueries({ queryKey: itemKeys.trash(effectiveScope) });
      invalidateCollections(queryClient, effectiveScope);
      toast.success(`Moved ${ids.length} ${ids.length === 1 ? 'item' : 'items'} to trash`, { id: 'item-delete' });
    },
    onError: (err: any) => {
      toast.error('Failed to delete items', {
        description: err?.message || 'Please try again.',
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
        await ItemService.restore(effectiveScope, ids[0]);
      } else if (ids.length > 1) {
        await ItemService.bulkRestore(effectiveScope, ids);
      }
      return ids;
    },
    onSuccess: (ids) => {
      queryClient.invalidateQueries({ queryKey: itemKeys.all(effectiveScope) });
      queryClient.invalidateQueries({ queryKey: itemKeys.trash(effectiveScope) });
      invalidateCollections(queryClient, effectiveScope);
      toast.success(`Restored ${ids.length} ${ids.length === 1 ? 'item' : 'items'}`, { id: 'item-restore' });
    },
    onError: (err: any) => {
      toast.error('Failed to restore items', {
        description: err?.message || 'Please try again.',
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
      await ItemService.bulkPurge(effectiveScope, ids);
      return ids;
    },
    onSuccess: (ids) => {
      queryClient.invalidateQueries({ queryKey: itemKeys.all(effectiveScope) });
      queryClient.invalidateQueries({ queryKey: itemKeys.trash(effectiveScope) });
      invalidateCollections(queryClient, effectiveScope);
      toast.success(`Permanently deleted ${ids.length} ${ids.length === 1 ? 'item' : 'items'}`, { id: 'item-purge' });
    },
    onError: (err: any) => {
      toast.error('Failed to permanently delete items', {
        description: err?.message || 'Please try again.',
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

export const useLibraryItemsData = useItems;

// ── TAGS QUERY HOOKS ──────────────────────────────────────────────────────────

export const tagKeys = {
  all: ['tags'] as const,
  list: (scopeId?: string) => libraryKeys.tags(scopeId),
};

export function useTags(scopeId?: string) {
  const queryClient = useQueryClient();
  const effectiveScope = scopeId || 'user';

  const tagsQuery = useQuery({
    queryKey: tagKeys.list(effectiveScope),
    queryFn: () => TagService.list(effectiveScope),
    enabled: true,
    staleTime: 30_000,
  });

  const createMutation = useMutation({
    mutationFn: ({ name, color, type }: { name: string; color?: string; type?: string }) =>
      TagService.create(effectiveScope, name, color, type),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tagKeys.list(effectiveScope) });
      queryClient.invalidateQueries({ queryKey: libraryKeys.all });
      toast.success('Tag created', { id: 'tag-mutation' });
    },
    onError: (err: any) => {
      toast.error('Failed to create tag', {
        description: err?.message || 'Please check the name and try again.',
        id: 'tag-mutation',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (tagId: string) => TagService.delete(effectiveScope, tagId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tagKeys.list(effectiveScope) });
      queryClient.invalidateQueries({ queryKey: libraryKeys.all });
      toast.success('Tag deleted', { id: 'tag-mutation' });
    },
    onError: (err: any) => {
      toast.error('Failed to delete tag', {
        description: err?.message || 'Please try again.',
        id: 'tag-mutation',
      });
    },
  });

  const deleteAutomaticMutation = useMutation({
    mutationFn: () => TagService.deleteAutomatic(effectiveScope),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: tagKeys.list(effectiveScope) });
      queryClient.invalidateQueries({ queryKey: libraryKeys.all });
      toast.success(`Removed ${data?.count ?? 0} automatic tag(s)`, { id: 'tag-mutation' });
    },
    onError: (err: any) => {
      toast.error('Failed to delete automatic tags', {
        description: err?.message || 'Please try again.',
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

export const useTagsQuery = useTags;

// ── NOTES QUERY HOOKS ─────────────────────────────────────────────────────────

export const noteKeys = {
  all: (scopeId?: string) => [...libraryKeys.all, 'notes', scopeId || 'user'] as const,
  lists: () => [...libraryKeys.all, 'notes'] as const,
  list: (scopeId?: string, itemId?: string) =>
    libraryKeys.notes(scopeId, itemId),
  detail: (scopeId?: string, id?: string) =>
    [...libraryKeys.all, 'notes', scopeId || 'user', 'detail', id || 'none'] as const,
};

export function useNotes(scopeId?: string, itemId?: string) {
  const queryClient = useQueryClient();

  const notesQuery = useQuery({
    queryKey: noteKeys.list(scopeId, itemId),
    queryFn: () => {
      if (!itemId) return [];
      return NoteService.list(scopeId, itemId);
    },
    enabled: !!itemId,
  });

  const createMutation = useMutation({
    mutationFn: (dto: CreateNoteDTO) =>
      NoteService.create(scopeId, { ...dto, itemId: dto.itemId !== undefined ? dto.itemId : itemId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: noteKeys.list(scopeId, itemId) });
      queryClient.invalidateQueries({ queryKey: noteKeys.all(scopeId) });
      toast.success('Note saved', { id: 'note-mutation-toast' });
    },
    onError: (err: any) => {
      toast.error('Failed to create note', {
        description: err?.message || 'Please try again.',
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
    }) => NoteService.update(scopeId, id, version, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: noteKeys.list(scopeId, itemId) });
      queryClient.invalidateQueries({ queryKey: noteKeys.all(scopeId) });
      toast.success('Note updated', { id: 'note-mutation-toast' });
    },
    onError: (err: any) => {
      toast.error('Failed to update note', {
        description: err?.message || 'Please try again.',
        id: 'note-mutation-toast',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id, version }: { id: string; version?: number }) =>
      NoteService.delete(scopeId, id, version),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: noteKeys.list(scopeId, itemId) });
      queryClient.invalidateQueries({ queryKey: noteKeys.all(scopeId) });
      toast.success('Note deleted', { id: 'note-mutation-toast' });
    },
    onError: (err: any) => {
      toast.error('Failed to delete note', {
        description: err?.message || 'Please try again.',
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

export const useNotesQuery = useNotes;

// ── STATE QUERY HOOKS ─────────────────────────────────────────────────────────

export const stateKeys = {
  all: ['library', 'state'] as const,
  item: (scopeId?: string, itemId?: string) =>
    [...stateKeys.all, scopeId || 'user', itemId || 'none'] as const,
  batch: (scopeId?: string, itemIds: string[] = []) =>
    [...stateKeys.all, 'batch', scopeId || 'user', itemIds.join(',')] as const,
};

export function useItemStateQuery(scopeId?: string, itemId?: string) {
  return useQuery({
    queryKey: stateKeys.item(scopeId, itemId),
    queryFn: async () => {
      const res = await StateService.getState(scopeId || 'user', itemId || '');
      return res ?? null;
    },
    enabled: Boolean(itemId),
    staleTime: 1000 * 60 * 5,
  });
}

export function useUpdateItemState(scopeId?: string, itemId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      readStatus?: 'unread' | 'reading' | 'completed';
      rating?: number;
    }) => {
      return StateService.updateState(scopeId || 'user', itemId || '', data);
    },
    onSuccess: () => {
      if (itemId) {
        queryClient.invalidateQueries({ queryKey: stateKeys.item(scopeId, itemId) });
        queryClient.invalidateQueries({ queryKey: stateKeys.all });
      }
    },
  });
}

// ── SAVED SEARCHES QUERY HOOKS ────────────────────────────────────────────────

export const savedSearchKeys = {
  all: (scopeId?: string) => libraryKeys.savedSearches(scopeId),
  byId: (scopeId: string | undefined, id: string) => [...libraryKeys.savedSearches(scopeId), id] as const,
  results: (scopeId: string | undefined, id: string, params?: Record<string, any>) =>
    [...libraryKeys.savedSearches(scopeId), id, 'results', params] as const,
};

export const invalidateSavedSearches = (qc: QueryClient, scopeId?: string) => {
  qc.invalidateQueries({ queryKey: savedSearchKeys.all(scopeId) });
};

export function useSavedSearches(scopeId?: string) {
  const queryClient = useQueryClient();
  const effectiveScope = scopeId || 'user';

  const savedSearchesQuery = useQuery({
    queryKey: savedSearchKeys.all(effectiveScope),
    queryFn: () => SavedSearchService.getAll(effectiveScope),
    enabled: true,
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateSavedSearchInput) =>
      SavedSearchService.create(effectiveScope, data),
    onSuccess: () => {
      invalidateSavedSearches(queryClient, effectiveScope);
      toast.success('Smart collection created', { id: 'saved-search-mutation' });
    },
    onError: (err: any) => {
      toast.error('Failed to create smart collection', {
        description: err?.message || 'Please check your conditions and try again.',
        id: 'saved-search-mutation',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSavedSearchInput }) =>
      SavedSearchService.update(effectiveScope, id, data),
    onSuccess: (_, variables) => {
      invalidateSavedSearches(queryClient, effectiveScope);
      queryClient.invalidateQueries({
        queryKey: savedSearchKeys.byId(effectiveScope, variables.id),
      });
      toast.success('Smart collection updated', { id: 'saved-search-mutation' });
    },
    onError: (err: any) => {
      toast.error('Failed to update smart collection', {
        description: err?.message,
        id: 'saved-search-mutation',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => SavedSearchService.delete(effectiveScope, id),
    onSuccess: () => {
      invalidateSavedSearches(queryClient, effectiveScope);
      toast.success('Smart collection deleted', { id: 'saved-search-mutation' });
    },
    onError: (err: any) => {
      toast.error('Failed to delete smart collection', {
        description: err?.message,
        id: 'saved-search-mutation',
      });
    },
  });

  const previewMutation = useMutation({
    mutationFn: (conditions: SavedSearchConditionGroup) =>
      SavedSearchService.preview(effectiveScope, conditions),
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
      return SavedSearchService.getResults(effectiveScope || 'user', id, params);
    },
    enabled: !!id && !!effectiveScope,
  });
}

// ── RELATIONS QUERY HOOKS ─────────────────────────────────────────────────────

export const relationKeys = {
  all: (scopeId?: string, itemId?: string) =>
    ['relations', scopeId || 'global', itemId] as const,
};

export function useRelations(
  scopeIdOrOptions?: string | { scopeId?: string; projectId?: string },
  itemId?: string,
) {
  const scopeId = typeof scopeIdOrOptions === 'string'
    ? scopeIdOrOptions
    : (scopeIdOrOptions?.scopeId || scopeIdOrOptions?.projectId || 'global');

  const queryClient = useQueryClient();
  const effectiveItemId = itemId || '';

  const relationsQuery = useQuery({
    queryKey: relationKeys.all(scopeId, effectiveItemId),
    queryFn: () => RelationService.getRelated(scopeId || '', effectiveItemId),
    enabled: Boolean(effectiveItemId && effectiveItemId !== 'user'),
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
      return RelationService.link(scopeId || '', effectiveItemId, targets.length === 1 ? targets[0] : targets, relationType);
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
    onError: (err: any) => {
      toast.error('Failed to link references', {
        description: err?.message || 'Please try again.',
        id: 'relation-mutation',
      });
    },
  });

  const unlinkMutation = useMutation({
    mutationFn: (variables: { targetItemId: string; relationType?: string }) =>
      RelationService.unlink(scopeId || '', effectiveItemId, variables.targetItemId, variables.relationType),
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
    onError: (err: any) => {
      toast.error('Failed to unlink reference', {
        description: err?.message || 'Please try again.',
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

export const useRelationsQuery = useRelations;

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
  projectedItem: Record<string, any>;
  unmappedRetained: Record<string, any>;
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
      ItemService.previewConvertType(
        effectiveScopeId,
        itemId,
        targetType,
        retainUnmappedInExtra,
      ).then((res: unknown): TypeConversionPreview => (res as { preview?: TypeConversionPreview; data?: TypeConversionPreview })?.preview ?? (res as { data?: TypeConversionPreview })?.data ?? (res as TypeConversionPreview)),
    onError: (err: any) => {
      toast.error('Preview failed', {
        description: err?.message || 'Failed to preview type conversion.',
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
      ItemService.convertType(
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
    onError: (err: any) => {
      toast.error('Conversion failed', {
        description: err?.message || 'Could not convert item type.',
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
