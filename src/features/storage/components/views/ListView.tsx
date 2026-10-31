import React, { useState, useMemo } from 'react';
import {
  Star,
  Folder,
  Loader2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { resolveFileUrl } from '@/shared/lib/file-client';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { useInfiniteSentinel } from '../../hooks/use-storage';
import type { StorageItem, StorageViewProps } from '@/features/storage/types/storage.types';
import { useStorageSelectionStore } from '@/features/storage/store/storage-ui.store';
import {
  getFileType,
  getFileIcon,
  formatFileSize,
  formatDate,
  createFolderDropHandlers,
} from '../../utils/storage.util';
import { ItemActions } from './StorageItemActions';

export type { StorageViewProps };
export { ItemActions };

const FileIconItem = React.memo(function FileIconItem({ item }: { item: StorageItem }) {
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
        className="size-4 rounded object-cover shrink-0"
        onError={() => setHasError(true)}
      />
    );
  }

  return (
    <div className="flex items-center justify-center shrink-0">
      {item.isFolder ? (
        <Folder className="size-4 shrink-0 text-foreground" strokeWidth={1.5} />
      ) : (
        getFileIcon(fileType, 4)
      )}
    </div>
  );
});

export const ListView = React.memo(function ListView({
  items,
  onToggleStar,
  onDelete,
  onRestore,
  onDownload,
  onFolderClick,
  onFileClick,
  isTrash,
  selectedItemId,
  highlightedItemId,
  onDropOnFolder,
  onDragStartFile,
  onOpenLocation,
  isReadOnly,
  hasMore,
  isFetchingNextPage,
  onLoadMore,
}: StorageViewProps) {
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const sentinelRef = useInfiniteSentinel({ hasMore, isFetchingNextPage, onLoadMore });

  const selectedIds = useStorageSelectionStore((s) => s.selectedIds);
  const toggleSelect = useStorageSelectionStore((s) => s.toggleSelect);
  const selectRange = useStorageSelectionStore((s) => s.selectRange);
  const selectAll = useStorageSelectionStore((s) => s.selectAll);
  const clearSelection = useStorageSelectionStore((s) => s.clearSelection);
  const isAllSelected = useStorageSelectionStore((s) => s.isAllSelected);

  const allItemIds = useMemo(() => items.map((i) => i.id), [items]);
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
    <div className="w-full overflow-hidden select-none">
      {/* Desktop Header */}
      <div className="hidden md:grid grid-cols-12 gap-3 pl-1.5 pr-3 h-8 items-center type-dense font-medium text-foreground border-b border-border select-none">
        <div className="col-span-5 flex items-center gap-1.5 min-w-0">
          {!isReadOnly && (
            <div
              role="button"
              tabIndex={0}
              onClick={handleHeaderCheckboxClick}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault();
                  handleHeaderCheckboxClick(e as unknown as React.MouseEvent);
                }
              }}
              className="flex items-center justify-center shrink-0 cursor-pointer rounded-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
              title={allSelected ? 'Deselect all' : 'Select all'}
            >
              <Checkbox
                checked={allSelected ? true : hasSomeSelected ? 'indeterminate' : false}
                tabIndex={-1}
                aria-hidden="true"
                className="size-3.5 border-border data-[state=checked]:border-primary data-[state=indeterminate]:border-primary pointer-events-none"
              />
            </div>
          )}
          <span className="text-12 font-medium">Name</span>
        </div>
        <div className="col-span-2 text-12 font-medium">Owner</div>
        <div className="col-span-2 text-12 font-medium">Last modified</div>
        <div className="col-span-1 text-12 font-medium">Size</div>
        <div className="col-span-2"></div>
      </div>

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
                draggable={!isReadOnly && !isTrash && !item.isFolder && !!onDragStartFile}
                onDragStart={(e: unknown) => {
                  if (!isReadOnly && !isTrash && !item.isFolder && onDragStartFile) {
                    onDragStartFile(item, e as React.DragEvent);
                  }
                }}
                {...createFolderDropHandlers(item, isReadOnly || isTrash, onDropOnFolder, setDragOverFolderId)}
                className={`hover:bg-muted cursor-pointer group transition-colors select-none ${
                  isSelected ? 'bg-primary/10 font-medium text-foreground' : ''
                } ${dragOverFolderId === item.id ? 'bg-muted ring-1 ring-muted-foreground/30' : ''}`}
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
                {/* Desktop 12-column grid layout */}
                <div className="hidden md:grid grid-cols-12 gap-3 items-center pl-1.5 pr-3 h-8">
                  <div className="col-span-5 flex items-center gap-1.5 min-w-0 overflow-hidden">
                    {!isReadOnly && (
                      <div
                        role="checkbox"
                        aria-checked={isSelected}
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (e.shiftKey) {
                            selectRange(allItemIds, item.id);
                          } else {
                            toggleSelect(item.id);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === ' ' || e.key === 'Enter') {
                            e.preventDefault();
                            e.stopPropagation();
                            toggleSelect(item.id);
                          }
                        }}
                        className="flex items-center justify-center shrink-0 cursor-pointer rounded-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                      >
                        <Checkbox
                          checked={isMultiSelected}
                          tabIndex={-1}
                          aria-hidden="true"
                          className={`size-3.5 border-border data-[state=checked]:border-primary transition-opacity duration-150 pointer-events-none ${
                            !isMultiSelected ? 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100' : ''
                          }`}
                        />
                      </div>
                    )}

                    <FileIconItem item={item} />
                    <span className="text-13 truncate font-normal text-foreground" title={item.filename}>
                      {item.filename}
                    </span>
                    {item.starred && (
                      <Star className="size-3.5 fill-warning text-warning shrink-0" />
                    )}
                  </div>

                  <div className="col-span-2 flex items-center gap-2 min-w-0 overflow-hidden">
                    {item.isFolder ? (
                      <span className="text-xs text-muted-foreground">-</span>
                    ) : (
                      <>
                        {item.author?.avatar ? (
                          <img
                            src={resolveFileUrl(item.author.avatar) || ''}
                            alt=""
                            className="size-4 rounded-full shrink-0 object-cover"
                          />
                        ) : (
                          <div className="size-4 rounded-full bg-muted flex items-center justify-center shrink-0">
                            <span className="text-[10px] font-medium text-muted-foreground">
                              {item.author?.name?.charAt(0)?.toUpperCase() || '?'}
                            </span>
                          </div>
                        )}
                        <span className="text-xs text-muted-foreground truncate">
                          {item.author?.name || '-'}
                        </span>
                      </>
                    )}
                  </div>

                  <div className="col-span-2 text-xs text-muted-foreground">
                    {formatDate(item.updatedAt)}
                  </div>

                  <div className="col-span-1 text-xs text-muted-foreground">
                    {item.isFolder ? '-' : formatFileSize(item.size)}
                  </div>

                  <div className="col-span-2 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                    {!isReadOnly && (
                      <ItemActions
                        item={item}
                        onToggleStar={onToggleStar}
                        onDelete={onDelete}
                        onRestore={onRestore}
                        onDownload={onDownload}
                        isTrash={isTrash}
                        onOpenLocation={onOpenLocation}
                      />
                    )}
                  </div>
                </div>

                {/* Mobile High-Density List Item Card */}
                <div className="flex md:hidden items-center justify-between pl-1.5 pr-3 py-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {!isReadOnly && (
                      <div
                        role="checkbox"
                        aria-checked={isMultiSelected}
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelect(item.id);
                        }}
                        className="flex items-center justify-center shrink-0 cursor-pointer rounded-xs"
                      >
                        <Checkbox
                          checked={isMultiSelected}
                          tabIndex={-1}
                          aria-hidden="true"
                          className="size-3.5 border-border data-[state=checked]:border-primary pointer-events-none"
                        />
                      </div>
                    )}

                    <div className="size-7 rounded bg-muted/60 flex items-center justify-center shrink-0">
                      <FileIconItem item={item} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs sm:text-sm font-medium text-foreground truncate" title={item.filename}>
                          {item.filename}
                        </span>
                        {item.starred && (
                          <Star className="size-3 fill-warning text-warning shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-11 text-muted-foreground mt-0.5">
                        <span>{item.isFolder ? 'Folder' : formatFileSize(item.size)}</span>
                        <span>•</span>
                        <span>{formatDate(item.updatedAt)}</span>
                        {item.author?.name && (
                          <>
                            <span>•</span>
                            <span className="truncate max-w-[80px]">{item.author.name}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    {!isReadOnly && (
                      <ItemActions
                        item={item}
                        onToggleStar={onToggleStar}
                        onDelete={onDelete}
                        onRestore={onRestore}
                        onDownload={onDownload}
                        isTrash={isTrash}
                        onOpenLocation={onOpenLocation}
                        alwaysVisible
                      />
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        <div ref={sentinelRef} className="py-2 flex items-center justify-center min-h-6">
          {isFetchingNextPage && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-2 animate-pulse">
              <Loader2 className="size-4 animate-spin text-primary shrink-0" />
              <span>Loading more files...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default ListView;
