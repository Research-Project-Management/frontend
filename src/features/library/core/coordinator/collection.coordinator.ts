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
  allCollectionsByScope?: {
    user: Collection[];
    project: Collection[];
    projectId?: string;
  };
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
  allCollectionsByScope,
}: UseCollectionCoordinatorParams) {
  // Modal states
  const [createOpen, setCreateOpen] = useState(false);
  const [createParentId, setCreateParentId] = useState<string | null>(null);
  const [createScopeId, setCreateScopeId] = useState<string | null>(null);
  const [trashTarget, setTrashTarget] = useState<MoveToTrashTarget | null>(null);
  const [isTrashOpen, setIsTrashOpen] = useState(false);

  // Inline rename states
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const findCollectionAndScope = useCallback(
    (collectionId: string): { collection?: Collection; scopeId: string } => {
      if (allCollectionsByScope) {
        const inUser = allCollectionsByScope.user.find((c) => c.id === collectionId);
        if (inUser) return { collection: inUser, scopeId: 'user' };
        const inProj = allCollectionsByScope.project.find((c) => c.id === collectionId);
        if (inProj) {
          return {
            collection: inProj,
            scopeId: inProj.projectId || allCollectionsByScope.projectId || effectiveScopeId,
          };
        }
      }
      const found = collections.find((c) => c.id === collectionId);
      return {
        collection: found,
        scopeId: found?.projectId || effectiveScopeId,
      };
    },
    [allCollectionsByScope, collections, effectiveScopeId],
  );

  const handleCreate = useCallback(
    (data: CollectionInput) => {
      const rawParent = data.parentId ?? createParentId ?? null;
      const cleanParentId = rawParent === 'root' || !rawParent ? null : rawParent;
      const targetScope =
        createScopeId ||
        (cleanParentId ? findCollectionAndScope(cleanParentId).scopeId : effectiveScopeId);
      collectionService.createCollection(
        {
          name: data.name?.trim() || 'Untitled',
          description: data.description?.trim() || '',
          color: data.color || '#2563eb',
          icon: data.icon || '',
          parentId: cleanParentId,
          scopeId: targetScope,
        },
        {
          onSuccess: () => {
            setCreateOpen(false);
            setCreateParentId(null);
            setCreateScopeId(null);
          },
        },
      );
    },
    [collectionService, createParentId, createScopeId, effectiveScopeId, findCollectionAndScope],
  );

  const openCreateSub = useCallback(
    (parentId: string) => {
      const { scopeId } = findCollectionAndScope(parentId);
      setCreateScopeId(scopeId);
      setCreateParentId(parentId);
      setCreateOpen(true);
    },
    [findCollectionAndScope],
  );

  const openCreateRoot = useCallback(() => {
    setCreateScopeId(effectiveScopeId);
    setCreateParentId(null);
    setCreateOpen(true);
  }, [effectiveScopeId]);

  const startRename = useCallback((collectionId: string, name: string) => {
    setRenamingId(collectionId);
    setRenameValue(name);
  }, []);

  const submitRename = useCallback(
    (collectionId: string) => {
      if (collectionId !== '__cancel__') {
        const trimmed = renameValue.trim();
        if (trimmed) {
          const { scopeId } = findCollectionAndScope(collectionId);
          collectionService.updateCollection({
            collectionId,
            name: trimmed,
            scopeId,
          });
        }
      }
      setRenamingId(null);
      setRenameValue('');
    },
    [collectionService, findCollectionAndScope, renameValue],
  );

  const handleDelete = useCallback(
    (collectionId: string) => {
      const { collection: target, scopeId } = findCollectionAndScope(collectionId);
      setTrashTarget({
        type: 'collection',
        id: collectionId,
        title: target?.name || 'Untitled Collection',
        withItems: false,
        scopeId,
      });
      setIsTrashOpen(true);
    },
    [findCollectionAndScope],
  );

  const handleDeleteWithItems = useCallback(
    (collectionId: string) => {
      const { collection: target, scopeId } = findCollectionAndScope(collectionId);
      setTrashTarget({
        type: 'collection',
        id: collectionId,
        title: target?.name || 'Untitled Collection',
        withItems: true,
        scopeId,
      });
      setIsTrashOpen(true);
    },
    [findCollectionAndScope],
  );

  const handleConfirmTrash = useCallback(async () => {
    if (!trashTarget?.id) return;
    await collectionService.deleteCollection({
      collectionId: trashTarget.id,
      strategy: trashTarget.withItems ? 'cascade' : 'orphan',
      scopeId: trashTarget.scopeId || effectiveScopeId,
    });
  }, [trashTarget, collectionService, effectiveScopeId]);

  const handleMove = useCallback(
    (collectionId: string, newParentId: string | null) => {
      const { scopeId } = findCollectionAndScope(collectionId);
      collectionService.updateCollection({
        collectionId,
        parentId: newParentId,
        scopeId,
      });
    },
    [collectionService, findCollectionAndScope],
  );

  const handleCopy = useCallback(
    (collectionId: string, targetParentId: string | null) => {
      const { collection: target, scopeId } = findCollectionAndScope(collectionId);
      if (!target) return;
      collectionService.createCollection({
        name: `${target.name} (Copy)`,
        description: target.description,
        color: target.color,
        icon: target.icon,
        parentId: targetParentId,
        scopeId,
      });
    },
    [collectionService, findCollectionAndScope],
  );

  const handleExportBibtex = useCallback(
    async (collectionId: string, name: string) => {
      const { scopeId } = findCollectionAndScope(collectionId);
      const toastId = toast.loading(`Exporting BibTeX for "${name}"...`, {
        id: 'collection-export',
      });
      try {
        const res = await libraryServices.collections.exportBibtex(
          scopeId,
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
    [findCollectionAndScope],
  );

  const handleExportBundle = useCallback(
    async (collectionId: string, name: string) => {
      const { scopeId } = findCollectionAndScope(collectionId);
      const toastId = toast.loading(`Preparing bundle for "${name}"...`, {
        id: 'bundle-export',
      });
      try {
        const data = await libraryServices.collections.exportBundle(
          scopeId,
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
          `Exported bundle with ${data?.totalItems ?? data?.filesIncluded ?? 0} items and ${data?.totalFiles ?? 0} files`,
          { id: toastId },
        );
      } catch (err: unknown) {
        toast.error('Failed to export bundle', {
          description: err instanceof Error ? err.message : String(err),
          id: toastId,
        });
      }
    },
    [findCollectionAndScope],
  );

  const modals = useMemo(
    () => ({
      createOpen,
      setCreateOpen,
      createParentId,
      setCreateParentId,
      createScopeId,
      setCreateScopeId,
      trashTarget,
      isTrashOpen,
      setIsTrashOpen,
    }),
    [createOpen, createParentId, createScopeId, trashTarget, isTrashOpen],
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

