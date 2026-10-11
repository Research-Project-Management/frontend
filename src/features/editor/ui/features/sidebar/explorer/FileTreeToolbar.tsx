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

import React from 'react';
import {
  ChevronRight,
  FilePlus,
  FolderPlus,
  Upload,
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
}: FileTreeToolbarProps) {
  return (
    <div className="flex flex-col shrink-0 select-none border-b border-border bg-surface">
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
                    className="flex size-7 items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-foreground motion-reduce:transition-none"
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
                    className="flex size-7 items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-foreground motion-reduce:transition-none"
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
                    className="flex size-7 items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-foreground motion-reduce:transition-none"
                  >
                    <Upload className="size-4 shrink-0" strokeWidth={1.5} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-11">Upload files</TooltipContent>
              </Tooltip>
            </>
          )}
        </div>
      </div>
    </div>
  );
});

export default FileTreeToolbar;
