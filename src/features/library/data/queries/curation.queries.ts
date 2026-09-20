'use client';

import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { QualityService } from '../services/curation.service';
import { RetractionService } from '../services/retraction.service';
import { libraryKeys, itemKeys } from '../query-keys';
import type { FlagRetractionInput } from '../../types/library.types';

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
        });
      } else {
        toast.success('Retraction check complete', {
          description: 'No retraction notices found for this item.',
        });
      }
    },
    onError: (err: any) => {
      toast.error('Check failed', { description: err?.message });
    },
  });

  const checkLibraryMutation = useMutation({
    mutationFn: (itemIds?: string[]) => RetractionService.checkLibrary(effectiveScope, itemIds),
    onSuccess: (res) => {
      invalidateRetraction(queryClient, scopeId);
      if (res.newlyRetracted > 0) {
        toast.warning(`Scan completed: ${res.newlyRetracted} retracted item(s) found!`, {
          description: `Scanned ${res.scanned} publications in this library.`,
        });
      } else {
        toast.success(`Scan completed: All ${res.scanned} publications clear`, {
          description: 'No new retracted items detected.',
        });
      }
    },
    onError: (err: any) => {
      toast.error('Library scan failed', { description: err?.message });
    },
  });

  const flagMutation = useMutation({
    mutationFn: ({ itemId, data }: { itemId: string; data: FlagRetractionInput }) =>
      RetractionService.flagItem(effectiveScope, itemId, data),
    onSuccess: () => {
      invalidateRetraction(queryClient, scopeId);
      toast.warning('Item flagged as retracted');
    },
    onError: (err: any) => {
      toast.error('Failed to flag item', { description: err?.message });
    },
  });

  const unflagMutation = useMutation({
    mutationFn: (itemId: string) => RetractionService.unflagItem(effectiveScope, itemId),
    onSuccess: () => {
      invalidateRetraction(queryClient, scopeId);
      toast.success('Retraction flag removed');
    },
    onError: (err: any) => {
      toast.error('Failed to remove flag', { description: err?.message });
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
