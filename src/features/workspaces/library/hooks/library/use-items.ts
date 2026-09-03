'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  CatalogItemService,
  getCollectionPapers,
  getAllPapers,
  getPaperById,
  createPaper,
  updatePaper,
  deletePaper,
  getPaperAcademicBundle,
} from '../../services/catalog.service';
import { ReadingService as ItemStateService, type ItemStateData } from '../../services/reading.service';
import { AnnotationService } from '../../services/annotation.service';
import { invalidateCollections } from './use-collections';
import type {
  CatalogItem,
  Paper,
  CreatePaperDTO,
  UpdatePaperDTO,
  PaperQueryParams,
} from '../../types/library.types';

// ── Canonical Query Keys (Self-Managed) ───────────────────────────────────────
export const itemKeys = {
  all: (workspaceId: string) => ['items', workspaceId] as const,
  byId: (workspaceId: string, itemId: string) => ['items', workspaceId, itemId] as const,
  byCollection: (workspaceId: string, collectionId: string) => ['items', workspaceId, collectionId] as const,
  byView: (workspaceId: string, view: string, search?: string) =>
    ['items', workspaceId, 'view', view, search || ''] as const,
  trash: (workspaceId: string) => ['items', workspaceId, 'trash'] as const,
  state: (workspaceId: string, itemId: string) => ['items', workspaceId, itemId, 'state'] as const,
  types: (workspaceId: string) => ['items', workspaceId, 'types'] as const,
};

export const catalogItemKeys = itemKeys;
export const paperKeys = itemKeys;

// ── View-scoped Items Hook (unfiled, recent, trash, all) ───────────────────────
/**
 * Fetches items filtered by a specific view.
 * Returns { items, meta, total, hasNextPage, nextCursor } — consumers must NOT strip meta.
 * Pages use this hook — they must NOT call CatalogItemService directly.
 */
export function useViewItems(
  workspaceId: string,
  view: 'all' | 'recent' | 'unfiled' | 'trash',
  search?: string,
) {
  return useQuery({
    queryKey: itemKeys.byView(workspaceId, view, search),
    queryFn: () =>
      CatalogItemService.getAll(workspaceId, {
        view,
        search: search?.trim() || undefined,
      }),
    enabled: Boolean(workspaceId),
    select: (data) => {
      const items: CatalogItem[] = Array.isArray(data)
        ? data
        : (data as any)?.items || (data as any)?.papers || (data as any)?.data || [];
      const meta = (data as any)?.meta || (data as any)?.pagination || null;
      const total: number =
        meta?.totalCount ??
        (data as any)?.total ??
        items.length;
      return { items, meta, total, hasNextPage: meta?.hasNextPage ?? false, nextCursor: meta?.cursor };
    },
  });
}


// ── 1. Main Items Hook ───────────────────────────────────────────────────────

export interface UseItemsOptions {
  workspaceId: string;
  collectionId?: string;
  paperId?: string;
  itemId?: string;
}

