import { useState, useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { libraryServices } from '@/features/library/sdk/library.client';
import { useCollections, invalidateCollections } from '@/features/library/sdk/queries/collections.queries';
import { triggerBrowserTextDownload } from '@/features/library/core/coordinator/citation-export.coordinator';
import { canMoveCollection } from '@/features/library/domain/collection-tree';
import { useLibraryUIStore } from '@/features/library/core/store/library-ui.store';
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
  activeCollectionId?: string | null;
  onNavigate?: (path: string) => void;
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
  activeCollectionId: propActiveCollectionId,
  onNavigate,
}: UseCollectionCoordinatorParams) {
  const router = useRouter();
  const params = useParams() as { collectionId?: string } | null;
  const queryClient = useQueryClient();
  const storeCollectionId = useLibraryUIStore((s) => s.activeCollectionId);
  const setActiveCollectionId = useLibraryUIStore((s) => s.setActiveCollectionId);

  const resolvedActiveCollectionId =
    propActiveCollectionId ?? params?.collectionId ?? storeCollectionId;
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

  const openModal = useLibraryUIStore((s) => s.openModal);
  const activeScope = useLibraryUIStore((s) => s.activeScope);

  const openCreateModalForScope = useCallback(
    (targetScopeId: string, defaultParentId: string | null) => {
      setCreateScopeId(targetScopeId);
      setCreateParentId(defaultParentId);
      const scopedCollections =
        targetScopeId === 'user'
          ? (allCollectionsByScope?.user ?? collections)
          : targetScopeId && targetScopeId !== 'user'
            ? (allCollectionsByScope?.project ?? collections)
            : collections;
      const rootLabel =
        targetScopeId === 'user'
          ? 'My Library'
          : activeScope.type === 'project'
            ? (activeScope.name || 'Project')
            : 'My Library';
      const rootType: 'user' | 'project' =
        targetScopeId === 'user'
          ? 'user'
          : activeScope.type === 'project'
            ? 'project'
            : 'user';

      openModal('CREATE_COLLECTION', {
        parentId: defaultParentId,
        collections: scopedCollections,
        rootLabel,
        rootType,
        onSubmit: async (data: CollectionInput) => {
          const rawParent = data.parentId ?? defaultParentId ?? null;
          const cleanParentId = rawParent === 'root' || !rawParent ? null : rawParent;
          const resolvedScope =
            targetScopeId ||
            (cleanParentId ? findCollectionAndScope(cleanParentId).scopeId : effectiveScopeId);
          await new Promise<void>((resolve, reject) => {
            collectionService.createCollection(
              {
                name: data.name?.trim() || 'Untitled',
                description: data.description?.trim() || '',
                color: data.color || '#2563eb',
                icon: data.icon || '',
                parentId: cleanParentId,
                scopeId: resolvedScope,
              },
              {
                onSuccess: () => {
                  setCreateOpen(false);
                  setCreateParentId(null);
                  setCreateScopeId(null);
                  resolve();
                },
                onError: (err) => reject(err),
              },
            );
          });
        },
      });
    },
    [
      activeScope.name,
      activeScope.type,
      allCollectionsByScope,
      collectionService,
      collections,
      effectiveScopeId,
      findCollectionAndScope,
      openModal,
    ],
  );

  const openCreateSub = useCallback(
    (parentId: string) => {
      const { scopeId } = findCollectionAndScope(parentId);
      openCreateModalForScope(scopeId, parentId);
    },
    [findCollectionAndScope, openCreateModalForScope],
  );

  const openCreateRoot = useCallback(() => {
    openCreateModalForScope(effectiveScopeId, null);
  }, [effectiveScopeId, openCreateModalForScope]);

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

  const openDeleteCollectionModal = useCallback(
    (collectionId: string, withItems: boolean) => {
      const { collection: target, scopeId } = findCollectionAndScope(collectionId);
      const collectionTitle = target?.name || 'Untitled Collection';
      setTrashTarget({
        type: 'collection',
        id: collectionId,
        title: collectionTitle,
        withItems,
        scopeId,
      });

      openModal('DELETE_CONFIRM', {
        title: withItems ? 'Delete collection and items' : 'Delete collection',
        description: withItems
          ? `Are you sure you want to delete collection "${collectionTitle}" and move all of its items to the trash?`
          : `Are you sure you want to delete collection "${collectionTitle}"? Items inside this collection will not be deleted and will remain in your library.`,
        confirmLabel: 'Move to Trash',
        onConfirm: async () => {
          await collectionService.deleteCollection({
            collectionId,
            strategy: withItems ? 'cascade' : 'orphan',
            scopeId: scopeId || effectiveScopeId,
          });
          if (resolvedActiveCollectionId === collectionId) {
            setActiveCollectionId(null);
            if (onNavigate) {
              onNavigate('/library');
            } else {
              router.push('/library');
            }
          }
        },
      });
    },
    [
      collectionService,
      effectiveScopeId,
      findCollectionAndScope,
      onNavigate,
      openModal,
      resolvedActiveCollectionId,
      router,
      setActiveCollectionId,
    ],
  );

  const handleDelete = useCallback(
    (collectionId: string) => {
      openDeleteCollectionModal(collectionId, false);
    },
    [openDeleteCollectionModal],
  );

  const handleDeleteWithItems = useCallback(
    (collectionId: string) => {
      openDeleteCollectionModal(collectionId, true);
    },
    [openDeleteCollectionModal],
  );

  const handleConfirmTrash = useCallback(async () => {
    if (!trashTarget?.id) return;
    const targetId = trashTarget.id;
    await collectionService.deleteCollection({
      collectionId: targetId,
      strategy: trashTarget.withItems ? 'cascade' : 'orphan',
      scopeId: trashTarget.scopeId || effectiveScopeId,
    });
    if (resolvedActiveCollectionId === targetId) {
      setActiveCollectionId(null);
      if (onNavigate) {
        onNavigate('/library');
      } else {
        router.push('/library');
      }
    }
  }, [trashTarget, collectionService, effectiveScopeId, resolvedActiveCollectionId, setActiveCollectionId, onNavigate, router]);

  const handleMove = useCallback(
    (collectionId: string, newParentId: string | null) => {
      const allCols = allCollectionsByScope
        ? [...allCollectionsByScope.user, ...allCollectionsByScope.project]
        : collections;
      const targetList = allCols.length > 0 ? allCols : collections;
      if (!canMoveCollection(targetList, collectionId, newParentId)) {
        toast.error('Cannot move collection into itself or its descendants');
        return;
      }
      const { scopeId } = findCollectionAndScope(collectionId);
      collectionService.updateCollection({
        collectionId,
        parentId: newParentId,
        scopeId,
      });
    },
    [allCollectionsByScope, collectionService, collections, findCollectionAndScope],
  );

  const handleCopy = useCallback(
    async (collectionId: string, targetParentId: string | null) => {
      const { collection: target, scopeId } = findCollectionAndScope(collectionId);
      if (!target) return;

      const toastId = toast.loading(`Copying "${target.name}"...`, { id: 'collection-copy' });
      try {
        const allCols = allCollectionsByScope
          ? [...allCollectionsByScope.user, ...allCollectionsByScope.project]
          : collections;
        const sourceCols = allCols.length > 0 ? allCols : collections;

        const copySubtree = async (
          srcId: string,
          destParentId: string | null,
          isRoot: boolean,
        ): Promise<void> => {
          const { collection: src } = findCollectionAndScope(srcId);
          if (!src) return;
          const copyName = isRoot ? `${src.name} (Copy)` : src.name;
          const res = await libraryServices.collections.create(scopeId, {
            name: copyName,
            description: src.description,
            color: src.color,
            icon: src.icon,
            parentId: destParentId,
          });
          const newCol = (res as { collection?: Collection })?.collection;
          if (!newCol?.id) return;

          // Copy items in this collection
          try {
            const { items } = await libraryServices.items.getByCollection(scopeId, srcId);
            if (items && items.length > 0) {
              await libraryServices.collections.assignItems(
                scopeId,
                newCol.id,
                items.map((i) => i.id),
              );
            }
          } catch {
            // Best-effort item assignment when duplicating collection tree
          }

          // Recursively copy subcollections in parallel
          const childCollections = sourceCols.filter((c) => c.parentId === srcId);
          await Promise.all(
            childCollections.map((child) => copySubtree(child.id, newCol.id, false)),
          );
        };

        await copySubtree(collectionId, targetParentId, true);
        invalidateCollections(queryClient, scopeId);
        toast.success(`Successfully copied "${target.name}"`, { id: toastId });
      } catch (err: unknown) {
        toast.error('Failed to copy collection', {
          description: err instanceof Error ? err.message : String(err),
          id: toastId,
        });
      }
    },
    [allCollectionsByScope, collections, findCollectionAndScope, queryClient],
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

