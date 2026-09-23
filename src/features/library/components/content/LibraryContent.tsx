'use client';

import React, { useMemo, useCallback } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import {
  useInfiniteLibraryItemsQuery,
  useCollectionsQuery,
  useBatchRestoreItemsMutation,
  useLibraryItemsData,
} from '../../data';
import { ContentSkeleton } from './ContentSkeleton';
import { ItemTable } from './ItemTable';
import LibraryEmptyState from './LibraryEmptyState';
import { BatchBar } from './BatchBar';
import { useLibraryModalStore, useLibraryViewStore, useLibraryUIStore } from '../../store';
import type { Item, Collection } from '../../types';

interface LibraryContentProps {
  scopeId?: string;
  collectionId?: string;
  view?: string;
  canEdit?: boolean;
  onDirectFilesUpload?: (files: File[]) => void;
  onAddLink?: () => void;
}

export function LibraryContent({
  scopeId,
  collectionId,
  view,
  canEdit = true,
  onDirectFilesUpload,
  onAddLink,
}: LibraryContentProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
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
    isLoading,
    isError,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteLibraryItemsQuery(scopeId, queryParams);

  const { data: collections = [] } = useCollectionsQuery(scopeId);
  const { batchMoveItems } = useLibraryItemsData({ scopeId, collectionId });
  const restoreMutation = useBatchRestoreItemsMutation(scopeId);

  const items: Item[] = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((page) => page.items);
  }, [data?.pages]);

  const totalCount = data?.pages?.[0]?.total ?? items.length;

  const selectedItems: Item[] = useMemo(() => {
    if (selectedIds.size === 0) return [];
    return items.filter((item) => selectedIds.has(item.id));
  }, [items, selectedIds]);

  if (isLoading) {
    return <ContentSkeleton rowCount={10} />;
  }

  if (isError) {
    return (
      <div className="flex h-full w-full items-center justify-center p-6 text-xs text-destructive">
        Failed to load items. Please try again.
      </div>
    );
  }

  if (items.length === 0) {
    const activeCollection = collectionId ? (collections as any[]).find((c) => c.id === collectionId) : undefined;
    return (
      <LibraryEmptyState
        canEdit={canEdit}
        search={search}
        activeFilter={view || searchParams.get('filter')}
        collectionId={collectionId}
        collectionName={activeCollection?.name}
        onClearSearch={handleClearSearch}
        onDirectFilesUpload={onDirectFilesUpload}
        onAddLink={onAddLink || (() => openModal('ADD_LINK', { collectionId }))}
      />
    );
  }

  const isTrash = view === 'trash';

  const handleBatchMove = (targetColId: string | null) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    batchMoveItems(ids, targetColId);
    clearSelection();
  };

  const handleBatchDelete = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    openModal('DELETE_ITEMS', { itemIds: ids });
  };

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

  return (
    <div className="h-full w-full relative flex flex-col overflow-hidden">
      <ItemTable
        items={items}
        totalCount={totalCount}
        hasNextPage={Boolean(hasNextPage)}
        isLoadingMore={isFetchingNextPage}
        onLoadMore={() => fetchNextPage()}
        onSortChange={handleSortChange}
        scopeId={scopeId}
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
        onBatchMerge={canEdit && view === 'duplicates' && selectedItems.length >= 2 ? handleBatchMerge : undefined}
        isTrash={isTrash}
        scopeId={scopeId}
      />
    </div>
  );
}

export default LibraryContent;
