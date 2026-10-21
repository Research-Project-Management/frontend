'use client';

import React, { useMemo, useCallback, useState } from 'react';
import { toast } from 'sonner';
import { UploadCloud, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { useLibraryItemsQuery } from '@/features/library/sdk/queries/catalog.queries';
import { useDetachItemFromCollectionMutation } from '@/features/library/sdk/queries/collections.queries';
import { useCollectionsQuery } from '@/features/library/sdk/queries/collections.queries';
import { useSavedSearchResults } from '@/features/library/sdk/queries/saved-searches-relations.queries';
import { ContentSkeleton } from './ContentSkeleton';
import { ItemTable } from './ItemTable';
import { DuplicatesContent } from './DuplicatesContent';
import { FeedViewContent } from './FeedViewContent';
import LibraryEmptyState from './LibraryEmptyState';
import { PlaneErrorState } from '@/shared/components/ui/PlaneErrorState';
import { ErrorBoundary } from '@/shared/components/ui/error-boundary';
import { BatchBar } from './BatchBar';
import { useLibraryUIStore } from '@/features/library/core/store/library-ui.store';
import { useProcessModalStore } from '@/features/library/core/store/process-modal.store';
import { createProvisionalUploadItem } from '@/features/library/domain/metadata';
import { useQuickCopyCoordinator } from '@/features/library/core/coordinator/quick-copy.coordinator';
import { useLibraryBatchCoordinator } from '@/features/library/core/coordinator/batch-action.coordinator';
import { useLibraryNavigation } from '@/features/library/core/coordinator/navigation.coordinator';
import {
  type Item,
  type Collection,
  type DuplicateGroup,
} from '@/features/library/domain/types/library.types';
import type { LibraryOrderBy } from '@/features/library/ui/topbar/LibraryDisplayPopover';

/** Fields requested from the server for the list view — kept at module scope to avoid inline array allocation. */
const ITEM_LIST_FIELDS = [
  'id', 'title', 'itemType', 'type', 'year', 'publicationTitle',
  'authors', 'creators', 'contributors', 'firstAuthor', 'doi', 'citationKey',
  'hasFile', 'attachmentCount', 'noteCount', 'readStatus', 'rating', 'isStarred',
  'version', 'createdAt', 'updatedAt', 'deletedAt', 'collectionIds',
  'tags', 'labels', 'url',
] as const;

const PAGE_SIZE = 50;

/** Computes visible page numbers with ellipsis for clean minimal pagination */
function getVisiblePages(currentPage: number, totalPages: number): (number | 'ellipsis')[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, 'ellipsis', totalPages];
  }
  if (currentPage >= totalPages - 3) {
    return [1, 'ellipsis', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }
  return [1, 'ellipsis', currentPage - 1, currentPage, currentPage + 1, 'ellipsis', totalPages];
}

/** Maps generic library order-by fields to the saved search results API sortBy contract. */
export const mapOrderByToSavedSearchSortBy = (
  orderBy?: LibraryOrderBy | string,
): 'dateAdded' | 'year' | 'title' | 'creator' | 'updatedAt' | undefined => {
  if (!orderBy) return undefined;
  switch (orderBy) {
    case 'createdAt':
      return 'dateAdded';
    case 'year':
      return 'year';
    case 'title':
      return 'title';
    case 'authors':
      return 'creator';
    case 'updatedAt':
      return 'updatedAt';
    default:
      return undefined;
  }
};

interface LibraryContentProps {
  scopeId?: string;
  collectionId?: string;
  savedSearchId?: string | null;
  view?: string;
  canEdit?: boolean;
  onDirectFilesUpload?: (files: File[]) => void;
  onAddLink?: () => void;
  onSelectedDuplicateGroupChange?: (
    group: DuplicateGroup | null,
    groupKey: string | null,
    dismissGroup: (groupKey: string) => void,
    openMerge: (group: DuplicateGroup, groupKey?: string) => void,
  ) => void;
}

