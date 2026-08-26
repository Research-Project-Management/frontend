'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { libraryKeys } from '../../services/library.service';
import {
  getRelatedPapers,
  getWorkspaceKnowledgeGraph,
  linkPapers,
  unlinkPapers,
} from '../../services/relation.service';

export function useRelatedPapers(workspaceId: string, paperId: string) {
  return useQuery({
    queryKey: libraryKeys.relations(workspaceId, paperId),
    queryFn: () => getRelatedPapers(workspaceId, paperId),
    enabled: Boolean(workspaceId && paperId),
  });
}

export function useLinkPapers(workspaceId: string, paperId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      targetPaperId,
      relationType,
    }: {
      targetPaperId: string;
      relationType?: string;
    }) => linkPapers(workspaceId, paperId, targetPaperId, relationType),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: libraryKeys.relations(workspaceId, paperId),
      });
      queryClient.invalidateQueries({ queryKey: libraryKeys.graph(workspaceId) });
      queryClient.invalidateQueries({
        queryKey: libraryKeys.paperBundle(workspaceId, paperId),
      });
      toast.success('Related paper linked');
    },
  });
}

export function useUnlinkPapers(workspaceId: string, paperId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (targetPaperId: string) =>
      unlinkPapers(workspaceId, paperId, targetPaperId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: libraryKeys.relations(workspaceId, paperId),
      });
      queryClient.invalidateQueries({ queryKey: libraryKeys.graph(workspaceId) });
      queryClient.invalidateQueries({
        queryKey: libraryKeys.paperBundle(workspaceId, paperId),
      });
      toast.success('Related paper unlinked');
    },
  });
}

export function useWorkspaceKnowledgeGraph(workspaceId: string) {
  return useQuery({
    queryKey: libraryKeys.graph(workspaceId),
    queryFn: () => getWorkspaceKnowledgeGraph(workspaceId),
    enabled: Boolean(workspaceId),
  });
}
