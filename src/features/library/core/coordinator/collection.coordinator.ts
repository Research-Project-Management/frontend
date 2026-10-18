import { useState, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { libraryServices } from '@/features/library/sdk/library.client';
import { useCollections } from '@/features/library/sdk/queries/collections.queries';
import { triggerBrowserTextDownload } from '@/features/library/core/coordinator/citation-export.coordinator';
import type {
  Collection,
  CollectionInput,
  MoveToTrashTarget,
} from '@/features/library/domain/types/library.types';

export interface UseCollectionCoordinatorParams {
  collectionService: ReturnType<typeof useCollections>;
  effectiveScopeId: string;
  collections: Collection[];
}

/**
 * Headless Coordinator for Collection Management & Lifecycle Workflows.
 *
 * Centralizes:
 * 1. Collection creation (root and subcollections).
 * 2. Inline renaming and validation.
 * 3. Soft-deletion & trash confirmation modal routing.
 * 4. Move and copy tree operations.
 * 5. Full collection exports (BibTeX and JSON bundle download).
 */
export function useCollectionCoordinator({
  collectionService,
  effectiveScopeId,
  collections,
}: UseCollectionCoordinatorParams) {
  // Modal states
  const [createOpen, setCreateOpen] = useState(false);
  const [createParentId, setCreateParentId] = useState<string | null>(null);
  const [trashTarget, setTrashTarget] = useState<MoveToTrashTarget | null>(null);
  const [isTrashOpen, setIsTrashOpen] = useState(false);

  // Inline rename states
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const handleCreate = useCallback(
    (data: CollectionInput) => {
      const rawParent = data.parentId ?? data.parent ?? createParentId ?? null;
      const cleanParentId = rawParent === 'root' || !rawParent ? null : rawParent;
      collectionService.actions.create(
        {
          name: data.name?.trim() || 'Untitled',
          description: data.description?.trim() || '',
          color: data.color || '#2563eb',
          icon: data.icon || '',
          parentId: cleanParentId,
          parent: cleanParentId,
        },
        {
          onSuccess: () => {
            setCreateOpen(false);
            setCreateParentId(null);
          },
        },
      );
    },
    [collectionService.actions, createParentId],
  );

  const openCreateSub = useCallback((parentId: string, _parentName?: string) => {
    setCreateParentId(parentId);
    setCreateOpen(true);
  }, []);

  const openCreateRoot = useCallback(() => {
    setCreateParentId(null);
    setCreateOpen(true);
  }, []);

  const startRename = useCallback((collectionId: string, name: string) => {
    setRenamingId(collectionId);
    setRenameValue(name);
  }, []);

  const submitRename = useCallback(
    (collectionId: string) => {
      if (collectionId !== '__cancel__') {
        const trimmed = renameValue.trim();
        if (trimmed) collectionService.actions.update({ collectionId, name: trimmed });
      }
      setRenamingId(null);
      setRenameValue('');
    },
    [collectionService.actions, renameValue],
  );

  const handleDelete = useCallback(
    (collectionId: string) => {
      const target = collections.find((c) => c.id === collectionId);
      setTrashTarget({
        type: 'collection',
        id: collectionId,
        title: target?.name || 'Untitled Collection',
      });
      setIsTrashOpen(true);
    },
    [collections],
  );

  const handleDeleteWithItems = handleDelete;

  const handleConfirmTrash = useCallback(() => {
    if (!trashTarget?.id) return;
    collectionService.actions.delete(trashTarget.id);
  }, [trashTarget?.id, collectionService.actions]);

  const handleMove = useCallback(
    (collectionId: string, newParentId: string | null) => {
      collectionService.actions.update({ collectionId, parent: newParentId });
    },
    [collectionService.actions],
  );

  const handleCopy = useCallback(
    (collectionId: string, targetParentId: string | null) => {
      const target = collections.find((c) => c.id === collectionId);
      if (!target) return;
      collectionService.actions.create({
        name: `${target.name} (Copy)`,
        description: target.description,
        color: target.color,
        icon: target.icon,
        parent: targetParentId,
      });
    },
    [collections, collectionService.actions],
  );

  const handleExportBibtex = useCallback(
    async (collectionId: string, name: string) => {
      const toastId = toast.loading(`Exporting BibTeX for "${name}"...`, {
        id: 'collection-export',
      });
      try {
        const res = await libraryServices.collections.exportBibtex(
          effectiveScopeId,
          collectionId,
        );
        const bibtex = res?.bibtex;
        if (!bibtex) {
          toast.warning('No citations found in this collection.', { id: toastId });
          return;
        }
        const filename =
          res?.filename || `${name.toLowerCase().replace(/\s+/g, '_')}.bib`;
        triggerBrowserTextDownload(
          bibtex,
          filename,
          'application/x-bibtex;charset=utf-8;',
        );
        const count = res?.total;
        toast.success(
          count ? `Exported ${count} items to ${filename}` : `Exported to ${filename}`,
          { id: toastId },
        );
      } catch (err: unknown) {
        toast.error('Failed to export BibTeX', {
          description: err instanceof Error ? err.message : String(err),
          id: toastId,
        });
      }
    },
    [effectiveScopeId],
  );

  const handleExportBundle = useCallback(
    async (collectionId: string, name: string) => {
      const toastId = toast.loading(`Preparing bundle for "${name}"...`, {
        id: 'bundle-export',
      });
      try {
        const data = await libraryServices.collections.exportBundle(
          effectiveScopeId,
          collectionId,
        );
        if (!data) {
          toast.error('Failed to export bundle', { id: toastId });
          return;
        }
        const filename = `${name.toLowerCase().replace(/\s+/g, '_')}_bundle.json`;
        triggerBrowserTextDownload(
          JSON.stringify(data, null, 2),
          filename,
          'application/json;charset=utf-8;',
        );
        toast.success(
          `Exported bundle with ${data?.totalPapers ?? 0} items and ${data?.totalFiles ?? 0} files`,
          { id: toastId },
        );
      } catch (err: unknown) {
        toast.error('Failed to export bundle', {
          description: err instanceof Error ? err.message : String(err),
          id: toastId,
        });
      }
    },
    [effectiveScopeId],
  );

  const modals = useMemo(
    () => ({
      createOpen,
      setCreateOpen,
      createParentId,
      setCreateParentId,
      trashTarget,
      isTrashOpen,
      setIsTrashOpen,
    }),
    [createOpen, createParentId, trashTarget, isTrashOpen],
  );

  const rename = useMemo(
    () => ({
      renamingId,
      renameValue,
      setRenameValue,
    }),
    [renamingId, renameValue],
  );

  const handlers = useMemo(
    () => ({
      handleCreate,
      openCreateSub,
      openCreateRoot,
      startRename,
      submitRename,
      handleDelete,
      handleDeleteWithItems,
      handleConfirmTrash,
      handleMove,
      handleCopy,
      handleExportBibtex,
      handleExportBundle,
    }),
    [
      handleCreate,
      openCreateSub,
      openCreateRoot,
      startRename,
      submitRename,
      handleDelete,
      handleDeleteWithItems,
      handleConfirmTrash,
      handleMove,
      handleCopy,
      handleExportBibtex,
      handleExportBundle,
    ],
  );

  return useMemo(
    () => ({
      modals,
      rename,
      handlers,
    }),
    [modals, rename, handlers],
  );
}

