'use client';

import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getErrorMessage } from '@/shared/lib/utils';
import {
  ItemsService,
  AnnotationsService,
  NotesService,
  ExportsService,
  AttachmentsService,
  type ExtractNotesOptions,
} from '../library.client';
import {
  itemKeys,
  readerQueryKeys,
  annotationKeys,
  noteKeys,
} from '@/features/library/sdk/query-keys';
import { PdfAnnotationEngine } from '@/features/library/domain/reader.domain';
import type {
  AnnotationRect,
  CreateAnnotationDto,
  UpdateAnnotationDto,
  ReaderAnnotation,
  ReaderDocument,
} from '@/features/library/domain/types/reader.types';

export type CreateAnnotationDTO = CreateAnnotationDto;
export type UpdateAnnotationDTO = UpdateAnnotationDto & {
  rects?: AnnotationRect[];
  boundingRect?: AnnotationRect;
};


// ── 1. Document & Fulltext Queries ───────────────────────────────────────────

export function useReaderItem(scopeId?: string, itemId?: string) {
  return useQuery({
    queryKey: readerQueryKeys.item(scopeId, itemId),
    queryFn: async () => {
      if (!itemId) return null;
      return (await ItemsService.getById(scopeId || 'user', itemId)) as ReaderDocument;
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
      return ItemsService.getFulltext(scopeId, itemId);
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
      return AnnotationsService.getByAttachment(scopeId, attachmentId);
    },
    enabled: Boolean(attachmentId),
    gcTime: 3 * 60 * 1000,
  });

  const createMutation = useMutation({
    mutationFn: (dto: CreateAnnotationDTO) => {
      if (!attachmentId) throw new Error('Attachment ID required to create annotation.');
      const id = dto.id || crypto.randomUUID();
      return AnnotationsService.create(scopeId, attachmentId, { ...dto, id });
    },
    onMutate: async (dto: CreateAnnotationDTO) => {
      if (!attachmentId) return undefined;
      const id = dto.id || crypto.randomUUID();
      dto.id = id;
      const queryKey = annotationKeys.byAttachment(scopeId, attachmentId);
      await queryClient.cancelQueries({ queryKey });
      const previousAnnotations = queryClient.getQueryData<ReaderAnnotation[]>(queryKey);
      const optimisticAnnotation: ReaderAnnotation = {
        id,
        attachmentId,
        type: dto.type,
        pageIndex: dto.pageIndex,
        pageNumber: dto.pageNumber,
        color: dto.color,
        quoteText: dto.quoteText,
        comment: dto.comment,
        rects: dto.rects || [],
        tags: dto.tags || [],
        version: 1,
        createdAt: new Date().toISOString(),
      };
      queryClient.setQueryData<ReaderAnnotation[]>(queryKey, (old = []) => [
        ...old.filter((a) => a.id !== id),
        optimisticAnnotation,
      ]);
      return { previousAnnotations, optimisticId: id };
    },
    onSuccess: (created, _variables, context) => {
      const optimisticId = context?.optimisticId;
      if (attachmentId) {
        const queryKey = annotationKeys.byAttachment(scopeId, attachmentId);
        queryClient.setQueryData<ReaderAnnotation[]>(queryKey, (old = []) => {
          if (!created) return old;
          const targetId = optimisticId || created.id;
          if (old.some((a) => a.id === targetId || a.id === created.id)) {
            return old.map((a) =>
              a.id === targetId || a.id === created.id ? created : a,
            );
          }
          return [...old, created];
        });
        queryClient.invalidateQueries({
          queryKey: annotationKeys.byAttachment(scopeId, attachmentId),
        });
      }
      toast.success('Annotation saved', { id: 'reader-annotation-toast' });
    },
    onError: (err: unknown, _variables, context) => {
      if (attachmentId) {
        const queryKey = annotationKeys.byAttachment(scopeId, attachmentId);
        if (context?.optimisticId) {
          queryClient.setQueryData<ReaderAnnotation[]>(queryKey, (old = []) =>
            old.filter((a) => a.id !== context.optimisticId),
          );
        } else if (context?.previousAnnotations !== undefined) {
          queryClient.setQueryData(queryKey, context.previousAnnotations);
        }
      }
      toast.error('Failed to create annotation', {
        description: getErrorMessage(err) || 'Please try again.',
        id: 'reader-annotation-toast',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      annotationId,
      expectedVersion,
      dto,
    }: {
      annotationId: string;
      expectedVersion?: number;
      dto: UpdateAnnotationDTO;
    }) => {
      if (!attachmentId) throw new Error('Attachment ID required to update annotation.');
      return AnnotationsService.update(
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
    mutationFn: async ({
      annotationId,
      expectedVersion,
    }: {
      annotationId: string;
      expectedVersion?: number;
    }) => {
      if (!attachmentId) throw new Error('Attachment ID required to delete annotation.');
      return AnnotationsService.delete(
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
    mutationFn: (
      params:
        | string
        | {
            paperId: string;
            options?: ExtractNotesOptions;
          },
    ) => {
      const paperId = typeof params === 'string' ? params : params.paperId;
      const options = typeof params === 'string' ? undefined : params.options;
      return NotesService.extractFromAnnotations(scopeId, paperId, options);
    },
    onSuccess: (res, params) => {
      const paperId = typeof params === 'string' ? params : params.paperId;
      if (paperId) {
        queryClient.invalidateQueries({ queryKey: noteKeys.list(scopeId, paperId) });
        queryClient.invalidateQueries({ queryKey: itemKeys.byId(scopeId, paperId) });
      } else {
        queryClient.invalidateQueries({ queryKey: noteKeys.all(scopeId) });
      }
      if (!res || res.totalExtracted === 0) {
        toast.info('No annotations in this document to extract', {
          id: 'reader-annotation-toast',
        });
      } else {
        toast.success('Notes synthesized', {
          description: `Extracted ${res.totalExtracted} note${res.totalExtracted === 1 ? '' : 's'} from document highlights.`,
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
      dto: UpdateAnnotationDTO & {
        rects?: AnnotationRect[];
        boundingRect?: AnnotationRect;
      },
    ) => updateMutation.mutateAsync({ annotationId, expectedVersion, dto }),
    deleteAnnotation: (annotationId: string, expectedVersion?: number) =>
      deleteMutation.mutateAsync({ annotationId, expectedVersion }),
    extractNotes: (paperId: string, options?: ExtractNotesOptions) =>
      extractNotesMutation.mutateAsync({ paperId, options }),
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
      attachmentId,
    }: {
      itemId: string;
      filename?: string;
      attachmentId?: string;
    }) => {
      const targetFilename = filename || 'annotated-document.pdf';
      toast.loading('Exporting PDF with annotations...', { id: 'reader-export-annotated-pdf' });
      await ExportsService.downloadAnnotatedPdf(scopeId, itemId, targetFilename, attachmentId);
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
    exportAnnotatedPdf: (itemId: string, filename?: string, attachmentId?: string) =>
      mutation.mutateAsync({ itemId, filename, attachmentId }),
    isExporting: mutation.isPending,
  };
}

export function useOcrExtraction(scopeId?: string, itemId?: string) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (attachmentId: string) => {
      if (!attachmentId) throw new Error('No attachment available to run OCR');
      toast.loading('Submitting OCR re-extraction job...', { id: 'reader-ocr-trigger' });
      await AttachmentsService.reExtract(scopeId, attachmentId);
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
