'use client';

import { useState, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useWorkspace } from '@/features/workspaces/shell/hooks/use-workspace';
import { useHomeFiles, useToggleStarItem, useDeleteItem } from '@/features/workspaces/storage/hooks/use-storage';
import { usePreviewStore } from '../store/use-preview-store';
import { useViewStore } from '../store/use-view-store';
import { useStorageFilterStore } from '../store/use-filter-store';
import { Skeleton } from '@/shared/components/ui';
import ListView from '../components/views/ListView';
import GridView from '../components/views/GridView';
import type { StorageItem } from '@/features/workspaces/storage/types/storage.types';
import { downloadFileUrl } from '@/shared/utils/file';
import { filterHomeFiles } from '../utils/home.util';
import { applyStorageFilters } from '../utils/filter.util';
import { BulkActionBar } from '../components/layout/BulkActionBar';
import { useStorageSelectionStore } from '../store/use-selection-store';
import Topbar from '../components/layout/Topbar';
import { Home } from 'lucide-react';

export default function WorkspaceHomePage() {
  const router = useRouter();
  const { workspaceId: workspaceUrl } = useParams() as { workspaceId: string };
  const { view } = useViewStore();
  const { typeFilter, projectFilter, sortBy } = useStorageFilterStore();
  const [searchQuery, setSearchQuery] = useState('');
  const setSelectedItem = usePreviewStore(s => s.setSelectedItem);
  
  const { workspace, isLoading: isWorkspaceLoading } = useWorkspace(workspaceUrl!);
  const workspaceId = workspace?.id || workspaceUrl;

  // Home view always fetches root items
  const { data, isLoading: isFilesLoading } = useHomeFiles(workspaceId);
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
    onToggleStar: (id: string) => { void handleToggleStar(id); },
    onDelete: (id: string) => { void handleDelete(id); },
    onDownload: handleDownload,
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
        {view === 'list' ? (
          <ListView {...viewProps} />
        ) : (
          <GridView {...viewProps} />
        )}
      </div>
      <BulkActionBar items={files} />
    </div>
  );
}
