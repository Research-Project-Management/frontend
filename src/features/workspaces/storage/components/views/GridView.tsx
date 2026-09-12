'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Star, Folder, CheckSquare, Square, Loader2, Upload, FolderPlus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { resolveFileUrl } from "@/shared/lib/file-client";
import { useInfiniteSentinel } from '../../hooks/use-infinite-sentinel';
import { Button } from "@/shared/components/ui";
import type { StorageItem } from '@/features/workspaces/storage/types/storage.types';
import { getFileType, getFileIcon, getFileColor, formatFileSize } from '../../utils/file';
import { ItemActions, type StorageViewProps } from './ListView';
import { useStorageSelectionStore } from '../../store/use-selection-store';
import { createFolderDropHandlers } from '../../utils/drag-drop.util';

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
        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        onError={() => setHasError(true)}
      />
    );
  }

  return (
    <div className={`transition-transform duration-300 group-hover:scale-110 ${getFileColor(fileType)}`}>
      {getFileIcon(fileType, 12)}
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
  const sentinelRef = useInfiniteSentinel({ hasMore, isFetchingNextPage, onLoadMore });

  const {
    selectedIds,
    toggleSelect,
    selectRange,
  } = useStorageSelectionStore();

  const allItemIds = items.map((i) => i.id);

  const folders = items.filter((i) => i.isFolder);
  const files = items.filter((i) => !i.isFolder);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 sm:p-16 text-center rounded-md border border-dashed border-border bg-muted my-4">
        <div className="size-12 rounded-md bg-background border border-border flex items-center justify-center text-muted-foreground mb-4">
          <Folder className="size-6 stroke-[1.5] shrink-0" />
        </div>
        <h3 className="text-base font-semibold text-foreground tracking-tight mb-1">
          No files or folders yet
        </h3>
        <p className="text-sm text-muted-foreground max-w-sm mb-6">
          Drag and drop files here, or use the buttons below to get started.
        </p>

        {!isReadOnly && !isTrash && (
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              onClick={() => {
                const event = new CustomEvent('trigger-upload-file');
                window.dispatchEvent(event);
              }}
              className="gap-1.5 rounded-md"
            >
              <Upload className="size-3.5 shrink-0" />
              <span>Upload file</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const event = new CustomEvent('open-create-folder');
                window.dispatchEvent(event);
              }}
              className="gap-1.5 rounded-md hover:bg-muted"
            >
              <FolderPlus className="size-3.5 shrink-0" />
              <span>New folder</span>
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 select-none pb-6">
      {/* â”€â”€ FOLDERS SECTION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {folders.length > 0 && (
        <div className="space-y-2.5">
          {files.length > 0 && (
            <div className="flex items-center gap-2 px-1">
              <span className="text-xs font-semibold tracking-normal text-muted-foreground">
                Folders ({folders.length})
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            <AnimatePresence initial={false}>
              {folders.map((folder) => {
                const isMultiSelected = selectedIds.includes(folder.id);
                const isSingleSelected = selectedItemId === folder.id || highlightedItemId === folder.id;
                const isSelected = isMultiSelected || isSingleSelected;

                return (
                  <motion.div
                    key={folder.id}
                    id={`storage-item-${folder.id}`}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
                    transition={{ duration: 0.2 }}
                    {...createFolderDropHandlers(folder, isReadOnly, onDropOnFolder, setDragOverFolderId)}
                    onClick={(e: React.MouseEvent) => {
                      if (!isReadOnly && (e.shiftKey || e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        if (e.shiftKey) {
                          selectRange(allItemIds, folder.id);
                        } else {
                          toggleSelect(folder.id);
                        }
                        return;
                      }
                      onFolderClick?.(folder);
                    }}
                    className={`group flex items-center justify-between p-3 rounded-md border bg-card hover:bg-muted hover:border-border transition-colors cursor-pointer relative ${
                      isSelected
                        ? "border-primary bg-muted ring-1 ring-primary"
                        : "border-border"
                    } ${dragOverFolderId === folder.id ? "border-primary bg-muted ring-1 ring-primary" : ""}`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {/* Checkbox */}
                      {!isReadOnly && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (e.shiftKey) {
                              selectRange(allItemIds, folder.id);
                            } else {
                              toggleSelect(folder.id);
                            }
                          }}
                          className={`size-5 rounded flex items-center justify-center transition-opacity cursor-pointer shrink-0 ${
                            isMultiSelected
                              ? "opacity-100 text-primary"
                              : "opacity-0 group-hover:opacity-60 hover:opacity-100 text-muted-foreground"
                          }`}
                          title={isMultiSelected ? "Deselect" : "Select"}
                        >
                          {isMultiSelected ? (
                            <CheckSquare className="size-4 text-primary shrink-0" />
                          ) : (
                            <Square className="size-4 shrink-0" />
                          )}
                        </button>
                      )}

                      <div className="size-8 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                        <Folder className="size-4.5 fill-current shrink-0" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-foreground truncate" title={folder.filename}>
                            {folder.filename}
                          </span>
                          {folder.starred && (
                            <Star className="size-3 fill-amber-400 text-amber-400 shrink-0" />
                          )}
                        </div>
                      </div>
                    </div>

                    {!isReadOnly && (
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity ml-1">
                        <ItemActions
                          item={folder}
                          onToggleStar={onToggleStar}
                          onDelete={onDelete}
                          onDownload={onDownload}
                          isTrash={isTrash}
                          onMoveToParent={onMoveToParent}
                          onOpenLocation={onOpenLocation}
                        />
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* â”€â”€ FILES SECTION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {files.length > 0 && (
        <div className="space-y-2.5">
          {folders.length > 0 && (
            <div className="flex items-center gap-2 px-1 pt-2">
              <span className="text-xs font-semibold tracking-normal text-muted-foreground">
                Files ({files.length})
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            <AnimatePresence initial={false}>
              {files.map((file) => {
                const isMultiSelected = selectedIds.includes(file.id);
                const isSingleSelected = selectedItemId === file.id || highlightedItemId === file.id;
                const isSelected = isMultiSelected || isSingleSelected;

                return (
                  <motion.div
                    key={file.id}
                    id={`storage-item-${file.id}`}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
                    transition={{ duration: 0.2 }}
                    draggable={!isReadOnly && !!onDragStartFile}
                    onDragStart={(e: any) => {
                      if (!isReadOnly && onDragStartFile) {
                        onDragStartFile(file, e);
                      }
                    }}
                    className={`group bg-card border rounded-md overflow-hidden hover:border-border hover:bg-muted transition-colors cursor-pointer relative flex flex-col ${
                      isSelected
                        ? "border-primary bg-muted ring-1 ring-primary"
                        : "border-border"
                    }`}
                    onClick={(e: React.MouseEvent) => {
                      if (!isReadOnly && (e.shiftKey || e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        if (e.shiftKey) {
                          selectRange(allItemIds, file.id);
                        } else {
                          toggleSelect(file.id);
                        }
                        return;
                      }
                      onFileClick?.(file);
                    }}
                  >
                    {/* Thumbnail Area */}
                    <div className="h-32 flex items-center justify-center bg-muted overflow-hidden relative border-b border-border">
                      {/* Selection Checkbox (top-left) */}
                      {!isReadOnly && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (e.shiftKey) {
                              selectRange(allItemIds, file.id);
                            } else {
                              toggleSelect(file.id);
                            }
                          }}
                          className={`absolute top-2 left-2 z-10 size-6 rounded-md flex items-center justify-center bg-background/80 backdrop-blur-sm transition-opacity cursor-pointer ${
                            isMultiSelected
                              ? "opacity-100 text-primary"
                              : "opacity-0 group-hover:opacity-100 text-foreground"
                          }`}
                          title={isMultiSelected ? "Deselect" : "Select"}
                        >
                          {isMultiSelected ? (
                            <CheckSquare className="size-4 text-primary shrink-0" />
                          ) : (
                            <Square className="size-4 shrink-0" />
                          )}
                        </button>
                      )}

                      <GridFileIconItem item={file} />

                      {/* Overlay actions (top-right) */}
                      {!isReadOnly && (
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                          <div className="bg-background/80 backdrop-blur-sm rounded-md">
                            <ItemActions
                              item={file}
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

                    {/* Metadata Footer */}
                    <div className="p-3 flex-1 flex flex-col justify-between">
                      <div className="flex items-start gap-1.5 mb-1.5">
                        <h4 className="text-xs sm:text-sm font-medium text-foreground truncate flex-1" title={file.filename}>
                          {file.filename}
                        </h4>
                        {file.starred && (
                          <Star className="size-3.5 fill-amber-400 text-amber-400 shrink-0 mt-0.5" />
                        )}
                      </div>

                      <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/20">
                        <span className="text-11 font-medium">{formatFileSize(file.size)}</span>
                        {file.author && (
                          <div className="flex items-center gap-1" title={file.author.name}>
                            {file.author.avatar ? (
                              <img
                                src={resolveFileUrl(file.author.avatar) || ""}
                                alt=""
                                className="size-4 rounded-full object-cover"
                              />
                            ) : (
                              <div className="size-4 rounded-full bg-muted flex items-center justify-center">
                                <span className="text-9 font-medium">
                                  {file.author.name?.charAt(0)?.toUpperCase()}
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
          </div>
        </div>
      )}

      {/* Sentinel & Load more spinner */}
      <div ref={sentinelRef} className="col-span-full py-2 flex items-center justify-center min-h-6">
        {isFetchingNextPage && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-2 animate-pulse">
            <Loader2 className="size-4 animate-spin text-primary shrink-0" />
            <span>Loading more files...</span>
          </div>
        )}
      </div>
    </div>
  );
}
