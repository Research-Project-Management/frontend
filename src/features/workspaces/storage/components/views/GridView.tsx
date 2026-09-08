'use client';

import React from 'react';
import { Star, Folder, CheckSquare, Square } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { resolveFileUrl } from '@/shared/utils/url';
import { formatFileSize } from '../../utils/file';
import { ItemActions, type StorageViewProps } from './ListView';
import { useStorageItemEvents } from './use-storage-item-events';
import { StorageFileIcon } from './StorageFileIcon';

export default function GridView(props: StorageViewProps) {
  const {
    items,
    onToggleStar,
    onDelete,
    onRestore,
    onDownload,
    isTrash,
    onMoveToParent,
    onOpenLocation,
    isReadOnly,
  } = props;

  const {
    handleCheckboxClick,
    handleItemClick,
    getItemSelectionState,
    getItemDragProps,
  } = useStorageItemEvents(props);

  if (items.length === 0) {
    return (
      <div className="p-16 text-center text-muted-foreground">
        <Folder className="size-16 mx-auto mb-4 opacity-20 shrink-0" />
        <p className="text-sm">No files or folders</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 select-none">
      <AnimatePresence initial={false}>
        {items.map((item) => {
          const { isMultiSelected, isSelected, isDragOver } = getItemSelectionState(item);
          const dragProps = getItemDragProps(item);

          return (
            <motion.div
              key={item.id}
              id={`storage-item-${item.id}`}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
              transition={{ duration: 0.2 }}
              {...dragProps}
              className={`group bg-card border rounded-md overflow-hidden hover:border-border hover:bg-muted transition-all cursor-pointer relative ${
                isSelected
                  ? 'border-primary/60 bg-muted ring-2 ring-primary/40 '
                  : 'border-border'
              } ${isDragOver ? 'border-primary bg-muted ring-2 ring-primary/40' : ''}`}
              onClick={(e) => handleItemClick(e, item)}
            >
              <div className="h-32 flex items-center justify-center bg-muted overflow-hidden relative">
                {/* Selection Checkbox (top-left) */}
                {!isReadOnly && (
                  <button
                    onClick={(e) => handleCheckboxClick(e, item.id)}
                    className={`absolute top-2 left-2 z-10 size-6 rounded-md flex items-center justify-center bg-background/80 backdrop-blur-sm transition-opacity cursor-pointer ${
                      isMultiSelected
                        ? 'opacity-100 text-primary'
                        : 'opacity-0 group-hover:opacity-100 text-foreground'
                    }`}
                    title={isMultiSelected ? 'Deselect' : 'Select'}
                  >
                    {isMultiSelected ? (
                      <CheckSquare className="size-4 text-primary shrink-0" />
                    ) : (
                      <Square className="size-4 shrink-0" />
                    )}
                  </button>
                )}

                <StorageFileIcon item={item} variant="grid" />

                {/* Overlay actions (top-right) */}
                {!isReadOnly && (
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="bg-background/80 backdrop-blur-sm rounded-md">
                      <ItemActions
                        item={item}
                        onToggleStar={onToggleStar}
                        onDelete={onDelete}
                        onRestore={onRestore}
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
                    <Star className="size-3.5 fill-warning text-warning shrink-0 mt-0.5" />
                  )}
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{item.isFolder ? 'Folder' : formatFileSize(item.size)}</span>
                  {item.author && (
                    <div className="flex items-center gap-1.5" title={item.author.name}>
                      {item.author.avatar ? (
                        <img
                          src={resolveFileUrl(item.author.avatar) || ''}
                          alt=""
                          className="size-4 rounded-full"
                        />
                      ) : (
                        <div className="size-4 rounded-full bg-muted flex items-center justify-center">
                          <span className="text-xs font-medium">
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
    </div>
  );
}
