'use client';

import { useState, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useWorkspace } from '@/features/workspaces/shell/hooks/use-workspace';
import { useHomeFiles, useToggleStarItem, useDeleteItem } from '@/features/workspaces/storage/hooks/use-storage';
import { usePreviewStore } from '../store/use-preview-store';
import { useStorageFilterStore } from '../store/use-filter-store';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { StorageViewRenderer } from '../components/views/StorageViewRenderer';
import type { StorageItem } from '@/features/workspaces/storage/types/storage.types';
import { downloadStorageItem } from '../utils/file';
import { filterHomeFiles } from '../utils/home.util';
import { applyStorageFilters } from '../utils/filter.util';
import { BulkActionBar } from '../components/layout/BulkActionBar';
import Topbar from '../components/layout/Topbar';
import { Home } from 'lucide-react';

export default function WorkspaceHomePage() {
  const router = useRouter();
  const { workspaceId: workspaceUrl } = useParams() as { workspaceId: string };
  const { typeFilter, projectFilter, sortBy } = useStorageFilterStore();
  const [searchQuery, setSearchQuery] = useState('');
  const setSelectedItem = usePreviewStore(s => s.setSelectedItem);
  
  const { workspace, isLoading: isWorkspaceLoading } = useWorkspace(workspaceUrl!);
  const workspaceId = workspace?.id || workspaceUrl;

  // Home view always fetches root items
  const { data, isLoading: isFilesLoading } = useHomeFiles(workspaceId);
  const { mutate: handleToggleStar } = useToggleStarItem();
  const { mutate: handleDelete } = useDeleteItem();

  const handleOpenLocation = useCallback((item: StorageItem) => {
    if (item.parentId) {
      router.push(`/${workspaceUrl}/storage/my-files/${item.parentId}?highlight=${item.id}`);
    } else {
      router.push(`/${workspaceUrl}/storage/my-files?highlight=${item.id}`);
    }
  }, [router, workspaceUrl]);

  const files = useMemo(
    () => applyStorageFilters(filterHomeFiles((data?.files || []) as StorageItem[]), { typeFilter, projectFilter, sortBy, searchQuery }),
    [data?.files, typeFilter, projectFilter, sortBy, searchQuery],
  );

  if (isWorkspaceLoading || isFilesLoading) {
    return (
      <div className="flex-1 p-6 space-y-4">
        <Skeleton className="h-9 w-full rounded-lg" />
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (!workspaceId) {
    return <div className="p-6">Workspace not found</div>;
  }

  const viewProps = {
    items: files,
    isReadOnly: false,
    onToggleStar: (id: string) => handleToggleStar(id),
    onDelete: (id: string) => handleDelete(id),
    onDownload: downloadStorageItem,
    onOpenLocation: handleOpenLocation,
    onFileClick: (item: StorageItem) => setSelectedItem(item),
    onFolderClick: (folder: StorageItem) => router.push(`/${workspaceUrl}/storage/my-files/${folder.id}`),
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden relative">
      <Topbar
        title="Home"
        icon={Home}
        workspaceId={workspaceId}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />
      <div className="flex-1 overflow-auto p-4 sm:p-6 bg-background">
        <StorageViewRenderer {...viewProps} />
      </div>
      <BulkActionBar items={files} />
    </div>
  );
}
