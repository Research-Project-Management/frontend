'use client';

import React, { useState } from 'react';
import {
  Tag,
  Plus,
  Check,
  X,
  Search,
  Clock,
  Loader2,
  User,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { cn } from '@/shared/lib/utils';
import type { ProjectVersionListItem } from '@/features/editor/domain/types/history.types';

export function formatVersionTime(dateStr?: string | null): string {
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
  filter: 'all' | 'labelled';
  setFilter: (filter: 'all' | 'labelled') => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedTargetVersion: number | null;
  selectedBaseVersion: number | null;
  onSelectVersion: (version: number) => void;
  onSelectBaseVersion?: (version: number) => void;
  onAddLabel: (version: number, label: string) => void;
  onDeleteLabel: (labelId: string) => void;
  isAddingLabelLoading?: boolean;
}

export function VersionTimelineSidebar({
  versions,
  isLoadingVersions,
  filter,
  setFilter,
  searchQuery,
  setSearchQuery,
  selectedTargetVersion,
  selectedBaseVersion,
  onSelectVersion,
  onSelectBaseVersion,
  onAddLabel,
  onDeleteLabel,
  isAddingLabelLoading = false,
}: VersionTimelineSidebarProps) {
  const [labelingVersion, setLabelingVersion] = useState<number | null>(null);
  const [newLabelText, setNewLabelText] = useState('');

  const latestVersion = React.useMemo(() => {
    if (versions.length === 0) return 0;
    return Math.max(...versions.map((v) => v.version));
  }, [versions]);

  const filteredVersions = React.useMemo(() => {
    return versions.filter((v) => {
      if (filter === 'labelled' && (!v.labels || v.labels.length === 0)) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const matchSummary = v.summary?.toLowerCase().includes(q);
      const matchLabel = v.labels?.some((l) => l.label.toLowerCase().includes(q));
      const matchVer = `v${v.version}`.includes(q) || `${v.version}` === q;
      const matchAuthor = v.author?.name?.toLowerCase().includes(q);
      return matchSummary || matchLabel || matchVer || matchAuthor;
    });
  }, [versions, filter, searchQuery]);

  return (
    <aside className="w-80 sm:w-88 border-r flex flex-col bg-muted/15 shrink-0 overflow-hidden">
      {/* Filter and Search Bar */}
      <div className="p-3 border-b space-y-2 shrink-0 bg-background/50">
        <div className="flex items-center gap-1 p-0.5 rounded-md border border-border bg-muted/40 text-xs font-medium">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={cn(
              'flex-1 py-1 text-center rounded-sm transition-colors cursor-pointer',
              filter === 'all'
                ? 'bg-background text-foreground font-medium'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            All Revisions ({versions.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('labelled')}
            className={cn(
              'flex-1 py-1 text-center rounded-sm transition-colors cursor-pointer',
              filter === 'labelled'
                ? 'bg-background text-foreground font-medium'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Labelled ({versions.filter((v) => v.labels?.length > 0).length})
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter versions, labels, or authors..."
            className="h-7 pl-8 text-xs bg-background"
          />
        </div>
      </div>

      {/* Versions List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5 divide-y-0">
        {isLoadingVersions ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground text-xs gap-2">
            <Loader2 className="size-5 animate-spin text-primary" />
            <span>Loading version history...</span>
          </div>
        ) : filteredVersions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground text-xs text-center px-4">
            <Clock className="size-6 mb-2 opacity-40" />
            <p className="font-medium text-foreground">No versions found</p>
            <p className="text-[11px] mt-0.5">
              {filter === 'labelled'
                ? 'No snapshots have been labelled yet.'
                : 'Revisions will appear automatically as you edit.'}
            </p>
          </div>
        ) : (
          filteredVersions.map((v) => {
            const isTarget = selectedTargetVersion === v.version;
            const isBase = selectedBaseVersion === v.version;
            const isAddingLabel = labelingVersion === v.version;

            return (
              <div
                key={v.id || v.version}
                onClick={() => onSelectVersion(v.version)}
                className={cn(
                  'group relative flex flex-col p-2.5 rounded-md border transition-all cursor-pointer text-left',
                  isTarget
                    ? 'bg-primary/10 border-primary/40'
                    : isBase
                      ? 'bg-muted/70 border-muted-foreground/30'
                      : 'bg-card hover:bg-muted/40 border-border/70'
                )}
              >
                {/* Top Row: Version Badge, Current State / Save Type, Time */}
                <div className="flex items-center justify-between text-xs mb-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={cn(
                        'px-1.5 py-0.5 rounded-sm text-[11px] font-mono font-semibold',
                        isTarget
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-foreground'
                      )}
                    >
                      v{v.version}
                    </span>
                    {v.version === latestVersion ? (
                      <span className="px-1.5 py-0.5 rounded-sm text-[10px] font-semibold bg-success/15 text-success border border-success/30">
                        Current state
                      </span>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">
                        {v.isAutomatic ? 'Auto-save' : 'Snapshot'}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-muted-foreground shrink-0">
                    {formatVersionTime(v.createdAt)}
                  </span>
                </div>

                {/* Author Attribution (Overleaf Parity) */}
                {(v.author?.name || v.createdById) && (
                  <div className="flex items-center gap-1 mb-1 text-[11px] text-muted-foreground">
                    <User className="size-3 shrink-0 opacity-70" />
                    <span className="truncate">{v.author?.name || `Author ${v.createdById?.slice(0, 6)}`}</span>
                  </div>
                )}

                {/* Summary / Commit Message */}
                <p className="text-xs font-medium text-foreground line-clamp-2 leading-relaxed">
                  {v.summary || (v.isAutomatic ? 'Automated synchronization checkpoint' : 'Snapshot')}
                </p>

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
                          className="hover:text-destructive transition-colors ml-0.5"
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
                    className="flex items-center gap-1 mt-2 pt-2 border-t"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Input
                      value={newLabelText}
                      onChange={(e) => setNewLabelText(e.target.value)}
                      placeholder="Label name (e.g. v1.0-draft)..."
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
                  <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-border/40 text-[10px] text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <span>{v.fileCount || 1} files</span>
                      {onSelectBaseVersion && (
                        <>
                          <span className="text-border/70">•</span>
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
                            title={`Set Version ${v.version} as the comparison base`}
                          >
                            {isBase ? '● Base' : 'Set as base'}
                          </button>
                        </>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLabelingVersion(v.version);
                        setNewLabelText('');
                      }}
                      className="hover:text-foreground flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Plus className="size-2.5" />
                      <span>Add label</span>
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
