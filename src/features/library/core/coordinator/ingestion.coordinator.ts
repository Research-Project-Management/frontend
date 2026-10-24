import { toast } from 'sonner';
import {
  IngestionService, UploadService } from '@/features/library/sdk/library.client';
import { itemKeys, collectionKeys } from '@/features/library/sdk/query-keys';
import type {
  IngestionProgressItem,
  ProcessingFileItem,
  ProcessBatchUploadOptions,
  ProcessModalStoreApi,
  InvalidationClient,
} from '@/features/library/domain/types/batch-upload.types';
import { cleanFilenameToTitle } from '@/features/library/domain/metadata';
import { BatchFlowManager } from '@/features/library/core/manager/batch-flow.manager';
import { DocumentFlowStateMachine } from '@/features/library/core/manager/document-flow-state.machine';

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
  store.setState((s) => ({
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
      isOpen: true,
      isMinimized: false,
      runId,
      fileName: title,
      isComplete: false,
      error: null,
      data: {
        runId,
        scopeId,
        status: 'PROCESSING',
        total: files.length,
        processed: 0,
        percentage: 0,
        succeeded: 0,
        duplicates: 0,
        failed: 0,
        currentTitle: files[0]?.name || title,
        items: files.map((f, idx) => ({
          title: f.name,
          status: (idx === 0 ? 'UPLOADING' : 'PENDING') as IngestionProgressItem['status'],
        })),
        startedAt: new Date().toISOString(),
      },
    },
  }));
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
    queryClient.invalidateQueries({ queryKey: itemKeys.all(scopeId) }),
    queryClient.invalidateQueries({ queryKey: itemKeys.counts(scopeId) }),
    queryClient.invalidateQueries({ queryKey: collectionKeys.all(scopeId) }),
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
export async function executeBatchUpload(
  files: File[],
  options: ProcessBatchUploadOptions,
  store: ProcessModalStoreApi,
): Promise<void> {
  if (!files || files.length === 0) return;
  const { scopeId = 'user', collectionId, queryClient, onSuccess } = options;

  const batchRunId = `batch-${Date.now()}`;
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

  const markFileFailed = (file: File, index: number, provisionalId: string, errorMsg: string) => {
    failCount++;
    completedCount++;
    store.setState((s) => {
      const items = s.state.data?.items.map((i: IngestionProgressItem, idx: number) =>
        idx === index
          ? {
              ...i,
              status: 'FAILED' as const,
              error: errorMsg,
            }
          : i,
      );
      const percentage = Math.round((completedCount / files.length) * 100);
      return {
        processingItems: s.processingItems.filter((p) => p.id !== provisionalId),
        state: s.state.data
          ? {
              ...s.state,
              data: {
                ...s.state.data,
                items: items || [],
                processed: completedCount,
                failed: failCount,
                percentage,
              },
            }
          : s.state,
      };
    });
  };

  const markFileSucceeded = (
    file: File,
    index: number,
    provisionalId: string,
    extractedTitle: string,
    finalItemId?: string,
    updateProvisional = true,
  ) => {
    successCount++;
    completedCount++;
    store.setState((s) => {
      const items = s.state.data?.items.map((i: IngestionProgressItem, idx: number) =>
        idx === index
          ? { ...i, status: 'SUCCEEDED' as const, itemName: extractedTitle }
          : i,
      );
      const percentage = Math.round((completedCount / files.length) * 100);
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
                items: items || [],
                processed: completedCount,
                succeeded: successCount,
                percentage,
              },
            }
          : s.state,
      };
    });
  };

  const fsms = new Map<string, DocumentFlowStateMachine>();
  files.forEach((file, idx) => {
    const provisionalId = initialProcessingItems[idx]!.id;
    const fsm = new DocumentFlowStateMachine(provisionalId, file.name, file.size);
    fsm.transition({
      type: 'QUEUE',
      provisionalId,
      fileName: file.name,
      fileSize: file.size,
    });
    fsms.set(provisionalId, fsm);
  });

  const processFile = async (entry: { file: File; index: number; provisionalId: string }) => {
    const { file, index, provisionalId } = entry;
    const lowerName = file.name.toLowerCase();
    const fsm = fsms.get(provisionalId);

    if (fsm?.state === 'FAILED' || fsm?.state === 'CANCELLED') {
      fsm.transition({ type: 'RETRY' });
    }
    fsm?.transition({ type: 'START_UPLOAD' });

    // Set item to UPLOADING
    store.setState((s) => {
      if (!s.state.data) return s;
      const items = s.state.data.items.map((i: IngestionProgressItem, idx: number) =>
        idx === index ? { ...i, status: 'UPLOADING' as const, error: undefined } : i,
      );
      return {
        state: {
          ...s.state,
          data: { ...s.state.data, items, currentTitle: file.name },
        },
      };
    });

    try {
      // Branch A: Textual Bibliography Files (.bib, .bibtex, .ris)
      const isBib = lowerName.endsWith('.bib') || lowerName.endsWith('.bibtex');
      const isRis = lowerName.endsWith('.ris');

      if (isBib || isRis) {
        const source = isBib ? 'bibtex' : 'ris';
        store.setState((s) => {
          const items = (s.state.data?.items || []).map((i: IngestionProgressItem, idx: number) =>
            idx === index ? { ...i, status: 'PROCESSING' as const } : i,
          );
          return {
            processingItems: s.processingItems.map((p) =>
              p.id === provisionalId ? { ...p, status: 'PROCESSING' } : p,
            ),
            state: s.state.data ? { ...s.state, data: { ...s.state.data, items } } : s.state,
          };
        });

        const content = await file.text();
        const res = await IngestionService.ingest(scopeId, {
          source,
          content,
          collectionId: effectiveCollection,
        });

        const resRecord = res as {
          data?: {
            runId?: string;
            itemId?: string;
            item?: { title?: string; id?: string };
          };
          runId?: string;
          itemId?: string;
          item?: { title?: string; id?: string };
        } | null;

        const bibRunId = resRecord?.data?.runId || resRecord?.runId;
        const itemPayload = resRecord?.data?.item || resRecord?.item;
        let extractedTitle = itemPayload?.title || file.name;
        let resolvedItemId =
          itemPayload?.id || resRecord?.data?.itemId || resRecord?.itemId;

        if (bibRunId) {
          fsm?.transition({ type: 'START_EXTRACTION', runId: bibRunId });
          const pollOutcome = await pollIngestionRunCompletion(
            scopeId,
            bibRunId,
            {
              fallbackTitle: extractedTitle,
              initialItemId: resolvedItemId,
            },
          );
          if (!pollOutcome.ok) {
            throw new Error(pollOutcome.error || 'Bibliography import failed');
          }
          extractedTitle = pollOutcome.title || extractedTitle;
          resolvedItemId = pollOutcome.itemId || resolvedItemId;
        }

        fsm?.transition({
          type: 'COMPLETE',
          itemId: resolvedItemId || provisionalId,
          title: extractedTitle,
        });
        markFileSucceeded(file, index, provisionalId, extractedTitle, resolvedItemId, true);
        return;
      }

      // Branch B: Binary / PDF Upload + Metadata Extraction
      const uploadRes = await UploadService.uploadMultipart(scopeId, file, {
        onProgress: (percent: number) => {
          fsm?.transition({ type: 'UPLOAD_PROGRESS', progress: percent });
          store.setState((s) => ({
            processingItems: s.processingItems.map((p) =>
              p.id === provisionalId ? { ...p, progress: percent } : p,
            ),
          }));
        },
      });

      if (!uploadRes?.fileId) {
        throw new Error('Upload succeeded without file identifier');
      }

      fsm?.transition({ type: 'UPLOAD_COMPLETED', fileId: uploadRes.fileId });

      // Transition to PROCESSING
      store.setState((s) => {
        const items = s.state.data?.items.map((i: IngestionProgressItem, idx: number) =>
          idx === index ? { ...i, status: 'PROCESSING' as const } : i,
        );
        return {
          processingItems: s.processingItems.map((p) =>
            p.id === provisionalId
              ? {
                  ...p,
                  status: 'PROCESSING',
                  fileId: uploadRes?.fileId,
                  fileUrl: uploadRes?.url,
                  progress: 100,
                }
              : p,
          ),
          state: s.state.data
            ? { ...s.state, data: { ...s.state.data, items: items || [] } }
            : s.state,
        };
      });

      const identifiedTitle = cleanFilenameToTitle(file.name);
      const ingestRes = await IngestionService.ingest(scopeId, {
        source: 'pdf',
        fileId: uploadRes.fileId,
        filename: file.name,
        collectionId: effectiveCollection,
      });

      const ingestPayload = ingestRes as {
        data?: { runId?: string; itemId?: string; status?: string };
        runId?: string;
        itemId?: string;
        status?: string;
      } | null;
      const runId = ingestPayload?.data?.runId || ingestPayload?.runId;
      const completedItemId = ingestPayload?.data?.itemId || ingestPayload?.itemId;

      let finalTitle = identifiedTitle;
      let finalItemId = completedItemId;

      if (runId) {
        fsm?.transition({ type: 'START_EXTRACTION', runId });
        const pollOutcome = await pollIngestionRunCompletion(
          scopeId,
          runId,
          { fallbackTitle: identifiedTitle, initialItemId: completedItemId },
        );
        if (!pollOutcome.ok) {
          throw new Error(pollOutcome.error || 'Extraction failed');
        }
        finalTitle = pollOutcome.title || identifiedTitle;
        finalItemId = pollOutcome.itemId || completedItemId;
      }

      fsm?.transition({
        type: 'COMPLETE',
        itemId: finalItemId || provisionalId,
        title: finalTitle,
      });
      markFileSucceeded(file, index, provisionalId, finalTitle, finalItemId, true);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Processing failed';
      fsm?.transition({ type: 'FAIL', error: errorMsg });
      throw err instanceof Error ? err : new Error(errorMsg);
    }
  };

  // Execute batch using classic Bounded Worker Pool Pattern
  const tasks = files.map((file, index) => ({
    id: initialProcessingItems[index]!.id,
    name: file.name,
    data: { file, index, provisionalId: initialProcessingItems[index]!.id },
    execute: (entry: { file: File; index: number; provisionalId: string }) => processFile(entry),
  }));

  const flowManager = new BatchFlowManager<{ file: File; index: number; provisionalId: string }>({
    concurrency,
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

  // Ensure all provisional items for this batch are wiped
  store.setState((s) => ({
    processingItems: s.processingItems.filter((p) => !batchProvisionalIds.has(p.id)),
    state: {
      ...s.state,
      isComplete: true,
      error:
        failCount === files.length && files.length > 0
          ? 'All files failed to process'
          : null,
      data: s.state.data
        ? {
            ...s.state.data,
            status: failCount === files.length ? 'FAILED_FINAL' : 'COMPLETED',
            percentage: 100,
            processed: files.length,
            succeeded: successCount,
            failed: failCount,
            completedAt: new Date().toISOString(),
          }
        : null,
    },
  }));

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
