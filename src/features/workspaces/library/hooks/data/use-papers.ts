'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  paperKeys,
  getCollectionPapers,
  getAllPapers,
  createPaper,
  updatePaper,
  deletePaper,
} from '../../services/paper.service';
import { invalidateCollections } from '../../services/collection.service';

interface UsePapersOptions {
  workspaceId: string;
  collectionId?: string;
}

export function usePapers({ workspaceId, collectionId }: UsePapersOptions) {
  const qc = useQueryClient();

  const allPapersQuery = useQuery({
    queryKey: paperKeys.all(workspaceId),
    queryFn: () => getAllPapers(workspaceId),
    enabled: !!workspaceId,
    select: (d) => d.papers || [],
  });

  const collectionPapersQuery = useQuery({
    queryKey: paperKeys.byCollection(workspaceId, collectionId || ''),
    queryFn: () => getCollectionPapers(workspaceId, collectionId || ''),
    enabled: !!workspaceId && !!collectionId,
    select: (d) => d || null,
  });

  const addMutation = useMutation({
    mutationFn: (data: Parameters<typeof createPaper>[2]) =>
      createPaper(workspaceId, collectionId || '', data),
    onSuccess: () => {
      if (collectionId) {
        qc.invalidateQueries({ queryKey: paperKeys.byCollection(workspaceId, collectionId) });
      }
      qc.invalidateQueries({ queryKey: paperKeys.all(workspaceId) });
      invalidateCollections(qc, workspaceId);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof updatePaper>[2] & { paperId: string; targetCollectionId?: string }) => {
      const { paperId, targetCollectionId, ...rest } = data;
      return updatePaper(workspaceId, paperId, rest);
    },
    onSuccess: (_, variables) => {
      const targetCollection = variables.targetCollectionId || collectionId;
      if (targetCollection) {
        qc.invalidateQueries({ queryKey: paperKeys.byCollection(workspaceId, targetCollection) });
      }
      qc.invalidateQueries({ queryKey: paperKeys.all(workspaceId) });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (data: { paperId: string; targetCollectionId?: string }) =>
      deletePaper(workspaceId, data.paperId),
    onSuccess: (_, variables) => {
      const targetCollection = variables.targetCollectionId || collectionId;
      if (targetCollection) {
        qc.invalidateQueries({ queryKey: paperKeys.byCollection(workspaceId, targetCollection) });
      }
      qc.invalidateQueries({ queryKey: paperKeys.all(workspaceId) });
      invalidateCollections(qc, workspaceId);
    },
  });

  return {
    state: {
      allPapers: allPapersQuery.data ?? [],
      collectionPapers: collectionPapersQuery.data,
      isLoadingAll: allPapersQuery.isLoading,
      isLoadingCollection: collectionPapersQuery.isLoading,
      isAdding: addMutation.isPending,
      isUpdating: updateMutation.isPending,
      isDeleting: deleteMutation.isPending,
    },
    actions: {
      addPaper: addMutation.mutateAsync,
      updatePaper: updateMutation.mutateAsync,
      deletePaper: deleteMutation.mutateAsync,
      refetchAll: allPapersQuery.refetch,
      refetchCollection: collectionPapersQuery.refetch,
    },
  };
}
