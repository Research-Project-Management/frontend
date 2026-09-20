'use client';

import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ItemService,
  ItemsService,
} from '../services/items.service';
import { CollectionsService } from '../services/collections.service';
import { StateService as ItemStateService, type ItemStateData } from '../services/state.service';
import { invalidateCollections } from './collections.queries';
import type {
  Item,
  CreateItemDTO,
  UpdateItemDTO,
  ItemQueryParams,
} from '../../types/library.types';
import { updateLibrarySchemaRegistry } from '../../types';
import { getPublicationVenue } from '../../domain';
import { itemKeys, libraryKeys } from '../query-keys';

export { itemKeys };

// ── View-scoped Items Hook (unfiled, recent, trash, all) ───────────────────────
/**
 * Fetches items filtered by a specific view.
 * Returns { items, meta, total, hasNextPage, nextCursor } — consumers must NOT strip meta.
 * Pages use this hook — they must NOT call ItemService directly.
 */
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
      const meta = data?.meta || data?.pagination || null;
      const total: number =
        meta?.totalCount ??
        data?.total ??
        items.length;
      return { items, meta, total, hasNextPage: meta?.hasNextPage ?? false, nextCursor: meta?.cursor };
    },
  });
}

// ── 1. Main Items Hook ───────────────────────────────────────────────────────

export interface UseItemsOptions {
  projectId?: string;
  scopeId?: string;
  /** @deprecated Use scopeId or projectId */
  workspaceId?: string;
  collectionId?: string;
  paperId?: string;
  itemId?: string;
}

