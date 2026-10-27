'use client';

/**
 * use-storage.ts
 *
 * Real-time storage hooks for Editor Files Explorer wired to:
 * - Manuscript Structure Service (`/api/v1/manuscripts/projects/:projectId/structure`)
 * - Manuscript Filestore Service (`/api/v1/manuscripts/projects/:projectId/files`)
 *
 * Architectural Optimization:
 * - Decoupled query and mutation lifecycles (useEditorStorageFiles, useEditorStorageMutations, useEditorStorageRootDoc)
 * - Conditional query execution (enabled flag on folder expansion)
 * - Zero redundant root queries from child file/folder rows
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { manuscriptService } from '@/features/editor/sdk/manuscript.service';
import type { EditorStorageItem } from '@/features/editor/domain/types/storage-item.types';
import { usePageStore, workspaceCoordinator, editorCommandBus } from '@/features/editor/core';
import { pageKeys } from './document.queries';

export function useResolvedProjectId(
  pageIdOrProjectId?: string | null,
  explicitProjectId?: string | null,
): string {
  const pageProjectId = usePageStore((s) => {
    const rawProjectId = s.currentPage?.projectId;
    if (typeof rawProjectId === 'string') return rawProjectId;
    if (typeof rawProjectId === 'object' && rawProjectId !== null && 'id' in rawProjectId) {
      return String((rawProjectId as { id?: unknown }).id ?? '');
    }
    return '';
  });
  const storeProjectId = usePageStore((s) => s.projectId);

  const resolvedProjectId = explicitProjectId || pageProjectId || storeProjectId || '';

  return (
    resolvedProjectId ||
    (pageIdOrProjectId && pageIdOrProjectId === storeProjectId ? pageIdOrProjectId : '')
  );
}

export interface UseEditorStorageFilesOptions {
  enabled?: boolean;
}

const EMPTY_STORAGE_ITEMS: EditorStorageItem[] = [];

export function useEditorStorageFiles(
  pageIdOrProjectId?: string | null,
  parentId?: string | null,
  explicitProjectId?: string | null,
  options?: UseEditorStorageFilesOptions,
) {
  const effectiveProjectId = useResolvedProjectId(pageIdOrProjectId, explicitProjectId);

  const isEnabled = Boolean(
    (effectiveProjectId || pageIdOrProjectId) && (options?.enabled ?? true),
  );

  const {
    data: itemsData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['editor-storage-files', effectiveProjectId, pageIdOrProjectId, parentId],
    queryFn: async (): Promise<EditorStorageItem[]> => {
      if (effectiveProjectId) {
        return await manuscriptService.structure.getProjectFiles(effectiveProjectId, parentId);
      }
      const targetId = pageIdOrProjectId || '';
      if (!targetId) return [];
      try {
        const files = await manuscriptService.structure.getPageFiles(targetId, parentId);
        return files || [];
      } catch (err) {
        console.warn('[useEditorStorage] Could not fetch remote files:', err);
        return [];
      }
    },
    enabled: isEnabled,
  });

  const items = itemsData ?? EMPTY_STORAGE_ITEMS;

  return {
    items,
    isLoading,
    refetch,
  };
}

export function useEditorStorageMutations(
  pageIdOrProjectId?: string | null,
  explicitProjectId?: string | null,
  defaultParentId?: string | null,
) {
  const queryClient = useQueryClient();
  const effectiveProjectId = useResolvedProjectId(pageIdOrProjectId, explicitProjectId);

  const invalidateStorageState = () => {
    const parentPageId = usePageStore.getState().parentPageId || usePageStore.getState().currentPage?.id || pageIdOrProjectId;
    queryClient.invalidateQueries({ queryKey: ['editor-storage-files'] });
    queryClient.invalidateQueries({ queryKey: pageKeys.all });
    queryClient.invalidateQueries({ queryKey: ['projects'] });
    if (parentPageId) {
      queryClient.invalidateQueries({ queryKey: pageKeys.files(parentPageId) });
      queryClient.invalidateQueries({ queryKey: pageKeys.deletedFiles(parentPageId) });
    }
    editorCommandBus.dispatch({ type: 'filetree:updated' });
  };

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
      return await manuscriptService.filestore.uploadPageFile(
        targetId,
        file,
        targetParentId ?? defaultParentId,
        undefined,
        pid || undefined,
      );
    },
    onSuccess: (newItem) => {
      invalidateStorageState();
      toast.success(`Uploaded "${newItem.filename}"`, { id: `upload-${newItem.filename}` });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to upload file';
      toast.error(msg, { id: 'upload-error' });
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
    }): Promise<unknown> => {
      const pid = targetProjectId || effectiveProjectId;
      if (pid) {
        return await manuscriptService.structure.createProjectFolder(pid, name, targetParentId ?? defaultParentId);
      }
      const targetId = targetPageId || pageIdOrProjectId || '';
      return await manuscriptService.structure.createPageFolder(targetId, name, targetParentId ?? defaultParentId);
    },
    onSuccess: () => {
      invalidateStorageState();
      toast.success('Folder created', { id: 'create-folder' });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to create folder';
      toast.error(msg, { id: 'create-folder' });
    },
  });

  const renameMutation = useMutation({
    mutationFn: async (args: {
      itemId?: string;
      fileId?: string;
      newName?: string;
      name?: string;
      oldName?: string;
    }): Promise<unknown> => {
      const id = args.itemId || args.fileId || '';
      const name = args.newName || args.name || '';
      const old = args.oldName || '';
      try {
        const ok = await workspaceCoordinator.renameItem({
          itemId: id,
          oldName: old,
          newName: name,
          projectId: effectiveProjectId,
        });
        if (ok) return { success: true };
      } catch {}
      return await manuscriptService.structure.renameItem(id, name, effectiveProjectId);
    },
    onSuccess: () => {
      invalidateStorageState();
    },
    onError: (err: unknown, args) => {
      const msg = err instanceof Error ? err.message : 'Failed to rename item';
      toast.error(msg, { id: `rename-${args.itemId || args.fileId}` });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (itemId: string): Promise<unknown> => {
      try {
        const ok = await workspaceCoordinator.deleteFile(itemId, effectiveProjectId);
        if (ok) return { success: true };
      } catch {}
      return await manuscriptService.structure.permanentlyDeleteItem(itemId, effectiveProjectId);
    },
    onSuccess: () => {
      invalidateStorageState();
    },
    onError: (err: unknown, itemId) => {
      const msg = err instanceof Error ? err.message : 'Failed to delete file';
      toast.error(msg, { id: `delete-${itemId}` });
    },
  });

  const moveMutation = useMutation({
    mutationFn: async (args: { itemId?: string; targetFolderId?: string | null } | string): Promise<unknown> => {
      const itemId = typeof args === 'string' ? args : (args.itemId || '');
      const targetFolderId = typeof args === 'string' ? null : (args.targetFolderId ?? null);
      try {
        const ok = await workspaceCoordinator.moveItem({
          itemId,
          targetFolderId,
          projectId: effectiveProjectId,
        });
        if (ok) return { success: true };
      } catch {}
      return await manuscriptService.structure.moveItem(itemId, targetFolderId, effectiveProjectId);
    },
    onSuccess: () => {
      invalidateStorageState();
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to move item';
      toast.error(msg, { id: 'move-item' });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (args: { itemId: string; sortOrder: number; projectId?: string }) => {
      const pid = args.projectId || effectiveProjectId;
      return await manuscriptService.structure.reorderItem(args.itemId, args.sortOrder, pid);
    },
    onSuccess: () => {
      invalidateStorageState();
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to reorder item';
      toast.error(msg, { id: 'reorder-item' });
    },
  });

  const setRootDocMutation = useMutation({
    mutationFn: async (args: { nodeId: string; projectId?: string }) => {
      const pid = args.projectId || effectiveProjectId;
      return await manuscriptService.structure.setRootDoc(args.nodeId, pid);
    },
    onSuccess: () => {
      invalidateStorageState();
      queryClient.invalidateQueries({ queryKey: ['editor-root-doc'] });
      toast.success('Main document set successfully', { id: 'set-main-doc' });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to set main document';
      toast.error(msg, { id: 'set-main-doc' });
    },
  });

  return {
    uploadFile: uploadFileMutation,
    createFolder: createFolderMutation,
    renameFile: renameMutation,
    deleteFile: deleteMutation,
    moveItem: moveMutation,
    reorderItem: reorderMutation,
    setRootDoc: setRootDocMutation,
  };
}

export function useEditorStorageRootDoc(
  pageIdOrProjectId?: string | null,
  explicitProjectId?: string | null,
) {
  const effectiveProjectId = useResolvedProjectId(pageIdOrProjectId, explicitProjectId);

  const rootDocQuery = useQuery({
    queryKey: ['editor-root-doc', effectiveProjectId],
    queryFn: async () => {
      if (!effectiveProjectId) return null;
      return await manuscriptService.structure.getRootDoc(effectiveProjectId);
    },
    enabled: !!effectiveProjectId,
  });

  return {
    rootDoc: rootDocQuery.data,
    rootDocLoading: rootDocQuery.isLoading,
    refetchRootDoc: rootDocQuery.refetch,
  };
}

export function useEditorStorage(
  pageIdOrProjectId?: string | null,
  parentId?: string | null,
  explicitProjectId?: string | null,
  options?: UseEditorStorageFilesOptions,
) {
  const filesState = useEditorStorageFiles(pageIdOrProjectId, parentId, explicitProjectId, options);
  const mutations = useEditorStorageMutations(pageIdOrProjectId, explicitProjectId, parentId);

  return {
    items: filesState.items,
    isLoading: filesState.isLoading,
    refetch: filesState.refetch,
    ...mutations,
  };
}
