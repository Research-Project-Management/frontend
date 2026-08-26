import React, { useState } from 'react';
import {
  Star,
  Folder,
  MoreVertical,
  Download,
  RotateCcw,
  Trash2,
  Pencil,
  FolderUp,
  FolderInput,
  FolderSymlink,
  CheckSquare,
  Square,
  MinusSquare,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui';
import { DeleteModal } from '../modal/DeleteModal';
import { resolveFileUrl } from '@/shared/utils/url';
import type { StorageItem } from '@/features/workspaces/storage/types/storage.types';
import {
  getFileType,
  getFileIcon,
  getFileColor,
  formatFileSize,
  formatDate,
} from '../../utils/file';
import { useStorageSelectionStore } from '../../store/use-selection-store';

function FileIconItem({ item }: { item: StorageItem }) {
  const [hasError, setHasError] = useState(false);
  const fileType = getFileType(item);
  const imageUrl = !hasError
    ? resolveFileUrl(item.thumbnail || (fileType === 'image' ? item.url : undefined))
    : null;

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={item.filename}
        className="size-5 rounded object-cover shrink-0"
        onError={() => setHasError(true)}
      />
    );
  }

  return (
    <div className={`flex items-center justify-center shrink-0 ${getFileColor(fileType)}`}>
      {getFileIcon(fileType, 5)}
    </div>
  );
}

export type StorageViewProps = {
  items: StorageItem[];
  onToggleStar: (fileId: string) => void | Promise<void>;
  onDelete: (fileId: string) => void | Promise<void>;
  onDownload: (item: StorageItem) => void;
  onFolderClick?: (folder: StorageItem) => void;
  onFileClick?: (file: StorageItem) => void;
  isTrash?: boolean;
  selectedItemId?: string | null;
  highlightedItemId?: string | null;
  onDropOnFolder?: (folder: StorageItem, e: React.DragEvent) => void;
  onDragStartFile?: (item: StorageItem, e: React.DragEvent) => void;
  /** Called when user wants to move an item one level up (out of current folder) */
  onMoveToParent?: (item: StorageItem) => void;
  onOpenLocation?: (item: StorageItem) => void;
  isReadOnly?: boolean;
};

type ItemActionsProps = {
  item: StorageItem;
  onToggleStar: (fileId: string) => void | Promise<void>;
  onDelete: (fileId: string) => void | Promise<void>;
  onDownload: (item: StorageItem) => void;
  isTrash?: boolean;
  onMoveToParent?: (item: StorageItem) => void;
  onOpenLocation?: (item: StorageItem) => void;
};

