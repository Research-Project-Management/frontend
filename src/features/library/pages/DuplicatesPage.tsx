'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  GitMerge,
  Layers,
  FileText,
  Calendar,
  BookOpen,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
  Columns,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { LibraryTopbar } from '../components/topbar';
import { LibraryInspector, DuplicateMergeInspector } from '../components/inspector';
import { formatAcademicAuthors } from '../utils/academic-text';
import { ContentSkeleton } from '../components/content/ContentSkeleton';
import { PlaneErrorState } from '@/shared/components/ui/PlaneErrorState';
import {
  DuplicatesStackIllustration,
  libraryIllustrationStyles,
} from '../components/content/LibraryIllustrations';
import {
  useDuplicateGroupsQuery,
  useMergeDuplicatesMutation,
} from '../data';
import { useLibrarySidebarStore, useLibraryViewStore } from '../store';
import { inspectItemDifferences } from '../domain';
import { LibraryModals } from '../components/modals/LibraryModals';
import MergeModal from '../components/modals/MergeModal';
import type { Item, DuplicateGroup } from '../types/library.types';

function InlineDiffView({ items }: { items: Item[] }) {
  const diff = useMemo(() => inspectItemDifferences(items, items[0]?.id), [items]);

  return (
    <div className="p-4 bg-muted/20 border-t border-border space-y-2.5">
      <div className="flex items-center justify-between text-11 text-muted-foreground font-medium">
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
              <tr className="text-muted-foreground font-medium">
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
                        <span className="block text-9 text-muted-foreground/70 font-mono">
                          identical
                        </span>
                      )}
                    </div>
                  </td>
                  {field.options.map((opt) => (
                    <td
                      key={opt.itemId}
                      className="px-3 py-2 align-top text-muted-foreground"
                    >
                      <div className="line-clamp-3 leading-relaxed text-11">
                        {opt.isEmpty ? (
                          <span className="italic text-muted-foreground/60">(Empty)</span>
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
  const activeScope = useLibrarySidebarStore((s) => s.activeScope);
  const effectiveScopeId = activeScope.type === 'project' ? activeScope.id : 'user';

  const activeItemId = useLibraryViewStore((s) => s.activeItemId);
  const setActiveItem = useLibraryViewStore((s) => s.setActiveItem);
  const setIsInspectorOpen = useLibraryViewStore((s) => s.setIsInspectorOpen);

  // Curation Queries & Mutations
  const { data, isLoading, isError, error, refetch } = useDuplicateGroupsQuery(effectiveScopeId);
  const mergeMutation = useMergeDuplicatesMutation(effectiveScopeId);

  // Local state
  const [dismissedGroupKeys, setDismissedGroupKeys] = useState<Set<string>>(new Set());
  const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(null);
  const [expandedDiffGroupKeys, setExpandedDiffGroupKeys] = useState<Set<string>>(new Set());
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
    toast.success('Dismissed duplicate group', { id: 'duplicate-group-action' });
  };

  const isUserScope = activeScope.type === 'user';
  const canEdit =
    isUserScope ||
    activeScope.role === 'owner' ||
    activeScope.role === 'coordinator' ||
    activeScope.role === 'contributor';

  return (
    <div className="flex h-full w-full overflow-hidden bg-background">
      {/* Main Workspace Content */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <LibraryTopbar title="Duplicate Items" showDisplay={false} canEdit={canEdit} />

        <div className="flex-1 overflow-y-auto min-h-0 bg-background/50">
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
              <p className="text-13 text-muted-foreground max-w-[420px] leading-relaxed font-normal">
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
                    <p className="text-12 text-muted-foreground">
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
                            className="text-10 text-muted-foreground font-normal h-5 rounded-md"
                          >
                            {items.length} {items.length === 1 ? 'item' : 'items'}
                          </Badge>
                          {hasMismatchedTypes && (
                            <Badge
                              variant="outline"
                              className="text-10 text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10 font-normal h-5 rounded-md"
                              title="Items in this group have different item types and must match before merging"
                            >
                              Type Mismatch
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => toggleInlineDiff(groupKey, e)}
                            className={cn(
                              'h-8 px-2.5 text-12 gap-1.5 transition-colors cursor-pointer',
                              isDiffExpanded
                                ? 'bg-primary/10 text-primary font-medium'
                                : 'text-muted-foreground hover:text-foreground',
                            )}
                            title="Toggle inline side-by-side diff comparison"
                          >
                            <Columns className="size-3.5" />
                            <span>{isDiffExpanded ? 'Hide Diff' : 'Inline Diff'}</span>
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDismissGroup(groupKey);
                            }}
                            className="h-8 px-2.5 text-12 text-muted-foreground hover:text-foreground cursor-pointer"
                          >
                            Dismiss
                          </Button>
                          {canEdit && (
                            <Button
                              size="sm"
                              disabled={hasMismatchedTypes}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenMerge(group);
                              }}
                              className="h-8 px-3 text-12 gap-1.5 font-medium shadow-none disabled:opacity-50 cursor-pointer"
                              title={
                                hasMismatchedTypes
                                  ? 'Items of different types cannot be merged'
                                  : 'Open merge workbench'
                              }
                            >
                              <GitMerge className="h-3.5 w-3.5" />
                              Merge this group
                            </Button>
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
                                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <div className="font-medium text-foreground truncate">
                                    {item.title || 'Untitled item'}
                                  </div>
                                  <div className="flex items-center gap-2 text-11 text-muted-foreground mt-0.5 truncate">
                                    {authorStr && <span>{authorStr}</span>}
                                    {item.year && (
                                      <span className="flex items-center gap-0.5">
                                        • <Calendar className="h-3 w-3 inline" /> {item.year}
                                      </span>
                                    )}
                                    {item.journal && <span>• {item.journal}</span>}
                                    {item.doi && (
                                      <span className="font-mono text-10 text-primary">
                                        • DOI: {item.doi}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    router.push(`/library/papers/${item.id}`);
                                  }}
                                  className="size-7 text-muted-foreground hover:text-foreground cursor-pointer"
                                  title="Open in Reader"
                                  aria-label="Open in Reader"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </Button>
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Inline Side-by-Side Diff Workbench */}
                      {isDiffExpanded && (
                        <InlineDiffView items={items} />
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
            scopeId={effectiveScopeId}
            canEdit={canEdit}
            onOpenModal={() => {
              setMergeCluster(selectedGroupItems);
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
