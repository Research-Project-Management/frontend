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

import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  pagesService,
  mapStructureNodesToStorageItems,
} from '@/features/editor/sdk/pages.service';
import type { EditorStorageItem } from '@/features/editor/domain/types/storage-item.types';
import { usePageStore, workspaceCoordinator, editorCommandBus } from '@/features/editor/core';
import {
  invalidateFileTreeQueries,
  storageKeys,
  waitForEditorBootstrap,
} from '@/features/editor/core/queries/document.queries';

function useResolvedProjectId(
  pageIdOrProjectId?: string | null,
  explicitProjectId?: string | null,
): string {
  const pageProjectId = usePageStore((s) => {
    const rawProjectId = s.currentPage?.projectId;
    if (typeof rawProjectId === 'string' && rawProjectId) return rawProjectId;
    if (typeof rawProjectId === 'object' && rawProjectId !== null && 'id' in rawProjectId) {
      return String((rawProjectId as { id?: unknown }).id ?? '');
    }
    return s.currentPage?.spaceId || '';
  });
  const storeProjectId = usePageStore((s) => s.spaceId || s.projectId);

  const resolvedProjectId = explicitProjectId || pageProjectId || storeProjectId || '';

  return (
    resolvedProjectId ||
    (pageIdOrProjectId && pageIdOrProjectId === storeProjectId ? pageIdOrProjectId : '')
  );
}

function useResolvedPageId(
  pageIdOrProjectId?: string | null,
  explicitProjectId?: string | null,
): string {
  const storeRootPageId = usePageStore((s) => s.rootPageId || s.parentPageId || s.currentPage?.id || '');
  const storeSpaceId = usePageStore((s) => s.spaceId);
  const resolvedProjectId = useResolvedProjectId(pageIdOrProjectId, explicitProjectId);
  return pageIdOrProjectId || storeRootPageId || resolvedProjectId || storeSpaceId || '';
}

export interface UseEditorStorageFilesOptions {
  enabled?: boolean;
}

const STORAGE_QUERY_STALE_TIME = 30_000;
const STORAGE_QUERY_GC_TIME = 5 * 60_000;
const EMPTY_STORAGE_ITEMS: EditorStorageItem[] = [];

