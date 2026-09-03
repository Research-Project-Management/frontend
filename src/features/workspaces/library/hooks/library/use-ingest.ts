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

  const ingestMutation = useMutation<
    UnifiedIngestionResponse,
    Error,
    UnifiedIngestionPayload
  >({
    mutationFn: (payload: UnifiedIngestionPayload) =>
      IngestionService.ingest(workspaceId, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: itemKeys.all(workspaceId) });
      queryClient.invalidateQueries({ queryKey: ['library', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['papers'] });
      if (!(variables as any)?.silent) {
        toast.success('Document added', {
          description: 'Added to your library catalog.',
          id: 'library-ingestion',
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
