'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { storageKeys } from '@/features/workspaces/storage/constants/storage.keys';
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
      workspaceId,
      pageId: targetPageId,
      parentId: targetParentId,
    }: {
      file: File;
      projectId: string;
      workspaceId: string;
      pageId: string;
      parentId?: string | null;
    }) => {
      const timestamp = Date.now();
      const fileName = `workspace/${workspaceId}/${timestamp}-${file.name}`;
      const fileBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1] ?? (reader.result as string));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const formData = new FormData();
      formData.append('file', file);
      formData.append('fileName', fileName);

      const { path } = await EditorStorageService.uploadToR2(targetPageId, formData);

      await EditorStorageService.createFileRecord(targetPageId, {
        filename: file.name,
        size: file.size,
        mimeType: file.type || 'application/octet-stream',
        url: `/api/files/r2/${path}`,
        parentId: targetParentId || null,
        fileBase64,
      });
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
      projectId: string;
      workspaceId: string;
      parentId?: string | null;
      pageId?: string | null;
    }) => {
      if (targetPageId) {
        return EditorStorageService.createPageFolder(targetPageId, name, targetParentId);
      }
      return EditorStorageService.createProjectFolder(projectId, name, targetParentId);
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
      const targetId = variables.itemId || variables.fileId || '';
      const nextName = variables.newName || variables.name || '';
      return EditorStorageService.renameItem(targetId, nextName);
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
