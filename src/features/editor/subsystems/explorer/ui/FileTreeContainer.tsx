'use client';

import React from 'react';
import {
  FileCode2,
  Folder,
  Loader2,
  Upload,
} from 'lucide-react';
import { PlaneEmptyState } from '@/shared/components/ui/PlaneEmptyState';
import { PlaneErrorState } from '@/shared/components/ui/PlaneErrorState';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { InlineInput } from './subcomponents/FileTreePrimitives';
import { useVirtualizer } from '@tanstack/react-virtual';
import type {
  FileTreeNode,
  FileTreeFolderNode,
  FlattenedTreeNode,
} from '../model/document-tree';

const INTERNAL_DRAG_TYPES = ['application/flux-file-id', 'application/x-asset-id'] as const;

function hasInternalDragType(dataTransfer: DataTransfer): boolean {
  return INTERNAL_DRAG_TYPES.some((type) => dataTransfer.types.includes(type));
}

function getInternalDraggedFileId(dataTransfer: DataTransfer): string {
  for (const type of INTERNAL_DRAG_TYPES) {
    const val = dataTransfer.getData(type);
    if (val) return val;
  }
  return '';
}

export interface FileTreeContainerProps {
  isDragging: boolean;
  handleDragEnter: (e: React.DragEvent<HTMLDivElement>) => void;
  handleDragLeave: (e: React.DragEvent<HTMLDivElement>) => void;
  handleDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  handleDrop: (e: React.DragEvent<HTMLDivElement>) => Promise<void> | void;
  handleMoveItem: (itemId: string, targetFolderId: string | null) => void;

  isCreatingFile: boolean;
  newFileName: string;
  setNewFileName: (val: string) => void;
  handleCreateFile: () => void;
  handleCancelCreate: () => void;
  isCreateFilePending: boolean;

  isCreatingFolder: boolean;
  newFolderName: string;
  setNewFolderName: (val: string) => void;
  handleCreateFolder: () => void;
  handleCancelCreateFolder: () => void;
  isCreateFolderPending: boolean;

  isLoading: boolean;
  projectFilesLoading: boolean;
  uploadingCount: number;

  isFilesError: boolean;
  filesError: Error | null;

  treeItemsLength: number;
  displayTree: FileTreeNode[];
  fileFilter: string;
  setFileFilter: (val: string) => void;
  renderTreeNode: (node: FileTreeNode, depth?: number) => React.ReactNode;
  flattenedTree?: FlattenedTreeNode[];
  renderFlatRow?: (item: FlattenedTreeNode) => React.ReactNode;
  showTopInlineCreate?: boolean;
  activeFlatIndex?: number;
  inlineCreateFlatIndex?: number;
  isFolderExpanded?: (node: FileTreeFolderNode) => boolean;
  onToggleFolder?: (folderKey: string) => void;
}

