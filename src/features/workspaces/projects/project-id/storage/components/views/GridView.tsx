import React, { useState } from 'react';
import { Star, Folder } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { resolveFileUrl } from '@/shared/utils/url';
import { getFileType, getFileIcon, getFileColor, formatFileSize } from '@/features/workspaces/projects/project-id/storage/utils/file';
import { ItemActions, type StorageViewProps } from './ListView';

export default function GridView({
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
  
  if (items.length === 0) {
    return (
      <div className="p-16 text-center text-muted-foreground">
        <Folder className="size-16 mx-auto mb-4 opacity-20" />
        <p className="text-sm">No files or folders</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
      <AnimatePresence initial={false}>
        {items.map((item) => {
          const fileType = getFileType(item);
          return (
            <motion.div
              key={item._id}
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
              className={`group bg-card border rounded-lg overflow-hidden hover:border-border hover:bg-muted/30 transition-all cursor-pointer ${selectedItemId === item._id ? "border-border bg-muted ring-1 ring-muted-foreground/20" : "border-border/50"
                } ${dragOverFolderId === item._id ? "border-border bg-muted/80 ring-2 ring-muted-foreground/30" : ""
                }`}
              onClick={(e: React.MouseEvent) => {
                if (item.isFolder) {
                  onFolderClick?.(item);
                } else {
                  onFileClick?.(item);
                }
              }}
            >
              <div
                className={`h-32 flex items-center justify-center bg-muted/30 overflow-hidden relative`}
              >
                {item.thumbnail || (fileType === "image" && item.url) ? (
                  <img
                    src={resolveFileUrl(item.thumbnail || item.url) || ""}
                    alt={item.filename}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className={getFileColor(fileType)}>
                    {item.isFolder ? (
                      <Folder className="size-12" />
                    ) : (
                      getFileIcon(fileType, 12)
                    )}
                  </div>
                )}

                {/* Overlay actions */}
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
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="px-3 py-2.5">
                <div className="flex items-start gap-2 mb-1">
                  <h3 className="text-sm truncate flex-1" title={item.filename}>
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
                        <img src={item.author.avatar} alt="" className="size-4 rounded-full" />
                      ) : (
                        <div className="size-4 rounded-full bg-muted flex items-center justify-center">
                          <span className="text-[10px] font-medium">{item.author.name?.charAt(0)?.toUpperCase()}</span>
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
