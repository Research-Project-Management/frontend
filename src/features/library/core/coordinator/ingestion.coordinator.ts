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

  const processFile = async (entry: { file: File; index: number; provisionalId: string }) => {
    const { file, index, provisionalId } = entry;
    const lowerName = file.name.toLowerCase();

    // Set item to UPLOADING
    store.setState((s) => {
      if (!s.state.data) return s;
      const items = s.state.data.items.map((i: IngestionProgressItem, idx: number) =>
        idx === index ? { ...i, status: 'UPLOADING' as const } : i,
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
          const pollOutcome = await pollIngestionRunCompletion(
            scopeId,
            bibRunId,
            {
              fallbackTitle: extractedTitle,
              initialItemId: resolvedItemId,
            },
          );
          if (!pollOutcome.ok) {
            markFileFailed(
              file,
              index,
              provisionalId,
              pollOutcome.error || 'Bibliography import failed',
            );
            return;
          }
          extractedTitle = pollOutcome.title || extractedTitle;
          resolvedItemId = pollOutcome.itemId || resolvedItemId;
        }

        markFileSucceeded(file, index, provisionalId, extractedTitle, resolvedItemId, true);
        return;
      }

      // Branch B: Binary / PDF Upload + Metadata Extraction
      let uploadRes: { fileId?: string; url?: string } | null = null;
      try {
        uploadRes = await UploadService.uploadMultipart(scopeId, file, {
          onProgress: (percent: number) => {
            store.setState((s) => ({
              processingItems: s.processingItems.map((p) =>
                p.id === provisionalId ? { ...p, progress: percent } : p,
              ),
            }));
          },
        });
      } catch (uploadErr: unknown) {
        const errorMsg = uploadErr instanceof Error ? uploadErr.message : 'Upload failed';
        markFileFailed(file, index, provisionalId, errorMsg);
        return;
      }

      if (!uploadRes?.fileId) {
        markFileFailed(file, index, provisionalId, 'Upload succeeded without file identifier');
        return;
      }

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
      let completedItemId: string | undefined = undefined;
      let runId: string | undefined = undefined;

      try {
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
        runId = ingestPayload?.data?.runId || ingestPayload?.runId;
        completedItemId = ingestPayload?.data?.itemId || ingestPayload?.itemId;
      } catch (submitErr) {
        const errorMsg =
          submitErr instanceof Error ? submitErr.message : 'Ingestion submission failed';
        markFileFailed(file, index, provisionalId, errorMsg);
        return;
      }

      let finalTitle = identifiedTitle;
      let finalItemId = completedItemId;

      if (runId) {
        const pollOutcome = await pollIngestionRunCompletion(
          scopeId,
          runId,
          { fallbackTitle: identifiedTitle, initialItemId: completedItemId },
        );
        if (!pollOutcome.ok) {
          markFileFailed(file, index, provisionalId, pollOutcome.error || 'Extraction failed');
          return;
        }
        finalTitle = pollOutcome.title || identifiedTitle;
        finalItemId = pollOutcome.itemId || completedItemId;
      }

      markFileSucceeded(file, index, provisionalId, finalTitle, finalItemId, true);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Processing failed';
      markFileFailed(file, index, provisionalId, errorMsg);
    }
  };

  const runWorker = async () => {
    while (queue.length > 0) {
      const nextEntry = queue.shift();
      if (!nextEntry) break;
      await processFile(nextEntry);
    }
  };

  const workers = Array.from(
    { length: Math.min(concurrency, files.length) },
    () => runWorker(),
  );

  await Promise.all(workers);
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
