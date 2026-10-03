'use client';

/**
 * use-storage.ts
 *
 * Real-time storage hooks for Editor Files Explorer wired to:
 * - Manuscript Structure Service (`/api/v1/manuscripts/projects/:projectId/structure`)
 * - Manuscript Filestore Service (`/api/v1/manuscripts/projects/:projectId/files`)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { StorageService, type EditorStorageItem } from '../services/storage.service';
import { usePageStore } from '../store';

export function useEditorStorage(
  pageIdOrProjectId?: string | null,
  parentId?: string | null,
  explicitProjectId?: string | null,
) {
  const queryClient = useQueryClient();
  const currentPage = usePageStore((s) => s.currentPage);
  const storeProjectId = usePageStore((s) => s.projectId);

  // Derive genuine project ID from explicit param, page store, or currentPage
  const resolvedProjectId =
    explicitProjectId ||
    (typeof currentPage?.projectId === 'string'
      ? currentPage.projectId
      : (currentPage?.projectId as any)?.id) ||
    storeProjectId ||
    '';

  // If pageIdOrProjectId matches storeProjectId or explicitProjectId, it is definitely a projectId
  const effectiveProjectId =
    resolvedProjectId ||
    (pageIdOrProjectId && pageIdOrProjectId === storeProjectId ? pageIdOrProjectId : '');

  const {
    data: items = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['editor-storage-files', effectiveProjectId, pageIdOrProjectId, parentId],
    queryFn: async (): Promise<EditorStorageItem[]> => {
      if (effectiveProjectId) {
        return await StorageService.getProjectFiles(effectiveProjectId, parentId);
      }
      const targetId = pageIdOrProjectId || '';
      if (!targetId) return [];
      try {
        const files = await StorageService.getPageFiles(targetId, parentId);
        return files || [];
      } catch (err) {
        console.warn('[useEditorStorage] Could not fetch remote files:', err);
        return [];
      }
    },
    enabled: Boolean(effectiveProjectId || pageIdOrProjectId),
  });

  const uploadFileMutation = useMutation({
    mutationFn: async ({
      file,
      projectId,
      pageId: targetPageId,
      parentId: targetParentId,
    }: {
      file: File;
      projectId?: string;
      pageId?: string;
      parentId?: string | null;
    }): Promise<EditorStorageItem> => {
      const pid = projectId || effectiveProjectId;
      const targetId = targetPageId || pageIdOrProjectId || pid || '';
      return await StorageService.uploadPageFile(
        targetId,
        file,
        targetParentId ?? parentId,
        undefined,
        pid || undefined,
      );
    },
    onSuccess: (newItem) => {
      queryClient.invalidateQueries({ queryKey: ['editor-storage-files'] });
      toast.success(`Uploaded "${newItem.filename}"`);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to upload file';
      toast.error(msg);
    },
  });

  const createFolderMutation = useMutation({
    mutationFn: async ({
      name,
      parentId: targetParentId,
      projectId: targetProjectId,
      pageId: targetPageId,
    }: {
      name: string;
      parentId?: string | null;
      projectId?: string;
      pageId?: string;
    }): Promise<any> => {
      const pid = targetProjectId || effectiveProjectId;
      if (pid) {
        return await StorageService.createProjectFolder(pid, name, targetParentId ?? parentId);
      }
      const targetId = targetPageId || pageIdOrProjectId || '';
      return await StorageService.createPageFolder(targetId, name, targetParentId ?? parentId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['editor-storage-files'] });
      toast.success('Folder created');
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to create folder';
      toast.error(msg);
    },
  });

  const renameMutation = useMutation({
    mutationFn: async (args: { itemId?: string; fileId?: string; newName?: string; name?: string }): Promise<any> => {
      const id = args.itemId || args.fileId || '';
      const name = args.newName || args.name || '';
      return await StorageService.renameItem(id, name, effectiveProjectId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['editor-storage-files'] });
      toast.success('Renamed successfully');
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to rename item';
      toast.error(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (itemId: string): Promise<any> => {
      return await StorageService.permanentlyDeleteItem(itemId, effectiveProjectId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['editor-storage-files'] });
      toast.success('File deleted');
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to delete file';
      toast.error(msg);
    },
  });

  const moveMutation = useMutation({
    mutationFn: async (args: { itemId?: string; targetFolderId?: string | null } | string): Promise<any> => {
      const itemId = typeof args === 'string' ? args : (args.itemId || '');
      const targetFolderId = typeof args === 'string' ? null : (args.targetFolderId ?? null);
      return await StorageService.moveItem(itemId, targetFolderId, effectiveProjectId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['editor-storage-files'] });
      toast.success('Moved successfully');
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to move item';
      toast.error(msg);
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (args: { itemId: string; sortOrder: number; projectId?: string }) => {
      const pid = args.projectId || effectiveProjectId;
      return await StorageService.reorderItem(args.itemId, args.sortOrder, pid);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['editor-storage-files'] });
      toast.success('Reordered successfully');
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to reorder item';
      toast.error(msg);
    },
  });

  const setRootDocMutation = useMutation({
    mutationFn: async (args: { nodeId: string; projectId?: string }) => {
      const pid = args.projectId || effectiveProjectId;
      return await StorageService.setRootDoc(args.nodeId, pid);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['editor-storage-files'] });
      queryClient.invalidateQueries({ queryKey: ['editor-root-doc'] });
      toast.success('Main document set successfully');
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to set main document';
      toast.error(msg);
    },
  });

  const rootDocQuery = useQuery({
    queryKey: ['editor-root-doc', effectiveProjectId],
    queryFn: async () => {
      if (!effectiveProjectId) return null;
      return await StorageService.getRootDoc(effectiveProjectId);
    },
    enabled: !!effectiveProjectId,
  });

  return {
    children: items,
    files: items,
    isLoading,
    refetch,
    rootDoc: rootDocQuery.data,
    rootDocLoading: rootDocQuery.isLoading,
    uploadFile: uploadFileMutation,
    createFolder: createFolderMutation,
    renameFile: renameMutation,
    deleteFile: deleteMutation,
    moveItem: moveMutation,
    reorderItem: reorderMutation,
    setRootDoc: setRootDocMutation,
    uploadFileMutation,
    createFolderMutation,
    renameMutation,
    deleteMutation,
    moveMutation,
    reorderMutation,
    setRootDocMutation,
  };
}

