'use client';

import { useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { copyToClipboard } from '@/shared/lib/utils';
import { openInNewTab, buildReaderPaperUrl } from '@/features/library/core/coordinator/citation-export.coordinator';
import { isProjectScope } from '@/features/library/domain/identifiers.domain';
import {
  isPersistedItemId,
  isPersistedLibraryItem,
} from '@/features/library/domain/library-permissions.policy';
import {
  useLibraryCommandStore,
  createTrashCommand,
  createRestoreCommand,
  createMoveItemsCommand,
  createToggleStarCommand,
} from '@/features/library/core/manager/library-command.manager';
import { resolveCachedItemFromScope } from '@/features/library/sdk/queries/cache-patcher.queries';
import {
  useCitationStyles,
  useBatchRenameAttachmentsMutation,
} from '@/features/library/sdk/queries/extraction.queries';
import { useAssignCollectionItemsMutation } from '@/features/library/sdk/queries/collections.queries';
import {
  fetchLibraryItemById,
  useReResolveItemMetadataMutation,
  useSetMyPublicationMutation,
} from '@/features/library/sdk/queries/catalog.queries';

export { useBatchRenameAttachmentsMutation };

export {
  useSetMyPublicationMutation,
  useCreateLibraryItemMutation,
  useToggleStarItemMutation,
  useUpdateLibraryItemMutation,
  useDeleteLibraryItemsMutation,
  useBatchRestoreItemsMutation,
  useBatchPurgeItemsMutation,
  useLibraryItemsQuery,
  usePrefetchNextLibraryItemsPage,
  normalizeScopeId,
  useItemTypes,
  useViewItems,
  useLibraryCountsQuery,
  useImportFromUserMutation,
  useLibraryCacheSynchronizer,
  useLibraryBootstrapQuery,
} from '@/features/library/sdk/queries/catalog.queries';
import { useLibraryUIStore } from '@/features/library/core/store/library-ui.store';
import { useRetraction } from '@/features/library/sdk/queries/ingestion.queries';
import {
  executeCopyMultiCite,
  executeCopyInTextCite,
  executeExportAllBibtex,
} from '@/features/library/core/coordinator/citation-export.coordinator';
import {
  DEFAULT_CITATION_STYLES,
  getCleanStyleLabel,
} from '@/features/library/domain/citations.domain';
import { getAssignedCollectionIds } from '@/features/library/domain/metadata.mapper';
import type { Item, Collection, CslStyle } from '@/features/library/types/core.types';

interface UseItemActionHandlersOptions {
  scopeId?: string;
  isMenuOpen?: boolean;
  onOpenItem?: (id: string) => void;
  onOpenInNewTab?: (id: string) => void;
  onAddToCollection?: (collectionId: string) => void;
  onMoveToCollection?: (collectionId: string) => void;
  onAfterAction?: () => void;
}

interface CitationStyleOption {
  id: string;
  label: string;
}

/**
 * Shared Action & Citation Orchestration Hook for Library Item Row Actions & Context Menus.
 *
 * Eliminates duplicated mutation wiring and citation style resolution across
 * `ItemRowActions` and `ItemContextMenu`.
 */
export function useItemActionHandlers(
  item: Item,
  options: UseItemActionHandlersOptions = {},
) {
  const {
    scopeId,
    isMenuOpen = false,
    onOpenItem,
    onOpenInNewTab,
    onAddToCollection,
    onMoveToCollection,
    onAfterAction,
  } = options;

  const router = useRouter();
  const effectiveScope = scopeId || item.projectId || 'user';

  const assignCollectionItemsMutation = useAssignCollectionItemsMutation(effectiveScope);
  const reResolveMutation = useReResolveItemMetadataMutation(effectiveScope);
  const setMyPublicationMutation = useSetMyPublicationMutation(effectiveScope);
  const { flagItem, unflagItem } = useRetraction(effectiveScope, { includeItems: false });
  const { data: serverStyles = [] } = useCitationStyles(effectiveScope, { enabled: isMenuOpen });

  const availableStyles = useMemo<CitationStyleOption[]>(() => {
    const filteredServerStyles = serverStyles.filter(
      (s) => s.id !== 'bibtex' && s.id !== 'ris' && s.id !== 'auto' && s.id !== 'auto-numeric',
    );
    if (filteredServerStyles.length > 0) {
      return filteredServerStyles.map((s) => ({
        id: s.id,
        label: s.shortTitle || s.name || getCleanStyleLabel(s.id),
      }));
    }
    return DEFAULT_CITATION_STYLES.map((s) => ({
      id: s.id,
      label: getCleanStyleLabel(s.id, s.label),
    }));
  }, [serverStyles]);

  const isStarred =
    Boolean(item.isStarred) ||
    Boolean(typeof item.rating === 'number' && item.rating > 0);

  const handleOpen = useCallback(() => {
    onAfterAction?.();
    if (onOpenItem) {
      onOpenItem(item.id);
    } else {
      const projectId = item.projectId ? String(item.projectId) : (isProjectScope(effectiveScope) ? effectiveScope : undefined);
      router.push(buildReaderPaperUrl(item.id, { projectId }));
    }
  }, [item.id, item.projectId, effectiveScope, onAfterAction, onOpenItem, router]);

  const handleOpenInNewTab = useCallback(() => {
    onAfterAction?.();
    if (onOpenInNewTab) {
      onOpenInNewTab(item.id);
    } else {
      const projectId = item.projectId ? String(item.projectId) : (isProjectScope(effectiveScope) ? effectiveScope : undefined);
      openInNewTab(buildReaderPaperUrl(item.id, { projectId }));
    }
  }, [item.id, item.projectId, effectiveScope, onAfterAction, onOpenInNewTab]);

  const handleCopyBibliography = useCallback(
    async (style: CslStyle = 'apa-7th') => {
      onAfterAction?.();
      if (style === 'bibtex') {
        await executeExportAllBibtex([item], effectiveScope, 1);
        return;
      }
      await executeCopyMultiCite([item], effectiveScope, style);
    },
    [effectiveScope, item, onAfterAction],
  );

  const handleCopyInTextCitation = useCallback(
    async (style: CslStyle = 'apa-7th') => {
      onAfterAction?.();
      await executeCopyInTextCite([item], effectiveScope, style);
    },
    [effectiveScope, item, onAfterAction],
  );

  const handleCopyCitationKey = useCallback(
    (prefixLabel = 'Copied citation key') => {
      onAfterAction?.();
      const effectiveCiteKey = item.citationKey?.trim();
      if (effectiveCiteKey) {
        void copyToClipboard(effectiveCiteKey);
        toast.success(`${prefixLabel}: ${effectiveCiteKey}`, {
          id: 'library-clipboard',
        });
      } else {
        toast.info('Item does not have a citation key', {
          id: 'library-clipboard',
        });
      }
    },
    [item.citationKey, onAfterAction],
  );

  const handleRefreshMetadata = useCallback(() => {
    onAfterAction?.();
    void reResolveMutation.mutateAsync({
      itemId: item.id,
      attachOaPdf: true,
    });
  }, [item.id, onAfterAction, reResolveMutation]);

  const openModal = useLibraryUIStore((s) => s.openModal);

  const handleToggleMyPublications = useCallback(() => {
    onAfterAction?.();
    if (item.isMyPublication) {
      void setMyPublicationMutation.mutateAsync({
        itemId: item.id,
        isMyPublication: false,
      });
    } else {
      openModal('MY_PUBLICATION_CONFIRM', { item });
    }
  }, [item, onAfterAction, openModal, setMyPublicationMutation]);

  const handleToggleRetraction = useCallback(() => {
    onAfterAction?.();
    if (item.isRetracted) {
      void unflagItem(item.id);
    } else {
      void flagItem({
        itemId: item.id,
        data: {
          nature: 'retraction',
          reason: 'Manually flagged as retracted by user',
        },
      });
    }
  }, [flagItem, item.id, item.isRetracted, onAfterAction, unflagItem]);

  const handleSelectCollection = useCallback(
    async (col: Collection) => {
      onAfterAction?.();
      if (onAddToCollection) {
        onAddToCollection(col.id);
        return;
      }
      if (onMoveToCollection) {
        onMoveToCollection(col.id);
        return;
      }
      try {
        await assignCollectionItemsMutation.mutateAsync({
          collectionId: col.id,
          itemIds: [item.id],
        });
        toast.success(`Added to "${col.name}"`);
      } catch (err) {
        toast.error('Failed to add to collection', {
          description: err instanceof Error ? err.message : String(err),
        });
      }
    },
    [
      assignCollectionItemsMutation,
      item.id,
      onAddToCollection,
      onAfterAction,
      onMoveToCollection,
    ],
  );

  return {
    availableStyles,
    isStarred,
    handleOpen,
    handleOpenInNewTab,
    handleCopyBibliography,
    handleCopyInTextCitation,
    handleCopyCitationKey,
    handleRefreshMetadata,
    handleToggleMyPublications,
    handleToggleRetraction,
    handleSelectCollection,
  };
}

/**
 * Hook to handle dragging and dropping items directly into the "My Publications" system collection.
 * Conforms to SC-009 by abstracting queryClient/ItemsService lookup into a coordinator hook.
 */
export function useDropToMyPublications(effectiveScopeId: string = 'user') {
  const queryClient = useQueryClient();
  const openModal = useLibraryUIStore((s) => s.openModal);

  return useCallback(
    async (ids: string[]) => {
      if (!ids || ids.length === 0) return;
      const targetId = ids[0];
      try {
        let item: Item | undefined = resolveCachedItemFromScope(
          queryClient,
          effectiveScopeId,
          targetId,
        ) as Item | undefined;
        if (!item) {
          item = ((await fetchLibraryItemById(effectiveScopeId, targetId)) ?? undefined) as Item | undefined;
        }
        if (item) {
          openModal('MY_PUBLICATION_CONFIRM', { item, itemIds: ids });
        }
      } catch {
        toast.error('Failed to prepare item for My Publications', { id: 'drop-to-my-pub-error' });
      }
    },
    [queryClient, effectiveScopeId, openModal],
  );
}

interface UseLibraryItemOperationsOptions {
  itemsById: Map<string, Item>;
  isTrash?: boolean;
  collectionId?: string;
  propOnMoveToCollection?: (itemId: string, collectionId: string) => void;
  onRestoreItems?: (ids: string[]) => void;
  onPermanentDeleteItems?: (ids: string[]) => void;
  toggleStarMutation: {
    mutate: (args: { id: string; isStarred: boolean }) => void;
    mutateAsync?: (args: { id: string; isStarred: boolean }) => Promise<unknown>;
  };
  deleteMutation: {
    mutate: (ids: string[], options?: { onSuccess?: () => void }) => void;
    mutateAsync?: (ids: string[]) => Promise<unknown>;
  };
  restoreMutation: {
    mutate: (ids: string[], options?: { onSuccess?: () => void }) => void;
    mutateAsync?: (ids: string[]) => Promise<unknown>;
  };
  purgeMutation: {
    mutate: (ids: string[], options?: { onSuccess?: () => void }) => void;
  };
  moveMutation: {
    mutateAsync: (args: {
      targetCollectionId: string | null;
      itemIds: string[];
      sourceCollectionId?: string | null;
      scopeId?: string;
    }) => Promise<unknown>;
  };
  detachMutation?: {
    mutateAsync: (args: { collectionId: string; itemIds: string[] }) => Promise<unknown>;
  };
  assignMutation?: {
    mutateAsync: (args: { collectionId: string; itemIds: string[] }) => Promise<unknown>;
  };
}

/**
 * useLibraryItemOperations
 * Centralizes granular document CRUD operations (Star, Delete, Restore, Permanent Purge, Move)
 * with robust processing item guards, user-facing notifications, and stable references.
 */
export function useLibraryItemOperations(options: UseLibraryItemOperationsOptions) {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const openModal = useLibraryUIStore((s) => s.openModal);

  const handleToggleStar = useCallback(
    (item: Item, isStarred: boolean) => {
      if (!isPersistedLibraryItem(item)) return;
      const toggleStarMutation = optionsRef.current.toggleStarMutation;
      if (toggleStarMutation.mutateAsync) {
        void useLibraryCommandStore.getState().executeCommand(
          createToggleStarCommand({
            itemId: item.id,
            itemTitle: item.title,
            newStarred: !isStarred,
            toggleStarMutation: { mutateAsync: toggleStarMutation.mutateAsync },
          }),
          { silentToast: true },
        );
        return;
      }
      toggleStarMutation.mutate({
        id: item.id,
        isStarred: !isStarred,
      });
    },
    [],
  );

  const handleDelete = useCallback(
    (id: string) => {
      const opts = optionsRef.current;
      const targetItem = opts.itemsById.get(id);
      const isProcessing =
        !isPersistedItemId(id) ||
        (targetItem ? !isPersistedLibraryItem(targetItem) : false);
      if (isProcessing) {
        toast.warning(
          'Cannot delete an item that is currently uploading or processing',
          { id: 'library-item-guard' },
        );
        return;
      }

      const clearSelectionIfAffected = () => {
        useLibraryUIStore.getState().evictItems([id]);
      };

      if (opts.isTrash) {
        openModal('DELETE_CONFIRM', { itemIds: [id], permanent: true });
      } else if (opts.deleteMutation.mutateAsync && opts.restoreMutation.mutateAsync) {
        void useLibraryCommandStore.getState().executeCommand(
          createTrashCommand({
            itemIds: [id],
            itemTitle: targetItem?.title,
            deleteMutation: { mutateAsync: opts.deleteMutation.mutateAsync },
            restoreMutation: { mutateAsync: opts.restoreMutation.mutateAsync },
            onExecuted: () => {
              clearSelectionIfAffected();
            },
          }),
          { silentToast: true },
        );
      } else {
        opts.deleteMutation.mutate([id], {
          onSuccess: () => {
            clearSelectionIfAffected();
          },
        });
      }
    },
    [openModal],
  );

  const handleRestore = useCallback(
    (id: string) => {
      const opts = optionsRef.current;
      const targetItem = opts.itemsById.get(id);
      if (opts.restoreMutation.mutateAsync && opts.deleteMutation.mutateAsync) {
        void useLibraryCommandStore.getState().executeCommand(
          createRestoreCommand({
            itemIds: [id],
            itemTitle: targetItem?.title,
            restoreMutation: { mutateAsync: opts.restoreMutation.mutateAsync },
            deleteMutation: { mutateAsync: opts.deleteMutation.mutateAsync },
            onExecuted: () => opts.onRestoreItems?.([id]),
          }),
          { silentToast: true },
        );
      } else if (opts.onRestoreItems) {
        opts.onRestoreItems([id]);
      } else {
        opts.restoreMutation.mutate([id]);
      }
    },
    [],
  );

  const handlePurge = useCallback(
    (id: string) => {
      const opts = optionsRef.current;
      const targetItem = opts.itemsById.get(id);
      const isProcessing =
        !isPersistedItemId(id) ||
        (targetItem ? !isPersistedLibraryItem(targetItem) : false);
      if (isProcessing) {
        toast.warning(
          'Cannot delete an item that is currently uploading or processing',
          { id: 'library-item-guard' },
        );
        return;
      }
      if (opts.onPermanentDeleteItems) {
        opts.onPermanentDeleteItems([id]);
      } else {
        opts.purgeMutation.mutate([id], {
          onSuccess: () => {
            useLibraryUIStore.getState().evictItems([id]);
            useLibraryCommandStore.getState().clearHistory();
          },
        });
      }
    },
    [],
  );

  const handleMoveToCollection = useCallback(
    async (itemId: string, targetCollectionId: string) => {
      const opts = optionsRef.current;
      if (opts.propOnMoveToCollection) {
        opts.propOnMoveToCollection(itemId, targetCollectionId);
        return;
      }
      const targetItem = opts.itemsById.get(itemId);
      const previousCollectionsByItem = new Map<string, string[]>();
      if (targetItem) {
        const assigned = getAssignedCollectionIds(targetItem);
        if (assigned.length > 0) {
          previousCollectionsByItem.set(itemId, assigned);
        }
      }
      void useLibraryCommandStore.getState().executeCommand(
        createMoveItemsCommand({
          itemIds: [itemId],
          sourceCollectionId: opts.collectionId || null,
          targetCollectionId,
          previousCollectionsByItem,
          moveMutation: opts.moveMutation,
          detachMutation: opts.detachMutation,
          assignMutation: opts.assignMutation,
        }),
      );
    },
    [],
  );

  return {
    handleToggleStar,
    handleDelete,
    handleRestore,
    handlePurge,
    handleMoveToCollection,
  };
}

