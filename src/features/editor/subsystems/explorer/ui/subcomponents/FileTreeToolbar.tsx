'use client';

/**
 * FileTreeToolbar.tsx
 *
 * Overleaf-parity File Tree Header & Toolbar (Block 6: UI Features Layer).
 * Location: `features/editor/ui/features/sidebar/explorer/FileTreeToolbar.tsx`
 *
 * Layout:
 * - Header: Chevron accordion toggle + "File Tree" title.
 * - Actions: New File, New Folder, Upload File.
 * - Colors: bg-surface, text-foreground (100% design system & Overleaf alignment).
 */

import React, { useState, useEffect } from 'react';
import {
  ChevronRight,
  FilePlus,
  FolderPlus,
  Upload,
  Trash2,
  Search,
  RefreshCw,
  X,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import { cn } from '@/shared/lib/utils';

export interface FileTreeToolbarProps {
  isFileTreeOpen: boolean;
  onToggleFileTree: () => void;
  onOpenFileModal: () => void;
  onStartCreateFolder: () => void;
  onOpenUploadModal: () => void;
  onOpenDeletedFilesModal?: () => void;
  deletedFilesCount?: number;
  linkedFilesCount?: number;
  onRefreshAllLinkedFiles?: () => void;
  fileFilter?: string;
  onFileFilterChange?: (val: string) => void;
  onClose?: () => void;
}

export const FileTreeToolbar = React.memo(function FileTreeToolbar({
  isFileTreeOpen,
  onToggleFileTree,
  onOpenFileModal,
  onStartCreateFolder,
  onOpenUploadModal,
  onOpenDeletedFilesModal,
  deletedFilesCount = 0,
  linkedFilesCount = 0,
  onRefreshAllLinkedFiles,
  fileFilter = '',
  onFileFilterChange,
}: FileTreeToolbarProps) {
  const [isSearchActive, setIsSearchActive] = useState(Boolean(fileFilter));

  useEffect(() => {
    if (fileFilter) setIsSearchActive(true);
  }, [fileFilter]);

  return (
    <div className="flex flex-col shrink-0 select-none border-b border-border">
      {/* ── Top Bar ── */}
      <div className="flex h-9 shrink-0 items-center justify-between px-3">
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onToggleFileTree}
              aria-expanded={isFileTreeOpen}
              className="flex items-center gap-1.5 font-semibold text-13 tracking-tight text-foreground hover:text-foreground/80 cursor-pointer select-none outline-none focus-visible:ring-1 focus-visible:ring-foreground rounded-sm py-0.5 motion-reduce:transition-none"
              aria-label={isFileTreeOpen ? 'Collapse File Tree' : 'Expand File Tree'}
            >
              <ChevronRight
                className={cn(
                  'size-3.5 shrink-0 transition-transform duration-150 text-foreground motion-reduce:transition-none',
                  isFileTreeOpen && 'rotate-90',
                )}
                strokeWidth={1.75}
              />
              <span>File Tree</span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-11">
            {isFileTreeOpen ? 'Collapse file tree' : 'Expand file tree'}
          </TooltipContent>
        </Tooltip>

        <div className="flex items-center gap-0.5">
          {isFileTreeOpen && (
            <>
              {/* 1. New File */}
              <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={onOpenFileModal}
                    aria-label="New File"
                    className="relative flex size-7 items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-foreground motion-reduce:transition-none after:absolute after:-inset-1 after:content-['']"
                  >
                    <FilePlus className="size-4 shrink-0" strokeWidth={1.5} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-11">New file</TooltipContent>
              </Tooltip>

              {/* 2. New Folder */}
              <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={onStartCreateFolder}
                    aria-label="New Folder"
                    className="relative flex size-7 items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-foreground motion-reduce:transition-none after:absolute after:-inset-1 after:content-['']"
                  >
                    <FolderPlus className="size-4 shrink-0" strokeWidth={1.5} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-11">New folder</TooltipContent>
              </Tooltip>

              {/* 3. Upload File */}
              <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={onOpenUploadModal}
                    aria-label="Upload files"
                    className="relative flex size-7 items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-foreground motion-reduce:transition-none after:absolute after:-inset-1 after:content-['']"
                  >
                    <Upload className="size-4 shrink-0" strokeWidth={1.5} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-11">Upload files</TooltipContent>
              </Tooltip>

              {/* 3b. Refresh All Linked Files */}
              {onRefreshAllLinkedFiles && linkedFilesCount > 0 && (
                <Tooltip delayDuration={300}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={onRefreshAllLinkedFiles}
                      aria-label="Refresh linked files"
                      className="relative flex size-7 items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-foreground motion-reduce:transition-none after:absolute after:-inset-1 after:content-['']"
                    >
                      <RefreshCw className="size-3.5 shrink-0" strokeWidth={1.5} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-11">
                    Refresh all linked files ({linkedFilesCount})
                  </TooltipContent>
                </Tooltip>
              )}

              {/* 4. Deleted Files (Trash) - Overleaf Parity */}
              {onOpenDeletedFilesModal && (
                <Tooltip delayDuration={300}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={onOpenDeletedFilesModal}
                      aria-label="Deleted files"
                      className="relative flex size-7 items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-foreground motion-reduce:transition-none after:absolute after:-inset-1 after:content-['']"
                    >
                      <Trash2 className="size-4 shrink-0" strokeWidth={1.5} />
                      {deletedFilesCount > 0 && (
                        <span className="absolute -top-1 -right-1 flex min-w-4 h-4 px-1 items-center justify-center rounded-full bg-muted-foreground/30 text-11 font-mono text-foreground font-semibold leading-none">
                          {deletedFilesCount > 9 ? '9+' : deletedFilesCount}
                        </span>
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-11">
                    {deletedFilesCount > 0
                      ? `Deleted files (${deletedFilesCount})`
                      : 'Deleted files'}
                  </TooltipContent>
                </Tooltip>
              )}

              {/* 5. Filter Files Toggle */}
              {onFileFilterChange && (
                <Tooltip delayDuration={300}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => {
                        setIsSearchActive((prev) => {
                          if (prev && fileFilter) {
                            onFileFilterChange('');
                          }
                          return !prev;
                        });
                      }}
                      aria-label="Filter files"
                      className={cn(
                        "flex size-7 items-center justify-center rounded-md transition-colors hover:bg-muted cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-foreground motion-reduce:transition-none",
                        isSearchActive ? "text-primary bg-primary/10" : "text-foreground"
                      )}
                    >
                      <Search className="size-3.5 shrink-0" strokeWidth={1.5} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-11">Filter files</TooltipContent>
                </Tooltip>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Search Input (when search is toggled open) ── */}
      {isFileTreeOpen && isSearchActive && onFileFilterChange && (
        <div className="px-2.5 pb-2 pt-0.5 flex items-center gap-1.5">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={fileFilter}
              onChange={(e) => onFileFilterChange(e.target.value)}
              placeholder="Filter files..."
              className="w-full h-6 pl-6 pr-5 text-11 rounded border border-border bg-background text-foreground placeholder:text-muted-foreground outline-none focus:border-primary font-sans"
              autoFocus
            />
            {fileFilter && (
              <button
                type="button"
                onClick={() => onFileFilterChange('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                aria-label="Clear filter"
              >
                <X className="size-3" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

export default FileTreeToolbar;
