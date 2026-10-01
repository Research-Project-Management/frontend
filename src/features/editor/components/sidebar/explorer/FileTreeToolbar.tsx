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
} from '@/shared/components/ui';
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
      {/* Header toolbar */}
      <div
        className={cn(
          'flex h-9 shrink-0 items-center justify-between px-3 bg-background select-none',
          !isFileTreeOpen && 'border-b border-border',
        )}
      >
        <button
          type="button"
          onClick={onToggleFileTree}
          className="flex items-center gap-1.5 font-semibold text-xs text-foreground hover:text-foreground/80 cursor-pointer select-none"
          title={isFileTreeOpen ? 'Collapse file tree' : 'Expand file tree'}
          aria-label={isFileTreeOpen ? 'Collapse file tree' : 'Expand file tree'}
        >
          <ChevronRight
            className={cn(
              'size-3.5 shrink-0 transition-transform text-muted-foreground',
              isFileTreeOpen && 'rotate-90',
            )}
          />
          <span>File tree</span>
        </button>
        {isFileTreeOpen && (
          <div className="flex items-center gap-0.5">
            {[
              { icon: FilePlus, label: 'New File', action: onOpenFileModal },
              {
                icon: FolderPlus,
                label: 'New Folder',
                action: onStartCreateFolder,
              },
              { icon: Upload, label: 'Upload Files', action: onOpenUploadModal },
              {
                icon: Trash2,
                label: `Deleted Files (${deletedFilesCount})`,
                action: onOpenDeletedFilesModal,
                badge: deletedFilesCount > 0 ? deletedFilesCount : undefined,
              },
            ].map(({ icon: Icon, label, action, badge }: any) => (
              <Tooltip key={label}>
                <TooltipTrigger asChild>
                  <button
                    onClick={action}
                    aria-label={label}
                    className="relative flex size-7 items-center justify-center rounded-sm text-foreground/80 transition-colors hover:bg-muted hover:text-foreground cursor-pointer"
                  >
                    <Icon className="size-3.5 shrink-0" />
                    {badge !== undefined && (
                      <span className="absolute -top-0.5 -right-0.5 flex size-3.5 items-center justify-center rounded-full bg-rose-500 text-9 font-bold text-white shadow-xs">
                        {badge > 9 ? '9+' : badge}
                      </span>
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">{label}</TooltipContent>
              </Tooltip>
            ))}
          </div>
        )}
      </div>

      {/* ── File filter search bar (Overleaf Parity) ─────────────────── */}
      {isFileTreeOpen && (
        <div className="px-2.5 pb-2 pt-0.5 border-b border-border bg-background">
          <div className="relative flex items-center h-7 rounded-md border border-border/80 bg-muted/30 px-2 text-xs focus-within:border-primary/50 focus-within:bg-background transition-colors">
            <Search className="size-3.5 shrink-0 text-muted-foreground mr-1.5" />
            <input
              type="text"
              value={fileFilter}
              onChange={(e) => onFileFilterChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  onFileFilterChange('');
                  (e.target as HTMLInputElement).blur();
                }
              }}
              placeholder="Filter files..."
              aria-label="Filter files"
              className="w-full bg-transparent border-none outline-none text-xs text-foreground placeholder:text-muted-foreground/60"
            />
            {fileFilter && (
              <button
                type="button"
                onClick={() => onFileFilterChange('')}
                className="size-4 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
                title="Clear filter (Esc)"
                aria-label="Clear filter"
              >
                <X className="size-3" />
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
});
