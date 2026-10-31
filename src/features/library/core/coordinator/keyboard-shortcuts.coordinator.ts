import { useCallback, useEffect } from "react";
import { toast } from "sonner";
import { useLibraryUIStore } from "@/features/library/core/store/library-ui.store";
import {
  useLibraryCommandStore,
  createTrashCommand,
  createBatchTagToggleCommand,
} from "@/features/library/core/manager/library-command.manager";
import { normalizeTags } from "@/features/library/domain/metadata-mapper";
import {
  isPersistedItemId,
  isPersistedLibraryItem,
} from "@/features/library/domain/library-permissions.policy";
import type { Item } from "@/features/library/domain/types/core.types";

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
  deleteMutation?: { mutateAsync?: (ids: string[]) => Promise<unknown> };
  restoreMutation?: { mutateAsync?: (ids: string[]) => Promise<unknown> };
  updateItemMutation: {
    mutateAsync: (args: { itemId: string; data: { tags: string[] }; silent?: boolean }) => Promise<unknown>;
  };
  lastSelectedIndexRef: React.MutableRefObject<number | null>;
}

export interface KeyboardShortcutCommandContext {
  e: React.KeyboardEvent;
  items: Item[];
  sortedItems: Item[];
  itemsById: Map<string, Item>;
  isTrash?: boolean;
  collectionId?: string;
  scopeTags: Array<{ id: string; name: string; shortcut?: number | null }>;
  onDetachItem?: (id: string) => void;
  handleOpenItem: (itemId: string) => void;
  deleteItems: (ids: string[]) => void;
  deleteMutation?: { mutateAsync?: (ids: string[]) => Promise<unknown> };
  restoreMutation?: { mutateAsync?: (ids: string[]) => Promise<unknown> };
  updateItemMutation: {
    mutateAsync: (args: { itemId: string; data: { tags: string[] }; silent?: boolean }) => Promise<unknown>;
  };
  lastSelectedIndexRef: React.MutableRefObject<number | null>;
  currentIndex: number;
  currentActiveId: string | null;
  currentSelectedIds: Set<string>;
  setActiveItem: (id: string | null) => void;
  toggleSelect: (id: string) => void;
  clearSelection: () => void;
  selectAll: (ids: string[]) => void;
  openModal: (modal: "DELETE_CONFIRM", payload: Record<string, unknown>) => void;
  executeCommand: ReturnType<typeof useLibraryCommandStore.getState>["executeCommand"];
  undoCommand: ReturnType<typeof useLibraryCommandStore.getState>["undo"];
  redoCommand: ReturnType<typeof useLibraryCommandStore.getState>["redo"];
}

export interface KeyboardShortcutCommand {
  id: string;
  matches(ctx: KeyboardShortcutCommandContext): boolean;
  execute(ctx: KeyboardShortcutCommandContext): void;
}

const MODAL_OR_POPUP_SELECTOR =
  '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], [role="combobox"], [data-radix-popper-content-wrapper]';

export function isEditableOrModalElementFocused(
  target?: EventTarget | null,
): boolean {
  if (useLibraryUIStore.getState().activeModal !== null) {
    return true;
  }
  const el =
    (target instanceof HTMLElement ? target : null) ??
    (typeof document !== "undefined" &&
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null);
  if (!el) return false;
  const tag = el.tagName;
  if (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    el.isContentEditable
  ) {
    return true;
  }
  return Boolean(el.closest(MODAL_OR_POPUP_SELECTOR));
}

