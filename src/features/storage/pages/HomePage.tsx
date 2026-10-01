'use client';

import { useMemo, useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Home, Folder, Users, Star, Trash2 } from 'lucide-react';

import {
  useHomeFiles,
  useSharedFiles,
  useStarredFiles,
  useTrash,
  useToggleStarItem,
  useDeleteItem,
  useRestoreItem,
  usePermanentlyDeleteItem,
  useMoveItem,
  useFolderPath,
} from '@/features/storage/hooks/use-storage';
import { useStorageUIStore, type StorageSection } from '../store/storage-ui.store';
import { useStorageSelectionStore } from '../store/use-selection-store';
import { useStorageQueryParams } from '../hooks/use-storage-query-params';
import { StorageViewContainer } from '../components/layout/StorageViewContainer';
import type { StorageItem, BreadcrumbSegment } from '@/features/storage/types/storage.types';
import { canDropIntoFolder } from '../utils/my-files.util';
import { downloadFileUrl } from "@/shared/lib/file-client";
import Topbar from '../components/layout/Topbar';
import { BulkActionBar } from '../components/actions/BulkActionBar';
import StorageDropzoneOverlay from '../components/dropzone/StorageDropzoneOverlay';
import { useTopbar } from '../hooks/use-topbar';

const ROOT_NAME = 'All Files';

export interface UnifiedStoragePageProps {
  initialSection?: StorageSection;
  initialFolderId?: string | null;
}

