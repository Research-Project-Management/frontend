'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ExportService, type ExportFormat } from '../../services/export.service';

// ── useExport ─────────────────────────────────────────────────────────────────
/**
 * Library export hook — BibTeX, RIS, bundle, and annotated PDF.
 * Backed by GET|POST /exports, GET /exports/:collectionId/export-bundle, GET /exports/items/:itemId/annotated-pdf
 */
export function useExport(workspaceId: string) {
  /**
   * Export library or subset in a given format.
   * Triggers a browser download automatically.
   */
  const exportMutation = useMutation({
    mutationFn: ({
      format = 'bibtex',
      collectionId,
      tagId,
    }: {
      format?: ExportFormat;
      collectionId?: string;
      tagId?: string;
    }) => ExportService.export(workspaceId, { format, collectionId, tagId }),
    onSuccess: (result) => {
      // Trigger browser download
      const blob = new Blob([result.content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename || `library.${result.format || 'bib'}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Library exported', {
        description: `Exported ${result.itemCount} document(s) in ${result.format?.toUpperCase() || 'BIBTEX'} format.`,
        id: 'export',
      });
    },
    onError: (err: any) => {
      toast.error('Export failed', {
        description: err?.message || 'Could not export library data.',
        id: 'export',
      });
    },
  });

  /**
   * Get a full export bundle (BibTeX + file manifest) for a collection
   */
  const bundleMutation = useMutation({
    mutationFn: (collectionId: string) =>
      ExportService.collectionBundle(workspaceId, collectionId),
    onError: (err: any) => {
      toast.error('Bundle fetch failed', {
        description: err?.message || 'Could not fetch collection bundle.',
        id: 'export-bundle',
      });
    },
  });

  /**
   * Export annotated PDF for a specific item (base64 encoded)
   */
  const annotatedPdfMutation = useMutation({
    mutationFn: (itemId: string) =>
      ExportService.annotatedPdf(workspaceId, itemId),
    onSuccess: (result) => {
      // Trigger browser download
      const bytes = atob(result.base64);
      const arr = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
      const blob = new Blob([arr], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename || 'annotated.pdf';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Annotated PDF downloaded', { id: 'annotated-pdf' });
    },
    onError: (err: any) => {
      toast.error('Download failed', {
        description: err?.message || 'Failed to export annotated PDF.',
        id: 'annotated-pdf',
      });
    },
  });

  return {
    exportLibrary: exportMutation.mutateAsync,
    exportBundle: bundleMutation.mutateAsync,
    exportAnnotatedPdf: annotatedPdfMutation.mutateAsync,
    isExporting: exportMutation.isPending,
    isFetchingBundle: bundleMutation.isPending,
    isExportingPdf: annotatedPdfMutation.isPending,
    bundleData: bundleMutation.data,
  };
}
