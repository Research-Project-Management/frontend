'use client';

import React, { useState } from 'react';
import {
  Tag,
  Check,
  X,
  Clock,
  Loader2,
  User,
  MoreVertical,
  Download,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { cn } from '@/shared/lib/utils';
import type { ProjectVersionListItem } from '@/features/editor/domain/types/history.types';

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

export interface VersionTimelineSidebarProps {
  versions: ProjectVersionListItem[];
  isLoadingVersions: boolean;
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

export function VersionTimelineSidebar({
  versions,
  isLoadingVersions,
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
}: VersionTimelineSidebarProps) {
  const [labelingVersion, setLabelingVersion] = useState<number | null>(null);
  const [newLabelText, setNewLabelText] = useState('');

  const filteredVersions = React.useMemo(() => {
    if (filter === 'labelled') {
      return versions.filter((v) => v.labels && v.labels.length > 0);
    }
    return versions;
  }, [versions, filter]);

  return (
    <aside className="w-full md:w-80 lg:w-88 border-t md:border-t-0 md:border-l border-border max-h-60 md:max-h-none flex flex-col bg-surface shrink-0 overflow-hidden">
      {/* Header: Tabs + Compare toggle */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border shrink-0 bg-background/50">
        <div className="flex items-center gap-1 rounded-md border border-border bg-muted/40 p-0.5 text-xs font-medium">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={cn(
              'px-2 py-1 rounded-sm transition-colors cursor-pointer whitespace-nowrap',
              filter === 'all'
                ? 'bg-background text-foreground font-medium'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            All history
          </button>
          <button
            type="button"
            onClick={() => setFilter('labelled')}
            className={cn(
              'px-2 py-1 rounded-sm transition-colors cursor-pointer whitespace-nowrap',
              filter === 'labelled'
                ? 'bg-background text-foreground font-medium'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Labels
          </button>
        </div>

        <Button
          type="button"
          variant={historyMode === 'compare' ? 'secondary' : 'outline'}
          size="sm"
          onClick={() =>
            onHistoryModeChange(historyMode === 'compare' ? 'single' : 'compare')
          }
          className="h-7 px-2.5 text-xs font-medium cursor-pointer whitespace-nowrap shrink-0"
        >
          {historyMode === 'compare' ? 'Exit compare' : 'Compare versions'}
        </Button>
      </div>

      {/* Versions List */}
      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1.5 sidebar-scrollbar">
        {isLoadingVersions ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground text-xs gap-2">
            <Loader2 className="size-5 animate-spin motion-reduce:animate-none text-primary" />
            <span>Loading history...</span>
          </div>
        ) : filteredVersions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground text-xs text-center px-4">
            <Clock className="size-6 mb-2 opacity-40" />
            <p className="font-medium text-foreground">No versions found</p>
            <p className="text-[11px] mt-0.5">
              {filter === 'labelled'
                ? 'No labelled versions yet.'
                : 'Versions appear automatically as you edit.'}
            </p>
          </div>
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
                          setNewLabelText('');
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

                {/* Labels Chips */}
                {v.labels && v.labels.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {v.labels.map((lbl) => (
                      <span
                        key={lbl.id || lbl.label}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-muted text-foreground border border-border rounded-sm"
                      >
                        <Tag className="size-2.5" />
                        <span>{lbl.label}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteLabel(lbl.id);
                          }}
                          className="hover:text-destructive transition-colors ml-0.5 cursor-pointer"
                          title="Remove label"
                        >
                          <X className="size-2.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Inline Add Label Box */}
                {isAddingLabel ? (
                  <div
                    className="flex items-center gap-1 mt-2 pt-2 border-t border-border/60"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Input
                      value={newLabelText}
                      onChange={(e) => setNewLabelText(e.target.value)}
                      aria-label="Label name"
                      placeholder="Label name..."
                      className="h-6 text-[11px] px-2"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newLabelText.trim()) {
                          onAddLabel(v.version, newLabelText.trim());
                          setLabelingVersion(null);
                        } else if (e.key === 'Escape') {
                          setLabelingVersion(null);
                        }
                      }}
                    />
                    <Button
                      size="sm"
                      className="h-6 px-2 text-[10px]"
                      disabled={!newLabelText.trim() || isAddingLabelLoading}
                      onClick={() => {
                        onAddLabel(v.version, newLabelText.trim());
                        setLabelingVersion(null);
                      }}
                    >
                      <Check className="size-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-1.5 text-[10px]"
                      onClick={() => setLabelingVersion(null)}
                    >
                      <X className="size-3" />
                    </Button>
                  </div>
                ) : (
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
                  )
                )}
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
