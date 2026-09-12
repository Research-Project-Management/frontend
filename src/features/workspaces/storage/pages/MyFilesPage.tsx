'use client';

import { useMemo, useState, useCallback, useEffect } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ChevronRight, Folder, Home } from 'lucide-react';

import { useWorkspace } from '@/features/workspaces/shell/hooks/use-workspace';
import {
  useHomeFiles,
  useWorkspaceFiles,
  useToggleStarItem,
  useDeleteItem,
  useMoveItem,
  useFolderPath,
} from '@/features/workspaces/storage/hooks/use-storage';
import { usePreviewStore } from '../store/use-preview-store';
import { useStorageFilterStore } from '../store/use-filter-store';
import { useStorageSelectionStore } from '../store/use-selection-store';

import { StorageViewContainer } from '../components/layout/StorageViewContainer';
import type { StorageItem, BreadcrumbSegment } from '@/features/workspaces/storage/types/storage.types';
import {
  pushBreadcrumbFolder,
  navigateBreadcrumbPath,
  canDropIntoFolder,
} from '../utils/my-files.util';
import { downloadFileUrl } from "@/shared/lib/file-client";
import Topbar from '../components/layout/Topbar';
import { BulkActionBar } from '../components/actions/BulkActionBar';
import { useDebounce } from "@/shared/hooks";
import type { FileQueryParams } from '@/features/workspaces/storage/services/file.service';
import StorageDropzoneOverlay from '../components/dropzone/StorageDropzoneOverlay';
import { useTopbar } from '../hooks/use-topbar';

export default function WorkspaceMyFilesPage() {
  const router = useRouter();
  const { workspaceId: workspaceUrl, folderId: routeFolderId } = useParams() as {
    workspaceId?: string;
    folderId?: string;
  };
  const searchParams = useSearchParams();
  const folderParam = routeFolderId || searchParams.get('folder');
  const highlightParam = searchParams.get('highlight');

  const { workspace, isLoading: isWorkspaceLoading } = useWorkspace(workspaceUrl);
  const workspaceId = workspace?.id || workspaceUrl || '';
  const rootName = workspace?.name || 'All Files';

  const { typeFilter, selectedTypes, projectFilter, selectedProjects, sortBy } = useStorageFilterStore();
  const { clearSelection } = useStorageSelectionStore();
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const setSelectedItem = usePreviewStore((s) => s.setSelectedItem);

  const [currentFolder, setCurrentFolder] = useState<string | null>(folderParam || null);
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(highlightParam || null);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbSegment[]>([
    { id: null, name: rootName },
  ]);
  const [draggingItem, setDraggingItem] = useState<StorageItem | null>(null);

  const { handleUploadFiles } = useTopbar({ workspaceId, parentId: currentFolder, searchQuery, onSearchChange: setSearchQuery });

  const queryParams: FileQueryParams = useMemo(() => ({
    search: debouncedSearch || undefined,
    sortBy,
    types: selectedTypes.length > 0 ? selectedTypes : (typeFilter !== 'all' ? typeFilter : undefined),
    projectIds: selectedProjects.length > 0 ? selectedProjects : (projectFilter !== 'all' ? projectFilter : undefined),
  }), [debouncedSearch, sortBy, selectedTypes, typeFilter, selectedProjects, projectFilter]);

  const {
    data,
    isLoading: isFilesLoading,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useHomeFiles(workspaceId, currentFolder, queryParams);
  const { data: folderPathData } = useFolderPath(currentFolder);
  const { mutateAsync: handleToggleStar } = useToggleStarItem();
  const { mutateAsync: handleDelete }     = useDeleteItem();
  const { mutateAsync: moveItem }         = useMoveItem();

  const files = useMemo(
    () => (data?.pages.flatMap((page: any) => page.files || []) || []) as StorageItem[],
    [data?.pages],
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
        { id: null, name: rootName },
        ...folderPathData.path,
      ]);
    } else if (!currentFolder) {
      setBreadcrumbs([{ id: null, name: rootName }]);
    }
  }, [currentFolder, folderPathData?.path, rootName]);

  // ── Navigation ─────────────────────────────────────────────────────────
  const handleFolderClick = useCallback((folder: StorageItem) => {
    clearSelection();
    setCurrentFolder(folder.id);
    setBreadcrumbs((prev) => pushBreadcrumbFolder(prev, { id: folder.id, name: folder.filename }));
    const base = workspaceUrl ? `/${workspaceUrl}/storage/my-files` : `/storage/my-files`;
    router.push(`${base}/${folder.id}`);
  }, [clearSelection, router, workspaceUrl]);

  const handleBreadcrumbNavigate = useCallback((index: number, folderId: string | null) => {
    clearSelection();
    setCurrentFolder(folderId);
    setBreadcrumbs((prev) => navigateBreadcrumbPath(prev, index));
    const base = workspaceUrl ? `/${workspaceUrl}/storage/my-files` : `/storage/my-files`;
    if (folderId) {
      router.push(`${base}/${folderId}`);
    } else {
      router.push(base);
    }
  }, [clearSelection, router, workspaceUrl]);

  const handleTopBreadcrumbNavigate = useCallback((folderId: string | null) => {
    const idx = breadcrumbs.findIndex((s) => s.id === folderId);
    handleBreadcrumbNavigate(idx >= 0 ? idx : 0, folderId);
  }, [breadcrumbs, handleBreadcrumbNavigate]);

  // ── Download ───────────────────────────────────────────────────────────
  const handleDownload = async (item: StorageItem) => {
    if (!item.url) return;
    try {
      await downloadFileUrl(item.url, item.filename);
    } catch {
      window.open(item.url, '_blank');
    }
  };

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
          `Moved "${item.filename}" to ${parentId ? breadcrumbs[breadcrumbs.length - 2].name : rootName}`,
        );
      } catch {
        toast.error(`Failed to move "${item.filename}"`);
      }
    },
    [breadcrumbs, moveItem, rootName],
  );

  const handleFilesDrop = useCallback((droppedFiles: File[]) => {
    handleUploadFiles(droppedFiles, currentFolder);
  }, [handleUploadFiles, currentFolder]);

  const viewProps = {
    items: files,
    highlightedItemId,
    hasMore: hasNextPage,
    isFetchingNextPage,
    onLoadMore: fetchNextPage,
    onFolderClick: handleFolderClick,
    onToggleStar: (id: string) => { void handleToggleStar(id); },
    onDelete: (id: string) => { void handleDelete(id); },
    onDownload: handleDownload,
    onFileClick: (item: StorageItem) => setSelectedItem(item),
    onDragStartFile: handleDragStart,
    onDropOnFolder: handleDropOnFolder,
    onMoveToParent: currentFolder ? handleMoveToParent : undefined,
  };

  const currentFolderName = breadcrumbs[breadcrumbs.length - 1]?.name || rootName;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden relative">
      <Topbar
        title={rootName}
        icon={Folder}
        breadcrumbs={breadcrumbs}
        onBreadcrumbNavigate={handleTopBreadcrumbNavigate}
        workspaceId={workspaceId}
        parentId={currentFolder}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />
      <StorageDropzoneOverlay
        onFilesDrop={handleFilesDrop}
        folderName={currentFolderName}
      >
        <StorageViewContainer
          isLoading={isWorkspaceLoading || (isFilesLoading && !data)}
          workspaceId={workspaceId}
          viewProps={viewProps}
        />
      </StorageDropzoneOverlay>
      <BulkActionBar items={files} />
    </div>
  );
}
