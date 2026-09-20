'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { ExportService, ExportsService } from '../services/exports.service';

export const exportKeys = {
  all: ['library', 'exports'] as const,
  collectionBundle: (scopeId?: string, collectionId?: string) =>
    [...exportKeys.all, 'bundle', scopeId || 'default', collectionId || 'none'] as const,
  collectionBibtex: (scopeId?: string, collectionId?: string) =>
    [...exportKeys.all, 'bibtex', scopeId || 'default', collectionId || 'none'] as const,
};

/**
 * Hook for library export mutations and downloads
 */
export function useExports(scopeId?: string) {
  const exportLibraryMutation = useMutation({
    mutationFn: async (options?: {
      format?: string;
      collectionId?: string;
      tagId?: string;
      itemIds?: string[];
      projectId?: string;
    }) => {
      return ExportService.exportLibrary(scopeId, options);
    },
  });

  const exportByCitationKeysMutation = useMutation({
    mutationFn: async (keys: string[]) => {
      return ExportService.exportByCitationKeys(scopeId || 'default', keys);
    },
  });

  const downloadAnnotatedPdfMutation = useMutation({
    mutationFn: async ({ itemId, fallbackFilename }: { itemId: string; fallbackFilename?: string }) => {
      return ExportService.downloadAnnotatedPdf(scopeId || 'default', itemId, fallbackFilename);
    },
  });

  return {
    exportLibrary: exportLibraryMutation.mutateAsync,
    isExporting: exportLibraryMutation.isPending,
    exportByCitationKeys: exportByCitationKeysMutation.mutateAsync,
    downloadAnnotatedPdf: downloadAnnotatedPdfMutation.mutateAsync,
  };
}

export const useExportLibrary = useExports;
