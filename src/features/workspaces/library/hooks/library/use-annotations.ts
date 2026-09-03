'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AnnotationService,
  type CreateAnnotationDTO,
  type UpdateAnnotationDTO,
} from '../../services/annotation.service';
import type { PdfAnnotation } from '../../types/library.types';
export const annotationKeys = {
  all: ['annotations'] as const,
  attachment: (workspaceId: string, attachmentId?: string) =>
    [...annotationKeys.all, workspaceId, attachmentId || 'none'] as const,
};

export function useAnnotations(workspaceId: string, attachmentId?: string) {
  const queryClient = useQueryClient();

  const annotationsQuery = useQuery({
    queryKey: annotationKeys.attachment(workspaceId, attachmentId),
    queryFn: () => {
      if (!attachmentId) return Promise.resolve([]);
      return AnnotationService.getByAttachment(workspaceId, attachmentId);
    },
    enabled: Boolean(workspaceId && attachmentId),
  });

  const createMutation = useMutation({
    mutationFn: (dto: CreateAnnotationDTO) => {
      if (!attachmentId) throw new Error('Attachment ID is required');
      return AnnotationService.create(workspaceId, attachmentId, dto);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: annotationKeys.attachment(workspaceId, attachmentId),
      });
      toast.success('Annotation saved', { id: 'annotation-mutation-toast' });
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to create annotation', { id: 'annotation-mutation-toast' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      version,
      dto,
    }: {
      id: string;
      version: number;
      dto: UpdateAnnotationDTO;
    }) => {
      if (!attachmentId) throw new Error('Attachment ID is required');
      return AnnotationService.update(workspaceId, attachmentId, id, version, dto);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: annotationKeys.attachment(workspaceId, attachmentId),
      });
      toast.success('Annotation updated', { id: 'annotation-mutation-toast' });
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to update annotation', { id: 'annotation-mutation-toast' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id, version }: { id: string; version?: number }) => {
      if (!attachmentId) throw new Error('Attachment ID is required');
      return AnnotationService.delete(workspaceId, attachmentId, id, version);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: annotationKeys.attachment(workspaceId, attachmentId),
      });
      toast.success('Annotation deleted', { id: 'annotation-mutation-toast' });
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to delete annotation', { id: 'annotation-mutation-toast' });
    },
  });

  const state = {
    annotations: (annotationsQuery.data || []) as PdfAnnotation[],
    isLoading: annotationsQuery.isLoading,
    isError: annotationsQuery.isError,
    error: annotationsQuery.error,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };

  const actions = {
    refetch: annotationsQuery.refetch,
    createAnnotation: createMutation.mutateAsync,
    updateAnnotation: (id: string, version: number, dto: UpdateAnnotationDTO) =>
      updateMutation.mutateAsync({ id, version, dto }),
    deleteAnnotation: (id: string, version?: number) =>
      deleteMutation.mutateAsync({ id, version }),
  };

  return {
    state,
    actions,
    // Direct aliases for backwards compatibility
    ...state,
    ...actions,
  };
}

export const useCreateAnnotation = (workspaceId: string, attachmentId?: string) => {
  const { createAnnotation } = useAnnotations(workspaceId, attachmentId);
  return { mutateAsync: createAnnotation };
};

export const useDeleteAnnotation = (workspaceId: string, attachmentId?: string) => {
  const { deleteAnnotation } = useAnnotations(workspaceId, attachmentId);
  return { mutateAsync: (id: string) => deleteAnnotation(id) };
};

export const useExtractNotes = (workspaceId: string, paperId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => AnnotationService.extractNotesFromAnnotations(workspaceId, paperId),
    onSuccess: (response: any) => {
      queryClient.invalidateQueries({
        queryKey: ['workspace', workspaceId, 'notes', paperId],
      });
      const count =
        response?.literatureNote?.annotationCount ??
        response?.totalExtracted ??
        'all';
      toast.success('Literature note created', {
        description: `Synthesized ${count} highlight(s) into note.`,
        id: 'synthesize-note',
      });
    },
    onError: (error: any) => {
      toast.error('Failed to extract notes', {
        description: error?.message || 'Could not synthesize highlights.',
        id: 'synthesize-note',
      });
    },
  });
};
