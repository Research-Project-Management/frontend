'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { useQueryClient } from '@tanstack/react-query';
import { useLibraryUIStore } from '@/features/library/core/store/library-ui.store';
import { useProcessModalStore } from '@/features/library/core/store/process-modal.store';
import { libraryServices } from '@/features/library/sdk/library.client';
import { useCreateCollectionMutation } from '@/features/library/sdk/queries/collections.queries';
import { useCollectionsQuery } from '@/features/library/sdk/queries/collections.queries';
import { useDeleteLibraryItemsMutation, useBatchPurgeItemsMutation } from '@/features/library/sdk/queries/catalog.queries';
import { useSavedSearches } from '@/features/library/sdk/queries/saved-searches-relations.queries';
import { executeTrackedIdentifierIngestion } from '@/features/library/sdk/queries/ingestion.queries';
import { itemKeys, libraryKeys } from '@/features/library/sdk/query-keys';
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
    targetType?: string;
    collectionId?: string;
    parentId?: string | null;
    parentCollectionId?: string | null;
    itemIds?: string[];
    permanent?: boolean;
    files?: File[];
    initialFiles?: File[];
    savedSearch?: SavedSearch | null;
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

  // Collections & Queries
  const { data: collections = [] } = useCollectionsQuery(effectiveScope);

  // Mutations
  const createCollectionMutation = useCreateCollectionMutation(effectiveScope);
  const deleteItemsMutation = useDeleteLibraryItemsMutation(effectiveScope);
  const purgeItemsMutation = useBatchPurgeItemsMutation(effectiveScope);
  const {
    createSavedSearch,
    updateSavedSearch,
    isCreating: isCreatingSS,
    isUpdating: isUpdatingSS,
  } = useSavedSearches(effectiveScope);
  const isSavedSearchModalOpen =
    activeModal === 'SAVED_SEARCH' || activeModal === 'CREATE_SAVED_SEARCH';

  // 1. Create Collection Modal
  const isCreateCollectionOpen = activeModal === 'CREATE_COLLECTION';
  const handleCreateCollection = async (data: CollectionFormValues) => {
    await createCollectionMutation.mutateAsync({
      name: data.name,
      description: data.description,
      color: data.color,
      parentId: data.parentId !== undefined ? data.parentId : (payload?.parentId ?? null),
    });
    closeModal();
  };

  // 2. Delete Items Modal
  const isDeleteItemsOpen = activeModal === 'DELETE_ITEMS';
  const itemIdsToDelete: string[] = payload?.itemIds || [];
  const isPermanentDelete = Boolean(payload?.permanent);
  const handleDeleteItems = async () => {
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
  const isAddLinkOpen =
    activeModal === 'ADD_LINK' ||
    activeModal === 'IMPORT_IDENTIFIER' ||
    activeModal === 'IMPORT_PAPER';
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
  const isImportFromUserOpen = activeModal === 'IMPORT_FROM_USER' || activeModal === 'IMPORT_FROM_PERSONAL';

  // 5. Convert Item Type Modal
  const isConvertOpen = activeModal === 'CONVERT_ITEM_TYPE';

  // 6. Merge Duplicates Modal
  const isMergeOpen = activeModal === 'MERGE_DUPLICATES';
  const mergeDuplicates = payload?.items || payload?.duplicates || [];
  const handleMergeDuplicates = async (
    masterPaper: Item,
    mergedFields: Record<string, unknown>,
    duplicateIdsToDelete: string[],
  ) => {
    await libraryServices.curation.mergePapers(
      effectiveScope,
      masterPaper.id,
      duplicateIdsToDelete,
      mergedFields,
    );
    queryClient.invalidateQueries({ queryKey: itemKeys.all(effectiveScope) });
    queryClient.invalidateQueries({ queryKey: libraryKeys.duplicates(effectiveScope) });
    clearSelection();
    closeModal();
  };

  const handleDismissDuplicates = async (itemIds: string[]) => {
    await libraryServices.curation.dismissDuplicates(effectiveScope, itemIds);
    queryClient.invalidateQueries({ queryKey: libraryKeys.duplicates(effectiveScope) });
    queryClient.invalidateQueries({ queryKey: itemKeys.all(effectiveScope) });
    clearSelection();
    closeModal();
  };

  // 7. Empty Trash Confirmation
  const isTrashConfirmOpen = activeModal === 'TRASH_CONFIRM';
  const trashConfirmCallback = payload?.onConfirm as (() => Promise<void>) | undefined;
  const handleTrashConfirm = async () => {
    await trashConfirmCallback?.();
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

      {isDeleteItemsOpen && (
        <DeleteModal
          open={isDeleteItemsOpen}
          onOpenChange={(open) => !open && closeModal()}
          title={isPermanentDelete ? 'Permanently Delete Items' : 'Move to Trash'}
          description={
            isPermanentDelete
              ? `Are you sure you want to permanently delete ${itemIdsToDelete.length} selected ${itemIdsToDelete.length === 1 ? 'item' : 'items'}? This action cannot be undone.`
              : `Are you sure you want to move ${itemIdsToDelete.length} selected ${itemIdsToDelete.length === 1 ? 'item' : 'items'} to the trash?`
          }
          confirmLabel={isPermanentDelete ? 'Permanently Delete' : 'Move to Trash'}
          onConfirm={handleDeleteItems}
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
          projectId={effectiveScope}
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

      {isMergeOpen && mergeDuplicates.length > 0 && (
        <MergeModal
          open={isMergeOpen}
          onOpenChange={(open) => !open && closeModal()}
          duplicates={mergeDuplicates}
          scopeId={effectiveScope}
          onMerge={handleMergeDuplicates}
          onDismissDuplicate={handleDismissDuplicates}
        />
      )}

      {activeModal === 'UPLOAD_FILES' && (
        <UploadFilesModal
          open={activeModal === 'UPLOAD_FILES'}
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

      {isTrashConfirmOpen && (
        <DeleteModal
          open={isTrashConfirmOpen}
          onOpenChange={(open) => !open && closeModal()}
          title="Empty Trash"
          description="Are you sure you want to permanently empty the trash? All items will be permanently deleted and cannot be recovered."
          onConfirm={handleTrashConfirm}
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


