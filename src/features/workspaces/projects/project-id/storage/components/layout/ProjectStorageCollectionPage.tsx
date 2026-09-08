'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useProject } from '@/features/workspaces/projects/shell/hooks/use-project';
import { Skeleton } from '@/shared/components/ui/skeleton';
import ListView from '@/features/workspaces/projects/project-id/storage/components/views/ListView';
import GridView from '@/features/workspaces/projects/project-id/storage/components/views/GridView';
import { useViewStore } from '@/features/workspaces/projects/project-id/storage/store/use-view-store';
import { usePreviewStore } from '@/features/workspaces/projects/project-id/storage/store/use-preview-store';
import { useStorageFilterStore } from '@/features/workspaces/projects/project-id/storage/store/use-filter-store';
import type { StorageItem } from '@/features/workspaces/projects/project-id/storage/types/storage.types';
import { applyStorageFilters } from '../../utils/filter.util';
import { downloadFileUrl } from '@/shared/utils/file';
import Topbar from './Topbar';
import type { LucideIcon } from 'lucide-react';

export interface ProjectStorageCollectionPageProps {
  title: string;
  icon: LucideIcon;
  useFilesHook: (projectId: string) => { data: any; isLoading: boolean };
  filterFiles: (files: StorageItem[]) => StorageItem[];
  onToggleStar?: (id: string) => Promise<any>;
  onDelete?: (id: string) => Promise<any>;
  onRestore?: (id: string) => Promise<any>;
  isTrash?: boolean;
}

export function ProjectStorageCollectionPage({
  title,
  icon,
  useFilesHook,
  filterFiles,
  onToggleStar,
  onDelete,
  onRestore,
  isTrash,
}: ProjectStorageCollectionPageProps) {
  const setSelectedItem = usePreviewStore((s) => s.setSelectedItem);
  const { projectId } = useParams() as { projectId: string };
  const { view } = useViewStore();
  const { typeFilter, sortBy } = useStorageFilterStore();
  const [searchQuery, setSearchQuery] = useState('');
  const { isLoading: isProjectLoading } = useProject(projectId!);

  const { data, isLoading: isFilesLoading } = useFilesHook(projectId!);

  const handleDownload = async (item: StorageItem) => {
    if (!item.url) return;
    try {
      await downloadFileUrl(item.url, item.filename);
    } catch {
      window.open(item.url, '_blank');
    }
  };

  const handleFolderClick = (_folder: StorageItem) => {};

  const files = useMemo(
    () =>
      applyStorageFilters(filterFiles(((data as any)?.files || []) as StorageItem[]), {
        typeFilter,
        sortBy,
        searchQuery,
      }),
    [data, filterFiles, typeFilter, sortBy, searchQuery],
  );

  if (isProjectLoading || isFilesLoading) {
    return <Skeleton className="h-48 w-full rounded-lg" />;
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden relative">
      <Topbar
        title={title}
        icon={icon}
        projectId={projectId!}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />
      <div className="flex-1 overflow-auto p-4 sm:p-6 bg-background">
        {view === 'grid' ? (
          <GridView
            items={files}
            onFolderClick={handleFolderClick}
            onToggleStar={(id) => onToggleStar?.(id)}
            onDelete={(id) => onDelete?.(id)}
            onRestore={(id) => onRestore?.(id)}
            onDownload={handleDownload}
            onFileClick={(item) => setSelectedItem(item)}
            isTrash={isTrash}
          />
        ) : (
          <ListView
            items={files}
            onFolderClick={handleFolderClick}
            onToggleStar={(id) => onToggleStar?.(id)}
            onDelete={(id) => onDelete?.(id)}
            onRestore={(id) => onRestore?.(id)}
            onDownload={handleDownload}
            onFileClick={(item) => setSelectedItem(item)}
            isTrash={isTrash}
          />
        )}
      </div>
    </div>
  );
}

export default ProjectStorageCollectionPage;