export const LIBRARY_KEYBINDING_COMMANDS: readonly KeyboardShortcutCommand[] = [
  {
    id: "navigate-down",
    matches: ({ e }) => e.key === "ArrowDown",
    execute: ({ e, currentIndex, sortedItems, setActiveItem, lastSelectedIndexRef }) => {
      e.preventDefault();
      const nextIndex = Math.min(currentIndex + 1, sortedItems.length - 1);
      const nextItem = sortedItems[nextIndex];
      if (nextItem) {
        setActiveItem(nextItem.id);
        lastSelectedIndexRef.current = nextIndex;
      }
    },
  },
  {
    id: "navigate-up",
    matches: ({ e }) => e.key === "ArrowUp",
    execute: ({ e, currentIndex, sortedItems, setActiveItem, lastSelectedIndexRef }) => {
      e.preventDefault();
      const prevIndex = Math.max(currentIndex - 1, 0);
      const prevItem = sortedItems[prevIndex];
      if (prevItem) {
        setActiveItem(prevItem.id);
        lastSelectedIndexRef.current = prevIndex;
      }
    },
  },
  {
    id: "clear-selection",
    matches: ({ e }) => e.key === "Escape",
    execute: ({ e, setActiveItem, clearSelection }) => {
      e.preventDefault();
      setActiveItem(null);
      clearSelection();
    },
  },
  {
    id: "toggle-select",
    matches: ({ e }) => e.key === " ",
    execute: ({ e, currentActiveId, toggleSelect }) => {
      e.preventDefault();
      if (currentActiveId) {
        toggleSelect(currentActiveId);
      }
    },
  },
  {
    id: "open-item",
    matches: ({ e }) => e.key === "Enter",
    execute: ({ e, currentActiveId, isTrash, handleOpenItem }) => {
      e.preventDefault();
      if (currentActiveId && !isTrash) {
        handleOpenItem(currentActiveId);
      }
    },
  },
  {
    id: "delete-or-detach",
    matches: ({ e }) => e.key === "Delete" || e.key === "Backspace",
    execute: ({
      e,
      currentSelectedIds,
      currentActiveId,
      itemsById,
      isTrash,
      openModal,
      onDetachItem,
      collectionId,
      clearSelection,
      deleteMutation,
      restoreMutation,
      executeCommand,
      deleteItems,
    }) => {
      e.preventDefault();
      const rawIds =
        currentSelectedIds.size > 0
          ? Array.from(currentSelectedIds)
          : currentActiveId
            ? [currentActiveId]
            : [];
      const isProcessingItem = (id: string) => {
        const catalogItem = itemsById.get(id);
        return !isPersistedItemId(id) || (catalogItem ? !isPersistedLibraryItem(catalogItem) : false);
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
        } else if (deleteMutation?.mutateAsync && restoreMutation?.mutateAsync) {
          const firstItem = ids.length === 1 ? itemsById.get(ids[0]!) : undefined;
          void executeCommand(
            createTrashCommand({
              itemIds: ids,
              itemTitle: firstItem?.title,
              deleteMutation: { mutateAsync: deleteMutation.mutateAsync },
              restoreMutation: { mutateAsync: restoreMutation.mutateAsync },
              onExecuted: () => {
                clearSelection();
              },
            }),
          );
        } else {
          deleteItems(ids);
          clearSelection();
        }
      }
    },
  },
  {
    id: "select-all",
    matches: ({ e }) => (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a",
    execute: ({ e, items, selectAll }) => {
      e.preventDefault();
      selectAll(items.filter((catalogItem) => isPersistedLibraryItem(catalogItem)).map((catalogItem) => catalogItem.id));
    },
  },
  {
    id: "numeric-tag-shortcut",
    matches: ({ e, isTrash }) =>
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey &&
      /^[1-9]$/.test(e.key) &&
      !isTrash,
    execute: ({
      e,
      scopeTags,
      currentSelectedIds,
      currentActiveId,
      itemsById,
      executeCommand,
      updateItemMutation,
    }) => {
      const shortcutNum = parseInt(e.key, 10);
      const matchedTag = scopeTags.find((t) => t.shortcut === shortcutNum);
      if (!matchedTag) return;

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
        .filter((catalogItem): catalogItem is Item => Boolean(catalogItem && isPersistedLibraryItem(catalogItem)));
      if (targetItems.length === 0) return;

      const tagLower = matchedTag.name.toLowerCase();
      const allHaveTag = targetItems.every((catalogItem) =>
        normalizeTags(catalogItem).some((t) => t.toLowerCase() === tagLower),
      );

      const snapshots = targetItems.map((catalogItem) => {
        const currentTags = normalizeTags(catalogItem);
        const nextTags = allHaveTag
          ? currentTags.filter((t) => t.toLowerCase() !== tagLower)
          : currentTags.some((t) => t.toLowerCase() === tagLower)
            ? currentTags
            : [...currentTags, matchedTag.name];
        return {
          itemId: catalogItem.id,
          previousTags: currentTags,
          nextTags,
        };
      });

      void executeCommand(
        createBatchTagToggleCommand({
          tagName: matchedTag.name,
          action: allHaveTag ? "remove" : "add",
          snapshots,
          updateItemMutation,
        }),
      ).catch(() => undefined);
    },
  },
];

