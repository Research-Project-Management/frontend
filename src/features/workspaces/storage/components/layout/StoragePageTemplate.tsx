'use client';

import React, { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useWorkspace } from '@/features/workspaces/shell/hooks/use-workspace';
import { Skeleton } from '@/shared/components/ui/skeleton';
import ListView from '../views/ListView';
import GridView from '../views/GridView';
import { useViewStore } from '../../store/use-view-store';
import { usePreviewStore } from '../../store/use-preview-store';
import { useStorageFilterStore } from '../../store/use-filter-store';
import type { StorageItem } from '@/features/workspaces/storage/types/storage.types';
import { downloadFileUrl } from '@/shared/utils/file';
import { BulkActionBar } from '../actions/BulkActionBar';
import Topbar from './Topbar';
import { useDebounce } from '@/shared/hooks/use-debounce';
import type { FileQueryParams } from '@/features/workspaces/storage/services/file.service';
import type { LucideIcon } from 'lucide-react';

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
  const { workspaceId: workspaceUrl } = useParams() as { workspaceId: string };
  const { view } = useViewStore();
  const { typeFilter, selectedTypes, projectFilter, selectedProjects, sortBy } = useStorageFilterStore();
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const setSelectedItem = usePreviewStore((s) => s.setSelectedItem);
  const { workspace, isLoading: isWorkspaceLoading } = useWorkspace(workspaceUrl!);
  const workspaceId = workspace?.id || workspaceUrl;

  const queryParams: FileQueryParams = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      sortBy,
      types: selectedTypes.length > 0 ? selectedTypes : (typeFilter !== 'all' ? typeFilter : undefined),
      projectIds: selectedProjects.length > 0 ? selectedProjects : (projectFilter !== 'all' ? projectFilter : undefined),
    }),
    [debouncedSearch, sortBy, selectedTypes, typeFilter, selectedProjects, projectFilter],
  );

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

  return (
    <div className="flex h-full w-full flex-col overflow-hidden relative">
      <Topbar
        title={title}
        icon={Icon}
        workspaceId={workspaceId}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />
      <div className="flex-1 overflow-auto p-4 sm:p-6 bg-background">
        {isWorkspaceLoading || (isFilesLoading && !data) ? (
          <Skeleton className="h-48 w-full rounded-lg" />
        ) : !workspaceId ? (
          <div className="p-6 text-muted-foreground">Workspace not found</div>
        ) : view === 'list' ? (
          <ListView
            items={files}
            hasMore={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            onLoadMore={fetchNextPage}
            onFolderClick={handleFolderClick}
            onToggleStar={onToggleStar ? (id) => { void onToggleStar(id); } : undefined}
            onDelete={onDelete ? (id) => { void onDelete(id); } : undefined}
            onRestore={onRestore ? (id) => { void onRestore(id); } : undefined}
            onDownload={handleDownload}
            onFileClick={(item) => setSelectedItem(item)}
            isTrash={isTrash}
          />
        ) : (
          <GridView
            items={files}
            hasMore={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            onLoadMore={fetchNextPage}
            onFolderClick={handleFolderClick}
            onToggleStar={onToggleStar ? (id) => { void onToggleStar(id); } : undefined}
            onDelete={onDelete ? (id) => { void onDelete(id); } : undefined}
            onRestore={onRestore ? (id) => { void onRestore(id); } : undefined}
            onDownload={handleDownload}
            onFileClick={(item) => setSelectedItem(item)}
            isTrash={isTrash}
          />
        )}
      </div>
      <BulkActionBar items={files} isTrash={isTrash} />
    </div>
  );
}
