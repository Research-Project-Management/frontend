'use client';

import { useMemo, useState, useCallback, useEffect } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { HardDrive } from 'lucide-react';

import { useWorkspace } from '@/features/workspaces/shell/hooks/use-workspace';
import {
  useWorkspaceFiles,
  useToggleStarItem,
  useDeleteItem,
  useMoveItem,
  useFolderPath,
} from '@/features/workspaces/storage/hooks/use-storage';
import { usePreviewStore } from '../store/use-preview-store';
import { useStorageFilterStore } from '../store/use-filter-store';
import { useStorageSelectionStore } from '../store/use-selection-store';

import { Skeleton } from '@/shared/components/ui/skeleton';
import { StorageViewRenderer } from '../components/views/StorageViewRenderer';
import type { StorageItem, BreadcrumbSegment } from '@/features/workspaces/storage/types/storage.types';
import {
  pushBreadcrumbFolder,
  navigateBreadcrumbPath,
  canDropIntoFolder,
} from '../utils/my-files.util';
import { applyStorageFilters } from '../utils/filter.util';
import { downloadStorageItem } from '../utils/file';
import Topbar from '../components/layout/Topbar';
import { BulkActionBar } from '../components/layout/BulkActionBar';

export default function WorkspaceMyFilesPage() {
  const router = useRouter();
  const { workspaceId: workspaceUrl, folderId: routeFolderId } = useParams() as {
    workspaceId: string;
    folderId?: string;
  };
  const searchParams = useSearchParams();
  const folderParam = routeFolderId || searchParams.get('folder');
  const highlightParam = searchParams.get('highlight');

  const { typeFilter, projectFilter, sortBy } = useStorageFilterStore();
  const { clearSelection } = useStorageSelectionStore();
  const [searchQuery, setSearchQuery] = useState('');
  const setSelectedItem = usePreviewStore((s) => s.setSelectedItem);

  const [currentFolder, setCurrentFolder] = useState<string | null>(folderParam || null);
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(highlightParam || null);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbSegment[]>([
    { id: null, name: 'My Drive' },
  ]);
  const [draggingItem, setDraggingItem] = useState<StorageItem | null>(null);
  const { workspace, isLoading: isWorkspaceLoading } = useWorkspace(workspaceUrl!);
  const workspaceId = workspace?.id || workspaceUrl;

  const { data, isLoading: isFilesLoading } = useWorkspaceFiles(workspaceId, currentFolder);
  const { data: folderPathData } = useFolderPath(currentFolder);
  const { mutate: handleToggleStar } = useToggleStarItem();
  const { mutate: handleDelete }     = useDeleteItem();
  const { mutateAsync: moveItem }         = useMoveItem();

  const rawFiles = useMemo(() => (data?.files || []) as StorageItem[], [data?.files]);

  const files = useMemo(
    () => applyStorageFilters(rawFiles, { typeFilter, projectFilter, sortBy, searchQuery }),
    [rawFiles, typeFilter, projectFilter, sortBy, searchQuery],
  );

  useEffect(() => {
    const nextFolder = routeFolderId || searchParams.get('folder') || null;
    if (nextFolder !== currentFolder) {
      setCurrentFolder(nextFolder);
      clearSelection();
    }
    if (highlightParam !== highlightedItemId) {
      setHighlightedItemId(highlightParam || null);
    }
  }, [routeFolderId, searchParams, currentFolder, highlightParam, highlightedItemId, clearSelection]);

  useEffect(() => {
    if (currentFolder && folderPathData?.path && folderPathData.path.length > 0) {
      setBreadcrumbs([
        { id: null, name: 'My Drive' },
        ...folderPathData.path,
      ]);
    } else if (!currentFolder) {
      setBreadcrumbs([{ id: null, name: 'My Drive' }]);
    }
  }, [currentFolder, folderPathData?.path]);

  // Navigation
  const handleFolderClick = useCallback((folder: StorageItem) => {
    clearSelection();
    setCurrentFolder(folder.id);
    setBreadcrumbs((prev) => pushBreadcrumbFolder(prev, { id: folder.id, name: folder.filename }));
    router.push(`/${workspaceUrl}/storage/my-files/${folder.id}`);
  }, [clearSelection, router, workspaceUrl]);

  const handleBreadcrumbNavigate = useCallback((index: number, folderId: string | null) => {
    clearSelection();
    setCurrentFolder(folderId);
    setBreadcrumbs((prev) => navigateBreadcrumbPath(prev, index));
    if (folderId) {
      router.push(`/${workspaceUrl}/storage/my-files/${folderId}`);
    } else {
      router.push(`/${workspaceUrl}/storage/my-files`);
    }
  }, [clearSelection, router, workspaceUrl]);

  const handleTopBreadcrumbNavigate = useCallback((folderId: string | null) => {
    const idx = breadcrumbs.findIndex((s) => s.id === folderId);
    handleBreadcrumbNavigate(idx >= 0 ? idx : 0, folderId);
  }, [breadcrumbs, handleBreadcrumbNavigate]);

  // Drag-and-drop move
  const handleDragStart = (item: StorageItem, e: React.DragEvent) => {
    setDraggingItem(item);
    e.dataTransfer.setData('text/plain', item.id);
  };

  const handleDropOnFolder = async (targetFolder: StorageItem, e: React.DragEvent) => {
    e.preventDefault();
    if (!draggingItem || !canDropIntoFolder(draggingItem, targetFolder)) return;

    try {
      await moveItem({ itemId: draggingItem.id, parentId: targetFolder.id });
      toast.success(`Moved "${draggingItem.filename}" into "${targetFolder.filename}"`);
    } catch {
      toast.error('Failed to move item');
    } finally {
      setDraggingItem(null);
    }
  };

  const handleMoveToParent = async (item: StorageItem) => {
    const parentFolderId =
      breadcrumbs.length >= 2 ? breadcrumbs[breadcrumbs.length - 2].id : null;
    try {
      await moveItem({ itemId: item.id, parentId: parentFolderId });
      toast.success(`Moved "${item.filename}" to parent folder`);
    } catch {
      toast.error('Failed to move item to parent folder');
    }
  };

  // Render
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
    return <div className="p-6 text-muted-foreground">Workspace not found</div>;
  }

  const viewProps = {
    items: files,
    highlightedItemId,
    onFolderClick: handleFolderClick,
    onToggleStar: (id: string) => handleToggleStar(id),
    onDelete: (id: string) => handleDelete(id),
    onDownload: downloadStorageItem,
    onFileClick: (item: StorageItem) => setSelectedItem(item),
    onDragStartFile: handleDragStart,
    onDropOnFolder: handleDropOnFolder,
    onMoveToParent: currentFolder ? handleMoveToParent : undefined,
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden relative">
      <Topbar
        title="My Drive"
        icon={HardDrive}
        breadcrumbs={breadcrumbs}
        onBreadcrumbNavigate={handleTopBreadcrumbNavigate}
        workspaceId={workspaceId}
        parentId={currentFolder}
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
