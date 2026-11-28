'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ItemsService } from '../clients/items.client';
import type { Item } from '@/features/library/types/core.types';
import {
  itemKeys,
  curationKeys,
  invalidateCollections,
  normalizeSpaceId,
  waitForBootstrapCache,
} from '@/features/library/sdk/query-keys';
import {
  chunkUniqueIds,
  invalidateLibraryCatalogDependencies,
  removeItemsFromScopeCaches,
} from './cache-patcher.queries';

// ── Trash & Bulk Item Lifecycle Queries ──────────────────────────────────────

export function useTrash(
  spaceId: string = 'user',
  options?: { enabled?: boolean },
) {
  const queryClient = useQueryClient();
  const effectiveScope = normalizeSpaceId(spaceId);
  const cacheKey = itemKeys.trash(effectiveScope);

  const trashQuery = useQuery({
    queryKey: cacheKey,
    queryFn: async ({ signal }) => {
      const seeded = await waitForBootstrapCache<
        Awaited<ReturnType<typeof ItemsService.getAll>>
      >(queryClient, effectiveScope, cacheKey);
      if (seeded !== undefined) return seeded;
      return ItemsService.getAll(effectiveScope, { view: 'trash' }, { signal });
    },
    enabled: (options?.enabled ?? true) && Boolean(spaceId),
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
      invalidateLibraryCatalogDependencies(queryClient, effectiveScope, {
        itemsList: true,
        collections: true,
        tags: true,
        counts: true,
      });
    },
    onError: (err: Error) => {
      toast.error('Failed to restore item', {
        description: err.message || 'Please try again.',
        id: 'trash-mutation-toast',
      });
    },
  });

  const emptyTrashMutation = useMutation({
    mutationFn: async (items: Item[]) => {
      const purgeIdsBatch = async (ids: string[]) => {
        const chunks = chunkUniqueIds(ids, 100);
        if (chunks.length === 0) return 0;
        const results = await Promise.all(
          chunks.map((chunk) => ItemsService.bulkPurge(effectiveScope, chunk)),
        );
        return results.reduce(
          (sum, res, idx) => sum + (res?.count ?? chunks[idx].length),
          0,
        );
      };

      const initialIds = items.map((item) => item.id).filter(Boolean);

      if (typeof ItemsService.emptyTrash === 'function') {
        try {
          const atomicRes = await ItemsService.emptyTrash(effectiveScope);
          const purgedCount = atomicRes?.purgedCount ?? atomicRes?.count ?? 0;
          const failedIds = Array.isArray(atomicRes?.failedIds)
            ? atomicRes.failedIds.filter(Boolean)
            : [];
          if (failedIds.length > 0) {
            const fallbackPurged = await purgeIdsBatch(failedIds);
            return purgedCount + fallbackPurged;
          }
          if (atomicRes && typeof atomicRes.purgedCount === 'number') {
            return purgedCount || initialIds.length;
          }
        } catch {
          // Fallback to single bulkPurge pass if backend /items/trash is unavailable
        }
      }

      if (initialIds.length > 0) {
        return purgeIdsBatch(initialIds);
      }

      const res = await ItemsService.getAll(effectiveScope, {
        view: 'trash',
        limit: 200,
      });
      const remainingItems = Array.isArray(res?.items)
        ? res.items
        : Array.isArray(res)
          ? (res as Item[])
          : [];
      const remainingIds = remainingItems
        .map((item) => item.id)
        .filter((id): id is string => Boolean(id));
      return purgeIdsBatch(remainingIds);
    },
    onSuccess: (count, items) => {
      const purgedIds = Array.isArray(items)
        ? items.map((item) => item.id).filter((id): id is string => Boolean(id))
        : [];
      if (purgedIds.length > 0) {
        removeItemsFromScopeCaches(queryClient, effectiveScope, purgedIds, { permanent: true });
      }
      toast.success('Trash emptied', {
        description: `Permanently removed ${count} item(s).`,
        id: 'trash-mutation-toast',
      });
    },
    onSettled: () => {
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
    refetch: trashQuery.refetch,
    restoreItem: restoreMutation.mutateAsync,
    emptyTrash: () => emptyTrashMutation.mutateAsync(trashItems),
  };
}

export function useDeleteLibraryItemsMutation(spaceId?: string) {
  const queryClient = useQueryClient();
  const effectiveScope = normalizeSpaceId(spaceId);

  return useMutation({
    mutationFn: async (itemIds: string[] | string) => {
      const rawIds = Array.isArray(itemIds) ? itemIds : [itemIds];
      const chunks = chunkUniqueIds(rawIds, 100);
      if (chunks.length === 0) return [];
      await Promise.all(
        chunks.map((chunk) =>
          chunk.length === 1 && chunks.length === 1
            ? ItemsService.delete(effectiveScope, chunk[0])
            : ItemsService.bulkTrash(effectiveScope, chunk),
        ),
      );
      return rawIds;
    },
    onSuccess: (ids) => {
      removeItemsFromScopeCaches(queryClient, effectiveScope, ids);
      toast.success(
        ids.length === 1 ? 'Item moved to trash' : `Moved ${ids.length} items to trash`,
        { id: 'item-delete' },
      );
    },
    onSettled: () => {
      void invalidateLibraryCatalogDependencies(queryClient, effectiveScope, {
        itemsList: true,
        collections: true,
        tags: true,
        counts: true,
        smartCollections: true,
      });
      void queryClient.invalidateQueries({ queryKey: itemKeys.trash(effectiveScope) });
      void queryClient.invalidateQueries({ queryKey: curationKeys.duplicates(effectiveScope) });
      void queryClient.invalidateQueries({ queryKey: curationKeys.integrity(effectiveScope) });
    },
    onError: (err: Error) => {
      toast.error('Failed to delete items', {
        description: err.message || 'Please try again.',
        id: 'item-delete',
      });
    },
  });
}

export function useBatchRestoreItemsMutation(spaceId?: string) {
  const queryClient = useQueryClient();
  const effectiveScope = normalizeSpaceId(spaceId);

  return useMutation({
    mutationFn: async (itemIds: string[] | string) => {
      const rawIds = Array.isArray(itemIds) ? itemIds : [itemIds];
      const chunks = chunkUniqueIds(rawIds, 100);
      if (chunks.length === 0) return [];
      await Promise.all(
        chunks.map((chunk) =>
          chunk.length === 1 && chunks.length === 1
            ? ItemsService.restore(effectiveScope, chunk[0])
            : ItemsService.bulkRestore(effectiveScope, chunk),
        ),
      );
      return rawIds;
    },
    onSuccess: (ids) => {
      toast.success(
        `Restored ${ids.length} ${ids.length === 1 ? 'item' : 'items'}`,
        { id: 'item-restore' },
      );
    },
    onSettled: () => {
      void invalidateLibraryCatalogDependencies(queryClient, effectiveScope, {
        itemsList: true,
        collections: true,
        tags: true,
        counts: true,
        smartCollections: true,
      });
      void queryClient.invalidateQueries({ queryKey: itemKeys.trash(effectiveScope) });
      void queryClient.invalidateQueries({ queryKey: curationKeys.duplicates(effectiveScope) });
      void queryClient.invalidateQueries({ queryKey: curationKeys.integrity(effectiveScope) });
    },
    onError: (err: Error) => {
      toast.error('Failed to restore items', {
        description: err.message || 'Please try again.',
        id: 'item-restore',
      });
    },
  });
}

export function useBatchPurgeItemsMutation(spaceId?: string) {
  const queryClient = useQueryClient();
  const effectiveScope = normalizeSpaceId(spaceId);

  return useMutation({
    mutationFn: async (itemIds: string[] | string) => {
      const rawIds = Array.isArray(itemIds) ? itemIds : [itemIds];
      const chunks = chunkUniqueIds(rawIds, 100);
      if (chunks.length === 0) return [];
      await Promise.all(
        chunks.map((chunk) => ItemsService.bulkPurge(effectiveScope, chunk)),
      );
      return rawIds;
    },
    onSuccess: (ids) => {
      removeItemsFromScopeCaches(queryClient, effectiveScope, ids);
      toast.success(
        `Permanently deleted ${ids.length} ${ids.length === 1 ? 'item' : 'items'}`,
        { id: 'item-purge' },
      );
    },
    onSettled: () => {
      void invalidateLibraryCatalogDependencies(queryClient, effectiveScope, {
        itemsList: true,
        collections: true,
        tags: true,
        counts: true,
        smartCollections: true,
      });
      void queryClient.invalidateQueries({ queryKey: itemKeys.trash(effectiveScope) });
      void queryClient.invalidateQueries({ queryKey: curationKeys.duplicates(effectiveScope) });
      void queryClient.invalidateQueries({ queryKey: curationKeys.integrity(effectiveScope) });
    },
    onError: (err: Error) => {
      toast.error('Failed to permanently delete items', {
        description: err.message || 'Please try again.',
        id: 'item-purge',
      });
    },
  });
}

// ── Tags Query Hooks ─────────────────────────────────────────────────────────
