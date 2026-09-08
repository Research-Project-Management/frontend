'use client';

import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getErrorMessage } from '@/shared/utils/error.util';
import {
  AnnotationsService,
  type CreateAnnotationDTO,
  type UpdateAnnotationDTO,
} from '../services/annotations.service';
import type { ReaderAnnotation } from '../types/reader.types';
import { PdfAnnotationEngine } from '../utils/reader.util';

export const readerAnnotationKeys = {
  all: ['reader', 'annotations'] as const,
  byAttachment: (workspaceId: string, attachmentId?: string) =>
    [...readerAnnotationKeys.all, workspaceId, attachmentId || 'none'] as const,
};

export function useAnnotations(workspaceId: string, attachmentId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: readerAnnotationKeys.byAttachment(workspaceId, attachmentId),
    queryFn: () => {
      if (!attachmentId) return [];
      return AnnotationsService.getByAttachment(workspaceId, attachmentId);
    },
    enabled: Boolean(workspaceId && attachmentId),
  });

  const createMutation = useMutation({
    mutationFn: (dto: CreateAnnotationDTO) => {
      if (!attachmentId) throw new Error('Attachment ID required to create annotation.');
      return AnnotationsService.create(workspaceId, attachmentId, dto);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: readerAnnotationKeys.byAttachment(workspaceId, attachmentId),
      });
      toast.success('Annotation saved', { id: 'reader-annotation-toast' });
    },
    onError: (err: unknown) => {
      toast.error('Failed to create annotation', {
        description: getErrorMessage(err) || 'Please try again.',
        id: 'reader-annotation-toast',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      annotationId,
      expectedVersion,
      dto,
    }: {
      annotationId: string;
      expectedVersion?: number;
      dto: UpdateAnnotationDTO;
    }) => {
      if (!attachmentId) throw new Error('Attachment ID required to update annotation.');
      return AnnotationsService.update(workspaceId, attachmentId, annotationId, expectedVersion, dto);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: readerAnnotationKeys.byAttachment(workspaceId, attachmentId),
      });
      toast.success('Annotation updated', { id: 'reader-annotation-toast' });
    },
    onError: (err: unknown) => {
      toast.error('Failed to update annotation', {
        description: getErrorMessage(err) || 'Please try again.',
        id: 'reader-annotation-toast',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({
      annotationId,
      expectedVersion,
    }: {
      annotationId: string;
      expectedVersion?: number;
    }) => {
      if (!attachmentId) throw new Error('Attachment ID required to delete annotation.');
      return AnnotationsService.delete(workspaceId, attachmentId, annotationId, expectedVersion);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: readerAnnotationKeys.byAttachment(workspaceId, attachmentId),
      });
      toast.success('Annotation deleted', { id: 'reader-annotation-toast' });
    },
    onError: (err: unknown) => {
      toast.error('Failed to delete annotation', {
        description: getErrorMessage(err) || 'Please try again.',
        id: 'reader-annotation-toast',
      });
    },
  });

  const extractNotesMutation = useMutation({
    mutationFn: (paperId: string) => AnnotationsService.extractNotes(workspaceId, paperId),
    onSuccess: (res) => {
      toast.success('Notes synthesized', {
        description: `Extracted ${res?.totalExtracted ?? 0} notes from document highlights.`,
        id: 'reader-annotation-toast',
      });
    },
    onError: (err: unknown) => {
      toast.error('Failed to synthesize notes', {
        description: getErrorMessage(err) || 'Please try again.',
        id: 'reader-annotation-toast',
      });
    },
  });

  const annotations = useMemo(() => {
    return PdfAnnotationEngine.sortAnnotations(query.data || []);
  }, [query.data]);


  return {
    annotations,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    createAnnotation: createMutation.mutateAsync,
    updateAnnotation: (annotationId: string, expectedVersion: number | undefined, dto: UpdateAnnotationDTO) =>
      updateMutation.mutateAsync({ annotationId, expectedVersion, dto }),
    deleteAnnotation: (annotationId: string, expectedVersion?: number) =>
      deleteMutation.mutateAsync({ annotationId, expectedVersion }),
    extractNotes: extractNotesMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isExtracting: extractNotesMutation.isPending,
    refetch: query.refetch,
  };
}
