export interface IngestionProgressItem {
  id: string;
  title: string;
  status: 'SUCCEEDED' | 'DUPLICATE' | 'FAILED' | 'PROCESSING' | 'UPLOADING' | 'PENDING';
  itemId?: string;
  error?: string;
  itemName?: string;
}

export type ProcessItem = IngestionProgressItem;

export interface IngestionProgressResponse {
  runId: string;
  scopeId?: string;
  projectId?: string;
  userId?: string;
  status: string;
  total: number;
  processed: number;
  percentage: number;
  succeeded: number;
  duplicates: number;
  failed: number;
  currentTitle?: string;
  items: IngestionProgressItem[];
  startedAt: string;
  completedAt?: string;
}

export interface ProcessModalState {
  isOpen: boolean;
  isMinimized: boolean;
  runId: string | null;
  fileName: string;
  data: IngestionProgressResponse | null;
  isComplete: boolean;
  error: string | null;
}

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

export interface InvalidationClient {
  invalidateQueries: (filters: { queryKey: readonly unknown[] }) => Promise<unknown> | void;
}

export interface ProcessBatchUploadOptions {
  scopeId?: string;
  collectionId?: string;
  queryClient: InvalidationClient;
  onSuccess?: () => void;
  abortSignal?: AbortSignal;
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

