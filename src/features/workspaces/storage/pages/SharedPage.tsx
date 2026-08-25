'use client';

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";

import { useWorkspace } from '@/features/workspaces/shell/hooks/use-workspace';
import { useSharedFiles, useToggleStarItem, useDeleteItem } from '@/features/workspaces/storage/hooks/use-storage';
import { Share2 } from "lucide-react";
import { Skeleton } from '@/shared/components/ui/skeleton';
import ListView from '../components/views/ListView';
import GridView from '../components/views/GridView';
import { useViewStore } from '../store/use-view-store';
import { usePreviewStore } from '../store/use-preview-store';
import { useStorageFilterStore } from '../store/use-filter-store';
import type { StorageItem } from '@/features/workspaces/storage/types/storage.types';
import { filterSharedFiles } from '../utils/shared.util';
import { applyStorageFilters } from '../utils/filter.util';
import { downloadFileUrl } from '@/shared/utils/file';
import { BulkActionBar } from '../components/layout/BulkActionBar';
import Topbar from '../components/layout/Topbar';

export default function WorkspaceSharedPage() {
  const { workspaceId: workspaceUrl } = useParams() as { workspaceId: string };
  const { view } = useViewStore();
  const { typeFilter, projectFilter, sortBy } = useStorageFilterStore();
  const [searchQuery, setSearchQuery] = useState('');
  const setSelectedItem = usePreviewStore(s => s.setSelectedItem);
  const { workspace, isLoading: isWorkspaceLoading } = useWorkspace(
    workspaceUrl!,
  );
  const workspaceId = workspace?.id || workspaceUrl;

  const { data, isLoading: isFilesLoading } = useSharedFiles(workspaceId);
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
    // Navigate inside shared folder if needed
  };

  const files = useMemo(
    () => applyStorageFilters(filterSharedFiles((data?.files || []) as StorageItem[]), { typeFilter, projectFilter, sortBy, searchQuery }),
    [data?.files, typeFilter, projectFilter, sortBy, searchQuery],
  );

  if (isWorkspaceLoading || isFilesLoading) {
    return <Skeleton className="h-48 w-full rounded-lg" />;
  }

  if (!workspaceId) {
    return <div className="p-6">Workspace not found</div>;
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden relative">
      <Topbar
        title="Shared"
        icon={Share2}
        workspaceId={workspaceId}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />
      <div className="flex-1 overflow-auto p-4 sm:p-6 bg-background">
        {view === 'list' ? (
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

