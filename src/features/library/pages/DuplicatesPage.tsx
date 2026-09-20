'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  GitMerge,
  Sparkles,
  Layers,
  FileText,
  Calendar,
  BookOpen,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/shared/lib/utils';
import { Button, Badge } from '@/shared/components/ui';
import dynamic from 'next/dynamic';
import { LibraryTopbar } from '../components/topbar';
import { LibraryInspector } from '../components/inspector';
import { LibraryModals } from '../components/modals';

const MergeModal = dynamic(() => import('../components/modals/MergeModal'), { ssr: false });
import { ContentSkeleton } from '../components/content/ContentSkeleton';
import {
  useDuplicateGroupsQuery,
  useMergeDuplicatesMutation,
} from '../data';
import { useLibrarySidebarStore, useLibraryViewStore } from '../store';
import type { Item, DuplicateGroup } from '../types/library.types';

/**
 * DuplicatesPage - Modern, streamlined duplicate curation page.
 * Replaces previous 1,155-line redundant God-file with thin, workspace-integrated page.
 */
export function DuplicatesPage() {
  const router = useRouter();
  const activeScope = useLibrarySidebarStore((s) => s.activeScope);
  const effectiveScopeId = activeScope.type === 'project' ? activeScope.id : 'user';

  const activeItemId = useLibraryViewStore((s) => s.activeItemId);
  const setActiveItem = useLibraryViewStore((s) => s.setActiveItem);
  const setIsInspectorOpen = useLibraryViewStore((s) => s.setIsInspectorOpen);

  // Curation Queries & Mutations
  const { data, isLoading, isError, refetch } = useDuplicateGroupsQuery(effectiveScopeId);
  const mergeMutation = useMergeDuplicatesMutation(effectiveScopeId);

  // Local state
  const [dismissedGroupKeys, setDismissedGroupKeys] = useState<Set<string>>(new Set());
  const [mergeCluster, setMergeCluster] = useState<Item[] | null>(null);
  const [mergeOpen, setMergeOpen] = useState(false);

  const rawGroups: DuplicateGroup[] = useMemo(() => {
    return data?.duplicateGroups || [];
  }, [data]);

  const activeGroups = useMemo(() => {
    return rawGroups.filter((g, idx) => {
      const key = g.key || `cluster-${idx}`;
      return !dismissedGroupKeys.has(key);
    });
  }, [rawGroups, dismissedGroupKeys]);

  const totalDuplicatePapers = useMemo(() => {
    return activeGroups.reduce((acc, g) => acc + (g.papers?.length || g.items?.length || 0), 0);
  }, [activeGroups]);

  const handleOpenMerge = (group: DuplicateGroup) => {
    const items = (group.papers || group.items || []) as Item[];
    if (items.length < 2) {
      toast.info('This group has only one item');
      return;
    }
    setMergeCluster(items);
    setMergeOpen(true);
  };

  const handleExecuteMerge = async (
    masterPaper: Item,
    mergedFields: Partial<Item>,
    duplicateIdsToDelete: string[],
  ) => {
    await mergeMutation.mutateAsync({
      masterId: masterPaper.id,
      duplicateIds: duplicateIdsToDelete,
      fieldSelections: Object.keys(mergedFields).length > 0 ? mergedFields : undefined,
    });
    setMergeCluster(null);
    setMergeOpen(false);
  };

  const handleDismissGroup = (groupKey: string) => {
    setDismissedGroupKeys((prev) => new Set([...Array.from(prev), groupKey]));
    toast.success('Dismissed duplicate group');
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-background">
      {/* Main Workspace Content */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <LibraryTopbar title="Duplicate Items" />

        <div className="flex-1 overflow-y-auto min-h-0 bg-background/50">
          {isLoading ? (
            <div className="p-6">
              <ContentSkeleton rowCount={8} />
            </div>
          ) : isError ? (
            <div className="flex h-full w-full flex-col items-center justify-center p-8 text-center text-destructive">
              <ShieldAlert className="h-10 w-10 mb-2 opacity-80" />
              <p className="text-sm font-medium">Failed to load duplicate items</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                className="mt-4 text-xs"
              >
                Try again
              </Button>
            </div>
          ) : activeGroups.length === 0 ? (
            <div className="flex h-full w-full flex-col items-center justify-center p-8 text-center text-muted-foreground">
              <div className="h-14 w-14 rounded-full bg-emerald-500/10 flex items-center justify-center mb-3">
                <Sparkles className="h-7 w-7 text-emerald-500" />
              </div>
              <p className="text-base font-semibold text-foreground">No duplicate items</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                Your library is clean. No duplicate items detected.
              </p>
            </div>
          ) : (
            <div className="max-w-5xl mx-auto p-6 space-y-6">
              {/* Header Overview Banner */}
              <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border border-border/80 bg-card shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    <Layers className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">
                      Detected {activeGroups.length} duplicate {activeGroups.length === 1 ? 'group' : 'groups'}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Found {totalDuplicatePapers} items with matching identifiers or titles.
                    </p>
                  </div>
                </div>
              </div>

              {/* Duplicate Groups List */}
              <div className="space-y-4">
                {activeGroups.map((group, groupIdx) => {
                  const groupKey = group.key || `cluster-${groupIdx}`;
                  const items = ((group.papers || group.items || []) as Item[]);
                  const isHighConfidence = group.confidence === 'high';

                  return (
                    <div
                      key={groupKey}
                      className="rounded-xl border border-border bg-card overflow-hidden shadow-2xs transition-all hover:border-border/80"
                    >
                      {/* Cluster Header */}
                      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-muted/40 border-b border-border/60">
                        <div className="flex items-center gap-2.5">
                          <span className="text-xs font-bold text-foreground">
                            Group #{groupIdx + 1}
                          </span>
                          <Badge
                            variant={isHighConfidence ? 'default' : 'secondary'}
                            className="text-[11px] font-normal h-5"
                          >
                            {group.matchType === 'DOI' ? 'Matching DOI' : 'Matching Title & Author'}
                          </Badge>
                          <Badge
                            variant="outline"
                            className="text-[10px] text-muted-foreground font-normal h-5"
                          >
                            {items.length} {items.length === 1 ? 'item' : 'items'}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDismissGroup(groupKey)}
                            className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                          >
                            Dismiss
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleOpenMerge(group)}
                            className="h-7 px-3 text-xs gap-1.5 font-medium"
                          >
                            <GitMerge className="h-3.5 w-3.5" />
                            Merge this group
                          </Button>
                        </div>
                      </div>

                      {/* Cluster Item Rows */}
                      <div className="divide-y divide-border/40">
                        {items.map((item, itemIdx) => {
                          const isSelected = activeItemId === item.id;
                          const authorStr = Array.isArray(item.authors)
                            ? item.authors.join(', ')
                            : typeof item.authors === 'string'
                              ? item.authors
                              : '';

                          return (
                            <div
                              key={item.id || itemIdx}
                              onClick={() => {
                                setActiveItem(item.id);
                                setIsInspectorOpen(true);
                              }}
                              onDoubleClick={() => router.push(`/reader?itemId=${item.id}`)}
                              className={cn(
                                'flex items-center justify-between gap-4 px-5 py-3 cursor-pointer transition-colors text-xs',
                                isSelected
                                  ? 'bg-primary/10'
                                  : 'hover:bg-muted/30'
                              )}
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <div className="font-medium text-foreground truncate">
                                    {item.title || 'Untitled item'}
                                  </div>
                                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5 truncate">
                                    {authorStr && <span>{authorStr}</span>}
                                    {item.year && (
                                      <span className="flex items-center gap-0.5">
                                        • <Calendar className="h-3 w-3 inline" /> {item.year}
                                      </span>
                                    )}
                                    {item.journal && <span>• {item.journal}</span>}
                                    {item.doi && (
                                      <span className="font-mono text-[10px] text-primary/80">
                                        • DOI: {item.doi}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    router.push(`/reader?itemId=${item.id}`);
                                  }}
                                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                  title="Open in Reader"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </Button>
                                <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Zone 4: Inspector Panel */}
      <LibraryInspector scopeId={effectiveScopeId} />

      {/* Zone 5: Self-managed Modals */}
      <LibraryModals scopeId={effectiveScopeId} />

      {/* Merge Modal Dialog */}
      {mergeCluster && (
        <MergeModal
          open={mergeOpen}
          onOpenChange={(open) => {
            setMergeOpen(open);
            if (!open) setMergeCluster(null);
          }}
          duplicates={mergeCluster}
          scopeId={effectiveScopeId}
          onMerge={handleExecuteMerge}
        />
      )}
    </div>
  );
}

export default DuplicatesPage;
