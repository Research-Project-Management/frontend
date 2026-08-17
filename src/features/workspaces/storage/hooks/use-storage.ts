import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/shared/constants';
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
  createFileRecord
} from '../services/file.service';
import type { CreateFileRecordParams } from '../types/storage.types';

// --- Queries ---

export function useHomeFiles(workspaceId: string, parentId?: string | null) {
  return useQuery({
    queryKey: queryKeys.storage.workspaceHomeFiles(workspaceId, parentId),
    queryFn: () => getAllFiles(workspaceId, parentId),
    enabled: !!workspaceId,
  });
}

export function useMyFiles(workspaceId: string) {
  return useQuery({
    queryKey: queryKeys.storage.workspaceMyFiles(workspaceId),
    queryFn: () => getMyFiles(workspaceId),
    enabled: !!workspaceId,
  });
}

export function useSharedFiles(workspaceId: string) {
  return useQuery({
    queryKey: queryKeys.storage.workspaceShared(workspaceId),
    queryFn: () => getSharedFiles(workspaceId),
    enabled: !!workspaceId,
  });
}

export function useStarredFiles(workspaceId: string) {
  return useQuery({
    queryKey: queryKeys.storage.workspaceStarred(workspaceId),
    queryFn: () => getStarredFiles(workspaceId),
    enabled: !!workspaceId,
  });
}

export function useTrash(workspaceId: string) {
  return useQuery({
    queryKey: queryKeys.storage.workspaceTrashed(workspaceId),
    queryFn: () => getTrashedFiles(workspaceId),
    enabled: !!workspaceId,
  });
}

// --- Mutations ---

export const useCreateFolder = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, workspaceId, parentId }: { name: string; workspaceId: string; parentId?: string | null }) =>
      createFolder(name, { workspaceId, parentId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.storage.all });
    },
  });
};

export const useToggleStarItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => toggleStarItem(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.storage.all });
    },
  });
};

export const useDeleteItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => deleteItem(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.storage.all });
    },
  });
};

export const useRenameItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, name }: { itemId: string; name: string }) => renameItem(itemId, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.storage.all });
    },
  });
};

export const useMoveItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, parentId }: { itemId: string; parentId: string | null }) => moveItem(itemId, parentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.storage.all });
    },
  });
};

export const useRestoreItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => restoreItem(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.storage.all });
    },
  });
};

export const usePermanentlyDeleteItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => permanentlyDeleteItem(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.storage.all });
    },
  });
};

export const useCreateFileRecord = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateFileRecordParams) => createFileRecord(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.storage.all });
    },
  });
};
