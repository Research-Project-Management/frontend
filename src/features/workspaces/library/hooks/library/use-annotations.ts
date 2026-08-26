'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { libraryKeys } from '../../services/library.service';
import {
  getAnnotations,
  createAnnotation,
  deleteAnnotation,
  extractNotesFromAnnotations,
} from '../../services/annotation.service';
import type { PdfAnnotation } from '../../types/library.types';

export function useAnnotations(workspaceId: string, paperId: string) {
  return useQuery({
    queryKey: libraryKeys.annotations(workspaceId, paperId),
    queryFn: () => getAnnotations(workspaceId, paperId),
    enabled: Boolean(workspaceId && paperId),
  });
}

export function useCreateAnnotation(workspaceId: string, paperId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: Partial<PdfAnnotation>) =>
      createAnnotation(workspaceId, paperId, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: libraryKeys.annotations(workspaceId, paperId),
      });
      queryClient.invalidateQueries({
        queryKey: libraryKeys.paperBundle(workspaceId, paperId),
      });
    },
  });
}

export function useDeleteAnnotation(workspaceId: string, paperId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (annotationId: string) =>
      deleteAnnotation(workspaceId, paperId, annotationId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: libraryKeys.annotations(workspaceId, paperId),
      });
      queryClient.invalidateQueries({
        queryKey: libraryKeys.paperBundle(workspaceId, paperId),
      });
    },
  });
}

export function useExtractNotes(workspaceId: string, paperId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      extractNotesFromAnnotations(workspaceId, paperId),
    onSuccess: (response: any) => {
      queryClient.invalidateQueries({
        queryKey: libraryKeys.paperDetail(workspaceId, paperId),
      });
      queryClient.invalidateQueries({
        queryKey: libraryKeys.paperBundle(workspaceId, paperId),
      });
      const count =
        response?.literatureNote?.annotationCount ??
        response?.totalExtracted ??
        'all';
      toast.success(`Synthesized ${count} highlight(s) into Literature Note`);
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to extract notes');
    },
  });
}
