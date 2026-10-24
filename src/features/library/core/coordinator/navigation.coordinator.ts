'use client';

import { useMemo, useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import type { LibraryOrderBy } from '@/features/library/domain/types/display.types';

export interface LibraryNavigationFilters {
  search?: string;
  filter?: string;
  savedSearchId?: string;
  feedId?: string;
  isSavedSearchView: boolean;
  fromYear?: number;
  toYear?: number;
  type?: string;
  readStatus?: string;
  hasFile?: boolean;
  hasNotes?: boolean;
  tag?: string;
  orderBy?: LibraryOrderBy;
  orderDirection?: 'asc' | 'desc';
  page: number;
  selectedItemId?: string;
}

/**
 * Pure URLSearchParams parser for Library Navigation state.
 */
export function parseLibrarySearchParams(searchParams: {
  get: (name: string) => string | null;
  getAll?: (name: string) => string[];
}): LibraryNavigationFilters {
  const search = searchParams.get('q') || undefined;
  const filter = searchParams.get('filter') || undefined;
  const savedSearchId = searchParams.get('savedSearchId') || undefined;
  const feedId = searchParams.get('feedId') || undefined;
  const isSavedSearchView = filter === 'saved-search' && Boolean(savedSearchId);

  const fromYearRaw = searchParams.get('fromYear');
  const toYearRaw = searchParams.get('toYear');
  const parsedFromYear = fromYearRaw ? parseInt(fromYearRaw, 10) : undefined;
  const parsedToYear = toYearRaw ? parseInt(toYearRaw, 10) : undefined;
  const fromYear =
    parsedFromYear !== undefined && Number.isFinite(parsedFromYear)
      ? parsedFromYear
      : undefined;
  const toYear =
    parsedToYear !== undefined && Number.isFinite(parsedToYear)
      ? parsedToYear
      : undefined;

  const types = searchParams.getAll ? searchParams.getAll('type').filter(Boolean) : [];
  const type =
    types.length > 0
      ? types.join(',')
      : (searchParams.get('type') || searchParams.get('itemType') || undefined);

  const readStatuses = searchParams.getAll ? searchParams.getAll('readStatus').filter(Boolean) : [];
  const readStatus =
    readStatuses.length > 0
      ? readStatuses.join(',')
      : (searchParams.get('readStatus') || undefined);

  const hasFileParam = searchParams.get('hasFile');
  const hasNotesParam = searchParams.get('hasNotes');
  const fileStatusParam = searchParams.get('fileStatus');

  const tags = searchParams.getAll ? searchParams.getAll('tag').filter(Boolean) : [];
  const tag =
    tags.length > 0
      ? tags.join(',')
      : (searchParams.get('tag') || undefined);

  let hasFile: boolean | undefined = undefined;
  if (hasFileParam !== null) hasFile = hasFileParam === 'true';
  else if (fileStatusParam === 'has-pdf') hasFile = true;
  else if (fileStatusParam === 'missing-pdf') hasFile = false;

  let hasNotes: boolean | undefined = undefined;
  if (hasNotesParam !== null) hasNotes = hasNotesParam === 'true';
  else if (fileStatusParam === 'has-notes') hasNotes = true;

  const orderBy = (searchParams.get('orderBy') as LibraryOrderBy | null) || undefined;
  const orderDirection =
    (searchParams.get('orderDirection') as 'asc' | 'desc' | null) || undefined;

  const pageParam = parseInt(searchParams.get('page') || '1', 10);
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;

  const selectedItemId =
    searchParams.get('item') || searchParams.get('selected') || undefined;

  return {
    search,
    filter,
    savedSearchId,
    feedId,
    isSavedSearchView,
    fromYear,
    toYear,
    type,
    readStatus,
    hasFile,
    hasNotes,
    tag,
    orderBy,
    orderDirection,
    page,
    selectedItemId,
  };
}

/**
 * Headless Coordinator for Library URL and Filter Navigation
 *
 * Centralizes:
 * 1. Type-safe parsing of all library query parameters.
 * 2. Uniform query string updating (preserving active params, resetting page on filter change).
 * 3. Deep-linking sync (?item=... or ?selected=...).
 * 4. Clean navigation actions: setSearch, setSorting, setPage, clearAllFilters.
 */
export function useLibraryNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsString = searchParams.toString();

  // Parsed Values
  const filters = useMemo(
    () => parseLibrarySearchParams(new URLSearchParams(searchParamsString)),
    [searchParamsString],
  );

  // Helper to push query updates
  const updateQuery = useCallback(
    (
      updater: (params: URLSearchParams) => void,
      options: { resetPage?: boolean; replace?: boolean } = {},
    ) => {
      const params = new URLSearchParams(searchParamsString);
      if (options.resetPage) {
        params.delete('page');
      }
      updater(params);
      const qs = params.toString();
      const targetUrl = qs ? `${pathname}?${qs}` : pathname;

      if (options.replace) {
        router.replace(targetUrl, { scroll: false });
      } else {
        router.push(targetUrl, { scroll: false });
      }
    },
    [pathname, router, searchParamsString],
  );

  // Navigation Actions
  const setSearch = useCallback(
    (q?: string) => {
      updateQuery(
        (p) => {
          if (q && q.trim()) {
            p.set('q', q.trim());
          } else {
            p.delete('q');
          }
        },
        { resetPage: true, replace: true },
      );
    },
    [updateQuery],
  );

  const clearSearch = useCallback(() => {
    updateQuery(
      (p) => {
        p.delete('q');
      },
      { resetPage: true, replace: true },
    );
  }, [updateQuery]);

  const setYearRange = useCallback(
    (from?: number, to?: number) => {
      updateQuery(
        (p) => {
          if (from) p.set('fromYear', String(from));
          else p.delete('fromYear');

          if (to) p.set('toYear', String(to));
          else p.delete('toYear');
        },
        { resetPage: true },
      );
    },
    [updateQuery],
  );

  const setTypeFilter = useCallback(
    (type?: string) => {
      updateQuery(
        (p) => {
          if (type) {
            p.set('type', type);
          } else {
            p.delete('type');
            p.delete('itemType');
          }
        },
        { resetPage: true },
      );
    },
    [updateQuery],
  );

  const setTagFilter = useCallback(
    (tag?: string) => {
      updateQuery(
        (p) => {
          if (tag) p.set('tag', tag);
          else p.delete('tag');
        },
        { resetPage: true },
      );
    },
    [updateQuery],
  );

  const setSorting = useCallback(
    (newOrderBy?: LibraryOrderBy, newOrderDirection?: 'asc' | 'desc') => {
      updateQuery(
        (p) => {
          if (newOrderBy) p.set('orderBy', newOrderBy);
          else p.delete('orderBy');

          if (newOrderDirection) p.set('orderDirection', newOrderDirection);
          else p.delete('orderDirection');
        },
        { resetPage: true },
      );
    },
    [updateQuery],
  );

  const setPage = useCallback(
    (newPage: number) => {
      updateQuery((p) => {
        if (newPage <= 1) {
          p.delete('page');
        } else {
          p.set('page', String(newPage));
        }
      });
    },
    [updateQuery],
  );

  const clearAllFilters = useCallback(() => {
    updateQuery(
      (p) => {
        p.delete('q');
        p.delete('fromYear');
        p.delete('toYear');
        p.delete('type');
        p.delete('itemType');
        p.delete('readStatus');
        p.delete('hasFile');
        p.delete('hasNotes');
        p.delete('fileStatus');
        p.delete('tag');
        p.delete('page');
      },
      { resetPage: true },
    );
  }, [updateQuery]);

  const selectItemInUrl = useCallback(
    (itemId?: string) => {
      updateQuery(
        (p) => {
          if (itemId) {
            p.set('item', itemId);
            p.delete('selected');
          } else {
            p.delete('item');
            p.delete('selected');
          }
        },
        { replace: true },
      );
    },
    [updateQuery],
  );

  const navigateToCollection = useCallback(
    (collectionId?: string) => {
      if (!collectionId) {
        router.push('/library');
      } else {
        router.push(`/library/${collectionId}`);
      }
    },
    [router],
  );

  return useMemo(
    () => ({
      filters,
      search: filters.search,
      fromYear: filters.fromYear,
      toYear: filters.toYear,
      type: filters.type,
      tag: filters.tag,
      hasFile: filters.hasFile,
      hasNotes: filters.hasNotes,
      readStatus: filters.readStatus,
      orderBy: filters.orderBy,
      orderDirection: filters.orderDirection,
      page: filters.page,
      selectedItemId: filters.selectedItemId,
      isSavedSearchView: filters.isSavedSearchView,
      savedSearchId: filters.savedSearchId,
      feedId: filters.feedId,
      filterParam: filters.filter,
      searchParams,

      // Actions
      updateQuery,
      setSearch,
      clearSearch,
      setYearRange,
      setTypeFilter,
      setTagFilter,
      setSorting,
      setPage,
      clearAllFilters,
      selectItemInUrl,
      navigateToCollection,
    }),
    [
      filters,
      searchParams,
      updateQuery,
      setSearch,
      clearSearch,
      setYearRange,
      setTypeFilter,
      setTagFilter,
      setSorting,
      setPage,
      clearAllFilters,
      selectItemInUrl,
      navigateToCollection,
    ],
  );
}
