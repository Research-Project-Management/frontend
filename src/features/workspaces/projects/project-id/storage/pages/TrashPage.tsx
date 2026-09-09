'use client';

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";

import { useProject } from '@/features/workspaces/projects/shell/hooks/use-project';
import { useTrash, useRestoreItem, usePermanentlyDeleteItem } from '@/features/workspaces/projects/project-id/storage/hooks/use-storage';

import { Trash2 } from "lucide-react";
import { Skeleton } from '@/shared/components/ui/skeleton';
import ListView from '../components/views/ListView';
import GridView from '../components/views/GridView';
import { useViewStore } from '../store/use-view-store';
import { usePreviewStore } from '../store/use-preview-store';
import { useStorageFilterStore } from '../store/use-filter-store';
import type { StorageItem } from '@/features/workspaces/projects/project-id/storage/types/storage.types';
import { filterTrashFiles } from '../utils/trash.util';
import { applyStorageFilters } from '../utils/filter.util';
import { downloadFileUrl } from '@/shared/utils/file';
import { BulkActionBar } from '../components/actions/BulkActionBar';
import Topbar from '../components/layout/Topbar';

import { useDebounce } from '@/shared/hooks/use-debounce';
import type { FileQueryParams } from '@/features/workspaces/projects/project-id/storage/services/file.service';

export default function ProjectTrashPage() {
  const { projectId } = useParams() as { projectId: string };
  const { view } = useViewStore();
  const { typeFilter, selectedTypes, sortBy } = useStorageFilterStore();
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const setSelectedItem = usePreviewStore(s => s.setSelectedItem);
  const { data: projectData, isLoading: isProjectLoading } = useProject(
    projectId!,
  );

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
  } = useTrash(projectId!, queryParams);
  const { mutateAsync: handleRestore } = useRestoreItem();
  const { mutateAsync: handlePermanentlyDelete } = usePermanentlyDeleteItem();

  const handleDownload = async (item: StorageItem) => {
    if (!item.url) return;
    try {
      await downloadFileUrl(item.url, item.filename);
    } catch {
      window.open(item.url, "_blank");
    }
  };

  const files = useMemo(
    () => (data?.pages.flatMap((page) => page.files || []) || []) as StorageItem[],
    [data?.pages],
  );

  return (
    <div className="flex h-full w-full flex-col overflow-hidden relative">
      <Topbar
        title="Trash"
        icon={Trash2}
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
            onToggleStar={(id: string) => { void handleRestore(id); }}
            onDelete={(id: string) => { void handlePermanentlyDelete(id); }}
            onDownload={handleDownload}
            onFileClick={(item) => setSelectedItem(item)}
            isTrash={true}
          />
        ) : (
          <GridView
            items={files}
            hasMore={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            onLoadMore={fetchNextPage}
            onToggleStar={(id: string) => { void handleRestore(id); }}
            onDelete={(id: string) => { void handlePermanentlyDelete(id); }}
            onDownload={handleDownload}
            onFileClick={(item) => setSelectedItem(item)}
            isTrash={true}
          />
        )}
      </div>
      <BulkActionBar items={files} isTrash={true} />
    </div>
  );
}
