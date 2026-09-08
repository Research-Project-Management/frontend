'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useWorkspace } from '@/features/workspaces/shell/hooks/use-workspace';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { StorageViewRenderer } from '../views/StorageViewRenderer';
import { usePreviewStore } from '../../store/use-preview-store';
import { useStorageFilterStore } from '../../store/use-filter-store';
import type { StorageItem } from '@/features/workspaces/storage/types/storage.types';
import { applyStorageFilters } from '../../utils/filter.util';
import { downloadStorageItem } from '../../utils/file';
import { BulkActionBar } from './BulkActionBar';
import Topbar from './Topbar';
import type { LucideIcon } from 'lucide-react';

export interface StorageCollectionPageProps {
  title: string;
  icon: LucideIcon;
  useDataHook: (workspaceId: string) => { data: { files?: StorageItem[] } | undefined; isLoading: boolean };
  filterItems: (items: StorageItem[]) => StorageItem[];
  onFolderClick?: (folder: StorageItem) => void;
  onToggleStar?: (id: string) => void;
  onDelete?: (id: string) => void;
  onRestore?: (id: string) => void;
  isTrash?: boolean;
}

export function StorageCollectionPage({
  title,
  icon,
  useDataHook,
  filterItems,
  onFolderClick,
  onToggleStar,
  onDelete,
  onRestore,
  isTrash = false,
}: StorageCollectionPageProps) {
  const { workspaceId: workspaceUrl } = useParams() as { workspaceId: string };
  const { typeFilter, projectFilter, sortBy } = useStorageFilterStore();
  const [searchQuery, setSearchQuery] = useState('');
  const setSelectedItem = usePreviewStore((s) => s.setSelectedItem);
  const { workspace, isLoading: isWorkspaceLoading } = useWorkspace(workspaceUrl!);
  const workspaceId = workspace?.id || workspaceUrl;

  const { data, isLoading: isFilesLoading } = useDataHook(workspaceId);

  const files = useMemo(
    () =>
      applyStorageFilters(filterItems((data?.files || []) as StorageItem[]), {
        typeFilter,
        projectFilter,
        sortBy,
        searchQuery,
      }),
    [data?.files, filterItems, typeFilter, projectFilter, sortBy, searchQuery],
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
        title={title}
        icon={icon}
        workspaceId={workspaceId}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />
      <div className="flex-1 overflow-auto p-4 sm:p-6 bg-background">
        <StorageViewRenderer
          items={files}
          onFolderClick={onFolderClick}
          onToggleStar={onToggleStar}
          onDelete={onDelete || (() => {})}
          onRestore={onRestore}
          onDownload={downloadStorageItem}
          onFileClick={(item) => setSelectedItem(item)}
          isTrash={isTrash}
        />
      </div>
      <BulkActionBar items={files} isTrash={isTrash} />
    </div>
  );
}

export default StorageCollectionPage;