export function LibraryContent({
  scopeId,
  collectionId,
  savedSearchId: propSavedSearchId,
  view,
  canEdit = true,
  onDirectFilesUpload,
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

  const effectiveOrderBy = nav.orderBy || displayOptions?.orderBy;
  const effectiveOrderDirection = nav.orderDirection || displayOptions?.orderDirection;

  const queryParams = useMemo(
    () => ({
      collectionId,
      includeSubcollections: displayOptions?.includeSubcollections ?? true,
      view: effectiveView,
      search: nav.search,
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
      page: nav.page,
      limit: PAGE_SIZE,
    }),
    [
      collectionId,
      displayOptions?.includeSubcollections,
      effectiveView,
      nav.search,
      nav.type,
      nav.fromYear,
      nav.toYear,
      nav.readStatus,
      nav.hasFile,
      nav.hasNotes,
      nav.tag,
      effectiveOrderBy,
      effectiveOrderDirection,
      nav.page,
    ],
  );

  const isDuplicates = effectiveView === 'duplicates';
  const isFeed = effectiveView === 'feed';

  const {
    data,
    isLoading: isItemsLoading,
    isError: isItemsError,
    error: itemsError,
  } = useLibraryItemsQuery(scopeId, queryParams, {
    enabled: !isSavedSearchView && !isDuplicates && !isFeed,
  });

  const savedSearchQuery = useSavedSearchResults(
    scopeId,
    effectiveSavedSearchId || null,
    {
      page: nav.page,
      limit: PAGE_SIZE,
      sortBy: mapOrderByToSavedSearchSortBy(effectiveOrderBy),
      sortOrder: effectiveOrderDirection,
    },
  );

  const { data: collections = [] } = useCollectionsQuery(scopeId);
  const detachMutation = useDetachItemFromCollectionMutation(scopeId);

  const isLoading = isSavedSearchView ? savedSearchQuery.isLoading : isItemsLoading;
  const isError = isSavedSearchView ? savedSearchQuery.isError : isItemsError;
  const error = isSavedSearchView ? savedSearchQuery.error : itemsError;
  const isTrash = effectiveView === 'trash';

  const items: Item[] = useMemo(() => {
    if (isSavedSearchView) {
      return savedSearchQuery.data?.items || [];
    }
    return data?.items || [];
  }, [isSavedSearchView, savedSearchQuery.data?.items, data?.items]);

  // Construct provisional raw items from active background uploads
  const provisionalItems: Item[] = useMemo(() => {
    if (isTrash) return [];
    if (isSavedSearchView) return [];

    const targetScope = scopeId || 'user';
    const activeProcessing = processingItems.filter((p) => {
      const pScope = p.scopeId || 'user';
      if (pScope !== targetScope) return false;
      if (collectionId && p.collectionId && p.collectionId !== collectionId) return false;
      return true;
    });

    if (activeProcessing.length === 0) return [];

    const existingIds = new Set(items.map((i) => i.id));

    return activeProcessing
      .filter((p) => !p.itemId || !existingIds.has(p.itemId))
      .map((p): Item => createProvisionalUploadItem(p, targetScope, collectionId));
  }, [isTrash, isSavedSearchView, processingItems, scopeId, collectionId, items]);

  const displayedItems: Item[] = useMemo(() => {
    if (provisionalItems.length === 0) return items;
    return [...provisionalItems, ...items];
  }, [provisionalItems, items]);

  const totalCount =
    (isSavedSearchView
      ? (savedSearchQuery.data?.meta?.totalCount ?? items.length)
      : (data?.total ?? items.length)) + provisionalItems.length;

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const clearSelection = useLibraryUIStore((s) => s.clearSelection);

  const batchCoordinator = useLibraryBatchCoordinator({
    items: displayedItems,
    scopeId: scopeId || 'user',
    collectionId,
    view: effectiveView,
    isTrash,
    canEdit,
  });

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

  const handleDetachItem = useCallback(
    (itemId: string) => {
      if (!collectionId) return;
      const targetItem = displayedItems.find((it) => it.id === itemId);
      if (targetItem?._isProcessing) {
        toast.warning('Cannot remove files that are currently uploading or processing', {
          id: 'library-item-guard',
        });
        return;
      }
      detachMutation.mutate({ collectionId, itemId });
    },
    [collectionId, detachMutation, displayedItems],
  );

  const { setSorting } = nav;

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
        onSelectedGroupChange={onSelectedDuplicateGroupChange}
      />
    );
  }

  if (isFeed) {
    return (
      <FeedViewContent
        feedId={nav.feedId}
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
            onSortChange={handleSortChange}
            scopeId={scopeId}
            collectionId={collectionId}
            onDetachItem={canEdit && !isTrash && collectionId ? handleDetachItem : undefined}
            isTrash={isTrash}
          />
        </ErrorBoundary>
      </div>

      {totalPages > 1 && (
        <nav
          role="navigation"
          aria-label="Pagination"
          className="flex items-center justify-center py-2 px-4 border-t border-border shrink-0 select-none bg-background"
        >
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={nav.page <= 1}
              onClick={() => {
                clearSelection();
                nav.setPage(nav.page - 1);
              }}
              aria-label="Previous page"
              className={cn(
                'inline-flex items-center justify-center size-7 rounded-md text-xs font-medium transition-colors relative before:absolute before:-inset-2 md:before:hidden',
                nav.page <= 1
                  ? 'text-muted-foreground cursor-not-allowed pointer-events-none'
                  : 'text-foreground hover:bg-muted cursor-pointer',
              )}
            >
              <ChevronLeft className="size-3.5" />
            </button>

            {getVisiblePages(nav.page, totalPages).map((p, idx) => {
              if (p === 'ellipsis') {
                return (
                  <span
                    key={`ellipsis-${idx}`}
                    className="inline-flex items-center justify-center size-7 text-xs text-foreground select-none"
                  >
                    …
                  </span>
                );
              }
              const isCurrent = p === nav.page;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    clearSelection();
                    nav.setPage(p);
                  }}
                  aria-current={isCurrent ? 'page' : undefined}
                  className={cn(
                    'inline-flex items-center justify-center size-7 rounded-md text-xs font-medium transition-colors cursor-pointer relative before:absolute before:-inset-2 md:before:hidden',
                    isCurrent
                      ? 'bg-muted text-foreground font-semibold border border-border shadow-xs'
                      : 'text-foreground hover:bg-muted',
                  )}
                >
                  {p}
                </button>
              );
            })}

            <button
              type="button"
              disabled={nav.page >= totalPages}
              onClick={() => {
                clearSelection();
                nav.setPage(nav.page + 1);
              }}
              aria-label="Next page"
              className={cn(
                'inline-flex items-center justify-center size-7 rounded-md text-xs font-medium transition-colors relative before:absolute before:-inset-2 md:before:hidden',
                nav.page >= totalPages
                  ? 'text-muted-foreground cursor-not-allowed pointer-events-none'
                  : 'text-foreground hover:bg-muted cursor-pointer',
              )}
            >
              <ChevronRight className="size-3.5" />
            </button>
          </div>
        </nav>
      )}

      {/* Floating Multi-Selection Action Bar */}
      <BatchBar
        coordinator={batchCoordinator}
        collections={collections as Collection[]}
        isTrash={isTrash}
        scopeId={scopeId}
      />
    </div>
  );
}

export default LibraryContent;



