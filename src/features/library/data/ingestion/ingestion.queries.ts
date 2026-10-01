'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  IngestionService,
  QualityService,
  RetractionService,
  type IngestionProgressResponse,
} from './ingestion.service';
import { CitationService } from '../citation/citation.service';
import type {
  UnifiedIngestionPayload,
  UnifiedIngestionResponse,
  IngestionRunSnapshotResponse,
  UrlCapturePreviewResponse,
} from '../../types';
import type { FlagRetractionInput } from '../../types/library.types';
import { itemKeys, libraryKeys } from '../query-keys';

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

        setModalState((prev) => ({
          ...prev,
          data: progress,
          isComplete: progress.status === 'COMPLETED' || progress.status === 'FAILED',
          error: progress.status === 'FAILED' ? 'Import process encountered errors.' : null,
        }));

        if (progress.status === 'COMPLETED') {
          stopPolling();
          queryClient.invalidateQueries({ queryKey: itemKeys.all(scopeId) });
          toast.success('Batch import complete', {
            description: `Imported ${progress.succeeded} item(s).`,
            id: 'batch-import-progress',
          });
        } else if (progress.status === 'FAILED') {
          stopPolling();
          toast.error('Batch import failed', {
            description: `${progress.failed} item(s) failed to import.`,
            id: 'batch-import-progress',
          });
        } else {
          pollTimerRef.current = setTimeout(() => {
            pollRef.current?.(runId);
          }, 1500);
        }
      } catch (err: any) {
        if (activeRunIdRef.current !== runId) return;
        setModalState((prev) => ({
          ...prev,
          isComplete: true,
          error: err?.message || 'Error tracking import progress.',
        }));
        stopPolling();
      }
    },
    [scopeId, queryClient, stopPolling],
  );

  pollRef.current = poll;

  const startTracking = useCallback(
    (runId: string, fileName: string = 'Batch Import') => {
      stopPolling();
      activeRunIdRef.current = runId;
      setModalState({
        isOpen: true,
        isMinimized: false,
        runId,
        fileName,
        data: null,
        isComplete: false,
        error: null,
      });
      poll(runId);
    },
    [poll, stopPolling],
  );

  const closeModal = useCallback(() => {
    stopPolling();
    activeRunIdRef.current = null;
    setModalState((prev) => ({ ...prev, isOpen: false }));
  }, [stopPolling]);

  const minimizeModal = useCallback(() => {
    setModalState((prev) => ({ ...prev, isMinimized: true }));
  }, []);

  const expandModal = useCallback(() => {
    setModalState((prev) => ({ ...prev, isMinimized: false }));
  }, []);

  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  return {
    modalState,
    startTracking,
    closeModal,
    minimizeModal,
    expandModal,
  };
}

export function useIngestStatus(scopeId?: string, runId?: string) {
  const queryClient = useQueryClient();
  const effectiveScope = scopeId || 'user';

  return useQuery<IngestionRunSnapshotResponse>({
    queryKey: ingestKeys.status(effectiveScope, runId),
    queryFn: () => IngestionService.getRunStatus(effectiveScope, runId!),
    enabled: Boolean(runId),
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 1500;
      const status = data.data?.status;
      if (status === 'COMPLETED' || status === 'FAILED') {
        return false;
      }
      return 1500;
    },
  });
}

export function useUrlCapture(scopeId?: string) {
  const queryClient = useQueryClient();
  const effectiveScope = scopeId || 'user';

  const previewMutation = useMutation<
    UrlCapturePreviewResponse,
    Error,
    { url: string }
  >({
    mutationFn: ({ url }) => IngestionService.captureUrl(effectiveScope, url),
  });

  const confirmMutation = useMutation<
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
    mutationFn: (payload) => IngestionService.confirmUrl(effectiveScope, payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: itemKeys.all(effectiveScope) });
      toast.success('Document imported from URL', {
        description: data.title || 'Successfully captured to your library.',
        id: 'capture-url',
      });
    },
    onError: (err: any) => {
      toast.error('Import confirmation failed', {
        description: err?.message || 'Could not save captured URL to library.',
        id: 'capture-url',
      });
    },
  });

  return {
    previewUrl: previewMutation.mutateAsync,
    confirmUrl: confirmMutation.mutateAsync,
    isPreviewing: previewMutation.isPending,
    isConfirming: confirmMutation.isPending,
    previewData: previewMutation.data?.data,
    previewError: previewMutation.error,
    confirmError: confirmMutation.error,
    resetPreview: previewMutation.reset,
  };
}

