import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { UploadService, IngestionService } from '@/features/library/sdk';
import { itemKeys } from '@/features/library/sdk/query-keys';
import {
  invalidateLibraryCatalogDependencies,
  useLibraryCacheSynchronizer,
} from '@/features/library/sdk/queries/cache-patcher';
import { useProcessModalStore } from '@/features/library/core/store/process-modal.store';
import type {
  IngestionProgressItem,
  ProcessingFileItem,
  ProcessBatchUploadOptions,
  ProcessModalStoreApi,
  InvalidationClient,
} from '@/features/library/domain/types/ingestion.types';
import {
  executeSaveFeedEntryToLibrary,
  type ParsedFeedEntry,
} from '@/features/library/domain/feed-parser.domain';
import type { Collection } from '@/features/library/domain/types/core.types';
import {
  BatchFlowManager,
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

  store.initializeBatchRun(runId, title, newProgressItems, {
    scopeId,
    currentTitle: files[0]?.name || title,
    initialProcessingItems,
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
    queryClient.refetchQueries
      ? queryClient.refetchQueries({
          queryKey: itemKeys.all(scopeId),
          type: 'active',
        })
      : Promise.resolve(),
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
    store.patchBatchItemAndRecalculate(
      provisionalId,
      { status: 'FAILED', error: errorMsg },
      { removeProcessingItem: true },
    );
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
    store.patchBatchItemAndRecalculate(
      provisionalId,
      { status: 'SUCCEEDED', itemName: extractedTitle, itemId: finalItemId },
      updateProvisional
        ? {
            processingPatch: {
              itemId: finalItemId,
              extractedTitle,
              status: 'SUCCEEDED',
              progress: 100,
            },
          }
        : undefined,
    );
    if (files.length > 1 && finalItemId) {
      void queryClient.invalidateQueries({ queryKey: itemKeys.all(scopeId) });
    }
  };

  const processFile = async (entry: { file: File; index: number; provisionalId: string }, signal?: AbortSignal) => {
    if (signal?.aborted) throw new Error('Processing cancelled');
    const { file, index, provisionalId } = entry;

    // Set item to UPLOADING
    store.patchBatchItemAndRecalculate(
      provisionalId,
      { status: 'UPLOADING', error: undefined },
      { currentTitle: file.name },
    );

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
  store.completeBatchRun(undefined, batchProvisionalIds);

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

export function useResumeBatchIngestionPolling(
  effectiveScope: string,
  activeRunId: string | null | undefined,
  isComplete: boolean,
): void {
  const { queryClient } = useLibraryCacheSynchronizer(effectiveScope);
  const applyServerRunSnapshot = useProcessModalStore((s) => s.applyServerRunSnapshot);
  const pollingRef = useRef<boolean>(false);

  useEffect(() => {
    if (!activeRunId || isComplete || pollingRef.current) return;
    pollingRef.current = true;

    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    async function pollBatchRunProgress() {
      try {
        const snapshot = await IngestionService.getRunStatus(effectiveScope, activeRunId!);
        if (cancelled) return;

        const rawData =
          (snapshot as { data?: Record<string, unknown> })?.data ??
          (snapshot as Record<string, unknown>);
        const status = (typeof rawData?.status === 'string' ? rawData.status : '').toUpperCase();

        if (
          status === 'COMPLETED' ||
          status === 'READY' ||
          status === 'SUCCEEDED' ||
          status === 'FAILED_FINAL'
        ) {
          applyServerRunSnapshot({ status });
          await synchronizeBatchCaches(queryClient, effectiveScope);
          useProcessModalStore.getState().completeBatchRun();
          return;
        }

        try {
          const progressRes = await IngestionService.getRunProgress(effectiveScope, activeRunId!);
          if (!cancelled && progressRes && typeof progressRes === 'object') {
            const pr = progressRes as {
              items?: Array<{ id: string; status: string; title?: string }>;
            };
            if (Array.isArray(pr.items) && pr.items.length > 0) {
              applyServerRunSnapshot({
                items: pr.items.map((pi) => ({
                  id: pi.id,
                  title: pi.title || '',
                  status: (pi.status || 'PROCESSING') as IngestionProgressItem['status'],
                })),
              });
            }
          }
        } catch {
          // Progress endpoint optional
        }

        if (!cancelled) {
          timer = setTimeout(pollBatchRunProgress, 2500);
        }
      } catch {
        if (!cancelled) {
          timer = setTimeout(pollBatchRunProgress, 4000);
        }
      }
    }

    void pollBatchRunProgress();

    return () => {
      cancelled = true;
      pollingRef.current = false;
      if (timer) clearTimeout(timer);
    };
  }, [activeRunId, isComplete, effectiveScope, queryClient, applyServerRunSnapshot]);
}

export interface SaveFeedEntryCoordinatorOptions<
  TCreatePayload extends Record<string, unknown> = Record<string, unknown>,
> {
  entry: ParsedFeedEntry;
  scopeId: string;
  targetCollectionId?: string;
  createItem: (payload: TCreatePayload) => Promise<unknown>;
  ingestItem?: Parameters<typeof executeSaveFeedEntryToLibrary>[0]['ingestItem'];
  collections?: readonly Collection[];
  markEntryAsRead: (entryId: string) => void;
  setEntrySaving: (entryId: string, isSaving: boolean) => void;
  markEntrySaved: (entryId: string) => void;
}

/**
 * Shared coordinator workflow for saving an RSS/Atom feed entry into the user's or project's library.
 * Centralizes read marking, saving state tracking, collection toast notifications, and error handling.
 */
export async function executeSaveFeedEntryWithFeedback<
  TCreatePayload extends Record<string, unknown> = Record<string, unknown>,
>({
  entry,
  scopeId,
  targetCollectionId,
  createItem,
  ingestItem,
  collections,
  markEntryAsRead,
  setEntrySaving,
  markEntrySaved,
}: SaveFeedEntryCoordinatorOptions<TCreatePayload>): Promise<void> {
  markEntryAsRead(entry.id);
  setEntrySaving(entry.id, true);
  try {
    await executeSaveFeedEntryToLibrary({
      entry,
      scopeId,
      targetCollectionId,
      createItem,
      ingestItem,
    });
    markEntrySaved(entry.id);

    const colName = targetCollectionId
      ? collections?.find((c) => c.id === targetCollectionId)?.name
      : undefined;

    toast.success(colName ? `Saved to "${colName}"` : 'Saved to Library', {
      description: `"${entry.title.slice(0, 48)}..." added to your collection.`,
    });
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : 'Could not add feed item.';
    toast.error('Failed to save to library', { description: msg });
  } finally {
    setEntrySaving(entry.id, false);
  }
}

