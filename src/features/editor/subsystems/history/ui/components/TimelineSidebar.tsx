'use client';

import React, { useState } from 'react';
import {
  Tag,
  User,
  MoreVertical,
  Download,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { PlaneEmptyState } from '@/shared/components/ui/PlaneEmptyState';
import { PlaneErrorState, type PlaneErrorStateProps } from '@/shared/components/ui/PlaneErrorState';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { cn } from '@/shared/lib/utils';
import type { ProjectVersionListItem } from '@/features/editor/domain/types/history.types';
import { VersionLabels } from './VersionLabels';

function formatVersionTime(dateStr?: string | null): string {
  if (!dateStr) return 'Just now';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Recently';
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return 'Recently';
  }
}

export interface TimelineSidebarProps {
  versions: ProjectVersionListItem[];
  isLoadingVersions: boolean;
  error?: unknown;
  onRetry?: () => void;
  historyMode: 'single' | 'compare';
  onHistoryModeChange: (mode: 'single' | 'compare') => void;
  filter: 'all' | 'labelled';
  setFilter: (filter: 'all' | 'labelled') => void;
  selectedTargetVersion: number | null;
  selectedBaseVersion: number | null;
  onSelectVersion: (version: number) => void;
  onSelectBaseVersion?: (version: number) => void;
  onAddLabel: (version: number, label: string) => void;
  onDeleteLabel: (labelId: string) => void;
  onDownloadVersion?: (version: number) => void;
  onRestoreVersion?: (version: number) => void;
  isAddingLabelLoading?: boolean;
}