export default function HomePage({
  initialSection,
  initialFolderId,
}: UnifiedStoragePageProps = {}) {
  const searchParams = useSearchParams();

  // Storage UI Store State
  const activeSection = useStorageUIStore((s) => s.activeSection);
  const setActiveSection = useStorageUIStore((s) => s.setActiveSection);
  const currentFolderId = useStorageUIStore((s) => s.currentFolderId);
  const setCurrentFolderId = useStorageUIStore((s) => s.setCurrentFolderId);
  const highlightedItemId = useStorageUIStore((s) => s.highlightedItemId);
  const setHighlightedItemId = useStorageUIStore((s) => s.setHighlightedItemId);
  const navigateToFolder = useStorageUIStore((s) => s.navigateToFolder);

  const { clearSelection } = useStorageSelectionStore();

  const {
    projectId,
    searchQuery,
    setSearchQuery,
    setSelectedItem,
    queryParams,
  } = useStorageQueryParams();

  const [draggingItem, setDraggingItem] = useState<StorageItem | null>(null);

  // Sync state with URL params on mount / navigation
  useEffect(() => {
    const viewParam = (searchParams?.get('view') as StorageSection) || initialSection || 'home';
    const folderParam = searchParams?.get('folder') || initialFolderId || null;
    const highlightParam = searchParams?.get('highlight') || null;

    if (viewParam !== activeSection) {
      setActiveSection(viewParam, false);
    }
    if (folderParam !== currentFolderId) {
      setCurrentFolderId(folderParam, false);
    }
    if (highlightParam !== highlightedItemId) {
      setHighlightedItemId(highlightParam, false);
    }
  }, [searchParams, initialSection, initialFolderId]);

  // Handle browser back/forward buttons (popstate)
  useEffect(() => {
    const handlePopState = () => {
      const url = new URL(window.location.href);
      const view = (url.searchParams.get('view') as StorageSection) || 'home';
      const folder = url.searchParams.get('folder');
      const highlight = url.searchParams.get('highlight');

      setActiveSection(view, false);
      setCurrentFolderId(folder, false);
      setHighlightedItemId(highlight, false);
      clearSelection();
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [setActiveSection, setCurrentFolderId, setHighlightedItemId, clearSelection]);

  // Upload handler for current active folder
  const activeUploadFolder = activeSection === 'my-files' ? currentFolderId : null;
  const { handleUploadFiles } = useTopbar({
    projectId,
    parentId: activeUploadFolder,
    searchQuery,
    onSearchChange: setSearchQuery,
  });

  // ── Queries (Conditionally enabled based on active section) ─────────────────
  const homeQuery = useHomeFiles(projectId, null, queryParams, {
    enabled: activeSection === 'home',
  });

  const myFilesQuery = useHomeFiles(projectId, currentFolderId, queryParams, {
    enabled: activeSection === 'my-files',
  });

  const sharedQuery = useSharedFiles(projectId, queryParams, {
    enabled: activeSection === 'shared',
  });

  const starredQuery = useStarredFiles(projectId, queryParams, {
    enabled: activeSection === 'starred',
  });

  const trashQuery = useTrash(projectId, queryParams, {
    enabled: activeSection === 'trash',
  });

  const { data: folderPathData } = useFolderPath(
    activeSection === 'my-files' ? currentFolderId : null,
  );

  // Active query selection
  const activeQuery = useMemo(() => {
    switch (activeSection) {
      case 'home':
        return homeQuery;
      case 'my-files':
        return myFilesQuery;
      case 'shared':
        return sharedQuery;
      case 'starred':
        return starredQuery;
      case 'trash':
        return trashQuery;
      default:
        return homeQuery;
    }
  }, [activeSection, homeQuery, myFilesQuery, sharedQuery, starredQuery, trashQuery]);

  // ── Mutations ──────────────────────────────────────────────────────────────
  const { mutateAsync: handleToggleStar } = useToggleStarItem();
  const { mutateAsync: handleDelete } = useDeleteItem();
  const { mutateAsync: handleRestore } = useRestoreItem();
  const { mutateAsync: handlePermanentlyDelete } = usePermanentlyDeleteItem();
  const { mutateAsync: moveItem } = useMoveItem();

  // Breadcrumbs for My Files
  const breadcrumbs: BreadcrumbSegment[] = useMemo(() => {
    if (activeSection !== 'my-files') return [];
    if (!currentFolderId || !folderPathData?.path?.length) {
      return [{ id: null, name: ROOT_NAME }];
    }
    return [{ id: null, name: ROOT_NAME }, ...folderPathData.path];
  }, [activeSection, currentFolderId, folderPathData?.path]);

  const currentFolderName = breadcrumbs.length > 1 ? breadcrumbs[breadcrumbs.length - 1]?.name : ROOT_NAME;

  // File collection from paginated response
  const files = useMemo(
    () => (activeQuery.data?.pages.flatMap((page: any) => page.files || []) || []) as StorageItem[],
    [activeQuery.data?.pages],
  );

  // ── Navigation Handlers ────────────────────────────────────────────────────
  const handleFolderClick = useCallback(
    (folder: StorageItem) => {
      clearSelection();
      navigateToFolder(folder.id);
    },
    [clearSelection, navigateToFolder],
  );

  const handleBreadcrumbNavigate = useCallback(
    (folderId: string | null) => {
      clearSelection();
      navigateToFolder(folderId);
    },
    [clearSelection, navigateToFolder],
  );

  const handleOpenLocation = useCallback(
    (item: StorageItem) => {
      clearSelection();
      navigateToFolder(item.parentId || null, item.id);
    },
    [clearSelection, navigateToFolder],
  );

  const handleDownload = async (item: StorageItem) => {
    if (!item.url) return;
    try {
      await downloadFileUrl(item.url, item.filename);
    } catch {
      window.open(item.url, '_blank');
    }
  };

  // ── Drag & Drop Move Handlers (My Files) ────────────────────────────────────
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
          `Moved "${item.filename}" to ${parentId ? breadcrumbs[breadcrumbs.length - 2].name : ROOT_NAME}`,
        );
      } catch {
        toast.error(`Failed to move "${item.filename}"`);
      }
    },
    [breadcrumbs, moveItem],
  );

  const handleFilesDrop = useCallback(
    (droppedFiles: File[]) => {
      handleUploadFiles(droppedFiles, activeUploadFolder);
    },
    [handleUploadFiles, activeUploadFolder],
  );

  const isTrash = activeSection === 'trash';

  const viewProps = {
    items: files,
    highlightedItemId: activeSection === 'my-files' ? highlightedItemId : null,
    isReadOnly: isTrash,
    isTrash,
    hasMore: activeQuery.hasNextPage,
    isFetchingNextPage: activeQuery.isFetchingNextPage,
    onLoadMore: activeQuery.fetchNextPage,
    onFolderClick: handleFolderClick,
    onToggleStar: isTrash ? undefined : (id: string) => { void handleToggleStar(id); },
    onDelete: isTrash
      ? (id: string) => { void handlePermanentlyDelete(id); }
      : (id: string) => { void handleDelete(id); },
    onRestore: isTrash ? (id: string) => { void handleRestore(id); } : undefined,
    onDownload: handleDownload,
    onOpenLocation: activeSection !== 'my-files' ? handleOpenLocation : undefined,
    onFileClick: (item: StorageItem) => setSelectedItem(item),
    onDragStartFile: activeSection === 'my-files' ? handleDragStart : undefined,
    onDropOnFolder: activeSection === 'my-files' ? handleDropOnFolder : undefined,
    onMoveToParent: activeSection === 'my-files' && currentFolderId ? handleMoveToParent : undefined,
  };

  // ── Topbar Metadata ────────────────────────────────────────────────────────
  const topbarConfig = useMemo(() => {
    switch (activeSection) {
      case 'home':
        return { title: 'Home', icon: Home };
      case 'my-files':
        return { title: currentFolderName, icon: Folder };
      case 'shared':
        return { title: 'Shared', icon: Users };
      case 'starred':
        return { title: 'Starred', icon: Star };
      case 'trash':
        return { title: 'Trash', icon: Trash2 };
      default:
        return { title: 'Home', icon: Home };
    }
  }, [activeSection, currentFolderName]);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden relative">
      <Topbar
        title={topbarConfig.title}
        icon={topbarConfig.icon}
        breadcrumbs={activeSection === 'my-files' ? breadcrumbs : undefined}
        onBreadcrumbNavigate={activeSection === 'my-files' ? handleBreadcrumbNavigate : undefined}
        parentId={activeUploadFolder}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />
      <StorageDropzoneOverlay
        onFilesDrop={handleFilesDrop}
        folderName={activeSection === 'my-files' ? currentFolderName : 'All files'}
      >
        <StorageViewContainer
          isLoading={activeQuery.isLoading && !activeQuery.data}
          isError={activeQuery.isError}
          error={activeQuery.error || new Error('Internal Server Error')}
          viewProps={viewProps}
          searchQuery={searchQuery}
          onClearSearch={() => setSearchQuery('')}
        />
      </StorageDropzoneOverlay>
      <BulkActionBar items={files} isTrash={isTrash} />
    </div>
  );
}
