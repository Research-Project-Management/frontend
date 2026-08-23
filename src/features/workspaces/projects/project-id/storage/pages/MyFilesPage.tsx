'use client';

import { useMemo, useState, useCallback, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { ChevronRight, HardDrive, Home } from 'lucide-react';

import { useProject } from '@/features/workspaces/projects/shell/hooks/use-project';
import {
  useHomeFiles,
  useToggleStarItem,
  useDeleteItem,
  useMoveItem,
  useFolderPath,
} from '@/features/workspaces/projects/project-id/storage/hooks/use-storage';
import { useViewStore } from '@/features/workspaces/projects/project-id/storage/store/use-view-store';
import { usePreviewStore } from '@/features/workspaces/projects/project-id/storage/store/use-preview-store';
import { useStorageFilterStore } from '@/features/workspaces/projects/project-id/storage/store/use-filter-store';

import { Skeleton } from '@/shared/components/ui';
import ListView from '@/features/workspaces/projects/project-id/storage/components/views/ListView';
import GridView from '@/features/workspaces/projects/project-id/storage/components/views/GridView';
import type { StorageItem, BreadcrumbSegment } from '@/features/workspaces/projects/project-id/storage/types/storage.types';
import { pushBreadcrumbFolder, navigateBreadcrumbPath, canDropIntoFolder } from '../utils/my-files.util';
import { applyStorageFilters } from '../utils/filter.util';
import { downloadFileUrl } from '@/shared/utils/file';
import Topbar from '../components/layout/Topbar';

import { useRouter } from 'next/navigation';
import { useStorageSelectionStore } from '@/features/workspaces/storage/store/use-selection-store';
import { BulkActionBar } from '../components/layout/BulkActionBar';

// ── Page ────────────────────────────────────────────────────────────────────
export default function MyFilesPage() {
  const router = useRouter();
  const { workspaceId: workspaceUrl, projectId, folderId: routeFolderId } = useParams() as {
    workspaceId: string;
    projectId: string;
    folderId?: string;
  };
  const searchParams = useSearchParams();
  const folderParam = routeFolderId || searchParams.get('folder');
  const highlightParam = searchParams.get('highlight');

  const { view } = useViewStore();
  const { typeFilter, sortBy } = useStorageFilterStore();
  const { clearSelection } = useStorageSelectionStore();
  const [searchQuery, setSearchQuery] = useState('');
  const setSelectedItem = usePreviewStore((s) => s.setSelectedItem);

  const [currentFolder, setCurrentFolder] = useState<string | null>(folderParam || null);
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(highlightParam || null);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbSegment[]>([
    { id: null, name: 'My Drive' },
  ]);
  const [draggingItem, setDraggingItem] = useState<StorageItem | null>(null);

  const { data: projectData, isLoading: isProjectLoading } = useProject(projectId!);

  const { data, isLoading: isFilesLoading } = useHomeFiles(projectId!, currentFolder);
  const { data: folderPathData } = useFolderPath(currentFolder);
  const { mutateAsync: handleToggleStar } = useToggleStarItem();
  const { mutateAsync: handleDelete }     = useDeleteItem();
  const { mutateAsync: moveItem }         = useMoveItem();

  const rawFiles = useMemo(() => (data?.files || []) as StorageItem[], [data?.files]);

  const files = useMemo(
    () => applyStorageFilters(rawFiles, { typeFilter, sortBy, searchQuery }),
    [rawFiles, typeFilter, sortBy, searchQuery],
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
  }, [routeFolderId, searchParams, currentFolder, highlightedItemId, clearSelection]);

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

  // ── Navigation ─────────────────────────────────────────────────────────
  const handleFolderClick = useCallback((folder: StorageItem) => {
    clearSelection();
    setCurrentFolder(folder.id);
    setBreadcrumbs((prev) => pushBreadcrumbFolder(prev, { id: folder.id, name: folder.filename }));
    router.push(`/${workspaceUrl}/projects/${projectId}/storage/my-files/${folder.id}`);
  }, [clearSelection, router, workspaceUrl, projectId]);

  const handleBreadcrumbNavigate = useCallback((index: number, folderId: string | null) => {
    clearSelection();
    setCurrentFolder(folderId);
    setBreadcrumbs((prev) => navigateBreadcrumbPath(prev, index));
    if (folderId) {
      router.push(`/${workspaceUrl}/projects/${projectId}/storage/my-files/${folderId}`);
    } else {
      router.push(`/${workspaceUrl}/projects/${projectId}/storage/my-files`);
    }
  }, [clearSelection, router, workspaceUrl, projectId]);

  const handleTopBreadcrumbNavigate = useCallback((folderId: string | null) => {
    const idx = breadcrumbs.findIndex((s) => s.id === folderId);
    handleBreadcrumbNavigate(idx >= 0 ? idx : 0, folderId);
  }, [breadcrumbs, handleBreadcrumbNavigate]);

  // ── Download ───────────────────────────────────────────────────────────
  const handleDownload = useCallback(async (item: StorageItem) => {
    if (!item.url) return;
    try {
      await downloadFileUrl(item.url, item.filename);
    } catch {
      window.open(item.url, '_blank');
    }
  }, []);

  // ── Drag-and-drop move ─────────────────────────────────────────────────
  const handleDragStart = useCallback((item: StorageItem) => {
    setDraggingItem(item);
  }, []);

  const handleDropOnFolder = useCallback(
    async (folder: StorageItem) => {
      if (!canDropIntoFolder(draggingItem, folder)) return;
      const itemName = draggingItem!.filename;
      try {
        await moveItem({ itemId: draggingItem!.id, parentId: folder.id });
        toast.success(`Moved "${itemName}" into "${folder.filename}"`);
      } catch {
        toast.error(`Failed to move "${itemName}"`);
      } finally {
        setDraggingItem(null);
      }
    },
    [draggingItem, moveItem],
  );

  const handleMoveToParent = useCallback(
    async (item: StorageItem) => {
      const parentId =
        breadcrumbs.length >= 2 ? breadcrumbs[breadcrumbs.length - 2].id : null;
      try {
        await moveItem({ itemId: item.id, parentId });
        toast.success(
          `Moved "${item.filename}" to ${parentId ? breadcrumbs[breadcrumbs.length - 2].name : 'My Drive'}`,
        );
      } catch {
        toast.error(`Failed to move "${item.filename}"`);
      }
    },
    [breadcrumbs, moveItem],
  );

  // ── Render ─────────────────────────────────────────────────────────────
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
    highlightedItemId,
    onFolderClick: handleFolderClick,
    onToggleStar: (id: string) => { void handleToggleStar(id); },
    onDelete: (id: string) => { void handleDelete(id); },
    onDownload: handleDownload,
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
        projectId={projectId}
        parentId={currentFolder}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />
      <div className="flex-1 overflow-auto p-4 sm:p-6 bg-background">
        {view === 'list' ? <ListView {...viewProps} /> : <GridView {...viewProps} />}
      </div>
      <BulkActionBar items={files} />
    </div>
  );
}
