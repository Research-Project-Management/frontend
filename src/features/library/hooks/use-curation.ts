'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { QualityService } from '../services/curation.service';
import { itemKeys } from './use-items';

export const curationKeys = {
  duplicates: (scopeId?: string) => ['curation', scopeId || 'user', 'duplicates'] as const,
  integrity: (scopeId?: string) => ['curation', scopeId || 'user', 'integrity'] as const,
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
      fieldSelections,
    }: {
      masterPaperId: string;
      sourcePaperIds: string[];
      fieldSelections?: Record<string, any>;
    }) => QualityService.mergePapers(effectiveScope, masterPaperId, sourcePaperIds, fieldSelections),
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
export const useMergeItems = useMergePapers;
export const useIntegrity = useLibraryIntegrity;
