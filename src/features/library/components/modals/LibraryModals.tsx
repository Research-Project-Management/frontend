'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  useLibraryModalStore,
  useLibraryViewStore,
  useLibrarySidebarStore,
  useProcessModalStore,
} from '../../store';
import {
  useCreateCollectionMutation,
  useDeleteLibraryItemsMutation,
  useBatchPurgeItemsMutation,
  IngestionService,
  QualityService,
  itemKeys,
  libraryKeys,
  invalidateCollections,
} from '../../data';
import type { CollectionFormValues, UnifiedIngestionPayload } from '../../types';

const CreateCollectionModal = dynamic(() => import('./CreateCollectionModal'), { ssr: false });
const DeleteModal = dynamic(() => import('./DeleteModal'), { ssr: false });
const AddLinkModal = dynamic(() => import('./AddLinkModal'), { ssr: false });
const ImportFromPersonalModal = dynamic(() => import('./ImportFromPersonalModal'), { ssr: false });
const ConvertModal = dynamic(() => import('./ConvertModal'), { ssr: false });
const MergeModal = dynamic(() => import('./MergeModal'), { ssr: false });
const UploadFilesModal = dynamic(() => import('./UploadFilesModal'), { ssr: false });
const ProcessModal = dynamic(() => import('./ProcessModal'), { ssr: false });

/**
 * LibraryModals Container
 * Mounts all modal dialogs once at the workspace root.
 * Listens to `useLibraryModalStore` so no component has to drill modal props.
 */
export function LibraryModals({ scopeId }: { scopeId?: string }) {
  const queryClient = useQueryClient();
  const activeModal = useLibraryModalStore((s) => s.activeModal);
  const payload = useLibraryModalStore((s) => s.payload);
  const closeModal = useLibraryModalStore((s) => s.closeModal);
  const clearSelection = useLibraryViewStore((s) => s.clearSelection);
  const activeScope = useLibrarySidebarStore((s) => s.activeScope);
  const effectiveScope = scopeId || (activeScope.type === 'project' ? activeScope.id : 'user');

  // Process Modal State & Handlers
  const processModalState = useProcessModalStore((s) => s.state);
  const closeProcessModal = useProcessModalStore((s) => s.closeModal);
  const minimizeProcessModal = useProcessModalStore((s) => s.minimizeModal);
  const restoreProcessModal = useProcessModalStore((s) => s.restoreModal);

  // Mutations
  const createCollectionMutation = useCreateCollectionMutation(effectiveScope);
  const deleteItemsMutation = useDeleteLibraryItemsMutation(effectiveScope);
  const purgeItemsMutation = useBatchPurgeItemsMutation(effectiveScope);

  // 1. Create Collection Modal
  const isCreateCollectionOpen = activeModal === 'CREATE_COLLECTION';
  const handleCreateCollection = async (data: CollectionFormValues) => {
    await createCollectionMutation.mutateAsync({
      name: data.name,
      description: data.description,
      color: data.color,
      parentId: payload?.parentId || data.parentId || null,
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
      // Permanent purge (called from Trash view)
      await purgeItemsMutation.mutateAsync(itemIdsToDelete);
    } else {
      // Soft delete → move to trash
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

    let ingestionPayload: UnifiedIngestionPayload;
    const targetCollectionId = payload?.collectionId || undefined;

    if (raw.startsWith('10.') || raw.includes('doi.org/')) {
      const doi = raw.replace(/^https?:\/\/doi\.org\//i, '').trim();
      ingestionPayload = { source: 'doi', doi, collectionId: targetCollectionId };
    } else if (raw.toLowerCase().startsWith('arxiv:') || /^\d{4}\.\d{4,5}/.test(raw)) {
      const arxivId = raw.replace(/^arxiv:/i, '').trim();
      ingestionPayload = { source: 'arxiv', arxivId, collectionId: targetCollectionId };
    } else if (raw.toLowerCase().startsWith('pmid:') || /^\d{7,9}$/.test(raw)) {
      const pmid = raw.replace(/^pmid:/i, '').trim();
      ingestionPayload = { source: 'pmid', pmid, collectionId: targetCollectionId };
    } else if (
      raw.toLowerCase().startsWith('isbn:') ||
      /^(97(8|9))?\d{9}(\d|X)$/i.test(raw.replace(/[-\s]/g, ''))
    ) {
      const isbn = raw.replace(/^isbn:/i, '').trim();
      ingestionPayload = { source: 'isbn', isbn, collectionId: targetCollectionId };
    } else if (raw.startsWith('@')) {
      ingestionPayload = { source: 'bibtex', content: raw, collectionId: targetCollectionId };
    } else if (raw.startsWith('TY  -')) {
      ingestionPayload = { source: 'ris', content: raw, collectionId: targetCollectionId };
    } else {
      ingestionPayload = { source: 'url', url: raw, collectionId: targetCollectionId };
    }

    setIsSubmittingLink(true);
    const toastId = toast.loading('Adding reference...', { id: 'add-identifier' });
    try {
      await IngestionService.ingest(effectiveScope, ingestionPayload);
      queryClient.invalidateQueries({ queryKey: itemKeys.all(effectiveScope) });
      if (targetCollectionId) {
        queryClient.invalidateQueries({
          queryKey: itemKeys.byCollection(effectiveScope, targetCollectionId),
        });
      }
      invalidateCollections(queryClient, effectiveScope);
      toast.success('Document imported', {
        description: 'Successfully added to your library.',
        id: toastId,
      });
      closeModal();
    } catch (err: unknown) {
      toast.error('Import failed', {
        description: err instanceof Error ? err.message : 'Could not import reference.',
        id: toastId,
      });
    } finally {
      setIsSubmittingLink(false);
    }
  };

  // 4. Import from Personal Library Modal (When in Project Scope)
  const isImportFromPersonalOpen = activeModal === 'IMPORT_FROM_PERSONAL';

  // 5. Convert Item Type Modal
  const isConvertOpen = activeModal === 'CONVERT_ITEM_TYPE';

  // 6. Merge Duplicates Modal
  const isMergeOpen = activeModal === 'MERGE_DUPLICATES';
  const mergeDuplicates = payload?.items || payload?.duplicates || [];
  const handleMergeDuplicates = async (
    masterPaper: any,
    mergedFields: any,
    duplicateIdsToDelete: string[],
  ) => {
    await QualityService.mergePapers(
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
          defaultParentId={payload?.parentId || null}
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

      {isImportFromPersonalOpen && (
        <ImportFromPersonalModal
          open={isImportFromPersonalOpen}
          onOpenChange={(open) => !open && closeModal()}
          projectId={effectiveScope}
          projectName={activeScope?.name || 'Project'}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: itemKeys.all(effectiveScope) });
            closeModal();
          }}
        />
      )}

      {isConvertOpen && (
        <ConvertModal
          open={isConvertOpen}
          onOpenChange={(open) => !open && closeModal()}
          item={payload?.item}
          targetType={payload?.targetType || 'journalArticle'}
          scopeId={effectiveScope}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: itemKeys.all(effectiveScope) });
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
            queryClient.invalidateQueries({ queryKey: ['items', effectiveScope] });
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
