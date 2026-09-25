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

export function useEditorStorage(pageId?: string | null, parentId?: string | null) {
  const queryClient = useQueryClient();
  const currentPage = usePageStore((s) => s.currentPage);
  const effectiveProjectId = currentPage?.projectId || pageId || '';

  const {
    data: items = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['editor-storage-files', effectiveProjectId, pageId, parentId],
    queryFn: async (): Promise<EditorStorageItem[]> => {
      const targetId = pageId || effectiveProjectId;
      if (!targetId) return [];
      try {
        const files = await StorageService.getPageFiles(targetId, parentId);
        return files || [];
      } catch (err) {
        console.warn('[useEditorStorage] Could not fetch remote files:', err);
        return [];
      }
    },
    enabled: !!(effectiveProjectId || pageId),
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
      const targetId = targetPageId || projectId || pageId || effectiveProjectId;
      return await StorageService.uploadPageFile(targetId, file, targetParentId ?? parentId);
    },
    onSuccess: (newItem) => {
      queryClient.invalidateQueries({ queryKey: ['editor-storage-files'] });
      toast.success(`Đã tải lên "${newItem.filename}"`);
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Không thể tải tệp lên');
    },
  });

  const createFolderMutation = useMutation({
    mutationFn: async ({ name, parentId: targetParentId }: { name: string; parentId?: string | null }): Promise<any> => {
      const targetId = pageId || effectiveProjectId;
      return await StorageService.createPageFolder(targetId, name, targetParentId ?? parentId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['editor-storage-files'] });
      toast.success('Đã tạo thư mục');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Không thể tạo thư mục');
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
      toast.success('Đã đổi tên');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Không thể đổi tên');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (itemId: string): Promise<any> => {
      return await StorageService.permanentlyDeleteItem(itemId, effectiveProjectId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['editor-storage-files'] });
      toast.success('Đã xóa tệp');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Không thể xóa tệp');
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
      toast.success('Đã di chuyển');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Không thể di chuyển');
    },
  });

  return {
    children: items,
    files: items,
    isLoading,
    refetch,
    uploadFile: uploadFileMutation as any,
    createFolder: createFolderMutation as any,
    renameFile: renameMutation as any,
    deleteFile: deleteMutation as any,
    moveItem: moveMutation as any,
    uploadFileMutation: uploadFileMutation as any,
    createFolderMutation: createFolderMutation as any,
    renameMutation: renameMutation as any,
    deleteMutation: deleteMutation as any,
    moveMutation: moveMutation as any,
  };
}
