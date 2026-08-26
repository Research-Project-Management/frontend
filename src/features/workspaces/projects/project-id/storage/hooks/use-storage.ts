import { useQuery, useInfiniteQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { storageKeys } from '@/features/workspaces/storage/constants/storage.keys';
import {
  getAllFiles,
  getMyFiles,
  getSharedFiles,
  getStarredFiles,
  getTrashedFiles,
  createFolder,
  toggleStarItem,
  deleteItem,
  renameItem,
  moveItem,
  restoreItem,
  permanentlyDeleteItem,
  createFileRecord,
  uploadFile,
  getFolderPath,
} from '@/features/workspaces/projects/project-id/storage/services/file.service';
import type { CreateFileRecordParams } from '../types/storage.types';
import type { FileQueryParams } from '@/features/workspaces/projects/project-id/storage/services/file.service';

// --- Queries ---

const STORAGE_QUERY_OPTIONS = {
  staleTime: 5 * 1000,
  refetchOnWindowFocus: true,
  refetchInterval: 15 * 1000,
  placeholderData: keepPreviousData,
};

export function useHomeFiles(
  projectId: string,
  parentId?: string | null,
  queryParams?: FileQueryParams
) {
  const mergedParams: FileQueryParams = {
    parentId: parentId ?? undefined,
    ...queryParams,
  };

  return useInfiniteQuery({
    queryKey: [...storageKeys.projectHomeFiles(projectId, parentId), 'infinite', mergedParams],
    queryFn: ({ pageParam = 1 }) =>
      getAllFiles(projectId, { ...mergedParams, page: pageParam as number, limit: 40 }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? (lastPage.page || 1) + 1 : undefined,
    enabled: !!projectId,
    ...STORAGE_QUERY_OPTIONS,
  });
}

export function useMyFiles(projectId: string, params?: FileQueryParams) {
  return useInfiniteQuery({
    queryKey: [...storageKeys.projectMyFiles(projectId), 'infinite', params],
    queryFn: ({ pageParam = 1 }) =>
      getMyFiles(projectId, { ...params, page: pageParam as number, limit: 40 }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? (lastPage.page || 1) + 1 : undefined,
    enabled: !!projectId,
    ...STORAGE_QUERY_OPTIONS,
  });
}

export function useSharedFiles(projectId: string, params?: FileQueryParams) {
  return useInfiniteQuery({
    queryKey: [...storageKeys.projectShared(projectId), 'infinite', params],
    queryFn: ({ pageParam = 1 }) =>
      getSharedFiles(projectId, { ...params, page: pageParam as number, limit: 40 }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? (lastPage.page || 1) + 1 : undefined,
    enabled: !!projectId,
    ...STORAGE_QUERY_OPTIONS,
  });
}

export function useStarredFiles(projectId: string, params?: FileQueryParams) {
  return useInfiniteQuery({
    queryKey: [...storageKeys.projectStarred(projectId), 'infinite', params],
    queryFn: ({ pageParam = 1 }) =>
      getStarredFiles(projectId, { ...params, page: pageParam as number, limit: 40 }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? (lastPage.page || 1) + 1 : undefined,
    enabled: !!projectId,
    ...STORAGE_QUERY_OPTIONS,
  });
}

export function useTrash(projectId: string, params?: FileQueryParams) {
  return useInfiniteQuery({
    queryKey: [...storageKeys.projectTrashed(projectId), 'infinite', params],
    queryFn: ({ pageParam = 1 }) =>
      getTrashedFiles(projectId, { ...params, page: pageParam as number, limit: 40 }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? (lastPage.page || 1) + 1 : undefined,
    enabled: !!projectId,
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

export const useUploadFile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ file, projectId, parentId, onProgress }: { 
      file: File, 
      projectId: string, 
      parentId?: string | null, 
      onProgress?: (p: number) => void 
    }) => uploadFile(file, { projectId, parentId, onProgress }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: storageKeys.all });
    },
  });
};

export const useCreateFolder = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, projectId, parentId }: { name: string; projectId: string; parentId?: string | null }) =>
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
