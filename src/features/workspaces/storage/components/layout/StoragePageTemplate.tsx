'use client';

import React, { useMemo } from 'react';
import { StorageViewContainer } from './StorageViewContainer';
import type { StorageItem } from '@/features/workspaces/storage/types/storage.types';
import { downloadFileUrl } from "@/shared/lib/file-client";
import { BulkActionBar } from '../actions/BulkActionBar';
import Topbar from './Topbar';
import type { FileQueryParams } from '@/features/workspaces/storage/services/file.service';
import type { LucideIcon } from 'lucide-react';
import { useStorageQueryParams } from '../../hooks/use-storage-query-params';

export interface StoragePageTemplateProps {
  title: string;
  icon: LucideIcon;
  useFilesHook: (scopeId: string | undefined, params?: FileQueryParams) => {
    data?: { pages: Array<{ files?: StorageItem[] }> };
    isLoading: boolean;
    hasNextPage?: boolean;
    isFetchingNextPage?: boolean;
    fetchNextPage: () => void;
  };
  onToggleStar?: (id: string) => Promise<unknown> | void;
  onDelete?: (id: string) => Promise<unknown> | void;
  onRestore?: (id: string) => Promise<unknown> | void;
  isTrash?: boolean;
}

export function StoragePageTemplate({
  title,
  icon: Icon,
  useFilesHook,
  onToggleStar,
  onDelete,
  onRestore,
  isTrash = false,
}: StoragePageTemplateProps) {
  const {
    projectId,
    searchQuery,
    setSearchQuery,
    setSelectedItem,
    queryParams,
  } = useStorageQueryParams();

  const { data, isLoading: isFilesLoading, hasNextPage, isFetchingNextPage, fetchNextPage } = useFilesHook(
    projectId,
    queryParams,
  );

  const handleDownload = async (item: StorageItem) => {
    if (!item.url) return;
    try {
      await downloadFileUrl(item.url, item.filename);
    } catch {
      window.open(item.url, '_blank');
    }
  };

  const files = useMemo(
    () => (data?.pages.flatMap((page) => page.files || []) || []) as StorageItem[],
    [data?.pages],
  );

  const viewProps = {
    items: files,
    isReadOnly: isTrash,
    hasMore: hasNextPage,
    isFetchingNextPage,
    onLoadMore: fetchNextPage,
    onToggleStar: onToggleStar ? async (fileId: string) => { await onToggleStar(fileId); } : undefined,
    onDelete: onDelete ? async (fileId: string) => { await onDelete(fileId); } : async () => {},
    onRestore: onRestore ? async (fileId: string) => { await onRestore(fileId); } : undefined,
    onDownload: handleDownload,
    onFileClick: (item: StorageItem) => setSelectedItem(item),
    isTrash,
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden relative">
      <Topbar
        title={title}
        icon={Icon}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />
      <StorageViewContainer
        isLoading={isFilesLoading && !data}
        viewProps={viewProps}
      />
      <BulkActionBar items={files} isTrash={isTrash} />
    </div>
  );
}