export function TimelineSidebar({
  versions,
  isLoadingVersions,
  error,
  onRetry,
  historyMode,
  onHistoryModeChange,
  filter,
  setFilter,
  selectedTargetVersion,
  selectedBaseVersion,
  onSelectVersion,
  onSelectBaseVersion,
  onAddLabel,
  onDeleteLabel,
  onDownloadVersion,
  onRestoreVersion,
  isAddingLabelLoading = false,
}: TimelineSidebarProps) {
  const [labelingVersion, setLabelingVersion] = useState<number | null>(null);

  const filteredVersions = React.useMemo(() => {
    if (filter === 'labelled') {
      return versions.filter((v) => v.labels && v.labels.length > 0);
    }
    return versions;
  }, [versions, filter]);

  return (
    <aside className="w-full md:w-80 lg:w-88 border-t md:border-t-0 md:border-l border-border max-h-60 md:max-h-none flex flex-col bg-surface shrink-0 overflow-hidden">
      {/* Top Filter: Full-width Segmented Control */}
      <div className="px-3 py-2 border-b border-border shrink-0 bg-background">
        <div
          role="tablist"
          aria-label="History filter"
          className="flex items-center gap-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'all'}
            onClick={() => setFilter('all')}
            className={cn(
              'flex-1 py-1 text-xs font-medium text-center rounded-sm transition-colors cursor-pointer',
              filter === 'all'
                ? 'bg-muted text-foreground font-semibold'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            All history
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'labelled'}
            onClick={() => setFilter('labelled')}
            className={cn(
              'flex-1 py-1 text-xs font-medium text-center rounded-sm transition-colors cursor-pointer',
              filter === 'labelled'
                ? 'bg-muted text-foreground font-semibold'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Labels
          </button>
        </div>
      </div>

      {/* Versions List */}
      <div className="flex-1 min-h-0 flex flex-col overflow-y-auto p-2 space-y-1.5 sidebar-scrollbar">
        {isLoadingVersions ? (
          <div className="space-y-1.5">
            {Array.from({ length: 5 }).map((_, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded-md border border-border/70 bg-card space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-3.5 w-24 rounded-sm" />
                    <Skeleton className="h-3.5 w-8 rounded-sm" />
                  </div>
                  <Skeleton className="size-4 rounded-sm shrink-0" />
                </div>
                <div className="flex items-center gap-1.5">
                  <Skeleton className="size-3 rounded-full shrink-0" />
                  <Skeleton className="h-3 w-20 rounded-sm" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <PlaneErrorState
            isCompact
            title="Failed to load history"
            description="Could not fetch version history."
            error={error as PlaneErrorStateProps['error']}
            action={
              onRetry ? (
                <Button size="sm" variant="outline" onClick={onRetry} className="h-7 text-xs cursor-pointer">
                  Try again
                </Button>
              ) : undefined
            }
          />
        ) : filteredVersions.length === 0 ? (
          <PlaneEmptyState
            isCompact
            variant="document"
            title="No versions found"
            description={
              filter === 'labelled'
                ? 'No labelled versions yet.'
                : 'Versions appear automatically as you edit.'
            }
          />
        ) : (
          filteredVersions.map((v) => {
            const isTarget = selectedTargetVersion === v.version;
            const isBase = historyMode === 'compare' && selectedBaseVersion === v.version;
            const isAddingLabel = labelingVersion === v.version;
            const authorLabel = v.author?.name || v.createdBy?.name || null;

            return (
              <div
                key={v.id || v.version}
                onClick={() => onSelectVersion(v.version)}
                className={cn(
                  'group relative flex flex-col p-2.5 rounded-md border transition-colors cursor-pointer text-left',
                  isTarget
                    ? 'bg-primary/10 border-primary/40'
                    : isBase
                      ? 'bg-muted/70 border-muted-foreground/30'
                      : 'bg-card hover:bg-muted/40 border-border/70'
                )}
              >
                {/* Top Row: Time, Version Tag, Actions Menu */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-medium text-foreground truncate">
                      {formatVersionTime(v.createdAt)}
                    </span>
                    <span className="text-[11px] font-mono text-muted-foreground shrink-0">
                      v{v.version}
                    </span>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Actions for v${v.version}`}
                        className="size-6 flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer shrink-0"
                      >
                        <MoreVertical className="size-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      onClick={(e) => e.stopPropagation()}
                      className="w-52 text-xs"
                    >
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          setLabelingVersion(v.version);
                        }}
                        className="gap-2 cursor-pointer"
                      >
                        <Tag className="size-3.5 text-muted-foreground" />
                        <span>Label this version</span>
                      </DropdownMenuItem>
                      {onDownloadVersion && (
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            onDownloadVersion(v.version);
                          }}
                          className="gap-2 cursor-pointer"
                        >
                          <Download className="size-3.5 text-muted-foreground" />
                          <span>Download this version (.zip)</span>
                        </DropdownMenuItem>
                      )}
                      {onRestoreVersion && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              onRestoreVersion(v.version);
                            }}
                            className="gap-2 cursor-pointer"
                          >
                            <RotateCcw className="size-3.5 text-muted-foreground" />
                            <span>Restore project to this version</span>
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Author */}
                {authorLabel && (
                  <div className="flex items-center gap-1 mt-1 text-[11px] text-muted-foreground">
                    <User className="size-3 shrink-0 opacity-70" />
                    <span className="truncate">{authorLabel}</span>
                  </div>
                )}

                {/* Labels & Inline Add Form */}
                <VersionLabels
                  version={v.version}
                  labels={v.labels}
                  isAdding={isAddingLabel}
                  isSubmitting={isAddingLabelLoading}
                  onAdd={onAddLabel}
                  onDelete={onDeleteLabel}
                  onCancelAdd={() => setLabelingVersion(null)}
                />

                {!isAddingLabel &&
                  historyMode === 'compare' &&
                  onSelectBaseVersion && (
                    <div className="flex items-center justify-end mt-1.5 pt-1 border-t border-border/40 text-[11px] text-muted-foreground">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectBaseVersion(v.version);
                        }}
                        className={cn(
                          'hover:text-primary transition-colors cursor-pointer',
                          isBase ? 'text-primary font-semibold' : 'hover:underline'
                        )}
                        title={`Compare from v${v.version}`}
                      >
                        {isBase ? '● Comparing from' : 'Compare from here'}
                      </button>
                    </div>
                  )}
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
