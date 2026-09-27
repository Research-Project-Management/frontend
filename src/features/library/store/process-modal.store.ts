import { create } from 'zustand';
import type { QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  uploadLibraryFileMultipart,
  IngestionService,
  itemKeys,
  invalidateCollections,
} from '../data';
import type { ProcessModalState } from '../data';

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

export interface ProcessModalStore {
  state: ProcessModalState;
  processingItems: ProcessingFileItem[];
  dismissProcessingItem: (id: string) => void;
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

export const useProcessModalStore = create<ProcessModalStore>((set, get) => ({
  state: initialModalState,
  processingItems: [],

  dismissProcessingItem: (id: string) => {
    set((s) => ({
      processingItems: s.processingItems.filter((p) => p.id !== id),
    }));
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
    set((s) => ({
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
            status: (idx === 0 ? 'UPLOADING' : 'PENDING') as any,
          })),
          startedAt: new Date().toISOString(),
        },
      },
    }));

    const queue = [...files];
    const concurrency = 2;
    let completedCount = 0;
    let successCount = 0;
    let failCount = 0;

    const processFile = async (file: File) => {
      const lowerName = file.name.toLowerCase();
      const effectiveCollection = collectionId || undefined;

      // Set item to UPLOADING
      set((s) => {
        if (!s.state.data) return s;
        const items = s.state.data.items.map((i) =>
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
        set((s) => {
          const items = s.state.data?.items.map((i) =>
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
            processingItems: s.processingItems.map((p) =>
              p.fileName === file.name && p.fileSize === file.size
                ? {
                    ...p,
                    status: 'FAILED',
                    error: errorMsg,
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
          set((s) => {
            const items = (s.state.data?.items || []).map((i) =>
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
          const createdItemId = itemPayload?.id;
          successCount++;
          completedCount++;

          set((s) => {
            const items = s.state.data?.items.map((i) =>
              i.title === file.name
                ? { ...i, status: 'SUCCEEDED' as const, itemName: extractedTitle }
                : i,
            );
            const percentage = Math.round((completedCount / files.length) * 100);
            return {
              processingItems: s.processingItems.map((p) =>
                p.fileName === file.name && p.fileSize === file.size
                  ? {
                      ...p,
                      status: 'SUCCEEDED',
                      extractedTitle,
                      itemId: createdItemId,
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

          // Invalidate cache immediately for this completed file
          queryClient.invalidateQueries({ queryKey: itemKeys.all(scopeId) });
          queryClient.invalidateQueries({ queryKey: ['library', 'items', scopeId] });
          if (effectiveCollection) {
            queryClient.invalidateQueries({
              queryKey: itemKeys.byCollection(scopeId, effectiveCollection),
            });
          }

          setTimeout(() => {
            set((s) => ({
              processingItems: s.processingItems.filter(
                (p) => !(p.fileName === file.name && p.fileSize === file.size),
              ),
            }));
          }, 2000);

          return;
        }

        // 1. Binary / PDF Upload stage (Physical File Transfer)
        let uploadRes: { fileId?: string; url?: string } | null = null;
        try {
          uploadRes = await uploadLibraryFileMultipart(scopeId, file, {
            onProgress: (percent) => {
              set((s) => ({
                processingItems: s.processingItems.map((p) =>
                  p.fileName === file.name && p.fileSize === file.size
                    ? { ...p, progress: percent }
                    : p,
                ),
              }));
            },
          });
        } catch (uploadErr: unknown) {
          // Physical transport error (network disconnection, file size > 100MB, storage error)
          const errorMsg = uploadErr instanceof Error ? uploadErr.message : 'Upload failed';
          markFileFailed(errorMsg);
          return;
        }

        if (!uploadRes?.fileId) {
          markFileFailed('Upload succeeded without file identifier');
          return;
        }

        // 2. Metadata Extraction stage (Zotero Graceful Degradation)
        // File is stored in physical storage; now extract metadata via background pipeline
        set((s) => {
          const items = s.state.data?.items.map((i) =>
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

        let identifiedTitle = cleanFilenameToTitle(file.name);
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
            data?: { runId?: string; itemId?: string };
            runId?: string;
            itemId?: string;
          } | null;
          runId = ingestPayload?.data?.runId || ingestPayload?.runId;
          completedItemId = ingestPayload?.data?.itemId || ingestPayload?.itemId;
        } catch {
          // If metadata ingestion submission endpoint is unreachable, file remains securely attached.
        }

        // Successfully preserved in library - file upload completed
        successCount++;
        completedCount++;

        set((s) => {
          const items = s.state.data?.items.map((i) =>
            i.title === file.name
              ? { ...i, status: 'SUCCEEDED' as const, itemName: identifiedTitle }
              : i,
          );
          const percentage = Math.round((completedCount / files.length) * 100);
          return {
            processingItems: s.processingItems.map((p) =>
              p.fileName === file.name && p.fileSize === file.size
                ? {
                    ...p,
                    status: 'SUCCEEDED',
                    extractedTitle: identifiedTitle,
                    itemId: completedItemId,
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

        // Trigger reactive per-file cache invalidation so the row updates in real time
        queryClient.invalidateQueries({ queryKey: itemKeys.all(scopeId) });
        queryClient.invalidateQueries({ queryKey: ['library', 'items', scopeId] });
        if (effectiveCollection) {
          queryClient.invalidateQueries({
            queryKey: itemKeys.byCollection(scopeId, effectiveCollection),
          });
        }

        // Non-blocking background metadata polling (Zotero Graceful Enrichment)
        // Does NOT block the concurrency queue from uploading the next files!
        if (runId) {
          const targetRunId = runId;
          void (async () => {
            const startTime = Date.now();
            const maxWaitMs = 60000;
            while (Date.now() - startTime < maxWaitMs) {
              await new Promise((r) => setTimeout(r, 1500));
              try {
                const runStatus = await IngestionService.getRunStatus(scopeId, targetRunId);
                const statusPayload = runStatus as {
                  data?: { status?: string; title?: string; itemId?: string };
                  status?: string;
                  title?: string;
                  itemId?: string;
                } | null;
                const statusData = statusPayload?.data || statusPayload;
                const currentStatus = statusData?.status;
                if (currentStatus === 'COMPLETED' || currentStatus === 'READY') {
                  const finalTitle =
                    statusData?.title && statusData.title !== 'Uploaded Document'
                      ? statusData.title
                      : identifiedTitle;
                  set((s) => ({
                    processingItems: s.processingItems.map((p) =>
                      p.fileName === file.name && p.fileSize === file.size
                        ? {
                            ...p,
                            extractedTitle: finalTitle,
                            itemId: statusData?.itemId || completedItemId,
                          }
                        : p,
                    ),
                    state: s.state.data
                      ? {
                          ...s.state,
                          data: {
                            ...s.state.data,
                            items: s.state.data.items.map((it) =>
                              it.title === file.name
                                ? {
                                    ...it,
                                    itemName: finalTitle,
                                    status: 'SUCCEEDED' as const,
                                  }
                                : it,
                            ),
                          },
                        }
                      : s.state,
                  }));
                  queryClient.invalidateQueries({ queryKey: itemKeys.all(scopeId) });
                  queryClient.invalidateQueries({ queryKey: ['library', 'items', scopeId] });
                  break;
                }
                if (
                  currentStatus === 'FAILED_FINAL' ||
                  currentStatus === 'FAILED_RETRYABLE'
                ) {
                  break;
                }
              } catch {
                break;
              }
            }
          })();
        }

        // Seamless handover: remove provisional placeholder after 2.5s
        setTimeout(() => {
          set((s) => ({
            processingItems: s.processingItems.filter(
              (p) => !(p.fileName === file.name && p.fileSize === file.size),
            ),
          }));
        }, 2500);
      } catch (err: unknown) {
        // Fallback for unexpected errors
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

    await Promise.all(workers);

    // Mark completion
    set((s) => ({
      state: {
        ...s.state,
        isComplete: true,
        error: failCount === files.length && files.length > 0 ? 'All files failed to process' : null,
        data: s.state.data
          ? {
              ...s.state.data,
              status: failCount === files.length ? 'FAILED_FINAL' : 'COMPLETED',
              percentage: 100,
              completedAt: new Date().toISOString(),
            }
          : null,
      },
    }));

    // Invalidate TanStack query cache for library
    queryClient.invalidateQueries({ queryKey: itemKeys.all(scopeId) });
    queryClient.invalidateQueries({ queryKey: ['items', scopeId] });
    if (collectionId) {
      queryClient.invalidateQueries({
        queryKey: itemKeys.byCollection(scopeId, collectionId),
      });
    }
    invalidateCollections(queryClient, scopeId);

    // Toast notification
    if (successCount > 0) {
      toast.success(
        files.length === 1
          ? 'Document imported successfully'
          : `Imported ${successCount} of ${files.length} documents`,
        {
          description: 'Metadata and attachments are ready in your library.',
        },
      );
      if (onSuccess) onSuccess();
    } else if (failCount > 0) {
      toast.error('Import failed', {
        description: 'None of the documents could be processed.',
      });
    }
  },
}));
