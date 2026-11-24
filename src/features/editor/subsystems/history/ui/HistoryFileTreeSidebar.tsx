'use client';

import React from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

export interface HistoryFileTreeItem {
  path: string;
  status?: 'added' | 'modified' | 'deleted' | 'renamed' | 'unchanged';
  additions?: number;
  deletions?: number;
}

export interface HistoryFileTreeSidebarProps {
  mode: 'single' | 'compare';
  files: HistoryFileTreeItem[];
  activeFilePath: string | null;
  onSelectFile: (path: string) => void;
  isLoading?: boolean;
  versionLabel?: string;
}

export function HistoryFileTreeSidebar({
  mode,
  files,
  activeFilePath,
  onSelectFile,
  isLoading = false,
  versionLabel,
}: HistoryFileTreeSidebarProps) {
  return (
    <aside
      aria-label="Snapshot files"
      className="w-full md:w-56 lg:w-64 border-b md:border-b-0 md:border-r border-border max-h-44 md:max-h-none flex flex-col bg-surface shrink-0 overflow-hidden select-none"
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
        <span className="text-xs font-semibold text-foreground tracking-tight">
          Files
        </span>
        {versionLabel && (
          <span className="text-[11px] font-mono text-muted-foreground">
            {versionLabel}
          </span>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-1.5 space-y-0.5 sidebar-scrollbar">
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground text-xs gap-2">
            <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
            <span>Loading files...</span>
          </div>
        ) : files.length === 0 ? (
          <div className="py-8 px-3 text-center text-xs text-muted-foreground">
            {mode === 'compare' ? 'No changed files' : 'No files in snapshot'}
          </div>
        ) : (
          files.map((file) => {
            const isActive = file.path === activeFilePath;
            const isDeleted = file.status === 'deleted';
            return (
              <button
                key={file.path}
                type="button"
                onClick={() => onSelectFile(file.path)}
                title={file.path}
                className={cn(
                  'w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-left text-xs transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-border',
                  isActive
                    ? 'bg-muted text-foreground font-medium'
                    : 'text-foreground/85 hover:bg-muted/60 hover:text-foreground',
                  isDeleted && !isActive && 'text-destructive/80',
                )}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <FileText
                    className={cn(
                      'size-3.5 shrink-0',
                      isDeleted ? 'text-destructive' : 'text-muted-foreground',
                      isActive && !isDeleted && 'text-foreground',
                    )}
                    strokeWidth={1.5}
                  />
                  <span
                    className={cn(
                      'font-mono truncate',
                      isDeleted && 'line-through decoration-destructive/60',
                    )}
                  >
                    {file.path}
                  </span>
                </div>

                {mode === 'compare' && (
                  <div className="flex items-center gap-1 shrink-0 font-mono text-[10px]">
                    {isDeleted ? (
                      <span className="text-destructive font-medium">del</span>
                    ) : (
                      <>
                        {typeof file.additions === 'number' && file.additions > 0 && (
                          <span className="text-success">+{file.additions}</span>
                        )}
                        {typeof file.deletions === 'number' && file.deletions > 0 && (
                          <span className="text-destructive">-{file.deletions}</span>
                        )}
                      </>
                    )}
                  </div>
                )}
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}
