'use client';

/**
 * FileTreeToolbar.tsx
 *
 * Overleaf-parity File Tree Header & Toolbar (Block 6: UI Features Layer).
 * Location: `features/editor/subsystems/explorer/ui/subcomponents/FileTreeToolbar.tsx`
 *
 * Layout:
 * - Header: Chevron accordion toggle + "File Tree" title.
 * - Actions: New File, New Folder, Upload File.
 * - Colors: bg-surface, text-foreground (100% design system & Overleaf alignment).
 */

import React from 'react';
import {
  ChevronRight,
  FilePlus,
  FolderPlus,
  Upload,
  Search,
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
  onClose?: () => void;
  fileFilter?: string;
  onFileFilterChange?: (val: string) => void;
}

export const FileTreeToolbar = React.memo(function FileTreeToolbar({
  isFileTreeOpen,
  onToggleFileTree,
  onOpenFileModal,
  onStartCreateFolder,
  onOpenUploadModal,
  fileFilter,
  onFileFilterChange,
}: FileTreeToolbarProps) {
  const [isFilterOpen, setIsFilterOpen] = React.useState(false);
  const filterInputRef = React.useRef<HTMLInputElement>(null);
  const showFilterInput =
    isFileTreeOpen && Boolean(onFileFilterChange) && (isFilterOpen || Boolean(fileFilter));

  const handleToggleFilter = () => {
    if (!onFileFilterChange) return;
    if (showFilterInput) {
      if (fileFilter) onFileFilterChange('');
      setIsFilterOpen(false);
    } else {
      setIsFilterOpen(true);
      requestAnimationFrame(() => {
        filterInputRef.current?.focus();
      });
    }
  };

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
                    onClick={() => onStartCreateFolder()}
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

              {/* 4. Filter Files */}
              {onFileFilterChange && (
                <Tooltip delayDuration={300}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={handleToggleFilter}
                      aria-label="Filter files"
                      aria-pressed={showFilterInput}
                      className={cn(
                        "relative flex size-7 items-center justify-center rounded-md transition-colors hover:bg-muted cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-foreground motion-reduce:transition-none after:absolute after:-inset-1 after:content-['']",
                        showFilterInput ? 'bg-muted text-foreground' : 'text-foreground',
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

      {showFilterInput && (
        <div className="px-2.5 pb-2 pt-0.5">
          <div className="relative flex items-center">
            <Search
              className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none"
              strokeWidth={1.5}
            />
            <input
              ref={filterInputRef}
              type="text"
              value={fileFilter ?? ''}
              onChange={(e) => onFileFilterChange?.(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  onFileFilterChange?.('');
                  setIsFilterOpen(false);
                }
              }}
              aria-label="Filter files by name"
              placeholder="Filter files..."
              className="h-7 w-full rounded-md border border-border bg-background pl-7 pr-6 text-12 text-foreground placeholder:text-muted-foreground outline-none focus-visible:ring-1 focus-visible:ring-foreground"
            />
            {Boolean(fileFilter) && (
              <button
                type="button"
                aria-label="Clear file filter"
                onClick={() => {
                  onFileFilterChange?.('');
                  filterInputRef.current?.focus();
                }}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-muted-foreground hover:text-foreground cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-foreground"
              >
                <X className="size-3 shrink-0" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

export default FileTreeToolbar;
