import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { storageKeys } from '../constants/storage.keys';
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
  batchDeleteItems,
  batchRestoreItems,
  batchPermanentlyDeleteItems,
  batchStarItems,
  getFolderPath,
} from '../services/file.service';
import type { CreateFileRecordParams } from '../types/storage.types';

// --- Queries ---

const STORAGE_QUERY_OPTIONS = {
  staleTime: 5 * 1000, // 5s fresh cache
  refetchOnWindowFocus: true, // Auto refetch when tab is focused
  refetchInterval: 15 * 1000, // Auto background polling every 15s
};

export function useHomeFiles(workspaceId: string, parentId?: string | null) {
  return useQuery({
    queryKey: storageKeys.workspaceHomeFiles(workspaceId, parentId),
    queryFn: () => getAllFiles(workspaceId, parentId),
    enabled: !!workspaceId,
    ...STORAGE_QUERY_OPTIONS,
  });
}

export function useMyFiles(workspaceId: string) {
  return useQuery({
    queryKey: storageKeys.workspaceMyFiles(workspaceId),
    queryFn: () => getMyFiles(workspaceId),
    enabled: !!workspaceId,
    ...STORAGE_QUERY_OPTIONS,
  });
}

export function useSharedFiles(workspaceId: string) {
  return useQuery({
    queryKey: storageKeys.workspaceShared(workspaceId),
    queryFn: () => getSharedFiles(workspaceId),
    enabled: !!workspaceId,
    ...STORAGE_QUERY_OPTIONS,
  });
}

export function useStarredFiles(workspaceId: string) {
  return useQuery({
    queryKey: storageKeys.workspaceStarred(workspaceId),
    queryFn: () => getStarredFiles(workspaceId),
    enabled: !!workspaceId,
    ...STORAGE_QUERY_OPTIONS,
  });
}

export function useTrash(workspaceId: string) {
  return useQuery({
    queryKey: storageKeys.workspaceTrashed(workspaceId),
    queryFn: () => getTrashedFiles(workspaceId),
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

