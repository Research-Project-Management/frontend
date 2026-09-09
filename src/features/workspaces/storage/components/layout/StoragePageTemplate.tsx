'use client';

import React, { useMemo } from 'react';
import { StorageViewContainer } from './StorageViewContainer';
import type { StorageItem } from '@/features/workspaces/storage/types/storage.types';
import { downloadFileUrl } from '@/shared/utils/file';
import { BulkActionBar } from '../actions/BulkActionBar';
import Topbar from './Topbar';
import type { FileQueryParams } from '@/features/workspaces/storage/services/file.service';
import type { LucideIcon } from 'lucide-react';
import { useStorageQueryParams } from '../../hooks/use-storage-query-params';

export interface StoragePageTemplateProps {
  title: string;
  icon: LucideIcon;
  useFilesHook: (workspaceId: string, params: FileQueryParams) => {
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
    workspaceId,
    isWorkspaceLoading,
    searchQuery,
    setSearchQuery,
    setSelectedItem,
    queryParams,
  } = useStorageQueryParams();

  const { data, isLoading: isFilesLoading, hasNextPage, isFetchingNextPage, fetchNextPage } = useFilesHook(
    workspaceId,
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

  const handleFolderClick = (_folder: StorageItem) => {
    // Navigate inside folder if needed
  };

  const files = useMemo(
    () => (data?.pages.flatMap((page) => page.files || []) || []) as StorageItem[],
    [data?.pages],
  );

  const viewProps = {
    items: files,
    hasMore: hasNextPage,
    isFetchingNextPage,
    onLoadMore: fetchNextPage,
    onFolderClick: handleFolderClick,
    onToggleStar: onToggleStar ? (id: string) => { void onToggleStar(id); } : undefined,
    onDelete: (id: string) => { if (onDelete) void onDelete(id); },
    onRestore: onRestore ? (id: string) => { void onRestore(id); } : undefined,
    onDownload: handleDownload,
    onFileClick: (item: StorageItem) => setSelectedItem(item),
    isTrash,
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden relative">
      <Topbar
        title={title}
        icon={Icon}
        workspaceId={workspaceId}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />
      <StorageViewContainer
        isLoading={isWorkspaceLoading || (isFilesLoading && !data)}
        workspaceId={workspaceId}
        viewProps={viewProps}
      />
      <BulkActionBar items={files} isTrash={isTrash} />
    </div>
  );
}
