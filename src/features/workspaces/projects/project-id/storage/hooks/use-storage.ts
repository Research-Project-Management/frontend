import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
} from '@/features/workspaces/projects/project-id/storage/services/file.service';
import type { CreateFileRecordParams } from '../types/storage.types';

// --- Queries ---

export function useHomeFiles(projectId: string, parentId?: string | null) {
  return useQuery({
    queryKey: storageKeys.projectHomeFiles(projectId, parentId),
    queryFn: () => getAllFiles(projectId, parentId),
    enabled: !!projectId,
  });
}

export function useMyFiles(projectId: string) {
  return useQuery({
    queryKey: storageKeys.projectMyFiles(projectId),
    queryFn: () => getMyFiles(projectId),
    enabled: !!projectId,
  });
}

export function useSharedFiles(projectId: string) {
  return useQuery({
    queryKey: storageKeys.projectShared(projectId),
    queryFn: () => getSharedFiles(projectId),
    enabled: !!projectId,
  });
}

export function useStarredFiles(projectId: string) {
  return useQuery({
    queryKey: storageKeys.projectStarred(projectId),
    queryFn: () => getStarredFiles(projectId),
    enabled: !!projectId,
  });
}

export function useTrash(projectId: string) {
  return useQuery({
    queryKey: storageKeys.projectTrashed(projectId),
    queryFn: () => getTrashedFiles(projectId),
    enabled: !!projectId,
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
