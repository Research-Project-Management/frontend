/**
 * @file use-drive.ts
 * @description Frontend hooks mirroring backend DriveController.
 * Provides React Query queries and mutations for drive navigation, hierarchy, and node mutations.
 */

import { useQuery, useInfiniteQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { storageKeys } from '../constants/storage.keys';
import {
  getAllFiles,
  getMyFiles,
  getSharedFiles,
  getStarredFiles,
  getFileById,
  getFolderPath,
  createFolder,
  toggleStarItem,
  deleteItem,
  renameItem,
  moveItem,
  batchDeleteItems,
  batchStarItems,
  updateFileMetadata,
  type FileQueryParams,
  type FolderPathResponse,
} from '../services/drive.service';

export const DRIVE_QUERY_OPTIONS = {
  staleTime: 5 * 1000,
  refetchOnWindowFocus: true,
  refetchInterval: 15 * 1000,
  placeholderData: keepPreviousData,
};

export function useHomeFiles(
  scopeId?: string,
  parentId?: string | null,
  queryParams?: FileQueryParams,
) {
  const mergedParams: FileQueryParams = {
    parentId: parentId ?? undefined,
    ...queryParams,
  };

  return useInfiniteQuery({
    queryKey: [...storageKeys.workspaceHomeFiles(scopeId, parentId), 'infinite', mergedParams],
    queryFn: ({ pageParam = 1 }) =>
      getAllFiles(scopeId, { ...mergedParams, page: pageParam as number, limit: 40 }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? (lastPage.page || 1) + 1 : undefined,
    enabled: true,
    ...DRIVE_QUERY_OPTIONS,
  });
}

export function useDriveFiles(scopeId?: string, parentId?: string | null) {
  return useQuery({
    queryKey: storageKeys.driveFiles(scopeId, parentId),
    queryFn: () => getAllFiles(scopeId, parentId),
    enabled: true,
    ...DRIVE_QUERY_OPTIONS,
  });
}

export const useAllFiles = useDriveFiles;
export const useWorkspaceFiles = useDriveFiles;

function createInfiniteStorageQuery(
  getKey: (scopeId?: string) => readonly unknown[],
  fetcher: (scopeId?: string, params?: FileQueryParams) => Promise<any>,
) {
  return function useInfiniteStorage(scopeId?: string, params?: FileQueryParams) {
    return useInfiniteQuery({
      queryKey: [...getKey(scopeId), 'infinite', params],
      queryFn: ({ pageParam = 1 }) =>
        fetcher(scopeId, { ...params, page: pageParam as number, limit: 40 }),
      initialPageParam: 1,
      getNextPageParam: (lastPage) =>
        lastPage.hasMore ? (lastPage.page || 1) + 1 : undefined,
      enabled: true,
      ...DRIVE_QUERY_OPTIONS,
    });
  };
}

export const useMyFiles = createInfiniteStorageQuery(storageKeys.workspaceMyFiles, getMyFiles);
export const useSharedFiles = createInfiniteStorageQuery(storageKeys.workspaceShared, getSharedFiles);
export const useStarredFiles = createInfiniteStorageQuery(storageKeys.workspaceStarred, getStarredFiles);

export function useFileById(id?: string) {
  return useQuery({
    queryKey: ['storage', 'file', id],
    queryFn: () => getFileById(id!),
    enabled: !!id,
    ...DRIVE_QUERY_OPTIONS,
  });
}

export function useFolderPath(folderId?: string | null) {
  return useQuery<FolderPathResponse>({
    queryKey: ['storage', 'folder-path', folderId],
    queryFn: () => getFolderPath(folderId!),
    enabled: !!folderId,
    staleTime: 30 * 1000,
  });
}

// ── Mutations ────────────────────────────────────────────────────────────────

export const useCreateFolder = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, projectId, parentId }: { name: string; projectId?: string; parentId?: string | null }) =>
      createFolder(name, { projectId, parentId }),
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

export const useBatchDeleteItems = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => batchDeleteItems(ids),
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

export const useUpdateFileMetadata = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ fileId, metaData }: { fileId: string; metaData: Record<string, any> }) =>
      updateFileMetadata(fileId, metaData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: storageKeys.all });
    },
  });
};
