'use client';

import { useState, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useWorkspace } from '@/features/workspaces/shell/hooks/use-workspace';
import { useHomeFiles, useToggleStarItem, useDeleteItem } from '@/features/workspaces/storage/hooks/use-storage';
import { usePreviewStore } from '../store/use-preview-store';
import { useViewStore } from '../store/use-view-store';
import { useStorageFilterStore } from '../store/use-filter-store';
import { Skeleton } from '@/shared/components/ui/skeleton';
import ListView from '../components/views/ListView';
import GridView from '../components/views/GridView';
import type { StorageItem } from '@/features/workspaces/storage/types/storage.types';
import { downloadFileUrl } from '@/shared/utils/file';
import { BulkActionBar } from '../components/actions/BulkActionBar';
import Topbar from '../components/layout/Topbar';
import StorageDropzoneOverlay from '../components/dropzone/StorageDropzoneOverlay';
import { Home } from 'lucide-react';
import { useTopbar } from '../hooks/use-topbar';

import { useDebounce } from '@/shared/hooks/use-debounce';
import type { FileQueryParams } from '@/features/workspaces/storage/services/file.service';

export default function WorkspaceHomePage() {
  const router = useRouter();
  const { workspaceId: workspaceUrl } = useParams() as { workspaceId: string };
  const { view } = useViewStore();
  const { typeFilter, selectedTypes, projectFilter, selectedProjects, sortBy } = useStorageFilterStore();
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const setSelectedItem = usePreviewStore((s) => s.setSelectedItem);
  
  const { workspace, isLoading: isWorkspaceLoading } = useWorkspace(workspaceUrl!);
  const workspaceId = workspace?.id || workspaceUrl;
  const { handleUploadFiles } = useTopbar({ workspaceId, searchQuery, onSearchChange: setSearchQuery });

  const queryParams: FileQueryParams = useMemo(() => ({
    search: debouncedSearch || undefined,
    sortBy,
    types: selectedTypes.length > 0 ? selectedTypes : (typeFilter !== 'all' ? typeFilter : undefined),
    projectIds: selectedProjects.length > 0 ? selectedProjects : (projectFilter !== 'all' ? projectFilter : undefined),
  }), [debouncedSearch, sortBy, selectedTypes, typeFilter, selectedProjects, projectFilter]);

  // Home view fetches filtered & sorted items directly from backend
  const {
    data,
    isLoading: isFilesLoading,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useHomeFiles(workspaceId, null, queryParams);
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

  const handleOpenLocation = useCallback((item: StorageItem) => {
    if (item.parentId) {
      router.push(`/${workspaceUrl}/storage/my-files/${item.parentId}?highlight=${item.id}`);
    } else {
      router.push(`/${workspaceUrl}/storage/my-files?highlight=${item.id}`);
    }
  }, [router, workspaceUrl]);

  const files = useMemo(
    () => (data?.pages.flatMap((page) => page.files || []) || []) as StorageItem[],
    [data?.pages],
  );

  const viewProps = {
    items: files,
    isReadOnly: false,
    hasMore: hasNextPage,
    isFetchingNextPage,
    onLoadMore: fetchNextPage,
    onToggleStar: (id: string) => { void handleToggleStar(id); },
    onDelete: (id: string) => { void handleDelete(id); },
    onDownload: handleDownload,
    onOpenLocation: handleOpenLocation,
    onFileClick: (item: StorageItem) => setSelectedItem(item),
    onFolderClick: (folder: StorageItem) => router.push(`/${workspaceUrl}/storage/my-files/${folder.id}`),
  };

  const handleFilesDrop = useCallback((droppedFiles: File[]) => {
    handleUploadFiles(droppedFiles, null);
  }, [handleUploadFiles]);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden relative">
      <Topbar
        title="Home"
        icon={Home}
        workspaceId={workspaceId}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />
      <StorageDropzoneOverlay
        onFilesDrop={handleFilesDrop}
        folderName={workspace?.name || "All workspace files"}
      >
        <div className="flex-1 overflow-auto p-4 sm:p-6 bg-background">
          {isWorkspaceLoading || (isFilesLoading && !data) ? (
            <div className="space-y-4">
              <Skeleton className="h-9 w-full rounded-lg" />
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full rounded" />
                ))}
              </div>
            </div>
          ) : !workspaceId ? (
            <div className="p-6 text-muted-foreground">Workspace not found</div>
          ) : view === 'list' ? (
            <ListView {...viewProps} />
          ) : (
            <GridView {...viewProps} />
          )}
        </div>
      </StorageDropzoneOverlay>
      <BulkActionBar items={files} />
    </div>
  );
}
