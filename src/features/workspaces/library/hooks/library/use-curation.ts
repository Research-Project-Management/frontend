'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { QualityService } from '../../services/catalog.service';
import { itemKeys } from './use-items';

export const curationKeys = {
  duplicates: (workspaceId: string) => ['curation', workspaceId, 'duplicates'] as const,
  integrity: (workspaceId: string) => ['curation', workspaceId, 'integrity'] as const,
};

export function useDuplicateGroups(workspaceId: string) {
  return useQuery({
    queryKey: curationKeys.duplicates(workspaceId),
    queryFn: () => QualityService.getDuplicates(workspaceId),
    enabled: Boolean(workspaceId),
  });
}

export function useMergePapers(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      masterPaperId,
      sourcePaperIds,
      fieldSelections,
    }: {
      masterPaperId: string;
      sourcePaperIds: string[];
      fieldSelections?: Record<string, any>;
    }) => QualityService.mergePapers(workspaceId, masterPaperId, sourcePaperIds, fieldSelections),
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

export function useLibraryIntegrity(workspaceId: string) {
  return useQuery({
    queryKey: curationKeys.integrity(workspaceId),
    queryFn: () => QualityService.getIntegrityReport(workspaceId),
    enabled: Boolean(workspaceId),
  });
}

export const useDuplicates = useDuplicateGroups;
export const useMergeItems = useMergePapers;
export const useIntegrity = useLibraryIntegrity;
