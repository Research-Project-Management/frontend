'use client';

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";

import { useWorkspace } from '@/features/workspaces/shell/hooks/use-workspace';
import { useTrash, useRestoreItem, usePermanentlyDeleteItem } from '@/features/workspaces/storage/hooks/use-storage';
import { Trash2 } from "lucide-react";
import { Skeleton } from '@/shared/components/ui/skeleton';
import ListView from '../components/views/ListView';
import GridView from '../components/views/GridView';
import { useViewStore } from '../store/use-view-store';
import { usePreviewStore } from '../store/use-preview-store';
import { useStorageFilterStore } from '../store/use-filter-store';
import type { StorageItem } from '@/features/workspaces/storage/types/storage.types';
import { filterTrashFiles } from '../utils/trash.util';
import { applyStorageFilters } from '../utils/filter.util';
import { downloadFileUrl } from '@/shared/utils/file';
import { BulkActionBar } from '../components/actions/BulkActionBar';
import Topbar from '../components/layout/Topbar';

import { useDebounce } from '@/shared/hooks/use-debounce';
import type { FileQueryParams } from '@/features/workspaces/storage/services/file.service';

export default function WorkspaceTrashPage() {
  const { workspaceId: workspaceUrl } = useParams() as { workspaceId: string };
  const { view } = useViewStore();
  const { typeFilter, selectedTypes, projectFilter, selectedProjects, sortBy } = useStorageFilterStore();
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const setSelectedItem = usePreviewStore(s => s.setSelectedItem);
  const { workspace, isLoading: isWorkspaceLoading } = useWorkspace(
    workspaceUrl!,
  );
  const workspaceId = workspace?.id || workspaceUrl;

  const queryParams: FileQueryParams = useMemo(() => ({
    search: debouncedSearch || undefined,
    sortBy,
    types: selectedTypes.length > 0 ? selectedTypes : (typeFilter !== 'all' ? typeFilter : undefined),
    projectIds: selectedProjects.length > 0 ? selectedProjects : (projectFilter !== 'all' ? projectFilter : undefined),
  }), [debouncedSearch, sortBy, selectedTypes, typeFilter, selectedProjects, projectFilter]);

  const { data, isLoading: isFilesLoading } = useTrash(workspaceId, queryParams);
  const { mutateAsync: handleRestore } = useRestoreItem();
  const { mutateAsync: handlePermanentlyDelete } = usePermanentlyDeleteItem();

  const handleDownload = async (item: StorageItem) => {
    if (!item.url) return;
    try {
      await downloadFileUrl(item.url, item.filename);
    } catch {
      window.open(item.url, "_blank");
    }
  };

  const files = useMemo(
    () => (data?.files || []) as StorageItem[],
    [data?.files],
  );

  return (
    <div className="flex h-full w-full flex-col overflow-hidden relative">
      <Topbar
        title="Trash"
        icon={Trash2}
        workspaceId={workspaceId}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />
      <div className="flex-1 overflow-auto p-4 sm:p-6 bg-background">
        {isWorkspaceLoading || (isFilesLoading && !data) ? (
          <Skeleton className="h-48 w-full rounded-lg" />
        ) : !workspaceId ? (
          <div className="p-6 text-muted-foreground">Workspace not found</div>
        ) : view === 'list' ? (
          <ListView
            items={files}
            onToggleStar={(id: string) => { void handleRestore(id); }}
            onDelete={(id: string) => { void handlePermanentlyDelete(id); }}
            onDownload={handleDownload}
            onFileClick={(item) => setSelectedItem(item)}
            isTrash={true}
          />
        ) : (
          <GridView
            items={files}
            onToggleStar={(id: string) => { void handleRestore(id); }}
            onDelete={(id: string) => { void handlePermanentlyDelete(id); }}
            onDownload={handleDownload}
            onFileClick={(item) => setSelectedItem(item)}
            isTrash={true}
          />
        )}
      </div>
      <BulkActionBar items={files} isTrash={true} />
    </div>
  );
}