function useEditorStorageFiles(
  pageIdOrProjectId?: string | null,
  parentId?: string | null,
  explicitProjectId?: string | null,
  options?: UseEditorStorageFilesOptions,
) {
  const effectiveProjectId = useResolvedProjectId(pageIdOrProjectId, explicitProjectId);
  const effectivePageId = useResolvedPageId(pageIdOrProjectId, explicitProjectId);

  const isEnabled = Boolean(
    (effectivePageId || effectiveProjectId || pageIdOrProjectId) && (options?.enabled ?? true),
  );

  const {
    data: itemsData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: storageKeys.files(effectivePageId || effectiveProjectId, pageIdOrProjectId),
    queryFn: async (): Promise<EditorStorageItem[]> => {
      const targetPageId = effectivePageId || pageIdOrProjectId || effectiveProjectId || '';
      if (!targetPageId) return [];
      const pendingBoot =
        waitForEditorBootstrap(targetPageId) ||
        waitForEditorBootstrap(effectiveProjectId) ||
        waitForEditorBootstrap(pageIdOrProjectId);
      if (pendingBoot) {
        const boot = await pendingBoot;
        if (boot?.tree) {
          const itemsFromBoot = mapStructureNodesToStorageItems(
            boot.tree,
            boot.workspace.spaceId,
          );
          workspaceCoordinator.syncStructureItems(
            itemsFromBoot,
            boot.workspace.pageId || boot.workspace.rootDocId || targetPageId,
          );
          return itemsFromBoot;
        }
      }
      try {
        const result = pageIdOrProjectId
          ? await pagesService.structure.getPageFiles(targetPageId)
          : await pagesService.structure.getProjectFiles(targetPageId);
        workspaceCoordinator.syncStructureItems(result || [], targetPageId);
        return result || [];
      } catch (err) {
        console.warn('[useEditorStorage] Could not fetch remote files:', err);
        return [];
      }
    },
    enabled: isEnabled,
    staleTime: STORAGE_QUERY_STALE_TIME,
    gcTime: STORAGE_QUERY_GC_TIME,
  });

  const items = useMemo(() => {
    const allItems = itemsData ?? EMPTY_STORAGE_ITEMS;
    const trimmedParentId = parentId?.trim();
    if (!trimmedParentId) {
      return allItems;
    }
    if (trimmedParentId === 'root' || trimmedParentId === 'null') {
      return allItems.filter(
        (item) =>
          !item.parentId ||
          item.parentId === effectivePageId ||
          item.parentId === effectiveProjectId ||
          item.parentId === pageIdOrProjectId,
      );
    }
    const isFolderInTree = allItems.some(
      (item) => item.id === trimmedParentId && item.isFolder,
    );
    if (isFolderInTree) {
      return allItems.filter((item) => item.parentId === trimmedParentId);
    }
    return allItems;
  }, [itemsData, parentId, effectivePageId, effectiveProjectId, pageIdOrProjectId]);

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
  const effectivePageId = useResolvedPageId(pageIdOrProjectId, explicitProjectId);

  const invalidateStorageState = (options?: { emitBusEvent?: boolean; includeRootDoc?: boolean }) => {
    const parentPageId =
      pageIdOrProjectId ||
      usePageStore.getState().parentPageId ||
      usePageStore.getState().currentPage?.id ||
      effectivePageId;
    invalidateFileTreeQueries(queryClient, {
      parentPageId,
      includeRootDoc: options?.includeRootDoc,
    });
    if (options?.emitBusEvent) {
      editorCommandBus.dispatch({ type: 'filetree:updated' });
    }
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
      skipInvalidation?: boolean;
      silent?: boolean;
    }): Promise<EditorStorageItem> => {
      const storeSpaceId = usePageStore.getState().spaceId;
      const pid = projectId || storeSpaceId || effectiveProjectId;
      const targetId = targetPageId || pageIdOrProjectId || effectivePageId || pid || '';
      return await pagesService.filestore.uploadPageFile(
        targetId,
        file,
        targetParentId ?? defaultParentId,
        undefined,
        pid || undefined,
      );
    },
    onSuccess: (newItem, variables) => {
      if (!variables?.skipInvalidation) {
        invalidateStorageState({ emitBusEvent: true });
      }
      if (!variables?.silent) {
        toast.success(`Uploaded "${newItem.filename}"`, { id: `upload-${newItem.filename}` });
      }
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
      const targetId = targetPageId || pageIdOrProjectId || effectivePageId || targetProjectId || effectiveProjectId || '';
      return await pagesService.structure.createFolder(targetId, name, targetParentId ?? defaultParentId);
    },
    onSuccess: () => {
      invalidateStorageState({ emitBusEvent: true });
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
      const ok = await workspaceCoordinator.renameItem({
        itemId: id,
        oldName: old,
        newName: name,
        projectId: effectivePageId || effectiveProjectId,
      });
      if (!ok) {
        throw new Error(`Failed to rename "${old || id}"`);
      }
      return { success: true };
    },
    onSuccess: () => {
      invalidateStorageState();
    },
    onError: () => {
      // Handled by workspaceCoordinator.notificationPort
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (itemId: string): Promise<unknown> => {
      const ok = await workspaceCoordinator.deleteFile(itemId, effectivePageId || effectiveProjectId);
      if (!ok) {
        throw new Error('Failed to delete file');
      }
      return { success: true };
    },
    onSuccess: () => {
      invalidateStorageState();
    },
    onError: () => {
      // Handled by workspaceCoordinator.notificationPort
    },
  });

  const moveMutation = useMutation({
    mutationFn: async (args: { itemId?: string; targetFolderId?: string | null } | string): Promise<unknown> => {
      const itemId = typeof args === 'string' ? args : (args.itemId || '');
      const targetFolderId = typeof args === 'string' ? null : (args.targetFolderId ?? null);
      const ok = await workspaceCoordinator.moveItem({
        itemId,
        targetFolderId,
        projectId: effectivePageId || effectiveProjectId,
      });
      if (!ok) {
        throw new Error('Failed to move item');
      }
      return { success: true };
    },
    onSuccess: () => {
      invalidateStorageState();
    },
    onError: () => {
      // Handled by workspaceCoordinator.notificationPort
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (args: { itemId: string; sortOrder: number; projectId?: string; pageId?: string }) => {
      const pid = args.pageId || pageIdOrProjectId || effectivePageId || args.projectId || effectiveProjectId || '';
      if (!pid) return null;
      return await pagesService.structure.reorderNode(pid, args.itemId, args.sortOrder);
    },
    onSuccess: () => {
      invalidateStorageState({ emitBusEvent: true });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to reorder item';
      toast.error(msg, { id: 'reorder-item' });
    },
  });

  const setRootDocMutation = useMutation({
    mutationFn: async (args: { nodeId: string; projectId?: string; pageId?: string }) => {
      const pid = args.pageId || pageIdOrProjectId || effectivePageId || args.projectId || effectiveProjectId || undefined;
      const ok = await workspaceCoordinator.setMainFile(args.nodeId, pid);
      if (!ok) {
        throw new Error('Failed to set main document');
      }
      return { success: true };
    },
    onSuccess: () => {
      invalidateStorageState({ includeRootDoc: true });
    },
    onError: () => {
      // Handled by workspaceCoordinator.notificationPort
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

function useEditorStorageRootDoc(
  pageIdOrProjectId?: string | null,
  explicitProjectId?: string | null,
) {
  const effectiveProjectId = useResolvedProjectId(pageIdOrProjectId, explicitProjectId);
  const effectivePageId = useResolvedPageId(pageIdOrProjectId, explicitProjectId);
  const targetId = effectivePageId || effectiveProjectId;

  const rootDocQuery = useQuery({
    queryKey: storageKeys.rootDoc(targetId),
    queryFn: async () => {
      if (!targetId) return null;
      return await pagesService.structure.getRootDoc(targetId);
    },
    enabled: !!targetId,
    staleTime: STORAGE_QUERY_STALE_TIME,
    gcTime: STORAGE_QUERY_GC_TIME,
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
