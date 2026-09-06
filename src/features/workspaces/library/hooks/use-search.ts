'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import {
  SearchService,
  type SearchDiscoveryParams,
} from '../services/search.service';
import type { SearchFacets } from '../types/library.types';

export const searchKeys = {
  all: (workspaceId: string) => ['search', workspaceId] as const,
  discovery: (workspaceId: string, params: SearchDiscoveryParams) =>
    ['workspace', workspaceId, 'library', 'discovery', params] as const,
};

export type { SearchDiscoveryParams, SearchFacets };

export function useSearch(workspaceId: string) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // 1. Extract current search parameters from URL
  const currentParams: SearchDiscoveryParams = useMemo(() => {
    const q = searchParams.get('q') || undefined;
    const itemType = searchParams.get('type') || undefined;
    const collectionId = searchParams.get('collection') || undefined;
    const tagId = searchParams.get('tag') || undefined;
    const yearFrom = searchParams.get('from') ? parseInt(searchParams.get('from')!, 10) : undefined;
    const yearTo = searchParams.get('to') ? parseInt(searchParams.get('to')!, 10) : undefined;
    const sortBy = (searchParams.get('sortBy') as SearchDiscoveryParams['sortBy']) || undefined;
    const sortOrder = (searchParams.get('sortOrder') as SearchDiscoveryParams['sortOrder']) || undefined;

    return { q, itemType, collectionId, tagId, yearFrom, yearTo, sortBy, sortOrder };
  }, [searchParams]);

  // 2. Query TanStack Query for discovery items and facets
  const query = useQuery({
    queryKey: searchKeys.discovery(workspaceId, currentParams),
    queryFn: () => SearchService.discoverySearch(workspaceId, currentParams),
    enabled: Boolean(workspaceId),
    staleTime: 30_000,
  });

  // 3. Helper to update URL search parameters
  const updateUrlParams = useCallback(
    (updates: Record<string, string | number | undefined | null>) => {
      const nextParams = new URLSearchParams(searchParams.toString());

      Object.entries(updates).forEach(([key, val]) => {
        if (val === undefined || val === null || val === '') {
          nextParams.delete(key);
        } else {
          nextParams.set(key, String(val));
        }
      });

      const queryString = nextParams.toString();
      const targetUrl = queryString ? `${pathname}?${queryString}` : pathname;
      router.push(targetUrl);
    },
    [pathname, router, searchParams],
  );

  const setQuery = useCallback(
    (text: string) => {
      updateUrlParams({ q: text || null });
    },
    [updateUrlParams],
  );

  const setItemType = useCallback(
    (type?: string) => {
      updateUrlParams({ type: type || null });
    },
    [updateUrlParams],
  );

  const setCollection = useCallback(
    (collectionId?: string) => {
      updateUrlParams({ collection: collectionId || null });
    },
    [updateUrlParams],
  );

  const setTag = useCallback(
    (tagId?: string) => {
      updateUrlParams({ tag: tagId || null });
    },
    [updateUrlParams],
  );

  const clearFilters = useCallback(() => {
    updateUrlParams({
      q: null,
      type: null,
      collection: null,
      tag: null,
      from: null,
      to: null,
    });
  }, [updateUrlParams]);

  const searchData = useMemo(() => {
    if (Array.isArray(query.data)) return query.data;
    if (Array.isArray(query.data?.data)) return query.data.data;
    return [];
  }, [query.data]);

  const state = {
    params: currentParams,
    data: searchData,
    facets: query.data?.meta?.facets as SearchFacets | undefined,
    meta: query.data?.meta,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
  };

  const actions = {
    refetch: query.refetch,
    setQuery,
    setItemType,
    setCollection,
    setTag,
    clearFilters,
  };

  return {
    state,
    actions,
    ...state,
    ...actions,
  };
}

export const useLibrarySearch = useSearch;