export function ItemActions({
  item,
  onToggleStar,
  onDelete,
  onDownload,
  isTrash,
  onMoveToParent,
  onOpenLocation,
}: ItemActionsProps) {
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteDone, setIsDeleteDone] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const handleRenameClick = () => {
    const event = new CustomEvent('open-rename-modal', { detail: item });
    window.dispatchEvent(event);
  };

  const handleMoveClick = () => {
    const event = new CustomEvent('open-move-modal', { detail: { item } });
    window.dispatchEvent(event);
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      await Promise.resolve(onDelete(item.id));
      toast.success(isTrash ? "Deleted permanently" : "Moved to trash");
      setIsDeleteDone(true);
      window.setTimeout(() => {
        setIsDeleteModalOpen(false);
        setIsDeleteDone(false);
      }, 180);
    } catch {
      toast.error(isTrash ? "Failed to delete" : "Failed to move to trash");
    } finally {
      window.setTimeout(() => {
        setIsDeleting(false);
      }, 180);
    }
  };

  const handleRestore = async () => {
    setIsRestoring(true);
    try {
      const event = new CustomEvent('restore-storage-item', { detail: item.id });
      window.dispatchEvent(event);
      await Promise.resolve(onDelete(item.id));
      toast.success("Restored successfully");
    } catch {
      toast.error("Failed to restore");
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
          className="size-7 text-muted-foreground hover:text-foreground"
          onClick={() => onToggleStar(item.id)}
          title={item.starred ? "Unstar" : "Star"}
        >
          <Star className={`size-3.5 ${item.starred ? "fill-amber-400 text-amber-400" : ""}`} />
        </Button>
      )}

      {!isTrash && !item.isFolder && (
        <Button
          variant="ghost"
          size="icon"
          className="size-7 text-muted-foreground hover:text-foreground"
          onClick={() => onDownload(item)}
          title="Download"
        >
          <Download className="size-3.5" />
        </Button>
      )}

      {isTrash ? (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground hover:text-foreground"
            onClick={handleRestore}
            disabled={isRestoring}
            title="Restore"
          >
            <RotateCcw className="size-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => setIsDeleteModalOpen(true)}
            title="Delete Permanently"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-foreground"
            >
              <MoreVertical className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44 text-xs">
            <DropdownMenuItem onClick={handleRenameClick} className="gap-2">
              <Pencil className="size-3.5" />
              <span>Rename</span>
            </DropdownMenuItem>

            <DropdownMenuItem onClick={handleMoveClick} className="gap-2 cursor-pointer">
              <FolderInput className="size-3.5" />
              <span>Move</span>
            </DropdownMenuItem>

            {onOpenLocation && (
              <DropdownMenuItem onClick={() => onOpenLocation(item)} className="gap-2">
                <FolderSymlink className="size-3.5" />
                <span>Go to location</span>
              </DropdownMenuItem>
            )}

            <DropdownMenuItem
              onClick={() => setIsDeleteModalOpen(true)}
              className="gap-2 text-destructive focus:text-destructive"
            >
              <Trash2 className="size-3.5" />
              <span>Delete</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <DeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        title={isTrash ? "Delete Permanently?" : "Move to Trash?"}
        description={
          isTrash
            ? `Are you sure you want to delete "${item.filename}" permanently? This action cannot be undone.`
            : `Are you sure you want to move "${item.filename}" to trash?`
        }
        confirmText={isDeleteDone ? "Deleted" : isTrash ? "Delete Permanently" : "Delete"}
        cancelText="Cancel"
        loading={isDeleting}
      />
    </div>
  );
}

