'use client';

import React, { useMemo, useCallback, useState } from 'react';
import { toast } from 'sonner';
import { UploadCloud } from 'lucide-react';

import {
  useLibraryItemsQuery,
  usePrefetchNextLibraryItemsPage,
  normalizeScopeId,
} from '@/features/library/core/coordinator/item-action.coordinator';
import { useDetachItemFromCollectionMutation } from '@/features/library/core/coordinator/collection.coordinator';
import { useCollectionsQuery } from '@/features/library/core/coordinator/collection.coordinator';
import { useSavedSearchResults, useSavedSearches } from '@/features/library/core/coordinator/saved-search-builder.coordinator';
import { ContentSkeleton } from './LibraryIllustrations';
import { ItemTable } from './ItemTable';
import { DuplicatesContent } from './DuplicatesContent';
import { FeedViewContent } from './FeedViewContent';
import { LibraryEmptyState } from './ItemTableHeader';
import { PlaneErrorState } from '@/shared/components/ui/PlaneErrorState';
import { ErrorBoundary } from '@/shared/components/ui/error-boundary';
import { BatchBar } from './BatchBar';
import { useLibraryUIStore } from '@/features/library/core/store/library-ui.store';
import { useProcessModalStore } from '@/features/library/core/store/process-modal.store';
import { createProvisionalUploadItem } from '@/features/library/domain/metadata.mapper';
import { useQuickCopyCoordinator } from '@/features/library/core/coordinator/citation-export.coordinator';
import { useLibraryNavigation } from '@/features/library/core/coordinator/navigation.coordinator';
import {
  type Item,
  type Collection,
  type DuplicateGroup,
} from '@/features/library/types/core.types';
import type { LibraryOrderBy } from '@/features/library/ui/topbar/LibraryDisplayPopover';

export { ContentSkeleton };

/** Fields requested from the server for the list view — kept at module scope to avoid inline array allocation. */
export const ITEM_LIST_FIELDS = [
  'id', 'title', 'itemType', 'type', 'year', 'publicationTitle',
  'authors', 'creators', 'contributors', 'firstAuthor', 'doi', 'citationKey',
  'hasFile', 'attachmentCount', 'noteCount', 'readStatus', 'rating', 'isStarred',
  'isMyPublication', 'isRetracted', 'retractionInfo', 'citationCount', 'extra',
  'version', 'createdAt', 'updatedAt', 'deletedAt', 'collectionIds',
  'tags', 'labels', 'url',
] as const;

export const PAGE_SIZE = 200;

/** Maps generic library order-by fields to the saved search results API sortBy contract. */
const mapOrderByToSavedSearchSortBy = (
  orderBy?: LibraryOrderBy | string,
):
  | 'dateAdded'
  | 'year'
  | 'title'
  | 'creator'
  | 'publicationTitle'
  | 'citationKey'
  | 'deletedAt'
  | 'updatedAt'
  | undefined => {
  if (!orderBy) return undefined;
  switch (orderBy) {
    case 'createdAt':
    case 'dateAdded':
      return 'dateAdded';
    case 'year':
      return 'year';
    case 'title':
      return 'title';
    case 'authors':
    case 'creator':
    case 'firstAuthor':
      return 'creator';
    case 'publication':
    case 'publicationTitle':
      return 'publicationTitle';
    case 'citationKey':
      return 'citationKey';
    case 'deletedAt':
    case 'dateDeleted':
      return 'deletedAt';
    case 'updatedAt':
    case 'dateModified':
      return 'updatedAt';
    default:
      return undefined;
  }
};

interface LibraryContentProps {
  scopeId?: string;
  collectionId?: string;
  savedSearchId?: string | null;
  feedId?: string;
  view?: string;
  canEdit?: boolean;
  onDirectFilesUpload?: (files: File[]) => void;
  onAddLink?: () => void;
  onMergeDuplicateGroup?: (group: DuplicateGroup, groupKey: string) => Promise<void> | void;
  onSelectedDuplicateGroupChange?: (
    group: DuplicateGroup | null,
    groupKey: string | null,
    dismissGroup: (groupKey: string) => Promise<void> | void,
    openMerge: (group: DuplicateGroup, groupKey?: string) => void,
  ) => void;
}

