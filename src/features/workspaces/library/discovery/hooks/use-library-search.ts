import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import { apiGet } from '@/shared/lib/api';

export interface SearchFacets {
  itemTypes: Record<string, number>;
  years: Record<string, number>;
  tags: Record<string, number>;
}

export interface SearchDiscoveryParams {
  q?: string;
  itemType?: string;
  collectionId?: string;
  tagId?: string;
  yearFrom?: number;
  yearTo?: number;
  sortBy?: 'relevance' | 'dateAdded' | 'year' | 'title';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  cursor?: string;
}

export function useLibrarySearch(workspaceId: string) {
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
    queryKey: ['workspace', workspaceId, 'library', 'discovery', currentParams],
    queryFn: async () => {
      const resp = await apiGet<any>(
        `/api/v1/workspaces/${workspaceId}/library/discovery/search`,
        currentParams as any,
      );
      return resp;
    },
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
    (colId?: string) => {
      updateUrlParams({ collection: colId || null });
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

  return {
    params: currentParams,
    data: query.data?.data || [],
    facets: query.data?.meta?.facets as SearchFacets | undefined,
    meta: query.data?.meta,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
    setQuery,
    setItemType,
    setCollection,
    setTag,
    clearFilters,
  };
}
