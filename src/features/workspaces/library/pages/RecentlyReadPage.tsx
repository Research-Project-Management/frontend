'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  History,
  FileText,
  BookOpen,
  Quote,
  MoreVertical,
  Folder,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Trash2,
} from 'lucide-react';
import { Checkbox } from "@/shared/components/ui";
import { Skeleton } from "@/shared/components/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/shared/components/ui";
import Topbar from '../components/Topbar';
import InspectorPanel from '../components/Panel';
import AddLinkModal from '../components/modals/AddLinkModal';
import CreateCollectionModal from '../components/modals/CreateCollectionModal';
import BatchBar from '../components/table/BatchBar';
import { useLibrary } from '../hooks/use-library';
import { useViewItems, useItemTable, type SortField } from '../hooks/use-items';
import { normalizeAuthors, formatCreatorCompact } from '../utils/library.util';
import { cn } from "@/shared/lib/utils";
import type { Item } from '../types/library.types';

function formatLastReadDate(dateString?: string | null): string {
  if (!dateString) return '—';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

export default function RecentlyReadPage() {
  const router = useRouter();
  const { state, actions } = useLibrary();
  const {
    workspaceId,
    selectedItemId,
    selectedItem,
    selectedCollection,
    collectionMap,
    collections,
    addLinkOpen,
    createCollectionOpen,
    isAddingItem,
    isCreatingCollection,
  } = state;

  const {
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

  const [search, setSearch] = useState('');

  const { data: viewData, isLoading } = useViewItems(workspaceId, 'recent', search);
  const recentlyReadItems: Item[] = Array.isArray(viewData)
    ? viewData
    : (viewData as { items?: Item[] } | undefined)?.items || [];

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
    items: recentlyReadItems,
    initialSortField: 'lastReadAt',
    initialSortOrder: 'desc',
  });

  const handleSelectItem = (item: Item) => {
    const itemId = item.id;
    if (selectedItemId === itemId) {
      setSelectedItemId(null);
    } else {
      setSelectedItemId(itemId);
    }
  };

  const handleRowClick = (e: React.MouseEvent, item: Item) => {
    if ((e.target as HTMLElement).closest('input[type="checkbox"], button, [role="menuitem"]')) {
      return;
    }
    handleSelectItem(item);
  };

  const handleRowDoubleClick = (e: React.MouseEvent, item: Item) => {
    if ((e.target as HTMLElement).closest('input[type="checkbox"], button, [role="menuitem"]')) {
      return;
    }
    if (item.id) {
      router.push(workspaceId ? `/${workspaceId}/library/papers/${item.id}` : `/library/papers/${item.id}`);
    }
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
          title="Recently Read"
          icon={History}
          search={search}
          onSearchChange={setSearch}
          onDirectFilesUpload={handleDirectFilesUpload}
          onDirectFolderUpload={handleDirectFolderUpload}
          onAddCollection={() => setCreateCollectionOpen(true)}
          onAddLink={() => setAddLinkOpen(true)}
        />

        {/* Central Items Table - Managed Directly by RecentlyReadPage */}
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col bg-background">
          {isLoading && recentlyReadItems.length === 0 ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 py-2 border-b border-border">
                  <Skeleton className="size-4 rounded-md" />
                  <Skeleton className="h-4 flex-1 max-w-[360px]" />
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-40" />
                </div>
              ))}
            </div>
          ) : recentlyReadItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 h-full min-h-[300px] text-center p-8 select-none">
              <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <History className="size-6 text-foreground shrink-0" />
              </div>
              <h2 className="text-sm font-semibold text-foreground">No recently read references</h2>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                {search.trim()
                  ? 'No references matching your search query.'
                  : 'Items you open in reader will appear here in chronological order.'}
              </p>
              {search.trim() && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="mt-3 text-xs text-foreground hover:bg-muted rounded-sm px-1.5 py-0.5 cursor-pointer font-medium"
                >
                  Clear search
                </button>
              )}
            </div>
          ) : (
            <div className="flex-1 overflow-auto">
              <table className="w-full table-fixed text-left border-collapse">
                <colgroup>
                  <col className="w-10" />
                  <col className="w-4/12" />
                  <col className="w-4/12" />
                  <col className="w-4/12" />
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
                      tabIndex={0}
                      aria-sort={hasUserSorted && sortField === 'title' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                      onClick={() => onColumnSort('title')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onColumnSort('title');
                        }
                      }}
                      className="group/th px-3.5 py-1.5 align-middle cursor-pointer min-w-0 truncate focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-inset"
                    >
                      <div className="flex items-center">
                        <span className="truncate">Title</span>
                        {renderSortIcon('title')}
                      </div>
                    </th>
                    <th
                      scope="col"
                      role="columnheader"
                      tabIndex={0}
                      aria-sort={hasUserSorted && sortField === 'authors' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                      onClick={() => onColumnSort('authors')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onColumnSort('authors');
                        }
                      }}
                      className="group/th px-3.5 py-1.5 align-middle cursor-pointer truncate focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-inset"
                    >
                      <div className="flex items-center">
                        <span className="truncate">Creator</span>
                        {renderSortIcon('authors')}
                      </div>
                    </th>
                    <th
                      scope="col"
                      role="columnheader"
                      tabIndex={0}
                      aria-sort={hasUserSorted && sortField === 'lastReadAt' ? (sortOrder === 'asc' ? 'descending' : 'ascending') : 'none'}
                      onClick={() => onColumnSort('lastReadAt')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onColumnSort('lastReadAt');
                        }
                      }}
                      className="group/th px-3.5 py-1.5 align-middle cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-inset"
                    >
                      <div className="flex items-center">
                        <span className="whitespace-nowrap">Last Read</span>
                        {renderSortIcon('lastReadAt')}
                      </div>
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
                    const lastReadTimestamp = paper.lastReadAt || paper.accessedAt || paper.updatedAt || paper.createdAt;

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
                              <span title={lastReadTimestamp || ''} className="truncate block">
                                {formatLastReadDate(lastReadTimestamp)}
                              </span>
                            </td>

                            <td className="w-10 px-2 py-1.5 align-middle text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button
                                      type="button"
                                      className="flex size-7 items-center justify-center rounded-md text-foreground hover:bg-muted cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary touch-manipulation"
                                      aria-label="More actions"
                                    >
                                      <MoreVertical className="size-4 text-foreground shrink-0" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" sideOffset={4} className="w-48 p-1.5 rounded-md border border-border bg-popover text-popover-foreground z-50 shadow-none space-y-0.5">
                                    <DropdownMenuItem
                                      onClick={() => router.push(workspaceId ? `/${workspaceId}/library/papers/${paper.id}` : `/library/papers/${paper.id}`)}
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
                          <ContextMenuItem onClick={() => router.push(workspaceId ? `/${workspaceId}/library/papers/${paper.id}` : `/library/papers/${paper.id}`)} className="gap-2">
                            <BookOpen className="size-3.5 shrink-0" />
                            <span>Open in Reader</span>
                          </ContextMenuItem>
                          <ContextMenuItem onClick={() => handleSelectItem(paper)} className="gap-2">
                            <Quote className="size-3.5 shrink-0" />
                            <span>Cite</span>
                          </ContextMenuItem>
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
            collections={[]}
            onClearSelection={clearSelection}
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

      {/* Add Link Modal */}
      <AddLinkModal
        open={addLinkOpen}
        onOpenChange={setAddLinkOpen}
        onSubmit={handleAddLinkSubmit}
        isPending={isAddingItem}
      />

      {/* Create Collection Modal */}
      <CreateCollectionModal
        open={createCollectionOpen}
        onOpenChange={setCreateCollectionOpen}
        onSubmit={handleCreateCollection}
        isPending={isCreatingCollection}
      />
    </div>
  );
}
