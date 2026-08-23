'use client';

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";

import { useProject } from '@/features/workspaces/projects/shell/hooks/use-project';
import { useSharedFiles, useToggleStarItem, useDeleteItem } from '@/features/workspaces/projects/project-id/storage/hooks/use-storage';

import { Share2 } from "lucide-react";
import { Skeleton } from '@/shared/components/ui';
import ListView from '@/features/workspaces/projects/project-id/storage/components/views/ListView';
import GridView from '@/features/workspaces/projects/project-id/storage/components/views/GridView';
import { useViewStore } from '@/features/workspaces/projects/project-id/storage/store/use-view-store';
import { usePreviewStore } from '@/features/workspaces/projects/project-id/storage/store/use-preview-store';
import { useStorageFilterStore } from '@/features/workspaces/projects/project-id/storage/store/use-filter-store';
import type { StorageItem } from '@/features/workspaces/projects/project-id/storage/types/storage.types';
import { filterSharedFiles } from '../utils/shared.util';
import { applyStorageFilters } from '../utils/filter.util';
import { downloadFileUrl } from '@/shared/utils/file';
import Topbar from '../components/layout/Topbar';

export default function SharedPage() {
  const setSelectedItem = usePreviewStore(s => s.setSelectedItem);
  const { projectId } = useParams() as { projectId: string };
  const { view } = useViewStore();
  const { typeFilter, sortBy } = useStorageFilterStore();
  const [searchQuery, setSearchQuery] = useState('');
  const { data: projectData, isLoading: isProjectLoading } = useProject(projectId!);

  const { data, isLoading: isFilesLoading } = useSharedFiles(projectId!);
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
    () => applyStorageFilters(filterSharedFiles((data?.files || []) as StorageItem[]), { typeFilter, sortBy, searchQuery }),
    [data?.files, typeFilter, sortBy, searchQuery],
  );

  if (isProjectLoading || isFilesLoading) {
    return <Skeleton className="h-48 w-full rounded-lg" />;
  }

  if (!projectId) {
    return <div className="p-6 text-muted-foreground">Project not found</div>;
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <Topbar
        title="Shared"
        icon={Share2}
        projectId={projectId}
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
    </div>
  );
}
