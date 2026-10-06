'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import {
  CitationService,
  ExportService,
} from './citation.service';
import type { CslStyle } from '../../types/library.types';

export const citationKeys = {
  all: ['library', 'citation'] as const,
  styles: (scopeId?: string) => [...citationKeys.all, 'styles', scopeId || 'default'] as const,
  item: (scopeId?: string, itemId?: string, style: CslStyle = 'apa', index: number = 1) =>
    [...citationKeys.all, 'item', scopeId || 'default', itemId || 'none', style, index] as const,
  batch: (scopeId?: string, itemIds: string[] = [], style: CslStyle = 'apa') =>
    [...citationKeys.all, 'batch', scopeId || 'default', itemIds.join(','), style] as const,
};

export function useCitationStyles(scopeId?: string) {
  return useQuery({
    queryKey: citationKeys.styles(scopeId),
    queryFn: () => CitationService.getStyles(scopeId),
    staleTime: 1000 * 60 * 60 * 24,
  });
}

export function useCslCitation(
  scopeId?: string,
  itemId?: string,
  style: CslStyle = 'apa',
  index: number = 1,
) {
  return useQuery({
    queryKey: citationKeys.item(scopeId, itemId, style, index),
    queryFn: () => CitationService.formatCitation(scopeId, itemId || '', style, index),
    enabled: Boolean(itemId),
    staleTime: 1000 * 60 * 30,
  });
}

export const useCitation = useCslCitation;

export function useBatchCitations(
  scopeId?: string,
  itemIds: string[] = [],
  style: CslStyle = 'apa',
) {
  return useQuery({
    queryKey: citationKeys.batch(scopeId, itemIds, style),
    queryFn: () => CitationService.batchFormat(scopeId, itemIds, style),
    enabled: itemIds.length > 0,
    staleTime: 1000 * 60 * 30,
  });
}

export function useAcademicResolver() {
  return useMutation({
    mutationFn: async ({ query, scopeId }: { query: string; scopeId?: string }) => {
      return CitationService.resolve(query, scopeId);
    },
  });
}

export function useSearchCslStyles(
  query: string = '',
  limit: number = 30,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: [...citationKeys.all, 'styles-search', query, limit] as const,
    queryFn: () => CitationService.searchStyles(query, limit),
    enabled: options?.enabled ?? true,
    staleTime: 1000 * 60 * 60,
  });
}

export function useUploadCustomCslStyle() {
  return useMutation({
    mutationFn: async ({ xml, title }: { xml: string; title?: string }) => {
      return CitationService.uploadCustomStyle(xml, title);
    },
  });
}

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
