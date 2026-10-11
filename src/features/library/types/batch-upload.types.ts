import type { QueryClient } from '@tanstack/react-query';
import type { ProcessModalState } from '../data/ingestion/ingestion.queries';

export type { ProcessModalState };

export interface ProcessingFileItem {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType?: string;
  scopeId: string;
  collectionId?: string;
  status: 'UPLOADING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED';
  progress: number;
  extractedTitle?: string;
  itemId?: string;
  fileId?: string;
  fileUrl?: string;
  createdAt: string;
  error?: string;
}

export interface ProcessBatchUploadOptions {
  scopeId?: string;
  collectionId?: string;
  queryClient: QueryClient;
  onSuccess?: () => void;
}

export interface ProcessModalStoreApi {
  getState: () => {
    state: ProcessModalState;
    processingItems: ProcessingFileItem[];
  };
  setState: (
    partial:
      | Partial<{ state: ProcessModalState; processingItems: ProcessingFileItem[] }>
      | ((s: { state: ProcessModalState; processingItems: ProcessingFileItem[] }) => Partial<{
          state: ProcessModalState;
          processingItems: ProcessingFileItem[];
        }>),
  ) => void;
}
