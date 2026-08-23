'use client';

import { useState, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useProject } from '@/features/workspaces/projects/shell/hooks/use-project';
import { useHomeFiles, useToggleStarItem, useDeleteItem } from '@/features/workspaces/projects/project-id/storage/hooks/use-storage';
import { usePreviewStore } from '@/features/workspaces/projects/project-id/storage/store/use-preview-store';
import { useViewStore } from '@/features/workspaces/projects/project-id/storage/store/use-view-store';
import { useStorageFilterStore } from '@/features/workspaces/projects/project-id/storage/store/use-filter-store';
import { Skeleton } from '@/shared/components/ui';
import ListView from '@/features/workspaces/projects/project-id/storage/components/views/ListView';
import GridView from '@/features/workspaces/projects/project-id/storage/components/views/GridView';
import type { StorageItem } from '@/features/workspaces/projects/project-id/storage/types/storage.types';
import { downloadFileUrl } from '@/shared/utils/file';
import { filterHomeFiles } from '../utils/home.util';
import { applyStorageFilters } from '../utils/filter.util';
import { BulkActionBar } from '../components/layout/BulkActionBar';
import Topbar from '../components/layout/Topbar';
import { Home } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const { workspaceId: workspaceUrl, projectId } = useParams() as { workspaceId: string; projectId: string };
  const { view } = useViewStore();
  const { typeFilter, sortBy } = useStorageFilterStore();
  const [searchQuery, setSearchQuery] = useState('');
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

  const handleOpenLocation = useCallback((item: StorageItem) => {
    const params = new URLSearchParams();
    if (item.parentId) {
      params.set('folder', item.parentId);
    }
    params.set('highlight', item.id);
    router.push(`/${workspaceUrl}/projects/${projectId}/storage/my-files?${params.toString()}`);
  }, [router, workspaceUrl, projectId]);

  const files = useMemo(
    () => applyStorageFilters(filterHomeFiles((data?.files || []) as StorageItem[]), { typeFilter, sortBy, searchQuery }),
    [data?.files, typeFilter, sortBy, searchQuery],
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

  const viewProps = {
    items: files,
    isReadOnly: false,
    onToggleStar: (id: string) => { void handleToggleStar(id); },
    onDelete: (id: string) => { void handleDelete(id); },
    onDownload: handleDownload,
    onOpenLocation: handleOpenLocation,
    onFileClick: (item: StorageItem) => setSelectedItem(item),
    onFolderClick: (folder: StorageItem) => router.push(`/${workspaceUrl}/projects/${projectId}/storage/my-files?folder=${folder.id}`),
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden relative">
      <Topbar
        title="Home"
        icon={Home}
        projectId={projectId}
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
