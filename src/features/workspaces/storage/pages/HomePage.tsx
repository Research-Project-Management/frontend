'use client';

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { useWorkspace } from '@/features/workspaces/shell';
import { useHomeFiles, useToggleStarItem, useDeleteItem } from '@/features/workspaces/storage/hooks/use-storage';
import { usePreviewStore } from '../store/use-preview-store';
import { useViewStore } from '../store/use-view-store';
import { Skeleton } from '@/shared/components/ui';
import ListView from '../components/views/ListView';
import GridView from '../components/views/GridView';
import type { StorageItem } from '@/features/workspaces/storage/types/storage.types';
import { downloadFileUrl } from '@/shared/utils/file';
import { filterHomeFiles } from '../utils/home.util';
import Topbar from '../components/layout/Topbar';
import { Home } from 'lucide-react';

export default function WorkspaceHomePage() {
  const { workspaceId: workspaceUrl } = useParams() as { workspaceId: string };
  const { view } = useViewStore();
  const setSelectedItem = usePreviewStore(s => s.setSelectedItem);
  
  const { workspace, isLoading: isWorkspaceLoading } = useWorkspace(workspaceUrl!);
  const workspaceId = workspace?._id || workspaceUrl;

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

  const files = useMemo(
    () => filterHomeFiles((data?.files || []) as StorageItem[]),
    [data?.files],
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

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <Topbar title="Home" icon={Home} workspaceId={workspaceId} />
      <div className="flex-1 overflow-auto p-4 sm:p-6 bg-background">
        {view === 'list' ? (
          <ListView
            items={files}
            isReadOnly={true}
            onToggleStar={(id) => { handleToggleStar(id); }}
            onDelete={(id) => { handleDelete(id); }}
            onDownload={handleDownload}
            onFileClick={(item) => setSelectedItem(item)}
            onFolderClick={(item) => setSelectedItem(item)}
          />
        ) : (
          <GridView
            items={files}
            isReadOnly={true}
            onToggleStar={(id) => { handleToggleStar(id); }}
            onDelete={(id) => { handleDelete(id); }}
            onDownload={handleDownload}
            onFileClick={(item) => setSelectedItem(item)}
            onFolderClick={(item) => setSelectedItem(item)}
          />
        )}
      </div>
    </div>
  );
}
