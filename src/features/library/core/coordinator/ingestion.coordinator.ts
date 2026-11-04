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
  FeedRetentionDays,
  SavedFeedSubscription,
} from '@/features/library/domain/types/ingestion.types';
import {
  mapFeedEntryToCreateItemPayload,
  type ParsedFeedEntry,
} from '@/features/library/domain/feed-parser.domain';
import type {
  Collection,
  AddFeedFormValues,
} from '@/features/library/domain/types/core.types';
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
import {
  pollIngestionRunCompletion,
  type PollRunOutcome,
  type PollIngestionRunOptions,
} from '@/features/library/sdk/queries/ingestion.queries';

export {
  resolveFileIngestionStrategy,
  detectBibliographyFileFormat,
  TextBibliographyFileStrategy,
  BinaryAttachmentFileStrategy,
  type IFileIngestionStrategy,
  type FileIngestionStrategyContext,
  type BibliographyTextFormat,
  pollIngestionRunCompletion,
  type PollRunOutcome,
  type PollIngestionRunOptions,
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
        markFileFailed,
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

const TERMINAL_BATCH_RUN_STATUSES = new Set([
  'COMPLETED',
  'READY',
  'SUCCEEDED',
  'PARTIAL',
  'FAILED',
  'FAILED_FINAL',
  'FAILED_RETRYABLE',
  'CANCELLED',
  'CANCELED',
]);

const PERMANENT_POLL_HTTP_STATUSES = new Set([401, 403, 404]);

function extractHttpStatus(err: unknown): number | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const candidate = err as {
    status?: number;
    statusCode?: number;
    response?: { status?: number };
  };
  return candidate.status ?? candidate.statusCode ?? candidate.response?.status;
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
    if (!activeRunId || activeRunId.startsWith('batch-') || isComplete || pollingRef.current) return;
    pollingRef.current = true;

    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;
    let consecutiveErrors = 0;

    async function pollBatchRunProgress() {
      try {
        const snapshot = await IngestionService.getRunStatus(effectiveScope, activeRunId!);
        if (cancelled) return;
        consecutiveErrors = 0;

        const rawData =
          (snapshot as { data?: Record<string, unknown> })?.data ??
          (snapshot as Record<string, unknown>);
        const status = (typeof rawData?.status === 'string' ? rawData.status.trim() : '').toUpperCase();

        if (TERMINAL_BATCH_RUN_STATUSES.has(status)) {
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
      } catch (pollErr: unknown) {
        consecutiveErrors++;
        const httpStatus = extractHttpStatus(pollErr);
        if (
          consecutiveErrors >= 5 ||
          (httpStatus !== undefined && PERMANENT_POLL_HTTP_STATUSES.has(httpStatus))
        ) {
          useProcessModalStore.getState().completeBatchRun();
          return;
        }
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

/**
 * Centralized workflow orchestrator for saving an RSS/Atom feed entry to the Library:
 * 1. When the entry has an authoritative identifier (DOI or arXiv ID) and an `ingestItem`
 *    executor is provided, attempts full pipeline ingestion first (enriching metadata & OA PDF).
 * 2. Falls back to `createItem` with `mapFeedEntryToCreateItemPayload`.
 */
export async function executeSaveFeedEntryToLibrary<TCreatePayload extends Record<string, unknown>>(params: {
  entry: ParsedFeedEntry;
  scopeId: string;
  targetCollectionId?: string;
  createItem: (payload: TCreatePayload) => Promise<unknown>;
  ingestItem?: (
    payload:
      | {
          source: 'doi';
          doi: string;
          collectionId?: string;
          overrides?: Record<string, unknown>;
        }
      | {
          source: 'arxiv';
          arxivId: string;
          collectionId?: string;
          overrides?: Record<string, unknown>;
        },
  ) => Promise<unknown>;
}): Promise<void> {
  const { entry, scopeId, targetCollectionId, createItem, ingestItem } = params;
  const createPayload = mapFeedEntryToCreateItemPayload(entry, {
    scopeId,
    collectionId: targetCollectionId,
  });

  let savedViaPipeline = false;
  if (ingestItem && (entry.doi || entry.arxivId)) {
    try {
      await ingestItem({
        ...(entry.doi
          ? { source: 'doi' as const, doi: entry.doi }
          : { source: 'arxiv' as const, arxivId: entry.arxivId! }),
        collectionId: targetCollectionId,
        overrides: {
          title: entry.title,
          abstract: entry.abstract,
          publicationTitle: entry.publicationTitle,
          year: entry.year,
          url: createPayload.url,
          tags: entry.categories,
          attachOaPdf: true,
          saveSnapshot: false,
        },
      });
      savedViaPipeline = true;
    } catch {
      savedViaPipeline = false;
    }
  }

  if (!savedViaPipeline) {
    await createItem({ ...createPayload, silent: true } as unknown as TCreatePayload);
  }
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
  setEntrySaving(entry.id, true);
  try {
    await executeSaveFeedEntryToLibrary({
      entry,
      scopeId,
      targetCollectionId,
      createItem,
      ingestItem,
    });
    markEntryAsRead(entry.id);
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

/**
 * Resolves the RSS/Atom feed title from a feed URL via `fetchAcademicFeed`.
 * Returns `undefined` when auto-detection fails or produces an empty string.
 */
export async function resolveFeedTitleFromUrl(
  url: string,
  fetchAcademicFeed: (params: { url: string; silent?: boolean }) => Promise<unknown>,
): Promise<string | undefined> {
  const trimmedUrl = url.trim();
  if (!trimmedUrl) return undefined;
  try {
    const res = await fetchAcademicFeed({ url: trimmedUrl, silent: true });
    const payload =
      typeof res === 'object' && res !== null && 'data' in res
        ? (res as { data?: { feedTitle?: string } }).data
        : (res as { feedTitle?: string });
    const detected = payload?.feedTitle;
    if (detected && typeof detected === 'string' && detected.trim()) {
      return detected.trim();
    }
  } catch {
    // Background detection failure is non-fatal
  }
  return undefined;
}

/**
 * Shared coordinator workflow for subscribing to a new RSS/Atom feed with automatic title fallback.
 * Eliminates duplicate auto-title + subscribe orchestration across AddFeedModal, LibraryModals, and FeedsManagerModal.
 */
export async function executeSubscribeFeedWithAutoTitle(params: {
  data: AddFeedFormValues;
  fetchAcademicFeed: (params: { url: string; silent?: boolean }) => Promise<unknown>;
  subscribeFeed: (payload: {
    name: string;
    url: string;
    retentionDays: FeedRetentionDays;
    cleanupReadAfter: FeedRetentionDays;
    cleanupUnreadAfter: FeedRetentionDays;
  }) => Promise<SavedFeedSubscription>;
}): Promise<SavedFeedSubscription> {
  const { data, fetchAcademicFeed, subscribeFeed } = params;
  let finalName = (data.name || '').trim();
  if (!finalName) {
    finalName = (await resolveFeedTitleFromUrl(data.url, fetchAcademicFeed)) || '';
  }

  const unreadDays = (data.cleanupUnreadAfter ?? data.retentionDays ?? 30) as FeedRetentionDays;
  const readDays = (data.cleanupReadAfter ?? 7) as FeedRetentionDays;

  return subscribeFeed({
    name: finalName || 'Academic Feed',
    url: data.url.trim(),
    retentionDays: unreadDays,
    cleanupReadAfter: readDays,
    cleanupUnreadAfter: unreadDays,
  });
}


