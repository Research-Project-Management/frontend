'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { useQueryClient } from '@tanstack/react-query';
import { useLibraryUIStore } from '@/features/library/core/store/library-ui.store';
import { useProcessModalStore } from '@/features/library/core/store/process-modal.store';
import { useCreateCollectionMutation } from '@/features/library/sdk/queries/collections.queries';
import { useCollectionsQuery } from '@/features/library/sdk/queries/collections.queries';
import { toast } from 'sonner';
import { useDeleteLibraryItemsMutation, useBatchPurgeItemsMutation, useUpdateLibraryItemMutation, itemKeys } from '@/features/library/sdk/queries/catalog.queries';
import { useSavedSearches } from '@/features/library/sdk/queries/saved-searches-relations.queries';
import {
  executeTrackedIdentifierIngestion,
  useMergeDuplicates,
  useDismissDuplicatesMutation,
} from '@/features/library/sdk/queries/ingestion.queries';
import type { CollectionFormValues, Item, CreateSavedSearchInput } from '@/features/library/domain/types/library.types';
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
  const queryClient = useQueryClient();
  const activeModal = useLibraryUIStore((s) => s.activeModal);
  const modalProps = useLibraryUIStore((s) => s.modalProps);
  const payload = modalProps as {
    item?: Item;
    items?: Item[];
    duplicates?: Item[];
    recommendedMasterId?: string;
    targetType?: string;
    collectionId?: string;
    parentId?: string | null;
    parentCollectionId?: string | null;
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

  // Collections & Queries (lazy enabled only when create collection, external sync, or feeds modal is open)
  const { data: collections = [] } = useCollectionsQuery(effectiveScope, {
    enabled: isCreateCollectionOpen || isExternalSyncOpen || isFeedsManagerOpen,
  });

  // Mutations & Sub-resources
  const createCollectionMutation = useCreateCollectionMutation(effectiveScope);
  const deleteItemsMutation = useDeleteLibraryItemsMutation(effectiveScope);
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
  const handleCreateCollection = async (data: CollectionFormValues) => {
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

  // 2. Delete Confirmation Modal (Items or Empty Trash)
  const isDeleteConfirmOpen = activeModal === 'DELETE_CONFIRM';
  const itemIdsToDelete: string[] = payload?.itemIds || [];
  const isPermanentDelete = Boolean(payload?.permanent);
  const customDeleteConfirmCallback = payload?.onConfirm;
  const handleDeleteConfirm = async () => {
    if (customDeleteConfirmCallback) {
      await customDeleteConfirmCallback();
      closeModal();
      return;
    }
    if (itemIdsToDelete.length === 0) return;
    if (isPermanentDelete) {
      await purgeItemsMutation.mutateAsync(itemIdsToDelete);
    } else {
      await deleteItemsMutation.mutateAsync(itemIdsToDelete);
    }
    clearSelection();
    closeModal();
  };

  // 3. Add Link / Identifier Modal (DOI, arXiv, PMID, ISBN, URL, BibTeX, RIS)
  const isAddLinkOpen = activeModal === 'ADD_BY_IDENTIFIER';
  const [isSubmittingLink, setIsSubmittingLink] = React.useState(false);

  const handleAddLinkSubmit = async (data: { url: string; title?: string }) => {
    const raw = (data.url || '').trim();
    if (!raw) return;

    setIsSubmittingLink(true);
    try {
      await executeTrackedIdentifierIngestion({
        scopeId: effectiveScope,
        rawInput: raw,
        title: data.title,
        collectionId: payload?.collectionId,
        queryClient,
        onCloseModal: closeModal,
        onAddProvisionalItem: addProcessingItem,
        onDismissProvisionalItem: dismissProcessingItem,
      });
    } finally {
      setIsSubmittingLink(false);
    }
  };

  // 4. Import from User Library Modal (When in Project Scope)
  const isImportFromUserOpen = activeModal === 'IMPORT_FROM_USER';

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
          isPending={createCollectionMutation.isPending}
          collections={collections}
          defaultParentId={payload?.parentId || null}
          rootLabel={activeScope.type === 'project' ? (activeScope.name || 'Project') : 'My Library'}
          rootType={activeScope.type === 'project' ? 'project' : 'user'}
        />
      )}

      {isDeleteConfirmOpen && (
        <DeleteModal
          open={isDeleteConfirmOpen}
          onOpenChange={(open) => !open && closeModal()}
          title={
            customDeleteConfirmCallback
              ? 'Empty Trash'
              : isPermanentDelete
                ? 'Permanently Delete Items'
                : 'Move to Trash'
          }
          description={
            customDeleteConfirmCallback
              ? 'Are you sure you want to permanently empty the trash? All items will be permanently deleted and cannot be recovered.'
              : isPermanentDelete
                ? `Are you sure you want to permanently delete ${itemIdsToDelete.length} selected ${itemIdsToDelete.length === 1 ? 'item' : 'items'}? This action cannot be undone.`
                : `Are you sure you want to move ${itemIdsToDelete.length} selected ${itemIdsToDelete.length === 1 ? 'item' : 'items'} to the trash?`
          }
          confirmLabel={
            customDeleteConfirmCallback || isPermanentDelete
              ? 'Permanently Delete'
              : 'Move to Trash'
          }
          onConfirm={handleDeleteConfirm}
          isDeleting={isPermanentDelete ? purgeItemsMutation.isPending : deleteItemsMutation.isPending}
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
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: itemKeys.all(effectiveScope) });
            queryClient.invalidateQueries({ queryKey: itemKeys.counts(effectiveScope) });
            closeModal();
          }}
        />
      )}

      {isConvertOpen && (
        <TypeConversionModal
          open={isConvertOpen}
          onOpenChange={(open) => !open && closeModal()}
          item={payload?.item}
          targetType={payload?.targetType || 'journalArticle'}
          scopeId={effectiveScope}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: itemKeys.all(effectiveScope) });
            queryClient.invalidateQueries({ queryKey: itemKeys.counts(effectiveScope) });
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
            queryClient.invalidateQueries({ queryKey: itemKeys.all(effectiveScope) });
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


