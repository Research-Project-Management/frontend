'use client';

import { create } from 'zustand';
import { toast } from 'sonner';
import { clearGroupMergeDraft } from '@/features/library/core/coordinator/curation.coordinator';

export {
  type TrashCommandOptions,
  createTrashCommand,
  type RestoreCommandOptions,
  createRestoreCommand,
  type MoveItemsCommandOptions,
  createMoveItemsCommand,
  type ToggleStarCommandOptions,
  createToggleStarCommand,
  buildInverseMetadataPatch,
  type UpdateItemMetadataCommandParams,
  createUpdateItemMetadataCommand,
  PRE_CONVERSION_BIBLIOGRAPHIC_SCALAR_KEYS,
  buildPreConversionSnapshot,
  type ConvertItemTypeCommandParams,
  createConvertItemTypeCommand,
  type MergeDuplicatesCommandParams,
  createMergeDuplicatesCommand,
  type BatchDetachCommandOptions,
  createBatchDetachCommand,
  type BatchTagToggleItemSnapshot,
  type BatchTagToggleCommandOptions,
  createBatchTagToggleCommand,
  type AddNoteCommandOptions,
  createAddNoteCommand,
  type UpdateNoteCommandOptions,
  createUpdateNoteCommand,
  type DeleteNoteCommandOptions,
  createDeleteNoteCommand,
} from './library-commands.catalog';

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
  currentScopeId: string | null;
}

export interface LibraryCommandActions {
  executeCommand: <T>(command: LibraryCommand<T>, options?: { silentToast?: boolean }) => Promise<T>;
  pushExecutedCommand: <T>(command: LibraryCommand<T>, options?: { silentToast?: boolean }) => void;
  undo: (expectedCommandId?: string) => Promise<boolean>;
  undoById: (commandId: string) => Promise<boolean>;
  redo: (expectedCommandId?: string) => Promise<boolean>;
  clearHistory: () => void;
  clear: () => void;
  setScope: (scopeId?: string | null) => void;
}

