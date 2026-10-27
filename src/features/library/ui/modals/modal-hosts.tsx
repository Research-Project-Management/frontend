'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import {
  useLibraryUIStore,
  type LibraryModalType,
} from '@/features/library/core/store/library-ui.store';
import {
  useCreateCollectionMutation,
  useCollections,
} from '@/features/library/sdk/queries/collections.queries';
import {
  useDeleteLibraryItemsMutation,
  useBatchRestoreItemsMutation,
  useBatchPurgeItemsMutation,
  useUpdateLibraryItemMutation,
} from '@/features/library/sdk/queries/catalog.queries';
import {
  useLibraryCommandStore,
  createTrashCommand,
  createRestoreCommand,
  buildPreConversionSnapshot,
  PRE_CONVERSION_BIBLIOGRAPHIC_SCALAR_KEYS,
} from '@/features/library/core/manager/library-command.manager';

export {
  buildPreConversionSnapshot,
  PRE_CONVERSION_BIBLIOGRAPHIC_SCALAR_KEYS,
};
import { useSavedSearches } from '@/features/library/sdk/queries/saved-searches-relations.queries';
import type {
  Collection,
  CollectionFormValues,
  Item,
  CreateSavedSearchInput,
} from '@/features/library/domain/types/library.types';
import type { SavedSearch } from '@/features/library/domain/types/saved-searches.types';
import type { SavedFeedSubscription } from '@/features/library/domain/types/feeds.types';

const CreateCollectionModal = dynamic(() => import('./CreateCollectionModal'), { ssr: false });
const CreateSavedSearchModal = dynamic(() => import('./CreateSavedSearchModal'), { ssr: false });
const DeleteModal = dynamic(() => import('./DeleteModal'), { ssr: false });
const ExternalLibrarySyncModal = dynamic(() => import('./ExternalLibrarySyncModal'), { ssr: false });
const FeedsManagerModal = dynamic(() => import('./FeedsManagerModal'), { ssr: false });

export interface LibraryModalPayload {
  item?: Item;
  itemId?: string;
  currentType?: string;
  itemTitle?: string;
  items?: Item[];
  duplicates?: Item[];
  recommendedMasterId?: string;
  targetType?: string;
  collectionId?: string;
  parentId?: string | null;
  parentCollectionId?: string | null;
  collections?: Collection[];
  rootLabel?: string;
  rootType?: 'user' | 'project';
  onSubmit?: (data: CollectionFormValues) => void | Promise<void>;
  title?: string;
  description?: string;
  confirmLabel?: string;
  itemIds?: string[];
  permanent?: boolean;
  files?: File[];
  initialFiles?: File[];
  savedSearch?: SavedSearch | null;
  provider?: 'zotero' | 'mendeley';
  onConfirm?: () => Promise<void>;
  onDismissDuplicate?: (itemIds: string[]) => void | Promise<void>;
  assignToItemId?: string;
  currentCollectionIds?: string[];
  existingTitles?: string[];
  currentStyleId?: string;
  onSelectStyle?: (style: { id: string; label: string }) => void;
  feed?: SavedFeedSubscription | null;
  [key: string]: unknown;
}

export interface ModalHostProps {
  activeModal: LibraryModalType;
  payload: LibraryModalPayload;
  effectiveScope: string;
  closeModal: () => void;
}

/**
 * 1. CollectionModalsHost
 * Only mounts collection create/rename/delete/sync/feeds queries & mutations when opened.
 */
