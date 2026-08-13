import React, { useState } from 'react';
import { Star, Folder, MoreVertical, Download, RotateCcw, Trash2, Pencil, FolderUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/components/ui';
import { DeleteModal } from '@/features/workspaces/settings';
import { resolveFileUrl } from '@/shared/utils/url';
import type { StorageItem } from '@/features/workspaces/storage/types/storage.types';
import { getFileType, getFileIcon, getFileColor, formatFileSize, formatDate } from '../../utils/file';

export type StorageViewProps = {
  items: StorageItem[];
  onToggleStar: (fileId: string) => void | Promise<void>;
  onDelete: (fileId: string) => void | Promise<void>;
  onDownload: (item: StorageItem) => void;
  onFolderClick?: (folder: StorageItem) => void;
  onFileClick?: (file: StorageItem) => void;
  isTrash?: boolean;
  selectedItemId?: string | null;
  onDropOnFolder?: (folder: StorageItem, e: React.DragEvent) => void;
  onDragStartFile?: (item: StorageItem, e: React.DragEvent) => void;
  /** Called when user wants to move an item one level up (out of current folder) */
  onMoveToParent?: (item: StorageItem) => void;
  isReadOnly?: boolean;
};

type ItemActionsProps = {
  item: StorageItem;
  onToggleStar: (fileId: string) => void | Promise<void>;
  onDelete: (fileId: string) => void | Promise<void>;
  onDownload: (item: StorageItem) => void;
  isTrash?: boolean;
  onMoveToParent?: (item: StorageItem) => void;
};

export function ItemActions({
  item,
  onToggleStar,
  onDelete,
  onDownload,
  isTrash,
  onMoveToParent,
}: ItemActionsProps) {
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteDone, setIsDeleteDone] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const handleRenameClick = () => {
    const event = new CustomEvent('open-rename-modal', { detail: item });
    window.dispatchEvent(event);
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      await Promise.resolve(onDelete(item._id));
      toast.success(isTrash ? "Deleted permanently" : "Moved to trash");
      setIsDeleteDone(true);
      window.setTimeout(() => {
        setIsDeleteModalOpen(false);
        setIsDeleteDone(false);
      }, 180);
    } catch (err) {
      toast.error(isTrash ? "Failed to delete" : "Failed to move to trash");
    } finally {
      window.setTimeout(() => {
        setIsDeleting(false);
      }, 180);
    }
  };

  const handleRestore = async () => {
    if (isRestoring) return;
    setIsRestoring(true);
    try {
      await Promise.resolve(onToggleStar(item._id));
      toast.success(`Restored "${item.filename}"`);
    } catch {
      toast.error("Failed to restore file");
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div
      onPointerDown={(e: React.MouseEvent) => e.stopPropagation()}
      onClick={(e: React.MouseEvent) => e.stopPropagation()}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onPointerDown={(e: React.MouseEvent) => e.stopPropagation()}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            <MoreVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          onPointerDown={(e: React.MouseEvent) => e.stopPropagation()}
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
        >
          {!item.isFolder && (
            <DropdownMenuItem
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                onDownload(item);
              }}
            >
              <Download className="size-4 mr-2" />
              Download
            </DropdownMenuItem>
          )}
          {isTrash ? (
            <>
              <DropdownMenuItem
                disabled={isRestoring}
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  void handleRestore();
                }}
              >
                <RotateCcw className="size-4 mr-2" />
                {isRestoring ? 'Restoring...' : 'Restore'}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  setIsDeleteModalOpen(true);
                }}
              >
                <Trash2 className="size-4 mr-2" />
                Delete Permanently
              </DropdownMenuItem>
            </>
          ) : (
            <>
              <DropdownMenuItem onClick={handleRenameClick}>
                <Pencil className="size-4 mr-2" />
                Rename
              </DropdownMenuItem>
              {onMoveToParent && (
                <DropdownMenuItem
                  onClick={(e: React.MouseEvent) => {
                    e.stopPropagation();
                    onMoveToParent(item);
                  }}
                >
                  <FolderUp className="size-4 mr-2" />
                  Move up
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  onToggleStar(item._id);
                }}
              >
                <Star className="size-4 mr-2" />
                {item.starred ? 'Unstar' : 'Star'}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  setIsDeleteModalOpen(true);
                }}
              >
                <Trash2 className="size-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <DeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        title={isTrash ? "Delete file permanently?" : "Move file to trash?"}
        description={
          isTrash
            ? `Are you sure you want to permanently delete "${item.filename}"? This action cannot be undone.`
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
  onDropOnFolder,
  onDragStartFile,
  onMoveToParent,
  isReadOnly,
}: StorageViewProps) {
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  return (
    <div className="rounded-lg overflow-hidden">
      {/* Header - Google Drive style */}
      <div className="grid grid-cols-12 gap-4 px-4 py-2 text-xs font-medium text-muted-foreground border-b border-border/50">
        <div className="col-span-4">Name</div>
        <div className="col-span-2">Owner</div>
        <div className="col-span-3">Last modified</div>
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
              const fileType = getFileType(item);
              return (
                <motion.div
                  key={item._id}
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
                      setDragOverFolderId(item._id);
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
                  className={`grid grid-cols-12 gap-4 items-center px-4 py-2.5 hover:bg-muted/50 cursor-pointer group transition-colors ${selectedItemId === item._id ? "bg-accent/80" : ""
                    } ${dragOverFolderId === item._id ? "bg-muted ring-1 ring-muted-foreground/30" : ""
                    }`}
                  onClick={(e: React.MouseEvent) => {
                    if (item.isFolder) {
                      onFolderClick?.(item);
                    } else {
                      onFileClick?.(item);
                    }
                  }}
                >
                  <div className="col-span-4 flex items-center gap-3 min-w-0 overflow-hidden">
                    <div
                      className={`flex items-center justify-center shrink-0 ${!(item.thumbnail || (fileType === "image" && item.url)) ? getFileColor(fileType) : ""}`}
                    >
                      {item.thumbnail || (fileType === "image" && item.url) ? (
                        <img
                          src={resolveFileUrl(item.thumbnail || item.url) || ""}
                          alt={item.filename}
                          className="size-5 rounded object-cover"
                        />
                      ) : (
                        getFileIcon(fileType, 5)
                      )}
                    </div>
                    <span className="text-sm truncate" title={item.filename}>{item.filename}</span>
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
                          <img src={item.author.avatar} alt="" className="size-5 rounded-full shrink-0" />
                        ) : (
                          <div className="size-5 rounded-full bg-muted flex items-center justify-center shrink-0">
                            <span className="text-[11px] font-medium text-muted-foreground">
                              {item.author?.name?.charAt(0)?.toUpperCase() || "?"}
                            </span>
                          </div>
                        )}
                        <span className="text-xs text-muted-foreground truncate">{item.author?.name || "—"}</span>
                      </>
                    )}
                  </div>

                  <div className="col-span-3 text-xs text-muted-foreground">
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
