import React, { useState, useRef, useEffect } from 'react';
import { Star, Folder, CheckSquare, Square, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { resolveFileUrl } from '@/shared/utils/url';
import { useIntersectionObserver } from '@/shared/hooks/use-intersection-observer';
import type { StorageItem } from '@/features/workspaces/storage/types/storage.types';
import { getFileType, getFileIcon, getFileColor, formatFileSize } from '../../utils/file';
import { ItemActions, type StorageViewProps } from './ListView';
import { useStorageSelectionStore } from '../../store/use-selection-store';

function GridFileIconItem({ item }: { item: StorageItem }) {
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
        className="w-full h-full object-cover"
        onError={() => setHasError(true)}
      />
    );
  }

  return (
    <div className={getFileColor(fileType)}>
      {item.isFolder ? (
        <Folder className="size-12" />
      ) : (
        getFileIcon(fileType, 12)
      )}
    </div>
  );
}

export default function GridView({
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
  hasMore,
  isFetchingNextPage,
  onLoadMore,
}: StorageViewProps) {
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const { isIntersecting } = useIntersectionObserver(sentinelRef, {
    rootMargin: '250px',
  });

  useEffect(() => {
    if (isIntersecting && hasMore && !isFetchingNextPage && onLoadMore) {
      onLoadMore();
    }
  }, [isIntersecting, hasMore, isFetchingNextPage, onLoadMore]);
  const {
    selectedIds,
    toggleSelect,
    selectRange,
  } = useStorageSelectionStore();

  const allItemIds = items.map((i) => i.id);

  if (items.length === 0) {
    return (
      <div className="p-16 text-center text-muted-foreground">
        <Folder className="size-16 mx-auto mb-4 opacity-20" />
        <p className="text-sm">No files or folders</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 select-none">
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
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
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
              className={`group bg-card border rounded-xl overflow-hidden hover:border-border hover:bg-muted/30 transition-all cursor-pointer relative ${
                isSelected
                  ? "border-primary/60 bg-accent/50 ring-2 ring-primary/40 shadow-sm"
                  : "border-border/60"
              } ${dragOverFolderId === item.id ? "border-primary bg-muted/80 ring-2 ring-primary/40" : ""}`}
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
              <div className="h-32 flex items-center justify-center bg-muted/30 overflow-hidden relative">
                {/* Selection Checkbox (top-left) */}
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
                    className={`absolute top-2 left-2 z-10 size-6 rounded-md flex items-center justify-center bg-background/80 backdrop-blur-sm transition-opacity cursor-pointer ${
                      isMultiSelected
                        ? "opacity-100 text-primary"
                        : "opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground"
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

                <GridFileIconItem item={item} />

                {/* Overlay actions (top-right) */}
                {!isReadOnly && (
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="bg-background/80 backdrop-blur-sm rounded-md">
                      <ItemActions
                        item={item}
                        onToggleStar={onToggleStar}
                        onDelete={onDelete}
                        onDownload={onDownload}
                        isTrash={isTrash}
                        onMoveToParent={onMoveToParent}
                        onOpenLocation={onOpenLocation}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="px-3 py-2.5">
                <div className="flex items-start gap-2 mb-1">
                  <h3 className="text-sm truncate flex-1 font-medium" title={item.filename}>
                    {item.filename}
                  </h3>
                  {item.starred && (
                    <Star className="size-3.5 fill-amber-400 text-amber-400 shrink-0 mt-0.5" />
                  )}
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{item.isFolder ? "Folder" : formatFileSize(item.size)}</span>
                  {item.author && (
                    <div className="flex items-center gap-1.5" title={item.author.name}>
                      {item.author.avatar ? (
                        <img
                          src={resolveFileUrl(item.author.avatar) || ""}
                          alt=""
                          className="size-4 rounded-full"
                        />
                      ) : (
                        <div className="size-4 rounded-full bg-muted flex items-center justify-center">
                          <span className="text-[10px] font-medium">
                            {item.author.name?.charAt(0)?.toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Sentinel & Load more spinner */}
      <div ref={sentinelRef} className="col-span-full py-2 flex items-center justify-center min-h-6">
        {isFetchingNextPage && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-2 animate-pulse">
            <Loader2 className="size-4 animate-spin text-primary" />
            <span>Loading more files...</span>
          </div>
        )}
      </div>
    </div>
  );
}
