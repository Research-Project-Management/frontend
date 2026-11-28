'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import {
  useLibraryUIStore,
  type LibraryModalType,
} from '@/features/library/core/store/ui.store';
import {
  useCreateCollectionMutation,
  useCollections,
} from '@/features/library/core/coordinator/collection.coordinator';
import {
  useDeleteLibraryItemsMutation,
  useBatchRestoreItemsMutation,
  useBatchPurgeItemsMutation,
  useUpdateLibraryItemMutation,
} from '@/features/library/core/coordinator/item-action.coordinator';
import {
  useLibraryCommandStore,
  createTrashCommand,
  buildPreConversionSnapshot,
  PRE_CONVERSION_BIBLIOGRAPHIC_SCALAR_KEYS,
} from '@/features/library/core/manager/command.manager';
import {
  useSavedSearches,
  useTrash,
} from '@/features/library/core/coordinator/saved-search.coordinator';
import type {
  Collection,
  CollectionFormValues,
  Item,
  CreateSavedSearchInput,
} from '@/features/library/types/core.types';
import type {
  SavedSearch,
  SavedFeedSubscription,
} from '@/features/library/types/ingestion.types';

export {
  buildPreConversionSnapshot,
  PRE_CONVERSION_BIBLIOGRAPHIC_SCALAR_KEYS,
};

const CreateCollectionModal = dynamic(() => import('./CreateCollectionModal'), { ssr: false });
const CreateSavedSearchModal = dynamic(() => import('./CreateSavedSearchModal'), { ssr: false });
const DeleteModal = dynamic(() => import('./DeleteModal'), { ssr: false });
const ExternalSyncModal = dynamic(() => import('./ExternalSyncModal'), { ssr: false });
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
  collection?: Collection;
  name?: string;
  color?: string;
  initialName?: string;
  initialDescription?: string;
  initialColor?: string;
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
  mode?: 'file' | 'folder';
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
 * 1a. WorkspaceIntegrationsModalsHost
 * Only mounts External Library Sync (Zotero/Mendeley) and Academic Feeds Manager modals.
 */
export function WorkspaceIntegrationsModalsHost({
  activeModal,
  payload,
  effectiveScope,
  closeModal,
}: ModalHostProps) {
  const isExternalSyncOpen = activeModal === 'EXPORT_LIBRARY';
  const isFeedsManagerOpen = activeModal === 'FEEDS_MANAGER';

  const collectionsController = useCollections({
    spaceId: effectiveScope,
    enabled: isExternalSyncOpen || isFeedsManagerOpen,
  });
  const collections = collectionsController.collections;

  if (isExternalSyncOpen) {
    return (
      <ExternalSyncModal
        open={isExternalSyncOpen}
        onOpenChange={(open) => !open && closeModal()}
        defaultProvider={payload?.provider || 'zotero'}
        spaceId={effectiveScope}
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
        spaceId={effectiveScope}
        collections={collections}
        defaultCollectionId={payload?.collectionId || null}
      />
    );
  }

  return null;
}

/**
 * 1b. CollectionModalsHost
 * Only mounts collection create/rename/delete queries & mutations when opened,
 * and delegates workspace integration modals to `WorkspaceIntegrationsModalsHost`.
 */
