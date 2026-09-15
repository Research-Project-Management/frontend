/**
 * @file use-trash.ts
 * @description Frontend hooks mirroring backend TrashController.
 * Provides queries and mutations for soft-deleted trash items, recovery, and permanent deletion.
 */

import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { storageKeys } from '../constants/storage.keys';
import {
  getTrashedFiles,
  moveToTrash,
  restoreItem,
  permanentlyDeleteItem,
  batchRestoreItems,
  batchPermanentlyDeleteItems,
} from '../services/trash.service';
import { DRIVE_QUERY_OPTIONS } from './use-drive';
import type { FileQueryParams } from '../services/drive.service';

export function useTrash(scopeId?: string, params?: FileQueryParams) {
  return useInfiniteQuery({
    queryKey: [...storageKeys.workspaceTrashed(scopeId), 'infinite', params],
    queryFn: ({ pageParam = 1 }) =>
      getTrashedFiles(scopeId, { ...params, page: pageParam as number, limit: 40 }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? (lastPage.page || 1) + 1 : undefined,
    enabled: true,
    ...DRIVE_QUERY_OPTIONS,
  });
}

export const useMoveToTrash = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => moveToTrash(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: storageKeys.all });
    },
  });
};

export const useRestoreItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => restoreItem(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: storageKeys.all });
    },
  });
};

export const usePermanentlyDeleteItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => permanentlyDeleteItem(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: storageKeys.all });
    },
  });
};

export const useBatchRestoreItems = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => batchRestoreItems(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: storageKeys.all });
    },
  });
};

export const useBatchPermanentDeleteItems = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => batchPermanentlyDeleteItems(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: storageKeys.all });
    },
  });
};
