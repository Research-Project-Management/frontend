import { create } from 'zustand';
import type {
  IngestionProgressItem,
  ProcessingFileItem,
  ProcessModalState,
  ProcessBatchUploadOptions,
} from '@/features/library/domain/types/batch-upload.types';
import { executeBatchUpload } from '@/features/library/core/coordinator/ingestion.coordinator';
import { cleanFilenameToTitle } from '@/features/library/domain/metadata';

export { cleanFilenameToTitle };
export type { ProcessModalState, ProcessingFileItem, ProcessBatchUploadOptions };

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
    await executeBatchUpload(files, options, {
      getState: get,
      setState: set,
    });
  },
}));

