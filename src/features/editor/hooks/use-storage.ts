'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { storageKeys } from '@/features/storage/constants/storage.keys';
import { StorageService as EditorStorageService, type EditorStorageItem } from '../services/storage.service';

export function useEditorStorage(pageId: string | null | undefined, parentId?: string | null) {
  const queryClient = useQueryClient();
  const queryKey = storageKeys.projectFilesEditor(pageId ?? undefined, parentId);

  const { data: children, isLoading, refetch } = useQuery({
    queryKey,
    queryFn: () => (pageId ? EditorStorageService.getPageFiles(pageId, parentId) : Promise.resolve([])),
    enabled: !!pageId,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  const uploadFileMutation = useMutation({
    mutationFn: async ({
      file,
      pageId: targetPageId,
      parentId: targetParentId,
    }: {
      file: File;
      projectId?: string;
      pageId: string;
      parentId?: string | null;
    }) => {
      return EditorStorageService.uploadPageFile(
        targetPageId,
        file,
        targetParentId,
      );
    },
    onSuccess: (_, variables) => {
      if (variables.pageId || variables.projectId) {
        queryClient.invalidateQueries({
          queryKey: storageKeys.projectFilesEditor(variables.pageId || variables.projectId),
        });
      }
    },
  });

  const createFolderMutation = useMutation({
    mutationFn: ({
      name,
      projectId,
      parentId: targetParentId,
      pageId: targetPageId,
    }: {
      name: string;
      projectId?: string;
      parentId?: string | null;
      pageId?: string | null;
    }) => {
      if (targetPageId) {
        return EditorStorageService.createPageFolder(targetPageId, name, targetParentId);
      }
      return EditorStorageService.createProjectFolder(projectId || 'default', name, targetParentId);
    },
    onSuccess: (_, variables) => {
      if (variables.pageId || variables.projectId) {
        queryClient.invalidateQueries({
          queryKey: storageKeys.projectFilesEditor(variables.pageId || variables.projectId),
        });
      }
    },
  });

  const renameMutation = useMutation({
    mutationFn: (variables: { itemId?: string; fileId?: string; newName?: string; name?: string }) => {
      const targetStorageId = variables.itemId || variables.fileId || '';
      const nextName = variables.newName || variables.name || '';
      return EditorStorageService.renameItem(targetStorageId, nextName);
    },
    onSuccess: () => {
      if (pageId) {
        queryClient.invalidateQueries({
          queryKey: storageKeys.projectFilesEditor(pageId),
        });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (itemId: string) => EditorStorageService.permanentlyDeleteItem(itemId),
    onSuccess: () => {
      if (pageId) {
        queryClient.invalidateQueries({
          queryKey: storageKeys.projectFilesEditor(pageId),
        });
      }
    },
  });

  const moveMutation = useMutation({
    mutationFn: ({ itemId, targetFolderId }: { itemId: string; targetFolderId: string | null }) =>
      EditorStorageService.moveItem(itemId, targetFolderId),
    onSuccess: () => {
      if (pageId) {
        queryClient.invalidateQueries({
          queryKey: storageKeys.projectFilesEditor(pageId),
        });
      }
    },
  });

  return {
    children: (children as EditorStorageItem[]) || [],
    files: (children as EditorStorageItem[]) || [],
    isLoading,
    refetch,
    uploadFile: uploadFileMutation,
    createFolder: createFolderMutation,
    renameItem: renameMutation,
    renameFile: renameMutation,
    deleteItem: deleteMutation,
    deleteFile: deleteMutation,
    moveItem: moveMutation,
    uploadFileMutation,
    createFolderMutation,
    renameMutation,
    deleteMutation,
    moveMutation,
  };
}
