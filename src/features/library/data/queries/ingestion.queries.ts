'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { IngestionService, type IngestionProgressResponse } from '../services/ingestion.service';
import { CitationService } from '../services/citation.service';
import type {
  UnifiedIngestionPayload,
  UnifiedIngestionResponse,
  IngestionRunSnapshotResponse,
  UrlCapturePreviewResponse,
} from '../../types';
import { itemKeys } from '../query-keys';

export type { IngestionProgressResponse };

export interface ProcessModalState {
  isOpen: boolean;
  isMinimized: boolean;
  runId: string | null;
  fileName: string;
  data: IngestionProgressResponse | null;
  isComplete: boolean;
  error: string | null;
}

export const ingestKeys = {
  all: ['ingest'] as const,
  status: (scopeId: string, runId?: string) =>
    ['ingest', scopeId, runId || 'none'] as const,
};

export function useIngestProgress(scopeId: string = 'user') {
  const queryClient = useQueryClient();
  const [modalState, setModalState] = useState<ProcessModalState>({
    isOpen: false,
    isMinimized: false,
    runId: null,
    fileName: '',
    data: null,
    isComplete: false,
    error: null,
  });

  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const activeRunIdRef = useRef<string | null>(null);
  const pollRef = useRef<((runId: string) => Promise<void>) | undefined>(undefined);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const poll = useCallback(
    async (runId: string) => {
      if (activeRunIdRef.current !== runId) return;

      try {
        const progress = await IngestionService.getRunProgress(scopeId, runId);
        if (activeRunIdRef.current !== runId) return;

        const isTerminal =
          progress.status === 'READY' ||
          progress.status === 'COMPLETED' ||
          progress.status === 'FAILED_FINAL' ||
          progress.status === 'FAILED_RETRYABLE';

        setModalState((prev) => ({
          ...prev,
          data: progress,
          isComplete: isTerminal,
          error:
            progress.status === 'FAILED_FINAL' || progress.status === 'FAILED_RETRYABLE'
              ? 'Ingestion was interrupted or encountered errors.'
              : null,
        }));

        if (isTerminal) {
          stopPolling();
          queryClient.invalidateQueries({ queryKey: itemKeys.all(scopeId) });
          queryClient.invalidateQueries({ queryKey: ['library', scopeId] });
          queryClient.invalidateQueries({ queryKey: ['items'] });
          queryClient.invalidateQueries({ queryKey: ['papers'] });
        } else {
          pollTimerRef.current = setTimeout(() => pollRef.current?.(runId), 600);
        }
      } catch {
        if (activeRunIdRef.current === runId) {
          pollTimerRef.current = setTimeout(() => pollRef.current?.(runId), 1200);
        }
      }
    },
    [scopeId, queryClient, stopPolling],
  );

  pollRef.current = poll;

  const startMonitoring = useCallback(
    (runId: string, fileName = 'References') => {
      stopPolling();
      activeRunIdRef.current = runId;
      setModalState({
        isOpen: true,
        isMinimized: false,
        runId,
        fileName,
        data: {
          runId,
          scopeId,
          status: 'RECEIVED',
          total: 1,
          processed: 0,
          percentage: 0,
          succeeded: 0,
          duplicates: 0,
          failed: 0,
          currentTitle: fileName,
          items: [],
          startedAt: new Date().toISOString(),
        },
        isComplete: false,
        error: null,
      });

      pollTimerRef.current = setTimeout(() => poll(runId), 300);
    },
    [scopeId, poll, stopPolling],
  );

  const startBatchProgress = useCallback(
    (files: { id?: string; name: string }[], batchTitle = '') => {
      stopPolling();
      activeRunIdRef.current = null;
      const total = files.length;
      const title = batchTitle || (total === 1 ? files[0].name : `${total} documents`);
      setModalState({
        isOpen: true,
        isMinimized: false,
        runId: 'batch-upload',
        fileName: title,
        data: {
          runId: 'batch-upload',
          scopeId,
          status: 'PROCESSING',
          total,
          processed: 0,
          percentage: 0,
          succeeded: 0,
          duplicates: 0,
          failed: 0,
          currentTitle: files[0]?.name || title,
          items: files.map((f, idx) => ({
            title: f.name,
            status: (idx === 0 ? 'PROCESSING' : 'PENDING') as any,
          })),
          startedAt: new Date().toISOString(),
        },
        isComplete: false,
        error: null,
      });
    },
    [scopeId, stopPolling],
  );

  const updateBatchItem = useCallback(
    (
      fileName: string,
      status: 'SUCCEEDED' | 'DUPLICATE' | 'FAILED' | 'PROCESSING' | 'UPLOADING' | 'PENDING',
      error?: string,
      itemName?: string,
    ) => {
      setModalState((prev) => {
        if (!prev.data) return prev;
        let matched = false;
        const normalizedTarget = (fileName || '').trim().toLowerCase();
        const baseTarget = normalizedTarget.split(/[/\\]/).pop() || normalizedTarget;

        const items = prev.data.items.map((item) => {
          const itemTitle = (item.title || '').trim().toLowerCase();
          const itemBase = itemTitle.split(/[/\\]/).pop() || itemTitle;
          const isMatch =
            item.title === fileName ||
            itemTitle === normalizedTarget ||
            itemBase === baseTarget;

          if (isMatch) {
            matched = true;
            return {
              ...item,
              status: status as any,
              error: error || item.error,
              itemName: itemName || (item as any).itemName,
            };
          }
          return item;
        });

        const finalItems = matched
          ? items
          : [...items, { title: fileName, status: status as any, error, itemName } as any];
        const processed = finalItems.filter((i) => i.status === 'SUCCEEDED' || i.status === 'DUPLICATE' || i.status === 'FAILED').length;
        const succeeded = finalItems.filter((i) => i.status === 'SUCCEEDED').length;
        const duplicates = finalItems.filter((i) => i.status === 'DUPLICATE').length;
        const failed = finalItems.filter((i) => i.status === 'FAILED').length;
        const total = Math.max(prev.data.total, finalItems.length);
        const percentage = Math.min(100, Math.round((processed / total) * 100));
        const isComplete = processed >= total && total > 0;

        return {
          ...prev,
          isComplete,
          data: {
            ...prev.data,
            items: finalItems,
            processed,
            succeeded,
            duplicates,
            failed,
            percentage,
            currentTitle: fileName,
            completedAt: isComplete ? new Date().toISOString() : undefined,
          },
        };
      });
    },
    [],
  );

  const finishBatchProgress = useCallback(
    (errorMessage?: string) => {
      setModalState((prev) => {
        if (!prev.data) return prev;
        const updatedItems = prev.data.items.map((item) => {
          const itemStatus = item.status as string;
          const isStillRunning =
            itemStatus !== 'SUCCEEDED' &&
            itemStatus !== 'FAILED' &&
            itemStatus !== 'DUPLICATE';

          if (!errorMessage && isStillRunning) {
            return {
              ...item,
              status: 'SUCCEEDED' as const,
              itemName: (item as any).itemName || item.title,
            };
          }
          return item;
        });

        const succeeded = updatedItems.filter((i) => i.status === 'SUCCEEDED').length;
        const duplicates = updatedItems.filter((i) => i.status === 'DUPLICATE').length;
        const failed = updatedItems.filter((i) => i.status === 'FAILED').length;

        return {
          ...prev,
          isComplete: true,
          error: errorMessage || null,
          data: {
            ...prev.data,
            items: updatedItems,
            processed: updatedItems.length,
            succeeded,
            duplicates,
            failed,
            status: errorMessage ? 'FAILED_FINAL' : 'COMPLETED',
            percentage: 100,
            completedAt: new Date().toISOString(),
          },
        };
      });
      queryClient.invalidateQueries({ queryKey: itemKeys.all(scopeId) });
      queryClient.invalidateQueries({ queryKey: ['library', scopeId] });
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['papers'] });
    },
    [scopeId, queryClient],
  );

  const closeModal = useCallback(() => {
    stopPolling();
    activeRunIdRef.current = null;
    setModalState((prev) => ({ ...prev, isOpen: false, runId: null }));
  }, [stopPolling]);

  const toggleMinimize = useCallback(() => {
    setModalState((prev) => ({ ...prev, isMinimized: !prev.isMinimized }));
  }, []);

  useEffect(() => {
    return () => {
      stopPolling();
      activeRunIdRef.current = null;
    };
  }, [stopPolling]);

  return {
    modalState,
    startMonitoring,
    startBatchProgress,
    updateBatchItem,
    finishBatchProgress,
    closeModal,
    toggleMinimize,
  };
}

