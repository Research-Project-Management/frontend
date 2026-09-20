'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { useLibraryModalStore, useLibraryViewStore } from '../../store';
import { useCreateCollectionMutation, useDeleteLibraryItemsMutation } from '../../data';
import type { CollectionFormValues } from '../../types';

const CreateCollectionModal = dynamic(() => import('./CreateCollectionModal'), { ssr: false });
const DeleteModal = dynamic(() => import('./DeleteModal'), { ssr: false });

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
          title="Delete Items"
          description={`Are you sure you want to delete ${itemIdsToDelete.length} selected ${itemIdsToDelete.length === 1 ? 'item' : 'items'}?`}
          onConfirm={handleDeleteItems}
          isDeleting={deleteItemsMutation.isPending}
        />
      )}
    </>
  );
}
