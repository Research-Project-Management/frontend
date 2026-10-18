'use client';

import { useQuery } from '@tanstack/react-query';
import { libraryServices } from '../library.client';
import type { CslStyle } from '@/features/library/domain/types/library.types';
import { citationKeys, exportKeys } from '@/features/library/sdk/query-keys';

export { citationKeys, exportKeys };

export function useCitationStyles(scopeId?: string) {
  return useQuery({
    queryKey: citationKeys.styles(scopeId),
    queryFn: () => libraryServices.citations.getStyles(scopeId),
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
    queryFn: () => libraryServices.citations.formatCitation(scopeId, itemId || '', style, index),
    enabled: Boolean(itemId),
    staleTime: 1000 * 60 * 30,
  });
}

export function useSearchCslStyles(
  query: string = '',
  limit: number = 30,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: [...citationKeys.all, 'styles-search', query, limit] as const,
    queryFn: () => libraryServices.citations.searchStyles(query, limit),
    enabled: options?.enabled ?? true,
    staleTime: 1000 * 60 * 60,
  });
}
