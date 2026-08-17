'use client';

import { useMemo, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { ChevronRight, HardDrive, Home } from 'lucide-react';

import { useWorkspace } from '@/features/workspaces/shell';
import { useHomeFiles, useToggleStarItem, useDeleteItem, useMoveItem } from '@/features/workspaces/storage/hooks/use-storage';
import { useViewStore } from '../store/use-view-store';
import { usePreviewStore } from '../store/use-preview-store';

import { Skeleton } from '@/shared/components/ui';
import ListView from '../components/views/ListView';
import GridView from '../components/views/GridView';
import type { StorageItem } from '@/features/workspaces/storage/types/storage.types';
import { downloadFileUrl } from '@/shared/utils/file';
import Topbar from '../components/layout/Topbar';

// ── Breadcrumb ──────────────────────────────────────────────────────────────
type BreadcrumbSegment = { _id: string | null; name: string };

function Breadcrumbs({
  segments,
  onNavigate,
}: {
  segments: BreadcrumbSegment[];
  onNavigate: (index: number, id: string | null) => void;
}) {
  if (segments.length <= 1) return null;
  return (
    <nav
      aria-label="Folder navigation"
      className="flex items-center gap-0.5 px-6 py-2 text-[12px] border-b border-border/40 bg-background/60 overflow-x-auto shrink-0 min-w-0"
    >
      {segments.map((seg, idx) => {
        const isLast = idx === segments.length - 1;
        return (
          <span key={idx} className="flex items-center gap-0.5 min-w-0 shrink-0">
            {idx > 0 && (
              <ChevronRight className="size-3 text-muted-foreground/40 shrink-0 mx-0.5" />
            )}
            <button
              onClick={() => onNavigate(idx, seg._id)}
              disabled={isLast}
              className={`truncate max-w-[140px] transition-colors ${
                isLast
                  ? 'text-foreground font-medium cursor-default'
                  : 'text-muted-foreground hover:text-foreground cursor-pointer'
              }`}
              title={seg.name}
            >
              {idx === 0 ? <Home className="size-3 inline -mt-0.5" /> : seg.name}
            </button>
          </span>
        );
      })}
    </nav>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────
export default function WorkspaceMyFilesPage() {
  const { workspaceId: workspaceUrl } = useParams() as { workspaceId: string };
  const { view } = useViewStore();
  const setSelectedItem = usePreviewStore((s) => s.setSelectedItem);

  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbSegment[]>([
    { _id: null, name: 'My Drive' },
  ]);
  const [draggingItem, setDraggingItem] = useState<StorageItem | null>(null);

  const { workspace, isLoading: isWorkspaceLoading } = useWorkspace(workspaceUrl!);
  const workspaceId = workspace?._id || workspaceUrl;

  const { data, isLoading: isFilesLoading } = useHomeFiles(workspaceId, currentFolder);
  const { mutateAsync: handleToggleStar } = useToggleStarItem();
  const { mutateAsync: handleDelete }     = useDeleteItem();
  const { mutateAsync: moveItem }         = useMoveItem();

  const files = useMemo(() => (data?.files || []) as StorageItem[], [data?.files]);

  // ── Navigation ─────────────────────────────────────────────────────────
  const handleFolderClick = useCallback((folder: StorageItem) => {
    setCurrentFolder(folder._id);
    setBreadcrumbs((prev) => [...prev, { _id: folder._id, name: folder.filename }]);
  }, []);

  const handleBreadcrumbNavigate = useCallback((index: number, id: string | null) => {
    setCurrentFolder(id);
    setBreadcrumbs((prev) => prev.slice(0, index + 1));
  }, []);

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
      if (!draggingItem || draggingItem._id === folder._id) return;
      const itemName = draggingItem.filename;
      try {
        await moveItem({ itemId: draggingItem._id, parentId: folder._id });
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
        breadcrumbs.length >= 2 ? breadcrumbs[breadcrumbs.length - 2]._id : null;
      try {
        await moveItem({ itemId: item._id, parentId });
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
    <div className="flex h-full w-full flex-col overflow-hidden">
      <Topbar title="My Drive" icon={HardDrive} workspaceId={workspaceId} parentId={currentFolder} />
      <Breadcrumbs segments={breadcrumbs} onNavigate={handleBreadcrumbNavigate} />
      <div className="flex-1 overflow-auto p-4 sm:p-6 bg-background">
        {view === 'list' ? <ListView {...viewProps} /> : <GridView {...viewProps} />}
      </div>
    </div>
  );
}