export function FileTreeContainer({
  isDragging,
  handleDragEnter,
  handleDragLeave,
  handleDragOver,
  handleDrop,
  handleMoveItem,

  isCreatingFile,
  newFileName,
  setNewFileName,
  handleCreateFile,
  handleCancelCreate,
  isCreateFilePending,

  isCreatingFolder,
  newFolderName,
  setNewFolderName,
  handleCreateFolder,
  handleCancelCreateFolder,
  isCreateFolderPending,

  isLoading,
  projectFilesLoading,
  uploadingCount,

  isFilesError,
  filesError,

  treeItemsLength,
  displayTree,
  fileFilter,
  setFileFilter,
  renderTreeNode,
  flattenedTree,
  renderFlatRow,
  showTopInlineCreate = true,
  activeFlatIndex,
  inlineCreateFlatIndex,
  isFolderExpanded,
  onToggleFolder,
}: FileTreeContainerProps) {
  const parentRef = React.useRef<HTMLDivElement>(null);
  const isVirtualized = Boolean(flattenedTree && flattenedTree.length >= 35 && renderFlatRow);
  const lastRevealedIndexRef = React.useRef<number>(-1);
  const [focusedIndex, setFocusedIndex] = React.useState<number>(-1);

  const rowVirtualizer = useVirtualizer({
    count: flattenedTree?.length ?? 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 30,
    overscan: 8,
    enabled: isVirtualized,
  });

  // Auto-reveal newly activated file inside the virtualized viewport
  React.useEffect(() => {
    let cancelled = false;
    if (typeof activeFlatIndex === 'number' && activeFlatIndex >= 0) {
      if (activeFlatIndex !== lastRevealedIndexRef.current) {
        lastRevealedIndexRef.current = activeFlatIndex;
        if (isVirtualized) {
          const el = parentRef.current;
          if (el && el.clientHeight > 0) {
            const itemTop = activeFlatIndex * 30;
            const itemBottom = itemTop + 30;
            if (itemTop >= el.scrollTop && itemBottom <= el.scrollTop + el.clientHeight) {
              return;
            }
          }
          queueMicrotask(() => {
            if (!cancelled) {
              rowVirtualizer.scrollToIndex(activeFlatIndex, { align: 'auto' });
            }
          });
        }
      }
    } else {
      lastRevealedIndexRef.current = -1;
    }
    return () => {
      cancelled = true;
    };
  }, [activeFlatIndex, isVirtualized, rowVirtualizer]);

  // Scroll inline-create row (subfolder or top-of-tree) into view when initiated
  React.useEffect(() => {
    if (!isCreatingFile && !isCreatingFolder) return;
    let cancelled = false;
    if (typeof inlineCreateFlatIndex === 'number' && inlineCreateFlatIndex >= 0) {
      if (isVirtualized) {
        const el = parentRef.current;
        if (el && el.clientHeight > 0) {
          const itemTop = inlineCreateFlatIndex * 30;
          const itemBottom = itemTop + 30;
          if (itemTop >= el.scrollTop && itemBottom <= el.scrollTop + el.clientHeight) {
            return;
          }
        }
        queueMicrotask(() => {
          if (!cancelled) {
            rowVirtualizer.scrollToIndex(inlineCreateFlatIndex, { align: 'auto' });
          }
        });
      }
    } else if (showTopInlineCreate) {
      parentRef.current?.scrollTo?.({ top: 0, behavior: 'smooth' });
    }
    return () => {
      cancelled = true;
    };
  }, [
    isCreatingFile,
    isCreatingFolder,
    inlineCreateFlatIndex,
    showTopInlineCreate,
    isVirtualized,
    rowVirtualizer,
  ]);

  const focusRowAtIndex = React.useCallback(
    (nextIdx: number) => {
      if (!flattenedTree || flattenedTree.length === 0) return;
      const clamped = Math.max(0, Math.min(flattenedTree.length - 1, nextIdx));
      setFocusedIndex(clamped);
      if (isVirtualized) {
        rowVirtualizer.scrollToIndex(clamped, { align: 'auto' });
      }
      requestAnimationFrame(() => {
        const wrapper = parentRef.current?.querySelector<HTMLElement>(
          `[data-tree-flat-index="${clamped}"]`,
        );
        const target =
          wrapper?.querySelector<HTMLElement>('[role="button"][tabindex="0"]') ?? wrapper;
        if (target) {
          target.focus({ preventScroll: isVirtualized });
        }
      });
    },
    [flattenedTree, isVirtualized, rowVirtualizer],
  );

  const handleTreeKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!flattenedTree || flattenedTree.length === 0) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      const fallbackIdx =
        typeof activeFlatIndex === 'number' && activeFlatIndex >= 0 ? activeFlatIndex : 0;
      const currentIdx =
        focusedIndex >= 0 && focusedIndex < flattenedTree.length ? focusedIndex : fallbackIdx;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          focusRowAtIndex(currentIdx + 1);
          break;
        case 'ArrowUp':
          e.preventDefault();
          focusRowAtIndex(currentIdx - 1);
          break;
        case 'Home':
          e.preventDefault();
          focusRowAtIndex(0);
          break;
        case 'End':
          e.preventDefault();
          focusRowAtIndex(flattenedTree.length - 1);
          break;
        case 'ArrowRight': {
          const item = flattenedTree[currentIdx];
          if (item?.node.type === 'folder' && !item.inlineCreateKind) {
            e.preventDefault();
            const folderKey = item.node.fullPath || item.node.path || item.node.name;
            if (isFolderExpanded && !isFolderExpanded(item.node)) {
              onToggleFolder?.(folderKey);
            } else if (
              currentIdx + 1 < flattenedTree.length &&
              flattenedTree[currentIdx + 1].depth > item.depth
            ) {
              focusRowAtIndex(currentIdx + 1);
            }
          }
          break;
        }
        case 'ArrowLeft': {
          const item = flattenedTree[currentIdx];
          if (!item) break;
          if (item.node.type === 'folder' && !item.inlineCreateKind && isFolderExpanded?.(item.node)) {
            e.preventDefault();
            const folderKey = item.node.fullPath || item.node.path || item.node.name;
            onToggleFolder?.(folderKey);
          } else if (item.depth > 0) {
            e.preventDefault();
            for (let p = currentIdx - 1; p >= 0; p--) {
              const candidate = flattenedTree[p];
              if (candidate.node.type === 'folder' && candidate.depth === item.depth - 1) {
                focusRowAtIndex(p);
                break;
              }
            }
          }
          break;
        }
        default:
          break;
      }
    },
    [flattenedTree, activeFlatIndex, focusedIndex, focusRowAtIndex, isFolderExpanded, onToggleFolder],
  );

  return (
    <div
      ref={parentRef}
      role="tree"
      aria-label="Project files"
      onKeyDown={handleTreeKeyDown}
      className="relative min-h-0 flex-1 overflow-y-auto px-2 pt-2.5 pb-3 thin-scrollbar space-y-0.5 border-b border-border bg-surface"
      onDragEnter={(e) => {
        if (!hasInternalDragType(e.dataTransfer)) {
          handleDragEnter(e);
        }
      }}
      onDragLeave={handleDragLeave}
      onDragOver={(e) => {
        if (hasInternalDragType(e.dataTransfer)) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
        } else {
          handleDragOver(e);
        }
      }}
      onDrop={(e) => {
        const internalFileId = getInternalDraggedFileId(e.dataTransfer);
        if (internalFileId) {
          e.preventDefault();
          e.stopPropagation();
          handleMoveItem(internalFileId, null);
          return;
        }
        handleDrop(e);
      }}
    >
      {/* Drag-over overlay */}
      {isDragging && (
        <div className="absolute inset-1.5 z-10 flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-foreground/40 bg-muted/40 pointer-events-none backdrop-blur-[1px]">
          <div className="p-2 rounded-full bg-muted">
            <Upload className="size-5 text-foreground shrink-0" strokeWidth={1.5} />
          </div>
          <span className="text-12 font-medium text-foreground">Drop files to upload</span>
        </div>
      )}

      {/* ── Inline create inputs (Top-level fallback) ───────────────────── */}
      {showTopInlineCreate && isCreatingFile && (
        <InlineInput
          icon={FileCode2}
          iconColor="text-foreground"
          value={newFileName}
          onChange={setNewFileName}
          placeholder="filename.tex"
          onCommit={handleCreateFile}
          onCancel={handleCancelCreate}
          isPending={isCreateFilePending}
        />
      )}
      {showTopInlineCreate && isCreatingFolder && (
        <InlineInput
          icon={Folder}
          iconColor="text-foreground"
          value={newFolderName}
          onChange={setNewFolderName}
          placeholder="folder name"
          onCommit={handleCreateFolder}
          onCancel={handleCancelCreateFolder}
          isPending={isCreateFolderPending}
        />
      )}

      {/* Loading skeleton */}
      {(isLoading || projectFilesLoading) && (
        <div className="flex flex-col py-1 space-y-0.5">
          {[65, 80, 45, 75, 55].map((w, i) => (
            <div key={i} className="flex h-8 items-center gap-2 px-3">
              <Skeleton className="size-3.5 rounded-sm shrink-0" />
              <Skeleton className="h-3 rounded-sm" style={{ width: `${w}%` }} />
            </div>
          ))}
        </div>
      )}

      {/* Uploading indicator */}
      {uploadingCount > 0 && (
        <div className="flex h-8 items-center gap-2 px-3 text-12 text-muted-foreground select-none">
          <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none text-foreground shrink-0" />
          <span>
            Uploading {uploadingCount} file{uploadingCount > 1 ? 's' : ''}…
          </span>
        </div>
      )}

      {/* ── UNIFIED FILE TREE ITEMS ─────────────────────────────────────── */}
      {isFilesError ? (
        <div className="py-6 px-2">
          <PlaneErrorState
            isCompact
            title="Unable to load files"
            description="An issue occurred while loading project files."
            error={filesError || new Error('Failed to load project files')}
          />
        </div>
      ) : !isLoading && !projectFilesLoading && (
        <>
          {treeItemsLength > 0 && displayTree.length === 0 ? (
            <div className="py-6 px-2">
              <PlaneEmptyState
                variant="search"
                isCompact
                title="No files match"
                description={`No files found matching "${fileFilter}".`}
                action={
                  <button
                    type="button"
                    onClick={() => setFileFilter('')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-12 font-medium bg-muted hover:bg-muted/80 text-foreground transition-colors cursor-pointer"
                  >
                    Clear filter
                  </button>
                }
              />
            </div>
          ) : treeItemsLength === 0 && !isCreatingFile && !isCreatingFolder ? (
            <div className="py-6 px-2">
              <PlaneEmptyState
                variant="files"
                isCompact
                title="No files yet"
                description="Create your first document or upload files to begin editing."
              />
            </div>
          ) : isVirtualized && flattenedTree && renderFlatRow ? (
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const item = flattenedTree[virtualRow.index];
                if (!item) return null;
                return (
                  <div
                    key={item.node.id}
                    data-index={virtualRow.index}
                    data-tree-flat-index={virtualRow.index}
                    ref={rowVirtualizer.measureElement}
                    onFocusCapture={() => setFocusedIndex(virtualRow.index)}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    {renderFlatRow(item)}
                  </div>
                );
              })}
            </div>
          ) : flattenedTree && renderFlatRow ? (
            flattenedTree.map((item, idx) => (
              <div
                key={item.node.id}
                data-tree-flat-index={idx}
                onFocusCapture={() => setFocusedIndex(idx)}
              >
                {renderFlatRow(item)}
              </div>
            ))
          ) : (
            displayTree.map((node) => renderTreeNode(node, 0))
          )}
        </>
      )}
    </div>
  );
}
