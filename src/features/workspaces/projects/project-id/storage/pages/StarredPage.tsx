'use client';

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";

import { useProject } from '@/features/workspaces/projects/shell/hooks/use-project';
import { useStarredFiles, useToggleStarItem, useDeleteItem } from '@/features/workspaces/projects/project-id/storage/hooks/use-storage';

import { Star } from "lucide-react";
import { Skeleton } from '@/shared/components/ui';
import ListView from '@/features/workspaces/projects/project-id/storage/components/views/ListView';
import GridView from '@/features/workspaces/projects/project-id/storage/components/views/GridView';
import { useViewStore } from '@/features/workspaces/projects/project-id/storage/store/use-view-store';
import { usePreviewStore } from '@/features/workspaces/projects/project-id/storage/store/use-preview-store';
import { useStorageFilterStore } from '@/features/workspaces/projects/project-id/storage/store/use-filter-store';
import type { StorageItem } from '@/features/workspaces/projects/project-id/storage/types/storage.types';
import { filterStarredFiles } from '../utils/starred.util';
import { applyStorageFilters } from '../utils/filter.util';
import { downloadFileUrl } from '@/shared/utils/file';
import { BulkActionBar } from '../components/actions/BulkActionBar';
import Topbar from '../components/layout/Topbar';

import { useDebounce } from '@/shared/hooks/use-debounce';
import type { FileQueryParams } from '@/features/workspaces/projects/project-id/storage/services/file.service';

export default function StarredPage() {
  const setSelectedItem = usePreviewStore(s => s.setSelectedItem);
  const { projectId } = useParams() as { projectId: string };
  const { view } = useViewStore();
  const { typeFilter, selectedTypes, sortBy } = useStorageFilterStore();
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const { data: projectData, isLoading: isProjectLoading } = useProject(projectId!);

  const queryParams: FileQueryParams = useMemo(() => ({
    search: debouncedSearch || undefined,
    sortBy,
    types: selectedTypes.length > 0 ? selectedTypes : (typeFilter !== 'all' ? typeFilter : undefined),
  }), [debouncedSearch, sortBy, selectedTypes, typeFilter]);

  const {
    data,
    isLoading: isFilesLoading,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useStarredFiles(projectId!, queryParams);
  const { mutateAsync: handleToggleStar } = useToggleStarItem();
  const { mutateAsync: handleDelete } = useDeleteItem();

  const handleDownload = async (item: StorageItem) => {
    if (!item.url) return;
    try {
      await downloadFileUrl(item.url, item.filename);
    } catch {
      window.open(item.url, "_blank");
    }
  };

  const handleFolderClick = (folder: StorageItem) => {
    // Navigate inside starred folder if needed
  };

  const files = useMemo(
    () => (data?.pages.flatMap((page) => page.files || []) || []) as StorageItem[],
    [data?.pages],
  );

  return (
    <div className="flex h-full w-full flex-col overflow-hidden relative">
      <Topbar
        title="Starred"
        icon={Star}
        projectId={projectId}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />
      <div className="flex-1 overflow-auto p-4 sm:p-6 bg-background">
        {isProjectLoading || (isFilesLoading && !data) ? (
          <Skeleton className="h-48 w-full rounded-lg" />
        ) : !projectId ? (
          <div className="p-6 text-muted-foreground">Project not found</div>
        ) : view === 'list' ? (
          <ListView
            items={files}
            hasMore={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            onLoadMore={fetchNextPage}
            onFolderClick={handleFolderClick}
            onToggleStar={(id) => { void handleToggleStar(id); }}
            onDelete={(id) => { void handleDelete(id); }}
            onDownload={handleDownload}
            onFileClick={(item) => setSelectedItem(item)}
          />
        ) : (
          <GridView
            items={files}
            hasMore={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            onLoadMore={fetchNextPage}
            onFolderClick={handleFolderClick}
            onToggleStar={(id) => { void handleToggleStar(id); }}
            onDelete={(id) => { void handleDelete(id); }}
            onDownload={handleDownload}
            onFileClick={(item) => setSelectedItem(item)}
          />
        )}
      </div>
      <BulkActionBar items={files} />
    </div>
  );
}
