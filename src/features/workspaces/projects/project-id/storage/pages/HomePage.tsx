'use client';

import { useState, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useProject } from '@/features/workspaces/projects/shell/hooks/use-project';
import { useHomeFiles, useToggleStarItem, useDeleteItem } from '@/features/workspaces/projects/project-id/storage/hooks/use-storage';
import { usePreviewStore } from '@/features/workspaces/projects/project-id/storage/store/use-preview-store';
import { useViewStore } from '@/features/workspaces/projects/project-id/storage/store/use-view-store';
import { useStorageFilterStore } from '@/features/workspaces/projects/project-id/storage/store/use-filter-store';
import { Skeleton } from '@/shared/components/ui/skeleton';
import ListView from '@/features/workspaces/projects/project-id/storage/components/views/ListView';
import GridView from '@/features/workspaces/projects/project-id/storage/components/views/GridView';
import type { StorageItem } from '@/features/workspaces/projects/project-id/storage/types/storage.types';
import { downloadFileUrl } from '@/shared/utils/file';
import { BulkActionBar } from '../components/actions/BulkActionBar';
import Topbar from '../components/layout/Topbar';
import StorageDropzoneOverlay from '../components/dropzone/StorageDropzoneOverlay';
import { Home } from 'lucide-react';
import { useTopbar } from '../hooks/use-topbar';

import { useDebounce } from '@/shared/hooks/use-debounce';
import type { FileQueryParams } from '@/features/workspaces/projects/project-id/storage/services/file.service';

export default function HomePage() {
  const router = useRouter();
  const { workspaceId: workspaceUrl, projectId } = useParams() as { workspaceId: string; projectId: string };
  const { view } = useViewStore();
  const { typeFilter, selectedTypes, sortBy } = useStorageFilterStore();
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const setSelectedItem = usePreviewStore((s) => s.setSelectedItem);

  const { state: projectState, isLoading: isProjectLoading } = useProject(projectId!);
  const { handleUploadFiles } = useTopbar({ projectId, searchQuery, onSearchChange: setSearchQuery });
  
  const queryParams: FileQueryParams = useMemo(() => ({
    search: debouncedSearch || undefined,
    sortBy,
    types: selectedTypes.length > 0 ? selectedTypes : (typeFilter !== 'all' ? typeFilter : undefined),
  }), [debouncedSearch, sortBy, selectedTypes, typeFilter]);

  // Home view fetches filtered & sorted items directly from backend
  const {
    data,
    isLoading: isFilesLoading,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useHomeFiles(projectId!, null, queryParams);
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
    const params = new URLSearchParams();
    if (item.parentId) {
      params.set('folder', item.parentId);
    }
    params.set('highlight', item.id);
    router.push(`/${workspaceUrl}/projects/${projectId}/storage/my-files?${params.toString()}`);
  }, [router, workspaceUrl, projectId]);

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
    onFolderClick: (folder: StorageItem) => router.push(`/${workspaceUrl}/projects/${projectId}/storage/my-files?folder=${folder.id}`),
  };

  const handleFilesDrop = useCallback((droppedFiles: File[]) => {
    handleUploadFiles(droppedFiles, null);
  }, [handleUploadFiles]);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden relative">
      <Topbar
        title="Home"
        icon={Home}
        projectId={projectId}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />
      <StorageDropzoneOverlay
        onFilesDrop={handleFilesDrop}
        folderName={projectState?.project?.name || "All files"}
      >
        <div className="flex-1 overflow-auto p-4 sm:p-6 bg-background">
          {isProjectLoading || (isFilesLoading && !data) ? (
            <div className="space-y-4">
              <Skeleton className="h-9 w-full rounded-lg" />
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full rounded" />
                ))}
              </div>
            </div>
          ) : !projectId ? (
            <div className="p-6 text-muted-foreground">Project not found</div>
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
