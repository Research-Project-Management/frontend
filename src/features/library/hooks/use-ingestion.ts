'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useRef, useEffect } from 'react';
import { IngestionService } from '../services/ingestion.service';
import type {
  UnifiedIngestionPayload,
  UnifiedIngestionResponse,
  IngestionRunSnapshotResponse,
  UrlCapturePreviewResponse,
} from '../schemas/ingestion.schema';
import { itemKeys } from './use-items';

export const ingestKeys = {
  all: ['ingest'] as const,
  status: (scopeId: string, runId?: string) =>
    ['ingest', scopeId, runId || 'none'] as const,
};

export function useIngestion(scopeId: string = 'user') {
  const queryClient = useQueryClient();

  // IG-1: Cancellation flag — set false on unmount to break the async polling loop
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
      // IG-1: Bail out immediately if the component has unmounted
      if (!isMonitoringActiveRef.current) return;
      await new Promise((resolve) => setTimeout(resolve, 2000));
      // IG-1: Re-check after the await in case unmount occurred during sleep
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
        // A transient status-poll failure must not turn an accepted import into
        // a failed import. The next bounded poll retries it.
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
        // IG-1: Activate cancellation guard before starting the async loop
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
      // Terminal statuses — stop polling
      if (
        status === 'READY' ||
        status === 'COMPLETED' ||
        status === 'COMMITTED' ||
        status === 'FAILED_FINAL' ||
        status === 'FAILED'
      ) {
        return false;
      }
      // Non-terminal statuses — keep polling
      if (
        status === 'QUEUED' ||
        status === 'RUNNING' ||
        status === 'PENDING' ||
        status === 'PROCESSING' ||
        status === 'RECEIVED' ||
        status === 'EXTRACTING' ||
        status === 'NORMALIZING' ||
        status === 'RECONCILING' ||
        status === 'INDEXING' ||
        status === 'ENRICHING' ||
        status === 'DETECTED' ||
        status === 'EXTRACTED' ||
        status === 'RESOLVED' ||
        status === 'NORMALIZED' ||
        status === 'MERGED' ||
        status === 'NEEDS_REVIEW'
      ) {
        return 2000;
      }
      // Unknown status — poll conservatively
      return 2000;
    },
  });
}

// ── Backward-compatible Aliases ───────────────────────────────────────────────
export const useIngest = useIngestion;
export const useUnifiedIngest = useIngestion;
export const useIngestionRunStatus = useIngestStatus;
export const useAsyncJobStatus = useIngestStatus;

// ── Identifier & DOI Resolution ───────────────────────────────────────────────
import { CitationService } from '../services/citation.service';

/**
 * Hook that wraps CitationService for identifier/DOI resolution.
 * Components call this; they never touch the service layer directly.
 */
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