export function LibraryContent({
  scopeId,
  collectionId,
  savedSearchId: propSavedSearchId,
  feedId,
  view,
  canEdit = true,
  onDirectFilesUpload,
  onMergeDuplicateGroup,
  onSelectedDuplicateGroupChange,
}: LibraryContentProps) {
  const nav = useLibraryNavigation();

  const effectiveSavedSearchId =
    propSavedSearchId || (nav.filterParam === 'saved-search' ? nav.savedSearchId : null);
  const isSavedSearchView = Boolean(effectiveSavedSearchId);

  const displayOptions = useLibraryUIStore((s) => s.displayOptions);
  const setDisplayOptions = useLibraryUIStore((s) => s.setDisplayOptions);
  const processingItems = useProcessModalStore((s) => s.processingItems);

  const effectiveView = view || (nav.filterParam && nav.filterParam !== 'saved-search' ? nav.filterParam : undefined);

  const { savedSearches = [] } = useSavedSearches(scopeId, { enabled: isSavedSearchView });
  const activeSavedSearch = useMemo(
    () => savedSearches.find((s) => s.id === effectiveSavedSearchId),
    [savedSearches, effectiveSavedSearchId],
  );

  const savedSearchSortBy = isSavedSearchView && !nav.orderBy ? (activeSavedSearch?.sortBy as LibraryOrderBy | undefined) : undefined;
  const savedSearchSortOrder = isSavedSearchView && !nav.orderDirection ? activeSavedSearch?.sortOrder : undefined;

  const hasActiveSearch = Boolean(nav.search?.trim());
  const isTrashView = effectiveView === 'trash';
  const isRecentView = effectiveView === 'recent';

  const isStandardOrderBy =
    displayOptions?.orderBy && displayOptions.orderBy !== 'relevance'
      ? displayOptions.orderBy
      : 'createdAt';

  const effectiveOrderBy: LibraryOrderBy | undefined =
    (nav.orderBy === 'relevance' && !hasActiveSearch
      ? undefined
      : nav.orderBy) ||
    savedSearchSortBy ||
    (hasActiveSearch && !isSavedSearchView && !isTrashView && !isRecentView
      ? 'relevance'
      : isStandardOrderBy);
  const effectiveOrderDirection: 'asc' | 'desc' | undefined =
    nav.orderDirection ||
    savedSearchSortOrder ||
    (effectiveOrderBy === 'relevance' && !nav.orderDirection
      ? 'desc'
      : displayOptions?.orderDirection);

  const effectiveDisplayOptions = useMemo(
    () => ({
      ...displayOptions,
      orderBy: effectiveOrderBy || displayOptions.orderBy,
      orderDirection: effectiveOrderDirection || displayOptions.orderDirection,
    }),
    [displayOptions, effectiveOrderBy, effectiveOrderDirection],
  );

  const filterKey = useMemo(
    () =>
      JSON.stringify([
        scopeId,
        collectionId,
        effectiveSavedSearchId,
        effectiveView,
        displayOptions?.includeSubcollections,
        nav.search,
        nav.searchMode,
        nav.type,
        nav.fromYear,
        nav.toYear,
        nav.readStatus,
        nav.hasFile,
        nav.hasNotes,
        nav.tag,
        effectiveOrderBy,
        effectiveOrderDirection,
      ]),
    [
      scopeId,
      collectionId,
      effectiveSavedSearchId,
      effectiveView,
      displayOptions?.includeSubcollections,
      nav.search,
      nav.searchMode,
      nav.type,
      nav.fromYear,
      nav.toYear,
      nav.readStatus,
      nav.hasFile,
      nav.hasNotes,
      nav.tag,
      effectiveOrderBy,
      effectiveOrderDirection,
    ],
  );

  // Zotero Web Pattern: Ephemeral scroll-chunk page state (kept out of browser URL history
  // so Back/Forward navigates between views/filters and F5 always starts cleanly at chunk 1).
  const [scrollChunkState, setScrollChunkState] = useState<{
    filterKey: string;
    page: number;
  }>({ filterKey: '', page: 1 });

  const activePage =
    scrollChunkState.filterKey === filterKey ? scrollChunkState.page : 1;

  const setActivePage = useCallback(
    (nextPage: number) => {
      setScrollChunkState({
        filterKey,
        page: Math.max(1, nextPage),
      });
    },
    [filterKey],
  );

  const queryParams = useMemo(
    () => ({
      collectionId,
      includeSubcollections: displayOptions?.includeSubcollections ?? true,
      view: effectiveView,
      search: nav.search,
      searchMode: nav.searchMode,
      type: nav.type,
      fromYear: nav.fromYear,
      toYear: nav.toYear,
      readStatus: nav.readStatus,
      hasFile: nav.hasFile,
      hasNotes: nav.hasNotes,
      tag: nav.tag,
      orderBy: effectiveOrderBy,
      orderDirection: effectiveOrderDirection,
      fields: ITEM_LIST_FIELDS,
      page: activePage,
      limit: PAGE_SIZE,
    }),
    [
      collectionId,
      displayOptions?.includeSubcollections,
      effectiveView,
      nav.search,
      nav.searchMode,
      nav.type,
      nav.fromYear,
      nav.toYear,
      nav.readStatus,
      nav.hasFile,
      nav.hasNotes,
      nav.tag,
      effectiveOrderBy,
      effectiveOrderDirection,
      activePage,
    ],
  );

  const isDuplicates = effectiveView === 'duplicates';
  const isFeed = effectiveView === 'feed';

  const {
    data,
    isLoading: isItemsLoading,
    isFetching: isItemsFetching,
    isError: isItemsError,
    error: itemsError,
  } = useLibraryItemsQuery(scopeId, queryParams, {
    enabled: !isSavedSearchView && !isDuplicates && !isFeed,
  });

  const savedSearchQuery = useSavedSearchResults(
    scopeId,
    effectiveSavedSearchId || null,
    {
      page: activePage,
      limit: PAGE_SIZE,
      sortBy:
        mapOrderByToSavedSearchSortBy(effectiveOrderBy) ||
        mapOrderByToSavedSearchSortBy(savedSearchSortBy),
      sortOrder: effectiveOrderDirection,
    },
  );

  const { data: collections = [] } = useCollectionsQuery(scopeId);
  const detachMutation = useDetachItemFromCollectionMutation(scopeId);

  const isLoading = isSavedSearchView ? savedSearchQuery.isLoading : isItemsLoading;
  const isFetching = isSavedSearchView ? savedSearchQuery.isFetching : isItemsFetching;
  const isError = isSavedSearchView ? savedSearchQuery.isError : isItemsError;
  const error = isSavedSearchView ? savedSearchQuery.error : itemsError;
  const isTrash = effectiveView === 'trash';

  const pageItems: Item[] = useMemo(() => {
    if (isSavedSearchView) {
      return savedSearchQuery.data?.items || [];
    }
    return data?.items || [];
  }, [isSavedSearchView, savedSearchQuery.data?.items, data?.items]);

  const rawServerTotal = isSavedSearchView
    ? savedSearchQuery.data?.meta?.totalCount
    : (data?.meta?.totalCount ?? data?.total);

  const accumulatedStateRef = React.useRef<{
    filterKey: string;
    itemsByPage: Map<number, Item[]>;
    knownTotalCount: number;
  }>({ filterKey: '', itemsByPage: new Map(), knownTotalCount: 0 });

  React.useEffect(() => {
    if (accumulatedStateRef.current.filterKey !== filterKey || activePage <= 1) {
      const nextMap = new Map<number, Item[]>();
      nextMap.set(1, pageItems);
      const nextKnownTotal =
        typeof rawServerTotal === 'number' && rawServerTotal >= pageItems.length
          ? rawServerTotal
          : pageItems.length;
      accumulatedStateRef.current = {
        filterKey,
        itemsByPage: nextMap,
        knownTotalCount: nextKnownTotal,
      };
      return;
    }
    const nextMap = new Map(accumulatedStateRef.current.itemsByPage);
    nextMap.set(activePage, pageItems);
    const prevKnown = accumulatedStateRef.current.knownTotalCount;
    const nextKnownTotal =
      typeof rawServerTotal === 'number' && rawServerTotal > prevKnown
        ? rawServerTotal
        : prevKnown;
    accumulatedStateRef.current = {
      filterKey,
      itemsByPage: nextMap,
      knownTotalCount: nextKnownTotal,
    };
  }, [filterKey, activePage, pageItems, rawServerTotal]);

  const items: Item[] = useMemo(() => {
    if (accumulatedStateRef.current.filterKey !== filterKey || activePage <= 1) {
      return pageItems;
    }
    const seen = new Set<string>();
    const combined: Item[] = [];
    const pages = Array.from(
      new Set([...accumulatedStateRef.current.itemsByPage.keys(), activePage]),
    ).sort((a, b) => a - b);
    for (const p of pages) {
      if (p > activePage) continue;
      const list =
        p === activePage
          ? pageItems
          : accumulatedStateRef.current.itemsByPage.get(p) || [];
      for (const it of list) {
        if (!seen.has(it.id)) {
          seen.add(it.id);
          combined.push(it);
        }
      }
    }
    return combined;
  }, [filterKey, activePage, pageItems]);

  // Empty-page boundary recovery: if user is on page > 1 and the current page returned 0 items
  // (e.g. after deleting the last item on a page), step back to the previous loaded chunk.
  React.useEffect(() => {
    if (isDuplicates || isFeed) return;
    if (!isLoading && !isFetching && !isError && activePage > 1 && pageItems.length === 0) {
      const hasEarlierItems = Array.from(
        accumulatedStateRef.current.itemsByPage.entries(),
      ).some(([p, list]) => p < activePage && list.length > 0);
      setActivePage(hasEarlierItems ? activePage - 1 : 1);
    }
  }, [isDuplicates, isFeed, isLoading, isFetching, isError, activePage, pageItems.length, setActivePage]);

  // Construct provisional raw items from active background uploads
  const provisionalItems: Item[] = useMemo(() => {
    if (isTrash) return [];
    if (isSavedSearchView) return [];
    if (
      effectiveView === 'starred' ||
      effectiveView === 'my-publications' ||
      effectiveView === 'retracted'
    ) {
      return [];
    }

    const targetScope = normalizeScopeId(scopeId);
    const activeProcessing = processingItems.filter((p) => {
      const pScope = normalizeScopeId(p.scopeId);
      if (pScope !== targetScope) return false;
      if (effectiveView === 'unfiled' && p.collectionId) return false;
      if (collectionId && p.collectionId && p.collectionId !== collectionId) return false;
      return true;
    });

    if (activeProcessing.length === 0) return [];

    const existingIds = new Set(items.map((i) => i.id));

    return activeProcessing
      .filter((p) => !p.itemId || !existingIds.has(p.itemId))
      .map((p): Item => createProvisionalUploadItem(p, targetScope, collectionId));
  }, [isTrash, isSavedSearchView, effectiveView, processingItems, scopeId, collectionId, items]);

  const displayedItems: Item[] = useMemo(() => {
    if (provisionalItems.length === 0) return items;
    return [...provisionalItems, ...items];
  }, [provisionalItems, items]);

  const serverHasNextPage = isSavedSearchView
    ? Boolean(savedSearchQuery.data?.meta?.hasNextPage)
    : Boolean(data?.hasNextPage);

  const baseTotalCount = Math.max(
    typeof rawServerTotal === 'number' ? rawServerTotal : 0,
    accumulatedStateRef.current.filterKey === filterKey
      ? accumulatedStateRef.current.knownTotalCount
      : 0,
    items.length + (serverHasNextPage ? 1 : 0),
  );

  const totalCount = baseTotalCount + provisionalItems.length;

  const totalPages = Math.max(1, Math.ceil(baseTotalCount / PAGE_SIZE));
  const hasNextPage = serverHasNextPage || activePage < totalPages;

  // Zotero Web Pattern: Lookahead background prefetch of next chunk (page + 1)
  usePrefetchNextLibraryItemsPage({
    scopeId,
    queryParams,
    activePage,
    baseTotalCount,
    enabled: !(
      isSavedSearchView ||
      isDuplicates ||
      isFeed ||
      isLoading ||
      isFetching ||
      !hasNextPage ||
      Boolean(nav.search?.trim())
    ),
  });

  const clearSelection = useLibraryUIStore((s) => s.clearSelection);
  const setActiveCollectionId = useLibraryUIStore((s) => s.setActiveCollectionId);
  const setActiveSavedSearchId = useLibraryUIStore((s) => s.setActiveSavedSearchId);

  const prevRouteContextRef = React.useRef<{
    view?: string;
    collectionId?: string;
    savedSearchId?: string | null;
  } | null>(null);

  React.useEffect(() => {
    setActiveCollectionId(collectionId ?? null);
    setActiveSavedSearchId(effectiveSavedSearchId ?? null);

    const prev = prevRouteContextRef.current;
    if (
      prev &&
      (prev.view !== effectiveView ||
        prev.collectionId !== collectionId ||
        prev.savedSearchId !== effectiveSavedSearchId)
    ) {
      clearSelection();
    }
    prevRouteContextRef.current = {
      view: effectiveView,
      collectionId,
      savedSearchId: effectiveSavedSearchId,
    };
  }, [
    effectiveView,
    collectionId,
    effectiveSavedSearchId,
    clearSelection,
    setActiveCollectionId,
    setActiveSavedSearchId,
  ]);

  // Zotero 7 Quick Copy Coordinator (Ctrl+Shift+C: Bibliography, Ctrl+Shift+A: In-text Citation)
  useQuickCopyCoordinator({
    scopeId,
    items: displayedItems,
  });

  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      if (!canEdit || isTrash || !onDirectFilesUpload) return;
      if (e.dataTransfer.types.includes('Files')) {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
      }
    },
    [canEdit, isTrash, onDirectFilesUpload],
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      if (!canEdit || isTrash || !onDirectFilesUpload) return;
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        const files = Array.from(e.dataTransfer.files);
        onDirectFilesUpload(files);
      }
    },
    [canEdit, isTrash, onDirectFilesUpload],
  );

  const displayedItemsRef = React.useRef(displayedItems);
  displayedItemsRef.current = displayedItems;

  const handleDetachItem = useCallback(
    (itemId: string) => {
      if (!collectionId) return;
      const targetItem = displayedItemsRef.current.find((it) => it.id === itemId);
      if (targetItem?._isProcessing) {
        toast.warning('Cannot remove files that are currently uploading or processing', {
          id: 'library-item-guard',
        });
        return;
      }
      detachMutation.mutate({ collectionId, itemId });
    },
    [collectionId, detachMutation],
  );

  const { setSorting } = nav;

  const handleLoadMore = useCallback(() => {
    if (!isFetching && hasNextPage) {
      setActivePage(activePage + 1);
    }
  }, [isFetching, hasNextPage, setActivePage, activePage]);

  const handleSortChange = useCallback(
    (columnKey: string, direction: 'asc' | 'desc') => {
      setDisplayOptions((prev) => ({
        ...prev,
        orderBy: columnKey as LibraryOrderBy,
        orderDirection: direction,
      }));
      setSorting(columnKey as LibraryOrderBy, direction);
      clearSelection();
    },
    [setDisplayOptions, setSorting, clearSelection],
  );

  if (isDuplicates) {
    return (
      <DuplicatesContent
        scopeId={scopeId}
        canEdit={canEdit}
        onMergeGroup={onMergeDuplicateGroup}
        onSelectedGroupChange={onSelectedDuplicateGroupChange}
      />
    );
  }

  if (isFeed) {
    return (
      <FeedViewContent
        feedId={feedId || nav.feedId}
        scopeId={scopeId}
        canEdit={canEdit}
      />
    );
  }

  if (isLoading) {
    return <ContentSkeleton rowCount={10} />;
  }

  if (isError) {
    return (
      <PlaneErrorState
        title="Unable to load references"
        description="An issue occurred while loading the reference library. Other features remain unaffected."
        error={error || new Error('Internal Server Error')}
      />
    );
  }

  if (displayedItems.length === 0) {
    const activeCollection = collectionId ? collections.find((c) => c.id === collectionId) : undefined;
    return (
      <LibraryEmptyState
        canEdit={canEdit}
        search={nav.search}
        activeFilter={isSavedSearchView ? 'saved-search' : (view || nav.filterParam)}
        collectionId={collectionId}
        collectionName={activeCollection?.name}
        onDirectFilesUpload={onDirectFilesUpload}
      />
    );
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="h-full w-full relative flex flex-col overflow-hidden"
    >
      {isDragOver && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/85 backdrop-blur-sm border-2 border-dashed border-primary pointer-events-none animate-in fade-in-50 duration-150">
          <UploadCloud className="size-10 text-muted-foreground animate-pulse mb-2" strokeWidth={1.5} />
          <p className="text-14 font-semibold text-foreground">Drop files to upload</p>
          <p className="text-12 text-foreground">PDF, BibTeX, RIS will be uploaded directly</p>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-hidden">
        <ErrorBoundary variant="section" featureName="Reference Table">
          <ItemTable
            items={displayedItems}
            totalCount={totalCount}
            hasNextPage={hasNextPage}
            isLoadingMore={isFetching && activePage > 1}
            onLoadMore={hasNextPage ? handleLoadMore : undefined}
            displayOptions={effectiveDisplayOptions}
            onSortChange={handleSortChange}
            scopeId={scopeId}
            collectionId={collectionId}
            onDetachItem={canEdit && !isTrash && collectionId ? handleDetachItem : undefined}
            isTrash={isTrash}
            canEdit={canEdit}
          />
        </ErrorBoundary>
      </div>

      {/* Floating Multi-Selection Action Bar */}
      <BatchBar
        items={displayedItems}
        collectionId={collectionId}
        view={isSavedSearchView ? 'saved-search' : effectiveView}
        collections={collections as Collection[]}
        isTrash={isTrash}
        scopeId={scopeId}
        canEdit={canEdit}
      />
    </div>
  );
}

export default LibraryContent;

