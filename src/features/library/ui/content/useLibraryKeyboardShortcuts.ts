import { useCallback } from "react";
import { toast } from "sonner";
import { useLibraryUIStore } from "@/features/library/core/store/library-ui.store";
import { useLibraryCommandStore } from "@/features/library/core/manager/library-command.manager";
import { normalizeTags } from "@/features/library/domain/metadata";
import type { Item } from "@/features/library/domain/types/library.types";

export interface UseLibraryKeyboardShortcutsOptions {
  items: Item[];
  sortedItems: Item[];
  itemsById: Map<string, Item>;
  isTrash?: boolean;
  collectionId?: string;
  scopeTags?: Array<{ id: string; name: string; shortcut?: number | null }>;
  onDetachItem?: (id: string) => void;
  handleOpenItem: (itemId: string) => void;
  deleteItems: (ids: string[]) => void;
  updateItemMutation: {
    mutateAsync: (args: { itemId: string; data: { tags: string[] }; silent?: boolean }) => Promise<unknown>;
  };
  lastSelectedIndexRef: React.MutableRefObject<number | null>;
}

/**
 * useLibraryKeyboardShortcuts
 * Encapsulates desktop-grade keyboard navigation & quick actions (Zotero parity):
 * - ArrowUp / ArrowDown: Row selection & navigation
 * - Space: Toggle checkbox selection
 * - Enter: Open paper detail
 * - Escape: Clear selection / blur
 * - Delete / Backspace: Remove from collection or trash items (with processing item protection)
 * - Ctrl+A / Cmd+A: Select all items
 * - 1-9: Instant numeric tag shortcut toggle
 */
export function useLibraryKeyboardShortcuts({
  items,
  sortedItems,
  itemsById,
  isTrash,
  collectionId,
  scopeTags = [],
  onDetachItem,
  handleOpenItem,
  deleteItems,
  updateItemMutation,
  lastSelectedIndexRef,
}: UseLibraryKeyboardShortcutsOptions) {
  const setActiveItem = useLibraryUIStore((s) => s.setActiveItem);
  const toggleSelect = useLibraryUIStore((s) => s.toggleSelect);
  const clearSelection = useLibraryUIStore((s) => s.clearSelection);
  const selectAll = useLibraryUIStore((s) => s.selectAll);
  const openModal = useLibraryUIStore((s) => s.openModal);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!sortedItems.length) return;
      const currentActiveId = useLibraryUIStore.getState().activeItemId;
      const currentIndex = sortedItems.findIndex((it) => it.id === currentActiveId);

      if (e.key === "ArrowDown") {
        e.preventDefault();
        const nextIndex = Math.min(currentIndex + 1, sortedItems.length - 1);
        const nextItem = sortedItems[nextIndex];
        if (nextItem) {
          setActiveItem(nextItem.id);
          lastSelectedIndexRef.current = nextIndex;
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const prevIndex = Math.max(currentIndex - 1, 0);
        const prevItem = sortedItems[prevIndex];
        if (prevItem) {
          setActiveItem(prevItem.id);
          lastSelectedIndexRef.current = prevIndex;
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        setActiveItem(null);
        clearSelection();
      } else if (e.key === " ") {
        e.preventDefault();
        if (currentActiveId) {
          toggleSelect(currentActiveId);
        }
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (currentActiveId && !isTrash) {
          handleOpenItem(currentActiveId);
        }
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        const currentSelectedIds = useLibraryUIStore.getState().selectedIds;
        const rawIds =
          currentSelectedIds.size > 0
            ? Array.from(currentSelectedIds)
            : currentActiveId
              ? [currentActiveId]
              : [];
        const isProcessingItem = (id: string) => {
          const it = itemsById.get(id);
          return Boolean(
            it?._isProcessing ||
              id.startsWith("temp-") ||
              id.startsWith("provisional-"),
          );
        };
        const hasProcessing = rawIds.some(isProcessingItem);
        if (hasProcessing) {
          toast.warning(
            "Cannot delete or remove items that are currently uploading or processing",
            { id: "library-item-guard" },
          );
        }
        const ids = rawIds.filter((id) => !isProcessingItem(id));
        if (ids.length > 0) {
          if (isTrash) {
            openModal("DELETE_CONFIRM", { itemIds: ids, permanent: true });
          } else if (onDetachItem && collectionId && !e.shiftKey) {
            ids.forEach((id) => onDetachItem(id));
            clearSelection();
          } else {
            deleteItems(ids);
            clearSelection();
          }
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          void useLibraryCommandStore.getState().redo();
        } else {
          void useLibraryCommandStore.getState().undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        void useLibraryCommandStore.getState().redo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
        e.preventDefault();
        selectAll(items.map((it) => it.id));
      } else if (
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        /^[1-9]$/.test(e.key) &&
        !isTrash
      ) {
        const shortcutNum = parseInt(e.key, 10);
        const matchedTag = scopeTags.find((t) => t.shortcut === shortcutNum);
        if (!matchedTag) return;

        const currentSelectedIds = useLibraryUIStore.getState().selectedIds;
        const targetIds =
          currentSelectedIds.size > 0
            ? Array.from(currentSelectedIds)
            : currentActiveId
              ? [currentActiveId]
              : [];
        if (targetIds.length === 0) return;

        e.preventDefault();
        const targetItems = targetIds
          .map((id) => itemsById.get(id))
          .filter((it): it is Item => Boolean(it && !it._isProcessing));
        if (targetItems.length === 0) return;

        const tagLower = matchedTag.name.toLowerCase();
        const allHaveTag = targetItems.every((it) =>
          normalizeTags(it).some((t) => t.toLowerCase() === tagLower),
        );

        void (async () => {
          try {
            await Promise.all(
              targetItems.map((it) => {
                const currentTags = normalizeTags(it);
                const nextTags = allHaveTag
                  ? currentTags.filter((t) => t.toLowerCase() !== tagLower)
                  : currentTags.some((t) => t.toLowerCase() === tagLower)
                    ? currentTags
                    : [...currentTags, matchedTag.name];
                return updateItemMutation.mutateAsync({
                  itemId: it.id,
                  data: { tags: nextTags },
                  silent: true,
                });
              }),
            );
            toast.success(
              allHaveTag
                ? `Removed tag "${matchedTag.name}"`
                : `Applied tag "${matchedTag.name}"`,
              { id: "shortcut-tag" },
            );
          } catch {
            toast.error("Failed to update tags");
          }
        })();
      }
    },
    [
      sortedItems,
      items,
      itemsById,
      isTrash,
      collectionId,
      scopeTags,
      onDetachItem,
      handleOpenItem,
      deleteItems,
      updateItemMutation,
      setActiveItem,
      toggleSelect,
      clearSelection,
      selectAll,
      openModal,
      lastSelectedIndexRef,
    ],
  );

  return { handleKeyDown };
}