export function useItems(optionsOrScope: string | UseItemsOptions = {}) {
  const options = typeof optionsOrScope === 'string' ? { scopeId: optionsOrScope } : optionsOrScope;
  const { scopeId, projectId, workspaceId, collectionId, paperId, itemId } = options as any;
  const targetScope = scopeId || projectId || workspaceId || 'user';
  const activeItemId = itemId || paperId || '';
  const queryClient = useQueryClient();

  const allItemsQuery = useQuery({
    queryKey: itemKeys.all(targetScope),
    queryFn: () => ItemService.getAll(targetScope),
    enabled: true,
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
      const targetCollection = (newItem as any)?.collectionId || collectionId;
      if (targetCollection) {
        queryClient.invalidateQueries({
          queryKey: itemKeys.byCollection(targetScope, targetCollection),
        });
      }
      queryClient.invalidateQueries({ queryKey: itemKeys.all(targetScope) });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      invalidateCollections(queryClient, targetScope);
      if (!variables?.silent) {
        toast.success('Document added', {
          description: 'Added to your library.',
          id: 'library-item-create',
        });
      }
    },
    onError: (error: any, variables) => {
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
      const targetCollection = (updatedItem as any)?.collectionId || collectionId;
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
    onError: (error: any, variables) => {
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
    onError: (error: any, variables) => {
      if (!variables?.silent) {
        toast.error('Failed to delete item', {
          description: error?.message || 'Please try again.',
          id: 'item-mutation-toast',
        });
      }
    },
  });

  const resolvedAllItems = ((allItemsQuery.data as any)?.items || []) as Item[];
  const state = {
    data: resolvedAllItems,
    items: resolvedAllItems,
    allItems: resolvedAllItems,
    allPapers: resolvedAllItems,
    meta: (allItemsQuery.data as any)?.meta || null,
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

  const actions = {
    createItem: createMutation.mutateAsync,
    createPaper: createMutation.mutateAsync,
    addPaper: createMutation.mutateAsync,
    updateItem: (idOrPayload: any, maybeData?: any, maybeOptions?: { silent?: boolean; expectedVersion?: number }) => {
      if (typeof idOrPayload === 'string') {
        return updateMutation.mutateAsync({ id: idOrPayload, data: maybeData, expectedVersion: maybeOptions?.expectedVersion, silent: maybeOptions?.silent });
      }
      const { id, paperId, data, silent, expectedVersion, ...rest } = idOrPayload;
      const targetItemId = id || paperId;
      const targetData = data || rest;
      return updateMutation.mutateAsync({ id: targetItemId, data: targetData, expectedVersion, silent });
    },
    updatePaper: (idOrPayload: any, maybeData?: any, maybeOptions?: { silent?: boolean; expectedVersion?: number }) => {
      if (typeof idOrPayload === 'string') {
        return updateMutation.mutateAsync({ id: idOrPayload, data: maybeData, expectedVersion: maybeOptions?.expectedVersion, silent: maybeOptions?.silent });
      }
      const { id, paperId, data, silent, expectedVersion, ...rest } = idOrPayload;
      const targetItemId = id || paperId;
      const targetData = data || rest;
      return updateMutation.mutateAsync({ id: targetItemId, data: targetData, expectedVersion, silent });
    },

    deleteItem: (idOrPayload: string | { paperId?: string; id?: string; silent?: boolean; collectionId?: string }, maybeOptions?: { silent?: boolean }) => {
      const targetItemId = typeof idOrPayload === 'string' ? idOrPayload : (idOrPayload.id || idOrPayload.paperId || '');
      const silent = typeof idOrPayload === 'object' && 'silent' in idOrPayload ? idOrPayload.silent : maybeOptions?.silent;
      const itemCollectionId = typeof idOrPayload === 'object' ? idOrPayload.collectionId : undefined;
      return deleteMutation.mutateAsync({ id: targetItemId, silent, itemCollectionId });
    },
    deletePaper: (idOrPayload: string | { paperId?: string; id?: string; silent?: boolean; collectionId?: string }, maybeOptions?: { silent?: boolean }) => {
      const targetItemId = typeof idOrPayload === 'string' ? idOrPayload : (idOrPayload.id || idOrPayload.paperId || '');
      const silent = typeof idOrPayload === 'object' && 'silent' in idOrPayload ? idOrPayload.silent : maybeOptions?.silent;
      const itemCollectionId = typeof idOrPayload === 'object' ? idOrPayload.collectionId : undefined;
      return deleteMutation.mutateAsync({ id: targetItemId, silent, itemCollectionId });
    },
    batchDeleteItems: async (ids: string[]) => {
      if (!ids.length) return;
      const toastId = toast.loading(`Moving ${ids.length} item(s) to trash...`, { id: 'batch-trash' });
      const results = await Promise.allSettled(ids.map((id) => deleteMutation.mutateAsync({ id, silent: true })));
      const failed = results.filter((r) => r.status === 'rejected').length;
      const succeeded = results.length - failed;
      if (failed === 0) {
        toast.success('Moved to trash', {
          description: `${succeeded} document(s) moved to trash.`,
          id: toastId,
        });
      } else if (succeeded === 0) {
        toast.error('Failed to delete items', {
          description: 'Could not move selected documents to trash.',
          id: toastId,
        });
      } else {
        toast.error(`Failed to delete ${failed} of ${ids.length} items`, {
          description: `${succeeded} item(s) moved to trash; ${failed} could not be deleted.`,
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
        queryClient.invalidateQueries({ queryKey: ['items', targetScope || 'user'] });
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

// ── 2. Item Types Hook ───────────────────────────────────────────────────────

export function useItemTypes(scopeIdOrOptions?: string | { scopeId?: string; workspaceId?: string; projectId?: string }) {
  const sid = typeof scopeIdOrOptions === 'string'
    ? scopeIdOrOptions
    : (scopeIdOrOptions?.scopeId || scopeIdOrOptions?.projectId || scopeIdOrOptions?.workspaceId || 'user');

  const { data, isLoading } = useQuery({
    queryKey: itemKeys.types(sid),
    queryFn: async () => {
      const res = await ItemService.getItemTypes(sid);
      if (res) {
        updateLibrarySchemaRegistry(res as any);
      }
      return res;
    },
    enabled: true,
    staleTime: 1000 * 60 * 60,
  });

  if (data) {
    updateLibrarySchemaRegistry(data as any);
  }

  const types = (data as any)?.itemTypes || (data as any)?.data || (data as any)?.types || [];

  return {
    state: { types, isLoading },
    actions: {},
    types,
    isLoading,
  };
}

// ── 3. Item State (Reading Status & Rating) Hook ──────────────────────────────

export function useItemState(scopeId?: string, itemId?: string | null) {
  const queryClient = useQueryClient();
  const effectiveScope = scopeId || 'user';
  const effectiveItemId = itemId || '';

  const stateQuery = useQuery({
    queryKey: itemKeys.state(effectiveScope, effectiveItemId),
    queryFn: async () => {
      if (!effectiveItemId) return null;
      const res = await ItemStateService.getState(effectiveScope, effectiveItemId);
      return (res as any)?.data ?? res ?? null;
    },
    enabled: Boolean(effectiveItemId),
    staleTime: 30_000,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { readStatus?: 'unread' | 'reading' | 'completed'; rating?: number }) => {
      if (!effectiveItemId) throw new Error('Item ID required');
      const res = await ItemStateService.updateState(effectiveScope, effectiveItemId, data);
      return (res as any)?.data ?? res;
    },
    onSuccess: (newData) => {
      if (effectiveItemId) {
        queryClient.setQueryData(itemKeys.state(effectiveScope, effectiveItemId), newData);
      }
      queryClient.invalidateQueries({ queryKey: itemKeys.all(effectiveScope) });
      toast.success('Reading state updated', { id: 'library-reading-state' });
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to update reading state', { id: 'library-reading-state' });
    },
  });

  const markAsReadMutation = useMutation({
    mutationFn: async () => {
      if (!effectiveItemId) throw new Error('Item ID required');
      const res = await ItemStateService.markAsRead(effectiveScope, effectiveItemId);
      return (res as any)?.data ?? res;
    },
    onSuccess: (newData) => {
      if (effectiveItemId) {
        queryClient.setQueryData(itemKeys.state(effectiveScope, effectiveItemId), newData);
      }
      queryClient.invalidateQueries({ queryKey: itemKeys.all(effectiveScope) });
      toast.success('Marked as read', { id: 'library-reading-state' });
    },
    onError: (err: any) => {
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

// ── 4. Trash Operations Hook ──────────────────────────────────────────────────

export function useTrash(scopeId?: string) {
  const queryClient = useQueryClient();
  const effectiveScope = scopeId || 'user';

  const trashQuery = useQuery({
    queryKey: itemKeys.trash(effectiveScope),
    queryFn: () => ItemService.getAll(effectiveScope, { view: 'trash' }),
    enabled: true,
    select: (data): Item[] => {
      if (Array.isArray(data?.items)) return data.items;
      if (Array.isArray((data as any)?.papers)) return (data as any).papers;
      if (Array.isArray(data)) return data as unknown as Item[];
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
      await Promise.all(items.map((item) => ItemService.purge(effectiveScope, item.id)));
      return items.length;
    },
    onSuccess: (count) => {
      toast.success('Trash emptied', {
        description: `Permanently removed ${count} item(s).`,
        id: 'trash-mutation-toast',
      });
      queryClient.invalidateQueries({ queryKey: itemKeys.all(effectiveScope) });
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

// ── 5. Table Sorting & Selection Hook ───────────────────────────────────────

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
    () => targetItems.filter((item) => !(item as any).isPending),
    [targetItems],
  );

  const toggleSelect = useCallback((itemId: string, clickEvent?: React.MouseEvent) => {
    if (clickEvent) clickEvent.stopPropagation();
    const item = targetItems.find((i) => i.id === itemId);
    if (item && (item as any).isPending) return;

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
      const aPending = Boolean((firstItem as any).isPending);
      const bPending = Boolean((secondItem as any).isPending);
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

// ── 6. Standalone Single Item Query ──────────────────────────────────────────

export function useItem(id?: string, scopeId?: string) {
  const targetScope = scopeId || 'user';
  return useQuery({
    queryKey: itemKeys.byId(targetScope, id || ''),
    queryFn: () => ItemService.getById(targetScope, id || ''),
    enabled: Boolean(id),
    select: (data) => (data?.item ? (data.item as Item) : (data as Item)),
  });
}

// ── 7. Direct Raw Query Hook ────────────────────────────────────────────────

export function useLibraryItemsQuery(
  scopeId?: string,
  params?: ItemQueryParams,
) {
  const targetScope = scopeId || 'user';
  return useQuery({
    queryKey: libraryKeys.items(targetScope, params),
    queryFn: async () => {
      const res = await ItemService.getAll(targetScope, params);
      return res?.items || [];
    },
    staleTime: 1000 * 30,
  });
}

// ── 8. Dedicated Hooks for Modern UI (ItemTable, Inspector, Modals) ──────────

export function useLibraryItemDetailQuery(arg1?: string, arg2?: string) {
  let itemId = arg1;
  let scopeId = arg2;
  if (arg1 === 'user' || (arg2 && !arg2.includes('user'))) {
    scopeId = arg1;
    itemId = arg2;
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
    }: {
      id?: string;
      itemId?: string;
      payload?: Partial<Item>;
      data?: Partial<Item>;
    }) => {
      const targetId = id || itemId || '';
      const updateData = payload || data || {};
      return ItemService.update(effectiveScope, targetId, updateData);
    },
    onSuccess: (_, variables) => {
      const targetId = variables.id || variables.itemId || '';
      queryClient.invalidateQueries({ queryKey: itemKeys.all(effectiveScope) });
      queryClient.invalidateQueries({ queryKey: libraryKeys.all });
      if (targetId) {
        queryClient.invalidateQueries({ queryKey: itemKeys.byId(effectiveScope, targetId) });
      }
      toast.success('Đã cập nhật tài liệu', { id: 'item-update' });
    },
    onError: (err: any) => {
      toast.error('Cập nhật thất bại', {
        description: err?.message || 'Vui lòng thử lại.',
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
      return ItemService.update(effectiveScope, id, { isStarred } as Partial<Item>);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: itemKeys.all(effectiveScope) });
      queryClient.invalidateQueries({ queryKey: libraryKeys.all });
      queryClient.invalidateQueries({ queryKey: itemKeys.byId(effectiveScope, variables.id) });
      toast.success(variables.isStarred ? 'Đã thêm vào mục yêu thích' : 'Đã bỏ yêu thích', {
        id: 'item-star-toggle',
      });
    },
    onError: (err: any) => {
      toast.error('Thao tác thất bại', {
        description: err?.message || 'Vui lòng thử lại.',
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
      await Promise.all(ids.map((id) => ItemService.delete(effectiveScope, id)));
      return ids;
    },
    onSuccess: (ids) => {
      queryClient.invalidateQueries({ queryKey: itemKeys.all(effectiveScope) });
      queryClient.invalidateQueries({ queryKey: libraryKeys.all });
      queryClient.invalidateQueries({ queryKey: itemKeys.trash(effectiveScope) });
      toast.success(`Đã chuyển ${ids.length} tài liệu vào thùng rác`, { id: 'item-delete' });
    },
    onError: (err: any) => {
      toast.error('Xóa tài liệu thất bại', {
        description: err?.message || 'Vui lòng thử lại.',
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
      await Promise.all(ids.map((id) => ItemService.restore(effectiveScope, id)));
      return ids;
    },
    onSuccess: (ids) => {
      queryClient.invalidateQueries({ queryKey: itemKeys.all(effectiveScope) });
      queryClient.invalidateQueries({ queryKey: libraryKeys.all });
      queryClient.invalidateQueries({ queryKey: itemKeys.trash(effectiveScope) });
      toast.success(`Đã khôi phục ${ids.length} tài liệu`, { id: 'item-restore' });
    },
    onError: (err: any) => {
      toast.error('Khôi phục thất bại', {
        description: err?.message || 'Vui lòng thử lại.',
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
      await Promise.all(ids.map((id) => ItemService.purge(effectiveScope, id)));
      return ids;
    },
    onSuccess: (ids) => {
      queryClient.invalidateQueries({ queryKey: itemKeys.all(effectiveScope) });
      queryClient.invalidateQueries({ queryKey: libraryKeys.all });
      queryClient.invalidateQueries({ queryKey: itemKeys.trash(effectiveScope) });
      toast.success(`Đã xóa vĩnh viễn ${ids.length} tài liệu`, { id: 'item-purge' });
    },
    onError: (err: any) => {
      toast.error('Xóa vĩnh viễn thất bại', {
        description: err?.message || 'Vui lòng thử lại.',
        id: 'item-purge',
      });
    },
  });
}

