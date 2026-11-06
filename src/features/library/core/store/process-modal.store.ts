import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  IngestionProgressItem,
  IngestionProgressResponse,
  IngestionRunStatus,
  ProcessingFileItem,
  ProcessModalState,
  ProcessBatchUploadOptions,
  ProcessModalStoreAdapter,
} from '@/features/library/domain/types/ingestion.types';
import { cleanFilenameToTitle } from '@/features/library/domain/metadata.mapper';

export type BatchUploadExecutor = (
  files: File[],
  options: ProcessBatchUploadOptions,
  store: ProcessModalStoreAdapter,
) => Promise<void>;

let registeredBatchUploadExecutor: BatchUploadExecutor | null = null;

export function registerBatchUploadExecutor(executor: BatchUploadExecutor): void {
  registeredBatchUploadExecutor = executor;
}

export { cleanFilenameToTitle };
export type {
  ProcessModalState,
  ProcessingFileItem,
  ProcessBatchUploadOptions,
  IngestionRunStatus,
  ProcessModalStoreAdapter,
};

// ---------------------------------------------------------------------------
// Explicit Finite State Machine (FSM) Selectors & Transition Guards (FE-P3)
// ---------------------------------------------------------------------------

type ProcessModalPhase =
  | 'IDLE'
  | 'RUNNING'
  | 'COMPLETED'
  | 'PARTIAL_FAILURE'
  | 'FAILED'
  | 'ABORTED';

type ProcessModalDisplayMode = 'HIDDEN' | 'EXPANDED' | 'MINIMIZED_PILL';

type ProcessItemStage = 'PENDING' | 'ACTIVE' | 'SUCCEEDED' | 'FAILED';

const TERMINAL_SUCCESS_ITEM_STATUSES = new Set<string>(['SUCCEEDED', 'COMPLETED', 'READY']);
const TERMINAL_FAILED_ITEM_STATUSES = new Set<string>([
  'FAILED',
  'FAILED_FINAL',
  'FAILED_RETRYABLE',
  'CANCELLED',
]);
const ACTIVE_ITEM_STATUSES = new Set<string>(['PROCESSING', 'RUNNING', 'UPLOADING']);

/**
 * Pure FSM state resolver deriving the lifecycle phase of the batch ingestion run.
 */
export function deriveProcessModalPhase(state: ProcessModalState): ProcessModalPhase {
  if (!state.data && !state.isOpen && !state.isMinimized && !state.isComplete && !state.error) {
    return 'IDLE';
  }
  if (state.error) {
    if (/cancelled|aborted/i.test(state.error)) {
      return 'ABORTED';
    }
    return 'FAILED';
  }
  if (!state.isComplete) {
    return 'RUNNING';
  }
  const failed = state.data?.failed ?? 0;
  const succeeded = state.data?.succeeded ?? 0;
  const total = state.data?.total ?? 0;
  if (total > 0 && failed >= total) {
    return 'FAILED';
  }
  if (failed > 0 && succeeded > 0) {
    return 'PARTIAL_FAILURE';
  }
  return 'COMPLETED';
}

/**
 * Pure FSM display mode resolver determining how `ProcessModal` should be rendered.
 */
export function deriveProcessModalDisplayMode(
  state: ProcessModalState,
): ProcessModalDisplayMode {
  if (state.isMinimized && !state.isOpen) {
    return 'MINIMIZED_PILL';
  }
  if (state.isOpen) {
    return 'EXPANDED';
  }
  return 'HIDDEN';
}

/**
 * Pure FSM item stage classifier for individual rows in `ProcessModal`.
 */
export function classifyProcessItemStage(
  item: Pick<IngestionProgressItem, 'status'>,
  batchPhase: ProcessModalPhase,
  isFirstNonTerminal = false,
): ProcessItemStage {
  const status = String(item.status || '').toUpperCase();
  if (TERMINAL_FAILED_ITEM_STATUSES.has(status)) {
    return 'FAILED';
  }
  if (TERMINAL_SUCCESS_ITEM_STATUSES.has(status)) {
    return 'SUCCEEDED';
  }
  if (batchPhase === 'COMPLETED' || batchPhase === 'PARTIAL_FAILURE') {
    return 'SUCCEEDED';
  }
  if (
    batchPhase === 'RUNNING' &&
    (ACTIVE_ITEM_STATUSES.has(status) || isFirstNonTerminal)
  ) {
    return 'ACTIVE';
  }
  return 'PENDING';
}

