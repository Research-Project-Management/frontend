'use client';

import { useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useHomeFiles, useToggleStarItem, useDeleteItem } from '@/features/storage/hooks/use-storage';
import { StorageViewContainer } from '../components/layout/StorageViewContainer';
import type { StorageItem } from '@/features/storage/types/storage.types';
import { downloadFileUrl } from "@/shared/lib/file-client";
import { BulkActionBar } from '../components/actions/BulkActionBar';
import Topbar from '../components/layout/Topbar';
import StorageDropzoneOverlay from '../components/dropzone/StorageDropzoneOverlay';
import { Home } from 'lucide-react';
import { useTopbar } from '../hooks/use-topbar';
import { useStorageQueryParams } from '../hooks/use-storage-query-params';

export default function HomePage() {
  const router = useRouter();
  const {
    projectId,
    searchQuery,
    setSearchQuery,
    setSelectedItem,
    queryParams,
  } = useStorageQueryParams();
  
  const { handleUploadFiles } = useTopbar({ projectId, searchQuery, onSearchChange: setSearchQuery });

  // Home view fetches filtered & sorted items directly from backend
  const {
    data,
    isLoading: isFilesLoading,
    isError,
    error,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useHomeFiles(projectId, null, queryParams);
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

  const basePath = `/storage`;

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
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />
      <StorageDropzoneOverlay
        onFilesDrop={handleFilesDrop}
        folderName="All files"
      >
        <StorageViewContainer
          isLoading={isFilesLoading && !data}
          isError={isError}
          error={error instanceof Error ? error : undefined}
          viewProps={viewProps}
          searchQuery={searchQuery}
          onClearSearch={() => setSearchQuery('')}
        />
      </StorageDropzoneOverlay>
      <BulkActionBar items={files} />
    </div>
  );
}