export function useIngestion(scopeId?: string) {
  const queryClient = useQueryClient();
  const effectiveScope = scopeId || 'user';

  const ingestMutation = useMutation<
    UnifiedIngestionResponse,
    Error,
    UnifiedIngestionPayload
  >({
    mutationFn: (payload) => IngestionService.ingest(effectiveScope, payload),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: itemKeys.all(effectiveScope) });
      if (res.data?.deduplicated) {
        toast.info('Existing paper detected', {
          description: 'Navigated to your existing library entry.',
          id: 'ingest-dedup',
        });
      } else {
        toast.success('Ingestion initiated', {
          description: 'Document extraction and metadata discovery in progress.',
          id: 'ingest-submit',
        });
      }
    },
    onError: (err: any) => {
      toast.error('Ingestion failed', {
        description: err?.message || 'Unable to submit document for processing.',
        id: 'ingest-submit',
      });
    },
  });

  return {
    ingest: ingestMutation.mutateAsync,
    isIngesting: ingestMutation.isPending,
    ingestError: ingestMutation.error,
    reset: ingestMutation.reset,
  };
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

// ── Curation & Duplicates Queries ─────────────────────────────────────────────

export const curationKeys = {
  duplicates: (scopeId?: string) => libraryKeys.duplicates(scopeId),
  integrity: (scopeId?: string) => ['library', 'curation', scopeId || 'user', 'integrity'] as const,
};

export function useDuplicateGroups(scopeId?: string) {
  return useQuery({
    queryKey: curationKeys.duplicates(scopeId),
    queryFn: () => QualityService.getDuplicates(scopeId),
    enabled: true,
  });
}

export function useMergePapers(scopeId?: string) {
  const queryClient = useQueryClient();
  const effectiveScope = scopeId || 'user';

  return useMutation({
    mutationFn: ({
      masterPaperId,
      sourcePaperIds,
      masterId,
      duplicateIds,
      fieldSelections,
    }: {
      masterPaperId?: string;
      sourcePaperIds?: string[];
      masterId?: string;
      duplicateIds?: string[];
      fieldSelections?: Record<string, any>;
    }) => {
      const effectiveMasterId = masterId || masterPaperId || '';
      const effectiveSourceIds = duplicateIds || sourcePaperIds || [];
      return QualityService.mergePapers(effectiveScope, effectiveMasterId, effectiveSourceIds, fieldSelections);
    },
    onSuccess: (response: any) => {
      queryClient.invalidateQueries({ queryKey: curationKeys.duplicates(effectiveScope) });
      queryClient.invalidateQueries({ queryKey: curationKeys.integrity(effectiveScope) });
      queryClient.invalidateQueries({ queryKey: itemKeys.all(effectiveScope) });
      const count = response.mergedCount ?? response.data?.mergedCount ?? 1;
      toast.success('Duplicates merged', {
        description: `Consolidated ${count} duplicate record(s) into master. Notes and citations preserved.`,
        id: 'library-merge',
      });
    },
    onError: (error: any) => {
      toast.error('Merge failed', {
        description: error?.message || 'Unable to consolidate duplicate records.',
        id: 'library-merge',
      });
    },
  });
}

export function useLibraryIntegrity(scopeId?: string) {
  return useQuery({
    queryKey: curationKeys.integrity(scopeId),
    queryFn: () => QualityService.getIntegrityReport(scopeId),
    enabled: true,
  });
}

export const useDuplicates = useDuplicateGroups;
export const useDuplicateGroupsQuery = useDuplicateGroups;
export const useMergeItems = useMergePapers;
export const useMergeDuplicates = useMergePapers;
export const useMergeDuplicatesMutation = useMergeDuplicates;
export const useIntegrity = useLibraryIntegrity;

// ── Retraction Queries ────────────────────────────────────────────────────────

