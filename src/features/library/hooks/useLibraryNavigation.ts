'use client';

import { useMemo, useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import type { LibraryOrderBy } from '../components/topbar/LibraryDisplayPopover';

export interface LibraryNavigationFilters {
  search?: string;
  filter?: string;
  savedSearchId?: string;
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

  // ── Parsed Values ────────────────────────────────────────────────────────────
  const search = searchParams.get('q') || undefined;
  const filterParam = searchParams.get('filter') || undefined;
  const savedSearchId = searchParams.get('savedSearchId') || undefined;
  const isSavedSearchView = filterParam === 'saved-search' && Boolean(savedSearchId);

  const fromYearParam = searchParams.get('fromYear');
  const toYearParam = searchParams.get('toYear');
  const fromYear = fromYearParam ? parseInt(fromYearParam, 10) : undefined;
  const toYear = toYearParam ? parseInt(toYearParam, 10) : undefined;

  const typeParam = searchParams.get('type') || searchParams.get('itemType') || undefined;
  const readStatusParam = searchParams.get('readStatus') || undefined;
  const hasFileParam = searchParams.get('hasFile');
  const hasNotesParam = searchParams.get('hasNotes');
  const fileStatusParam = searchParams.get('fileStatus');
  const tagParam = searchParams.get('tag') || undefined;

  const hasFile = useMemo(() => {
    if (hasFileParam !== null) return hasFileParam === 'true';
    if (fileStatusParam === 'has-pdf') return true;
    if (fileStatusParam === 'missing-pdf') return false;
    return undefined;
  }, [hasFileParam, fileStatusParam]);

  const hasNotes = useMemo(() => {
    if (hasNotesParam !== null) return hasNotesParam === 'true';
    if (fileStatusParam === 'has-notes') return true;
    return undefined;
  }, [hasNotesParam, fileStatusParam]);

  const orderBy = (searchParams.get('orderBy') as LibraryOrderBy | null) || undefined;
  const orderDirection =
    (searchParams.get('orderDirection') as 'asc' | 'desc' | null) || undefined;

  const pageParam = parseInt(searchParams.get('page') || '1', 10);
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;

  const selectedItemId =
    searchParams.get('item') || searchParams.get('selected') || undefined;

  const filters: LibraryNavigationFilters = useMemo(
    () => ({
      search,
      filter: filterParam,
      savedSearchId,
      isSavedSearchView,
      fromYear: Number.isFinite(fromYear) ? fromYear : undefined,
      toYear: Number.isFinite(toYear) ? toYear : undefined,
      type: typeParam,
      readStatus: readStatusParam,
      hasFile,
      hasNotes,
      tag: tagParam,
      orderBy,
      orderDirection,
      page,
      selectedItemId,
    }),
    [
      search,
      filterParam,
      savedSearchId,
      isSavedSearchView,
      fromYear,
      toYear,
      typeParam,
      readStatusParam,
      hasFile,
      hasNotes,
      tagParam,
      orderBy,
      orderDirection,
      page,
      selectedItemId,
    ],
  );

  // ── Helper to push query updates ─────────────────────────────────────────────
  const updateQuery = useCallback(
    (
      updater: (params: URLSearchParams) => void,
      options: { resetPage?: boolean; replace?: boolean } = {},
    ) => {
      const params = new URLSearchParams(searchParams.toString());
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
    [pathname, router, searchParams],
  );

  // ── Navigation Actions ───────────────────────────────────────────────────────
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

  return {
    filters,
    search,
    fromYear,
    toYear,
    type: typeParam,
    tag: tagParam,
    hasFile,
    hasNotes,
    readStatus: readStatusParam,
    orderBy,
    orderDirection,
    page,
    selectedItemId,
    isSavedSearchView,
    savedSearchId,
    filterParam,

    // Actions
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
  };
}
