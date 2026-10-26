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
import { formatAcademicAuthors } from '@/features/library/domain/academic-text';
import { getItemAuthorsSummary } from '@/features/library/domain/creators';
import { ContentSkeleton } from '@/features/library/ui/content/ContentSkeleton';
import { PlaneErrorState } from '@/shared/components/ui/PlaneErrorState';
import {
  DuplicatesStackIllustration,
  libraryIllustrationStyles,
} from '@/features/library/ui/content/LibraryIllustrations';
import {
  useDuplicateGroups,
  useDismissDuplicatesMutation,
} from '@/features/library/sdk/queries/ingestion.queries';
import { useLibraryUIStore } from '@/features/library/core/store/library-ui.store';
import { inspectItemDifferences } from '@/features/library/domain/diff';
import type { Item, DuplicateGroup } from '@/features/library/domain/types/library.types';

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
    <div className="p-4 bg-muted border-t border-border space-y-2.5">
      <div className="flex items-center justify-between text-11 text-foreground font-medium">
        <span className="flex items-center gap-1.5 font-semibold text-foreground">
          <Columns className="size-3.5 text-foreground" />
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
            <thead className="sticky top-0 bg-muted backdrop-blur-xs z-10 border-b border-border">
              <tr className="text-foreground font-medium">
                <th className="w-36 px-3 py-1.5">Field</th>
                {items.map((it, idx) => (
                  <th key={it.id || idx} className="px-3 py-1.5">
                    Version {idx + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {diff.fields.map((field) => (
                <tr
                  key={field.key}
                  className={cn(
                    'transition-colors',
                    field.hasConflict
                      ? 'bg-warning/5 hover:bg-warning/10'
                      : 'hover:bg-muted',
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
                        <span className="block text-9 text-muted-foreground font-mono">
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
                          <span className="italic text-muted-foreground">(Empty)</span>
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

function getDeterministicGroupKey(group: DuplicateGroup): string {
  if (group.key) return group.key;
  const sortedIds = (group.items || [])
    .map((item) => item.id)
    .filter((id): id is string => Boolean(id))
    .sort()
    .join('|');
  return sortedIds ? `cluster-${sortedIds}` : 'cluster-empty';
}

export interface DuplicatesContentProps {
  scopeId?: string;
  canEdit?: boolean;
  onSelectedGroupChange?: (
    group: DuplicateGroup | null,
    groupKey: string | null,
    dismissGroup: (groupKey: string) => void,
    openMerge: (group: DuplicateGroup, groupKey?: string) => void,
  ) => void;
}

export function DuplicatesContent({
  scopeId = 'user',
  canEdit = true,
  onSelectedGroupChange,
}: DuplicatesContentProps) {
  const router = useRouter();

  const activeItemId = useLibraryUIStore((s) => s.activeItemId);
  const setActiveItem = useLibraryUIStore((s) => s.setActiveItem);
  const openModal = useLibraryUIStore((s) => s.openModal);

  // Curation Queries
  const { data, isLoading, isError, error } = useDuplicateGroups(scopeId);
  const dismissMutation = useDismissDuplicatesMutation(scopeId);

  // Local state
  const [dismissedGroupKeys, setDismissedGroupKeys] = useState<Set<string>>(new Set());
  const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(null);
  const [selectedGroupKeys, setSelectedGroupKeys] = useState<Set<string>>(new Set());
  const [expandedDiffGroupKeys, setExpandedDiffGroupKeys] = useState<Set<string>>(new Set());

  const rawGroups: DuplicateGroup[] = useMemo(() => {
    return data?.duplicateGroups || [];
  }, [data]);

  const activeGroups = useMemo(() => {
    return rawGroups.filter((g) => {
      const key = getDeterministicGroupKey(g);
      return !dismissedGroupKeys.has(key);
    });
  }, [rawGroups, dismissedGroupKeys]);

  const activeGroupByKey = useMemo(() => {
    const map = new Map<string, DuplicateGroup>();
    activeGroups.forEach((g) => {
      map.set(getDeterministicGroupKey(g), g);
    });
    return map;
  }, [activeGroups]);

  const selectedGroup = useMemo(() => {
    if (activeGroups.length === 0) return null;
    if (selectedGroupKey) {
      const found = activeGroupByKey.get(selectedGroupKey);
      if (found) return found;
    }
    return activeGroups[0] || null;
  }, [activeGroups, activeGroupByKey, selectedGroupKey]);

  const toggleGroupSelect = React.useCallback((groupKey: string) => {
    setSelectedGroupKeys((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  }, []);

  const selectAllHighConfidence = React.useCallback(() => {
    const highConfKeys = activeGroups
      .filter((g) => g.confidence === 'high')
      .map((g) => getDeterministicGroupKey(g));
    setSelectedGroupKeys(new Set(highConfKeys));
  }, [activeGroups]);

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

  const totalDuplicateItems = useMemo(() => {
    return activeGroups.reduce((acc, g) => acc + (g.items?.length || 0), 0);
  }, [activeGroups]);

  const handleDismissGroup = React.useCallback(
    (groupKey: string) => {
      const targetGroup = activeGroupByKey.get(groupKey);
      const itemIds = (targetGroup?.items || [])
        .map((it) => it.id)
        .filter((id): id is string => Boolean(id));

      setDismissedGroupKeys((prev) => new Set([...Array.from(prev), groupKey]));

      if (itemIds.length >= 2) {
        dismissMutation.mutate(itemIds, {
          onSuccess: () => {
            toast.success('Dismissed duplicate group', { id: 'duplicate-group-action' });
          },
          onError: () => {
            setDismissedGroupKeys((prev) => {
              const next = new Set(prev);
              next.delete(groupKey);
              return next;
            });
            toast.error('Failed to dismiss duplicate group', { id: 'duplicate-group-action' });
          },
        });
      } else {
        toast.success('Dismissed duplicate group', { id: 'duplicate-group-action' });
      }
    },
    [activeGroupByKey, dismissMutation],
  );

  const handleOpenMerge = React.useCallback(
    (group: DuplicateGroup, explicitKey?: string) => {
      const items = (group.items || []) as Item[];
      if (items.length < 2) {
        toast.info('This group has only one item', { id: 'duplicate-group-action' });
        return;
      }
      const targetKey = explicitKey || getDeterministicGroupKey(group) || selectedGroupKey || '';
      openModal('MERGE_DUPLICATES', {
        duplicates: items,
        recommendedMasterId: group.recommendedMasterId,
        onDismissDuplicate: () => {
          if (targetKey && activeGroupByKey.has(targetKey)) {
            handleDismissGroup(targetKey);
          } else if (targetKey) {
            handleDismissGroup(targetKey);
          }
        },
      });
    },
    [activeGroupByKey, handleDismissGroup, openModal, selectedGroupKey],
  );

  React.useEffect(() => {
    if (!onSelectedGroupChange) return;
    const effectiveKey = selectedGroup ? getDeterministicGroupKey(selectedGroup) : null;
    onSelectedGroupChange(selectedGroup, effectiveKey, handleDismissGroup, handleOpenMerge);
  }, [activeGroups, handleDismissGroup, handleOpenMerge, onSelectedGroupChange, selectedGroup]);

  if (isLoading) {
    return (
      <div className="p-6">
        <ContentSkeleton rowCount={8} />
      </div>
    );
  }

  if (isError) {
    return (
      <PlaneErrorState
        title="Unable to load duplicates"
        description="An issue occurred while scanning for duplicate references in your library."
        error={error || new Error('Internal Server Error')}
      />
    );
  }

  if (activeGroups.length === 0) {
    return (
      <div className="flex-1 w-full h-full min-h-[440px] flex flex-col items-center justify-center p-8 text-center select-none bg-background">
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
    );
  }

  return (
    <div className="h-full w-full overflow-y-auto scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden min-h-0 bg-background">
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
                Found {totalDuplicateItems} items with matching identifiers or titles.
              </p>
            </div>
          </div>
        </div>

        {/* Duplicate Groups List */}
        <div className="space-y-4">
          {activeGroups.map((group, groupIdx) => {
            const groupKey = getDeterministicGroupKey(group);
            const items = (group.items || []) as Item[];
            const isHighConfidence = group.confidence === 'high';
            const currentSelectedKey = selectedGroup
              ? getDeterministicGroupKey(selectedGroup)
              : activeGroups[0]
                ? getDeterministicGroupKey(activeGroups[0])
                : '';
            const isSelectedGroup =
              currentSelectedKey === groupKey || selectedGroupKeys.has(groupKey);
            const isDiffExpanded = expandedDiffGroupKeys.has(groupKey);
            const itemTypes = Array.from(new Set(items.map((it) => it.itemType).filter(Boolean)));
            const hasMismatchedTypes = itemTypes.length > 1;

            return (
              <div
                key={groupKey}
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey) {
                    toggleGroupSelect(groupKey);
                  } else if (e.shiftKey) {
                    selectAllHighConfidence();
                  }
                  setSelectedGroupKey(groupKey);
                }}
                style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 140px' }}
                className={cn(
                  'rounded-md border bg-card overflow-hidden transition-colors cursor-pointer',
                  isSelectedGroup
                    ? 'border-primary ring-1 ring-primary'
                    : 'border-border hover:border-border-hover',
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
                                handleOpenMerge(group, groupKey);
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
                <div className="divide-y divide-border-subtle">
                  {items.map((item, itemIdx) => {
                    const isSelected = activeItemId === item.id;
                    const authorFormatted = getItemAuthorsSummary(item);
                    const authorStr = authorFormatted !== '-' && authorFormatted !== '—' ? authorFormatted : '';

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
                              {item.publicationTitle && <span>• {item.publicationTitle}</span>}
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
    </div>
  );
}

export default DuplicatesContent;
