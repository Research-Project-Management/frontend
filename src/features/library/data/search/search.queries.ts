'use client';

import { useQuery } from '@tanstack/react-query';
import {
  SearchService,
  type SearchItemsParams,
} from './search.service';

export const searchKeys = {
  all: ['library', 'search'] as const,
  items: (scopeId?: string, params?: SearchItemsParams) =>
    [...searchKeys.all, 'items', scopeId || 'user', params] as const,
  anchors: (scopeId?: string, attachmentId?: string, term?: string, pageIndex?: number) =>
    [...searchKeys.all, 'anchors', scopeId || 'user', attachmentId || 'none', term || '', pageIndex ?? 'all'] as const,
};

export function useLibrarySearch(
  params: SearchItemsParams,
  scopeId?: string,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: searchKeys.items(scopeId, params),
    queryFn: () => SearchService.search(params, scopeId),
    enabled: (options?.enabled ?? true) && Boolean(params.query?.trim()),
  });
}

export function useAttachmentAnchors(
  attachmentId: string,
  term: string,
  pageIndex?: number,
  scopeId?: string,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: searchKeys.anchors(scopeId, attachmentId, term, pageIndex),
    queryFn: () => SearchService.searchAnchors(attachmentId, term, pageIndex, scopeId),
    enabled: (options?.enabled ?? true) && Boolean(attachmentId && term?.trim()),
  });
}
