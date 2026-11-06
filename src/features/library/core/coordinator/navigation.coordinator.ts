'use client';

import { useMemo, useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import type { LibraryOrderBy } from '@/features/library/types/ingestion.types';
import type { LibraryPermissions } from '@/features/library/types/core.types';
import { resolveEffectiveLibraryPermissions } from '@/features/library/domain/library-permissions.policy';
import { useLibraryCountsQuery } from '@/features/library/sdk/queries/catalog.queries';
import { useLibraryDeltaSync } from '@/features/library/sdk/queries/sync.queries';
import { useLibraryUIStore } from '@/features/library/core/store/library-ui.store';

export { useLibraryDeltaSync };

function resolveActiveLibraryScopeId(
  activeScope?: { type?: string; id?: string; projectId?: string } | null,
  explicitScopeId?: string | null,
  fallbackProjectId?: string | null,
): string {
  if (explicitScopeId) return explicitScopeId;
  if (fallbackProjectId) return fallbackProjectId;
  if (activeScope?.type === 'project') {
    return activeScope.projectId || activeScope.id || 'user';
  }
  return 'user';
}

/**
 * Permissions Coordinator Hook
 *
 * Single Source of Truth for combining Client Scope (Zustand Store),
 * Server Permissions & Capability Counts (TanStack Query), and Pure RBAC Policies.
 * Decoupled from pure Zustand Store selectors.
 */
export function useLibraryPermissions(): LibraryPermissions {
  const activeScope = useLibraryUIStore((state) => state.activeScope);
  const effectiveScopeId = resolveActiveLibraryScopeId(activeScope);
  const { data: countsData } = useLibraryCountsQuery(effectiveScopeId);

  return useMemo(
    () =>
      resolveEffectiveLibraryPermissions(
        activeScope,
        countsData
          ? {
              role: countsData.role || countsData.yourRole,
              permissions: countsData.permissions,
              effectivePermissions: countsData.effectivePermissions,
              permissionOverrides: countsData.permissionOverrides,
            }
          : null,
      ),
    [activeScope, countsData],
  );
}

interface LibraryNavigationFilters {
  search?: string;
  searchMode?: 'title_creator_year' | 'fields_tags' | 'everything';
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
  collectionId?: string;
}

/**
 * Pure URLSearchParams parser for Library Navigation state.
 */
function parseLibrarySearchParams(searchParams: {
  get: (name: string) => string | null;
  getAll?: (name: string) => string[];
}): LibraryNavigationFilters {
  const search = searchParams.get('q') || undefined;
  const rawSearchMode = searchParams.get('searchMode');
  const searchMode =
    rawSearchMode === 'title_creator_year' ||
    rawSearchMode === 'fields_tags' ||
    rawSearchMode === 'everything'
      ? rawSearchMode
      : undefined;
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
    searchMode,
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
  const urlSearchParams = useSearchParams();
  const urlSearchParamsString = urlSearchParams.toString();
  const ephemeralFilters = useLibraryUIStore((s) => s.ephemeralFilters);
  const setEphemeralFilters = useLibraryUIStore((s) => s.setEphemeralFilters);

  // Merge URL structural params (filter, savedSearchId, feedId, item) with in-memory ephemeralFilters
  const mergedSearchParams = useMemo(() => {
    const params = new URLSearchParams(urlSearchParamsString);
    const ephemeralKeys = [
      'q',
      'searchMode',
      'fileStatus',
      'hasFile',
      'hasNotes',
      'readStatus',
      'type',
      'itemType',
      'fromYear',
      'toYear',
      'startDate',
      'endDate',
      'tag',
      'orderBy',
      'orderDirection',
      'page',
    ] as const;

    for (const key of ephemeralKeys) {
      params.delete(key);
      const val = ephemeralFilters[key];
      if (Array.isArray(val)) {
        for (const item of val) {
          if (item !== undefined && item !== '') {
            params.append(key, String(item));
          }
        }
      } else if (val !== undefined && val !== '') {
        params.set(key, String(val));
      }
    }
    return params;
  }, [urlSearchParamsString, ephemeralFilters]);

  // Parsed Values
  const filters = useMemo(
    () => parseLibrarySearchParams(mergedSearchParams),
    [mergedSearchParams],
  );

  const collectionMatch = pathname.match(/\/library\/([a-zA-Z0-9_-]+)/);
  const routeCollectionId =
    collectionMatch &&
    !['trash', 'unfiled', 'duplicates', 'feeds', 'saved-searches'].includes(
      collectionMatch[1],
    )
      ? collectionMatch[1]
      : undefined;
  const effectiveCollectionId = filters.collectionId || routeCollectionId;

  // Helper to update in-memory filter state (and only touch URL if structural route params changed)
  const updateQuery = useCallback(
    (
      updater: (params: URLSearchParams) => void,
      options: { resetPage?: boolean; replace?: boolean; clearSelection?: boolean } = {},
    ) => {
      if (options.clearSelection || options.resetPage) {
        useLibraryUIStore.getState().clearSelection();
      }
      const currentEphemeral = useLibraryUIStore.getState().ephemeralFilters;
      const params = new URLSearchParams(urlSearchParamsString);
      const ephemeralKeys = [
        'q',
        'searchMode',
        'fileStatus',
        'hasFile',
        'hasNotes',
        'readStatus',
        'type',
        'itemType',
        'fromYear',
        'toYear',
        'startDate',
        'endDate',
        'tag',
        'orderBy',
        'orderDirection',
        'page',
      ] as const;

      for (const key of ephemeralKeys) {
        params.delete(key);
        const val = currentEphemeral[key];
        if (Array.isArray(val)) {
          for (const item of val) {
            if (item !== undefined && item !== '') {
              params.append(key, String(item));
            }
          }
        } else if (val !== undefined && val !== '') {
          params.set(key, String(val));
        }
      }

      if (options.resetPage) {
        params.delete('page');
      }
      updater(params);

      // Extract updated ephemeral filter state into Zustand (zero URL router overhead)
      const nextEphemeral: Record<string, string | string[] | number | undefined> = {};
      for (const key of ephemeralKeys) {
        const allVals = params.getAll(key).filter((v) => v !== '');
        if (allVals.length > 1) {
          nextEphemeral[key] = allVals;
        } else if (allVals.length === 1) {
          nextEphemeral[key] = key === 'page' ? Number(allVals[0]) || 1 : allVals[0];
        }
        params.delete(key);
      }
      setEphemeralFilters(nextEphemeral);

      // Only push/replace URL if structural non-filter params (e.g. filter=saved-search, savedSearchId, item) changed
      const cleanUrlParams = new URLSearchParams(urlSearchParamsString);
      for (const key of ephemeralKeys) {
        cleanUrlParams.delete(key);
      }
      const nextStructuralQs = params.toString();
      const prevStructuralQs = cleanUrlParams.toString();
      if (nextStructuralQs !== prevStructuralQs) {
        const targetUrl = nextStructuralQs ? `${pathname}?${nextStructuralQs}` : pathname;
        if (options.replace) {
          router.replace(targetUrl, { scroll: false });
        } else {
          router.push(targetUrl, { scroll: false });
        }
      }
    },
    [pathname, router, urlSearchParamsString, setEphemeralFilters],
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
            if (p.get('orderBy') === 'relevance') {
              p.delete('orderBy');
              p.delete('orderDirection');
            }
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
        if (p.get('orderBy') === 'relevance') {
          p.delete('orderBy');
          p.delete('orderDirection');
        }
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
      updateQuery(
        (p) => {
          if (newPage <= 1) {
            p.delete('page');
          } else {
            p.set('page', String(newPage));
          }
        },
        { clearSelection: true },
      );
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
      useLibraryUIStore.getState().clearSelection();
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
      searchMode: filters.searchMode,
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
      collectionId: effectiveCollectionId,
      searchParams: mergedSearchParams,

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
      mergedSearchParams,
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
