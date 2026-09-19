'use client';

import React from 'react';
import { useSearchParams } from 'next/navigation';
import { useLibraryItemsQuery } from '../../data/items.queries';
import { ContentSkeleton } from './ContentSkeleton';
import { ItemTable } from './ItemTable';
import LibraryEmptyState from '../../components/LibraryEmptyState';
import { useLibraryModalStore } from '../../store/library-modal.store';

interface LibraryContentProps {
  scopeId?: string;
  collectionId?: string;
  view?: string;
}

export function LibraryContent({
  scopeId,
  collectionId,
  view,
}: LibraryContentProps) {
  const searchParams = useSearchParams();
  const search = searchParams.get('q') || undefined;

  const openModal = useLibraryModalStore((s) => s.openModal);

  const { data, isLoading, isError } = useLibraryItemsQuery(scopeId, {
    collectionId,
    view: (view as any) || undefined,
    search,
  });

  if (isLoading) {
    return <ContentSkeleton rowCount={10} />;
  }

  if (isError) {
    return (
      <div className="flex h-full w-full items-center justify-center p-6 text-xs text-destructive">
        Không thể tải danh sách tài liệu. Vui lòng thử lại sau.
      </div>
    );
  }

  const items = data?.items || [];

  if (items.length === 0) {
    return (
      <LibraryEmptyState
        canEdit={true}
        onDirectFilesUpload={() => openModal('IMPORT_PAPER')}
      />
    );
  }

  return <ItemTable items={items} />;
}

export default LibraryContent;
