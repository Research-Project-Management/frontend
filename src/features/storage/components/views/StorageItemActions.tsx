'use client';

import React, { useState } from 'react';
import {
  Star,
  MoreVertical,
  Download,
  RotateCcw,
  Trash2,
  Pencil,
  FolderInput,
  FolderSymlink,
  Info,
  History,
  Table2,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import { Button } from '@/shared/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { cn } from '@/shared/lib/utils';
import type { StorageItem } from '../../types/storage.types';
import { useStorageUIStore, usePreviewStore } from '../../store/storage-ui.store';
import { isScientificTextFile } from '../../utils/storage.util';

const DeleteModal = dynamic(
  () => import('../modal/DeleteModal').then((m) => m.DeleteModal),
  { ssr: false },
);

export type ItemActionsProps = {
  item: StorageItem;
  onToggleStar?: (fileId: string) => void | Promise<void>;
  onDelete: (fileId: string) => void | Promise<void>;
  onRestore?: (fileId: string) => void | Promise<void>;
  onDownload: (item: StorageItem) => void;
  isTrash?: boolean;
  onOpenLocation?: (item: StorageItem) => void;
  alwaysVisible?: boolean;
};

export const ItemActions = React.memo(function ItemActions({
  item,
  onToggleStar,
  onDelete,
  onRestore,
  onDownload,
  isTrash,
  onOpenLocation,
  alwaysVisible = false,
}: ItemActionsProps) {
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const setSelectedItem = usePreviewStore((s) => s.setSelectedItem);
  const openRenameModal = useStorageUIStore((s) => s.openRenameModal);
  const openMoveModal = useStorageUIStore((s) => s.openMoveModal);
  const openVersionModal = useStorageUIStore((s) => s.openVersionModal);
  const openScientificViewer = useStorageUIStore((s) => s.openScientificViewer);

  const isScientificText = isScientificTextFile(item.filename);

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      await Promise.resolve(onDelete(item.id));
      toast.success(isTrash ? 'Deleted permanently' : 'Moved to trash');
      setIsDeleteModalOpen(false);
    } catch {
      toast.error(isTrash ? 'Failed to delete' : 'Failed to move to trash');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRestore = async () => {
    if (!onRestore) return;
    setIsRestoring(true);
    try {
      await Promise.resolve(onRestore(item.id));
      toast.success('Restored successfully');
    } catch {
      toast.error('Failed to restore');
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      {!isTrash && (
        <Button
          variant="ghost"
          size="icon"
          className="hidden sm:inline-flex size-7 text-muted-foreground hover:text-foreground cursor-pointer"
          onClick={() => onToggleStar?.(item.id)}
          title={item.starred ? 'Unstar' : 'Star'}
        >
          <Star className={`size-3.5 ${item.starred ? 'fill-amber-400 text-amber-400' : ''} shrink-0`} />
        </Button>
      )}

      {!isTrash && !item.isFolder && (
        <Button
          variant="ghost"
          size="icon"
          className="hidden sm:inline-flex size-7 text-muted-foreground hover:text-foreground cursor-pointer"
          onClick={() => onDownload(item)}
          title="Download"
        >
          <Download className="size-3.5 shrink-0" />
        </Button>
      )}

      {isTrash ? (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground hover:text-foreground cursor-pointer"
            onClick={handleRestore}
            disabled={isRestoring}
            title="Restore"
          >
            <RotateCcw className="size-3.5 shrink-0" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-destructive hover:text-destructive hover:bg-muted cursor-pointer"
            onClick={() => setIsDeleteModalOpen(true)}
            title="Delete Permanently"
          >
            <Trash2 className="size-3.5 shrink-0" />
          </Button>
        </div>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                'size-8 sm:size-7 text-muted-foreground hover:text-foreground cursor-pointer rounded-md',
                alwaysVisible ? 'opacity-100' : 'opacity-100 md:opacity-0 md:group-hover:opacity-100',
              )}
              aria-label="Item actions"
            >
              <MoreVertical className="size-4 sm:size-3.5 shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 text-xs p-1">
            <DropdownMenuItem
              onClick={() => setSelectedItem(item)}
              className="gap-2 cursor-pointer"
            >
              <Info className="size-3.5 shrink-0 text-muted-foreground" />
              <span>Details & preview</span>
            </DropdownMenuItem>

            {!item.isFolder && (
              <DropdownMenuItem
                onClick={() => openVersionModal(item)}
                className="gap-2 cursor-pointer"
              >
                <History className="size-3.5 shrink-0 text-muted-foreground" />
                <span>Version history</span>
              </DropdownMenuItem>
            )}

            {isScientificText && (
              <DropdownMenuItem
                onClick={() => openScientificViewer(item)}
                className="gap-2 text-primary focus:text-primary cursor-pointer"
              >
                <Table2 className="size-3.5 shrink-0" />
                <span>View dataset & code</span>
              </DropdownMenuItem>
            )}

            {!item.isFolder && (
              <DropdownMenuItem
                onClick={() => onDownload(item)}
                className="gap-2 cursor-pointer sm:hidden"
              >
                <Download className="size-3.5 shrink-0 text-muted-foreground" />
                <span>Download</span>
              </DropdownMenuItem>
            )}

            <DropdownMenuItem
              onClick={() => onToggleStar?.(item.id)}
              className="gap-2 cursor-pointer sm:hidden"
            >
              <Star className={cn('size-3.5 shrink-0', item.starred ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground')} />
              <span>{item.starred ? 'Remove star' : 'Add star'}</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator className="my-1" />

            <DropdownMenuItem onClick={() => openRenameModal(item)} className="gap-2 cursor-pointer">
              <Pencil className="size-3.5 shrink-0 text-muted-foreground" />
              <span>Rename</span>
            </DropdownMenuItem>

            <DropdownMenuItem onClick={() => openMoveModal(item)} className="gap-2 cursor-pointer">
              <FolderInput className="size-3.5 shrink-0 text-muted-foreground" />
              <span>Move to…</span>
            </DropdownMenuItem>

            {onOpenLocation && (
              <DropdownMenuItem onClick={() => onOpenLocation(item)} className="gap-2 cursor-pointer">
                <FolderSymlink className="size-3.5 shrink-0 text-muted-foreground" />
                <span>Go to location</span>
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator className="my-1" />

            <DropdownMenuItem
              onMouseEnter={() => import('../modal/DeleteModal')}
              onClick={() => setIsDeleteModalOpen(true)}
              className="gap-2 text-destructive focus:text-destructive cursor-pointer"
            >
              <Trash2 className="size-3.5 shrink-0" />
              <span>{isTrash ? 'Delete permanently' : 'Move to trash'}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {isDeleteModalOpen && (
        <DeleteModal
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          onConfirm={handleConfirmDelete}
          title={isTrash ? 'Delete Permanently?' : 'Move to Trash?'}
          description={
            isTrash
              ? `Are you sure you want to delete "${item.filename}" permanently? This action cannot be undone.`
              : `Are you sure you want to move "${item.filename}" to trash?`
          }
          confirmText={isTrash ? 'Delete Permanently' : 'Delete'}
          cancelText="Cancel"
          loading={isDeleting}
        />
      )}
    </div>
  );
});