export const retractionKeys = {
  all: (scopeId?: string) => libraryKeys.retractions(scopeId),
  stats: (scopeId?: string) => [...libraryKeys.retractions(scopeId), 'stats'] as const,
  items: (scopeId?: string) => [...libraryKeys.retractions(scopeId), 'items'] as const,
};

export const invalidateRetraction = (qc: QueryClient, scopeId?: string) => {
  qc.invalidateQueries({ queryKey: retractionKeys.all(scopeId) });
  qc.invalidateQueries({ queryKey: libraryKeys.all });
};

export function useRetraction(scopeId?: string) {
  const queryClient = useQueryClient();
  const effectiveScope = scopeId || 'user';

  const statsQuery = useQuery({
    queryKey: retractionKeys.stats(effectiveScope),
    queryFn: () => RetractionService.getStats(effectiveScope),
    enabled: true,
    staleTime: 1000 * 60 * 60,
  });

  const itemsQuery = useQuery({
    queryKey: retractionKeys.items(effectiveScope),
    queryFn: () => RetractionService.getRetractedItems(effectiveScope),
    enabled: true,
    staleTime: 1000 * 60 * 60,
  });

  const checkItemMutation = useMutation({
    mutationFn: (itemId: string) => RetractionService.checkItem(effectiveScope, itemId),
    onSuccess: (data) => {
      invalidateRetraction(queryClient, scopeId);
      if (data.isRetracted) {
        toast.error('Retraction detected!', {
          description: `This publication was flagged as ${data.nature || 'retracted'}.`,
          id: 'retraction-check',
        });
      } else {
        toast.success('Retraction check complete', {
          description: 'No retraction notices found for this item.',
          id: 'retraction-check',
        });
      }
    },
    onError: (err: any) => {
      toast.error('Check failed', { description: err?.message, id: 'retraction-check' });
    },
  });

  const checkLibraryMutation = useMutation({
    mutationFn: (itemIds?: string[]) => RetractionService.checkLibrary(effectiveScope, itemIds),
    onSuccess: (res) => {
      invalidateRetraction(queryClient, scopeId);
      if (res.newlyRetracted > 0) {
        toast.warning(`Scan completed: ${res.newlyRetracted} retracted item(s) found!`, {
          description: `Scanned ${res.scanned} publications in this library.`,
          id: 'retraction-scan',
        });
      } else {
        toast.success(`Scan completed: All ${res.scanned} publications clear`, {
          description: 'No new retracted items detected.',
          id: 'retraction-scan',
        });
      }
    },
    onError: (err: any) => {
      toast.error('Library scan failed', { description: err?.message, id: 'retraction-scan' });
    },
  });

  const flagMutation = useMutation({
    mutationFn: ({ itemId, data }: { itemId: string; data: FlagRetractionInput }) =>
      RetractionService.flagItem(effectiveScope, itemId, data),
    onSuccess: () => {
      invalidateRetraction(queryClient, scopeId);
      toast.warning('Item flagged as retracted', { id: 'retraction-flag' });
    },
    onError: (err: any) => {
      toast.error('Failed to flag item', { description: err?.message, id: 'retraction-flag' });
    },
  });

  const unflagMutation = useMutation({
    mutationFn: (itemId: string) => RetractionService.unflagItem(effectiveScope, itemId),
    onSuccess: () => {
      invalidateRetraction(queryClient, scopeId);
      toast.success('Retraction flag removed', { id: 'retraction-flag' });
    },
    onError: (err: any) => {
      toast.error('Failed to remove flag', { description: err?.message, id: 'retraction-flag' });
    },
  });

  return {
    stats: statsQuery.data,
    retractedItems: itemsQuery.data || [],
    isLoadingStats: statsQuery.isLoading,
    isLoadingItems: itemsQuery.isLoading,
    checkItem: checkItemMutation.mutateAsync,
    checkLibrary: checkLibraryMutation.mutateAsync,
    flagItem: flagMutation.mutateAsync,
    unflagItem: unflagMutation.mutateAsync,
    isCheckingItem: checkItemMutation.isPending,
    isCheckingLibrary: checkLibraryMutation.isPending,
    isFlagging: flagMutation.isPending,
    isUnflagging: unflagMutation.isPending,
  };
}
