'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { IngestionService } from '../../services/ingestion.service';
import type {
  UnifiedIngestionPayload,
  UnifiedIngestionResponse,
  IngestionRunSnapshotResponse,
  UrlCapturePreviewResponse,
} from '../../schemas/ingestion.schema';
import { itemKeys } from './use-items';

export const ingestKeys = {
  all: ['ingest'] as const,
  status: (workspaceId: string, runId?: string) =>
    ['ingest', workspaceId, runId || 'none'] as const,
};

export function useIngest(workspaceId: string) {
  const queryClient = useQueryClient();

  const invalidateLibrary = () => {
    queryClient.invalidateQueries({ queryKey: itemKeys.all(workspaceId) });
    queryClient.invalidateQueries({ queryKey: ['library', workspaceId] });
    queryClient.invalidateQueries({ queryKey: ['items'] });
    queryClient.invalidateQueries({ queryKey: ['papers'] });
  };

  const monitorRun = async (runId: string, silent?: boolean) => {
    for (let attempt = 0; attempt < 90; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      try {
        const response = await IngestionService.getRunStatus(workspaceId, runId);
        const snapshot = response?.data || response;
        const status = String(snapshot?.status || '').toUpperCase();

        if (status === 'READY' || status === 'COMMITTED') {
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
          if (!silent) {
            toast.warning('Import needs review', {
              description: 'A possible duplicate needs your decision.',
              id: `library-ingestion-${runId}`,
            });
          }
          return;
        }

        if (status === 'FAILED_FINAL' || status === 'FAILED_RETRYABLE') {
          if (!silent) {
            toast.error('Ingestion failed', {
              description: 'The import could not be completed. You can retry it from the activity status.',
              id: `library-ingestion-${runId}`,
            });
          }
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
      IngestionService.ingest(workspaceId, payload),
    onSuccess: (data, variables) => {
      invalidateLibrary();
      const runId = data?.data?.runId;
      if (runId) {
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
    mutationFn: (url: string) => IngestionService.captureUrl(workspaceId, url),
    onError: (err: any) => {
      toast.error('URL capture failed', {
        description: err?.message || 'Could not parse document from URL.',
        id: 'capture-url',
      });
    },
  });

  const confirmUrlMutation = useMutation<
    { success: boolean; data: { id: string; title: string; doi?: string; year?: number; citationKey?: string } },
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
    mutationFn: (payload) => IngestionService.confirmUrl(workspaceId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: itemKeys.all(workspaceId) });
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
  workspaceId: string | null,
  runId?: string | null,
  options?: { enabled?: boolean; refetchInterval?: number | false },
) {
  return useQuery<IngestionRunSnapshotResponse | null, Error>({
    queryKey: ingestKeys.status(workspaceId || '', runId || ''),
    queryFn: () => {
      if (!workspaceId || !runId) return Promise.resolve(null);
      return IngestionService.getRunStatus(workspaceId, runId);
    },
    enabled: Boolean(workspaceId && runId && (options?.enabled ?? true)),
    refetchInterval: (query) => {
      if (options?.refetchInterval !== undefined) return options.refetchInterval;
      const data = query.state.data;
      if (!data) return 1000;
      const status = (data as any)?.status || (data as any)?.data?.status;
      if (status === 'queued' || status === 'running' || status === 'pending') {
        return 2000;
      }
      return false;
    },
  });
}

// ── Backward-compatible Aliases ───────────────────────────────────────────────
export const useUnifiedIngest = useIngest;
export const useIngestionRunStatus = useIngestStatus;
export const useAsyncJobStatus = useIngestStatus;

// ── Identifier & DOI Resolution ───────────────────────────────────────────────
import { CitationService } from '../../services/citation.service';

/**
 * Hook that wraps CitationService for identifier/DOI resolution.
 * Components call this; they never touch the service layer directly.
 */
export function useResolveIdentifier(workspaceId?: string) {
  const resolveMutation = useMutation<
    any,
    Error,
    { query: string }
  >({
    mutationFn: ({ query }) =>
      CitationService.resolve(query, workspaceId),
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
