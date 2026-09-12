'use client';

import { useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useHomeFiles, useToggleStarItem, useDeleteItem } from '@/features/workspaces/storage/hooks/use-storage';
import { StorageViewContainer } from '../components/layout/StorageViewContainer';
import type { StorageItem } from '@/features/workspaces/storage/types/storage.types';
import { downloadFileUrl } from "@/shared/lib/file-client";
import { BulkActionBar } from '../components/actions/BulkActionBar';
import Topbar from '../components/layout/Topbar';
import StorageDropzoneOverlay from '../components/dropzone/StorageDropzoneOverlay';
import { Home } from 'lucide-react';
import { useTopbar } from '../hooks/use-topbar';
import { useStorageQueryParams } from '../hooks/use-storage-query-params';

export default function WorkspaceHomePage() {
  const router = useRouter();
  const {
    workspaceUrl,
    workspace,
    workspaceId,
    isWorkspaceLoading,
    searchQuery,
    setSearchQuery,
    setSelectedItem,
    queryParams,
  } = useStorageQueryParams();
  
  const { handleUploadFiles } = useTopbar({ workspaceId, searchQuery, onSearchChange: setSearchQuery });

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

  const basePath = workspaceUrl ? `/${workspaceUrl}/storage` : `/storage`;

  const handleOpenLocation = useCallback((item: StorageItem) => {
    if (item.parentId) {
      router.push(`${basePath}/my-files/${item.parentId}?highlight=${item.id}`);
    } else {
      router.push(`${basePath}/my-files?highlight=${item.id}`);
    }
  }, [router, basePath]);

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
    onFolderClick: (folder: StorageItem) => router.push(`${basePath}/my-files/${folder.id}`),
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
        <StorageViewContainer
          isLoading={isWorkspaceLoading || (isFilesLoading && !data)}
          workspaceId={workspaceId}
          viewProps={viewProps}
        />
      </StorageDropzoneOverlay>
      <BulkActionBar items={files} />
    </div>
  );
}
