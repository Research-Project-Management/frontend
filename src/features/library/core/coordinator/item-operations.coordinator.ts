import { useCallback, useRef } from "react";
import { toast } from "sonner";
import { useLibraryUIStore } from "@/features/library/core/store/library-ui.store";
import {
  useLibraryCommandStore,
  createTrashCommand,
  createRestoreCommand,
  createMoveItemsCommand,
  createToggleStarCommand,
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
      if (
        item._isProcessing ||
        item.id.startsWith('temp-') ||
        item.id.startsWith('provisional-')
      ) return;
      const toggleStarMutation = optionsRef.current.toggleStarMutation;
      if (toggleStarMutation.mutateAsync) {
        void useLibraryCommandStore.getState().executeCommand(
          createToggleStarCommand({
            itemId: item.id,
            itemTitle: item.title,
            newStarred: !isStarred,
            toggleStarMutation: { mutateAsync: toggleStarMutation.mutateAsync },
          }),
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
        Boolean(targetItem?._isProcessing) ||
        id.startsWith('temp-') ||
        id.startsWith('provisional-');
      if (isProcessing) {
        toast.warning(
          "Cannot delete an item that is currently uploading or processing",
          { id: "library-item-guard" },
        );
        return;
      }

      const clearSelectionIfAffected = () => {
        const state = useLibraryUIStore.getState();
        if (state.activeItemId === id) {
          state.setActiveItem(null);
        }
        if (state.selectedIds.has(id)) {
          state.toggleSelect(id);
        }
      };

      if (opts.isTrash) {
        clearSelectionIfAffected();
        openModal("DELETE_CONFIRM", { itemIds: [id], permanent: true });
      } else if (opts.deleteMutation.mutateAsync && opts.restoreMutation.mutateAsync) {
        clearSelectionIfAffected();
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
        );
      } else {
        clearSelectionIfAffected();
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
      const isProcessing =
        Boolean(targetItem?._isProcessing) ||
        id.startsWith('temp-') ||
        id.startsWith('provisional-');
      if (isProcessing) {
        toast.warning(
          "Cannot delete an item that is currently uploading or processing",
          { id: "library-item-guard" },
        );
        return;
      }
      const state = useLibraryUIStore.getState();
      if (state.activeItemId === id) {
        state.setActiveItem(null);
      }
      if (state.selectedIds.has(id)) {
        state.toggleSelect(id);
      }
      if (opts.onPermanentDeleteItems) {
        useLibraryCommandStore.getState().clear();
        opts.onPermanentDeleteItems([id]);
      } else {
        useLibraryCommandStore.getState().clear();
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
      const targetItem = opts.itemsById.get(itemId);
      const previousCollectionsByItem = new Map<string, string[]>();
      if (targetItem && Array.isArray(targetItem.collectionIds)) {
        previousCollectionsByItem.set(itemId, [...targetItem.collectionIds]);
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
