'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { QualityService } from '../services/curation.service';
import { itemKeys } from './use-items';

export const curationKeys = {
  duplicates: (workspaceId?: string) => ['curation', workspaceId || 'user', 'duplicates'] as const,
  integrity: (workspaceId?: string) => ['curation', workspaceId || 'user', 'integrity'] as const,
};

export function useDuplicateGroups(workspaceId?: string) {
  return useQuery({
    queryKey: curationKeys.duplicates(workspaceId),
    queryFn: () => QualityService.getDuplicates(workspaceId),
    enabled: true,
  });
}

export function useMergePapers(workspaceId?: string) {
  const queryClient = useQueryClient();
  const effectiveScope = workspaceId || 'user';

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
      queryClient.invalidateQueries({ queryKey: curationKeys.duplicates(workspaceId) });
      queryClient.invalidateQueries({ queryKey: curationKeys.integrity(workspaceId) });
      queryClient.invalidateQueries({ queryKey: itemKeys.all(workspaceId) });
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

export function useLibraryIntegrity(workspaceId?: string) {
  return useQuery({
    queryKey: curationKeys.integrity(workspaceId),
    queryFn: () => QualityService.getIntegrityReport(workspaceId),
    enabled: true,
  });
}

export const useDuplicates = useDuplicateGroups;
export const useMergeItems = useMergePapers;
export const useIntegrity = useLibraryIntegrity;
