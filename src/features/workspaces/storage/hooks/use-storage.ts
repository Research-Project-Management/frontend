import { useQuery, useInfiniteQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { storageKeys } from '../constants/storage.keys';
import {
  getHomeFiles,
  getAllFiles,
  getMyFiles,
  getSharedFiles,
  getStarredFiles,
  getTrashedFiles,
  getStorageUsage,
  createFolder,
  toggleStarItem,
  deleteItem,
  renameItem,
  moveItem,
  restoreItem,
  permanentlyDeleteItem,
  createFileRecord,
  batchDeleteItems,
  batchRestoreItems,
  batchPermanentlyDeleteItems,
  batchStarItems,
  getFolderPath,
} from '../services/file.service';
import type { CreateFileRecordParams } from '../types/storage.types';
import type { FileQueryParams } from '../services/file.service';

// --- Queries ---

const STORAGE_QUERY_OPTIONS = {
  staleTime: 5 * 1000, // 5s fresh cache
  refetchOnWindowFocus: true, // Auto refetch when tab is focused
  refetchInterval: 15 * 1000, // Auto background polling every 15s
  placeholderData: keepPreviousData,
};

export function useHomeFiles(
  workspaceId: string,
  parentId?: string | null,
  queryParams?: FileQueryParams
) {
  const mergedParams: FileQueryParams = {
    parentId: parentId ?? undefined,
    ...queryParams,
  };

  return useInfiniteQuery({
    queryKey: [...storageKeys.workspaceHomeFiles(workspaceId, parentId), 'infinite', mergedParams],
    queryFn: ({ pageParam = 1 }) =>
      getAllFiles(workspaceId, { ...mergedParams, page: pageParam as number, limit: 40 }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? (lastPage.page || 1) + 1 : undefined,
    enabled: !!workspaceId,
    ...STORAGE_QUERY_OPTIONS,
  });
}

export function useWorkspaceFiles(workspaceId: string, parentId?: string | null) {
  return useQuery({
    queryKey: storageKeys.workspaceFiles(workspaceId, parentId),
    queryFn: () => getAllFiles(workspaceId, parentId),
    enabled: !!workspaceId,
    ...STORAGE_QUERY_OPTIONS,
  });
}

export function useMyFiles(workspaceId: string, params?: FileQueryParams) {
  return useInfiniteQuery({
    queryKey: [...storageKeys.workspaceMyFiles(workspaceId), 'infinite', params],
    queryFn: ({ pageParam = 1 }) =>
      getMyFiles(workspaceId, { ...params, page: pageParam as number, limit: 40 }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? (lastPage.page || 1) + 1 : undefined,
    enabled: !!workspaceId,
    ...STORAGE_QUERY_OPTIONS,
  });
}

export function useSharedFiles(workspaceId: string, params?: FileQueryParams) {
  return useInfiniteQuery({
    queryKey: [...storageKeys.workspaceShared(workspaceId), 'infinite', params],
    queryFn: ({ pageParam = 1 }) =>
      getSharedFiles(workspaceId, { ...params, page: pageParam as number, limit: 40 }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? (lastPage.page || 1) + 1 : undefined,
    enabled: !!workspaceId,
    ...STORAGE_QUERY_OPTIONS,
  });
}

export function useStarredFiles(workspaceId: string, params?: FileQueryParams) {
  return useInfiniteQuery({
    queryKey: [...storageKeys.workspaceStarred(workspaceId), 'infinite', params],
    queryFn: ({ pageParam = 1 }) =>
      getStarredFiles(workspaceId, { ...params, page: pageParam as number, limit: 40 }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? (lastPage.page || 1) + 1 : undefined,
    enabled: !!workspaceId,
    ...STORAGE_QUERY_OPTIONS,
  });
}

export function useTrash(workspaceId: string, params?: FileQueryParams) {
  return useInfiniteQuery({
    queryKey: [...storageKeys.workspaceTrashed(workspaceId), 'infinite', params],
    queryFn: ({ pageParam = 1 }) =>
      getTrashedFiles(workspaceId, { ...params, page: pageParam as number, limit: 40 }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? (lastPage.page || 1) + 1 : undefined,
    enabled: !!workspaceId,
    ...STORAGE_QUERY_OPTIONS,
  });
}

export function useStorageUsage(workspaceId: string) {
  return useQuery({
    queryKey: storageKeys.workspaceUsage(workspaceId),
    queryFn: () => getStorageUsage(workspaceId),
    enabled: !!workspaceId,
    ...STORAGE_QUERY_OPTIONS,
  });
}

export function useFolderPath(folderId?: string | null) {
  return useQuery({
    queryKey: ['storage', 'folder-path', folderId],
    queryFn: () => getFolderPath(folderId!),
    enabled: !!folderId,
    staleTime: 30 * 1000,
  });
}

// --- Mutations ---

export const useCreateFolder = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, workspaceId, parentId }: { name: string; workspaceId: string; parentId?: string | null }) =>
      createFolder(name, { workspaceId, parentId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: storageKeys.all });
    },
  });
};

export const useToggleStarItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => toggleStarItem(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: storageKeys.all });
    },
  });
};

export const useDeleteItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => deleteItem(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: storageKeys.all });
    },
  });
};

export const useRenameItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, name }: { itemId: string; name: string }) => renameItem(itemId, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: storageKeys.all });
    },
  });
};

export const useMoveItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, parentId }: { itemId: string; parentId: string | null }) => moveItem(itemId, parentId),
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

export const useCreateFileRecord = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateFileRecordParams) => createFileRecord(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: storageKeys.all });
    },
  });
};

export const useBatchDeleteItems = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => batchDeleteItems(ids),
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

export const useBatchStarItems = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, starred }: { ids: string[]; starred: boolean }) => batchStarItems(ids, starred),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: storageKeys.all });
    },
  });
};