const MAX_HISTORY_LENGTH = 30;
let activeExecutionsCount = 0;

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
  currentScopeId: null,

  executeCommand: async <T>(command: LibraryCommand<T>, options: { silentToast?: boolean } = {}): Promise<T> => {
    const ensuredCommand: LibraryCommand<T> = command.id
      ? command
      : {
          ...command,
          id: `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        };
    activeExecutionsCount += 1;
    set({ isExecuting: true });
    const startEpoch = get().epoch;
    try {
      const result = await ensuredCommand.execute();

      activeExecutionsCount = Math.max(0, activeExecutionsCount - 1);
      const stillExecuting = activeExecutionsCount > 0;

      if (get().epoch !== startEpoch) {
        set({ isExecuting: stillExecuting });
        return result;
      }

      set((s) => ({
        undoStack: [
          ensuredCommand,
          ...s.undoStack.filter((c) => c.id !== ensuredCommand.id).slice(0, MAX_HISTORY_LENGTH - 1),
        ],
        redoStack: [], // New command invalidates redo history
        lastCommand: ensuredCommand,
        isExecuting: stillExecuting,
      }));

      if (!options.silentToast) {
        const toastId = ensuredCommand.id.startsWith('trash-') ? 'item-delete' : `cmd-${ensuredCommand.id}`;
        toast.success(ensuredCommand.description, { id: toastId });
      }

      return result;
    } catch (err: unknown) {
      activeExecutionsCount = Math.max(0, activeExecutionsCount - 1);
      set({ isExecuting: activeExecutionsCount > 0 });
      const message = err instanceof Error ? err.message : 'Operation failed';
      toast.error(`Operation failed: ${message}`, { id: `cmd-err-${ensuredCommand.id}` });
      throw err;
    }
  },

  pushExecutedCommand: <T>(command: LibraryCommand<T>, options: { silentToast?: boolean } = {}): void => {
    const ensuredCommand: LibraryCommand<T> = command.id
      ? command
      : {
          ...command,
          id: `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        };
    const startEpoch = get().epoch;
    if (get().epoch !== startEpoch) return;
    set((s) => ({
      undoStack: [
        ensuredCommand,
        ...s.undoStack.filter((c) => c.id !== ensuredCommand.id).slice(0, MAX_HISTORY_LENGTH - 1),
      ],
      redoStack: [],
      lastCommand: ensuredCommand,
    }));

    if (!options.silentToast) {
      const toastId = ensuredCommand.id.startsWith('trash-') ? 'item-delete' : `cmd-${ensuredCommand.id}`;
      toast.success(ensuredCommand.description, { id: toastId });
    }
  },

  undo: async (expectedCommandId?: string): Promise<boolean> => {
    const { undoStack, isUndoing, isExecuting } = get();
    if (undoStack.length === 0 || isUndoing || isExecuting) return false;

    const commandToUndo = expectedCommandId
      ? undoStack.find((c) => c.id === expectedCommandId)
      : undoStack[0];
    if (!commandToUndo) return false;

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

      toast.info(`Undone: ${commandToUndo.description}`, { id: `undo-${commandToUndo.id}` });

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
    activeExecutionsCount += 1;
    set({ isExecuting: true });
    try {
      if (commandToRedo.redo) {
        await commandToRedo.redo();
      } else {
        await commandToRedo.execute();
      }

      if (get().epoch !== startEpoch) {
        activeExecutionsCount = Math.max(0, activeExecutionsCount - 1);
        set({ isExecuting: activeExecutionsCount > 0 });
        return false;
      }

      activeExecutionsCount = Math.max(0, activeExecutionsCount - 1);
      set((s) => ({
        redoStack: s.redoStack.filter((c) => c.id !== commandToRedo.id),
        undoStack: [commandToRedo, ...s.undoStack.slice(0, MAX_HISTORY_LENGTH - 1)],
        lastCommand: commandToRedo,
        isExecuting: activeExecutionsCount > 0,
      }));

      toast.success(`Redone: ${commandToRedo.description}`, { id: `redo-${commandToRedo.id}` });

      return true;
    } catch (err: unknown) {
      activeExecutionsCount = Math.max(0, activeExecutionsCount - 1);
      set({ isExecuting: activeExecutionsCount > 0 });
      const message = err instanceof Error ? err.message : 'Redo failed';
      toast.error(`Redo failed: ${message}`);
      return false;
    }
  },

  clearHistory: () => {
    activeExecutionsCount = 0;
    clearGroupMergeDraft();
    set((s) => ({ undoStack: [], redoStack: [], lastCommand: null, isExecuting: false, isUndoing: false, epoch: s.epoch + 1 }));
  },

  clear: () => {
    get().clearHistory();
  },

  setScope: (scopeId?: string | null) => {
    const normalized = scopeId || 'user';
    if (get().currentScopeId && get().currentScopeId !== normalized) {
      get().clearHistory();
      clearGroupMergeDraft();
    }
    set({ currentScopeId: normalized });
  },
}));

/**
 * useLibraryCommandManager
 * Hook accessor for components & coordinators.
 */
export function useLibraryCommandManager() {
  const executeCommand = useLibraryCommandStore((s) => s.executeCommand);
  const pushExecutedCommand = useLibraryCommandStore((s) => s.pushExecutedCommand);
  const undo = useLibraryCommandStore((s) => s.undo);
  const undoById = useLibraryCommandStore((s) => s.undoById);
  const redo = useLibraryCommandStore((s) => s.redo);
  const clearHistory = useLibraryCommandStore((s) => s.clearHistory);
  const canUndo = useLibraryCommandStore((s) => s.undoStack.length > 0);
  const canRedo = useLibraryCommandStore((s) => s.redoStack.length > 0);
  const isExecuting = useLibraryCommandStore((s) => s.isExecuting);
  const isUndoing = useLibraryCommandStore((s) => s.isUndoing);

  return {
    executeCommand,
    pushExecutedCommand,
    undo,
    undoById,
    redo,
    clearHistory,
    canUndo,
    canRedo,
    isExecuting,
    isUndoing,
  };
}
