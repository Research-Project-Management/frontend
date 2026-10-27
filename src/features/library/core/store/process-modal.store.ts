import { create } from 'zustand';
import type {
  IngestionProgressItem,
  ProcessingFileItem,
  ProcessModalState,
  ProcessBatchUploadOptions,
} from '@/features/library/domain/types/batch-upload.types';
// executeBatchUpload is lazily imported inside startBatchUpload to prevent cyclic module initialization
import { cleanFilenameToTitle } from '@/features/library/domain/metadata';

export { cleanFilenameToTitle };
export type { ProcessModalState, ProcessingFileItem, ProcessBatchUploadOptions };

// ---------------------------------------------------------------------------
// Explicit Finite State Machine (FSM) Selectors & Transition Guards (FE-P3)
// ---------------------------------------------------------------------------

export type ProcessModalPhase =
  | 'IDLE'
  | 'RUNNING'
  | 'COMPLETED'
  | 'PARTIAL_FAILURE'
  | 'FAILED'
  | 'ABORTED';

export type ProcessModalDisplayMode = 'HIDDEN' | 'EXPANDED' | 'MINIMIZED_PILL';

export type ProcessItemStage = 'PENDING' | 'ACTIVE' | 'SUCCEEDED' | 'FAILED';

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

export interface ProcessModalStore {
  state: ProcessModalState;
  processingItems: ProcessingFileItem[];
  addProcessingItem: (item: ProcessingFileItem) => void;
  updateProcessingItem: (id: string, updates: Partial<ProcessingFileItem>) => void;
  dismissProcessingItem: (id: string) => void;
  updateItemById: (taskId: string, patch: Partial<IngestionProgressItem>) => void;
  updateItem: (index: number, patch: Partial<IngestionProgressItem>) => void;
  startBatchUpload: (
    files: File[],
    options: ProcessBatchUploadOptions,
  ) => Promise<void>;
  abortBatch: () => void;
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

export const useProcessModalStore = create<ProcessModalStore>((set, get) => ({
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

  updateItemById: (taskId: string, patch: Partial<IngestionProgressItem>) => {
    set((s) => {
      if (!s.state.data) return s;
      const items = s.state.data.items.map((item) =>
        item.id === taskId ? { ...item, ...patch } : item,
      );
      return {
        state: {
          ...s.state,
          data: {
            ...s.state.data,
            items,
          },
        },
      };
    });
  },

  updateItem: (index: number, patch: Partial<IngestionProgressItem>) => {
    set((s) => {
      if (!s.state.data) return s;
      const items = s.state.data.items.map((item, idx) =>
        idx === index ? { ...item, ...patch } : item,
      );
      return {
        state: {
          ...s.state,
          data: {
            ...s.state.data,
            items,
          },
        },
      };
    });
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
    if (activeBatchAbortController) {
      activeBatchAbortController.abort();
    }
    activeBatchAbortController = new AbortController();
    const abortSignal = activeBatchAbortController.signal;

    const { executeBatchUpload } = await import('@/features/library/core/coordinator/ingestion.coordinator');
    try {
      await executeBatchUpload(
        files,
        { ...options, abortSignal },
        {
          getState: get,
          setState: set,
        },
      );
    } finally {
      if (activeBatchAbortController?.signal === abortSignal) {
        activeBatchAbortController = null;
      }
    }
  },

  abortBatch: () => {
    if (activeBatchAbortController) {
      activeBatchAbortController.abort();
      activeBatchAbortController = null;
    }
    set((s) => ({
      state: {
        ...s.state,
        isComplete: true,
        error: 'Batch processing cancelled by user',
      },
    }));
  },
}));

