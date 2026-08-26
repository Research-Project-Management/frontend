'use client';

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";

import { useWorkspace } from '@/features/workspaces/shell/hooks/use-workspace';
import { useStarredFiles, useToggleStarItem, useDeleteItem } from '@/features/workspaces/storage/hooks/use-storage';
import { Star } from "lucide-react";
import { Skeleton } from '@/shared/components/ui';
import ListView from '../components/views/ListView';
import GridView from '../components/views/GridView';
import { useViewStore } from '../store/use-view-store';
import { usePreviewStore } from '../store/use-preview-store';
import { useStorageFilterStore } from '../store/use-filter-store';
import type { StorageItem } from '@/features/workspaces/storage/types/storage.types';
import { filterStarredFiles } from '../utils/starred.util';
import { applyStorageFilters } from '../utils/filter.util';
import { downloadFileUrl } from '@/shared/utils/file';
import { BulkActionBar } from '../components/actions/BulkActionBar';
import Topbar from '../components/layout/Topbar';

import { useDebounce } from '@/shared/hooks/use-debounce';
import type { FileQueryParams } from '@/features/workspaces/storage/services/file.service';

export default function WorkspaceStarredPage() {
  const { workspaceId: workspaceUrl } = useParams() as { workspaceId: string };
  const { view } = useViewStore();
  const { typeFilter, selectedTypes, projectFilter, selectedProjects, sortBy } = useStorageFilterStore();
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const setSelectedItem = usePreviewStore(s => s.setSelectedItem);
  const { workspace, isLoading: isWorkspaceLoading } = useWorkspace(
    workspaceUrl!,
  );
  const workspaceId = workspace?.id || workspaceUrl;

  const queryParams: FileQueryParams = useMemo(() => ({
    search: debouncedSearch || undefined,
    sortBy,
    types: selectedTypes.length > 0 ? selectedTypes : (typeFilter !== 'all' ? typeFilter : undefined),
    projectIds: selectedProjects.length > 0 ? selectedProjects : (projectFilter !== 'all' ? projectFilter : undefined),
  }), [debouncedSearch, sortBy, selectedTypes, typeFilter, selectedProjects, projectFilter]);

  const { data, isLoading: isFilesLoading } = useStarredFiles(workspaceId, queryParams);
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
    () => (data?.files || []) as StorageItem[],
    [data?.files],
  );

  return (
    <div className="flex h-full w-full flex-col overflow-hidden relative">
      <Topbar
        title="Starred"
        icon={Star}
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
            onFolderClick={handleFolderClick}
            onToggleStar={(id) => { void handleToggleStar(id); }}
            onDelete={(id) => { void handleDelete(id); }}
            onDownload={handleDownload}
            onFileClick={(item) => setSelectedItem(item)}
          />
        ) : (
          <GridView
            items={files}
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

