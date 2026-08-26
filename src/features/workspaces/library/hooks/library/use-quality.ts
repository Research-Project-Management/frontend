'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { libraryKeys } from '../../services/library.service';
import {
  getDuplicateGroups,
  getLibraryIntegrityReport,
  mergePapers,
} from '../../services/quality.service';

export function useDuplicateGroups(workspaceId: string) {
  return useQuery({
    queryKey: libraryKeys.duplicates(workspaceId),
    queryFn: () => getDuplicateGroups(workspaceId),
    enabled: Boolean(workspaceId),
  });
}

export function useMergePapers(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      masterPaperId,
      sourcePaperIds,
    }: {
      masterPaperId: string;
      sourcePaperIds: string[];
    }) => mergePapers(workspaceId, masterPaperId, sourcePaperIds),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.duplicates(workspaceId) });
      queryClient.invalidateQueries({ queryKey: libraryKeys.papers(workspaceId) });
      queryClient.invalidateQueries({ queryKey: libraryKeys.integrity(workspaceId) });
      toast.success(`Merged ${response.mergedCount} duplicate papers into master`);
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to merge papers');
    },
  });
}

export function useLibraryIntegrity(workspaceId: string) {
  return useQuery({
    queryKey: libraryKeys.integrity(workspaceId),
    queryFn: () => getLibraryIntegrityReport(workspaceId),
    enabled: Boolean(workspaceId),
  });
}