export function useItems({ workspaceId, collectionId, paperId, itemId }: UseItemsOptions) {
  const activeItemId = itemId || paperId || '';
  const queryClient = useQueryClient();

  const allItemsQuery = useQuery({
    queryKey: itemKeys.all(workspaceId),
    queryFn: () => getAllPapers(workspaceId),
    enabled: Boolean(workspaceId),
    select: (data) => {
      if (!data) return { items: [] as CatalogItem[], meta: null };
      const items: CatalogItem[] = Array.isArray(data)
        ? data
        : (data as any).papers || (data as any).items || (data as any).data || [];
      const meta = (data as any)?.meta || (data as any)?.pagination || null;
      return { items, meta };
    },
  });

  const itemByIdQuery = useQuery({
    queryKey: itemKeys.byId(workspaceId, activeItemId),
    queryFn: () => getPaperById(workspaceId, activeItemId),
    enabled: Boolean(workspaceId && activeItemId),
    select: (data) => (data as any)?.paper || (data as any)?.item || data,
  });

  const collectionItemsQuery = useQuery({
    queryKey: itemKeys.byCollection(workspaceId, collectionId || ''),
    queryFn: () => getCollectionPapers(workspaceId, collectionId || ''),
    enabled: Boolean(workspaceId && collectionId),
    select: (data) => (data as any)?.papers || (data as any)?.items || [],
  });

  const createMutation = useMutation({
    mutationFn: (data: CreatePaperDTO & { silent?: boolean }) => createPaper(workspaceId, collectionId || '', data),
    onSuccess: (newItem, variables) => {
      const targetCollection = (newItem as any)?.collectionId || collectionId;
      if (targetCollection) {
        queryClient.invalidateQueries({
          queryKey: itemKeys.byCollection(workspaceId, targetCollection),
        });
      }
      queryClient.invalidateQueries({ queryKey: itemKeys.all(workspaceId) });
      invalidateCollections(queryClient, workspaceId);
      if (!variables?.silent) {
        toast.success('Document added', {
          description: 'Added to your library catalog.',
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
    mutationFn: async ({ id, data, expectedVersion, silent }: { id: string; data: UpdatePaperDTO; expectedVersion?: number; silent?: boolean }) => {
      const res = await updatePaper(workspaceId, id, data, expectedVersion);
      return { res, silent, id };
    },
    onSuccess: ({ res: updatedItem, silent, id }) => {
      const targetCollection = (updatedItem as any)?.collectionId || collectionId;
      if (targetCollection) {
        queryClient.invalidateQueries({
          queryKey: itemKeys.byCollection(workspaceId, targetCollection),
        });
      }
      queryClient.invalidateQueries({ queryKey: itemKeys.all(workspaceId) });
      queryClient.setQueryData(itemKeys.byId(workspaceId, id), updatedItem);
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
    mutationFn: async ({ id, silent }: { id: string; silent?: boolean }) => {
      const res = await deletePaper(workspaceId, id);
      return { res, silent };
    },
    onSuccess: ({ silent }) => {
      if (collectionId) {
        queryClient.invalidateQueries({
          queryKey: itemKeys.byCollection(workspaceId, collectionId),
        });
      }
      queryClient.invalidateQueries({ queryKey: itemKeys.all(workspaceId) });
      invalidateCollections(queryClient, workspaceId);
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

  const state = {
    allItems: ((allItemsQuery.data as any)?.items || []) as CatalogItem[],
    allPapers: ((allItemsQuery.data as any)?.items || []) as CatalogItem[],
    meta: (allItemsQuery.data as any)?.meta || null,
    item: (itemByIdQuery.data || null) as CatalogItem | null,
    paper: (itemByIdQuery.data || null) as CatalogItem | null,
    collectionItems: (collectionItemsQuery.data || []) as CatalogItem[],
    collectionPapers: (collectionItemsQuery.data || []) as CatalogItem[],
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
      const targetId = id || paperId;
      const targetData = data || rest;
      return updateMutation.mutateAsync({ id: targetId, data: targetData, expectedVersion, silent });
    },
    updatePaper: (idOrPayload: any, maybeData?: any, maybeOptions?: { silent?: boolean; expectedVersion?: number }) => {
      if (typeof idOrPayload === 'string') {
        return updateMutation.mutateAsync({ id: idOrPayload, data: maybeData, expectedVersion: maybeOptions?.expectedVersion, silent: maybeOptions?.silent });
      }
      const { id, paperId, data, silent, expectedVersion, ...rest } = idOrPayload;
      const targetId = id || paperId;
      const targetData = data || rest;
      return updateMutation.mutateAsync({ id: targetId, data: targetData, expectedVersion, silent });
    },

    deleteItem: (idOrPayload: string | { paperId?: string; id?: string; silent?: boolean }, maybeOptions?: { silent?: boolean }) => {
      const targetId = typeof idOrPayload === 'string' ? idOrPayload : (idOrPayload.id || idOrPayload.paperId || '');
      const silent = typeof idOrPayload === 'object' && 'silent' in idOrPayload ? idOrPayload.silent : maybeOptions?.silent;
      return deleteMutation.mutateAsync({ id: targetId, silent });
    },
    deletePaper: (idOrPayload: string | { paperId?: string; id?: string; silent?: boolean }, maybeOptions?: { silent?: boolean }) => {
      const targetId = typeof idOrPayload === 'string' ? idOrPayload : (idOrPayload.id || idOrPayload.paperId || '');
      const silent = typeof idOrPayload === 'object' && 'silent' in idOrPayload ? idOrPayload.silent : maybeOptions?.silent;
      return deleteMutation.mutateAsync({ id: targetId, silent });
    },
    batchDeleteItems: async (ids: string[]) => {
      if (!ids.length) return;
      const toastId = toast.loading(`Moving ${ids.length} item(s) to trash...`, { id: 'batch-trash' });
      try {
        await Promise.all(ids.map((id) => deleteMutation.mutateAsync({ id, silent: true })));
        toast.success('Moved to trash', {
          description: `${ids.length} document(s) moved to trash.`,
          id: toastId,
        });
      } catch (err: any) {
        toast.error('Failed to delete items', {
          description: err?.message || 'Could not move selected documents to trash.',
          id: toastId,
        });
      }
    },
    batchMoveItems: async (ids: string[], targetCollectionId: string | null) => {
      if (!ids.length) return;
      const toastId = toast.loading(`Moving ${ids.length} item(s)...`, { id: 'batch-move' });
      try {
        await Promise.all(
          ids.map((id) =>
            updateMutation.mutateAsync({
              id,
              data: { collectionId: targetCollectionId ?? undefined } as any,
              silent: true,
            }),
          ),
        );
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

export const useCatalogItems = useItems;
export function useCatalogItem(workspaceId: string, itemId: string) {
  const result = useItems({ workspaceId, itemId });
  return {
    ...result,
    data: result.state.item,
    isLoading: result.state.isLoadingItem,
  };
}

// ── 2. Item Types Hook ───────────────────────────────────────────────────────

export function useItemTypes(workspaceId?: string) {
  const wid = workspaceId || 'current';
  const { data, isLoading } = useQuery({
    queryKey: itemKeys.types(wid),
    queryFn: () => CatalogItemService.getItemTypes(wid),
    staleTime: 1000 * 60 * 60,
  });

  const types = (data as any)?.itemTypes || (data as any)?.data || (data as any)?.types || [];

  return {
    state: { types, isLoading },
    actions: {},
    types,
    isLoading,
  };
}

// ── 3. Item State (Reading Status & Rating) Hook ──────────────────────────────

export function useItemState(workspaceId: string, itemId?: string | null) {
  const queryClient = useQueryClient();

  const stateQuery = useQuery({
    queryKey: itemKeys.state(workspaceId, itemId || ''),
    queryFn: async () => {
      if (!itemId) return null;
      const res = await ItemStateService.getState(workspaceId, itemId);
      return res?.data ?? null;
    },
    enabled: Boolean(workspaceId && itemId),
    staleTime: 30_000,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { readStatus?: 'unread' | 'reading' | 'completed'; rating?: number }) => {
      if (!itemId) throw new Error('Item ID required');
      const res = await ItemStateService.updateState(workspaceId, itemId, data);
      return res?.data;
    },
    onSuccess: (newData) => {
      if (itemId) {
        queryClient.setQueryData(itemKeys.state(workspaceId, itemId), newData);
      }
      queryClient.invalidateQueries({ queryKey: itemKeys.all(workspaceId) });
      toast.success('Reading state updated', { id: 'library-reading-state' });
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to update reading state', { id: 'library-reading-state' });
    },
  });

  const markAsReadMutation = useMutation({
    mutationFn: async () => {
      if (!itemId) throw new Error('Item ID required');
      const res = await ItemStateService.markAsRead(workspaceId, itemId);
      return res?.data;
    },
    onSuccess: (newData) => {
      if (itemId) {
        queryClient.setQueryData(itemKeys.state(workspaceId, itemId), newData);
      }
      queryClient.invalidateQueries({ queryKey: itemKeys.all(workspaceId) });
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

export const useUserState = useItemState;
export const useUpdateItemState = (workspaceId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, data }: { itemId: string; data: any }) =>
      ItemStateService.updateState(workspaceId, itemId, data),
    onSuccess: (_, v) => {
      queryClient.invalidateQueries({ queryKey: itemKeys.state(workspaceId, v.itemId) });
      queryClient.invalidateQueries({ queryKey: itemKeys.all(workspaceId) });
    },
  });
};
export const useMarkAsRead = (workspaceId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => ItemStateService.markAsRead(workspaceId, itemId),
    onSuccess: (_, itemId) => {
      queryClient.invalidateQueries({ queryKey: itemKeys.state(workspaceId, itemId) });
      queryClient.invalidateQueries({ queryKey: itemKeys.all(workspaceId) });
    },
  });
};

// ── 4. Trash Operations Hook ──────────────────────────────────────────────────

export function useTrash(workspaceId: string) {
  const queryClient = useQueryClient();

  const trashQuery = useQuery({
    queryKey: itemKeys.trash(workspaceId),
    queryFn: () => CatalogItemService.getAll(workspaceId, { view: 'trash' }),
    enabled: Boolean(workspaceId),
  });

  const trashItems: CatalogItem[] = Array.isArray(trashQuery.data?.items)
    ? trashQuery.data.items
    : Array.isArray((trashQuery.data as any)?.papers)
      ? (trashQuery.data as any).papers
      : Array.isArray(trashQuery.data)
        ? (trashQuery.data as any)
        : [];

  const restoreMutation = useMutation({
    mutationFn: (itemId: string) => CatalogItemService.restore(workspaceId, itemId),
    onSuccess: () => {
      toast.success('Document restored', {
        description: 'Item has been returned to your library catalog.',
        id: 'trash-mutation-toast',
      });
      queryClient.invalidateQueries({ queryKey: itemKeys.all(workspaceId) });
    },
    onError: (err: any) => {
      toast.error('Failed to restore document', {
        description: err?.message || 'Please try again.',
        id: 'trash-mutation-toast',
      });
    },
  });

  const purgeMutation = useMutation({
    mutationFn: (itemId: string) => CatalogItemService.purge(workspaceId, itemId),
    onSuccess: () => {
      toast.success('Permanently deleted', {
        description: 'The document and its files were permanently removed.',
        id: 'trash-mutation-toast',
      });
      queryClient.invalidateQueries({ queryKey: itemKeys.all(workspaceId) });
    },
    onError: (err: any) => {
      toast.error('Failed to delete document', {
        description: err?.message || 'Please try again.',
        id: 'trash-mutation-toast',
      });
    },
  });

  const emptyTrashMutation = useMutation({
    mutationFn: async (items: CatalogItem[]) => {
      if (items.length === 0) return 0;
      await Promise.all(items.map((item) => CatalogItemService.purge(workspaceId, item.id)));
      return items.length;
    },
    onSuccess: (count) => {
      toast.success('Trash emptied', {
        description: `Permanently removed ${count} document(s).`,
        id: 'trash-mutation-toast',
      });
      queryClient.invalidateQueries({ queryKey: itemKeys.all(workspaceId) });
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

// ── 5. Item Type Conversion Hook ─────────────────────────────────────────────

interface UseConvertItemTypeOptions {
  workspaceId: string;
  itemId: string;
  targetType: string;
  retainUnmapped?: boolean;
  onSuccess?: (updatedItem: CatalogItem) => void;
}

/**
 * Legacy hook kept for backwards compat with TypeConversionDialog.
 * New code should use useItemTypeConversion from use-type-conversion.ts.
 */
export function useConvertItemType({
  workspaceId,
  itemId,
  targetType,
  retainUnmapped = true,
  onSuccess,
}: UseConvertItemTypeOptions) {
  const queryClient = useQueryClient();
  const [preview, setPreview] = useState<any>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewErr, setPreviewErr] = useState<Error | null>(null);

  // On-demand preview loader — called by the dialog on open
  const loadPreview = useCallback(async () => {
    if (!workspaceId || !itemId || !targetType) { setPreview(null); return; }
    setIsLoadingPreview(true);
    setPreviewErr(null);
    try {
      const res = await CatalogItemService.previewConvertType(workspaceId, itemId, targetType, retainUnmapped);
      setPreview((res as any)?.preview ?? (res as any)?.data ?? res);
    } catch (err: any) {
      setPreviewErr(err);
      setPreview(null);
    } finally {
      setIsLoadingPreview(false);
    }
  }, [workspaceId, itemId, targetType, retainUnmapped]);

  const convertMutation = useMutation({
    mutationFn: async (expectedVersion?: number) => {
      const res = await CatalogItemService.convertType(
        workspaceId, itemId, targetType, expectedVersion, retainUnmapped,
      );
      return (res?.item || (res as any)?.data || res) as CatalogItem;
    },
    onSuccess: (updatedItem) => {
      toast.success(`Converted item type to ${targetType}`);
      if (workspaceId) {
        queryClient.invalidateQueries({ queryKey: itemKeys.all(workspaceId) });
        queryClient.invalidateQueries({ queryKey: itemKeys.byId(workspaceId, itemId) });
      }
      onSuccess?.(updatedItem);
    },
    onError: (err: any) => {
      toast.error('Type conversion failed', {
        description: err?.message || 'An unexpected error occurred during type conversion.',
      });
    },
  });

  const state = {
    preview,
    isLoadingPreview,
    isSubmitting: convertMutation.isPending,
    error: previewErr || convertMutation.error,
  };

  const actions = {
    loadPreview,
    convert: convertMutation.mutateAsync,
  };

  return {
    state,
    actions,
    ...state,
    ...actions,
  };
}

// ── 6. Table Sorting & Selection Hook ───────────────────────────────────────

export type SortField = 'title' | 'authors' | 'year' | 'journal' | 'createdAt' | 'lastReadAt';
export type SortOrder = 'asc' | 'desc';

export interface UseItemTableOptions {
  papers?: Paper[];
  items?: CatalogItem[];
  initialActiveId?: string | null;
  initialSortField?: SortField;
  initialSortOrder?: SortOrder;
}

export function useItemTable({
  papers,
  items,
  initialActiveId = null,
  initialSortField = 'createdAt',
  initialSortOrder = 'desc',
}: UseItemTableOptions) {
  const targetItems = items || papers || [];
  const [sortField, setSortField] = useState<SortField>(initialSortField);
  const [sortOrder, setSortOrder] = useState<SortOrder>(initialSortOrder);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeItemId, setActiveItemId] = useState<string | null>(initialActiveId);

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  }, [sortField]);

  const toggleSelect = useCallback((id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === targetItems.length) {
        return new Set();
      }
      return new Set(targetItems.map((item) => item.id));
    });
  }, [targetItems]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const sortedItems = useMemo(() => {
    return [...targetItems].sort((first, second) => {
      let comparison = 0;
      switch (sortField) {
        case 'title':
          comparison = (first.title || '').localeCompare(second.title || '');
          break;
        case 'authors':
          comparison = (first.authors?.[0] || '').localeCompare(second.authors?.[0] || '');
          break;
        case 'year':
          comparison = Number(first.year || 0) - Number(second.year || 0);
          break;
        case 'journal':
          comparison = (first.journal || first.publisher || '').localeCompare(
            second.journal || second.publisher || '',
          );
          break;
        case 'lastReadAt': {
          const t1 = new Date(
            first.lastReadAt || first.accessedAt || first.updatedAt || first.createdAt || 0,
          ).getTime();
          const t2 = new Date(
            second.lastReadAt || second.accessedAt || second.updatedAt || second.createdAt || 0,
          ).getTime();
          comparison = t1 - t2;
          break;
        }
        case 'createdAt':
          comparison =
            new Date(first.createdAt || 0).getTime() -
            new Date(second.createdAt || 0).getTime();
          break;
        default:
          comparison = 0;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [targetItems, sortField, sortOrder]);

  const isAllSelected = targetItems.length > 0 && selectedIds.size === targetItems.length;
  const isPartiallySelected = selectedIds.size > 0 && selectedIds.size < targetItems.length;

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

export const usePaperTable = useItemTable;
export const useLibraryPapers = (workspaceId: string, query?: PaperQueryParams) => {
  return useQuery({
    queryKey: itemKeys.all(workspaceId),
    queryFn: () => getAllPapers(workspaceId, query),
    enabled: Boolean(workspaceId),
  });
};
export const useUpdatePaper = (workspaceId: string, paperId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<CatalogItem> & { silent?: boolean }) => updatePaper(workspaceId, paperId, data),
    onSuccess: (res, variables) => {
      queryClient.invalidateQueries({ queryKey: itemKeys.all(workspaceId) });
      queryClient.setQueryData(itemKeys.byId(workspaceId, paperId), res);
      if (!variables?.silent) {
        toast.success('Metadata updated', { id: 'item-mutation-toast' });
      }
    },
    onError: (err: any, variables) => {
      if (!variables?.silent) {
        toast.error('Failed to update metadata', {
          description: err?.message || 'Please check your connection and try again.',
          id: 'item-mutation-toast',
        });
      }
    },
  });
};
export const useDeletePaper = (workspaceId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (paperId: string | { paperId: string; silent?: boolean }) => {
      const id = typeof paperId === 'string' ? paperId : paperId.paperId;
      return deletePaper(workspaceId, id);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: itemKeys.all(workspaceId) });
      const isSilent = typeof variables === 'object' && variables?.silent;
      if (!isSilent) {
        toast.success('Moved to trash', {
          description: 'You can restore this item from Trash at any time.',
          id: 'item-mutation-toast',
        });
      }
    },
    onError: (err: any, variables) => {
      const isSilent = typeof variables === 'object' && variables?.silent;
      if (!isSilent) {
        toast.error('Failed to delete item', {
          description: err?.message || 'Please try again.',
          id: 'item-mutation-toast',
        });
      }
    },
  });
};

// ── useExtractNotes ───────────────────────────────────────────────────────────
/**
 * Synthesize literature notes from all highlighted passages in a document.
 * Backed by POST /items/:id/extract-notes
 */

export function useExtractNotes(workspaceId: string) {
  return useMutation({
    mutationFn: (itemId: string) =>
      AnnotationService.extractNotes(workspaceId, itemId),
    onSuccess: (data) => {
      const count = data?.totalExtracted ?? 0;
      toast.success('Notes extracted', {
        description: count > 0 ? `Synthesized ${count} highlight(s) into literature notes.` : 'Completed extraction from document.',
        id: 'extract-notes',
      });
    },
    onError: (err: any) => {
      toast.error('Failed to extract notes', {
        description: err?.message || 'Please try again.',
        id: 'extract-notes',
      });
    },
  });
}
