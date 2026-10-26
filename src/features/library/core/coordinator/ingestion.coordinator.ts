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

  const processFile = async (entry: { file: File; index: number; provisionalId: string }) => {
    const { file, index, provisionalId } = entry;
    const lowerName = file.name.toLowerCase();

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
      // Branch A: Textual Bibliography Files (.bib, .bibtex, .ris, .json, .csl.json, .xml, .mods, .rdf, .nbib, .medline, .csv)
      const isBib = lowerName.endsWith('.bib') || lowerName.endsWith('.bibtex');
      const isRis = lowerName.endsWith('.ris');
      const isCslJson = lowerName.endsWith('.json') || lowerName.endsWith('.csl.json');
      const isMods = lowerName.endsWith('.mods');
      const isRdf = lowerName.endsWith('.rdf');
      const isXml = lowerName.endsWith('.xml');
      const isMedline = lowerName.endsWith('.nbib') || lowerName.endsWith('.medline');
      const isCsv = lowerName.endsWith('.csv');

      if (isBib || isRis || isCslJson || isMods || isRdf || isXml || isMedline || isCsv) {
        store.setState((s) => {
          const items = (s.state.data?.items || []).map((i: IngestionProgressItem) =>
            i.id === provisionalId ? { ...i, status: 'PROCESSING' as const } : i,
          );
          return {
            processingItems: s.processingItems.map((p) =>
              p.id === provisionalId ? { ...p, status: 'PROCESSING' } : p,
            ),
            state: s.state.data ? { ...s.state, data: { ...s.state.data, items } } : s.state,
          };
        });

        const content = await file.text();
        let source:
          | 'bibtex'
          | 'ris'
          | 'csl_json'
          | 'endnote_xml'
          | 'mods'
          | 'zotero_rdf'
          | 'medline'
          | 'csv' = 'bibtex';
        if (isBib) source = 'bibtex';
        else if (isRis) source = 'ris';
        else if (isCslJson) source = 'csl_json';
        else if (isMods) source = 'mods';
        else if (isRdf) source = 'zotero_rdf';
        else if (isMedline) source = 'medline';
        else if (isCsv) source = 'csv';
        else if (isXml) {
          if (/<(?:mods:)?mods(?:Collection)?[\s>]/i.test(content)) {
            source = 'mods';
          } else if (/<rdf:RDF[\s>]/i.test(content)) {
            source = 'zotero_rdf';
          } else {
            source = 'endnote_xml';
          }
        }
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
            throw new Error(pollOutcome.error || 'Bibliography import failed');
          }
          extractedTitle = pollOutcome.title || extractedTitle;
          resolvedItemId = pollOutcome.itemId || resolvedItemId;
        }

        markFileSucceeded(file, index, provisionalId, extractedTitle, resolvedItemId, true);
        return;
      }

      // Branch B: Binary / PDF Upload + Metadata Extraction
      let uploadRes = uploadedCache.get(file);
      if (!uploadRes) {
        uploadRes = await UploadService.uploadMultipart(scopeId, file, {
          onProgress: (percent: number) => {
            store.setState((s) => ({
              processingItems: s.processingItems.map((p) =>
                p.id === provisionalId ? { ...p, progress: percent } : p,
              ),
            }));
          },
        });
        if (uploadRes?.fileId) {
          uploadedCache.set(file, uploadRes);
        }
      }

      if (!uploadRes?.fileId) {
        throw new Error('Upload succeeded without file identifier');
      }

      // Transition to PROCESSING
      store.setState((s) => {
        const items = s.state.data?.items.map((i: IngestionProgressItem) =>
          i.id === provisionalId ? { ...i, status: 'PROCESSING' as const } : i,
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

      markFileSucceeded(file, index, provisionalId, finalTitle, finalItemId, true);
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
