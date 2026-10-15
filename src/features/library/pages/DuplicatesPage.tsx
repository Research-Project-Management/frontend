'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  GitMerge,
  Layers,
  FileText,
  Calendar,
  ExternalLink,
  ChevronRight,
  Columns,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { LibraryTopbar } from '@/features/library/components/topbar/LibraryTopbar';
import { LibraryInspector } from '@/features/library/components/inspector/LibraryInspector';
import { DuplicateMergeInspector } from '@/features/library/components/inspector/DuplicateMergeInspector';
import { formatAcademicAuthors } from '@/features/library/domain/academic-text';
import { ContentSkeleton } from '@/features/library/components/content/ContentSkeleton';
import { PlaneErrorState } from '@/shared/components/ui/PlaneErrorState';
import {
  DuplicatesStackIllustration,
  libraryIllustrationStyles,
} from '@/features/library/components/content/LibraryIllustrations';
import {
  useDuplicateGroups,
  useMergeDuplicates,
} from '@/features/library/data';
import { useLibraryUIStore } from '@/features/library/store/library-ui.store';
import { useLibraryPermissions } from '@/features/library/store/selectors';
import { inspectItemDifferences } from '@/features/library/domain/diff';
import { LibraryModals } from '@/features/library/components/modals/LibraryModals';
import MergeModal from '@/features/library/components/modals/MergeModal';
import type { Item, DuplicateGroup } from '@/features/library/types/library.types';

