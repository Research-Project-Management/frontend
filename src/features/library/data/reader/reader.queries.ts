'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getErrorMessage } from '@/shared/lib/utils';
import { readerService } from './reader.service';
import { readerQueryKeys } from '@/features/library/data/query-keys';

// ── 1. Document & Fulltext Queries ───────────────────────────────────────────

export function useReaderItem(scopeId?: string, itemId?: string) {
  return useQuery({
    queryKey: readerQueryKeys.item(scopeId, itemId),
    queryFn: () => {
      if (!itemId) return null;
      return readerService.documents.get(scopeId, itemId);
    },
    enabled: Boolean(itemId),
    staleTime: 1000 * 60 * 5,
  });
}

export const useReaderDocument = useReaderItem;

export function useReaderFulltext(scopeId?: string, itemId?: string) {
  return useQuery({
    queryKey: readerQueryKeys.fulltext(scopeId, itemId),
    queryFn: () => {
      if (!itemId) return null;
      return readerService.documents.getFulltext(scopeId, itemId);
    },
    enabled: Boolean(itemId),
    staleTime: 1000 * 60 * 10,
  });
}

// ── 2. PDF & OCR Action Hooks (Centralized Toasts) ───────────────────────────

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
      await readerService.citations.downloadAnnotatedPdf(scopeId, itemId, targetFilename);
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

export function useOcrExtraction(scopeId?: string) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (attachmentId: string) => {
      if (!attachmentId) throw new Error('No attachment available to run OCR');
      toast.loading('Submitting OCR re-extraction job...', { id: 'reader-ocr-trigger' });
      await readerService.attachments.reExtract(scopeId, attachmentId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: readerQueryKeys.all });
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
