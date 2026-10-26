'use client';

import { create } from 'zustand';
import { toast } from 'sonner';

/**
 * Universal Library Command Contract.
 * Encapsulates an operation and its inverse for reliable, optimistic undo/redo.
 */
export interface LibraryCommand<TResult = unknown> {
  readonly id: string;
  readonly description: string;
  readonly timestamp: number;
  execute(): Promise<TResult>;
  undo(): Promise<void>;
  redo?(): Promise<TResult>;
}

export interface LibraryCommandState {
  undoStack: LibraryCommand[];
  redoStack: LibraryCommand[];
  isExecuting: boolean;
  isUndoing: boolean;
  lastCommand: LibraryCommand | null;
  epoch: number;
}

export interface LibraryCommandActions {
  executeCommand: <T>(command: LibraryCommand<T>, options?: { silentToast?: boolean }) => Promise<T>;
  undo: (expectedCommandId?: string) => Promise<boolean>;
  undoById: (commandId: string) => Promise<boolean>;
  redo: (expectedCommandId?: string) => Promise<boolean>;
  clearHistory: () => void;
  clear: () => void;
}

const MAX_HISTORY_LENGTH = 30;

/**
 * LibraryCommandStore
 * Global Command & History Stack Store.
 */
export const useLibraryCommandStore = create<LibraryCommandState & LibraryCommandActions>((set, get) => ({
  undoStack: [],
  redoStack: [],
  isExecuting: false,
  isUndoing: false,
  lastCommand: null,
  epoch: 0,

  executeCommand: async <T>(command: LibraryCommand<T>, options: { silentToast?: boolean } = {}): Promise<T> => {
    const ensuredCommand: LibraryCommand<T> = command.id
      ? command
      : {
          ...command,
          id: `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        };
    set({ isExecuting: true });
    const startEpoch = get().epoch;
    try {
      const result = await ensuredCommand.execute();

      if (get().epoch !== startEpoch) {
        set({ isExecuting: false });
        return result;
      }

      set((s) => ({
        undoStack: [ensuredCommand, ...s.undoStack.slice(0, MAX_HISTORY_LENGTH - 1)],
        redoStack: [], // New command invalidates redo history
        lastCommand: ensuredCommand,
        isExecuting: false,
      }));

      if (!options.silentToast) {
        const toastId = ensuredCommand.id.startsWith('trash-') ? 'item-delete' : `cmd-${ensuredCommand.id}`;
        toast.success(ensuredCommand.description, {
          id: toastId,
          action: {
            label: 'Undo',
            onClick: () => {
              if (get().epoch === startEpoch) {
                void get().undoById(ensuredCommand.id);
              }
            },
          },
        });
      }

      return result;
    } catch (err: unknown) {
      set({ isExecuting: false });
      const message = err instanceof Error ? err.message : 'Operation failed';
      toast.error(`Operation failed: ${message}`, { id: `cmd-err-${ensuredCommand.id}` });
      throw err;
    }
  },

  undo: async (expectedCommandId?: string): Promise<boolean> => {
    const { undoStack, isUndoing, isExecuting } = get();
    if (undoStack.length === 0 || isUndoing || isExecuting) return false;

    const commandToUndo = undoStack[0];
    if (!commandToUndo) return false;
    if (expectedCommandId && commandToUndo.id !== expectedCommandId) {
      return false;
    }

    const startEpoch = get().epoch;
    set({ isUndoing: true });
    try {
      await commandToUndo.undo();

      if (get().epoch !== startEpoch) {
        set({ isUndoing: false });
        return false;
      }

      set((s) => ({
        undoStack: s.undoStack.filter((c) => c.id !== commandToUndo.id),
        redoStack: [commandToUndo, ...s.redoStack.slice(0, MAX_HISTORY_LENGTH - 1)],
        lastCommand: commandToUndo,
        isUndoing: false,
      }));

      toast.info(`Undone: ${commandToUndo.description}`, {
        id: `undo-${commandToUndo.id}`,
        action: {
          label: 'Redo',
          onClick: () => {
            if (get().epoch === startEpoch) {
              void get().redo(commandToUndo.id);
            }
          },
        },
      });

      return true;
    } catch (err: unknown) {
      set({ isUndoing: false });
      const message = err instanceof Error ? err.message : 'Undo failed';
      toast.error(`Undo failed: ${message}`);
      return false;
    }
  },

  undoById: async (commandId: string): Promise<boolean> => {
    return get().undo(commandId);
  },

  redo: async (expectedCommandId?: string): Promise<boolean> => {
    const { redoStack, isExecuting, isUndoing } = get();
    if (redoStack.length === 0 || isExecuting || isUndoing) return false;

    const commandToRedo = redoStack[0];
    if (!commandToRedo) return false;
    if (expectedCommandId && commandToRedo.id !== expectedCommandId) {
      return false;
    }

    const startEpoch = get().epoch;
    set({ isExecuting: true });
    try {
      if (commandToRedo.redo) {
        await commandToRedo.redo();
      } else {
        await commandToRedo.execute();
      }

      if (get().epoch !== startEpoch) {
        set({ isExecuting: false });
        return false;
      }

      set((s) => ({
        redoStack: s.redoStack.filter((c) => c.id !== commandToRedo.id),
        undoStack: [commandToRedo, ...s.undoStack.slice(0, MAX_HISTORY_LENGTH - 1)],
        lastCommand: commandToRedo,
        isExecuting: false,
      }));

      toast.success(`Redone: ${commandToRedo.description}`, {
        id: `redo-${commandToRedo.id}`,
        action: {
          label: 'Undo',
          onClick: () => {
            if (get().epoch === startEpoch) {
              void get().undoById(commandToRedo.id);
            }
          },
        },
      });

      return true;
    } catch (err: unknown) {
      set({ isExecuting: false });
      const message = err instanceof Error ? err.message : 'Redo failed';
      toast.error(`Redo failed: ${message}`);
      return false;
    }
  },

  clearHistory: () => {
    set((s) => ({
      undoStack: [],
      redoStack: [],
      lastCommand: null,
      epoch: s.epoch + 1,
    }));
  },

  clear: () => {
    set((s) => ({
      undoStack: [],
      redoStack: [],
      lastCommand: null,
      epoch: s.epoch + 1,
    }));
  },
}));

/**
 * useLibraryCommandManager
 * Hook accessor for components & coordinators.
 */
export function useLibraryCommandManager() {
  const executeCommand = useLibraryCommandStore((s) => s.executeCommand);
  const undo = useLibraryCommandStore((s) => s.undo);
  const undoById = useLibraryCommandStore((s) => s.undoById);
  const redo = useLibraryCommandStore((s) => s.redo);
  const clearHistory = useLibraryCommandStore((s) => s.clearHistory);
  const clear = useLibraryCommandStore((s) => s.clear);
  const canUndo = useLibraryCommandStore((s) => s.undoStack.length > 0);
  const canRedo = useLibraryCommandStore((s) => s.redoStack.length > 0);
  const isExecuting = useLibraryCommandStore((s) => s.isExecuting);
  const isUndoing = useLibraryCommandStore((s) => s.isUndoing);

  return {
    executeCommand,
    undo,
    undoById,
    redo,
    clearHistory,
    clear,
    canUndo,
    canRedo,
    isExecuting,
    isUndoing,
  };
}

// ---------------------------------------------------------------------------
// Concrete Command Factories
// ---------------------------------------------------------------------------

export interface TrashCommandOptions {
  itemIds: string[];
  itemTitle?: string;
  deleteMutation: { mutateAsync: (ids: string[]) => Promise<unknown> };
  restoreMutation: { mutateAsync: (ids: string[]) => Promise<unknown> };
  onExecuted?: () => void;
  onUndone?: () => void;
}

export function createTrashCommand(options: TrashCommandOptions): LibraryCommand {
  const count = options.itemIds.length;
  const description =
    count === 1
      ? 'Item moved to trash'
      : `Moved ${count} items to trash`;

  return {
    id: `trash-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    description,
    timestamp: Date.now(),
    execute: async () => {
      await options.deleteMutation.mutateAsync(options.itemIds);
      options.onExecuted?.();
    },
    undo: async () => {
      await options.restoreMutation.mutateAsync(options.itemIds);
      options.onUndone?.();
    },
  };
}

export const createDeleteItemsCommand = createTrashCommand;

export interface RestoreCommandOptions {
  itemIds: string[];
  itemTitle?: string;
  restoreMutation: { mutateAsync: (ids: string[]) => Promise<unknown> };
  deleteMutation: { mutateAsync: (ids: string[]) => Promise<unknown> };
  onExecuted?: () => void;
  onUndone?: () => void;
}

export function createRestoreCommand(options: RestoreCommandOptions): LibraryCommand {
  const count = options.itemIds.length;
  const description =
    count === 1 && options.itemTitle
      ? `Restored "${options.itemTitle}"`
      : count === 1
        ? 'Restored 1 item'
        : `Restored ${count} items`;

  return {
    id: `restore-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    description,
    timestamp: Date.now(),
    execute: async () => {
      await options.restoreMutation.mutateAsync(options.itemIds);
      options.onExecuted?.();
    },
    undo: async () => {
      await options.deleteMutation.mutateAsync(options.itemIds);
      options.onUndone?.();
    },
  };
}

export interface MoveItemsCommandOptions {
  itemIds: string[];
  sourceCollectionId: string | null;
  targetCollectionId: string | null;
  targetCollectionName?: string;
  previousCollectionsByItem?: Map<string, string[]>;
  onUndoMove?: () => Promise<void>;
  detachMutation?: {
    mutateAsync: (args: { collectionId: string; itemIds: string[] }) => Promise<unknown>;
  };
  assignMutation?: {
    mutateAsync: (args: { collectionId: string; itemIds: string[] }) => Promise<unknown>;
  };
  moveMutation: {
    mutateAsync: (args: {
      targetCollectionId: string | null;
      itemIds: string[];
      sourceCollectionId?: string | null;
      scopeId?: string;
    }) => Promise<unknown>;
  };
  scopeId?: string;
  onExecuted?: () => void;
  onUndone?: () => void;
}

export function createMoveItemsCommand(options: MoveItemsCommandOptions): LibraryCommand {
  const count = options.itemIds.length;
  const destName = options.targetCollectionName || 'collection';
  const description = `Moved ${count} ${count === 1 ? 'item' : 'items'} to ${destName}`;

  return {
    id: `move-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    description,
    timestamp: Date.now(),
    execute: async () => {
      await options.moveMutation.mutateAsync({
        targetCollectionId: options.targetCollectionId,
        itemIds: options.itemIds,
        sourceCollectionId: options.sourceCollectionId,
        scopeId: options.scopeId,
      });
      options.onExecuted?.();
    },
    undo: async () => {
      if (options.onUndoMove) {
        await options.onUndoMove();
        options.onUndone?.();
        return;
      }

      if (options.sourceCollectionId && options.sourceCollectionId !== 'unfiled') {
        await options.moveMutation.mutateAsync({
          targetCollectionId: options.sourceCollectionId,
          itemIds: options.itemIds,
          sourceCollectionId: options.targetCollectionId,
          scopeId: options.scopeId,
        });
        options.onUndone?.();
        return;
      }

      // When moved from "All Papers" (sourceCollectionId = null), restore exact previous collections
      // or detach from targetCollectionId without stripping unrelated collection memberships via 'unfiled'.
      if (options.previousCollectionsByItem && options.previousCollectionsByItem.size > 0) {
        if (options.targetCollectionId && options.detachMutation) {
          const itemsNotPreviouslyInTarget = options.itemIds.filter((id) => {
            const prevCols = options.previousCollectionsByItem?.get(id) || [];
            return !prevCols.includes(options.targetCollectionId!);
          });
          if (itemsNotPreviouslyInTarget.length > 0) {
            await options.detachMutation.mutateAsync({
              collectionId: options.targetCollectionId,
              itemIds: itemsNotPreviouslyInTarget,
            });
          }
        }
        if (options.assignMutation) {
          const collectionToItems = new Map<string, string[]>();
          for (const [id, prevCols] of options.previousCollectionsByItem.entries()) {
            for (const colId of prevCols) {
              if (!colId || colId === options.targetCollectionId) continue;
              const list = collectionToItems.get(colId) || [];
              list.push(id);
              collectionToItems.set(colId, list);
            }
          }
          for (const [colId, ids] of collectionToItems.entries()) {
            await options.assignMutation.mutateAsync({
              collectionId: colId,
              itemIds: ids,
            });
          }
        }
        options.onUndone?.();
        return;
      }

      if (options.targetCollectionId && options.detachMutation) {
        await options.detachMutation.mutateAsync({
          collectionId: options.targetCollectionId,
          itemIds: options.itemIds,
        });
        options.onUndone?.();
        return;
      }

      await options.moveMutation.mutateAsync({
        targetCollectionId: options.sourceCollectionId,
        itemIds: options.itemIds,
        sourceCollectionId: options.targetCollectionId,
        scopeId: options.scopeId,
      });
      options.onUndone?.();
    },
  };
}

export interface ToggleStarCommandOptions {
  itemId: string;
  itemTitle?: string;
  newStarred: boolean;
  toggleStarMutation: {
    mutateAsync: (args: { id: string; isStarred: boolean }) => Promise<unknown>;
  };
  onExecuted?: () => void;
  onUndone?: () => void;
}

export function createToggleStarCommand(options: ToggleStarCommandOptions): LibraryCommand {
  const actionText = options.newStarred ? 'Starred' : 'Unstarred';
  const description = options.itemTitle ? `${actionText} "${options.itemTitle}"` : actionText;

  return {
    id: `star-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    description,
    timestamp: Date.now(),
    execute: async () => {
      await options.toggleStarMutation.mutateAsync({
        id: options.itemId,
        isStarred: options.newStarred,
      });
      options.onExecuted?.();
    },
    undo: async () => {
      await options.toggleStarMutation.mutateAsync({
        id: options.itemId,
        isStarred: !options.newStarred,
      });
      options.onUndone?.();
    },
  };
}
