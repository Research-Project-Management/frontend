'use client';

import { useQuery } from '@tanstack/react-query';
import { libraryKeys } from './query-keys';
import { formatCslCitation } from '../services/citation.service';
import type { CslStyle, FormattedCitation } from '../types/library.types';

/**
 * Hook to query formatted CSL citation for an item.
 */
export function useCslCitation(
  scopeId?: string,
  itemId?: string,
  style: CslStyle = 'apa',
  index: number = 1,
) {
  return useQuery<FormattedCitation>({
    queryKey: libraryKeys.citation(scopeId, itemId, style, index),
    queryFn: () => formatCslCitation(scopeId, itemId || '', style, index),
    enabled: Boolean(itemId),
    staleTime: 1000 * 60 * 30, // 30 mins
  });
}

export const useCslCitationQuery = useCslCitation;
