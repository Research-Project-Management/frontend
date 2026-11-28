'use client';

/**
 * use-storage.ts
 *
 * Real-time storage hooks for Editor Files Explorer wired to:
 * - Manuscript Structure Service (`/api/v1/manuscripts/projects/:projectId/structure`)
 * - Manuscript Filestore Service (`/api/v1/manuscripts/projects/:projectId/files`)
 *
 * Architectural Optimization:
 * - Decoupled query and mutation lifecycles (useEditorStorageFiles, useEditorStorageMutations)
 * - Conditional query execution (enabled flag on folder expansion)
 * - Zero redundant root queries from child file/folder rows
 */

import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { logger } from '@/shared/lib/logger';
import {
  pagesService,
  mapStructureNodesToStorageItems,
} from '@/features/editor/sdk/pages.service';
import type { EditorStorageItem } from '@/features/editor/domain/types/storage-item.types';
import {
  usePageStore,
  workspaceCoordinator,
  editorCommandBus,
  resolveEditorScope,
  resolveEditorScopeFromState,
} from '@/features/editor/core';
import {
  invalidateFileTreeQueries,
  storageKeys,
  waitForEditorBootstrap,
} from '@/features/editor/core/queries/document.queries';

function useResolvedStorageScope(
  pageIdOrProjectId?: string | null,
  explicitProjectId?: string | null,
): { effectiveProjectId: string; effectivePageId: string } {
  const effectiveProjectId = usePageStore((s) => {
    const scope = resolveEditorScopeFromState(s, {
      pageId: pageIdOrProjectId,
      projectId: explicitProjectId,
    });
    const resolved = explicitProjectId || scope.spaceId;
    if (resolved) return resolved;
    const storeProjectId = s.spaceId || s.projectId;
    return pageIdOrProjectId && pageIdOrProjectId === storeProjectId ? pageIdOrProjectId : '';
  });

  const effectivePageId = usePageStore((s) => {
    const scope = resolveEditorScopeFromState(s, {
      pageId: pageIdOrProjectId,
      projectId: explicitProjectId,
    });
    return pageIdOrProjectId || scope.rootPageId || scope.spaceId || '';
  });

  return { effectiveProjectId, effectivePageId };
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
  const { effectiveProjectId, effectivePageId } = useResolvedStorageScope(
    pageIdOrProjectId,
    explicitProjectId,
  );

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
        logger.warn('[useEditorStorage] Could not fetch remote files', { error: err });
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

function useEditorStorageMutations(
  pageIdOrProjectId?: string | null,
  explicitProjectId?: string | null,
  defaultParentId?: string | null,
) {
  const queryClient = useQueryClient();
  const { effectiveProjectId, effectivePageId } = useResolvedStorageScope(
    pageIdOrProjectId,
    explicitProjectId,
  );

  const invalidateStorageState = (options?: { emitBusEvent?: boolean; includeRootDoc?: boolean }) => {
    const scope = resolveEditorScope({
      pageId: pageIdOrProjectId,
      projectId: explicitProjectId,
    });
    const parentPageId = pageIdOrProjectId || scope.rootPageId || effectivePageId;
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
      const scope = resolveEditorScope({
        projectId: projectId || explicitProjectId,
        pageId: targetPageId || pageIdOrProjectId,
      });
      const pid = projectId || scope.spaceId || effectiveProjectId;
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

  return {
    uploadFile: uploadFileMutation,
    createFolder: createFolderMutation,
    moveItem: moveMutation,
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