export function useIngestion(scopeId: string = 'user') {
  const queryClient = useQueryClient();
  const isMonitoringActiveRef = useRef<boolean>(false);

  useEffect(() => {
    return () => {
      isMonitoringActiveRef.current = false;
    };
  }, []);

  const invalidateLibrary = () => {
    queryClient.invalidateQueries({ queryKey: itemKeys.all(scopeId) });
    queryClient.invalidateQueries({ queryKey: ['library', scopeId] });
    queryClient.invalidateQueries({ queryKey: ['items'] });
    queryClient.invalidateQueries({ queryKey: ['papers'] });
  };

  const monitorRun = async (runId: string, silent?: boolean) => {
    for (let attempt = 0; attempt < 90; attempt += 1) {
      if (!isMonitoringActiveRef.current) return;
      await new Promise((resolve) => setTimeout(resolve, 2000));
      if (!isMonitoringActiveRef.current) return;
      try {
        const response = await IngestionService.getRunStatus(scopeId, runId);
        const snapshot: any = (response as any)?.data || response;
        const status = String(snapshot?.status || '').toUpperCase();

        if (status === 'READY' || status === 'COMMITTED' || status === 'COMPLETED') {
          invalidateLibrary();
          if (!silent) {
            toast.success('Document added', {
              description: 'Metadata and attachments are ready in your library.',
              id: `library-ingestion-${runId}`,
            });
          }
          return;
        }

        if (status === 'NEEDS_REVIEW') {
          invalidateLibrary();
          const docTitle = snapshot?.inputParams?.payload?.filename || 'A document';
          toast.warning('Import needs review', {
            description: `"${docTitle}" has a possible duplicate in your library and needs review.`,
            id: `library-ingestion-${runId}`,
          });
          return;
        }

        if (status === 'FAILED_FINAL' || status === 'FAILED_RETRYABLE') {
          const docTitle = snapshot?.inputParams?.payload?.filename || 'Document';
          toast.error('Ingestion failed', {
            description: `"${docTitle}" could not be processed: ${snapshot?.lastError || 'Pipeline error'}.`,
            id: `library-ingestion-${runId}`,
          });
          return;
        }
      } catch {
        // Retry transient poll
      }
    }
  };

  const ingestMutation = useMutation<
    UnifiedIngestionResponse,
    Error,
    UnifiedIngestionPayload
  >({
    mutationFn: (payload: UnifiedIngestionPayload) =>
      IngestionService.ingest(scopeId, payload),
    onSuccess: (data, variables) => {
      invalidateLibrary();
      const runId = data?.data?.runId;
      if (runId) {
        isMonitoringActiveRef.current = true;
        void monitorRun(runId, Boolean((variables as any)?.silent));
      }
      if (!(variables as any)?.silent) {
        toast.success('Import started', {
          description: 'The document is being processed in the background.',
          id: `library-ingestion-${runId || 'pending'}`,
        });
      }
    },
    onError: (err: any) => {
      toast.error('Ingestion failed', {
        description: err?.message || 'Could not add document to library.',
        id: 'library-ingestion',
      });
    },
  });

  const captureUrlMutation = useMutation<
    UrlCapturePreviewResponse,
    Error,
    string
  >({
    mutationFn: (url: string) => IngestionService.captureUrl(scopeId, url),
    onError: (err: any) => {
      toast.error('URL capture failed', {
        description: err?.message || 'Could not parse document from URL.',
        id: 'capture-url',
      });
    },
  });

  const confirmUrlMutation = useMutation<
    { id: string; title: string; doi?: string; year?: number; citationKey?: string },
    Error,
    {
      url: string;
      previewToken?: string;
      title?: string;
      abstract?: string;
      doi?: string;
      year?: number;
      publicationTitle?: string;
      itemType?: string;
      collectionId?: string;
    }
  >({
    mutationFn: (payload) => IngestionService.confirmUrl(scopeId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: itemKeys.all(scopeId) });
      toast.success('Document added', {
        description: 'Imported from URL into your library.',
        id: 'confirm-url',
      });
    },
    onError: (err: any) => {
      toast.error('Import failed', {
        description: err?.message || 'Failed to import document from URL.',
        id: 'confirm-url',
      });
    },
  });

  const state = {
    isIngesting: ingestMutation.isPending,
    ingestError: ingestMutation.error,
    isCapturingUrl: captureUrlMutation.isPending,
    captureUrlError: captureUrlMutation.error,
    isConfirmingUrl: confirmUrlMutation.isPending,
    confirmUrlError: confirmUrlMutation.error,
  };

  const actions = {
    ingest: ingestMutation.mutateAsync,
    captureUrl: captureUrlMutation.mutateAsync,
    confirmUrl: confirmUrlMutation.mutateAsync,
  };

  return {
    state,
    actions,
    ...state,
    ...actions,
  };
}

