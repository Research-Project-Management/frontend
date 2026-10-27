import { toast } from 'sonner';
import { UploadService } from '@/features/library/sdk/library.client';
import { itemKeys } from '@/features/library/sdk/query-keys';
import { invalidateLibraryCatalogDependencies } from '@/features/library/sdk/queries/cache-patcher';
import type {
  IngestionProgressItem,
  ProcessingFileItem,
  ProcessBatchUploadOptions,
  ProcessModalStoreApi,
  InvalidationClient,
} from '@/features/library/domain/types/batch-upload.types';
import { BatchFlowManager } from '@/features/library/core/manager/batch-flow.manager';
import {
  resolveFileIngestionStrategy,
  detectBibliographyFileFormat,
  TextBibliographyFileStrategy,
  BinaryAttachmentFileStrategy,
  type IFileIngestionStrategy,
  type FileIngestionStrategyContext,
  type BibliographyTextFormat,
} from './file-ingestion.strategies';

export {
  resolveFileIngestionStrategy,
  detectBibliographyFileFormat,
  TextBibliographyFileStrategy,
  BinaryAttachmentFileStrategy,
  type IFileIngestionStrategy,
  type FileIngestionStrategyContext,
  type BibliographyTextFormat,
};

// Stage 1: Provisional Item Creation & Modal Initialization

function createProvisionalBatchItems(
  files: File[],
  scopeId: string,
  collectionId?: string | null,
): ProcessingFileItem[] {
  const now = Date.now();
  const createdAt = new Date(now).toISOString();
  return files.map((file, idx) => ({
    id: `provisional-${now}-${idx}-${Math.random().toString(36).slice(2, 8)}`,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type || 'application/pdf',
    scopeId,
    collectionId: collectionId || undefined,
    status: 'UPLOADING',
    progress: 0,
    createdAt,
  }));
}

function initializeBatchModalState(
  store: ProcessModalStoreApi,
  files: File[],
  scopeId: string,
  runId: string,
  initialProcessingItems: ProcessingFileItem[],
): void {
  const title = files.length === 1 ? files[0].name : `${files.length} documents`;
  const newProgressItems: IngestionProgressItem[] = files.map((f, idx) => ({
    id: initialProcessingItems[idx]!.id,
    title: f.name,
    status: (idx === 0 ? 'UPLOADING' : 'PENDING') as IngestionProgressItem['status'],
  }));

  store.setState((s) => {
    const hasActiveBatch = Boolean(!s.state.isComplete && s.state.data && s.state.data.items.length > 0);
    const mergedItems = hasActiveBatch
      ? [...s.state.data!.items, ...newProgressItems]
      : newProgressItems;
    const total = mergedItems.length;
    const succeeded = mergedItems.filter((i) => i.status === 'SUCCEEDED').length;
    const failed = mergedItems.filter((i) => i.status === 'FAILED').length;
    const processed = succeeded + failed;
    const percentage = total > 0 ? Math.round((processed / total) * 100) : 0;

    return {
      processingItems: [
        ...s.processingItems.filter(
          (p) =>
            !initialProcessingItems.some(
              (n) => n.fileName === p.fileName && n.fileSize === p.fileSize,
            ),
        ),
        ...initialProcessingItems,
      ],
      state: {
        isOpen: hasActiveBatch && s.state.isMinimized ? false : true,
        isMinimized: hasActiveBatch ? s.state.isMinimized : false,
        runId: hasActiveBatch ? s.state.runId || runId : runId,
        fileName: total === 1 ? mergedItems[0]!.title : `${total} documents`,
        isComplete: false,
        error: null,
        data: {
          runId: hasActiveBatch ? s.state.data!.runId : runId,
          scopeId,
          status: 'PROCESSING',
          total,
          processed,
          percentage,
          succeeded,
          duplicates: hasActiveBatch ? s.state.data!.duplicates : 0,
          failed,
          currentTitle: files[0]?.name || title,
          items: mergedItems,
          startedAt: hasActiveBatch ? s.state.data!.startedAt : new Date().toISOString(),
        },
      },
    };
  });
}

import {
  pollIngestionRunCompletion,
  type PollRunOutcome,
  type PollIngestionRunOptions,
} from '@/features/library/sdk/queries/ingestion.queries';

