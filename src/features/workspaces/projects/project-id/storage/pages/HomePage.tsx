'use client';

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { useProject } from '@/features/workspaces/projects/shell/services/project.services';
import { useHomeFiles, useToggleStarItem, useDeleteItem } from '@/features/workspaces/projects/project-id/storage/hooks/use-storage';
import { usePreviewStore } from '@/features/workspaces/projects/project-id/storage/store/use-preview-store';
import { useViewStore } from '@/features/workspaces/projects/project-id/storage/store/use-view-store';
import { Skeleton } from '@/shared/components/ui';
import ListView from '@/features/workspaces/projects/project-id/storage/components/views/ListView';
import GridView from '@/features/workspaces/projects/project-id/storage/components/views/GridView';
import type { StorageItem } from '@/features/workspaces/projects/project-id/storage/types/storage.types';
import { downloadFileUrl } from '@/shared/utils/file';
import Topbar from '../components/layout/Topbar';
import { Home } from 'lucide-react';

export default function HomePage() {
  const { projectId } = useParams() as { projectId: string };
  const { view } = useViewStore();
  const setSelectedItem = usePreviewStore(s => s.setSelectedItem);

  const { data: projectData, isLoading: isProjectLoading } = useProject(projectId!);
  
  // Home view always fetches root items
  const { data, isLoading: isFilesLoading } = useHomeFiles(projectId!);
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
    () => ((data?.files || []) as StorageItem[]).filter(item => !item.isFolder),
    [data?.files],
  );

  if (isProjectLoading || isFilesLoading) {
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

  if (!projectId) {
    return <div className="p-6 text-muted-foreground">Project not found</div>;
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <Topbar title="Home" icon={Home} projectId={projectId} />
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