export function useIngestStatus(
  scopeId: string | null,
  runId?: string | null,
  options?: { enabled?: boolean; refetchInterval?: number | false },
) {
  return useQuery<IngestionRunSnapshotResponse | null, Error>({
    queryKey: ingestKeys.status(scopeId || '', runId || ''),
    queryFn: () => {
      if (!scopeId || !runId) return Promise.resolve(null);
      return IngestionService.getRunStatus(scopeId, runId);
    },
    enabled: Boolean(scopeId && runId && (options?.enabled ?? true)),
    refetchInterval: (query) => {
      if (options?.refetchInterval !== undefined) return options.refetchInterval;
      const data = query.state.data;
      if (!data) return 1000;
      const rawStatus = (data as any)?.status || (data as any)?.data?.status;
      const status = String(rawStatus || '').toUpperCase();
      if (
        status === 'READY' ||
        status === 'COMPLETED' ||
        status === 'COMMITTED' ||
        status === 'FAILED_FINAL' ||
        status === 'FAILED'
      ) {
        return false;
      }
      return 2000;
    },
  });
}

export function useResolveIdentifier(scopeId?: string) {
  const resolveMutation = useMutation<
    any,
    Error,
    { query: string }
  >({
    mutationFn: ({ query }) =>
      CitationService.resolve(query, scopeId),
    onSuccess: (res) => {
      if (res?.metadata?.title) {
        toast.success('Metadata resolved', {
          description: `Resolved via ${res.provider || 'identifier'}.`,
          id: 'resolve-identifier',
        });
      }
    },
    onError: (err: any) => {
      toast.error('Resolution failed', {
        description: err?.message || 'Could not resolve identifier.',
        id: 'resolve-identifier',
      });
    },
  });

  const resolveDoiMutation = useMutation<
    any,
    Error,
    { doi: string }
  >({
    mutationFn: ({ doi }) => CitationService.resolveDoi(doi),
    onSuccess: (meta) => {
      if (meta?.title) {
        toast.success('Metadata resolved', {
          description: 'Bibliographic details loaded from CrossRef.',
          id: 'resolve-identifier',
        });
      }
    },
    onError: (err: any) => {
      toast.error('Resolution failed', {
        description: err?.message || 'Could not resolve DOI.',
        id: 'resolve-identifier',
      });
    },
  });

  return {
    resolve: resolveMutation.mutateAsync,
    resolveDoi: resolveDoiMutation.mutateAsync,
    isResolving: resolveMutation.isPending || resolveDoiMutation.isPending,
    resolveError: resolveMutation.error || resolveDoiMutation.error,
  };
}

export const useIngest = useIngestion;
export const useUnifiedIngest = useIngestion;
export const useIngestionRunStatus = useIngestStatus;
export const useAsyncJobStatus = useIngestStatus;