export function CollectionModalsHost({
  activeModal,
  payload,
  effectiveScope,
  closeModal,
}: ModalHostProps) {
  const activeScope = useLibraryUIStore((s) => s.activeScope);
  const isCreateCollectionOpen =
    activeModal === 'CREATE_COLLECTION' || activeModal === 'RENAME_COLLECTION';
  const isDeleteCollectionOpen = activeModal === 'DELETE_COLLECTION';
  const isExternalSyncOpen = activeModal === 'EXPORT_LIBRARY';
  const isFeedsManagerOpen = activeModal === 'FEEDS_MANAGER';

  const collectionService = useCollections({
    scopeId: effectiveScope,
    enabled: isCreateCollectionOpen || isExternalSyncOpen || isFeedsManagerOpen,
  });
  const collections = collectionService.collections;

  const createCollectionMutation = useCreateCollectionMutation(effectiveScope);
  const updateItemMutation = useUpdateLibraryItemMutation(effectiveScope);
  const [isCustomSubmitting, setIsCustomSubmitting] = React.useState(false);

  const handleCreateOrRenameCollection = async (data: CollectionFormValues) => {
    if (typeof payload?.onSubmit === 'function') {
      setIsCustomSubmitting(true);
      try {
        await payload.onSubmit(data);
        closeModal();
      } finally {
        setIsCustomSubmitting(false);
      }
      return;
    }

    if (activeModal === 'RENAME_COLLECTION' && payload?.collectionId) {
      await collectionService.updateCollection({
        collectionId: payload.collectionId,
        name: data.name,
        description: data.description,
        color: data.color,
        scopeId: effectiveScope,
      });
      closeModal();
      return;
    }

    const res = await createCollectionMutation.mutateAsync({
      name: data.name,
      description: data.description,
      color: data.color,
      parentId: data.parentId !== undefined ? data.parentId : (payload?.parentId ?? null),
    });
    const createdId =
      (res as { collection?: { id: string }; id?: string })?.collection?.id ||
      (res as { id?: string })?.id;
    if (payload?.assignToItemId && createdId) {
      const currentIds = Array.isArray(payload.currentCollectionIds)
        ? payload.currentCollectionIds
        : [];
      updateItemMutation.mutate({
        itemId: payload.assignToItemId,
        data: { collectionIds: [...currentIds, createdId] },
        silent: true,
      });
      toast.success(`Created & added to "${data.name}"`, { id: 'col-assign' });
    }
    closeModal();
  };

  const handleConfirmDeleteCollection = async () => {
    if (payload?.onConfirm) {
      setIsCustomSubmitting(true);
      try {
        await payload.onConfirm();
        closeModal();
      } finally {
        setIsCustomSubmitting(false);
      }
      return;
    }
    if (payload?.collectionId) {
      await collectionService.deleteCollection({
        collectionId: payload.collectionId,
        scopeId: effectiveScope,
      });
    }
    closeModal();
  };

  if (isCreateCollectionOpen) {
    return (
      <CreateCollectionModal
        open={isCreateCollectionOpen}
        onOpenChange={(open) => !open && closeModal()}
        onSubmit={handleCreateOrRenameCollection}
        isPending={
          createCollectionMutation.isPending ||
          collectionService.isUpdating ||
          isCustomSubmitting
        }
        collections={Array.isArray(payload?.collections) ? payload.collections : collections}
        defaultParentId={payload?.parentId || null}
        rootLabel={
          payload?.rootLabel ||
          (activeScope.type === 'project' ? (activeScope.name || 'Project') : 'My Library')
        }
        rootType={
          payload?.rootType || (activeScope.type === 'project' ? 'project' : 'user')
        }
      />
    );
  }

  if (isDeleteCollectionOpen) {
    return (
      <DeleteModal
        open={isDeleteCollectionOpen}
        onOpenChange={(open) => !open && closeModal()}
        title={payload?.title || 'Delete Collection'}
        description={
          payload?.description ||
          'Are you sure you want to delete this collection?'
        }
        confirmLabel={payload?.confirmLabel || 'Delete Collection'}
        onConfirm={handleConfirmDeleteCollection}
        isDeleting={collectionService.isDeleting || isCustomSubmitting}
      />
    );
  }

  if (isExternalSyncOpen) {
    return (
      <ExternalLibrarySyncModal
        open={isExternalSyncOpen}
        onOpenChange={(open) => !open && closeModal()}
        defaultProvider={payload?.provider || 'zotero'}
        scopeId={effectiveScope}
        collections={collections}
        defaultCollectionId={payload?.collectionId || null}
      />
    );
  }

  if (isFeedsManagerOpen) {
    return (
      <FeedsManagerModal
        open={isFeedsManagerOpen}
        onOpenChange={(open) => !open && closeModal()}
        scopeId={effectiveScope}
        collections={collections}
        defaultCollectionId={payload?.collectionId || null}
      />
    );
  }

  return null;
}

/**
 * 2. DestructiveItemModalsHost
 * Only mounts delete/restore/purge mutation hooks when a destructive/restore confirmation modal is open.
 */
