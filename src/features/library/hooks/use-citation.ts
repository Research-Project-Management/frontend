'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import { CitationService } from '../services/citation.service';
import type { CslStyle, FormattedCitation } from '../types/library.types';

export const citationKeys = {
  all: ['library', 'citation'] as const,
  styles: (scopeId?: string) => [...citationKeys.all, 'styles', scopeId || 'default'] as const,
  item: (scopeId?: string, itemId?: string, style: CslStyle = 'apa', index: number = 1) =>
    [...citationKeys.all, 'item', scopeId || 'default', itemId || 'none', style, index] as const,
  batch: (scopeId?: string, itemIds: string[] = [], style: CslStyle = 'apa') =>
    [...citationKeys.all, 'batch', scopeId || 'default', itemIds.join(','), style] as const,
};

/**
 * Hook to retrieve available CSL citation styles
 */
export function useCitationStyles(scopeId?: string) {
  return useQuery({
    queryKey: citationKeys.styles(scopeId),
    queryFn: () => CitationService.getStyles(scopeId),
    staleTime: 1000 * 60 * 60 * 24, // 24 hours
  });
}

/**
 * Hook to format an academic citation using the backend CSL engine
 */
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
    staleTime: 1000 * 60 * 30, // 30 minutes
  });
}

export const useCitation = useCslCitation;

/**
 * Hook to format multiple academic citations in batch
 */
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

/**
 * Hook for academic query / DOI resolution
 */
export function useAcademicResolver() {
  return useMutation({
    mutationFn: async ({ query, scopeId }: { query: string; scopeId?: string }) => {
      return CitationService.resolve(query, scopeId);
    },
  });
}
