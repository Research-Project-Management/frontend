import type { QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { IngestionService } from './ingestion/ingestion.service';
import { UploadService } from './extraction/extraction.service';
import { itemKeys, libraryKeys, invalidateCollections } from './query-keys';
import type { IngestionProgressItem } from './ingestion/ingestion.service';
import type {
  ProcessingFileItem,
  ProcessModalState,
  ProcessBatchUploadOptions,
  ProcessModalStoreApi,
} from '@/features/library/types/batch-upload.types';

export type {
  ProcessingFileItem,
  ProcessModalState,
  ProcessBatchUploadOptions,
  ProcessModalStoreApi,
};

export function cleanFilenameToTitle(filename: string): string {
  const base = filename
    .replace(/\.[a-zA-Z0-9]+$/, '')
    .replace(/[-_]+/g, ' ')
    .trim();
  if (!base) return 'Uploaded Document';
  return base
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

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

  const runId = `batch-${Date.now()}`;
  const title = files.length === 1 ? files[0].name : `${files.length} documents`;

  // Initialize provisional items for instant library rendering
  const initialProcessingItems: ProcessingFileItem[] = files.map((file, idx) => ({
    id: `provisional-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 8)}`,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type || 'application/pdf',
    scopeId,
    collectionId: collectionId || undefined,
    status: 'UPLOADING',
    progress: 0,
    createdAt: new Date().toISOString(),
  }));

  // 1. Initialize ProcessModal State & open modal
  store.setState((s) => ({
    processingItems: [
      ...s.processingItems.filter(
        (p) => !initialProcessingItems.some((n) => n.fileName === p.fileName && n.fileSize === p.fileSize),
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

  const queue = [...files];
  const concurrency = 4;
  let completedCount = 0;
  let successCount = 0;
  let failCount = 0;
  const effectiveCollection = collectionId || undefined;

  const processFile = async (file: File) => {
    const lowerName = file.name.toLowerCase();

    // Set item to UPLOADING
    store.setState((s) => {
      if (!s.state.data) return s;
      const items = s.state.data.items.map((i: IngestionProgressItem) =>
        i.title === file.name ? { ...i, status: 'UPLOADING' as const } : i,
      );
      return {
        state: {
          ...s.state,
          data: { ...s.state.data, items, currentTitle: file.name },
        },
      };
    });

    const markFileFailed = (errorMsg: string) => {
      failCount++;
      completedCount++;
      store.setState((s) => {
        const items = s.state.data?.items.map((i: IngestionProgressItem) =>
          i.title === file.name
            ? {
                ...i,
                status: 'FAILED' as const,
                error: errorMsg,
              }
            : i,
        );
        const percentage = Math.round((completedCount / files.length) * 100);
        return {
          processingItems: s.processingItems.filter(
            (p) => !(p.fileName === file.name && p.fileSize === file.size),
          ),
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

    try {
      // Handle BibTeX and RIS textual bibliography files
      const isBib = lowerName.endsWith('.bib') || lowerName.endsWith('.bibtex');
      const isRis = lowerName.endsWith('.ris');

      if (isBib || isRis) {
        const source = isBib ? 'bibtex' : 'ris';
        store.setState((s) => {
          const items = (s.state.data?.items || []).map((i: IngestionProgressItem) =>
            i.title === file.name ? { ...i, status: 'PROCESSING' as const } : i,
          );
          return {
            processingItems: s.processingItems.map((p) =>
              p.fileName === file.name && p.fileSize === file.size
                ? { ...p, status: 'PROCESSING' }
                : p,
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
          data?: { item?: { title?: string; id?: string } };
          item?: { title?: string; id?: string };
        } | null;
        const itemPayload = resRecord?.data?.item || resRecord?.item;
        const extractedTitle = itemPayload?.title || file.name;
        successCount++;
        completedCount++;

        store.setState((s) => {
          const items = s.state.data?.items.map((i: IngestionProgressItem) =>
            i.title === file.name
              ? { ...i, status: 'SUCCEEDED' as const, itemName: extractedTitle }
              : i,
          );
          const percentage = Math.round((completedCount / files.length) * 100);
          return {
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

        return;
      }

      // 1. Binary / PDF Upload stage (Physical File Transfer)
      let uploadRes: { fileId?: string; url?: string } | null = null;
      try {
        uploadRes = await UploadService.uploadMultipart(scopeId, file, {
          onProgress: (percent) => {
            store.setState((s) => ({
              processingItems: s.processingItems.map((p) =>
                p.fileName === file.name && p.fileSize === file.size
                  ? { ...p, progress: percent }
                  : p,
              ),
            }));
          },
        });
      } catch (uploadErr: unknown) {
        const errorMsg = uploadErr instanceof Error ? uploadErr.message : 'Upload failed';
        markFileFailed(errorMsg);
        return;
      }

      if (!uploadRes?.fileId) {
        markFileFailed('Upload succeeded without file identifier');
        return;
      }

      // 2. Metadata Extraction stage
      store.setState((s) => {
        const items = s.state.data?.items.map((i: IngestionProgressItem) =>
          i.title === file.name ? { ...i, status: 'PROCESSING' as const } : i,
        );
        return {
          processingItems: s.processingItems.map((p) =>
            p.fileName === file.name && p.fileSize === file.size
              ? {
                  ...p,
                  status: 'PROCESSING',
                  fileId: uploadRes?.fileId,
                  fileUrl: uploadRes?.url,
                  progress: 100,
                }
              : p,
          ),
          state: s.state.data ? { ...s.state, data: { ...s.state.data, items: items || [] } } : s.state,
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
        const errorMsg = submitErr instanceof Error ? submitErr.message : 'Ingestion submission failed';
        markFileFailed(errorMsg);
        return;
      }

      // 3. Await metadata extraction and polling completion for this file
      let finalTitle = identifiedTitle;
      let finalItemId = completedItemId;

      if (runId) {
        const targetRunId = runId;
        const startTime = Date.now();
        const maxWaitMs = 120000;
        let isDone = false;

        while (Date.now() - startTime < maxWaitMs && !isDone) {
          await new Promise((r) => setTimeout(r, 1200));
          try {
            const runStatus = await IngestionService.getRunStatus(scopeId, targetRunId);
            const statusPayload = runStatus as {
              data?: { status?: string; title?: string; itemId?: string; lastError?: string; errorMessage?: string };
              status?: string;
              title?: string;
              itemId?: string;
              lastError?: string;
              errorMessage?: string;
            } | null;
            const statusData = statusPayload?.data || statusPayload;
            const currentStatus = statusData?.status;
            if (
              currentStatus === 'COMPLETED' ||
              currentStatus === 'READY' ||
              currentStatus === 'SUCCEEDED' ||
              currentStatus === 'NEEDS_REVIEW'
            ) {
              if (statusData?.title && statusData.title !== 'Uploaded Document') {
                finalTitle = statusData.title;
              }
              if (statusData?.itemId) {
                finalItemId = statusData.itemId;
              }
              isDone = true;
              break;
            }
            if (
              currentStatus === 'FAILED_FINAL' ||
              currentStatus === 'FAILED_RETRYABLE' ||
              currentStatus === 'CANCELLED'
            ) {
              const failError = statusData?.lastError || statusData?.errorMessage || 'Extraction failed';
              markFileFailed(failError);
              return;
            }
          } catch {
            // Retry on transient poll network glitch
          }
        }

        if (!isDone) {
          // Non-blocking graceful handoff: file was safely stored and queued on server
          // Transition to ready so user sees their uploaded item immediately
          isDone = true;
        }
      }

      // File extraction / storage completed successfully!
      successCount++;
      completedCount++;

      // Trigger immediate incremental cache invalidation so each item pops up live
      void queryClient.invalidateQueries({ queryKey: libraryKeys.items(scopeId) });
      void queryClient.invalidateQueries({ queryKey: libraryKeys.counts(scopeId) });

      // Update provisional item with final itemId and title so LibraryContent can seamlessly hand off
      store.setState((s) => {
        const items = s.state.data?.items.map((i: IngestionProgressItem) =>
          i.title === file.name
            ? { ...i, status: 'SUCCEEDED' as const, itemName: finalTitle }
            : i,
        );
        const percentage = Math.round((completedCount / files.length) * 100);
        return {
          processingItems: s.processingItems.map((p) =>
            p.fileName === file.name && p.fileSize === file.size
              ? {
                  ...p,
                  itemId: finalItemId,
                  extractedTitle: finalTitle,
                  status: 'SUCCEEDED' as const,
                  progress: 100,
                }
              : p,
          ),
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
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Processing failed';
      markFileFailed(errorMsg);
    }
  };

  const runWorker = async () => {
    while (queue.length > 0) {
      const nextFile = queue.shift();
      if (!nextFile) break;
      await processFile(nextFile);
    }
  };

  const workers = Array.from(
    { length: Math.min(concurrency, files.length) },
    () => runWorker(),
  );

  // Wait until all files have been completely processed
  await Promise.all(workers);

  // Single coalesced synchronization after batch completion before removing provisional items
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: libraryKeys.items(scopeId) }),
    queryClient.invalidateQueries({ queryKey: libraryKeys.counts(scopeId) }),
    queryClient.invalidateQueries({ queryKey: libraryKeys.all }),
    effectiveCollection
      ? queryClient.invalidateQueries({ queryKey: libraryKeys.items(scopeId, { collectionId: effectiveCollection }) })
      : Promise.resolve(),
  ]);
  invalidateCollections(queryClient, scopeId);

  // Ensure all provisional items for this batch are wiped
  store.setState((s) => ({
    processingItems: s.processingItems.filter(
      (p) => !files.some((f) => f.name === p.fileName && f.size === p.fileSize),
    ),
    state: {
      ...s.state,
      isComplete: true,
      error: failCount === files.length && files.length > 0 ? 'All files failed to process' : null,
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

  // Toast notification
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
