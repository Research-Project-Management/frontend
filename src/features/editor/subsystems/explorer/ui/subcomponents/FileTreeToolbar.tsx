'use client';

/**
 * FileTreeToolbar.tsx
 *
 * Canonical File Tree Header & Actions Toolbar.
 * Location: `features/editor/subsystems/explorer/ui/subcomponents/FileTreeToolbar.tsx`
 *
 * Layout:
 * - Header: Chevron accordion toggle + "File Tree" title.
 * - Actions: Unified Plus dropdown menu (New File, New Folder, Upload Files).
 */

import React from 'react';
import {
  ChevronRight,
  FilePlus,
  FolderPlus,
  Library,
  ListFilter,
  Plus,
  Upload,
} from 'lucide-react';
import { editorCommandBus } from '@/features/editor/core/bus/command-bus';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
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
  sortBy?: 'name' | 'type';
  sortDirection?: 'asc' | 'desc';
  onSortChange?: (by: 'name' | 'type') => void;
}

export const FileTreeToolbar = React.memo(function FileTreeToolbar({
  isFileTreeOpen,
  onToggleFileTree,
  onOpenFileModal,
  onStartCreateFolder,
  onOpenUploadModal,
  sortBy = 'name',
  sortDirection = 'asc',
  onSortChange,
}: FileTreeToolbarProps) {
  return (
    <div className="relative flex h-9 shrink-0 items-center justify-between px-3 select-none">
      {/* ── Title / Collapse Button ── */}
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

      {/* ── Actions: Plus (New/Upload) & Filter (Sort by) ── */}
      <div className="flex items-center gap-0.5">
        {isFileTreeOpen && (
          <>
            <DropdownMenu>
              <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label="New file, folder, or upload"
                      className="flex size-7 items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-foreground"
                    >
                      <Plus className="size-4 shrink-0" strokeWidth={1.75} />
                    </button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={6} className="text-xs">
                  New...
                </TooltipContent>
              </Tooltip>

              <DropdownMenuContent align="end" className="w-44 select-none">
                <DropdownMenuItem
                  onClick={onOpenFileModal}
                  className="flex items-center gap-2 cursor-pointer text-xs"
                >
                  <FilePlus className="size-3.5 text-foreground" strokeWidth={1.5} />
                  <span>New File</span>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => onStartCreateFolder()}
                  className="flex items-center gap-2 cursor-pointer text-xs"
                >
                  <FolderPlus className="size-3.5 text-foreground" strokeWidth={1.5} />
                  <span>New Folder</span>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={onOpenUploadModal}
                  className="flex items-center gap-2 cursor-pointer text-xs"
                >
                  <Upload className="size-3.5 text-foreground" strokeWidth={1.5} />
                  <span>Upload Files</span>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() =>
                    editorCommandBus.dispatch({
                      type: 'dialog:open',
                      dialog: 'citation-picker',
                    })
                  }
                  className="flex items-center gap-2 cursor-pointer text-xs"
                >
                  <Library className="size-3.5 text-foreground" strokeWidth={1.5} />
                  <span>Add from Library</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Filter / Sort by */}
            <DropdownMenu>
              <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label="Sort files"
                      className={cn(
                        'flex size-7 items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-foreground',
                        sortBy !== 'name' && 'bg-muted/80',
                      )}
                    >
                      <ListFilter className="size-4 shrink-0" strokeWidth={1.5} />
                    </button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={6} className="text-xs">
                  Sort files
                </TooltipContent>
              </Tooltip>

              <DropdownMenuContent align="end" className="w-36 select-none p-1">
                <DropdownMenuLabel className="text-[11px] font-semibold text-muted-foreground px-2 py-1">
                  Sort by
                </DropdownMenuLabel>

                <DropdownMenuItem
                  onClick={() => onSortChange?.('name')}
                  className="flex items-center justify-between cursor-pointer text-xs px-2 py-1.5"
                >
                  <span>Name</span>
                  {sortBy === 'name' && (
                    <span className="text-xs text-muted-foreground font-sans">
                      {sortDirection === 'asc' ? 'â†‘' : 'â†“'}
                    </span>
                  )}
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => onSortChange?.('type')}
                  className="flex items-center justify-between cursor-pointer text-xs px-2 py-1.5"
                >
                  <span>File type</span>
                  {sortBy === 'type' && (
                    <span className="text-xs text-muted-foreground font-sans">
                      {sortDirection === 'asc' ? 'â†‘' : 'â†“'}
                    </span>
                  )}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>
    </div>
  );
});

export default FileTreeToolbar;
