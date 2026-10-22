import { useCallback, useRef } from "react";
import { toast } from "sonner";
import { useLibraryUIStore } from "@/features/library/core/store/library-ui.store";
import {
  useLibraryCommandStore,
  createTrashCommand,
  createRestoreCommand,
  createMoveItemsCommand,
} from "@/features/library/core/manager/library-command.manager";
import type { Item } from "@/features/library/domain/types/library.types";

export interface UseLibraryItemOperationsOptions {
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
    mutate: (ids: string[]) => void;
    mutateAsync?: (ids: string[]) => Promise<unknown>;
  };
  restoreMutation: {
    mutate: (ids: string[]) => void;
    mutateAsync?: (ids: string[]) => Promise<unknown>;
  };
  purgeMutation: {
    mutate: (ids: string[]) => void;
  };
  moveMutation: {
    mutateAsync: (args: { targetCollectionId: string | null; itemIds: string[]; scopeId?: string }) => Promise<unknown>;
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
      if (item._isProcessing) return;
      optionsRef.current.toggleStarMutation.mutate({
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
      if (targetItem?._isProcessing) {
        toast.warning(
          "Cannot delete an item that is currently uploading or processing",
          { id: "library-item-guard" },
        );
        return;
      }
      if (opts.isTrash) {
        openModal("DELETE_CONFIRM", { itemIds: [id], permanent: true });
      } else if (opts.deleteMutation.mutateAsync && opts.restoreMutation.mutateAsync) {
        void useLibraryCommandStore.getState().executeCommand(
          createTrashCommand({
            itemIds: [id],
            itemTitle: targetItem?.title,
            deleteMutation: { mutateAsync: opts.deleteMutation.mutateAsync },
            restoreMutation: { mutateAsync: opts.restoreMutation.mutateAsync },
          }),
        );
      } else {
        opts.deleteMutation.mutate([id]);
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
      if (targetItem?._isProcessing) {
        toast.warning(
          "Cannot delete an item that is currently uploading or processing",
          { id: "library-item-guard" },
        );
        return;
      }
      if (opts.onPermanentDeleteItems) {
        opts.onPermanentDeleteItems([id]);
      } else {
        opts.purgeMutation.mutate([id]);
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
      void useLibraryCommandStore.getState().executeCommand(
        createMoveItemsCommand({
          itemIds: [itemId],
          sourceCollectionId: opts.collectionId || null,
          targetCollectionId,
          moveMutation: opts.moveMutation,
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
