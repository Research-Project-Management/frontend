'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Download,
  Star,
  Trash2,
  RotateCcw,
  X,
  CheckSquare,
  Square,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/shared/components/ui';
import { DeleteModal } from '../modal/DeleteModal';
import { useStorageSelectionStore } from '../../store/use-selection-store';
import {
  useBatchDeleteItems,
  useBatchRestoreItems,
  useBatchPermanentDeleteItems,
  useBatchStarItems,
} from '../../hooks/use-storage';
import { downloadFileUrl } from '@/shared/utils/file';
import { resolveFileUrl } from '@/shared/utils/url';
import type { StorageItem } from '../../types/storage.types';

interface BulkActionBarProps {
  items: StorageItem[];
  isTrash?: boolean;
}

export function BulkActionBar({ items, isTrash }: BulkActionBarProps) {
  const { selectedIds, clearSelection, selectAll, isAllSelected } = useStorageSelectionStore();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const { mutateAsync: batchDelete, isPending: isDeleting } = useBatchDeleteItems();
  const { mutateAsync: batchRestore, isPending: isRestoring } = useBatchRestoreItems();
  const { mutateAsync: batchPermanentDelete, isPending: isPermanentDeleting } = useBatchPermanentDeleteItems();
  const { mutateAsync: batchStar, isPending: isStarring } = useBatchStarItems();

  const selectedCount = selectedIds.length;
  const allItemIds = items.map((item) => item.id);
  const allSelected = isAllSelected(allItemIds);

  const selectedItems = items.filter((item) => selectedIds.includes(item.id));
  const hasUnstarred = selectedItems.some((item) => !item.starred);

  // Keyboard shortcut: Escape to clear selection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedCount > 0 && !isDeleteModalOpen) {
        clearSelection();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCount, isDeleteModalOpen, clearSelection]);

  if (selectedCount === 0) return null;

  const handleToggleSelectAll = () => {
    if (allSelected) {
      clearSelection();
    } else {
      selectAll(allItemIds);
    }
  };

  const handleBulkDownload = async () => {
    const downloadables = selectedItems.filter((i) => !i.isFolder && i.url);
    if (downloadables.length === 0) {
      toast.info('No downloadable files in selection');
      return;
    }

    setIsDownloading(true);
    toast.info(`Starting download of ${downloadables.length} file(s)...`);

    for (const item of downloadables) {
      try {
        const fullUrl = resolveFileUrl(item.url);
        if (fullUrl) {
          await downloadFileUrl(fullUrl, item.filename);
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
      } catch (err) {
        console.error(`Failed to download ${item.filename}`, err);
      }
    }
    setIsDownloading(false);
  };

  const handleBulkStar = async () => {
    try {
      await batchStar({ ids: selectedIds, starred: hasUnstarred });
      toast.success(
        hasUnstarred
          ? `Starred ${selectedCount} item(s)`
          : `Removed star from ${selectedCount} item(s)`
      );
    } catch {
      toast.error('Failed to update star status');
    }
  };

  const handleBulkRestore = async () => {
    try {
      await batchRestore(selectedIds);
      toast.success(`Restored ${selectedCount} item(s)`);
      clearSelection();
    } catch {
      toast.error('Failed to restore items');
    }
  };

  const handleConfirmDelete = async () => {
    try {
      if (isTrash) {
        await batchPermanentDelete(selectedIds);
        toast.success(`Permanently deleted ${selectedCount} item(s)`);
      } else {
        await batchDelete(selectedIds);
        toast.success(`Moved ${selectedCount} item(s) to trash`);
      }
      clearSelection();
      setIsDeleteModalOpen(false);
    } catch {
      toast.error(isTrash ? 'Failed to delete items permanently' : 'Failed to move items to trash');
    }
  };

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-popover/95 backdrop-blur-md border border-border shadow-2xl text-popover-foreground text-xs select-none"
        >
          {/* Select all checkbox toggle */}
          <button
            onClick={handleToggleSelectAll}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-accent transition-colors font-medium cursor-pointer"
            title={allSelected ? 'Deselect all' : 'Select all'}
          >
            {allSelected ? (
              <CheckSquare className="size-4 text-primary" />
            ) : (
              <Square className="size-4 text-muted-foreground" />
            )}
            <span className="text-foreground font-semibold">
              {selectedCount} selected
            </span>
          </button>

          <div className="h-4 w-px bg-border/80 mx-1" />

          {/* Action buttons */}
          {!isTrash && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2.5 text-xs gap-1.5 text-muted-foreground hover:text-foreground cursor-pointer"
                onClick={handleBulkDownload}
                disabled={isDownloading}
                title="Download selected files"
              >
                {isDownloading ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Download className="size-3.5" />
                )}
                Download
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2.5 text-xs gap-1.5 text-muted-foreground hover:text-foreground cursor-pointer"
                onClick={handleBulkStar}
                disabled={isStarring}
                title={hasUnstarred ? 'Star selected' : 'Unstar selected'}
              >
                <Star
                  className={`size-3.5 ${
                    !hasUnstarred ? 'fill-amber-400 text-amber-400' : ''
                  }`}
                />
                {hasUnstarred ? 'Star' : 'Unstar'}
              </Button>
            </>
          )}

          {isTrash ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2.5 text-xs gap-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 cursor-pointer"
                onClick={handleBulkRestore}
                disabled={isRestoring}
                title="Restore selected items"
              >
                {isRestoring ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="size-3.5" />
                )}
                Restore
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2.5 text-xs gap-1.5 text-destructive hover:bg-destructive/10 cursor-pointer"
                onClick={() => setIsDeleteModalOpen(true)}
                disabled={isPermanentDeleting}
                title="Delete selected items permanently"
              >
                <Trash2 className="size-3.5" />
                Delete permanently
              </Button>
            </>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2.5 text-xs gap-1.5 text-destructive hover:bg-destructive/10 cursor-pointer"
              onClick={() => setIsDeleteModalOpen(true)}
              disabled={isDeleting}
              title="Move selected items to trash"
            >
              <Trash2 className="size-3.5" />
              Trash
            </Button>
          )}

          <div className="h-4 w-px bg-border/80 mx-1" />

          {/* Clear selection */}
          <button
            onClick={clearSelection}
            className="size-7 rounded-lg flex items-center justify-center hover:bg-accent text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title="Deselect all (Esc)"
          >
            <X className="size-3.5" />
          </button>
        </motion.div>
      </AnimatePresence>

      {/* Bulk Delete Modal */}
      <DeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        title={isTrash ? `Delete ${selectedCount} items permanently?` : `Move ${selectedCount} items to trash?`}
        description={
          isTrash
            ? `These ${selectedCount} items will be deleted permanently and cannot be recovered.`
            : `These ${selectedCount} items will be moved to trash and can be restored later.`
        }
        confirmText={isTrash ? 'Delete permanently' : 'Move to trash'}
        cancelText="Cancel"
        loading={isDeleting || isPermanentDeleting}
      />
    </>
  );
}