function recalculateBatchProgressData(
  baseData: IngestionProgressResponse,
  items: IngestionProgressItem[],
  fallbackTotal?: number,
): IngestionProgressResponse {
  const total = items.length || fallbackTotal || baseData.total || 0;
  const succeeded = items.filter((i) => TERMINAL_SUCCESS_ITEM_STATUSES.has(String(i.status || '').toUpperCase())).length;
  const failed = items.filter((i) => TERMINAL_FAILED_ITEM_STATUSES.has(String(i.status || '').toUpperCase())).length;
  const processed = succeeded + failed;
  const percentage = total > 0 ? Math.round((processed / total) * 100) : 100;
  return {
    ...baseData,
    items,
    total,
    succeeded,
    failed,
    processed,
    percentage,
  };
}

interface ProcessModalStore {
  state: ProcessModalState;
  processingItems: ProcessingFileItem[];
  addProcessingItem: (item: ProcessingFileItem) => void;
  updateProcessingItem: (id: string, updates: Partial<ProcessingFileItem>) => void;
  dismissProcessingItem: (id: string) => void;
  clearProcessingItemsByIds: (ids: Iterable<string>) => void;
  initializeBatchRun: (
    runId: string,
    fileName: string,
    items: IngestionProgressItem[],
    autoMinimizeOrOptions?:
      | boolean
      | {
          autoMinimize?: boolean;
          scopeId?: string;
          currentTitle?: string;
          initialProcessingItems?: ProcessingFileItem[];
        },
  ) => void;
  applyServerRunSnapshot: (run: Partial<IngestionRunStatus>, fallbackTotal?: number) => void;
  patchBatchItemAndRecalculate: (
    matcher: string | number,
    patch: Partial<IngestionProgressItem>,
    options?: {
      currentTitle?: string;
      processingPatch?: Partial<ProcessingFileItem>;
      removeProcessingItem?: boolean;
    },
  ) => void;
  completeBatchRun: (error?: string | null, provisionalIdsToRemove?: Iterable<string>) => void;
  updateItem: (index: number, patch: Partial<IngestionProgressItem>) => void;
  startBatchUpload: (
    files: File[],
    options: ProcessBatchUploadOptions,
  ) => Promise<void>;
  closeModal: () => void;
  minimizeModal: () => void;
  restoreModal: () => void;
}

const initialModalState: ProcessModalState = {
  isOpen: false,
  isMinimized: false,
  runId: null,
  fileName: '',
  data: null,
  isComplete: false,
  error: null,
};

/**
 * Lean Zustand UI Store for Library Ingestion and Process Dialogs.
 * Adheres strictly to Clean Architecture by decoupling UI state management
 * from asynchronous upload transport and notification side effects.
 */
let activeBatchAbortController: AbortController | null = null;
let activeBatchUploadsCount = 0;

