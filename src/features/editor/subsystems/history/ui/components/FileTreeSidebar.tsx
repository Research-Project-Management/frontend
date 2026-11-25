'use client';

import React from 'react';
import { FileText } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { PlaneEmptyState } from '@/shared/components/ui/PlaneEmptyState';
import { PlaneErrorState, type PlaneErrorStateProps } from '@/shared/components/ui/PlaneErrorState';
import { cn } from '@/shared/lib/utils';

export interface FileTreeItem {
  path: string;
  status?: 'added' | 'modified' | 'deleted' | 'renamed' | 'unchanged';
  additions?: number;
  deletions?: number;
}

export interface FileTreeSidebarProps {
  mode: 'single' | 'compare';
  files: FileTreeItem[];
  activeFilePath: string | null;
  onSelectFile: (path: string) => void;
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  versionLabel?: string;
}

const FILE_SKELETON_WIDTHS = ['w-28', 'w-36', 'w-24', 'w-32', 'w-20', 'w-28'];

export function FileTreeSidebar({
  mode,
  files,
  activeFilePath,
  onSelectFile,
  isLoading = false,
  error,
  onRetry,
  versionLabel,
}: FileTreeSidebarProps) {
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

      <div className="flex-1 min-h-0 flex flex-col overflow-y-auto p-1.5 space-y-0.5 sidebar-scrollbar">
        {isLoading ? (
          <div className="space-y-1 p-0.5">
            {FILE_SKELETON_WIDTHS.map((widthClass, idx) => (
              <div key={idx} className="flex items-center justify-between gap-2 px-2 py-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Skeleton className="size-3.5 rounded-sm shrink-0" />
                  <Skeleton className={cn('h-3.5 rounded-sm', widthClass)} />
                </div>
                {mode === 'compare' && <Skeleton className="h-3 w-7 rounded-sm shrink-0" />}
              </div>
            ))}
          </div>
        ) : error ? (
          <PlaneErrorState
            isCompact
            title="Failed to load files"
            description="Could not load snapshot files."
            error={error as PlaneErrorStateProps['error']}
            action={
              onRetry ? (
                <Button size="sm" variant="outline" onClick={onRetry} className="h-7 text-xs cursor-pointer">
                  Try again
                </Button>
              ) : undefined
            }
          />
        ) : files.length === 0 ? (
          <PlaneEmptyState
            isCompact
            variant="document"
            title={mode === 'compare' ? 'No changed files' : 'No files in snapshot'}
            description={
              mode === 'compare'
                ? 'No files changed between these versions.'
                : 'This snapshot does not contain any files.'
            }
          />
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
