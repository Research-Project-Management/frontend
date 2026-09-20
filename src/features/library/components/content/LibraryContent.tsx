'use client';

import React from 'react';
import { useSearchParams } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { useLibraryItemsQuery } from '../../data';
import { ContentSkeleton } from './ContentSkeleton';
import { ItemTable } from './ItemTable';
import LibraryEmptyState from './LibraryEmptyState';
import { useLibraryModalStore } from '../../store';

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

  const items = Array.isArray(data) ? data : ((data as any)?.items || []);

  if (items.length === 0) {
    if (view === 'trash') {
      return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-8 text-center text-muted-foreground">
          <Trash2 className="h-10 w-10 stroke-[1.25] text-muted-foreground/40" />
          <p className="text-sm font-medium">Thùng rác trống</p>
          <p className="text-xs text-muted-foreground/70">Các tài liệu bị xóa sẽ xuất hiện tại đây</p>
        </div>
      );
    }
    return (
      <LibraryEmptyState
        canEdit={true}
        onDirectFilesUpload={() => openModal('IMPORT_PAPER')}
      />
    );
  }

  return <ItemTable items={items} scopeId={scopeId} isTrash={view === 'trash'} />;
}

export default LibraryContent;