export { pollIngestionRunCompletion, type PollRunOutcome, type PollIngestionRunOptions };

// Stage 3: Cache Synchronization

async function synchronizeBatchCaches(
  queryClient: InvalidationClient,
  scopeId: string,
  effectiveCollection?: string,
): Promise<void> {
  await Promise.all([
    invalidateLibraryCatalogDependencies(queryClient, scopeId, {
      itemsList: true,
      collections: true,
      tags: true,
      counts: true,
      smartCollections: true,
    }),
    effectiveCollection
      ? queryClient.invalidateQueries({
          queryKey: itemKeys.byCollection(scopeId, effectiveCollection),
        })
      : Promise.resolve(),
  ]);
}

// Public Coordinator Entry Point

/**
 * Headless Batch Upload & Ingestion Application Service.
 *
 * Orchestrates multi-file upload pipelines, concurrent metadata extraction,
 * TanStack query cache invalidation, and user notifications cleanly outside
 * of UI state stores.
 */
const MAX_UPLOAD_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100MB

export async function executeBatchUpload(
  files: File[],
  options: ProcessBatchUploadOptions,
  store: ProcessModalStoreApi,
): Promise<void> {
  if (!files || files.length === 0) return;
  const { scopeId = 'user', collectionId, queryClient, onSuccess } = options;

  const batchRunId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? `batch-${crypto.randomUUID()}`
      : `batch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const initialProcessingItems = createProvisionalBatchItems(files, scopeId, collectionId);
  initializeBatchModalState(store, files, scopeId, batchRunId, initialProcessingItems);

  const batchProvisionalIds = new Set(initialProcessingItems.map((p) => p.id));
  const queue = files.map((file, index) => ({
    file,
    index,
    provisionalId: initialProcessingItems[index]!.id,
  }));
  const concurrency = 4;
  let completedCount = 0;
  let successCount = 0;
  let failCount = 0;
  const effectiveCollection = collectionId || undefined;
  const uploadedCache = new Map<File, Awaited<ReturnType<typeof UploadService.uploadMultipart>>>();

  const markFileFailed = (_file: File, _index: number, provisionalId: string, errorMsg: string) => {
    failCount++;
    completedCount++;
    store.setState((s) => {
      const items = (s.state.data?.items || []).map((i: IngestionProgressItem) =>
        i.id === provisionalId
          ? {
              ...i,
              status: 'FAILED' as const,
              error: errorMsg,
            }
          : i,
      );
      const total = items.length || files.length;
      const succeeded = items.filter((i) => i.status === 'SUCCEEDED').length;
      const failed = items.filter((i) => i.status === 'FAILED').length;
      const processed = succeeded + failed;
      const percentage = total > 0 ? Math.round((processed / total) * 100) : 100;
      return {
        processingItems: s.processingItems.filter((p) => p.id !== provisionalId),
        state: s.state.data
          ? {
              ...s.state,
              data: {
                ...s.state.data,
                items,
                total,
                processed,
                succeeded,
                failed,
                percentage,
              },
            }
          : s.state,
      };
    });
  };

  const markFileSucceeded = (
    _file: File,
    _index: number,
    provisionalId: string,
    extractedTitle: string,
    finalItemId?: string,
    updateProvisional = true,
  ) => {
    successCount++;
    completedCount++;
    store.setState((s) => {
      const items = (s.state.data?.items || []).map((i: IngestionProgressItem) =>
        i.id === provisionalId
          ? { ...i, status: 'SUCCEEDED' as const, itemName: extractedTitle, itemId: finalItemId }
          : i,
      );
      const total = items.length || files.length;
      const succeeded = items.filter((i) => i.status === 'SUCCEEDED').length;
      const failed = items.filter((i) => i.status === 'FAILED').length;
      const processed = succeeded + failed;
      const percentage = total > 0 ? Math.round((processed / total) * 100) : 100;
      return {
        ...(updateProvisional
          ? {
               processingItems: s.processingItems.map((p) =>
                p.id === provisionalId
                  ? {
                      ...p,
                      itemId: finalItemId,
                      extractedTitle,
                      status: 'SUCCEEDED' as const,
                      progress: 100,
                    }
                  : p,
              ),
            }
          : {}),
        state: s.state.data
          ? {
              ...s.state,
              data: {
                ...s.state.data,
                items,
                total,
                processed,
                succeeded,
                failed,
                percentage,
              },
            }
          : s.state,
      };
    });
  };

  const processFile = async (entry: { file: File; index: number; provisionalId: string }, signal?: AbortSignal) => {
    if (signal?.aborted) throw new Error('Processing cancelled');
    const { file, index, provisionalId } = entry;

    // Set item to UPLOADING
    store.setState((s) => {
      if (!s.state.data) return s;
      const items = s.state.data.items.map((i: IngestionProgressItem) =>
        i.id === provisionalId ? { ...i, status: 'UPLOADING' as const, error: undefined } : i,
      );
      return {
        state: {
          ...s.state,
          data: { ...s.state.data, items, currentTitle: file.name },
        },
      };
    });

    try {
      if (file.size > MAX_UPLOAD_FILE_SIZE_BYTES) {
        throw new Error('File exceeds the 100MB maximum upload size limit.');
      }

      const strategy = resolveFileIngestionStrategy(file);
      await strategy.execute(file, {
        scopeId,
        index,
        provisionalId,
        effectiveCollection,
        store,
        uploadedCache,
        signal,
        markFileSucceeded,
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Processing failed';
      throw err instanceof Error ? err : new Error(errorMsg);
    }
  };

  // Execute batch using classic Bounded Worker Pool Pattern
  const tasks = files.map((file, index) => ({
    id: initialProcessingItems[index]!.id,
    name: file.name,
    data: { file, index, provisionalId: initialProcessingItems[index]!.id },
    execute: (entry: { file: File; index: number; provisionalId: string }, signal: AbortSignal) => processFile(entry, signal),
  }));

  const flowManager = new BatchFlowManager<{ file: File; index: number; provisionalId: string }>({
    concurrency,
    maxRetries: 0,
    abortSignal: options.abortSignal,
  });
  const batchProgress = await flowManager.execute(tasks);

  // Mark any files that exhausted all retries as failed
  batchProgress.errors.forEach((error, taskId) => {
    const taskEntry = queue.find((q) => q.provisionalId === taskId);
    if (taskEntry) {
      markFileFailed(
        taskEntry.file,
        taskEntry.index,
        taskEntry.provisionalId,
        error.message || 'Processing failed',
      );
    }
  });
  await synchronizeBatchCaches(queryClient, scopeId, effectiveCollection);

  // Ensure all provisional items for this batch are wiped and modal reflects aggregate status
  store.setState((s) => {
    const remainingProvisional = s.processingItems.filter((p) => !batchProvisionalIds.has(p.id));
    const allItems = s.state.data?.items || [];
    const total = allItems.length || files.length;
    const totalSucceeded = allItems.filter((i) => i.status === 'SUCCEEDED').length;
    const totalFailed = allItems.filter((i) => i.status === 'FAILED').length;
    const totalProcessed = totalSucceeded + totalFailed;
    const allDone = remainingProvisional.length === 0 && totalProcessed >= total;

    return {
      processingItems: remainingProvisional,
      state: {
        ...s.state,
        isComplete: allDone,
        error:
          allDone && totalFailed === total && total > 0
            ? 'All files failed to process'
            : null,
        data: s.state.data
          ? {
              ...s.state.data,
              status: !allDone
                ? 'PROCESSING'
                : totalFailed === total
                  ? 'FAILED_FINAL'
                  : 'COMPLETED',
              percentage: total > 0 ? Math.round((totalProcessed / total) * 100) : 100,
              total,
              processed: totalProcessed,
              succeeded: totalSucceeded,
              failed: totalFailed,
              completedAt: allDone ? new Date().toISOString() : undefined,
            }
          : null,
      },
    };
  });

  if (successCount > 0) {
    toast.success(
      files.length === 1
        ? 'Document imported successfully'
        : `Imported ${successCount} of ${files.length} documents`,
      {
        description: 'Metadata and attachments are ready in your library.',
        id: 'process-modal-import',
      },
    );
    if (onSuccess) onSuccess();
  } else if (failCount > 0) {
    toast.error('Import failed', {
      description: 'None of the documents could be processed.',
      id: 'process-modal-import',
    });
  }
}
