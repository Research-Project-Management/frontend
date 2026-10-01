'use client';

import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getErrorMessage } from "@/shared/lib/utils";
import {
  AnnotationsService,
  type CreateAnnotationDTO,
  type UpdateAnnotationDTO,
} from '../services/annotations.service';
import type { ReaderAnnotation } from '../types/reader.types';
import { PdfAnnotationEngine } from '../utils/reader.util';

import { readerNoteKeys } from './use-notes';

export const readerAnnotationKeys = {
  all: ['reader', 'annotations'] as const,
  byAttachment: (scopeId?: string, attachmentId?: string) =>
    [...readerAnnotationKeys.all, scopeId || 'default', attachmentId || 'none'] as const,
};

export function useAnnotations(scopeId?: string, attachmentId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: readerAnnotationKeys.byAttachment(scopeId, attachmentId),
    queryFn: () => {
      if (!attachmentId) return [];
      return AnnotationsService.getByAttachment(scopeId, attachmentId);
    },
    enabled: Boolean(attachmentId),
    refetchInterval: 4000,
  });

  const createMutation = useMutation({
    mutationFn: (dto: CreateAnnotationDTO) => {
      if (!attachmentId) throw new Error('Attachment ID required to create annotation.');
      return AnnotationsService.create(scopeId, attachmentId, dto);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: readerAnnotationKeys.byAttachment(scopeId, attachmentId),
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
      return AnnotationsService.update(scopeId, attachmentId, annotationId, expectedVersion, dto);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: readerAnnotationKeys.byAttachment(scopeId, attachmentId),
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
      return AnnotationsService.delete(scopeId, attachmentId, annotationId, expectedVersion);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: readerAnnotationKeys.byAttachment(scopeId, attachmentId),
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
    mutationFn: (paperId: string) => AnnotationsService.extractNotes(scopeId, paperId),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: readerNoteKeys.all });
      if (!res?.totalExtracted) {
        toast.info('No annotations in this document to extract', {
          id: 'reader-annotation-toast',
        });
      } else {
        toast.success('Notes synthesized', {
          description: `Extracted ${res.totalExtracted} notes from document highlights.`,
          id: 'reader-annotation-toast',
        });
      }
    },
    onError: (err: unknown) => {
      toast.error('Failed to synthesize notes', {
        description: getErrorMessage(err) || 'Please try again.',
        id: 'reader-annotation-toast',
      });
    },
  });

  const importExternalMutation = useMutation({
    mutationFn: () => {
      if (!attachmentId) throw new Error('Attachment ID required to import annotations.');
      return AnnotationsService.importExternal(scopeId, attachmentId);
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({
        queryKey: readerAnnotationKeys.byAttachment(scopeId, attachmentId),
      });
      toast.success('Annotations imported', {
        description: `Imported ${res?.imported ?? 0} annotations from PDF.`,
        id: 'reader-annotation-toast',
      });
    },
    onError: (err: unknown) => {
      toast.error('Failed to import annotations', {
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
    importExternal: importExternalMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isExtracting: extractNotesMutation.isPending,
    isImporting: importExternalMutation.isPending,
    refetch: query.refetch,
  };
}
