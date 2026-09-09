'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Files,
  FileText,
  GitMerge,
  BookOpen,
  Quote,
  Trash2,
  MoreVertical,
  Layers,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Skeleton } from '@/shared/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/shared/components/ui/context-menu';
import Topbar from '../components/Topbar';
import InspectorPanel from '../components/Panel';
import AddLinkModal from '../components/modals/AddLinkModal';
import CreateCollectionModal from '../components/modals/CreateCollectionModal';
import MergeModal from '../components/modals/MergeModal';
import BatchBar from '../components/table/BatchBar';
import { useLibrary } from '../hooks/use-library';
import { useDuplicateGroups, useMergePapers } from '../hooks/use-curation';
import { useItemTable, type SortField } from '../hooks/use-items';
import { normalizeAuthors, formatCreatorCompact } from '../utils/library.util';
import { cn } from '@/shared/lib/utils';
import type { CatalogItem } from '../types/library.types';

export default function DuplicatesPage() {
  const router = useRouter();
  const { state, actions } = useLibrary();
  const {
    workspaceId,
    search,
    selectedItemId,
    selectedItem,
    selectedCollection,
    collections,
    addLinkOpen,
    createCollectionOpen,
    isAddingItem,
    isCreatingCollection,
  } = state;

  const {
    setSearch,
    setSelectedItemId,
    setAddLinkOpen,
    handleDirectFilesUpload,
    handleDirectFolderUpload,
    handleAddLinkSubmit,
    setCreateCollectionOpen,
    handleCreateCollection,
    handleDeleteItem,
    handleBatchMoveItems,
  } = actions;

  const { data: duplicateData, isLoading: isDupLoading } = useDuplicateGroups(workspaceId);
  const mergeMutation = useMergePapers(workspaceId);

  const duplicateGroups = useMemo(
    () =>
      (duplicateData as { duplicateGroups?: any[]; groups?: any[] } | undefined)?.duplicateGroups ||
      (duplicateData as { duplicateGroups?: any[]; groups?: any[] } | undefined)?.groups ||
      [],
    [duplicateData],
  );

  const allDuplicateItems = useMemo(() => {
    const list: CatalogItem[] = [];
    const seen = new Set<string>();
    for (const group of duplicateGroups) {
      const groupItems = group.items || group.papers || [];
      for (const p of groupItems) {
        if (!seen.has(p.id)) {
          seen.add(p.id);
          list.push(p);
        }
      }
    }
    return list;
  }, [duplicateGroups]);

  const filteredItems = useMemo(() => {
    if (!search.trim()) return allDuplicateItems;
    const q = search.toLowerCase();
    return allDuplicateItems.filter(
      (p) =>
        p.title?.toLowerCase().includes(q) ||
        (Array.isArray(p.authors) &&
          p.authors.some((a: any) => (typeof a === 'string' ? a : a.name || '').toLowerCase().includes(q))) ||
        (p.doi && p.doi.toLowerCase().includes(q)),
    );
  }, [allDuplicateItems, search]);

  const {
    sortedItems,
    sortField,
    sortOrder,
    handleSort,
    selectedIds,
    isAllSelected,
    isPartiallySelected,
    toggleSelectAll,
    toggleSelect,
    clearSelection,
  } = useItemTable({
    items: filteredItems,
    initialSortField: 'createdAt',
    initialSortOrder: 'desc',
  });

  const handleSelectItem = (item: CatalogItem) => {
    const itemId = item.id;
    if (selectedItemId === itemId) {
      setSelectedItemId(null);
    } else {
      setSelectedItemId(itemId);
    }
  };

  const handleRowClick = (e: React.MouseEvent, item: CatalogItem) => {
    if ((e.target as HTMLElement).closest('input[type="checkbox"], button, [role="menuitem"]')) {
      return;
    }
    handleSelectItem(item);
  };

  const handleRowDoubleClick = (e: React.MouseEvent, item: CatalogItem) => {
    if ((e.target as HTMLElement).closest('input[type="checkbox"], button, [role="menuitem"]')) {
      return;
    }
    if (item.id && workspaceId) {
      router.push(`/${workspaceId}/library/papers/${item.id}`);
    }
  };

  const [mergeCluster, setMergeCluster] = useState<CatalogItem[] | null>(null);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [itemsToMerge, setItemsToMerge] = useState<CatalogItem[]>([]);

  const handleOpenMerge = (clusterItems: CatalogItem[]) => {
    if (!clusterItems || clusterItems.length < 2) return;
    setMergeCluster(clusterItems);
    setMergeOpen(true);
  };

  const handleExecuteMerge = async (
    masterItem: CatalogItem,
    _mergedFields: Partial<CatalogItem>,
    duplicateIdsToDelete: string[],
  ) => {
    await mergeMutation.mutateAsync({
      masterPaperId: masterItem.id,
      sourcePaperIds: duplicateIdsToDelete,
    });
  };

  const [hasUserSorted, setHasUserSorted] = useState(false);

  const onColumnSort = (field: SortField) => {
    setHasUserSorted(true);
    handleSort(field);
  };

  const renderSortIcon = (field: SortField) => {
    if (!hasUserSorted || sortField !== field) return null;
    return (
      <span className="shrink-0 ml-1.5 inline-flex items-center text-foreground">
        {sortOrder === 'desc' ? (
          <ArrowDown className="size-3.5 text-foreground shrink-0" />
        ) : (
          <ArrowUp className="size-3.5 text-foreground shrink-0" />
        )}
      </span>
    );
  };

  return (
    <div className="flex h-full min-w-0 flex-1 overflow-hidden font-sans">
      {/* Left Main Content Area */}
      <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">
        <Topbar
          title="Duplicate Items"
          icon={Files}
          search={search}
          onSearchChange={setSearch}
          onDirectFilesUpload={handleDirectFilesUpload}
          onDirectFolderUpload={handleDirectFolderUpload}
          onAddCollection={() => setCreateCollectionOpen(true)}
          onAddLink={() => setAddLinkOpen(true)}
        />

        {/* Central Duplicate Table - Managed Directly by DuplicatesPage */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-background">
          {duplicateGroups.length > 0 && !isDupLoading && (
            <div className="px-4 py-2 bg-muted border-b border-border flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2 text-xs">
                <Layers className="size-3.5 text-foreground shrink-0" />
                <span className="font-medium text-foreground">
                  {duplicateGroups.length} duplicate {duplicateGroups.length === 1 ? 'cluster' : 'clusters'} detected
                </span>
                <span className="text-muted-foreground font-mono">({allDuplicateItems.length} items)</span>
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-0.5">
                {duplicateGroups.map((group: any, idx: number) => {
                  const items = group.items || group.papers || [];
                  if (items.length < 2) return null;
                  const matchLabel = group.matchType === 'DOI' ? 'DOI' : 'Title';
                  return (
                    <Button
                      key={group.key || group.clusterId || idx}
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenMerge(items)}
                      className="h-6.5 px-2 text-11 font-medium gap-1.5 cursor-pointer bg-background hover:bg-muted border-border shadow-none text-foreground"
                    >
                      <GitMerge className="size-3 text-foreground shrink-0" />
                      <span>Review & Merge #{idx + 1} ({items.length} · {matchLabel})</span>
                    </Button>
                  );
                })}
              </div>
            </div>
          )}

          {isDupLoading && allDuplicateItems.length === 0 ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 py-2 border-b border-border">
                  <Skeleton className="size-4 rounded-md" />
                  <Skeleton className="h-4 flex-1 max-w-[360px]" />
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ))}
            </div>
          ) : duplicateGroups.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground select-none">
              <Files className="size-12 mb-3 opacity-20 text-foreground shrink-0" />
              <p className="text-sm font-medium text-foreground">No duplicates detected</p>
              <p className="text-xs text-muted-foreground mt-1">
                No duplicate items found by DOI or Title/Author/Year.
              </p>
            </div>
) : (
            <div className="flex-1 overflow-auto">
              <table className="w-full table-fixed text-left border-collapse">
                <colgroup>
                  <col className="w-10" />
                  <col className="w-4/12" />
                  <col className="w-4/12" />
                  <col className="w-1/12" />
                  <col className="w-3/12" />
                  <col className="w-10" />
                </colgroup>
                <thead className="sticky top-0 z-20 bg-background border-b border-border select-none">
                  <tr className="h-9 type-dense font-normal text-foreground [&_th]:font-normal [&_th]:text-foreground">
                    <th scope="col" className="w-10 px-2.5 py-1.5 text-center align-middle">
                      <Checkbox
                        checked={isAllSelected ? true : isPartiallySelected ? 'indeterminate' : false}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Select all"
                      />
                    </th>
                    <th
                      scope="col"
                      role="columnheader"
                      aria-sort={hasUserSorted && sortField === 'title' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                      tabIndex={0}
                      onClick={() => onColumnSort('title')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onColumnSort('title');
                        }
                      }}
                      className="group/th px-3.5 py-1.5 align-middle cursor-pointer min-w-0 truncate outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-inset select-none"
                    >
                      <div className="flex items-center">
                        <span className="truncate">Title</span>
                        {renderSortIcon('title')}
                      </div>
                    </th>
                    <th
                      scope="col"
                      role="columnheader"
                      aria-sort={hasUserSorted && sortField === 'authors' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                      tabIndex={0}
                      onClick={() => onColumnSort('authors')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onColumnSort('authors');
                        }
                      }}
                      className="group/th px-3.5 py-1.5 align-middle cursor-pointer truncate outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-inset select-none"
                    >
                      <div className="flex items-center">
                        <span className="truncate">Creator</span>
                        {renderSortIcon('authors')}
                      </div>
                    </th>
                    <th
                      scope="col"
                      role="columnheader"
                      aria-sort={hasUserSorted && sortField === 'year' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                      tabIndex={0}
                      onClick={() => onColumnSort('year')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onColumnSort('year');
                        }
                      }}
                      className="group/th px-3.5 py-1.5 align-middle cursor-pointer whitespace-nowrap outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-inset select-none"
                    >
                      <div className="flex items-center">
                        <span className="whitespace-nowrap">Year</span>
                        {renderSortIcon('year')}
                      </div>
                    </th>
                    <th scope="col" className="px-3.5 py-1.5 align-middle whitespace-nowrap">
                      <span className="whitespace-nowrap">Duplicate Group</span>
                    </th>
                    <th scope="col" className="w-10 px-2 py-1.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {sortedItems.map((paper) => {
                    const isSelected = selectedIds.has(paper.id);
                    const isActive = selectedItemId === paper.id;
                    const authors = normalizeAuthors(paper.authors, paper.creators, paper.contributors);
                    const authorCompact = formatCreatorCompact(authors);
                    const authorFull = authors.length > 0 ? authors.join('; ') : '—';

                    return (
                      <ContextMenu key={paper.id}>
                        <ContextMenuTrigger asChild>
                          <tr
                            onClick={(e) => handleRowClick(e, paper)}
                            onDoubleClick={(e) => handleRowDoubleClick(e, paper)}
                            className={cn(
                              'group h-9 transition-colors cursor-pointer border-b border-border',
                              isSelected ? 'bg-muted' : isActive ? 'bg-muted' : 'hover:bg-muted',
                            )}
                          >
                            <td className="w-10 px-2.5 py-1.5 text-center align-middle" onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleSelect(paper.id)}
                                aria-label={`Select ${paper.title || 'reference'}`}
                              />
                            </td>

                            <td className="px-3.5 py-1.5 align-middle min-w-0 max-w-0 truncate">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="truncate block type-dense font-normal text-foreground" title={paper.title || 'Untitled Reference'}>
                                  {paper.title || 'Untitled Reference'}
                                </span>
                              </div>
                            </td>

                            <td className="px-3.5 py-1.5 align-middle max-w-0 truncate">
                              <span className="truncate block type-dense font-normal text-foreground" title={authorFull}>
                                {authorCompact}
                              </span>
                            </td>

                            <td className="px-3.5 py-1.5 align-middle type-dense font-normal text-foreground tabular-nums truncate">
                              {paper.year || '—'}
                            </td>

                            <td className="px-3.5 py-1.5 align-middle type-dense font-normal text-foreground tabular-nums truncate">
                              {paper.createdAt ? new Date(paper.createdAt).toLocaleDateString('en-US') : '—'}
                            </td>

                            <td className="w-10 px-2 py-1.5 align-middle text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button
                                      type="button"
                                      className="size-7 flex items-center justify-center rounded-md text-foreground hover:bg-muted cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
                                      aria-label="Actions"
                                    >
                                      <MoreVertical className="size-4 text-foreground shrink-0" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" sideOffset={4} className="w-48 p-1.5 rounded-md border border-border bg-popover text-popover-foreground z-50 shadow-none space-y-0.5">
                                    <DropdownMenuItem
                                      onClick={() => router.push(`/${workspaceId}/library/papers/${paper.id}`)}
                                      className="h-8.5 gap-2.5 px-2.5 text-xs font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none focus-visible:ring-1 focus-visible:ring-primary"
                                    >
                                      <BookOpen className="size-3.5 text-foreground shrink-0" />
                                      <span>Open in Reader</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => handleSelectItem(paper)}
                                      className="h-8.5 gap-2.5 px-2.5 text-xs font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none focus-visible:ring-1 focus-visible:ring-primary"
                                    >
                                      <Quote className="size-3.5 text-foreground shrink-0" />
                                      <span>Cite</span>
                                    </DropdownMenuItem>
                                    {handleDeleteItem && (
                                      <DropdownMenuItem
                                        onClick={() => handleDeleteItem(paper.id)}
                                        className="h-8.5 gap-2.5 px-2.5 text-xs font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none focus-visible:ring-1 focus-visible:ring-primary"
                                      >
                                        <Trash2 className="size-3.5 text-foreground shrink-0" />
                                        <span>Move to Trash</span>
                                      </DropdownMenuItem>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </td>
                          </tr>
                        </ContextMenuTrigger>
                        <ContextMenuContent className="w-48 text-xs font-sans">
                          <ContextMenuItem onClick={() => router.push(`/${workspaceId}/library/papers/${paper.id}`)} className="gap-2">
                            <BookOpen className="size-3.5 shrink-0" />
                            <span>Open in Reader</span>
                          </ContextMenuItem>
                          <ContextMenuItem onClick={() => handleSelectItem(paper)} className="gap-2">
                            <Quote className="size-3.5 shrink-0" />
                            <span>Cite</span>
                          </ContextMenuItem>
                          {handleDeleteItem && (
                            <ContextMenuItem onClick={() => handleDeleteItem(paper.id)} className="gap-2 text-destructive">
                              <Trash2 className="size-3.5 shrink-0" />
                              <span>Move to Trash</span>
                            </ContextMenuItem>
                          )}
                        </ContextMenuContent>
                      </ContextMenu>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Floating batch action bar */}
          <BatchBar
            selectedCount={selectedIds.size}
            selectedItems={sortedItems.filter((i) => selectedIds.has(i.id))}
            collections={collections}
            onClearSelection={clearSelection}
            onBatchMove={handleBatchMoveItems ? (collectionId) => {
              handleBatchMoveItems(Array.from(selectedIds), collectionId);
              clearSelection();
            } : undefined}
            onBatchDelete={handleDeleteItem ? () => {
              Array.from(selectedIds).forEach((id) => handleDeleteItem(id));
              clearSelection();
            } : undefined}
          />
        </div>
      </div>

      {/* Right Inspector Panel */}
      <InspectorPanel
        paper={selectedItem || null}
        item={selectedItem || null}
        collection={selectedCollection || null}
        workspaceId={workspaceId}
        onClose={() => setSelectedItemId(null)}
      />

      <AddLinkModal
        open={addLinkOpen}
        onOpenChange={setAddLinkOpen}
        onSubmit={handleAddLinkSubmit}
        isPending={isAddingItem}
      />

      <CreateCollectionModal
        open={createCollectionOpen}
        onOpenChange={setCreateCollectionOpen}
        onSubmit={handleCreateCollection}
        isPending={isCreatingCollection}
      />

      {mergeCluster && (
        <MergeModal
          open={mergeOpen}
          onOpenChange={setMergeOpen}
          duplicates={mergeCluster}
          onMerge={handleExecuteMerge}
        />
      )}
    </div>
  );
}
