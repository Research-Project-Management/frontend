'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { IngestionService } from '../../services/ingestion.service';
import type {
  UnifiedIngestionPayload,
  UnifiedIngestionResponse,
  IngestionRunSnapshotResponse,
  UrlCapturePreviewResponse,
} from '../../schemas/ingestion.schema';
import type { Paper } from '../../types/library.types';

export function useUnifiedIngest(workspaceId: string) {
  const queryClient = useQueryClient();

  const ingestMutation = useMutation<
    UnifiedIngestionResponse,
    Error,
    UnifiedIngestionPayload
  >({
    mutationFn: (payload: UnifiedIngestionPayload) =>
      IngestionService.ingest(workspaceId, payload),
    onSuccess: () => {
      // Invalidate library papers and stats queries
      queryClient.invalidateQueries({
        queryKey: ['workspace', workspaceId, 'papers'],
      });
      queryClient.invalidateQueries({
        queryKey: ['papers', workspaceId],
      });
      queryClient.invalidateQueries({
        queryKey: ['papers'],
      });
      queryClient.invalidateQueries({
        queryKey: ['library', workspaceId],
      });
      queryClient.invalidateQueries({
        queryKey: ['library'],
      });
      queryClient.invalidateQueries({
        queryKey: ['workspace', workspaceId, 'collections'],
      });
      queryClient.invalidateQueries({
        queryKey: ['workspace', workspaceId, 'library-integrity'],
      });
    },
  });

  const captureUrlMutation = useMutation<
    UrlCapturePreviewResponse,
    Error,
    string
  >({
    mutationFn: (url: string) => IngestionService.captureUrl(workspaceId, url),
  });

  const confirmUrlMutation = useMutation<
    { success: boolean; data: Paper },
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
      queryClient.invalidateQueries({
        queryKey: ['workspace', workspaceId, 'papers'],
      });
    },
  });

  return {
    ingest: ingestMutation.mutateAsync,
    isIngesting: ingestMutation.isPending,
    ingestError: ingestMutation.error,
    captureUrl: captureUrlMutation.mutateAsync,
    isCapturingUrl: captureUrlMutation.isPending,
    captureUrlError: captureUrlMutation.error,
    confirmUrl: confirmUrlMutation.mutateAsync,
    isConfirmingUrl: confirmUrlMutation.isPending,
    confirmUrlError: confirmUrlMutation.error,
  };
}

export function useIngestionRunStatus(
  workspaceId: string,
  runId?: string,
  enabled: boolean = true,
) {
  return useQuery<IngestionRunSnapshotResponse, Error>({
    queryKey: ['workspace', workspaceId, 'ingestion-run', runId],
    queryFn: () => IngestionService.getRunStatus(workspaceId, runId!),
    enabled: Boolean(workspaceId && runId && enabled),
    refetchInterval: (query) => {
      const status = query.state.data?.data?.status;
      if (
        status === 'READY' ||
        status === 'FAILED' ||
        status === 'FAILED_FINAL' ||
        status === 'FAILED_RETRYABLE'
      ) {
        return false;
      }
      return 1500; // Poll every 1.5s while processing
    },
  });
}