export function DestructiveItemModalsHost({
  activeModal,
  payload,
  effectiveScope,
  closeModal,
}: ModalHostProps) {
  const clearSelection = useLibraryUIStore((s) => s.clearSelection);
  const activeItemId = useLibraryUIStore((s) => s.activeItemId);
  const setActiveItem = useLibraryUIStore((s) => s.setActiveItem);

  const deleteItemsMutation = useDeleteLibraryItemsMutation(effectiveScope);
  const restoreItemsMutation = useBatchRestoreItemsMutation(effectiveScope);
  const purgeItemsMutation = useBatchPurgeItemsMutation(effectiveScope);
  const [isCustomSubmitting, setIsCustomSubmitting] = React.useState(false);

  const itemIds: string[] = payload?.itemIds || [];
  const isRestoreMode = activeModal === 'CONFIRM_RESTORE';
  const isEmptyTrashMode = activeModal === 'EMPTY_TRASH';
  const isPermanentDelete = Boolean(payload?.permanent) || isEmptyTrashMode;
  const customConfirmCallback = payload?.onConfirm;

  const handleConfirm = async () => {
    if (customConfirmCallback) {
      setIsCustomSubmitting(true);
      try {
        if (isPermanentDelete) {
          useLibraryCommandStore.getState().clear();
        }
        await customConfirmCallback();
        closeModal();
      } finally {
        setIsCustomSubmitting(false);
      }
      return;
    }

    if (itemIds.length === 0) return;

    if (isRestoreMode) {
      await useLibraryCommandStore.getState().executeCommand(
        createRestoreCommand({
          itemIds,
          restoreMutation: { mutateAsync: restoreItemsMutation.mutateAsync },
          deleteMutation: { mutateAsync: deleteItemsMutation.mutateAsync },
        }),
      );
    } else if (isPermanentDelete) {
      useLibraryCommandStore.getState().clear();
      await purgeItemsMutation.mutateAsync(itemIds);
    } else {
      await useLibraryCommandStore.getState().executeCommand(
        createTrashCommand({
          itemIds,
          deleteMutation: { mutateAsync: deleteItemsMutation.mutateAsync },
          restoreMutation: { mutateAsync: restoreItemsMutation.mutateAsync },
        }),
      );
    }

    clearSelection();
    if (!isRestoreMode && activeItemId && itemIds.includes(activeItemId)) {
      setActiveItem(null);
    }
    closeModal();
  };

  return (
    <DeleteModal
      open={true}
      onOpenChange={(open) => !open && closeModal()}
      title={
        payload?.title ||
        (isRestoreMode
          ? 'Restore Items'
          : customConfirmCallback || isEmptyTrashMode
            ? 'Empty Trash'
            : isPermanentDelete
              ? 'Permanently Delete Items'
              : 'Move to Trash')
      }
      description={
        payload?.description ||
        (isRestoreMode
          ? `Are you sure you want to restore ${itemIds.length} selected ${itemIds.length === 1 ? 'item' : 'items'} from the trash?`
          : customConfirmCallback || isEmptyTrashMode
            ? 'Are you sure you want to permanently empty the trash? All items will be permanently deleted and cannot be recovered.'
            : isPermanentDelete
              ? `Are you sure you want to permanently delete ${itemIds.length} selected ${itemIds.length === 1 ? 'item' : 'items'}? This action cannot be undone.`
              : `Are you sure you want to move ${itemIds.length} selected ${itemIds.length === 1 ? 'item' : 'items'} to the trash?`)
      }
      confirmLabel={
        payload?.confirmLabel ||
        (isRestoreMode
          ? 'Restore'
          : customConfirmCallback || isPermanentDelete
            ? 'Permanently Delete'
            : 'Move to Trash')
      }
      onConfirm={handleConfirm}
      isDeleting={
        isCustomSubmitting ||
        (isRestoreMode
          ? restoreItemsMutation.isPending
          : isPermanentDelete
            ? purgeItemsMutation.isPending
            : deleteItemsMutation.isPending)
      }
    />
  );
}

/**
 * 3. SavedSearchModalHost
 * Lazy host for Smart Collection creation & editing.
 */
export function SavedSearchModalHost({
  payload,
  effectiveScope,
  closeModal,
}: ModalHostProps) {
  const {
    createSavedSearch,
    updateSavedSearch,
    isCreating,
    isUpdating,
  } = useSavedSearches(effectiveScope, { enabled: true });

  return (
    <CreateSavedSearchModal
      open={true}
      onOpenChange={(open) => !open && closeModal()}
      savedSearch={payload?.savedSearch || null}
      scopeId={effectiveScope}
      onSubmit={async (data: CreateSavedSearchInput) => {
        if (payload?.savedSearch?.id) {
          await updateSavedSearch({
            id: payload.savedSearch.id,
            data: {
              name: data.name,
              conjunction: data.conjunction,
              conditions: data.conditions,
              sortBy: data.sortBy,
              sortOrder: data.sortOrder,
              targetScope: data.targetScope,
              scope: data.scope,
            },
          });
        } else {
          await createSavedSearch(data);
        }
        closeModal();
      }}
      isPending={isCreating || isUpdating}
    />
  );
}
