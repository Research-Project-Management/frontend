'use client';

import React from 'react';
import {
  ChevronRight,
  FilePlus,
  FolderPlus,
  Search,
  Trash2,
  Upload,
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
  onOpenDeletedFilesModal: () => void;
  deletedFilesCount: number;
  fileFilter: string;
  onFileFilterChange: (val: string) => void;
}

export const FileTreeToolbar = React.memo(function FileTreeToolbar({
  isFileTreeOpen,
  onToggleFileTree,
  onOpenFileModal,
  onStartCreateFolder,
  onOpenUploadModal,
  onOpenDeletedFilesModal,
  deletedFilesCount,
  fileFilter,
  onFileFilterChange,
}: FileTreeToolbarProps) {
  return (
    <>
      {/* ── Header toolbar: Matching Library & Sticky Design System ── */}
      <div
        className={cn(
          'flex h-9 shrink-0 items-center justify-between px-2 bg-transparent select-none',
        )}
      >
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onToggleFileTree}
              aria-expanded={isFileTreeOpen}
              className="flex items-center gap-1.5 font-semibold text-13 tracking-tight text-foreground hover:text-foreground/80 cursor-pointer select-none outline-none focus-visible:ring-1 focus-visible:ring-foreground rounded-sm py-0.5"
              aria-label={isFileTreeOpen ? 'Collapse files' : 'Expand files'}
            >
              <ChevronRight
                className={cn(
                  'size-3.5 shrink-0 transition-transform duration-150 text-foreground',
                  isFileTreeOpen && 'rotate-90',
                )}
                strokeWidth={1.75}
              />
              <span>Files</span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-11">
            {isFileTreeOpen ? 'Collapse' : 'Expand'}
          </TooltipContent>
        </Tooltip>

        {isFileTreeOpen && (
          <div className="flex items-center gap-0.5">
            {/* 1. New File */}
            <Tooltip delayDuration={300}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onOpenFileModal}
                  aria-label="New File"
                  className="flex size-7 items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-foreground"
                >
                  <FilePlus className="size-4 shrink-0 text-foreground" strokeWidth={1.5} />
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
                  className="flex size-7 items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-foreground"
                >
                  <FolderPlus className="size-4 shrink-0 text-foreground" strokeWidth={1.5} />
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
                  className="flex size-7 items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-foreground"
                >
                  <Upload className="size-4 shrink-0 text-foreground" strokeWidth={1.5} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-11">Upload files</TooltipContent>
            </Tooltip>

            {/* 4. Trash / Deleted Files */}
            <Tooltip delayDuration={300}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onOpenDeletedFilesModal}
                  aria-label="Trash / Deleted Files"
                  className="relative flex size-7 items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-foreground"
                >
                  <Trash2 className="size-4 shrink-0 text-foreground" strokeWidth={1.5} />
                  {deletedFilesCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex min-w-3.5 h-3.5 px-1 items-center justify-center rounded-full bg-foreground text-11 font-mono font-semibold text-background leading-none">
                      {deletedFilesCount > 9 ? '9+' : deletedFilesCount}
                    </span>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-11">
                Trash ({deletedFilesCount} deleted)
              </TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>

      {/* ── Search Bar: Full width precision ── */}
      {isFileTreeOpen && (
        <div className="px-2 pt-0.5 pb-2 shrink-0 bg-transparent select-none">
          <div className="relative flex items-center w-full h-8 rounded-md border border-border bg-background hover:border-foreground/30 focus-within:border-foreground transition-colors">
            <Search
              className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none shrink-0"
              strokeWidth={1.5}
            />
            <input
              id="editor-file-filter-input"
              name="fileFilter"
              type="text"
              value={fileFilter}
              onChange={(e) => onFileFilterChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  onFileFilterChange('');
                  (e.target as HTMLInputElement).blur();
                }
              }}
              placeholder="Search files..."
              aria-label="Search files"
              className="h-full w-full pl-8.5 pr-7 text-12 font-sans text-foreground placeholder:text-muted-foreground bg-transparent border-none outline-none leading-none shadow-none"
            />
            {fileFilter && (
              <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => onFileFilterChange('')}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 size-5 flex items-center justify-center text-foreground hover:text-foreground/80 cursor-pointer rounded p-0.5 transition-colors after:absolute after:-inset-1.5 after:content-['']"
                    aria-label="Clear filter"
                  >
                    <X className="size-3.5 shrink-0 text-foreground" strokeWidth={1.5} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-11">
                  Clear
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      )}
    </>
  );
});
