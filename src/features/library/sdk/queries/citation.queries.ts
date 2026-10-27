'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { libraryServices } from '../library.client';
import type { CslStyle } from '@/features/library/domain/types/library.types';
import { citationKeys, exportKeys, normalizeScopeId } from '@/features/library/sdk/query-keys';

export { citationKeys, exportKeys };

export function useCitationStyles(scopeId?: string, options?: { enabled?: boolean }) {
  const query = useQuery({
    queryKey: citationKeys.styles(scopeId),
    queryFn: () => libraryServices.citations.getStyles(scopeId),
    enabled: options?.enabled ?? true,
    staleTime: 1000 * 60 * 60 * 24,
  });

  const rawData = query.data;
  const styles: string[] = Array.isArray(rawData)
    ? rawData
        .map((s: unknown) => {
          if (typeof s === 'string') return s;
          if (s && typeof s === 'object' && 'id' in s) {
            return String((s as { id: string }).id);
          }
          return '';
        })
        .filter(Boolean)
    : [];

  return {
    ...query,
    styles,
  };
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

export function useFormatCitationMutation(scopeId?: string) {
  const effectiveScope = normalizeScopeId(scopeId);
  return useMutation({
    mutationFn: ({
      itemId,
      style = 'apa',
      index = 1,
    }: {
      itemId: string;
      style?: CslStyle;
      index?: number;
    }) => libraryServices.citations.formatCitation(effectiveScope, itemId, style, index),
  });
}

export function useSearchCslStyles(
  query: string = '',
  limit: number = 30,
  options?: { enabled?: boolean; scopeId?: string },
) {
  const effectiveScope = normalizeScopeId(options?.scopeId);
  return useQuery({
    queryKey: [...citationKeys.all, 'styles-search', effectiveScope, query, limit] as const,
    queryFn: () => libraryServices.citations.searchStyles(query, limit, effectiveScope),
    enabled: options?.enabled ?? true,
    staleTime: 1000 * 60 * 60,
  });
}

export function useUploadCustomCslStyleMutation(scopeId?: string) {
  const queryClient = useQueryClient();
  const effectiveScope = normalizeScopeId(scopeId);
  return useMutation({
    mutationFn: ({ xml, title }: { xml: string; title?: string }) =>
      libraryServices.citations.uploadCustomStyle(xml, title, effectiveScope),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: citationKeys.styles(effectiveScope) });
      void queryClient.invalidateQueries({
        queryKey: [...citationKeys.all, 'styles-search', effectiveScope],
      });
    },
  });
}