export const useProcessModalStore = create<ProcessModalStore>()(
  persist(
    (set, get) => ({
  state: initialModalState,
  processingItems: [],

  addProcessingItem: (item: ProcessingFileItem) => {
    set((s) => ({
      processingItems: [
        ...s.processingItems.filter((p) => p.id !== item.id),
        item,
      ],
    }));
  },

  updateProcessingItem: (id: string, updates: Partial<ProcessingFileItem>) => {
    set((s) => ({
      processingItems: s.processingItems.map((p) =>
        p.id === id ? { ...p, ...updates } : p,
      ),
    }));
  },

  dismissProcessingItem: (id: string) => {
    set((s) => ({
      processingItems: s.processingItems.filter((p) => p.id !== id),
    }));
  },

  clearProcessingItemsByIds: (ids: Iterable<string>) => {
    const idSet = new Set(ids);
    if (idSet.size === 0) return;
    set((s) => ({
      processingItems: s.processingItems.filter((p) => !idSet.has(p.id)),
    }));
  },

  initializeBatchRun: (runId, fileName, items, autoMinimizeOrOptions) => {
    const opts =
      typeof autoMinimizeOrOptions === 'boolean'
        ? { autoMinimize: autoMinimizeOrOptions }
        : (autoMinimizeOrOptions ?? {});
    const initialProcessingItems = opts.initialProcessingItems ?? [];

    set((s) => {
      const hasActiveBatch = Boolean(!s.state.isComplete && s.state.data && s.state.data.items.length > 0);
      const mergedItems = hasActiveBatch ? [...s.state.data!.items, ...items] : items;
      const baseData: IngestionProgressResponse = {
        runId: hasActiveBatch ? s.state.data!.runId : runId,
        scopeId: opts.scopeId ?? s.state.data?.scopeId ?? 'user',
        status: 'PROCESSING',
        total: mergedItems.length,
        processed: 0,
        percentage: 0,
        succeeded: 0,
        duplicates: hasActiveBatch ? s.state.data!.duplicates : 0,
        failed: 0,
        currentTitle: opts.currentTitle || items[0]?.title || fileName,
        items: mergedItems,
        startedAt: hasActiveBatch ? s.state.data!.startedAt : new Date().toISOString(),
      };
      const recalculated = recalculateBatchProgressData(baseData, mergedItems, mergedItems.length);
      const isMinimized = opts.autoMinimize ?? (hasActiveBatch ? s.state.isMinimized : false);

      return {
        ...(initialProcessingItems.length > 0
          ? {
              processingItems: [
                ...s.processingItems.filter(
                  (p) =>
                    !initialProcessingItems.some(
                      (n) => n.fileName === p.fileName && n.fileSize === p.fileSize,
                    ),
                ),
                ...initialProcessingItems,
              ],
            }
          : {}),
        state: {
          isOpen: !isMinimized,
          isMinimized,
          runId: hasActiveBatch ? s.state.runId || runId : runId,
          fileName: recalculated.total === 1 ? (mergedItems[0]?.title || fileName) : `${recalculated.total} documents`,
          isComplete: false,
          error: null,
          data: recalculated,
        },
      };
    });
  },

  applyServerRunSnapshot: (run, fallbackTotal = 0) => {
    set((s) => {
      const currentData = s.state.data;
      const rawStatus = String(run.status || currentData?.status || '').toUpperCase();
      const isTerminal =
        TERMINAL_SUCCESS_ITEM_STATUSES.has(rawStatus) || TERMINAL_FAILED_ITEM_STATUSES.has(rawStatus);

      if (!currentData) {
        if (!isTerminal) return s;
        return {
          state: {
            ...s.state,
            isComplete: true,
            error: run.lastError || run.errorMessage || s.state.error,
          },
        };
      }

      const incomingItems = Array.isArray(run.items) ? run.items : null;
      const mergedItems = incomingItems && incomingItems.length > 0
        ? currentData.items.map((it) => {
            const trimmedItTitle = it.title?.trim();
            const match = incomingItems.find((pi) => {
              if (pi.id && it.id && pi.id === it.id) return true;
              const trimmedPiTitle = pi.title?.trim();
              return Boolean(
                trimmedPiTitle &&
                  trimmedItTitle &&
                  (trimmedPiTitle === trimmedItTitle || trimmedPiTitle.includes(trimmedItTitle)),
              );
            });
            return match
              ? {
                  ...it,
                  ...match,
                  status: (match.status || it.status) as IngestionProgressItem['status'],
                  title: match.title || it.title,
                }
              : it;
          })
        : currentData.items;

      const recalculated = recalculateBatchProgressData(
        currentData,
        mergedItems,
        fallbackTotal || run.total || run.totalItems || currentData.total,
      );

      return {
        state: {
          ...s.state,
          isComplete: isTerminal ? true : s.state.isComplete,
          error: run.lastError || run.errorMessage || s.state.error,
          data: {
            ...recalculated,
            status: isTerminal
              ? (TERMINAL_FAILED_ITEM_STATUSES.has(rawStatus) ? 'FAILED_FINAL' : 'COMPLETED')
              : (run.status || recalculated.status),
            percentage: isTerminal ? 100 : recalculated.percentage,
          },
        },
      };
    });
  },

  patchBatchItemAndRecalculate: (matcher, patch, options) => {
    set((s) => {
      const targetId =
        typeof matcher === 'string'
          ? matcher
          : s.state.data?.items[matcher]?.id;
      const nextProcessingItems = options?.removeProcessingItem && targetId
        ? s.processingItems.filter((p) => p.id !== targetId)
        : options?.processingPatch && targetId
          ? s.processingItems.map((p) => (p.id === targetId ? { ...p, ...options.processingPatch } : p))
          : s.processingItems;

      if (!s.state.data) {
        return { processingItems: nextProcessingItems };
      }

      const items = s.state.data.items.map((item, idx) => {
        const isMatch = typeof matcher === 'string' ? item.id === matcher : idx === matcher;
        return isMatch ? { ...item, ...patch } : item;
      });
      const recalculated = recalculateBatchProgressData(s.state.data, items);

      return {
        processingItems: nextProcessingItems,
        state: {
          ...s.state,
          data: {
            ...recalculated,
            ...(options?.currentTitle !== undefined ? { currentTitle: options.currentTitle } : {}),
          },
        },
      };
    });
  },

  completeBatchRun: (error, provisionalIdsToRemove) => {
    const removeSet = provisionalIdsToRemove ? new Set(provisionalIdsToRemove) : null;
    set((s) => {
      const remainingProvisional = removeSet
        ? s.processingItems.filter((p) => !removeSet.has(p.id))
        : s.processingItems;
      const currentData = s.state.data;
      if (!currentData) {
        return {
          processingItems: remainingProvisional,
          state: {
            ...s.state,
            isComplete: true,
            error: error ?? s.state.error,
          },
        };
      }
      const recalculated = recalculateBatchProgressData(currentData, currentData.items);
      const allDone =
        error !== undefined
          ? true
          : remainingProvisional.length === 0 && recalculated.processed >= recalculated.total;
      const resolvedError =
        error !== undefined
          ? error
          : allDone && recalculated.failed === recalculated.total && recalculated.total > 0
            ? 'All files failed to process'
            : null;

      return {
        processingItems: remainingProvisional,
        state: {
          ...s.state,
          isComplete: allDone,
          error: resolvedError,
          data: {
            ...recalculated,
            status: !allDone
              ? 'PROCESSING'
              : recalculated.failed === recalculated.total && recalculated.total > 0
                ? 'FAILED_FINAL'
                : 'COMPLETED',
            percentage: allDone && recalculated.total === 0 ? 100 : recalculated.percentage,
            completedAt: allDone ? new Date().toISOString() : undefined,
          },
        },
      };
    });
  },

  updateItem: (index: number, patch: Partial<IngestionProgressItem>) => {
    get().patchBatchItemAndRecalculate(index, patch);
  },

  closeModal: () => {
    set((s) => ({
      state: {
        ...s.state,
        isOpen: false,
        isMinimized: false,
      },
    }));
  },

  minimizeModal: () => {
    set((s) => ({
      state: {
        ...s.state,
        isOpen: false,
        isMinimized: true,
      },
    }));
  },

  restoreModal: () => {
    set((s) => ({
      state: {
        ...s.state,
        isOpen: true,
        isMinimized: false,
      },
    }));
  },

  startBatchUpload: async (files, options) => {
    if (!activeBatchAbortController || activeBatchAbortController.signal.aborted) {
      activeBatchAbortController = new AbortController();
    }
    const controller = activeBatchAbortController;
    const abortSignal = controller.signal;
    activeBatchUploadsCount += 1;

    const storeAdapter: ProcessModalStoreAdapter = {
      getState: get,
      setState: set,
      initializeBatchRun: get().initializeBatchRun,
      applyServerRunSnapshot: get().applyServerRunSnapshot,
      patchBatchItemAndRecalculate: get().patchBatchItemAndRecalculate,
      completeBatchRun: get().completeBatchRun,
      clearProcessingItemsByIds: get().clearProcessingItemsByIds,
      updateProcessingItem: get().updateProcessingItem,
      dismissProcessingItem: get().dismissProcessingItem,
    };
    try {
      if (registeredBatchUploadExecutor) {
        await registeredBatchUploadExecutor(files, { ...options, abortSignal }, storeAdapter);
      }
    } finally {
      activeBatchUploadsCount = Math.max(0, activeBatchUploadsCount - 1);
      if (activeBatchUploadsCount === 0 && activeBatchAbortController === controller) {
        activeBatchAbortController = null;
      }
    }
  },
}),
    {
      name: 'flux_process_modal_storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        state: state.state,
        processingItems: state.processingItems,
      }),
      onRehydrateStorage: () => (rehydrated) => {
        if (rehydrated?.state && !rehydrated.state.isComplete && !activeBatchAbortController) {
          rehydrated.state.isComplete = true;
          rehydrated.state.error = 'Upload interrupted by page reload.';
          if (
            rehydrated.state.data &&
            ACTIVE_ITEM_STATUSES.has(String(rehydrated.state.data.status || '').toUpperCase())
          ) {
            rehydrated.state.data.status = 'FAILED';
          }
          if (Array.isArray(rehydrated.processingItems)) {
            rehydrated.processingItems = rehydrated.processingItems.map((item) => {
              const upperStatus = String(item.status || '').toUpperCase();
              if (upperStatus === 'UPLOADING' || upperStatus === 'PENDING') {
                return {
                  ...item,
                  status: 'FAILED',
                  error: 'Upload interrupted by page reload.',
                };
              }
              return item;
            });
          }
        }
      },
    },
  ),
);

