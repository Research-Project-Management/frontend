'use client';

import React, { useMemo, useCallback, useState } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { toast } from 'sonner';
import { UploadCloud, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import {
  useLibraryItemsQuery,
  useCollectionsQuery,
  useBatchRestoreItemsMutation,
  useDetachItemFromCollectionMutation,
  useBatchDetachItemsMutation,
  useLibraryItemsData,
  useSavedSearchResults,
} from '../../data';
import { ContentSkeleton } from './ContentSkeleton';
import { ItemTable } from './ItemTable';
import LibraryEmptyState from './LibraryEmptyState';
import { PlaneErrorState } from '@/shared/components/ui/PlaneErrorState';
import { ErrorBoundary } from '@/shared/components/ui/error-boundary';
import { BatchBar } from './BatchBar';
import {
  useLibraryModalStore,
  useLibraryViewStore,
  useLibraryUIStore,
  useProcessModalStore,
  cleanFilenameToTitle,
} from '../../store';
import { useQuickCopyShortcuts } from '../../hooks/use-quick-copy';
import type { Item, Collection } from '../../types';
import type { LibraryOrderBy } from '../topbar/LibraryDisplayPopover';

/** Fields requested from the server for the list view — kept at module scope to avoid inline array allocation. */
const ITEM_LIST_FIELDS = [
  'id', 'title', 'itemType', 'type', 'year', 'publicationTitle', 'journal',
  'authors', 'creators', 'contributors', 'firstAuthor', 'doi', 'citationKey',
  'hasFile', 'attachmentCount', 'noteCount', 'readStatus', 'rating', 'isStarred',
  'version', 'createdAt', 'updatedAt', 'deletedAt', 'collectionIds', 'collectionId',
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
const mapOrderByToSavedSearchSortBy = (
  orderBy?: LibraryOrderBy,
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
  onEmptyTrash?: () => void;
}

export function LibraryContent({
  scopeId,
  collectionId,
  savedSearchId: propSavedSearchId,
  view,
  canEdit = true,
  onDirectFilesUpload,
  onAddLink,
  onEmptyTrash,
}: LibraryContentProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filterParam = searchParams.get('filter');
  const effectiveSavedSearchId =
    propSavedSearchId || (filterParam === 'saved-search' ? searchParams.get('savedSearchId') : null);
  const isSavedSearchView = Boolean(effectiveSavedSearchId);
  const search = searchParams.get('q') || undefined;
  const fromYearParam = searchParams.get('fromYear');
  const toYearParam = searchParams.get('toYear');
  const typeParam = searchParams.get('type') || searchParams.get('itemType') || undefined;
  const readStatusParam = searchParams.get('readStatus') || undefined;
  const hasFileParam = searchParams.get('hasFile');
  const hasNotesParam = searchParams.get('hasNotes');
  const fileStatusParam = searchParams.get('fileStatus');
  const tagParam = searchParams.get('tag') || undefined;

  const handleClearSearch = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('q');
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [router, pathname, searchParams]);

  const fromYear = fromYearParam ? parseInt(fromYearParam, 10) : undefined;
  const toYear = toYearParam ? parseInt(toYearParam, 10) : undefined;

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

  const openModal = useLibraryModalStore((s) => s.openModal);
  const selectedIds = useLibraryViewStore((s) => s.selectedIds);
  const clearSelection = useLibraryViewStore((s) => s.clearSelection);
  const displayOptions = useLibraryUIStore((s) => s.displayOptions);
  const setDisplayOptions = useLibraryUIStore((s) => s.setDisplayOptions);
  const processingItems = useProcessModalStore((s) => s.processingItems);

  const effectiveView = view || (filterParam && filterParam !== 'saved-search' ? filterParam : undefined);

  const orderByParam = searchParams.get('orderBy') as LibraryOrderBy | null;
  const orderDirectionParam = searchParams.get('orderDirection') as 'asc' | 'desc' | null;

  const pageParam = parseInt(searchParams.get('page') || '1', 10);
  const currentPage = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;

  const handlePageChange = useCallback(
    (newPage: number) => {
      const params = new URLSearchParams(searchParams.toString());
      if (newPage <= 1) {
        params.delete('page');
      } else {
        params.set('page', String(newPage));
      }
      clearSelection();
      const queryString = params.toString();
      router.push(`${pathname}${queryString ? `?${queryString}` : ''}`, { scroll: false });
    },
    [pathname, router, searchParams, clearSelection],
  );

  const effectiveOrderBy = orderByParam || displayOptions?.orderBy;
  const effectiveOrderDirection = orderDirectionParam || displayOptions?.orderDirection;

  const queryParams = useMemo(
    () => ({
      collectionId,
      view: effectiveView,
      search,
      type: typeParam,
      itemType: typeParam,
      fromYear: Number.isFinite(fromYear) ? fromYear : undefined,
      toYear: Number.isFinite(toYear) ? toYear : undefined,
      readStatus: readStatusParam,
      hasFile,
      hasNotes,
      tag: tagParam,
      orderBy: effectiveOrderBy,
      orderDirection: effectiveOrderDirection,
      fields: ITEM_LIST_FIELDS,
      page: currentPage,
      limit: PAGE_SIZE,
    }),
    [
      collectionId,
      effectiveView,
      search,
      typeParam,
      fromYear,
      toYear,
      readStatusParam,
      hasFile,
      hasNotes,
      tagParam,
      effectiveOrderBy,
      effectiveOrderDirection,
      currentPage,
    ],
  );

  const {
    data,
    isLoading: isItemsLoading,
    isError: isItemsError,
    error: itemsError,
  } = useLibraryItemsQuery(scopeId, queryParams, {
    enabled: !isSavedSearchView,
  });

  const savedSearchQuery = useSavedSearchResults(
    scopeId,
    effectiveSavedSearchId || null,
    {
      page: currentPage,
      limit: PAGE_SIZE,
      sortBy: mapOrderByToSavedSearchSortBy(effectiveOrderBy),
      sortOrder: effectiveOrderDirection,
    },
  );

  const { data: collections = [] } = useCollectionsQuery(scopeId);
  const { batchMoveItems } = useLibraryItemsData({ scopeId, collectionId });
  const restoreMutation = useBatchRestoreItemsMutation(scopeId);
  const detachMutation = useDetachItemFromCollectionMutation(scopeId);
  const batchDetachMutation = useBatchDetachItemsMutation(scopeId);

  const isLoading = isSavedSearchView ? savedSearchQuery.isLoading : isItemsLoading;
  const isError = isSavedSearchView ? savedSearchQuery.isError : isItemsError;
  const error = isSavedSearchView ? savedSearchQuery.error : itemsError;
  const isTrash = view === 'trash';

  const items: Item[] = useMemo(() => {
    if (isSavedSearchView) {
      return (savedSearchQuery.data?.items as unknown as Item[]) || [];
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
      .map((p) => {
        const title = p.extractedTitle || cleanFilenameToTitle(p.fileName);
        return {
          id: p.id,
          title,
          itemType: 'journalArticle',
          authors: p.status === 'PROCESSING' ? ['Processing metadata...'] : ['Uploading raw file...'],
          year: null,
          hasFile: true,
          attachmentCount: 1,
          attachments: [
            {
              id: `att-${p.id}`,
              filename: p.fileName,
              size: p.fileSize,
              mimeType: p.mimeType || 'application/pdf',
              url: p.fileUrl || '',
            },
          ],
          createdAt: p.createdAt,
          dateAdded: p.createdAt,
          _isProcessing: true,
          _processingStatus: p.status,
          _processingProgress: p.progress,
          _processingError: p.error,
        } as unknown as Item;
      });
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

  const selectedItems: Item[] = useMemo(() => {
    if (selectedIds.size === 0) return [];
    return displayedItems.filter((item) => selectedIds.has(item.id));
  }, [displayedItems, selectedIds]);

  const activeItemId = useLibraryUIStore((s) => s.activeItemId);

  // Zotero 7 Quick Copy Shortcuts (Ctrl+Shift+C: Bibliography, Ctrl+Shift+A: In-text Citation)
  useQuickCopyShortcuts({
    scopeId,
    items: displayedItems,
    selectedIds,
    activeItemId,
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

  /** IDs of currently-uploading items that cannot be moved, deleted, or detached. */
  const processingIds = useMemo(
    () =>
      new Set(
        selectedItems
          .filter((item: any) => item._isProcessing || item.id.startsWith('temp-') || item.id.startsWith('provisional-'))
          .map((item) => item.id),
      ),
    [selectedItems],
  );

  const handleBatchMove = (targetColId: string | null) => {
    const movableIds = Array.from(selectedIds).filter((id) => !processingIds.has(id));
    if (processingIds.size > 0) {
      toast.warning('Cannot move files that are currently uploading or processing', {
        id: 'library-item-guard',
      });
    }
    if (movableIds.length === 0) return;
    batchMoveItems(movableIds, targetColId);
    clearSelection();
  };

  const handleBatchDelete = () => {
    const deletableIds = Array.from(selectedIds).filter((id) => !processingIds.has(id));
    if (processingIds.size > 0) {
      toast.warning('Cannot delete files that are currently uploading or processing', {
        id: 'library-item-guard',
      });
    }
    if (deletableIds.length === 0) return;
    if (isTrash) {
      openModal('DELETE_ITEMS', { itemIds: deletableIds, permanent: true });
      return;
    }
    openModal('DELETE_ITEMS', { itemIds: deletableIds });
  };

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

  const handleBatchDetach = useCallback(() => {
    const detachableIds = Array.from(selectedIds).filter((id) => !processingIds.has(id));
    if (processingIds.size > 0) {
      toast.warning('Cannot remove files that are currently uploading or processing', {
        id: 'library-item-guard',
      });
    }
    if (!collectionId || detachableIds.length === 0) return;
    batchDetachMutation.mutate({ collectionId, itemIds: detachableIds });
    clearSelection();
  }, [collectionId, selectedIds, processingIds, batchDetachMutation, clearSelection]);

  const handleBatchRestore = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    restoreMutation.mutate(ids);
    clearSelection();
  };

  const handleBatchMerge = () => {
    if (selectedItems.length < 2) return;
    openModal('MERGE_DUPLICATES', { items: selectedItems, duplicates: selectedItems });
  };

  const handleSortChange = useCallback(
    (columnKey: string, direction: 'asc' | 'desc') => {
      setDisplayOptions((prev) => ({
        ...prev,
        orderBy: columnKey as LibraryOrderBy,
        orderDirection: direction,
      }));
      const params = new URLSearchParams(searchParams.toString());
      params.set('orderBy', columnKey);
      params.set('orderDirection', direction);
      params.delete('page'); // Reset to page 1 on sort change
      clearSelection();
      const queryString = params.toString();
      router.push(`${pathname}${queryString ? `?${queryString}` : ''}`, { scroll: false });
    },
    [pathname, router, searchParams, setDisplayOptions, clearSelection],
  );

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
        search={search}
        activeFilter={isSavedSearchView ? 'saved-search' : (view || searchParams.get('filter'))}
        collectionId={collectionId}
        collectionName={activeCollection?.name}
        onClearSearch={handleClearSearch}
        onDirectFilesUpload={onDirectFilesUpload}
        onAddLink={onAddLink || (() => openModal('ADD_LINK', { collectionId }))}
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
          <UploadCloud className="size-10 text-primary animate-pulse mb-2" strokeWidth={1.5} />
          <p className="text-14 font-semibold text-foreground">Drop files to upload</p>
          <p className="text-12 text-muted-foreground">PDF, BibTeX, RIS will be uploaded directly</p>
        </div>
      )}

      {/* Informative Trash Notice Banner */}
      {isTrash && (
        <div className="flex items-center justify-between gap-3 px-4 py-2 bg-muted/40 border-b border-border text-xs text-muted-foreground select-none shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Trash2 className="size-3.5 text-muted-foreground shrink-0" />
            <span className="truncate">
              Items in Trash will be removed permanently when emptied. References can be restored back to your library at any time.
            </span>
          </div>
          {canEdit && onEmptyTrash && displayedItems.length > 0 && (
            <button
              type="button"
              onClick={onEmptyTrash}
              className="font-medium text-destructive hover:underline shrink-0 cursor-pointer ml-2 text-xs"
            >
              Empty Trash now
            </button>
          )}
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
              disabled={currentPage <= 1}
              onClick={() => handlePageChange(currentPage - 1)}
              aria-label="Previous page"
              className={cn(
                'inline-flex items-center justify-center size-7 rounded-md text-xs font-medium transition-colors',
                currentPage <= 1
                  ? 'text-muted-foreground/30 cursor-not-allowed pointer-events-none'
                  : 'text-foreground hover:bg-muted cursor-pointer',
              )}
            >
              <ChevronLeft className="size-3.5" />
            </button>

            {getVisiblePages(currentPage, totalPages).map((p, idx) => {
              if (p === 'ellipsis') {
                return (
                  <span
                    key={`ellipsis-${idx}`}
                    className="inline-flex items-center justify-center size-7 text-xs text-muted-foreground select-none"
                  >
                    …
                  </span>
                );
              }
              const isCurrent = p === currentPage;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => handlePageChange(p)}
                  aria-current={isCurrent ? 'page' : undefined}
                  className={cn(
                    'inline-flex items-center justify-center size-7 rounded-md text-xs font-medium transition-colors cursor-pointer',
                    isCurrent
                      ? 'bg-muted text-foreground font-semibold border border-border shadow-xs'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
                  )}
                >
                  {p}
                </button>
              );
            })}

            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => handlePageChange(currentPage + 1)}
              aria-label="Next page"
              className={cn(
                'inline-flex items-center justify-center size-7 rounded-md text-xs font-medium transition-colors',
                currentPage >= totalPages
                  ? 'text-muted-foreground/30 cursor-not-allowed pointer-events-none'
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
        selectedCount={selectedIds.size}
        selectedItems={selectedItems}
        collections={collections as Collection[]}
        onClearSelection={clearSelection}
        onBatchMove={canEdit && !isTrash ? handleBatchMove : undefined}
        onBatchDelete={canEdit ? handleBatchDelete : undefined}
        onBatchRestore={canEdit && isTrash ? handleBatchRestore : undefined}
        onBatchDetach={canEdit && !isTrash && collectionId ? handleBatchDetach : undefined}
        onBatchMerge={canEdit && view === 'duplicates' && selectedItems.length >= 2 ? handleBatchMerge : undefined}
        isTrash={isTrash}
        scopeId={scopeId}
      />
    </div>
  );
}

export default LibraryContent;