export default function ListView({
  items,
  onToggleStar,
  onDelete,
  onDownload,
  onFolderClick,
  onFileClick,
  isTrash,
  selectedItemId,
  highlightedItemId,
  onDropOnFolder,
  onDragStartFile,
  onMoveToParent,
  onOpenLocation,
  isReadOnly,
}: StorageViewProps) {
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const {
    selectedIds,
    toggleSelect,
    selectRange,
    selectAll,
    clearSelection,
    isAllSelected,
  } = useStorageSelectionStore();

  const allItemIds = items.map((i) => i.id);
  const allSelected = isAllSelected(allItemIds);
  const hasSomeSelected = selectedIds.length > 0 && !allSelected;

  const handleHeaderCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (allSelected) {
      clearSelection();
    } else {
      selectAll(allItemIds);
    }
  };

  return (
    <div className="rounded-lg overflow-hidden">
      {/* Header - Google Drive style */}
      <div className="grid grid-cols-12 gap-3 px-4 py-2 text-xs font-medium text-muted-foreground border-b border-border/50 select-none">
        <div className="col-span-5 flex items-center gap-3">
          {!isReadOnly && (
            <button
              onClick={handleHeaderCheckboxClick}
              className="size-4 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              title={allSelected ? "Deselect all" : "Select all"}
            >
              {allSelected ? (
                <CheckSquare className="size-4 text-primary" />
              ) : hasSomeSelected ? (
                <MinusSquare className="size-4 text-primary" />
              ) : (
                <Square className="size-4 opacity-50 hover:opacity-100" />
              )}
            </button>
          )}
          <span>Name</span>
        </div>
        <div className="col-span-2">Owner</div>
        <div className="col-span-2">Last modified</div>
        <div className="col-span-1">Size</div>
        <div className="col-span-2"></div>
      </div>

      {items.length === 0 ? (
        <div className="p-12 text-center text-muted-foreground">
          <Folder className="size-12 mx-auto mb-3 opacity-20" />
          <p className="text-sm">No files or folders</p>
        </div>
      ) : (
        <div className="divide-y divide-border/30">
          <AnimatePresence initial={false}>
            {items.map((item) => {
              const isMultiSelected = selectedIds.includes(item.id);
              const isSingleSelected = selectedItemId === item.id || highlightedItemId === item.id;
              const isSelected = isMultiSelected || isSingleSelected;

              return (
                <motion.div
                  key={item.id}
                  id={`storage-item-${item.id}`}
                  layout
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -10, transition: { duration: 0.15 } }}
                  transition={{ duration: 0.2 }}
                  draggable={!isReadOnly && !item.isFolder && !!onDragStartFile}
                  onDragStart={(e: any) => {
                    if (!isReadOnly && !item.isFolder && onDragStartFile) {
                      onDragStartFile(item, e);
                    }
                  }}
                  onDragOver={(e: React.DragEvent) => {
                    if (!isReadOnly && item.isFolder && onDropOnFolder) {
                      e.preventDefault();
                      e.stopPropagation();
                      setDragOverFolderId(item.id);
                    }
                  }}
                  onDragLeave={(e: React.DragEvent) => {
                    if (isReadOnly) return;
                    e.stopPropagation();
                    setDragOverFolderId(null);
                  }}
                  onDrop={(e: React.DragEvent) => {
                    if (!isReadOnly && item.isFolder && onDropOnFolder) {
                      setDragOverFolderId(null);
                      onDropOnFolder(item, e);
                    }
                  }}
                  className={`grid grid-cols-12 gap-3 items-center px-4 py-2 hover:bg-muted/50 cursor-pointer group transition-colors select-none ${
                    isSelected ? "bg-accent/80 font-medium" : ""
                  } ${dragOverFolderId === item.id ? "bg-muted ring-1 ring-muted-foreground/30" : ""}`}
                  onClick={(e: React.MouseEvent) => {
                    if (!isReadOnly && (e.shiftKey || e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      if (e.shiftKey) {
                        selectRange(allItemIds, item.id);
                      } else {
                        toggleSelect(item.id);
                      }
                      return;
                    }

                    if (item.isFolder) {
                      onFolderClick?.(item);
                    } else {
                      onFileClick?.(item);
                    }
                  }}
                >
                  <div className="col-span-5 flex items-center gap-3 min-w-0 overflow-hidden">
                    {!isReadOnly && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (e.shiftKey) {
                            selectRange(allItemIds, item.id);
                          } else {
                            toggleSelect(item.id);
                          }
                        }}
                        className={`size-4 flex items-center justify-center transition-opacity cursor-pointer shrink-0 ${
                          isMultiSelected
                            ? "opacity-100 text-primary"
                            : "opacity-0 group-hover:opacity-60 hover:opacity-100 text-muted-foreground"
                        }`}
                        title={isMultiSelected ? "Deselect" : "Select"}
                      >
                        {isMultiSelected ? (
                          <CheckSquare className="size-4 text-primary" />
                        ) : (
                          <Square className="size-4" />
                        )}
                      </button>
                    )}

                    <FileIconItem item={item} />
                    <span className="text-sm truncate" title={item.filename}>
                      {item.filename}
                    </span>
                    {item.starred && (
                      <Star className="size-3.5 fill-amber-400 text-amber-400 shrink-0" />
                    )}
                  </div>

                  <div className="col-span-2 flex items-center gap-2 min-w-0 overflow-hidden">
                    {item.isFolder ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <>
                        {item.author?.avatar ? (
                          <img
                            src={resolveFileUrl(item.author.avatar) || ""}
                            alt=""
                            className="size-5 rounded-full shrink-0"
                          />
                        ) : (
                          <div className="size-5 rounded-full bg-muted flex items-center justify-center shrink-0">
                            <span className="text-[11px] font-medium text-muted-foreground">
                              {item.author?.name?.charAt(0)?.toUpperCase() || "?"}
                            </span>
                          </div>
                        )}
                        <span className="text-xs text-muted-foreground truncate">
                          {item.author?.name || "—"}
                        </span>
                      </>
                    )}
                  </div>

                  <div className="col-span-2 text-xs text-muted-foreground">
                    {formatDate(item.updatedAt)}
                  </div>

                  <div className="col-span-1 text-xs text-muted-foreground">
                    {item.isFolder ? "—" : formatFileSize(item.size)}
                  </div>

                  <div className="col-span-2 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                    {!isReadOnly && (
                      <ItemActions
                        item={item}
                        onToggleStar={onToggleStar}
                        onDelete={onDelete}
                        onDownload={onDownload}
                        isTrash={isTrash}
                        onMoveToParent={onMoveToParent}
                        onOpenLocation={onOpenLocation}
                      />
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