function InlineDiffView({
  items,
  recommendedMasterId,
}: {
  items: Item[];
  recommendedMasterId?: string;
}) {
  const diff = useMemo(
    () => inspectItemDifferences(items, recommendedMasterId || items[0]?.id),
    [items, recommendedMasterId],
  );

  return (
    <div className="p-4 bg-muted/20 border-t border-border space-y-2.5">
      <div className="flex items-center justify-between text-11 text-foreground font-medium">
        <span className="flex items-center gap-1.5 font-semibold text-foreground">
          <Columns className="size-3.5 text-primary" />
          Field-by-Field Comparison
        </span>
        <div className="flex items-center gap-2">
          {diff.conflictCount > 0 ? (
            <Badge
              variant="outline"
              className="text-10 h-4 px-1.5 border-warning/30 text-warning bg-warning/10 font-normal"
            >
              {diff.conflictCount} conflict(s)
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="text-10 h-4 px-1.5 border-success/30 text-success bg-success/10 font-normal"
            >
              Identical
            </Badge>
          )}
          <span className="text-10 font-mono">
            {diff.fields.length} fields evaluated
          </span>
        </div>
      </div>

      <div className="rounded-md border border-border overflow-hidden bg-background">
        <div className="max-h-72 overflow-y-auto">
          <table className="w-full text-left border-collapse text-11">
            <thead className="sticky top-0 bg-muted/90 backdrop-blur-xs z-10 border-b border-border">
              <tr className="text-foreground font-medium">
                <th className="w-36 px-3 py-1.5">Field</th>
                {items.map((it, idx) => (
                  <th key={it.id || idx} className="px-3 py-1.5">
                    Version {idx + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {diff.fields.map((field) => (
                <tr
                  key={field.key}
                  className={cn(
                    'transition-colors',
                    field.hasConflict
                      ? 'bg-warning/[0.06] hover:bg-warning/[0.10]'
                      : 'hover:bg-muted/30',
                  )}
                >
                  <td className="px-3 py-2 font-medium text-foreground align-top">
                    <div className="space-y-0.5">
                      <span>{field.label}</span>
                      {field.hasConflict ? (
                        <span className="block text-9 text-warning font-mono">
                          conflict
                        </span>
                      ) : (
                        <span className="block text-9 text-foreground/70 font-mono">
                          identical
                        </span>
                      )}
                    </div>
                  </td>
                  {field.options.map((opt) => (
                    <td
                      key={opt.itemId}
                      className="px-3 py-2 align-top text-foreground"
                    >
                      <div className="line-clamp-3 leading-relaxed text-11">
                        {opt.isEmpty ? (
                          <span className="italic text-foreground/60">(Empty)</span>
                        ) : (
                          opt.displayValue
                        )}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/**
 * DuplicatesPage - Modern, streamlined duplicate curation page.
 * Replaces previous 1,155-line redundant God-file with thin, workspace-integrated page.
 */
export function DuplicatesPage() {
  const router = useRouter();
  const activeScope = useLibraryUIStore((s) => s.activeScope);
  const effectiveScopeId = activeScope.type === 'project' ? activeScope.id : 'user';

  const activeItemId = useLibraryUIStore((s) => s.activeItemId);
  const setActiveItem = useLibraryUIStore((s) => s.setActiveItem);
  const { canEditItem: canEdit } = useLibraryPermissions();

  // Curation Queries & Mutations
  const { data, isLoading, isError, error } = useDuplicateGroups(effectiveScopeId);
  const mergeMutation = useMergeDuplicates(effectiveScopeId);

  // Local state
  const [dismissedGroupKeys, setDismissedGroupKeys] = useState<Set<string>>(new Set());
  const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(null);
  const [expandedDiffGroupKeys, setExpandedDiffGroupKeys] = useState<Set<string>>(new Set());
  const [mergeCluster, setMergeCluster] = useState<Item[] | null>(null);
  const [mergeRecommendedMasterId, setMergeRecommendedMasterId] = useState<string | undefined>(undefined);
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

  const selectedGroup = useMemo(() => {
    if (activeGroups.length === 0) return null;
    if (selectedGroupKey) {
      const found = activeGroups.find((g, idx) => (g.key || `cluster-${idx}`) === selectedGroupKey);
      if (found) return found;
    }
    return activeGroups[0] || null;
  }, [activeGroups, selectedGroupKey]);

  const selectedGroupItems = useMemo(() => {
    if (!selectedGroup) return [];
    return ((selectedGroup.papers || selectedGroup.items || []) as Item[]);
  }, [selectedGroup]);

  const toggleInlineDiff = (groupKey: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedDiffGroupKeys((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  };

  const totalDuplicatePapers = useMemo(() => {
    return activeGroups.reduce((acc, g) => acc + (g.papers?.length || g.items?.length || 0), 0);
  }, [activeGroups]);

  const handleOpenMerge = (group: DuplicateGroup) => {
    const items = (group.papers || group.items || []) as Item[];
    if (items.length < 2) {
      toast.info('This group has only one item', { id: 'duplicate-group-action' });
      return;
    }
    setMergeCluster(items);
    setMergeRecommendedMasterId(group.recommendedMasterId);
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
    setMergeRecommendedMasterId(undefined);
    setMergeOpen(false);
  };

  const handleDismissGroup = (groupKey: string) => {
    setDismissedGroupKeys((prev) => new Set([...Array.from(prev), groupKey]));
    toast.success('Dismissed duplicate group', { id: 'duplicate-group-action' });
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-background">
      {/* Main Workspace Content */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <LibraryTopbar title="Duplicate Items" showDisplay={false} canEdit={canEdit} />

        <div className="flex-1 overflow-y-auto scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden min-h-0 bg-background/50">
          {isLoading ? (
            <div className="p-6">
              <ContentSkeleton rowCount={8} />
            </div>
          ) : isError ? (
            <PlaneErrorState
              title="Unable to load duplicates"
              description="An issue occurred while scanning for duplicate references in your library."
              error={error || new Error('Internal Server Error')}
            />
          ) : activeGroups.length === 0 ? (
            <div className="flex-1 w-full h-full min-h-[440px] flex flex-col items-center justify-center p-8 text-center select-none animate-in fade-in-50 duration-200 bg-background">
              <style dangerouslySetInnerHTML={{ __html: libraryIllustrationStyles }} />
              <div className="plane-library-illustration mb-6 flex items-center justify-center">
                <DuplicatesStackIllustration />
              </div>
              <h3 className="text-16 font-semibold text-foreground mb-2 tracking-tight">
                No duplicate items
              </h3>
              <p className="text-13 text-foreground max-w-[420px] leading-relaxed font-normal">
                Your library is completely clean. No duplicate papers or matching identifiers detected.
              </p>
            </div>
          ) : (
            <div className="max-w-5xl mx-auto p-6 space-y-6">
              {/* Header Overview Banner */}
              <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-md border border-border bg-card">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center text-primary">
                    <Layers className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-13 font-semibold text-foreground">
                      Detected {activeGroups.length} duplicate {activeGroups.length === 1 ? 'group' : 'groups'}
                    </h2>
                    <p className="text-12 text-foreground">
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
                  const isSelectedGroup = (selectedGroup?.key || activeGroups[0]?.key || 'cluster-0') === groupKey;
                  const isDiffExpanded = expandedDiffGroupKeys.has(groupKey);
                  const itemTypes = Array.from(new Set(items.map((it) => it.itemType).filter(Boolean)));
                  const hasMismatchedTypes = itemTypes.length > 1;

                  return (
                    <div
                      key={groupKey}
                      onClick={() => setSelectedGroupKey(groupKey)}
                      className={cn(
                        'rounded-md border bg-card overflow-hidden transition-colors cursor-pointer',
                        isSelectedGroup
                          ? 'border-primary/80 ring-1 ring-primary/30'
                          : 'border-border hover:border-foreground/30',
                      )}
                    >
                      {/* Cluster Header */}
                      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-background border-b border-border">
                        <div className="flex items-center gap-2.5">
                          <span className="text-12 font-semibold text-foreground">
                            Group #{groupIdx + 1}
                          </span>
                          <Badge
                            variant={isHighConfidence ? 'default' : 'secondary'}
                            className="text-11 font-normal h-5 rounded-md"
                          >
                            {group.matchType === 'DOI' ? 'Matching DOI' : 'Matching Title & Author'}
                          </Badge>
                          <Badge
                            variant="outline"
                            className="text-10 text-foreground font-normal h-5 rounded-md"
                          >
                            {items.length} {items.length === 1 ? 'item' : 'items'}
                          </Badge>
                          {hasMismatchedTypes && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge
                                  variant="outline"
                                  className="text-10 text-warning border-warning/30 bg-warning/10 font-normal h-5 rounded-md cursor-default"
                                >
                                  Cross-Type Group
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                Cross-Type Group — master type will be unified on merge
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => toggleInlineDiff(groupKey, e)}
                                className={cn(
                                  'h-8 px-2.5 text-12 gap-1.5 transition-colors cursor-pointer',
                                  isDiffExpanded
                                    ? 'bg-primary/10 text-primary font-medium'
                                    : 'text-foreground hover:bg-muted',
                                )}
                              >
                                <Columns className="size-3.5" />
                                <span>{isDiffExpanded ? 'Hide Diff' : 'Inline Diff'}</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                              Toggle inline side-by-side diff comparison
                            </TooltipContent>
                          </Tooltip>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDismissGroup(groupKey);
                            }}
                            className="h-8 px-2.5 text-12 text-foreground hover:bg-muted cursor-pointer"
                          >
                            Dismiss
                          </Button>
                          {canEdit && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex">
                                  <Button
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenMerge(group);
                                    }}
                                    className="h-8 px-3 text-12 gap-1.5 font-medium shadow-none cursor-pointer"
                                  >
                                    <GitMerge className="h-3.5 w-3.5" />
                                    Merge this group
                                  </Button>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="bottom">
                                {hasMismatchedTypes
                                  ? 'Open merge workbench (cross-type group will be unified)'
                                  : 'Open merge workbench'}
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </div>

                      {/* Cluster Item Rows */}
                      <div className="divide-y divide-border/40">
                        {items.map((item, itemIdx) => {
                          const isSelected = activeItemId === item.id;
                          const authorFormatted = formatAcademicAuthors(
                            item.authors && item.authors.length > 0
                              ? item.authors
                              : item.creators,
                          );
                          const authorStr = authorFormatted !== '-' ? authorFormatted : '';

                          return (
                            <div
                              key={item.id || itemIdx}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedGroupKey(groupKey);
                                setActiveItem(item.id);
                              }}
                              onDoubleClick={() => router.push(`/library/papers/${item.id}`)}
                              className={cn(
                                'flex items-center justify-between gap-4 px-5 py-3 cursor-pointer transition-colors text-13',
                                isSelected
                                  ? 'bg-muted'
                                  : 'hover:bg-muted',
                              )}
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <FileText className="h-4 w-4 text-foreground shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <div className="font-medium text-foreground truncate">
                                    {item.title || 'Untitled item'}
                                  </div>
                                  <div className="flex items-center gap-2 text-11 text-foreground mt-0.5 truncate">
                                    {authorStr && <span>{authorStr}</span>}
                                    {item.year && (
                                      <span className="flex items-center gap-0.5">
                                        • <Calendar className="h-3 w-3 inline" /> {item.year}
                                      </span>
                                    )}
                                    {item.journal && <span>• {item.journal}</span>}
                                    {item.doi && (
                                      <span className="font-mono text-10 text-foreground">
                                        • DOI: {item.doi}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        router.push(`/library/papers/${item.id}`);
                                      }}
                                      className="size-7 text-foreground hover:bg-muted cursor-pointer"
                                      aria-label="Open in Reader"
                                    >
                                      <ExternalLink className="h-3.5 w-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top">Open in Reader</TooltipContent>
                                </Tooltip>
                                <ChevronRight className="h-4 w-4 text-foreground" />
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Inline Side-by-Side Diff Workbench */}
                      {isDiffExpanded && (
                        <InlineDiffView
                          items={items}
                          recommendedMasterId={group.recommendedMasterId}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Zone 4: Inspector Panel (Zotero 7 Merge Inspector when duplicates selected) */}
      {selectedGroupItems.length >= 2 ? (
        <div className="hidden md:flex w-80 lg:w-96 xl:w-[420px] h-full shrink-0 flex-col overflow-hidden border-l border-border bg-background">
          <DuplicateMergeInspector
            items={selectedGroupItems}
            recommendedMasterId={selectedGroup?.recommendedMasterId}
            scopeId={effectiveScopeId}
            canEdit={canEdit}
            onOpenModal={() => {
              setMergeCluster(selectedGroupItems);
              setMergeRecommendedMasterId(selectedGroup?.recommendedMasterId);
              setMergeOpen(true);
            }}
            onMerge={handleExecuteMerge}
            onDismiss={() => {
              if (selectedGroup) {
                handleDismissGroup(selectedGroup.key || selectedGroupKey || '');
              }
            }}
          />
        </div>
      ) : (
        <LibraryInspector scopeId={effectiveScopeId} canEdit={canEdit} />
      )}

      {/* Zone 5: Self-managed Modals */}
      <LibraryModals scopeId={effectiveScopeId} />

      {/* Merge Modal Dialog */}
      {mergeCluster && (
        <MergeModal
          open={mergeOpen}
          onOpenChange={(open: boolean) => {
            setMergeOpen(open);
            if (!open) {
              setMergeCluster(null);
              setMergeRecommendedMasterId(undefined);
            }
          }}
          duplicates={mergeCluster}
          recommendedMasterId={mergeRecommendedMasterId}
          scopeId={effectiveScopeId}
          onMerge={handleExecuteMerge}
          onDismissDuplicate={() => {
            const matchingGroup = activeGroups.find((g) => {
              const gItems = (g.papers || g.items || []) as Item[];
              return gItems.some((it) => mergeCluster.some((mc) => mc.id === it.id));
            });
            const groupIdx = matchingGroup ? activeGroups.indexOf(matchingGroup) : -1;
            const key =
              matchingGroup?.key ||
              (groupIdx >= 0 ? `cluster-${groupIdx}` : selectedGroupKey || '');
            if (key) {
              handleDismissGroup(key);
            }
            setMergeCluster(null);
            setMergeRecommendedMasterId(undefined);
            setMergeOpen(false);
          }}
        />
      )}
    </div>
  );
}

export default DuplicatesPage;
