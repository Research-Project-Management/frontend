'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { useLibraryUIStore } from '@/features/library/core/store/library-ui.store';
import { useProcessModalStore } from '@/features/library/core/store/process-modal.store';
import { useCreateCollectionMutation } from '@/features/library/sdk/queries/collections.queries';
import { useCollectionsQuery } from '@/features/library/sdk/queries/collections.queries';
import { toast } from 'sonner';
import {
  useDeleteLibraryItemsMutation,
  useBatchRestoreItemsMutation,
  useBatchPurgeItemsMutation,
  useUpdateLibraryItemMutation,
  useLibraryCacheSynchronizer,
  useViewItems,
} from '@/features/library/sdk/queries/catalog.queries';
import {
  useLibraryCommandStore,
  createTrashCommand,
} from '@/features/library/core/manager/library-command.manager';
import { useSavedSearches } from '@/features/library/sdk/queries/saved-searches-relations.queries';
import {
  executeTrackedIdentifierIngestion,
  useMergeDuplicates,
  useDismissDuplicatesMutation,
} from '@/features/library/sdk/queries/ingestion.queries';
import { parseBatchIdentifiersInput } from '@/features/library/domain/identifiers';
import type {
  Collection,
  CollectionFormValues,
  Item,
  CreateSavedSearchInput,
} from '@/features/library/domain/types/library.types';
import type { SavedSearch } from '@/features/library/domain/types/saved-searches.types';

const CreateCollectionModal = dynamic(() => import('./CreateCollectionModal'), { ssr: false });
const CreateSavedSearchModal = dynamic(() => import('./CreateSavedSearchModal'), { ssr: false });
const DeleteModal = dynamic(() => import('./DeleteModal'), { ssr: false });
const AddLinkModal = dynamic(() => import('./AddLinkModal'), { ssr: false });
const ImportFromPersonalModal = dynamic(() => import('./ImportFromPersonalModal'), { ssr: false });
const TypeConversionModal = dynamic(
  () => import('./TypeConversionModal').then((m) => m.TypeConversionModal),
  { ssr: false },
);
const MergeModal = dynamic(() => import('./MergeModal'), { ssr: false });
const UploadFilesModal = dynamic(() => import('./UploadFilesModal'), { ssr: false });
const ProcessModal = dynamic(() => import('./ProcessModal'), { ssr: false });
const ExternalLibrarySyncModal = dynamic(() => import('./ExternalLibrarySyncModal'), { ssr: false });
const FeedsManagerModal = dynamic(() => import('./FeedsManagerModal'), { ssr: false });
const AddFeedModal = dynamic(() => import('./AddFeedModal'), { ssr: false });
const CslStyleSearchModal = dynamic(() => import('./CslStyleSearchModal'), { ssr: false });

/**
 * LibraryModals Container
 * Mounts all modal dialogs once at the workspace root.
 * Listens to `useLibraryUIStore` so no component has to drill modal props.
 */
