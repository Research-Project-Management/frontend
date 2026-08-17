'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  paperKeys,
  getCollectionPapers,
  getAllPapers,
  getPaperById,
  createPaper,
  updatePaper,
  deletePaper,
} from '../../services/paper.service';
import { invalidateCollections } from '../../services/collection.service';

import type { Paper, CreatePaperDTO, UpdatePaperDTO } from '../../types/library.types';

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

  const paperByIdQuery = useQuery({
    queryKey: paperKeys.byId(workspaceId, collectionId || ''),
    queryFn: () => getPaperById(workspaceId, collectionId || ''),
    enabled: !!workspaceId && !!collectionId,
    select: (d) => d.paper || null,
  });

  const collectionPapersQuery = useQuery({
    queryKey: paperKeys.byCollection(workspaceId, collectionId || ''),
    queryFn: () => getCollectionPapers(workspaceId, collectionId || ''),
    enabled: !!workspaceId && !!collectionId,
    select: (d) => d || null,
  });

  const addMutation = useMutation({
    mutationFn: (data: CreatePaperDTO) =>
      createPaper(workspaceId, data.collectionId || collectionId || '', data),
    onSuccess: (_, variables) => {
      const targetCol = variables.collectionId || collectionId;
      if (targetCol) {
        qc.invalidateQueries({ queryKey: paperKeys.byCollection(workspaceId, targetCol) });
      }
      qc.invalidateQueries({ queryKey: paperKeys.all(workspaceId) });
      invalidateCollections(qc, workspaceId);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: UpdatePaperDTO & { paperId: string; targetCollectionId?: string }) => {
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

export function usePaper(workspaceId: string, paperId: string) {
  return useQuery({
    queryKey: paperKeys.byId(workspaceId, paperId),
    queryFn: async () => {
      const res = await getPaperById(workspaceId, paperId);
      return res.paper;
    },
    enabled: !!workspaceId && !!paperId,
  });
}
