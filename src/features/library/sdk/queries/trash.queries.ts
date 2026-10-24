'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ItemsService } from '../library.client';
import type { Item } from '@/features/library/domain/types/library.types';
import {
  itemKeys,
  tagKeys,
  invalidateCollections,
  normalizeScopeId,
} from '@/features/library/sdk/query-keys';
import { chunkUniqueIds } from './cache-patcher';

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
      const chunks = chunkUniqueIds(ids, 100);
      if (chunks.length === 0) return 0;
      let totalPurged = 0;
      for (const chunk of chunks) {
        const res = await ItemsService.bulkPurge(effectiveScope, chunk);
        totalPurged += res?.count ?? chunk.length;
      }
      return totalPurged;
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

export function useDeleteLibraryItemsMutation(scopeId?: string) {
  const queryClient = useQueryClient();
  const effectiveScope = normalizeScopeId(scopeId);

  return useMutation({
    mutationFn: async (itemIds: string[] | string) => {
      const rawIds = Array.isArray(itemIds) ? itemIds : [itemIds];
      const chunks = chunkUniqueIds(rawIds, 100);
      if (chunks.length === 0) return [];
      for (const chunk of chunks) {
        if (chunk.length === 1 && chunks.length === 1) {
          await ItemsService.delete(effectiveScope, chunk[0]);
        } else {
          await ItemsService.bulkTrash(effectiveScope, chunk);
        }
      }
      return rawIds;
    },
    onSuccess: (ids) => {
      queryClient.invalidateQueries({ queryKey: itemKeys.all(effectiveScope) });
      queryClient.invalidateQueries({ queryKey: itemKeys.trash(effectiveScope) });
      queryClient.invalidateQueries({ queryKey: tagKeys.list(effectiveScope) });
      invalidateCollections(queryClient, effectiveScope);
      toast.success(
        ids.length === 1 ? 'Item moved to trash' : `Moved ${ids.length} items to trash`,
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
      const rawIds = Array.isArray(itemIds) ? itemIds : [itemIds];
      const chunks = chunkUniqueIds(rawIds, 100);
      if (chunks.length === 0) return [];
      for (const chunk of chunks) {
        if (chunk.length === 1 && chunks.length === 1) {
          await ItemsService.restore(effectiveScope, chunk[0]);
        } else {
          await ItemsService.bulkRestore(effectiveScope, chunk);
        }
      }
      return rawIds;
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

export const useRestoreLibraryItemsMutation = useBatchRestoreItemsMutation;

export function useBatchPurgeItemsMutation(scopeId?: string) {
  const queryClient = useQueryClient();
  const effectiveScope = normalizeScopeId(scopeId);

  return useMutation({
    mutationFn: async (itemIds: string[] | string) => {
      const rawIds = Array.isArray(itemIds) ? itemIds : [itemIds];
      const chunks = chunkUniqueIds(rawIds, 100);
      if (chunks.length === 0) return [];
      for (const chunk of chunks) {
        await ItemsService.bulkPurge(effectiveScope, chunk);
      }
      return rawIds;
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

export const usePurgeLibraryItemsMutation = useBatchPurgeItemsMutation;