export function CollectionModalsHost(props: ModalHostProps) {
  const { activeModal, payload, effectiveScope, closeModal } = props;
  const activeScope = useLibraryUIStore((s) => s.activeScope);
  const isCreateCollectionOpen = activeModal === 'CREATE_COLLECTION';

  const collectionsController = useCollections({
    spaceId: effectiveScope,
    enabled: isCreateCollectionOpen,
  });
  const collections = collectionsController.collections;

  const createCollectionMutation = useCreateCollectionMutation(effectiveScope);
  const updateItemMutation = useUpdateLibraryItemMutation(effectiveScope);
  const [isCustomSubmitting, setIsCustomSubmitting] = React.useState(false);

  const handleCreateCollection = async (data: CollectionFormValues) => {
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
      try {
        await updateItemMutation.mutateAsync({
          itemId: payload.assignToItemId,
          data: { collectionIds: [...currentIds, createdId] },
          silent: true,
        });
        toast.success(`Created & added to "${data.name}"`, { id: 'col-assign' });
      } catch {
        toast.warning(`Collection "${data.name}" created, but could not assign item.`, {
          id: 'col-assign',
        });
      }
    }
    closeModal();
  };

  if (isCreateCollectionOpen) {
    const resolvedCollectionList = Array.isArray(payload?.collections)
      ? payload.collections
      : collections;
    const targetCollection =
      payload?.collection ||
      (payload?.collectionId
        ? resolvedCollectionList.find((c) => c.id === payload.collectionId)
        : undefined);

    return (
      <CreateCollectionModal
        open={isCreateCollectionOpen}
        onOpenChange={(open) => !open && closeModal()}
        onSubmit={handleCreateCollection}
        isPending={createCollectionMutation.isPending || isCustomSubmitting}
        collections={resolvedCollectionList}
        defaultParentId={
          payload?.parentId !== undefined
            ? payload.parentId
            : (targetCollection?.parentId ?? null)
        }
        mode="create"
        initialName={
          payload?.initialName ?? payload?.name ?? targetCollection?.name ?? ''
        }
        initialDescription={
          payload?.initialDescription ??
          payload?.description ??
          targetCollection?.description ??
          ''
        }
        initialColor={
          payload?.initialColor ?? payload?.color ?? targetCollection?.color ?? ''
        }
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
  const evictItems = useLibraryUIStore((s) => s.evictItems);
  const setActiveItem = useLibraryUIStore((s) => s.setActiveItem);

  const deleteItemsMutation = useDeleteLibraryItemsMutation(effectiveScope);
  const restoreItemsMutation = useBatchRestoreItemsMutation(effectiveScope);
  const purgeItemsMutation = useBatchPurgeItemsMutation(effectiveScope);
  const executeCommand = useLibraryCommandStore((s) => s.executeCommand);
  const clearCommandHistory = useLibraryCommandStore((s) => s.clearHistory);
  const [isCustomSubmitting, setIsCustomSubmitting] = React.useState(false);

  const itemIds: string[] = payload?.itemIds || [];
  const isEmptyTrashMode = activeModal === 'EMPTY_TRASH';
  const isPermanentDelete = Boolean(payload?.permanent) || isEmptyTrashMode;
  const customConfirmCallback = payload?.onConfirm;
  const { emptyTrash } = useTrash(effectiveScope, {
    enabled: isEmptyTrashMode && !customConfirmCallback,
  });

  const handleConfirm = async () => {
    if (customConfirmCallback) {
      setIsCustomSubmitting(true);
      try {
        await customConfirmCallback();
        if (isPermanentDelete) {
          clearCommandHistory();
        }
        closeModal();
      } finally {
        setIsCustomSubmitting(false);
      }
      return;
    }

    if (isEmptyTrashMode && itemIds.length === 0) {
      setIsCustomSubmitting(true);
      try {
        await emptyTrash();
        clearCommandHistory();
        clearSelection();
        setActiveItem(null);
        closeModal();
      } finally {
        setIsCustomSubmitting(false);
      }
      return;
    }

    if (itemIds.length === 0) return;

    if (isPermanentDelete) {
      await purgeItemsMutation.mutateAsync(itemIds);
      clearCommandHistory();
      if (isEmptyTrashMode) {
        clearSelection();
        setActiveItem(null);
      } else {
        evictItems(itemIds);
      }
    } else {
      await executeCommand(
        createTrashCommand({
          itemIds,
          deleteMutation: { mutateAsync: deleteItemsMutation.mutateAsync },
          restoreMutation: { mutateAsync: restoreItemsMutation.mutateAsync },
        }),
        { silentToast: true },
      );
      evictItems(itemIds);
    }

    closeModal();
  };

  return (
    <DeleteModal
      open={true}
      onOpenChange={(open) => !open && closeModal()}
      title={
        payload?.title ||
        (isEmptyTrashMode
          ? 'Empty Trash'
          : isPermanentDelete
            ? 'Permanently Delete Items'
            : 'Move to Trash')
      }
      description={
        payload?.description ||
        (isEmptyTrashMode
          ? 'Are you sure you want to permanently empty the trash? All items will be permanently deleted and cannot be recovered.'
          : isPermanentDelete
            ? `Are you sure you want to permanently delete ${itemIds.length} selected ${itemIds.length === 1 ? 'item' : 'items'}? This action cannot be undone.`
            : `Are you sure you want to move ${itemIds.length} selected ${itemIds.length === 1 ? 'item' : 'items'} to the trash?`)
      }
      confirmLabel={
        payload?.confirmLabel ||
        (isEmptyTrashMode
          ? 'Empty Trash'
          : isPermanentDelete
            ? 'Permanently Delete'
            : 'Move to Trash')
      }
      buttonVariant="destructive"
      onConfirm={handleConfirm}
      isDeleting={
        isCustomSubmitting ||
        (isPermanentDelete ? purgeItemsMutation.isPending : deleteItemsMutation.isPending)
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
      spaceId={effectiveScope}
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
              scopeOptions: data.scopeOptions,
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
