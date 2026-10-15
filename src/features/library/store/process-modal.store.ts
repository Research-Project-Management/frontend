import { create } from 'zustand';
import type {
  ProcessingFileItem,
  ProcessModalState,
  ProcessBatchUploadOptions,
} from '@/features/library/types/batch-upload.types';
import { executeBatchUpload, cleanFilenameToTitle } from '@/features/library/data/batch-upload.service';

export { cleanFilenameToTitle };
export type { ProcessModalState, ProcessingFileItem, ProcessBatchUploadOptions };

export interface ProcessModalStore {
  state: ProcessModalState;
  processingItems: ProcessingFileItem[];
  addProcessingItem: (item: ProcessingFileItem) => void;
  updateProcessingItem: (id: string, updates: Partial<ProcessingFileItem>) => void;
  dismissProcessingItem: (id: string) => void;
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
    await executeBatchUpload(files, options, {
      getState: get,
      setState: set,
    });
  },
}));
