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
import { useLibrary } from '../hooks/library/use-library';
import { useViewItems, usePaperTable, type SortField } from '../hooks/library/use-items';
import { normalizeAuthors } from '../utils/library.util';
import { cn } from '@/shared/lib/utils';
import type { CatalogItem } from '../types/library.types';

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
  } = actions;

  const [search, setSearch] = useState('');

  const { data: viewData, isLoading } = useViewItems(workspaceId, 'recent', search);
  const recentlyReadItems: CatalogItem[] = Array.isArray(viewData)
    ? viewData
    : (viewData as any)?.items || [];

  const {
    sortedPapers,
    sortField,
    sortOrder,
    handleSort,
    selectedIds,
    isAllSelected,
    isPartiallySelected,
    toggleSelectAll,
    toggleSelectOne,
  } = usePaperTable(recentlyReadItems, {
    initialSortField: 'lastReadAt',
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

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-1 size-3 opacity-0 group-hover/th:opacity-60 transition-opacity" />;
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="ml-1 size-3 text-primary" />
    ) : (
      <ArrowDown className="ml-1 size-3 text-primary" />
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
                <div key={i} className="flex items-center gap-3 py-2 border-b border-border/40">
                  <Skeleton className="size-4 rounded" />
                  <Skeleton className="h-4 flex-1 max-w-[360px]" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-44" />
                </div>
              ))}
            </div>
          ) : recentlyReadItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 h-full min-h-[300px] text-center p-8 select-none">
              <div className="size-12 rounded-full bg-muted/60 flex items-center justify-center mb-3">
                <History className="size-6 text-muted-foreground" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">No recently read papers</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                {search.trim()
                  ? 'No reading history matching your search query.'
                  : 'Papers you open in the reader will automatically appear here with their reading timestamps.'}
              </p>
              {search.trim() && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="mt-3 text-xs text-primary hover:underline cursor-pointer font-medium"
                >
                  Clear search
                </button>
              )}
            </div>
          ) : (
            <div className="flex-1 overflow-auto">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-20 bg-background/95 backdrop-blur-xs border-b border-border/60">
                  <tr className="h-9 text-xs font-medium text-foreground">
                    <th className="w-10 px-2.5 py-1.5 text-center align-middle">
                      <Checkbox
                        checked={isAllSelected ? true : isPartiallySelected ? 'indeterminate' : false}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Select all"
                      />
                    </th>
                    <th
                      onClick={() => handleSort('title')}
                      className="group/th px-3 py-1.5 align-middle cursor-pointer min-w-[240px]"
                    >
                      <div className="flex items-center">
                        <span>Title</span>
                        {renderSortIcon('title')}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('authors')}
                      className="group/th px-3 py-1.5 align-middle cursor-pointer w-[220px] max-w-[280px]"
                    >
                      <div className="flex items-center">
                        <span>Creator</span>
                        {renderSortIcon('authors')}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('lastReadAt')}
                      className="group/th px-3 py-1.5 align-middle cursor-pointer w-[200px] max-w-[240px]"
                    >
                      <div className="flex items-center">
                        <span>Last Read</span>
                        {renderSortIcon('lastReadAt')}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('collection')}
                      className="group/th px-3 py-1.5 align-middle cursor-pointer w-[160px]"
                    >
                      <div className="flex items-center">
                        <span>Collection</span>
                        {renderSortIcon('collection')}
                      </div>
                    </th>
                    <th className="w-10 px-2 py-1.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 text-xs">
                  {sortedPapers.map((paper) => {
                    const isSelected = selectedIds.includes(paper.id);
                    const isActive = selectedItemId === paper.id;
                    const authors = normalizeAuthors(paper.authors, (paper as any).creators, (paper as any).contributors);
                    const authorText = authors.length > 0 ? authors.join('; ') : '—';
                    const collection = paper.collectionId ? collectionMap[paper.collectionId] : null;
                    const lastReadTimestamp = paper.lastReadAt || paper.accessedAt || paper.updatedAt || paper.createdAt;

                    return (
                      <ContextMenu key={paper.id}>
                        <ContextMenuTrigger asChild>
                          <tr
                            onClick={(e) => handleRowClick(e, paper)}
                            onDoubleClick={(e) => handleRowDoubleClick(e, paper)}
                            className={cn(
                              'group h-9 transition-colors cursor-pointer border-b border-border/30',
                              isSelected ? 'bg-muted/80' : isActive ? 'bg-muted/50' : 'hover:bg-muted/30',
                            )}
                          >
                            <td className="w-10 px-2.5 py-1.5 text-center align-middle" onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleSelectOne(paper.id)}
                                aria-label={`Select ${paper.title || 'reference'}`}
                              />
                            </td>

                            <td className="px-3 py-1.5 align-middle min-w-0">
                              <div className="flex items-center gap-2 min-w-0">
                                <FileText className="size-3.5 shrink-0 text-foreground" />
                                <span className="truncate font-medium text-foreground text-[13px]" title={paper.title || 'Untitled Reference'}>
                                  {paper.title || 'Untitled Reference'}
                                </span>
                              </div>
                            </td>

                            <td className="px-3 py-1.5 align-middle text-muted-foreground truncate w-[220px] max-w-[280px]">
                              <span className="truncate block" title={authorText}>
                                {authorText}
                              </span>
                            </td>

                            <td className="px-3 py-1.5 align-middle text-foreground font-mono text-[13px] tabular-nums w-[200px] max-w-[240px]">
                              <span title={lastReadTimestamp || ''}>
                                {formatLastReadDate(lastReadTimestamp)}
                              </span>
                            </td>

                            <td className="px-3 py-1.5 align-middle text-muted-foreground w-[160px] truncate">
                              {collection ? (
                                <span className="inline-flex items-center gap-1.5 truncate max-w-full text-foreground/80">
                                  <Folder className="size-3 shrink-0" />
                                  <span className="truncate">{collection.name}</span>
                                </span>
                              ) : (
                                <span className="text-muted-foreground/60">—</span>
                              )}
                            </td>

                            <td className="w-10 px-2 py-1.5 align-middle text-right" onClick={(e) => e.stopPropagation()}>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button
                                    type="button"
                                    className="size-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity"
                                    aria-label="Actions"
                                  >
                                    <MoreVertical className="size-3.5" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48 text-xs font-sans">
                                  <DropdownMenuItem
                                    onClick={() => router.push(`/${workspaceId}/library/papers/${paper.id}`)}
                                    className="gap-2 cursor-pointer"
                                  >
                                    <BookOpen className="size-3.5" />
                                    <span>Open in Reader</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleSelectItem(paper)}
                                    className="gap-2 cursor-pointer"
                                  >
                                    <Quote className="size-3.5" />
                                    <span>View & Cite</span>
                                  </DropdownMenuItem>
                                  {handleDeleteItem && (
                                    <DropdownMenuItem
                                      onClick={() => handleDeleteItem(paper.id)}
                                      className="gap-2 text-destructive focus:text-destructive cursor-pointer"
                                    >
                                      <Trash2 className="size-3.5" />
                                      <span>Move to Trash</span>
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </td>
                          </tr>
                        </ContextMenuTrigger>
                        <ContextMenuContent className="w-48 text-xs font-sans">
                          <ContextMenuItem onClick={() => router.push(`/${workspaceId}/library/papers/${paper.id}`)} className="gap-2">
                            <BookOpen className="size-3.5" />
                            <span>Open in Reader</span>
                          </ContextMenuItem>
                          <ContextMenuItem onClick={() => handleSelectItem(paper)} className="gap-2">
                            <Quote className="size-3.5" />
                            <span>View & Cite</span>
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
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