export function LibraryModals({ scopeId }: { scopeId?: string }) {
  const {
    queryClient,
    invalidateScopeItemsAndCounts,
    resolveCachedItem,
    syncConvertedOrPatchedItem,
  } = useLibraryCacheSynchronizer(scopeId);
  const activeModal = useLibraryUIStore((s) => s.activeModal);
  const modalProps = useLibraryUIStore((s) => s.modalProps);
  const payload = modalProps as {
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
    [key: string]: unknown;
  };
  const closeModal = useLibraryUIStore((s) => s.closeModal);
  const clearSelection = useLibraryUIStore((s) => s.clearSelection);
  const activeItemId = useLibraryUIStore((s) => s.activeItemId);
  const setActiveItem = useLibraryUIStore((s) => s.setActiveItem);
  const activeScope = useLibraryUIStore((s) => s.activeScope);
  const effectiveScope = scopeId || (activeScope.type === 'project' ? activeScope.id : 'user');

  // Process Modal State & Handlers
  const processModalState = useProcessModalStore((s) => s.state);
  const closeProcessModal = useProcessModalStore((s) => s.closeModal);
  const minimizeProcessModal = useProcessModalStore((s) => s.minimizeModal);
  const restoreProcessModal = useProcessModalStore((s) => s.restoreModal);
  const addProcessingItem = useProcessModalStore((s) => s.addProcessingItem);
  const dismissProcessingItem = useProcessModalStore((s) => s.dismissProcessingItem);

  // 1. Create Collection Modal & External Sync Modal & Feeds Manager Modal
  const isCreateCollectionOpen = activeModal === 'CREATE_COLLECTION';
  const isExternalSyncOpen = activeModal === 'EXPORT_LIBRARY';
  const isFeedsManagerOpen = activeModal === 'FEEDS_MANAGER';
  const isAddFeedOpen = activeModal === 'ADD_FEED';

  const isImportFromUserOpen = activeModal === 'IMPORT_FROM_USER';
  const { data: projectItemsData } = useViewItems(
    isImportFromUserOpen ? effectiveScope : undefined,
    'all',
    { limit: 500 },
    { enabled: isImportFromUserOpen },
  );
  const existingProjectTitles = React.useMemo(() => {
    if (payload?.existingTitles && Array.isArray(payload.existingTitles)) {
      return payload.existingTitles as string[];
    }
    return (projectItemsData?.items || []).map((it) => it.title).filter(Boolean);
  }, [payload?.existingTitles, projectItemsData?.items]);

  // Collections & Queries (lazy enabled only when create collection, external sync, or feeds modal is open)
  const { data: collections = [] } = useCollectionsQuery(effectiveScope, {
    enabled: isCreateCollectionOpen || isExternalSyncOpen || isFeedsManagerOpen,
  });

  // Mutations & Sub-resources
  const createCollectionMutation = useCreateCollectionMutation(effectiveScope);
  const deleteItemsMutation = useDeleteLibraryItemsMutation(effectiveScope);
  const restoreItemsMutation = useBatchRestoreItemsMutation(effectiveScope);
  const purgeItemsMutation = useBatchPurgeItemsMutation(effectiveScope);
  const mergeDuplicatesMutation = useMergeDuplicates(effectiveScope);
  const isSavedSearchModalOpen = activeModal === 'SAVED_SEARCH';
  const {
    createSavedSearch,
    updateSavedSearch,
    isCreating: isCreatingSS,
    isUpdating: isUpdatingSS,
  } = useSavedSearches(effectiveScope, { enabled: isSavedSearchModalOpen });
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
        ? (payload.currentCollectionIds as string[])
        : [];
      updateItemMutation.mutate({
        itemId: payload.assignToItemId as string,
        data: { collectionIds: [...currentIds, createdId] },
        silent: true,
      });
      toast.success(`Created & added to "${data.name}"`, { id: 'col-assign' });
    }
    closeModal();
  };

  // 2. Delete Confirmation Modal (Items, Collections, or Empty Trash)
  const isDeleteConfirmOpen = activeModal === 'DELETE_CONFIRM';
  const itemIdsToDelete: string[] = payload?.itemIds || [];
  const isPermanentDelete = Boolean(payload?.permanent);
  const customDeleteConfirmCallback = payload?.onConfirm;
  const handleDeleteConfirm = async () => {
    if (customDeleteConfirmCallback) {
      setIsCustomSubmitting(true);
      try {
        useLibraryCommandStore.getState().clear();
        await customDeleteConfirmCallback();
        closeModal();
      } finally {
        setIsCustomSubmitting(false);
      }
      return;
    }
    if (itemIdsToDelete.length === 0) return;
    if (isPermanentDelete) {
      useLibraryCommandStore.getState().clear();
      await purgeItemsMutation.mutateAsync(itemIdsToDelete);
    } else {
      await useLibraryCommandStore.getState().executeCommand(
        createTrashCommand({
          itemIds: itemIdsToDelete,
          deleteMutation: { mutateAsync: deleteItemsMutation.mutateAsync },
          restoreMutation: { mutateAsync: restoreItemsMutation.mutateAsync },
        }),
      );
    }
    clearSelection();
    if (activeItemId && itemIdsToDelete.includes(activeItemId)) {
      setActiveItem(null);
    }
    closeModal();
  };

  // 3. Add Link / Identifier Modal (DOI, arXiv, PMID, ISBN, URL, BibTeX, RIS)
  const isAddLinkOpen = activeModal === 'ADD_BY_IDENTIFIER';
  const [isSubmittingLink, setIsSubmittingLink] = React.useState(false);

  const handleAddLinkSubmit = async (data: {
    url: string;
    title?: string;
    attachOaPdf?: boolean;
    saveSnapshot?: boolean;
  }) => {
    const raw = (data.url || '').trim();
    if (!raw) return;

    const batchItems = parseBatchIdentifiersInput(raw);
    const inputsToIngest =
      batchItems.length > 1 ? batchItems.map((entry) => entry.raw) : [raw];

    setIsSubmittingLink(true);
    try {
      for (const singleInput of inputsToIngest) {
        await executeTrackedIdentifierIngestion({
          scopeId: effectiveScope,
          rawInput: singleInput,
          title: inputsToIngest.length === 1 ? data.title : undefined,
          attachOaPdf: data.attachOaPdf,
          saveSnapshot: data.saveSnapshot,
          collectionId: payload?.collectionId,
          queryClient,
          onCloseModal: closeModal,
          onAddProvisionalItem: addProcessingItem,
          onDismissProvisionalItem: dismissProcessingItem,
        });
      }
    } finally {
      setIsSubmittingLink(false);
    }
  };

  // 4. Import from User Library Modal (When in Project Scope)

  // 5. Convert Item Type Modal
  const isConvertOpen = activeModal === 'TYPE_CONVERSION';

  // 6. Merge Duplicates Modal
  const isMergeOpen = activeModal === 'MERGE_DUPLICATES';
  const mergeDuplicates = payload?.items || payload?.duplicates || [];
  const handleMergeDuplicates = async (
    masterPaper: Item,
    mergedFields: Record<string, unknown>,
    duplicateIdsToDelete: string[],
  ) => {
    useLibraryCommandStore.getState().clear();
    await mergeDuplicatesMutation.mutateAsync({
      primaryItemId: masterPaper.id,
      duplicateItemIds: duplicateIdsToDelete,
      overrides: Object.keys(mergedFields).length > 0 ? mergedFields : undefined,
    });
    clearSelection();
    closeModal();
  };

  const dismissDuplicatesMutation = useDismissDuplicatesMutation(effectiveScope);

  const handleDismissDuplicates = async (itemIds: string[]) => {
    if (payload?.onDismissDuplicate) {
      await payload.onDismissDuplicate(itemIds);
    } else {
      await dismissDuplicatesMutation.mutateAsync(itemIds);
    }
    clearSelection();
    closeModal();
  };

  return (
    <>
      {isCreateCollectionOpen && (
        <CreateCollectionModal
          open={isCreateCollectionOpen}
          onOpenChange={(open) => !open && closeModal()}
          onSubmit={handleCreateCollection}
          isPending={createCollectionMutation.isPending || isCustomSubmitting}
          collections={Array.isArray(payload?.collections) ? payload.collections : collections}
          defaultParentId={payload?.parentId || null}
          rootLabel={
            payload?.rootLabel ||
            (activeScope.type === 'project' ? (activeScope.name || 'Project') : 'My Library')
          }
          rootType={
            payload?.rootType ||
            (activeScope.type === 'project' ? 'project' : 'user')
          }
        />
      )}

      {isDeleteConfirmOpen && (
        <DeleteModal
          open={isDeleteConfirmOpen}
          onOpenChange={(open) => !open && closeModal()}
          title={
            payload?.title ||
            (customDeleteConfirmCallback
              ? 'Empty Trash'
              : isPermanentDelete
                ? 'Permanently Delete Items'
                : 'Move to Trash')
          }
          description={
            payload?.description ||
            (customDeleteConfirmCallback
              ? 'Are you sure you want to permanently empty the trash? All items will be permanently deleted and cannot be recovered.'
              : isPermanentDelete
                ? `Are you sure you want to permanently delete ${itemIdsToDelete.length} selected ${itemIdsToDelete.length === 1 ? 'item' : 'items'}? This action cannot be undone.`
                : `Are you sure you want to move ${itemIdsToDelete.length} selected ${itemIdsToDelete.length === 1 ? 'item' : 'items'} to the trash?`)
          }
          confirmLabel={
            payload?.confirmLabel ||
            (customDeleteConfirmCallback || isPermanentDelete
              ? 'Permanently Delete'
              : 'Move to Trash')
          }
          onConfirm={handleDeleteConfirm}
          isDeleting={
            isCustomSubmitting ||
            (isPermanentDelete ? purgeItemsMutation.isPending : deleteItemsMutation.isPending)
          }
        />
      )}

      {isAddLinkOpen && (
        <AddLinkModal
          open={isAddLinkOpen}
          onOpenChange={(open) => !open && closeModal()}
          onSubmit={handleAddLinkSubmit}
          isPending={isSubmittingLink}
        />
      )}

      {isImportFromUserOpen && (
        <ImportFromPersonalModal
          open={isImportFromUserOpen}
          onOpenChange={(open) => !open && closeModal()}
          scopeId={effectiveScope}
          projectName={activeScope?.name || 'Project'}
          existingTitles={existingProjectTitles}
          onSuccess={() => {
            void invalidateScopeItemsAndCounts(effectiveScope);
            closeModal();
          }}
        />
      )}

      {isConvertOpen && (
        <TypeConversionModal
          open={isConvertOpen}
          onOpenChange={(open) => !open && closeModal()}
          item={
            payload?.item ||
            (payload?.itemId
              ? resolveCachedItem(payload.itemId, effectiveScope) || {
                  id: payload.itemId,
                  itemType: payload.currentType || 'journalArticle',
                  title: payload.itemTitle || '',
                }
              : undefined)
          }
          targetType={payload?.targetType || 'journalArticle'}
          scopeId={effectiveScope}
          onSuccess={(updatedItem: Item) => {
            const targetItemId = updatedItem?.id || payload?.item?.id || payload?.itemId;
            if (targetItemId && updatedItem) {
              syncConvertedOrPatchedItem(targetItemId, updatedItem, effectiveScope);
            } else {
              void invalidateScopeItemsAndCounts(effectiveScope);
            }
            closeModal();
          }}
        />
      )}

      {isMergeOpen && mergeDuplicates.length >= 2 && (
        <MergeModal
          open={isMergeOpen}
          onOpenChange={(open) => !open && closeModal()}
          duplicates={mergeDuplicates}
          recommendedMasterId={payload?.recommendedMasterId}
          scopeId={effectiveScope}
          onMerge={handleMergeDuplicates}
          onDismissDuplicate={handleDismissDuplicates}
        />
      )}

      {activeModal === 'UPLOAD_PDF' && (
        <UploadFilesModal
          open={activeModal === 'UPLOAD_PDF'}
          onOpenChange={(open) => !open && closeModal()}
          scopeId={effectiveScope}
          defaultCollectionId={payload?.collectionId || ''}
          initialFiles={payload?.files || payload?.initialFiles || []}
          onSuccess={() => {
            void invalidateScopeItemsAndCounts(effectiveScope);
            closeModal();
          }}
        />
      )}

      {isSavedSearchModalOpen && (
        <CreateSavedSearchModal
          open={isSavedSearchModalOpen}
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
                },
              });
            } else {
              await createSavedSearch(data);
            }
            closeModal();
          }}
          isPending={isCreatingSS || isUpdatingSS}
        />
      )}

      {isExternalSyncOpen && (
        <ExternalLibrarySyncModal
          open={isExternalSyncOpen}
          onOpenChange={(open) => !open && closeModal()}
          defaultProvider={payload?.provider || 'zotero'}
          scopeId={effectiveScope}
          collections={collections}
          defaultCollectionId={payload?.collectionId || null}
        />
      )}

      {isFeedsManagerOpen && (
        <FeedsManagerModal
          open={isFeedsManagerOpen}
          onOpenChange={(open) => !open && closeModal()}
          scopeId={effectiveScope}
          collections={collections}
          defaultCollectionId={payload?.collectionId || null}
        />
      )}

      {isAddFeedOpen && (
        <AddFeedModal
          open={isAddFeedOpen}
          onOpenChange={(open) => !open && closeModal()}
        />
      )}

      {activeModal === 'CSL_STYLE_MANAGER' && (
        <CslStyleSearchModal
          open={activeModal === 'CSL_STYLE_MANAGER'}
          onOpenChange={(open) => !open && closeModal()}
          currentStyleId={typeof payload?.currentStyleId === 'string' ? payload.currentStyleId : undefined}
          onSelectStyle={(style) => {
            if (typeof payload?.onSelectStyle === 'function') {
              (payload.onSelectStyle as (s: { id: string; label: string }) => void)(style);
            }
            closeModal();
          }}
        />
      )}

      {/* Standalone Process / Metadata Retrieval Modal */}
      {(processModalState.isOpen || processModalState.isMinimized) && (
        <ProcessModal
          state={processModalState}
          onClose={closeProcessModal}
          onMinimize={minimizeProcessModal}
          onRestore={restoreProcessModal}
        />
      )}
    </>
  );
}

export default LibraryModals;