/**
 * useLibraryKeyboardShortcuts
 * Encapsulates desktop-grade keyboard navigation & quick actions (Desktop parity):
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
  deleteMutation,
  restoreMutation,
  updateItemMutation,
  lastSelectedIndexRef,
}: UseLibraryKeyboardShortcutsOptions) {
  const setActiveItem = useLibraryUIStore((s) => s.setActiveItem);
  const toggleSelect = useLibraryUIStore((s) => s.toggleSelect);
  const clearSelection = useLibraryUIStore((s) => s.clearSelection);
  const selectAll = useLibraryUIStore((s) => s.selectAll);
  const openModal = useLibraryUIStore((s) => s.openModal);
  const activeModal = useLibraryUIStore((s) => s.activeModal);
  const currentActiveId = useLibraryUIStore((s) => s.activeItemId);
  const currentSelectedIds = useLibraryUIStore((s) => s.selectedIds);
  const executeCommand = useLibraryCommandStore((s) => s.executeCommand);
  const undoCommand = useLibraryCommandStore((s) => s.undo);
  const redoCommand = useLibraryCommandStore((s) => s.redo);

  // Global Workbench Keymap for Undo (Ctrl+Z) / Redo (Ctrl+Y / Ctrl+Shift+Z)
  // Fires even when DOM focus is on document.body, toolbar, or inspector container
  // (after blurring an input), while respecting native input undo/redo and open dialogs.
  useEffect(() => {
    const handleWindowKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key !== "z" && key !== "y") return;
      if (activeModal !== null || isEditableOrModalElementFocused(e.target)) {
        return;
      }

      e.preventDefault();
      if (key === "y" || (key === "z" && e.shiftKey)) {
        void redoCommand();
      } else {
        void undoCommand();
      }
    };

    window.addEventListener("keydown", handleWindowKeyDown);
    return () => window.removeEventListener("keydown", handleWindowKeyDown);
  }, [activeModal, redoCommand, undoCommand]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        isEditableOrModalElementFocused(target) ||
        (target &&
          (target.tagName === "BUTTON" ||
            target.closest("button") ||
            target.closest('[role="menuitem"]')))
      ) {
        return;
      }
      if (!sortedItems.length) return;
      const currentIndex = sortedItems.findIndex((catalogItem) => catalogItem.id === currentActiveId);

      const ctx: KeyboardShortcutCommandContext = {
        e,
        items,
        sortedItems,
        itemsById,
        isTrash,
        collectionId,
        scopeTags,
        onDetachItem,
        handleOpenItem,
        deleteItems,
        deleteMutation,
        restoreMutation,
        updateItemMutation,
        lastSelectedIndexRef,
        currentIndex,
        currentActiveId,
        currentSelectedIds,
        setActiveItem,
        toggleSelect,
        clearSelection,
        selectAll,
        openModal,
        executeCommand,
        undoCommand,
        redoCommand,
      };

      for (const command of LIBRARY_KEYBINDING_COMMANDS) {
        if (command.matches(ctx)) {
          command.execute(ctx);
          return;
        }
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
      deleteMutation,
      restoreMutation,
      updateItemMutation,
      setActiveItem,
      toggleSelect,
      clearSelection,
      selectAll,
      openModal,
      currentActiveId,
      currentSelectedIds,
      executeCommand,
      undoCommand,
      redoCommand,
      lastSelectedIndexRef,
    ],
  );

  return { handleKeyDown };
}
