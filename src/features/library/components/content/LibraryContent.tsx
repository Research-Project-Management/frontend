'use client';

import React, { useMemo, useCallback, useState } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { UploadCloud } from 'lucide-react';
import {
  useInfiniteLibraryItemsQuery,
  useCollectionsQuery,
  useBatchRestoreItemsMutation,
  useBatchPurgeItemsMutation,
  useDetachItemFromCollectionMutation,
  useBatchDetachItemsMutation,
  useLibraryItemsData,
  useSavedSearchResults,
} from '../../data';
import { ContentSkeleton } from './ContentSkeleton';
import { ItemTable } from './ItemTable';
import LibraryEmptyState from './LibraryEmptyState';
import { PlaneErrorState } from '@/shared/components/ui/PlaneErrorState';
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

interface LibraryContentProps {
  scopeId?: string;
  collectionId?: string;
  savedSearchId?: string | null;
  view?: string;
  canEdit?: boolean;
  onDirectFilesUpload?: (files: File[]) => void;
  onAddLink?: () => void;
}

export function LibraryContent({
  scopeId,
  collectionId,
  savedSearchId: propSavedSearchId,
  view,
  canEdit = true,
  onDirectFilesUpload,
  onAddLink,
}: LibraryContentProps) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
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

  const handleClearSearch = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('q');
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }, [router, pathname, searchParams]);

  const fromYear = fromYearParam ? parseInt(fromYearParam, 10) : undefined;
  const toYear = toYearParam ? parseInt(toYearParam, 10) : undefined;
  const hasFile = hasFileParam !== null ? hasFileParam === 'true' : undefined;

  const openModal = useLibraryModalStore((s) => s.openModal);
  const selectedIds = useLibraryViewStore((s) => s.selectedIds);
  const clearSelection = useLibraryViewStore((s) => s.clearSelection);
  const displayOptions = useLibraryUIStore((s) => s.displayOptions);
  const setDisplayOptions = useLibraryUIStore((s) => s.setDisplayOptions);
  const processingItems = useProcessModalStore((s) => s.processingItems);

  const queryParams = useMemo(
    () => ({
      collectionId,
      view: (view as any) || undefined,
      search,
      type: typeParam,
      itemType: typeParam,
      fromYear: Number.isFinite(fromYear) ? fromYear : undefined,
      toYear: Number.isFinite(toYear) ? toYear : undefined,
      readStatus: readStatusParam,
      hasFile,
      orderBy: displayOptions?.orderBy,
      orderDirection: displayOptions?.orderDirection,
      fields: [
        'id',
        'title',
        'itemType',
        'type',
        'year',
        'publicationTitle',
        'journal',
        'authors',
        'creators',
        'contributors',
        'firstAuthor',
        'doi',
        'citationKey',
        'hasFile',
        'attachmentCount',
        'noteCount',
        'readStatus',
        'rating',
        'isStarred',
        'version',
        'createdAt',
        'updatedAt',
        'deletedAt',
        'collectionIds',
        'collectionId',
        'tags',
        'labels',
        'url',
      ],
    }),
    [
      collectionId,
      view,
      search,
      typeParam,
      fromYear,
      toYear,
      readStatusParam,
      hasFile,
      displayOptions?.orderBy,
      displayOptions?.orderDirection,
    ],
  );

  const {
    data,
    isLoading: isItemsLoading,
    isError: isItemsError,
    error: itemsError,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteLibraryItemsQuery(scopeId, queryParams, {
    enabled: !isSavedSearchView,
  });

  const savedSearchQuery = useSavedSearchResults(
    scopeId,
    effectiveSavedSearchId || null,
    {
      sortBy: displayOptions?.orderBy,
      sortOrder: displayOptions?.orderDirection,
    },
  );

  const { data: collections = [] } = useCollectionsQuery(scopeId);
  const { batchMoveItems } = useLibraryItemsData({ scopeId, collectionId });
  const restoreMutation = useBatchRestoreItemsMutation(scopeId);
  const purgeMutation = useBatchPurgeItemsMutation(scopeId);
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
    if (!data?.pages) return [];
    return data.pages.flatMap((page) => page.items);
  }, [isSavedSearchView, savedSearchQuery.data?.items, data?.pages]);

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
      : (data?.pages?.[0]?.total ?? items.length)) + provisionalItems.length;

  const selectedItems: Item[] = useMemo(() => {
    if (selectedIds.size === 0) return [];
    return displayedItems.filter((item) => selectedIds.has(item.id));
  }, [displayedItems, selectedIds]);

  // Zotero 7 Quick Copy Shortcuts (Ctrl+Shift+C: Bibliography, Ctrl+Shift+A: In-text Citation)
  useQuickCopyShortcuts({
    scopeId,
    items: displayedItems,
    selectedIds,
    activeItemId: useLibraryUIStore.getState().activeItemId,
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

  const handleBatchMove = (targetColId: string | null) => {
    const processingIds = new Set(
      selectedItems
        .filter((item: any) => item._isProcessing || item.id.startsWith('temp-') || item.id.startsWith('provisional-'))
        .map((item) => item.id),
    );
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
    const processingIds = new Set(
      selectedItems
        .filter((item: any) => item._isProcessing || item.id.startsWith('temp-') || item.id.startsWith('provisional-'))
        .map((item) => item.id),
    );
    const deletableIds = Array.from(selectedIds).filter((id) => !processingIds.has(id));
    if (processingIds.size > 0) {
      toast.warning('Cannot delete files that are currently uploading or processing', {
        id: 'library-item-guard',
      });
    }
    if (deletableIds.length === 0) return;
    if (isTrash) {
      if (
        window.confirm(
          `Are you sure you want to permanently delete ${deletableIds.length} item(s)? This action cannot be undone.`,
        )
      ) {
        purgeMutation.mutate(deletableIds);
        clearSelection();
      }
      return;
    }
    openModal('DELETE_ITEMS', { itemIds: deletableIds });
  };

  const handleDetachItem = useCallback(
    (itemId: string) => {
      if (!collectionId) return;
      const targetItem = displayedItems.find((it) => it.id === itemId);
      if ((targetItem as any)?._isProcessing) {
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
    const processingIds = new Set(
      selectedItems
        .filter((item: any) => item._isProcessing || item.id.startsWith('temp-') || item.id.startsWith('provisional-'))
        .map((item) => item.id),
    );
    const detachableIds = Array.from(selectedIds).filter((id) => !processingIds.has(id));
    if (processingIds.size > 0) {
      toast.warning('Cannot remove files that are currently uploading or processing', {
        id: 'library-item-guard',
      });
    }
    if (!collectionId || detachableIds.length === 0) return;
    batchDetachMutation.mutate({ collectionId, itemIds: detachableIds });
    clearSelection();
  }, [collectionId, selectedIds, selectedItems, batchDetachMutation, clearSelection]);

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

  const handleSortChange = (columnKey: string, direction: 'asc' | 'desc') => {
    setDisplayOptions((prev) => ({
      ...prev,
      orderBy: columnKey as any,
      orderDirection: direction,
    }));
  };

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
    const activeCollection = collectionId ? (collections as any[]).find((c) => c.id === collectionId) : undefined;
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
          <UploadCloud className="size-10 text-primary animate-bounce mb-2" strokeWidth={1.5} />
          <p className="text-14 font-semibold text-foreground">Drop files to upload</p>
          <p className="text-12 text-muted-foreground">PDF, BibTeX, RIS will be uploaded directly</p>
        </div>
      )}

      <ItemTable
        items={displayedItems}
        totalCount={totalCount}
        hasNextPage={Boolean(isSavedSearchView ? false : hasNextPage)}
        isLoadingMore={isSavedSearchView ? false : isFetchingNextPage}
        onLoadMore={isSavedSearchView ? undefined : () => fetchNextPage()}
        onSortChange={handleSortChange}
        scopeId={scopeId}
        collectionId={collectionId}
        onDetachItem={canEdit && !isTrash && collectionId ? handleDetachItem : undefined}
        isTrash={isTrash}
      />

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
