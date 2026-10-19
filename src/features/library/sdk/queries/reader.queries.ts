'use client';

import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getErrorMessage } from '@/shared/lib/utils';
import { libraryServices, readerService } from '../library.client';
import {
  itemKeys,
  readerQueryKeys,
  annotationKeys,
  noteKeys,
} from '@/features/library/sdk/query-keys';
import { PdfAnnotationEngine } from '@/features/library/domain/reader.domain';
import type {
  CreateAnnotationDto,
  UpdateAnnotationDto,
} from '@/features/library/domain/types/reader.types';

export type CreateAnnotationDTO = CreateAnnotationDto;
export type UpdateAnnotationDTO = UpdateAnnotationDto;


// ── 1. Document & Fulltext Queries ───────────────────────────────────────────

export function useReaderItem(scopeId?: string, itemId?: string) {
  return useQuery({
    queryKey: readerQueryKeys.item(scopeId, itemId),
    queryFn: () => {
      if (!itemId) return null;
      return libraryServices.reader.getDocument(scopeId, itemId);
    },
    enabled: Boolean(itemId),
    staleTime: 1000 * 60 * 5,
    gcTime: 3 * 60 * 1000,
  });
}

export function useReaderFulltext(scopeId?: string, itemId?: string) {
  return useQuery({
    queryKey: readerQueryKeys.fulltext(scopeId, itemId),
    queryFn: () => {
      if (!itemId) return null;
      return libraryServices.items.getFulltext(scopeId, itemId);
    },
    enabled: Boolean(itemId),
    staleTime: 1000 * 60 * 10,
    gcTime: 3 * 60 * 1000,
  });
}

// ── 2. Annotations Queries & Mutations ───────────────────────────────────────

export function useAnnotations(scopeId?: string, attachmentId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: annotationKeys.byAttachment(scopeId, attachmentId),
    queryFn: () => {
      if (!attachmentId) return [];
      return readerService.annotations.getByAttachment(scopeId, attachmentId);
    },
    enabled: Boolean(attachmentId),
    gcTime: 3 * 60 * 1000,
  });

  const createMutation = useMutation({
    mutationFn: (dto: CreateAnnotationDTO) => {
      if (!attachmentId) throw new Error('Attachment ID required to create annotation.');
      return readerService.annotations.create(scopeId, attachmentId, dto);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: annotationKeys.byAttachment(scopeId, attachmentId),
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
      return readerService.annotations.update(
        scopeId,
        attachmentId,
        annotationId,
        expectedVersion,
        dto,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: annotationKeys.byAttachment(scopeId, attachmentId),
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
      return readerService.annotations.delete(
        scopeId,
        attachmentId,
        annotationId,
        expectedVersion,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: annotationKeys.byAttachment(scopeId, attachmentId),
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
    mutationFn: (paperId: string) => readerService.annotations.extractNotes(scopeId, paperId),
    onSuccess: (res, paperId) => {
      if (paperId) {
        queryClient.invalidateQueries({ queryKey: noteKeys.list(scopeId, paperId) });
        queryClient.invalidateQueries({ queryKey: itemKeys.byId(scopeId, paperId) });
      } else {
        queryClient.invalidateQueries({ queryKey: noteKeys.all(scopeId) });
      }
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
      return readerService.annotations.importExternal(scopeId, attachmentId);
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({
        queryKey: annotationKeys.byAttachment(scopeId, attachmentId),
      });
      const count =
        res?.importedCount ??
        (res as { imported?: number } | undefined)?.imported ??
        0;
      toast.success('Annotations imported', {
        description: `Imported ${count} annotations from PDF.`,
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
    updateAnnotation: (
      annotationId: string,
      expectedVersion: number | undefined,
      dto: UpdateAnnotationDTO,
    ) => updateMutation.mutateAsync({ annotationId, expectedVersion, dto }),
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

// ── 3. PDF & OCR Action Hooks (Centralized Toasts) ───────────────────────────

export function useExportAnnotatedPdf(scopeId?: string) {
  const mutation = useMutation({
    mutationFn: async ({
      itemId,
      filename,
    }: {
      itemId: string;
      filename?: string;
    }) => {
      const targetFilename = filename || 'annotated-document.pdf';
      toast.loading('Exporting PDF with annotations...', { id: 'reader-export-annotated-pdf' });
      await libraryServices.exports.downloadAnnotatedPdf(scopeId, itemId, targetFilename);
      return targetFilename;
    },
    onSuccess: (filename) => {
      toast.success(`Annotated PDF exported: ${filename}`, { id: 'reader-export-annotated-pdf' });
    },
    onError: (err: unknown) => {
      toast.error(getErrorMessage(err) || 'Failed to export annotated PDF', {
        id: 'reader-export-annotated-pdf',
      });
    },
  });

  return {
    exportAnnotatedPdf: (itemId: string, filename?: string) =>
      mutation.mutateAsync({ itemId, filename }),
    isExporting: mutation.isPending,
  };
}

export function useOcrExtraction(scopeId?: string, itemId?: string) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (attachmentId: string) => {
      if (!attachmentId) throw new Error('No attachment available to run OCR');
      toast.loading('Submitting OCR re-extraction job...', { id: 'reader-ocr-trigger' });
      await libraryServices.attachments.reExtract(scopeId, attachmentId);
      return attachmentId;
    },
    onSuccess: (attachmentId) => {
      if (itemId) {
        queryClient.invalidateQueries({ queryKey: itemKeys.byId(scopeId, itemId) });
        queryClient.invalidateQueries({ queryKey: readerQueryKeys.fulltext(scopeId, itemId) });
      }
      queryClient.invalidateQueries({
        queryKey: annotationKeys.byAttachment(scopeId, attachmentId),
      });
      toast.success('OCR job queued successfully', { id: 'reader-ocr-trigger' });
    },
    onError: (err: unknown) => {
      toast.error(`Failed to trigger OCR: ${getErrorMessage(err) || 'Unknown error'}`, {
        id: 'reader-ocr-trigger',
      });
    },
  });

  return {
    triggerOcr: (attachmentId: string) => mutation.mutateAsync(attachmentId),
    isTriggeringOcr: mutation.isPending,
  };
}


