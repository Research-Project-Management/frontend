'use client';

import React from 'react';
import { useLibraryModalStore } from '../../store/library-modal.store';
import { useLibraryViewStore } from '../../store/library-view.store';
import { useCreateCollectionMutation } from '../../data/collections.queries';
import { useDeleteLibraryItemsMutation } from '../../data/items.queries';
import CreateCollectionModal from '../../components/modals/CreateCollectionModal';
import DeleteModal from '../../components/modals/DeleteModal';

/**
 * LibraryModals Container
 * Mounts all modal dialogs once at the workspace root.
 * Listens to `useLibraryModalStore` so no component has to drill modal props.
 */
export function LibraryModals({ scopeId }: { scopeId?: string }) {
  const activeModal = useLibraryModalStore((s) => s.activeModal);
  const payload = useLibraryModalStore((s) => s.payload);
  const closeModal = useLibraryModalStore((s) => s.closeModal);
  const clearSelection = useLibraryViewStore((s) => s.clearSelection);

  // Mutations
  const createCollectionMutation = useCreateCollectionMutation(scopeId);
  const deleteItemsMutation = useDeleteLibraryItemsMutation(scopeId);

  // 1. Create Collection Modal
  const isCreateCollectionOpen = activeModal === 'CREATE_COLLECTION';
  const handleCreateCollection = async (data: any) => {
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
  const handleDeleteItems = async () => {
    if (itemIdsToDelete.length === 0) return;
    await deleteItemsMutation.mutateAsync(itemIdsToDelete);
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
          defaultParentId={payload?.parentId || null}
        />
      )}

      {isDeleteItemsOpen && (
        <DeleteModal
          open={isDeleteItemsOpen}
          onOpenChange={(open) => !open && closeModal()}
          title="Xác nhận xóa tài liệu"
          description={`Bạn có chắc muốn xóa ${itemIdsToDelete.length} tài liệu đã chọn không?`}
          onConfirm={handleDeleteItems}
          isDeleting={deleteItemsMutation.isPending}
        />
      )}
    </>
  );
}
